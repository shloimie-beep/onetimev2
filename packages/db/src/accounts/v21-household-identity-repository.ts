import type {
  AdultIdentity,
  AdultRole,
  AdultSession,
  AppliedOwnershipTransfer,
  HumanAccount,
  SafeHouseholdContext,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import {
  ADULT_SESSION_POLICY,
  ONE_TIME_PRODUCT_SCOPE,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import {
  VERIFICATION_RUNTIME_TIER,
  type RuntimeTier,
  type VerificationEnvironmentId,
} from '../../../contracts/src/state/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export class HouseholdIdentityRepositoryError extends Error {
  readonly code:
    | 'duplicate_identity'
    | 'incomplete_identity'
    | 'stale_version'
    | 'invalid_session_input'
    | 'session_not_created'
    | 'persistence_invariant';

  constructor(code: HouseholdIdentityRepositoryError['code'], message: string) {
    super(message);
    this.name = 'HouseholdIdentityRepositoryError';
    this.code = code;
  }
}

export async function inHouseholdIdentityTransaction<T>(
  pool: DbPool,
  run: (db: Queryable) => Promise<T>,
) {
  return inTransaction(pool, run);
}

export type V21AdultSessionTokenKind = 'access' | 'refresh';

export type V21AdultSessionRevocationReason =
  | 'adult_logout'
  | 'session_rotation'
  | 'credential_changed'
  | 'role_context_switch'
  | 'household_context_switch'
  | 'account_disabled'
  | 'account_archived'
  | 'household_ownership_transfer'
  | 'explicit_revocation';

export interface V21ParentSessionBinding {
  adultId: string;
  humanAccountId: string;
  householdId: string;
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
  securityVersion: number;
}

export interface CreateV21ParentSessionInput extends V21ParentSessionBinding {
  sessionId: string;
  accessTokenDigest: string;
  refreshTokenDigest: string;
  issuedAt: Date;
}

export interface ResolveV21ParentSessionInput extends V21ParentSessionBinding {
  sessionId: string;
  tokenKind: V21AdultSessionTokenKind;
  tokenDigest: string;
  now: Date;
}

export interface RevokeV21ParentSessionInput extends ResolveV21ParentSessionInput {
  reason: V21AdultSessionRevocationReason;
}

export interface ResolvedV21ParentSession {
  adultId: string;
  normalizedEmail: string;
  ownerDisplayName: string;
  session: AdultSession;
  household: SafeHouseholdContext;
}

export interface V21AdultSessionRepository {
  create(input: CreateV21ParentSessionInput): Promise<ResolvedV21ParentSession>;
  resolve(input: ResolveV21ParentSessionInput): Promise<ResolvedV21ParentSession | null>;
  revoke(input: RevokeV21ParentSessionInput): Promise<boolean>;
}

/**
 * Creates the PostgreSQL-backed v2.1 Parent-session unit.
 *
 * The caller supplies only already-domain-separated SHA-256 digests. Raw
 * access or refresh material is deliberately absent from every repository
 * input, result, query row, and error.
 */
export function createPostgresV21AdultSessionRepository(db: Queryable): V21AdultSessionRepository {
  return {
    create: (input) => createV21ParentSession(db, input),
    resolve: (input) => resolveV21ParentSession(db, input),
    revoke: (input) => revokeV21ParentSession(db, input),
  };
}

export async function createV21ParentSession(
  db: Queryable,
  input: CreateV21ParentSessionInput,
): Promise<ResolvedV21ParentSession> {
  assertParentSessionBinding(input);
  assertDigest(input.accessTokenDigest, 'access');
  assertDigest(input.refreshTokenDigest, 'refresh');
  if (input.accessTokenDigest === input.refreshTokenDigest) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Access and refresh session digests must be domain-separated.',
    );
  }
  const issuedAt = inputInstant(input.issuedAt);
  const idleExpiresAt = new Date(
    input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.idleMilliseconds,
  ).toISOString();
  const absoluteExpiresAt = new Date(
    input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.absoluteMilliseconds,
  ).toISOString();

  const result = await db.query(
    `WITH eligible AS (
       SELECT account.human_account_id,
              adult.adult_id,
              adult.normalized_email,
              adult.display_name AS owner_display_name,
              household.household_id,
              household.classification,
              access.current_state AS access_state
         FROM onetime.v21_human_accounts AS account
         JOIN onetime.v21_adult_identities AS adult
           ON adult.adult_id = account.adult_id
          AND adult.product_key = account.product_key
          AND adult.runtime_tier = account.runtime_tier
          AND adult.verification_environment_id = account.verification_environment_id
          AND adult.state = 'active'
         JOIN onetime.v21_human_account_role_memberships AS membership
           ON membership.human_account_id = account.human_account_id
          AND membership.role = 'parent'
          AND membership.revoked_at IS NULL
          AND membership.product_key = account.product_key
          AND membership.runtime_tier = account.runtime_tier
          AND membership.verification_environment_id = account.verification_environment_id
         JOIN onetime.v21_households AS household
           ON household.household_id = $4
          AND household.owner_human_account_id = account.human_account_id
          AND household.owner_adult_id = adult.adult_id
          AND household.product_key = account.product_key
          AND household.runtime_tier = account.runtime_tier
          AND household.verification_environment_id = account.verification_environment_id
          AND household.state = 'active'
         JOIN onetime.canonical_aggregate_states AS access
           ON access.aggregate_kind = 'access'
          AND access.aggregate_key = household.household_id
          AND access.product_key = household.product_key
          AND access.runtime_tier = household.runtime_tier
          AND access.verification_environment_id = household.verification_environment_id
          AND access.current_state IN ('free', 'active', 'grace', 'inactive')
          AND access.archived_at IS NULL
        WHERE account.human_account_id = $2
          AND adult.adult_id = $3
          AND account.state = 'active'
          AND account.security_version = $7
          AND account.product_key = '${ONE_TIME_PRODUCT_SCOPE}'
          AND account.runtime_tier = $5
          AND account.verification_environment_id = $6
     ),
     inserted AS (
       INSERT INTO onetime.v21_adult_sessions
         (session_id, human_account_id, active_role, active_household_id,
          access_token_digest, refresh_token_digest, security_version, version,
          idle_expires_at, absolute_expires_at, product_key, runtime_tier,
          verification_environment_id, created_at, updated_at)
       SELECT $1, eligible.human_account_id, 'parent', eligible.household_id,
              $8, $9, $7, 1, $10, $11, '${ONE_TIME_PRODUCT_SCOPE}', $5, $6, $12, $12
         FROM eligible
       ON CONFLICT (session_id) DO NOTHING
       RETURNING *
     )
     SELECT inserted.*,
            eligible.adult_id,
            eligible.normalized_email,
            eligible.owner_display_name,
            eligible.classification,
            eligible.access_state
       FROM inserted
       JOIN eligible
         ON eligible.human_account_id = inserted.human_account_id
        AND eligible.household_id = inserted.active_household_id`,
    [
      input.sessionId,
      input.humanAccountId,
      input.adultId,
      input.householdId,
      input.runtimeTier,
      input.verificationEnvironmentId,
      input.securityVersion,
      input.accessTokenDigest,
      input.refreshTokenDigest,
      idleExpiresAt,
      absoluteExpiresAt,
      issuedAt,
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new HouseholdIdentityRepositoryError(
      'session_not_created',
      'The exact active Parent, owner, household, access, and security binding was not eligible.',
    );
  }
  return resolvedParentSession(row);
}

export async function resolveV21ParentSession(
  db: Queryable,
  input: ResolveV21ParentSessionInput,
): Promise<ResolvedV21ParentSession | null> {
  assertParentSessionBinding(input);
  assertTokenKind(input.tokenKind);
  assertDigest(input.tokenDigest, input.tokenKind);
  const now = inputInstant(input.now);
  const result = await db.query(
    `SELECT session.*,
            adult.adult_id,
            adult.normalized_email,
            adult.display_name AS owner_display_name,
            household.classification,
            access.current_state AS access_state
       FROM onetime.v21_adult_sessions AS session
       JOIN onetime.v21_human_accounts AS account
         ON account.human_account_id = session.human_account_id
        AND account.product_key = session.product_key
        AND account.runtime_tier = session.runtime_tier
        AND account.verification_environment_id = session.verification_environment_id
        AND account.state = 'active'
        AND account.security_version = session.security_version
       JOIN onetime.v21_adult_identities AS adult
         ON adult.adult_id = account.adult_id
        AND adult.product_key = account.product_key
        AND adult.runtime_tier = account.runtime_tier
        AND adult.verification_environment_id = account.verification_environment_id
        AND adult.state = 'active'
       JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.role = 'parent'
        AND membership.revoked_at IS NULL
        AND membership.product_key = account.product_key
        AND membership.runtime_tier = account.runtime_tier
        AND membership.verification_environment_id = account.verification_environment_id
       JOIN onetime.v21_households AS household
         ON household.household_id = session.active_household_id
        AND household.owner_human_account_id = account.human_account_id
        AND household.owner_adult_id = adult.adult_id
        AND household.product_key = account.product_key
        AND household.runtime_tier = account.runtime_tier
        AND household.verification_environment_id = account.verification_environment_id
        AND household.state = 'active'
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
        AND access.product_key = household.product_key
        AND access.runtime_tier = household.runtime_tier
        AND access.verification_environment_id = household.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace', 'inactive')
        AND access.archived_at IS NULL
      WHERE session.session_id = $1
        AND session.human_account_id = $2
        AND adult.adult_id = $3
        AND session.active_role = 'parent'
        AND session.active_household_id = $4
        AND session.product_key = '${ONE_TIME_PRODUCT_SCOPE}'
        AND session.runtime_tier = $5
        AND session.verification_environment_id = $6
        AND session.security_version = $7
        AND CASE $8::text
              WHEN 'access' THEN session.access_token_digest = $9
              WHEN 'refresh' THEN session.refresh_token_digest = $9
              ELSE false
            END
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $10
        AND session.absolute_expires_at > $10
      LIMIT 1`,
    [
      input.sessionId,
      input.humanAccountId,
      input.adultId,
      input.householdId,
      input.runtimeTier,
      input.verificationEnvironmentId,
      input.securityVersion,
      input.tokenKind,
      input.tokenDigest,
      now,
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? resolvedParentSession(row) : null;
}

export async function revokeV21ParentSession(
  db: Queryable,
  input: RevokeV21ParentSessionInput,
): Promise<boolean> {
  assertParentSessionBinding(input);
  assertTokenKind(input.tokenKind);
  assertDigest(input.tokenDigest, input.tokenKind);
  assertRevocationReason(input.reason);
  const now = inputInstant(input.now);
  const result = await db.query(
    `WITH eligible_session AS (
       SELECT session.session_id
         FROM onetime.v21_adult_sessions AS session
         JOIN onetime.v21_human_accounts AS account
           ON account.human_account_id = session.human_account_id
          AND account.product_key = session.product_key
          AND account.runtime_tier = session.runtime_tier
          AND account.verification_environment_id = session.verification_environment_id
          AND account.state = 'active'
          AND account.security_version = session.security_version
         JOIN onetime.v21_adult_identities AS adult
           ON adult.adult_id = account.adult_id
          AND adult.product_key = account.product_key
          AND adult.runtime_tier = account.runtime_tier
          AND adult.verification_environment_id = account.verification_environment_id
          AND adult.state = 'active'
         JOIN onetime.v21_human_account_role_memberships AS membership
           ON membership.human_account_id = account.human_account_id
          AND membership.role = 'parent'
          AND membership.revoked_at IS NULL
          AND membership.product_key = account.product_key
          AND membership.runtime_tier = account.runtime_tier
          AND membership.verification_environment_id = account.verification_environment_id
         JOIN onetime.v21_households AS household
           ON household.household_id = session.active_household_id
          AND household.owner_human_account_id = account.human_account_id
          AND household.owner_adult_id = adult.adult_id
          AND household.product_key = account.product_key
          AND household.runtime_tier = account.runtime_tier
          AND household.verification_environment_id = account.verification_environment_id
          AND household.state = 'active'
         JOIN onetime.canonical_aggregate_states AS access
           ON access.aggregate_kind = 'access'
          AND access.aggregate_key = household.household_id
          AND access.product_key = household.product_key
          AND access.runtime_tier = household.runtime_tier
          AND access.verification_environment_id = household.verification_environment_id
          AND access.current_state IN ('free', 'active', 'grace', 'inactive')
          AND access.archived_at IS NULL
        WHERE session.session_id = $1
          AND session.human_account_id = $2
          AND adult.adult_id = $3
          AND session.active_role = 'parent'
          AND session.active_household_id = $4
          AND session.product_key = '${ONE_TIME_PRODUCT_SCOPE}'
          AND session.runtime_tier = $5
          AND session.verification_environment_id = $6
          AND session.security_version = $7
          AND CASE $8::text
                WHEN 'access' THEN session.access_token_digest = $9
                WHEN 'refresh' THEN session.refresh_token_digest = $9
                ELSE false
              END
          AND session.revoked_at IS NULL
          AND session.idle_expires_at > $10
          AND session.absolute_expires_at > $10
        FOR UPDATE OF session
     )
     UPDATE onetime.v21_adult_sessions AS session
        SET revoked_at = $10,
            revoke_reason = $11,
            version = session.version + 1,
            updated_at = $10
       FROM eligible_session
      WHERE session.session_id = eligible_session.session_id
      RETURNING session.session_id`,
    [
      input.sessionId,
      input.humanAccountId,
      input.adultId,
      input.householdId,
      input.runtimeTier,
      input.verificationEnvironmentId,
      input.securityVersion,
      input.tokenKind,
      input.tokenDigest,
      now,
      input.reason,
    ],
  );
  return result.rowCount === 1;
}

export async function findAdultAndAccountByNormalizedEmail(
  db: Queryable,
  input: {
    normalizedEmail: string;
    runtimeTier: RuntimeTier;
    verificationEnvironmentId: VerificationEnvironmentId;
  },
): Promise<{ adult: AdultIdentity; account: HumanAccount } | null> {
  const result = await db.query(
    `SELECT adult.adult_id,
            adult.normalized_email,
            adult.display_name,
            adult.state AS adult_state,
            adult.runtime_tier,
            adult.verification_environment_id,
            adult.version AS adult_version,
            adult.created_at AS adult_created_at,
            adult.updated_at AS adult_updated_at,
            account.human_account_id,
            account.state AS account_state,
            account.security_version,
            account.version AS account_version,
            account.created_at AS account_created_at,
            account.updated_at AS account_updated_at,
            COALESCE(
              array_agg(membership.role ORDER BY membership.role)
                FILTER (WHERE membership.role IS NOT NULL),
              ARRAY[]::text[]
            ) AS memberships
       FROM onetime.v21_adult_identities AS adult
       LEFT JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
       LEFT JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.revoked_at IS NULL
      WHERE adult.normalized_email = $1
        AND adult.runtime_tier = $2
        AND adult.verification_environment_id = $3
      GROUP BY adult.adult_id, account.human_account_id
      LIMIT 2`,
    [input.normalizedEmail, input.runtimeTier, input.verificationEnvironmentId],
  );
  if ((result.rowCount ?? 0) > 1) {
    throw new HouseholdIdentityRepositoryError(
      'duplicate_identity',
      'Normalized email resolved to more than one adult identity.',
    );
  }
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (!row.human_account_id) {
    throw new HouseholdIdentityRepositoryError(
      'incomplete_identity',
      'Adult identity is missing its sole HumanAccount.',
    );
  }
  const roles = stringArray(row.memberships);
  if (roles.length < 1 || roles.some((role) => role !== 'admin' && role !== 'parent')) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'HumanAccount role membership is outside the v2.1 adult role set.',
    );
  }
  return {
    adult: {
      adultId: text(row.adult_id),
      product: 'one_time_mishnayos',
      runtimeTier: enumValue(row.runtime_tier, ['isolated_staging', 'production']),
      verificationEnvironmentId: enumValue(row.verification_environment_id, [
        'ci',
        'provider_sandbox',
        'persistent_staging',
        'production_read_only',
        'production_operator_canary',
        'production_broad',
      ]),
      normalizedEmail: text(row.normalized_email),
      displayName: text(row.display_name),
      state: enumValue(row.adult_state, ['active', 'archived']),
      version: integer(row.adult_version),
      createdAt: timestamp(row.adult_created_at),
      updatedAt: timestamp(row.adult_updated_at),
    },
    account: {
      humanAccountId: text(row.human_account_id),
      product: 'one_time_mishnayos',
      runtimeTier: enumValue(row.runtime_tier, ['isolated_staging', 'production']),
      verificationEnvironmentId: enumValue(row.verification_environment_id, [
        'ci',
        'provider_sandbox',
        'persistent_staging',
        'production_read_only',
        'production_operator_canary',
        'production_broad',
      ]),
      adultId: text(row.adult_id),
      memberships: roles as AdultRole[],
      state: enumValue(row.account_state, ['invited', 'active', 'disabled', 'archived']),
      securityVersion: integer(row.security_version),
      version: integer(row.account_version),
      createdAt: timestamp(row.account_created_at),
      updatedAt: timestamp(row.account_updated_at),
    },
  };
}

export async function listOwnedHouseholdContexts(
  db: Queryable,
  input: {
    humanAccountId: string;
    runtimeTier: RuntimeTier;
    verificationEnvironmentId: VerificationEnvironmentId;
  },
): Promise<SafeHouseholdContext[]> {
  const result = await db.query(
    `SELECT household.household_id,
            owner.display_name AS owner_display_name,
            household.classification,
            access.current_state AS access_state
       FROM onetime.v21_households AS household
       JOIN onetime.v21_human_accounts AS account
         ON account.human_account_id = household.owner_human_account_id
        AND account.adult_id = household.owner_adult_id
        AND account.product_key = household.product_key
        AND account.runtime_tier = household.runtime_tier
        AND account.verification_environment_id = household.verification_environment_id
       JOIN onetime.v21_adult_identities AS owner
         ON owner.adult_id = household.owner_adult_id
        AND owner.product_key = household.product_key
        AND owner.runtime_tier = household.runtime_tier
        AND owner.verification_environment_id = household.verification_environment_id
        AND owner.state = 'active'
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
        AND access.product_key = household.product_key
        AND access.runtime_tier = household.runtime_tier
        AND access.verification_environment_id = household.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace', 'inactive')
        AND access.archived_at IS NULL
      WHERE household.owner_human_account_id = $1
        AND household.state = 'active'
        AND account.state = 'active'
        AND household.product_key = '${ONE_TIME_PRODUCT_SCOPE}'
        AND household.runtime_tier = $2
        AND household.verification_environment_id = $3
      ORDER BY household.created_at, household.household_id`,
    [input.humanAccountId, input.runtimeTier, input.verificationEnvironmentId],
  );
  return result.rows.map((row) => {
    const classification = enumValue(row.classification, ['family', 'school']);
    return {
      householdId: text(row.household_id),
      displayName: householdDisplayName(row.owner_display_name, classification),
      classification,
      accessState: enumValue(row.access_state, ['free', 'active', 'grace', 'inactive']),
      ownerRelationship: 'account_owner' as const,
    };
  });
}

/**
 * Persists a domain-approved transfer inside the caller's transaction.
 *
 * Every aggregate update carries the pre-plan version (`new version - 1`).
 * A zero-row update aborts the transaction so transfer acceptance cannot be
 * partially written. Tables are supplied by steward request
 * `F04-migration-001`; this module never creates schema at runtime.
 */
export async function persistAppliedOwnershipTransfer(
  db: Queryable,
  result: AppliedOwnershipTransfer,
): Promise<void> {
  await requireOneRow(
    db.query(
      `UPDATE onetime.v21_household_ownership_transfers
          SET state = 'accepted',
              replacement_adult_id = $2,
              accepted_at = $3,
              accepted_by_adult_id = $2,
              acceptance_request_hash = $4,
              version = $5,
              updated_at = $3
        WHERE transfer_id = $1
          AND state = 'pending'
          AND version = $6`,
      [
        result.transfer.transferId,
        result.replacementAdult.adultId,
        result.transfer.acceptedAt,
        result.transfer.acceptanceRequestHash,
        result.transfer.version,
        result.transfer.version - 1,
      ],
    ),
    'ownership transfer',
  );

  await requireOneRow(
    db.query(
      `UPDATE onetime.v21_households
          SET owner_adult_id = $2,
              owner_human_account_id = $3,
              version = $4,
              updated_at = $5
        WHERE household_id = $1
          AND version = $6`,
      [
        result.household.householdId,
        result.household.ownerAdultId,
        result.household.ownerHumanAccountId,
        result.household.version,
        result.household.updatedAt,
        result.household.version - 1,
      ],
    ),
    'household owner',
  );

  if (result.parentMembershipAdded) {
    await db.query(
      `INSERT INTO onetime.v21_human_account_role_memberships
         (human_account_id, role, granted_at, granted_reason)
       VALUES ($1, 'parent', $2, 'accepted_household_transfer')
       ON CONFLICT (human_account_id, role) WHERE revoked_at IS NULL
       DO NOTHING`,
      [result.replacementAccount.humanAccountId, result.transfer.acceptedAt],
    );
    await requireOneRow(
      db.query(
        `UPDATE onetime.v21_human_accounts
            SET security_version = $2,
                version = $3,
                updated_at = $4
          WHERE human_account_id = $1
            AND version = $5`,
        [
          result.replacementAccount.humanAccountId,
          result.replacementAccount.securityVersion,
          result.replacementAccount.version,
          result.replacementAccount.updatedAt,
          result.replacementAccount.version - 1,
        ],
      ),
      'replacement HumanAccount',
    );
  }

  await revokeIds(
    db,
    'onetime.v21_adult_sessions',
    'session_id',
    [...result.outgoingSessionIdsRevoked, ...result.replacementSessionIdsRevoked],
    result.transfer.acceptedAt!,
    'household_ownership_transfer',
  );
  await revokeIds(
    db,
    'onetime.v21_billing_portal_sessions',
    'billing_session_id',
    result.billingSessionIdsRevoked,
    result.transfer.acceptedAt!,
    'household_ownership_transfer',
  );
  await revokeIds(
    db,
    'onetime.v21_account_action_tokens',
    'token_id',
    result.setupOrResetTokenIdsInvalidated,
    result.transfer.acceptedAt!,
    'household_ownership_transfer',
  );

  await db.query(
    `INSERT INTO onetime.v21_provider_reassociation_intents
       (intent_id, household_id, previous_adult_id, replacement_adult_id,
        canonical_request_hash, changes_financial_identity, state, created_at)
     VALUES ($1,$2,$3,$4,$5,false,'queued',$6)
     ON CONFLICT (household_id, canonical_request_hash) DO NOTHING`,
    [
      `owner_reassociation:${result.transfer.transferId}`,
      result.providerIntent.householdId,
      result.providerIntent.previousAdultId,
      result.providerIntent.replacementAdultId,
      result.providerIntent.canonicalRequestHash,
      result.auditEvent.occurredAt,
    ],
  );
  await db.query(
    `INSERT INTO onetime.v21_account_audit_events
       (audit_event_id, event_type, household_id, actor_account_id,
        outgoing_adult_id, replacement_adult_id, canonical_request_hash, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (event_type, canonical_request_hash) DO NOTHING`,
    [
      `ownership_audit:${result.transfer.transferId}`,
      result.auditEvent.eventType,
      result.auditEvent.householdId,
      result.auditEvent.initiatingAdminAccountId,
      result.auditEvent.outgoingAdultId,
      result.auditEvent.replacementAdultId,
      result.auditEvent.canonicalRequestHash,
      result.auditEvent.occurredAt,
    ],
  );
}

function resolvedParentSession(row: Record<string, unknown>): ResolvedV21ParentSession {
  const classification = enumValue(row.classification, ['family', 'school']);
  const ownerDisplayName = ownerName(row.owner_display_name);
  return {
    adultId: text(row.adult_id),
    normalizedEmail: text(row.normalized_email),
    ownerDisplayName,
    session: {
      sessionId: text(row.session_id),
      product: enumValue(row.product_key, [ONE_TIME_PRODUCT_SCOPE]),
      runtimeTier: enumValue(row.runtime_tier, ['isolated_staging', 'production']),
      verificationEnvironmentId: enumValue(row.verification_environment_id, [
        'ci',
        'provider_sandbox',
        'persistent_staging',
        'production_read_only',
        'production_operator_canary',
        'production_broad',
      ]),
      humanAccountId: text(row.human_account_id),
      activeRole: enumValue(row.active_role, ['parent']),
      activeHouseholdId: text(row.active_household_id),
      securityVersion: integer(row.security_version),
      version: integer(row.version),
      idleExpiresAt: timestamp(row.idle_expires_at),
      absoluteExpiresAt: timestamp(row.absolute_expires_at),
      revokedAt: nullableTimestamp(row.revoked_at),
      revocationReason: nullableText(row.revoke_reason),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
    },
    household: {
      householdId: text(row.active_household_id),
      displayName: householdDisplayName(ownerDisplayName, classification),
      classification,
      accessState: enumValue(row.access_state, ['free', 'active', 'grace', 'inactive']),
      ownerRelationship: 'account_owner',
    },
  };
}

function assertParentSessionBinding(input: V21ParentSessionBinding & { sessionId: string }) {
  inputIdentifier(input.sessionId, 'session');
  inputIdentifier(input.adultId, 'adult');
  inputIdentifier(input.humanAccountId, 'HumanAccount');
  inputIdentifier(input.householdId, 'household');
  if (VERIFICATION_RUNTIME_TIER[input.verificationEnvironmentId] !== input.runtimeTier) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Adult session runtime tier and verification environment do not match.',
    );
  }
  if (!Number.isSafeInteger(input.securityVersion) || input.securityVersion < 1) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Adult session security version must be a positive integer.',
    );
  }
}

function assertDigest(value: string, kind: V21AdultSessionTokenKind) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      `The domain-separated ${kind} token digest must be lowercase SHA-256.`,
    );
  }
}

function assertTokenKind(value: V21AdultSessionTokenKind) {
  if (value !== 'access' && value !== 'refresh') {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Adult session token kind must be access or refresh.',
    );
  }
}

function assertRevocationReason(value: V21AdultSessionRevocationReason) {
  const allowed: readonly V21AdultSessionRevocationReason[] = [
    'adult_logout',
    'session_rotation',
    'credential_changed',
    'role_context_switch',
    'household_context_switch',
    'account_disabled',
    'account_archived',
    'household_ownership_transfer',
    'explicit_revocation',
  ];
  if (!allowed.includes(value)) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Adult session revocation reason is outside the bounded vocabulary.',
    );
  }
}

function inputIdentifier(value: string, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 256) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      `${label} identifier is missing or invalid.`,
    );
  }
}

function inputInstant(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new HouseholdIdentityRepositoryError(
      'invalid_session_input',
      'Adult session timestamp is invalid.',
    );
  }
  return value.toISOString();
}

function ownerName(value: unknown) {
  const parsed = text(value).trim();
  if (parsed.length === 0) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'Household owner display name is blank.',
    );
  }
  return parsed;
}

function householdDisplayName(value: unknown, classification: 'family' | 'school') {
  return `${ownerName(value)} ${classification === 'family' ? 'household' : 'school'}`;
}

async function revokeIds(
  db: Queryable,
  table: string,
  idColumn: string,
  ids: readonly string[],
  revokedAt: string,
  reason: string,
) {
  if (ids.length === 0) return;
  const allowedTargets = new Set([
    'onetime.v21_adult_sessions:session_id',
    'onetime.v21_billing_portal_sessions:billing_session_id',
    'onetime.v21_account_action_tokens:token_id',
  ]);
  if (!allowedTargets.has(`${table}:${idColumn}`)) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'Session/token revocation target is not an allowlisted F04 table.',
    );
  }
  const update =
    table === 'onetime.v21_account_action_tokens'
      ? `UPDATE ${table} SET invalidated_at = $2, invalidation_reason = $3
           WHERE ${idColumn} = ANY($1::text[]) AND invalidated_at IS NULL`
      : `UPDATE ${table} SET revoked_at = $2, revocation_reason = $3
           WHERE ${idColumn} = ANY($1::text[]) AND revoked_at IS NULL`;
  await db.query(update, [ids, revokedAt, reason]);
}

async function requireOneRow(pending: Promise<{ rowCount: number | null }>, aggregate: string) {
  const result = await pending;
  if (result.rowCount !== 1) {
    throw new HouseholdIdentityRepositoryError(
      'stale_version',
      `The locked ${aggregate} version changed; the transaction must roll back.`,
    );
  }
}

function text(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'Required identity text is missing.',
    );
  }
  return value;
}

function integer(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'Persisted version must be a positive integer.',
    );
  }
  return parsed;
}

function timestamp(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      'Persisted timestamp is invalid.',
    );
  }
  return parsed.toISOString();
}

function nullableTimestamp(value: unknown) {
  return value === null || value === undefined ? null : timestamp(value);
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : text(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(text) : [];
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  const parsed = text(value);
  if (!allowed.includes(parsed)) {
    throw new HouseholdIdentityRepositoryError(
      'persistence_invariant',
      `Persisted value ${parsed} is outside its canonical vocabulary.`,
    );
  }
  return parsed as T[number];
}
