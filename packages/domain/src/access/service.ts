import { createHash } from 'node:crypto';
import {
  accountAccessApplyResultSchema,
  accountAccessProjectionSchema,
  applyCurrentAccessStateSchema,
  freePilotAccessGrantSchema,
  freePilotAccessRevokeSchema,
  type AccountAccessApplyResult,
  type AccountAccessProjection,
  type AccountAccessSourceKind,
  type ApplyCurrentAccessState,
  type FreePilotAccessGrant,
  type FreePilotAccessRevoke,
} from '../../../contracts/src/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

const GRANTING_STATES = new Set(['active', 'grace', 'scheduled_end']);
const MAX_SOURCE_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_FREE_PILOT_DURATION_MS = 366 * 24 * 60 * 60 * 1000;
const SOURCE_PRECEDENCE: Readonly<Record<AccountAccessSourceKind, number>> = {
  legacy_preview: 0,
  free_pilot: 1,
  highlevel_payment_state: 2,
  admin_override: 3,
};

export type AccountAccessActorKind =
  'highlevel_action' | 'admin' | 'provisioner' | 'account_lifecycle' | 'migration';

export type AccountAccessErrorCode =
  | 'ACCESS_HOUSEHOLD_NOT_FOUND'
  | 'ACCESS_IDEMPOTENCY_CONFLICT'
  | 'ACCESS_INVALID_COMMAND'
  | 'ACCESS_SOURCE_CONFLICT'
  | 'ACCESS_SOURCE_PRECEDENCE'
  | 'ACCESS_SOURCE_STALE'
  | 'ACCESS_FREE_PILOT_NOT_FOUND';

export class AccountAccessError extends Error {
  readonly code: AccountAccessErrorCode;

  constructor(code: AccountAccessErrorCode, message: string) {
    super(message);
    this.name = 'AccountAccessError';
    this.code = code;
  }
}

type ReadHouseholdAccessInput = {
  db: Queryable;
  accountKey: string;
  productKey: string;
  householdKey: string;
  now?: Date;
};

type ApplyHouseholdAccessStateBase = {
  accountKey: string;
  productKey: string;
  sourceKind: AccountAccessSourceKind;
  actorKind: AccountAccessActorKind;
  idempotencyKey: string;
  command: ApplyCurrentAccessState;
  now?: Date;
};

type ApplyHouseholdAccessStateInput = ApplyHouseholdAccessStateBase & {
  pool: DbPool;
};

type ApplyHouseholdAccessStateWithClientInput = ApplyHouseholdAccessStateBase & {
  db: Queryable;
};

type FreePilotGrantInput = {
  pool: DbPool;
  accountKey: string;
  productKey: string;
  actorKind: AccountAccessActorKind;
  command: FreePilotAccessGrant;
  now?: Date;
};

type FreePilotRevokeInput = {
  pool: DbPool;
  accountKey: string;
  productKey: string;
  actorKind: AccountAccessActorKind;
  command: FreePilotAccessRevoke;
  now?: Date;
};

type ProjectionRow = Record<string, unknown> & {
  household_status?: unknown;
};

export async function readHouseholdAccess(
  input: ReadHouseholdAccessInput,
): Promise<AccountAccessProjection | null> {
  const now = input.now ?? new Date();
  const result = await input.db.query(
    `SELECT access.access_key,
            access.account_key,
            access.product_key,
            access.household_key,
            access.state,
            access.source_kind,
            access.effective_at,
            access.expires_at,
            access.opaque_source_reference,
            access.source_revision,
            access.source_updated_at,
            access.policy_version,
            access.revocation_reason,
            access.access_version,
            households.status AS household_status
       FROM onetime.account_access_projections AS access
       JOIN onetime.portal_households AS households
         ON households.account_key = access.account_key
        AND households.product_key = access.product_key
        AND households.household_key = access.household_key
      WHERE access.account_key = $1
        AND access.product_key = $2
        AND access.household_key = $3
      LIMIT 2`,
    [input.accountKey, input.productKey, input.householdKey],
  );
  if (!result.rowCount) return null;
  if ((result.rowCount ?? 0) !== 1) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_CONFLICT',
      'The household access projection is ambiguous.',
    );
  }
  return projectionFromRow(result.rows[0] as ProjectionRow, now);
}

export async function householdHasLearningAccess(input: ReadHouseholdAccessInput) {
  return (await readHouseholdAccess(input))?.grants_access === true;
}

export async function applyHouseholdAccessState(
  input: ApplyHouseholdAccessStateInput,
): Promise<AccountAccessApplyResult> {
  try {
    return await inTransaction(input.pool, (db) =>
      applyHouseholdAccessStateWithClient({
        ...input,
        db,
      }),
    );
  } catch (error) {
    if (isAuditableSourceRejection(error)) {
      await recordRejectedAccessAttempt(input.pool, {
        ...input,
        command: parseApplyCommand(input.command),
        now: input.now ?? new Date(),
        error,
      });
    }
    throw error;
  }
}

/**
 * Applies one access transition through an existing transaction.
 *
 * The caller must provide a transaction-scoped Queryable. This is intentionally
 * public so account activation can consume its lifecycle token and grant an
 * explicitly reviewed free-pilot state atomically, without nesting transactions.
 */
export async function applyHouseholdAccessStateWithClient(
  input: ApplyHouseholdAccessStateWithClientInput,
): Promise<AccountAccessApplyResult> {
  assertScopedKey(input.accountKey, 'account');
  assertScopedKey(input.productKey, 'product');
  assertIdempotencyKey(input.idempotencyKey);
  const command = parseApplyCommand(input.command);
  const now = input.now ?? new Date();
  assertValidDate(now, 'evaluation');
  assertTemporalRules(input.sourceKind, command, now);

  const household = await input.db.query(
    `SELECT status
       FROM onetime.portal_households
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      FOR UPDATE`,
    [input.accountKey, input.productKey, command.household_key],
  );
  if (household.rowCount !== 1) {
    throw new AccountAccessError(
      'ACCESS_HOUSEHOLD_NOT_FOUND',
      'The scoped household is unavailable.',
    );
  }

  const requestHash = accessRequestHash({
    accountKey: input.accountKey,
    productKey: input.productKey,
    sourceKind: input.sourceKind,
    command,
  });
  const eventKey = stableKey('account_access_event', [
    input.accountKey,
    input.productKey,
    input.idempotencyKey,
  ]);

  const idempotentEvent = await input.db.query(
    `SELECT request_hash, response_json, household_key, decision
       FROM onetime.account_access_events
      WHERE account_key = $1
        AND product_key = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [input.accountKey, input.productKey, input.idempotencyKey],
  );
  if (idempotentEvent.rowCount) {
    if (String(idempotentEvent.rows[0]?.request_hash) !== requestHash) {
      throw new AccountAccessError(
        'ACCESS_IDEMPOTENCY_CONFLICT',
        'The access idempotency key was already used for a different command.',
      );
    }
    const priorDecision = String(idempotentEvent.rows[0]?.decision);
    if (priorDecision.startsWith('rejected_')) {
      throw rejectedEventError(idempotentEvent.rows[0]?.response_json);
    }
    return replayResultWithCurrentProjection(input.db, {
      accountKey: input.accountKey,
      productKey: input.productKey,
      householdKey: String(idempotentEvent.rows[0]?.household_key),
      storedResponse: idempotentEvent.rows[0]?.response_json,
      now,
    });
  }

  const currentResult = await input.db.query(
    `SELECT access.access_key,
            access.account_key,
            access.product_key,
            access.household_key,
            access.state,
            access.source_kind,
            access.effective_at,
            access.expires_at,
            access.opaque_source_reference,
            access.source_revision,
            access.source_updated_at,
            access.source_request_hash,
            access.policy_version,
            access.revocation_reason,
            access.access_version,
            access.last_event_key,
            households.status AS household_status
       FROM onetime.account_access_projections AS access
       JOIN onetime.portal_households AS households
         ON households.account_key = access.account_key
        AND households.product_key = access.product_key
        AND households.household_key = access.household_key
      WHERE access.account_key = $1
        AND access.product_key = $2
        AND access.household_key = $3
      FOR UPDATE`,
    [input.accountKey, input.productKey, command.household_key],
  );
  const currentRow = currentResult.rows[0] as ProjectionRow | undefined;
  const currentProjection = currentRow ? projectionFromRow(currentRow, now) : null;

  const sourceDecision = decideSourceTransition({
    currentRow,
    sourceKind: input.sourceKind,
    command,
    requestHash,
  });
  if (sourceDecision === 'replayed') {
    if (!currentProjection) {
      throw new AccountAccessError(
        'ACCESS_SOURCE_CONFLICT',
        'The access projection replay target is unavailable.',
      );
    }
    const result: AccountAccessApplyResult = {
      state: 'replayed',
      projection: currentProjection,
      sessions_revoked: 0,
      payment_history_written: false,
    };
    await insertAccessEvent(input.db, {
      eventKey,
      accountKey: input.accountKey,
      productKey: input.productKey,
      householdKey: command.household_key,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      sourceKind: input.sourceKind,
      sourceReference: command.opaque_source_reference,
      sourceRevision: command.source_revision,
      sourceUpdatedAt: command.source_updated_at,
      previousState: currentProjection.state,
      nextState: currentProjection.state,
      decision: 'replayed',
      result,
      actorKind: input.actorKind,
    });
    return result;
  }

  const accessKey =
    currentProjection?.access_key ??
    stableKey('account_access', [input.accountKey, input.productKey, command.household_key]);
  const nextAccessVersion = (currentProjection?.access_version ?? 0) + 1;
  if (currentProjection) {
    await input.db.query(
      `UPDATE onetime.account_access_projections
          SET state = $5,
              source_kind = $6,
              effective_at = $7,
              expires_at = $8,
              opaque_source_reference = $9,
              source_revision = $10,
              source_updated_at = $11,
              source_request_hash = $12,
              policy_version = $13,
              revocation_reason = $14,
              access_version = $15,
              last_event_key = $16,
              updated_at = $17
        WHERE access_key = $1
          AND account_key = $2
          AND product_key = $3
          AND household_key = $4`,
      [
        accessKey,
        input.accountKey,
        input.productKey,
        command.household_key,
        command.state,
        input.sourceKind,
        command.effective_at,
        command.expires_at,
        command.opaque_source_reference,
        command.source_revision,
        command.source_updated_at,
        requestHash,
        command.policy_version,
        command.revocation_reason,
        nextAccessVersion,
        eventKey,
        now,
      ],
    );
  } else {
    await input.db.query(
      `INSERT INTO onetime.account_access_projections
         (access_key, account_key, product_key, household_key, state, source_kind,
          effective_at, expires_at, opaque_source_reference, source_revision,
          source_updated_at, source_request_hash, policy_version, revocation_reason,
          access_version, last_event_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)`,
      [
        accessKey,
        input.accountKey,
        input.productKey,
        command.household_key,
        command.state,
        input.sourceKind,
        command.effective_at,
        command.expires_at,
        command.opaque_source_reference,
        command.source_revision,
        command.source_updated_at,
        requestHash,
        command.policy_version,
        command.revocation_reason,
        nextAccessVersion,
        eventKey,
        now,
      ],
    );
  }

  const nextProjection = await readHouseholdAccess({
    db: input.db,
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: command.household_key,
    now,
  });
  if (!nextProjection) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_CONFLICT',
      'The access projection could not be read after applying its transition.',
    );
  }

  const grantChanged = (currentProjection?.grants_access ?? false) !== nextProjection.grants_access;
  const sessionsRevoked = grantChanged
    ? await revokeHouseholdPortalSessions(input.db, {
        accountKey: input.accountKey,
        productKey: input.productKey,
        householdKey: command.household_key,
        eventKey,
        now,
      })
    : 0;
  const result = accountAccessApplyResultSchema.parse({
    state: 'applied',
    projection: nextProjection,
    sessions_revoked: sessionsRevoked,
    payment_history_written: false,
  });
  await insertAccessEvent(input.db, {
    eventKey,
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: command.household_key,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    sourceKind: input.sourceKind,
    sourceReference: command.opaque_source_reference,
    sourceRevision: command.source_revision,
    sourceUpdatedAt: command.source_updated_at,
    previousState: currentProjection?.state ?? null,
    nextState: nextProjection.state,
    decision: 'applied',
    result,
    actorKind: input.actorKind,
  });
  return result;
}

export async function grantFreePilotAccess(
  input: FreePilotGrantInput,
): Promise<AccountAccessApplyResult> {
  const parsed = freePilotAccessGrantSchema.safeParse(input.command);
  if (!parsed.success) {
    throw new AccountAccessError('ACCESS_INVALID_COMMAND', 'The free-pilot grant is invalid.');
  }
  const now = input.now ?? new Date();
  assertValidDate(now, 'evaluation');

  try {
    return await inTransaction(input.pool, async (db) => {
      const replay = await replayFreePilotGrantIfPresent(db, {
        accountKey: input.accountKey,
        productKey: input.productKey,
        command: parsed.data,
        now,
      });
      if (replay) return replay;
      if (new Date(parsed.data.expires_at).getTime() <= now.getTime()) {
        throw new AccountAccessError(
          'ACCESS_INVALID_COMMAND',
          'The free-pilot grant must expire in the future.',
        );
      }
      assertFreePilotDuration(parsed.data.effective_at, parsed.data.expires_at);

      const current = await lockProjectionForFreePilot(db, {
        accountKey: input.accountKey,
        productKey: input.productKey,
        householdKey: parsed.data.household_key,
      });
      const sourceRevision =
        current?.source_kind === 'free_pilot' &&
        current.opaque_source_reference === parsed.data.opaque_source_reference
          ? Number(current.source_revision) + 1
          : 1;
      return applyHouseholdAccessStateWithClient({
        db,
        accountKey: input.accountKey,
        productKey: input.productKey,
        sourceKind: 'free_pilot',
        actorKind: input.actorKind,
        idempotencyKey: parsed.data.idempotency_key,
        now,
        command: {
          household_key: parsed.data.household_key,
          state: 'active',
          effective_at: normalizedIso(parsed.data.effective_at),
          expires_at: normalizedIso(parsed.data.expires_at),
          opaque_source_reference: parsed.data.opaque_source_reference,
          source_revision: sourceRevision,
          source_updated_at: now.toISOString(),
          policy_version: parsed.data.policy_version,
          revocation_reason: null,
        },
      });
    });
  } catch (error) {
    if (isAuditableSourceRejection(error)) {
      const current = await lockProjectionForFreePilot(input.pool, {
        accountKey: input.accountKey,
        productKey: input.productKey,
        householdKey: parsed.data.household_key,
      });
      const sourceRevision =
        current?.source_kind === 'free_pilot' &&
        current.opaque_source_reference === parsed.data.opaque_source_reference
          ? Number(current.source_revision) + 1
          : 1;
      await recordRejectedAccessAttempt(input.pool, {
        accountKey: input.accountKey,
        productKey: input.productKey,
        sourceKind: 'free_pilot',
        actorKind: input.actorKind,
        idempotencyKey: parsed.data.idempotency_key,
        now,
        command: {
          household_key: parsed.data.household_key,
          state: 'active',
          effective_at: normalizedIso(parsed.data.effective_at),
          expires_at: normalizedIso(parsed.data.expires_at),
          opaque_source_reference: parsed.data.opaque_source_reference,
          source_revision: sourceRevision,
          source_updated_at: now.toISOString(),
          policy_version: parsed.data.policy_version,
          revocation_reason: null,
        },
        error,
      });
    }
    throw error;
  }
}

export async function revokeFreePilotAccess(
  input: FreePilotRevokeInput,
): Promise<AccountAccessApplyResult> {
  const parsed = freePilotAccessRevokeSchema.safeParse(input.command);
  if (!parsed.success) {
    throw new AccountAccessError('ACCESS_INVALID_COMMAND', 'The free-pilot revoke is invalid.');
  }
  const now = input.now ?? new Date();
  assertValidDate(now, 'evaluation');
  assertNotTooFarInFuture(parsed.data.revoked_at, now, 'free-pilot revocation');

  return inTransaction(input.pool, async (db) => {
    const replay = await replayFreePilotRevokeIfPresent(db, {
      accountKey: input.accountKey,
      productKey: input.productKey,
      command: parsed.data,
      now,
    });
    if (replay) return replay;

    const current = await lockProjectionForFreePilot(db, {
      accountKey: input.accountKey,
      productKey: input.productKey,
      householdKey: parsed.data.household_key,
    });
    if (!current || current.source_kind !== 'free_pilot') {
      throw new AccountAccessError(
        'ACCESS_FREE_PILOT_NOT_FOUND',
        'No current free-pilot access exists for this household.',
      );
    }
    return applyHouseholdAccessStateWithClient({
      db,
      accountKey: input.accountKey,
      productKey: input.productKey,
      sourceKind: 'free_pilot',
      actorKind: input.actorKind,
      idempotencyKey: parsed.data.idempotency_key,
      now,
      command: {
        household_key: parsed.data.household_key,
        state: 'revoked',
        effective_at: normalizedIso(current.effective_at),
        expires_at:
          current.expires_at === null || current.expires_at === undefined
            ? null
            : normalizedIso(current.expires_at),
        opaque_source_reference: String(current.opaque_source_reference),
        source_revision: Number(current.source_revision) + 1,
        source_updated_at: normalizedIso(parsed.data.revoked_at),
        policy_version: parsed.data.policy_version,
        revocation_reason: parsed.data.reason,
      },
    });
  });
}

function parseApplyCommand(command: ApplyCurrentAccessState) {
  const parsed = applyCurrentAccessStateSchema.safeParse(command);
  if (!parsed.success) {
    throw new AccountAccessError('ACCESS_INVALID_COMMAND', 'The access command is invalid.');
  }
  return {
    ...parsed.data,
    effective_at: normalizedIso(parsed.data.effective_at),
    expires_at: parsed.data.expires_at ? normalizedIso(parsed.data.expires_at) : null,
    source_updated_at: normalizedIso(parsed.data.source_updated_at),
  };
}

function assertTemporalRules(
  sourceKind: AccountAccessSourceKind,
  command: ApplyCurrentAccessState,
  now: Date,
) {
  assertNotTooFarInFuture(command.source_updated_at, now, 'access source update');
  if (
    (sourceKind === 'free_pilot' ||
      command.state === 'grace' ||
      command.state === 'scheduled_end') &&
    !command.expires_at
  ) {
    throw new AccountAccessError(
      'ACCESS_INVALID_COMMAND',
      'This access state requires an explicit expiry.',
    );
  }
  if (
    GRANTING_STATES.has(command.state) &&
    command.expires_at &&
    new Date(command.expires_at).getTime() <= new Date(command.effective_at).getTime()
  ) {
    throw new AccountAccessError(
      'ACCESS_INVALID_COMMAND',
      'The access expiry must be later than its effective time.',
    );
  }
  if (sourceKind === 'free_pilot' && command.expires_at) {
    assertFreePilotDuration(command.effective_at, command.expires_at);
  }
}

function assertFreePilotDuration(effectiveAt: string, expiresAt: string) {
  const durationMs = new Date(expiresAt).getTime() - new Date(effectiveAt).getTime();
  if (durationMs > MAX_FREE_PILOT_DURATION_MS) {
    throw new AccountAccessError(
      'ACCESS_INVALID_COMMAND',
      'The free-pilot grant cannot exceed 366 days.',
    );
  }
}

function assertNotTooFarInFuture(value: string, now: Date, label: string) {
  if (new Date(value).getTime() > now.getTime() + MAX_SOURCE_FUTURE_SKEW_MS) {
    throw new AccountAccessError(
      'ACCESS_INVALID_COMMAND',
      `The ${label} timestamp is too far in the future.`,
    );
  }
}

function decideSourceTransition(input: {
  currentRow: ProjectionRow | undefined;
  sourceKind: AccountAccessSourceKind;
  command: ApplyCurrentAccessState;
  requestHash: string;
}): 'applied' | 'replayed' {
  if (!input.currentRow) return 'applied';
  const currentKind = String(input.currentRow.source_kind) as AccountAccessSourceKind;
  const currentPrecedence = SOURCE_PRECEDENCE[currentKind];
  const incomingPrecedence = SOURCE_PRECEDENCE[input.sourceKind];
  if (incomingPrecedence < currentPrecedence) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_PRECEDENCE',
      'A lower-precedence access source cannot replace the current source.',
    );
  }

  const currentUpdatedAt = dateFromUnknown(input.currentRow.source_updated_at).getTime();
  const incomingUpdatedAt = new Date(input.command.source_updated_at).getTime();
  if (incomingUpdatedAt < currentUpdatedAt) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_STALE',
      'The access source update is older than the current projection.',
    );
  }
  if (incomingPrecedence > currentPrecedence) return 'applied';

  const sameReference =
    String(input.currentRow.opaque_source_reference) === input.command.opaque_source_reference;
  if (!sameReference) {
    if (incomingUpdatedAt === currentUpdatedAt) {
      throw new AccountAccessError(
        'ACCESS_SOURCE_CONFLICT',
        'Two access source references have the same update time.',
      );
    }
    return 'applied';
  }

  const currentRevision = Number(input.currentRow.source_revision);
  if (input.command.source_revision < currentRevision) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_STALE',
      'The access source revision is older than the current projection.',
    );
  }
  if (input.command.source_revision === currentRevision) {
    if (String(input.currentRow.source_request_hash) === input.requestHash) return 'replayed';
    throw new AccountAccessError(
      'ACCESS_SOURCE_CONFLICT',
      'The access source revision was already used for different state.',
    );
  }
  return 'applied';
}

async function revokeHouseholdPortalSessions(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    householdKey: string;
    eventKey: string;
    now: Date;
  },
) {
  const users = await db.query(
    `SELECT users.user_key
       FROM onetime.account_users AS users
       JOIN onetime.portal_guardian_relationships AS guardians
         ON guardians.account_key = users.account_key
        AND guardians.product_key = users.product_key
        AND guardians.guardian_user_ref = users.user_key
      WHERE users.account_key = $1
        AND users.product_key = $2
        AND users.role = 'parent'
        AND guardians.household_key = $3
        AND guardians.status = 'active'
      UNION
     SELECT users.user_key
       FROM onetime.account_users AS users
       JOIN onetime.portal_student_access_state AS students
         ON students.account_key = users.account_key
        AND students.product_key = users.product_key
        AND students.student_user_ref = users.user_key
      WHERE users.account_key = $1
        AND users.product_key = $2
        AND users.role = 'student'
        AND students.household_key = $3
        AND students.status = 'active'`,
    [input.accountKey, input.productKey, input.householdKey],
  );
  const userKeys = [
    ...new Set(
      users.rows
        .map((row) => String((row as Record<string, unknown>).user_key ?? ''))
        .filter(Boolean),
    ),
  ];
  if (!userKeys.length) return 0;

  const placeholders = userKeys.map((_, index) => `$${index + 4}`).join(',');
  const parameters = [input.accountKey, input.productKey, input.now, ...userKeys];
  const revoked = await db.query(
    `UPDATE onetime.user_sessions
        SET revoked_at = COALESCE(revoked_at, $3)
      WHERE account_key = $1
        AND product_key = $2
        AND revoked_at IS NULL
        AND user_key IN (${placeholders})`,
    parameters,
  );
  await db.query(
    `UPDATE onetime.account_users
        SET security_version = security_version + 1,
            security_policy_updated_at = $3,
            updated_at = $3
      WHERE account_key = $1
        AND product_key = $2
        AND user_key IN (${placeholders})`,
    parameters,
  );
  await db.query(
    `UPDATE onetime.portal_student_access_state
        SET security_version = security_version + 1,
            last_session_revoked_at = $4,
            updated_at = $4
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND status = 'active'`,
    [input.accountKey, input.productKey, input.householdKey, input.now],
  );
  await db.query(
    `INSERT INTO onetime.auth_audit_events
       (event_key, account_key, product_key, user_key, event_type, success, reason, metadata, created_at)
     VALUES ($1,$2,$3,NULL,'household_access_sessions_revoked',true,'access_state_changed',$4::jsonb,$5)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('auth_audit', [input.eventKey, 'sessions_revoked']),
      input.accountKey,
      input.productKey,
      JSON.stringify({
        household_key: input.householdKey,
        affected_user_count: userKeys.length,
        revoked_session_count: Number(revoked.rowCount ?? 0),
      }),
      input.now,
    ],
  );
  return Number(revoked.rowCount ?? 0);
}

async function insertAccessEvent(
  db: Queryable,
  input: {
    eventKey: string;
    accountKey: string;
    productKey: string;
    householdKey: string;
    idempotencyKey: string;
    requestHash: string;
    sourceKind: AccountAccessSourceKind;
    sourceReference: string;
    sourceRevision: number;
    sourceUpdatedAt: string;
    previousState: AccountAccessProjection['state'] | null;
    nextState: AccountAccessProjection['state'];
    decision: 'applied' | 'replayed';
    result: AccountAccessApplyResult;
    actorKind: AccountAccessActorKind;
  },
) {
  await db.query(
    `INSERT INTO onetime.account_access_events
       (event_key, account_key, product_key, household_key, idempotency_key,
        request_hash, source_kind, source_reference_digest, source_revision,
        source_updated_at, previous_state, next_state, decision, response_json,
        actor_kind)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
    [
      input.eventKey,
      input.accountKey,
      input.productKey,
      input.householdKey,
      input.idempotencyKey,
      input.requestHash,
      input.sourceKind,
      sha256(input.sourceReference),
      input.sourceRevision,
      input.sourceUpdatedAt,
      input.previousState,
      input.nextState,
      input.decision,
      JSON.stringify(input.result),
      input.actorKind,
    ],
  );
}

function isAuditableSourceRejection(error: unknown): error is AccountAccessError {
  return (
    error instanceof AccountAccessError &&
    ['ACCESS_SOURCE_STALE', 'ACCESS_SOURCE_CONFLICT', 'ACCESS_SOURCE_PRECEDENCE'].includes(
      error.code,
    )
  );
}

function rejectionDecision(error: AccountAccessError) {
  if (error.code === 'ACCESS_SOURCE_STALE') return 'rejected_stale' as const;
  if (error.code === 'ACCESS_SOURCE_PRECEDENCE') return 'rejected_precedence' as const;
  return 'rejected_conflict' as const;
}

function rejectedEventError(value: unknown) {
  let response: Record<string, unknown> = {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object') {
      response = parsed as Record<string, unknown>;
    }
  } catch {
    // A malformed historical rejection must remain fail-closed.
  }
  const code = String(response.error_code ?? '');
  if (
    code === 'ACCESS_SOURCE_STALE' ||
    code === 'ACCESS_SOURCE_CONFLICT' ||
    code === 'ACCESS_SOURCE_PRECEDENCE'
  ) {
    return new AccountAccessError(
      code,
      typeof response.message === 'string'
        ? response.message
        : 'The access transition was previously rejected.',
    );
  }
  return new AccountAccessError(
    'ACCESS_SOURCE_CONFLICT',
    'The prior access rejection could not be verified.',
  );
}

async function recordRejectedAccessAttempt(
  pool: DbPool,
  input: ApplyHouseholdAccessStateBase & {
    command: ApplyCurrentAccessState;
    now: Date;
    error: AccountAccessError;
  },
) {
  await inTransaction(pool, async (db) => {
    const current = await db.query(
      `SELECT state
         FROM onetime.account_access_projections
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
        FOR UPDATE`,
      [input.accountKey, input.productKey, input.command.household_key],
    );
    if (current.rowCount !== 1) return;

    const requestHash = accessRequestHash({
      accountKey: input.accountKey,
      productKey: input.productKey,
      sourceKind: input.sourceKind,
      command: input.command,
    });
    const existing = await db.query(
      `SELECT request_hash
         FROM onetime.account_access_events
        WHERE account_key = $1
          AND product_key = $2
          AND idempotency_key = $3
        LIMIT 1`,
      [input.accountKey, input.productKey, input.idempotencyKey],
    );
    if (existing.rowCount) return;

    const currentState = String(current.rows[0]?.state) as AccountAccessProjection['state'];
    await db.query(
      `INSERT INTO onetime.account_access_events
         (event_key, account_key, product_key, household_key, idempotency_key,
          request_hash, source_kind, source_reference_digest, source_revision,
          source_updated_at, previous_state, next_state, decision, response_json,
          actor_kind, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13::jsonb,$14,$15)
       ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING`,
      [
        stableKey('account_access_event', [
          input.accountKey,
          input.productKey,
          input.idempotencyKey,
        ]),
        input.accountKey,
        input.productKey,
        input.command.household_key,
        input.idempotencyKey,
        requestHash,
        input.sourceKind,
        sha256(input.command.opaque_source_reference),
        input.command.source_revision,
        input.command.source_updated_at,
        currentState,
        rejectionDecision(input.error),
        JSON.stringify({
          error_code: input.error.code,
          message: input.error.message,
          payment_history_written: false,
        }),
        input.actorKind,
        input.now,
      ],
    );
  });
}

async function lockProjectionForFreePilot(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    householdKey: string;
  },
) {
  const result = await db.query(
    `SELECT source_kind, opaque_source_reference, source_revision, effective_at, expires_at
       FROM onetime.account_access_projections
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      FOR UPDATE`,
    [input.accountKey, input.productKey, input.householdKey],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function replayFreePilotGrantIfPresent(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    command: FreePilotAccessGrant;
    now: Date;
  },
) {
  const existing = await readEventForIdempotency(
    db,
    input.accountKey,
    input.productKey,
    input.command.idempotency_key,
  );
  if (!existing) return null;
  if (existing.decision.startsWith('rejected_')) {
    throw rejectedEventError(existing.response_json);
  }
  const result = replayResult(existing.response_json);
  const projection = result.projection;
  if (
    projection.household_key !== input.command.household_key ||
    projection.source_kind !== 'free_pilot' ||
    projection.state !== 'active' ||
    projection.effective_at !== normalizedIso(input.command.effective_at) ||
    projection.expires_at !== normalizedIso(input.command.expires_at) ||
    projection.opaque_source_reference !== input.command.opaque_source_reference ||
    projection.policy_version !== input.command.policy_version
  ) {
    throw new AccountAccessError(
      'ACCESS_IDEMPOTENCY_CONFLICT',
      'The free-pilot idempotency key was already used for a different command.',
    );
  }
  return replayResultWithCurrentProjection(db, {
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: input.command.household_key,
    storedResponse: existing.response_json,
    now: input.now,
  });
}

async function replayFreePilotRevokeIfPresent(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    command: FreePilotAccessRevoke;
    now: Date;
  },
) {
  const existing = await readEventForIdempotency(
    db,
    input.accountKey,
    input.productKey,
    input.command.idempotency_key,
  );
  if (!existing) return null;
  if (existing.decision.startsWith('rejected_')) {
    throw rejectedEventError(existing.response_json);
  }
  const result = replayResult(existing.response_json);
  const projection = result.projection;
  if (
    projection.household_key !== input.command.household_key ||
    projection.source_kind !== 'free_pilot' ||
    projection.state !== 'revoked' ||
    projection.source_updated_at !== normalizedIso(input.command.revoked_at) ||
    projection.revocation_reason !== input.command.reason ||
    projection.policy_version !== input.command.policy_version
  ) {
    throw new AccountAccessError(
      'ACCESS_IDEMPOTENCY_CONFLICT',
      'The free-pilot idempotency key was already used for a different command.',
    );
  }
  return replayResultWithCurrentProjection(db, {
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: input.command.household_key,
    storedResponse: existing.response_json,
    now: input.now,
  });
}

async function readEventForIdempotency(
  db: Queryable,
  accountKey: string,
  productKey: string,
  idempotencyKey: string,
) {
  const result = await db.query(
    `SELECT response_json, decision
       FROM onetime.account_access_events
      WHERE account_key = $1
        AND product_key = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [accountKey, productKey, idempotencyKey],
  );
  return result.rows[0] as { response_json: unknown; decision: string } | undefined;
}

function replayResult(value: unknown): AccountAccessApplyResult {
  const parsed =
    typeof value === 'string'
      ? accountAccessApplyResultSchema.parse(JSON.parse(value))
      : accountAccessApplyResultSchema.parse(value);
  return {
    ...parsed,
    state: 'replayed',
  };
}

async function replayResultWithCurrentProjection(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    householdKey: string;
    storedResponse: unknown;
    now: Date;
  },
): Promise<AccountAccessApplyResult> {
  const stored = replayResult(input.storedResponse);
  const current = await readHouseholdAccess({
    db,
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: input.householdKey,
    now: input.now,
  });
  if (!current) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_CONFLICT',
      'The access replay target is unavailable.',
    );
  }
  return accountAccessApplyResultSchema.parse({
    ...stored,
    state: 'replayed',
    projection: current,
    sessions_revoked: 0,
    payment_history_written: false,
  });
}

function projectionFromRow(row: ProjectionRow, now: Date) {
  const state = String(row.state);
  const effectiveAt = dateFromUnknown(row.effective_at);
  const expiresAt =
    row.expires_at === null || row.expires_at === undefined
      ? null
      : dateFromUnknown(row.expires_at);
  const grantsAccess =
    row.household_status === 'active' &&
    GRANTING_STATES.has(state) &&
    effectiveAt.getTime() <= now.getTime() &&
    (expiresAt === null || expiresAt.getTime() > now.getTime());
  return accountAccessProjectionSchema.parse({
    access_key: String(row.access_key),
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    household_key: String(row.household_key),
    state,
    source_kind: String(row.source_kind),
    effective_at: effectiveAt.toISOString(),
    expires_at: expiresAt?.toISOString() ?? null,
    opaque_source_reference: String(row.opaque_source_reference),
    source_revision: Number(row.source_revision),
    source_updated_at: dateFromUnknown(row.source_updated_at).toISOString(),
    policy_version: String(row.policy_version),
    revocation_reason:
      row.revocation_reason === null || row.revocation_reason === undefined
        ? null
        : String(row.revocation_reason),
    access_version: Number(row.access_version),
    grants_access: grantsAccess,
    evaluated_at: now.toISOString(),
  });
}

function accessRequestHash(input: {
  accountKey: string;
  productKey: string;
  sourceKind: AccountAccessSourceKind;
  command: ApplyCurrentAccessState;
}) {
  return sha256(
    canonicalJson({
      account_key: input.accountKey,
      product_key: input.productKey,
      source_kind: input.sourceKind,
      command: input.command,
    }),
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedIso(value: unknown) {
  return dateFromUnknown(value).toISOString();
}

function dateFromUnknown(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  assertValidDate(date, 'source');
  return date;
}

function assertValidDate(value: Date, label: string): asserts value is Date {
  if (Number.isNaN(value.getTime())) {
    throw new AccountAccessError('ACCESS_INVALID_COMMAND', `The ${label} timestamp is invalid.`);
  }
}

function assertScopedKey(value: string, label: string) {
  if (!/^[A-Za-z0-9_:-]{3,180}$/u.test(value)) {
    throw new AccountAccessError('ACCESS_INVALID_COMMAND', `The ${label} scope is invalid.`);
  }
}

function assertIdempotencyKey(value: string) {
  if (value.trim() !== value || value.length < 8 || value.length > 180) {
    throw new AccountAccessError(
      'ACCESS_INVALID_COMMAND',
      'The access idempotency key is invalid.',
    );
  }
}
