import type {
  AdultIdentity,
  AdultRole,
  AppliedOwnershipTransfer,
  HumanAccount,
  SafeHouseholdContext,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import type { RuntimeTier, VerificationEnvironmentId } from '../../../contracts/src/state/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export class HouseholdIdentityRepositoryError extends Error {
  readonly code:
    'duplicate_identity' | 'incomplete_identity' | 'stale_version' | 'persistence_invariant';

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
            household.display_name,
            household.classification,
            access.current_state AS access_state
       FROM onetime.v21_households AS household
       JOIN onetime.v21_human_accounts AS account
         ON account.human_account_id = household.owner_human_account_id
        AND account.adult_id = household.owner_adult_id
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
        AND access.runtime_tier = household.runtime_tier
        AND access.verification_environment_id = household.verification_environment_id
      WHERE household.owner_human_account_id = $1
        AND household.state = 'active'
        AND account.state = 'active'
        AND household.runtime_tier = $2
        AND household.verification_environment_id = $3
      ORDER BY household.created_at, household.household_id`,
    [input.humanAccountId, input.runtimeTier, input.verificationEnvironmentId],
  );
  return result.rows.map((row) => ({
    householdId: text(row.household_id),
    displayName: text(row.display_name),
    classification: enumValue(row.classification, ['family', 'school']),
    accessState: enumValue(row.access_state, ['free', 'active', 'grace', 'inactive']),
    ownerRelationship: 'account_owner' as const,
  }));
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
