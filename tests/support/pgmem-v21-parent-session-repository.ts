import { ADULT_SESSION_POLICY } from '../../packages/contracts/src/accounts/v21-household-identity.ts';
import { type DbPool } from '../../packages/db/src/index.ts';
import type {
  ResolvedV21ParentSession,
  V21AdultSessionRepository,
} from '../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { createPostgresV21AdultSessionRepository } from '../../packages/db/src/accounts/v21-household-identity-repository.ts';

export function createDbBackedTestAdultSessionRepository(db: DbPool): V21AdultSessionRepository {
  const productionRepository = createPostgresV21AdultSessionRepository(db);
  return {
    create: async (input) => {
      if (input.householdId === null) throw new Error('Parent-session household is required');
      const parentInput = { ...input, householdId: input.householdId };
      const identity = await readExactParentIdentity(db, parentInput);
      if (!identity) throw new Error('Parent-session identity binding is not eligible');
      const idleExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.idleMilliseconds,
      );
      const absoluteExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.absoluteMilliseconds,
      );
      const inserted = await db.query(
        `INSERT INTO onetime.v21_adult_sessions
           (session_id, human_account_id, active_role, active_household_id,
            access_token_digest, refresh_token_digest, security_version, version,
            idle_expires_at, absolute_expires_at, product_key, runtime_tier,
            verification_environment_id, created_at, updated_at)
         VALUES ($1,$2,'parent',$3,$4,$5,$6::bigint,1,$7::timestamptz,$8::timestamptz,
                 'one_time_mishnayos',$9,$10,$11::timestamptz,$11::timestamptz)
         RETURNING *`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.accessTokenDigest,
          input.refreshTokenDigest,
          input.securityVersion,
          idleExpiresAt,
          absoluteExpiresAt,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.issuedAt,
        ],
      );
      const session = inserted.rows[0] as Record<string, unknown> | undefined;
      if (inserted.rowCount !== 1 || !session) throw new Error('Parent session was not inserted');
      return resolvedParentSession(input.adultId, identity, session);
    },
    resolve: async (input) => {
      if (input.householdId === null) return null;
      const parentInput = { ...input, householdId: input.householdId };
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const result = await db.query(
        `SELECT *
           FROM onetime.v21_adult_sessions
          WHERE session_id = $1
            AND human_account_id = $2
            AND active_role = 'parent'
            AND active_household_id = $3
            AND product_key = 'one_time_mishnayos'
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND security_version = $6::bigint
            AND ${digestColumn} = $7
            AND revoked_at IS NULL
            AND idle_expires_at > $8::timestamptz
            AND absolute_expires_at > $8::timestamptz`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
        ],
      );
      const session = result.rows[0] as Record<string, unknown> | undefined;
      if (result.rowCount !== 1 || !session) return null;
      const identity = await readExactParentIdentity(db, parentInput);
      return identity ? resolvedParentSession(input.adultId, identity, session) : null;
    },
    revoke: async (input) => {
      if (input.householdId === null) return false;
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const result = await db.query(
        `UPDATE onetime.v21_adult_sessions
            SET revoked_at = $8::timestamptz,
                revoke_reason = $9,
                version = version + 1,
                updated_at = $8::timestamptz
          WHERE session_id = $1
            AND human_account_id = $2
            AND active_household_id = $3
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND security_version = $6::bigint
            AND ${digestColumn} = $7
            AND revoked_at IS NULL
          RETURNING session_id`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
          input.reason,
        ],
      );
      return result.rowCount === 1;
    },
    findLoginIdentity: (input) => productionRepository.findLoginIdentity(input),
    upgradeCredentialPasswordHash: (input) =>
      productionRepository.upgradeCredentialPasswordHash(input),
  };
}

type ExactParentIdentity = {
  normalizedEmail: string;
  ownerDisplayName: string;
  classification: 'family' | 'school';
  accessState: 'free' | 'active' | 'grace' | 'inactive';
};

async function readExactParentIdentity(
  db: DbPool,
  input: {
    adultId: string;
    humanAccountId: string;
    householdId: string;
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId:
      | 'ci'
      | 'provider_sandbox'
      | 'persistent_staging'
      | 'production_read_only'
      | 'production_operator_canary'
      | 'production_broad';
    securityVersion: number;
  },
): Promise<ExactParentIdentity | null> {
  const scope = [input.runtimeTier, input.verificationEnvironmentId] as const;
  const account = await db.query(
    `SELECT human_account_id
       FROM onetime.v21_human_accounts
      WHERE human_account_id = $1
        AND adult_id = $2
        AND state = 'active'
        AND security_version = $3::bigint
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $4
        AND verification_environment_id = $5`,
    [input.humanAccountId, input.adultId, input.securityVersion, ...scope],
  );
  const adult = await db.query(
    `SELECT normalized_email, display_name
       FROM onetime.v21_adult_identities
      WHERE adult_id = $1
        AND state = 'active'
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [input.adultId, ...scope],
  );
  const membership = await db.query(
    `SELECT membership_id
       FROM onetime.v21_human_account_role_memberships
      WHERE human_account_id = $1
        AND role = 'parent'
        AND revoked_at IS NULL
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [input.humanAccountId, ...scope],
  );
  const household = await db.query(
    `SELECT classification
       FROM onetime.v21_households
      WHERE household_id = $1
        AND owner_adult_id = $2
        AND owner_human_account_id = $3
        AND state = 'active'
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $4
        AND verification_environment_id = $5`,
    [input.householdId, input.adultId, input.humanAccountId, ...scope],
  );
  let access = await db.query(
    `SELECT current_state
       FROM onetime.canonical_aggregate_states
      WHERE aggregate_kind = 'access'
        AND aggregate_key = $1
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND current_state IN ('free','active','grace','inactive')
        AND archived_at IS NULL`,
    [input.householdId, ...scope],
  );
  if (access.rowCount === 0) {
    await materializePgMemAccessState(db, input.householdId, ...scope);
    access = await db.query(
      `SELECT current_state
         FROM onetime.canonical_aggregate_states
        WHERE aggregate_kind = 'access'
          AND aggregate_key = $1
          AND product_key = 'one_time_mishnayos'
          AND runtime_tier = $2
          AND verification_environment_id = $3
          AND current_state IN ('free','active','grace','inactive')
          AND archived_at IS NULL`,
      [input.householdId, ...scope],
    );
  }
  if (
    account.rowCount !== 1 ||
    adult.rowCount !== 1 ||
    membership.rowCount !== 1 ||
    household.rowCount !== 1 ||
    access.rowCount !== 1
  ) {
    return null;
  }
  const adultRow = adult.rows[0] as Record<string, unknown>;
  const householdRow = household.rows[0] as Record<string, unknown>;
  const accessRow = access.rows[0] as Record<string, unknown>;
  const classification = String(householdRow.classification);
  const accessState = String(accessRow.current_state);
  if (
    (classification !== 'family' && classification !== 'school') ||
    !['free', 'active', 'grace', 'inactive'].includes(accessState)
  ) {
    return null;
  }
  return {
    normalizedEmail: String(adultRow.normalized_email),
    ownerDisplayName: String(adultRow.display_name).trim(),
    classification,
    accessState: accessState as ExactParentIdentity['accessState'],
  };
}

async function materializePgMemAccessState(
  db: DbPool,
  householdId: string,
  runtimeTier: 'isolated_staging' | 'production',
  verificationEnvironmentId: ExactParentIdentityScope['verificationEnvironmentId'],
) {
  const transition = await db.query(
    `SELECT transition_key, aggregate_kind, aggregate_key, next_state, resulting_version,
            product_key, runtime_tier, verification_environment_id,
            actor_kind, actor_key, created_at
       FROM onetime.canonical_state_transition_events
      WHERE aggregate_kind = 'access'
        AND aggregate_key = $1
        AND previous_state IS NULL
        AND expected_version = 0
        AND resulting_version = 1
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [householdId, runtimeTier, verificationEnvironmentId],
  );
  const event = transition.rows[0] as Record<string, unknown> | undefined;
  if (transition.rowCount !== 1 || !event) return;
  await db.query(
    `INSERT INTO onetime.canonical_aggregate_states
       (aggregate_kind, aggregate_key, current_state, version, product_key,
        runtime_tier, verification_environment_id, last_transition_key,
        created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
        last_mutated_by_actor_key, archived_at, created_at, updated_at)
     VALUES ('access',$1,$2,$3::bigint,'one_time_mishnayos',$4,$5,$6,$7,$8,$7,$8,
             NULL,$9::timestamptz,$9::timestamptz)
     ON CONFLICT (aggregate_kind, aggregate_key) DO NOTHING`,
    [
      householdId,
      event.next_state,
      event.resulting_version,
      runtimeTier,
      verificationEnvironmentId,
      event.transition_key,
      event.actor_kind,
      event.actor_key,
      event.created_at,
    ],
  );
}

type ExactParentIdentityScope = Parameters<typeof readExactParentIdentity>[1];

function resolvedParentSession(
  adultId: string,
  identity: ExactParentIdentity,
  session: Record<string, unknown>,
): ResolvedV21ParentSession {
  return {
    adultId,
    normalizedEmail: identity.normalizedEmail,
    ownerDisplayName: identity.ownerDisplayName,
    ownedHouseholdCount: 1,
    memberships: ['parent'],
    session: {
      sessionId: String(session.session_id),
      product: 'one_time_mishnayos',
      runtimeTier: String(session.runtime_tier) as 'isolated_staging' | 'production',
      verificationEnvironmentId: String(
        session.verification_environment_id,
      ) as ResolvedV21ParentSession['session']['verificationEnvironmentId'],
      humanAccountId: String(session.human_account_id),
      activeRole: 'parent',
      activeHouseholdId: String(session.active_household_id),
      securityVersion: Number(session.security_version),
      version: Number(session.version),
      idleExpiresAt: instant(session.idle_expires_at),
      absoluteExpiresAt: instant(session.absolute_expires_at),
      revokedAt: session.revoked_at ? instant(session.revoked_at) : null,
      revocationReason: session.revoke_reason ? String(session.revoke_reason) : null,
      createdAt: instant(session.created_at),
      updatedAt: instant(session.updated_at),
    },
    household: {
      householdId: String(session.active_household_id),
      displayName: `${identity.ownerDisplayName} ${
        identity.classification === 'family' ? 'household' : 'school'
      }`,
      classification: identity.classification,
      accessState: identity.accessState,
      ownerRelationship: 'account_owner',
    },
  };
}

function instant(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
