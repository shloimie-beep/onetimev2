import {
  FIXTURE_RECONCILIATION_ROW_BUDGET,
  FIXTURE_RECONCILIATION_SCOPE,
} from './fixture-reconciliation.ts';

export const LEGACY_IDENTIFIER_HASH_DOMAINS = Object.freeze({
  accountRow: 'legacy_account_user:',
  userKey: 'legacy_user_key:',
  activeSession: 'legacy_session:',
});

export const LEGACY_ARGON2ID_PATTERN_SQL = `'^argon2id\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$'`;

export const V21_ARGON2ID_PATTERN_SQL = `'^argon2id-v1\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$'`;

export const V21_ARGON2ID_FROM_LEGACY_SQL = `'argon2id-v1$' || substring(legacy.password_hash FROM length('argon2id$') + 1)`;

export const RECONCILER_ACTOR_KEY = 'ot_live_001_03_fixture_reconciler';

export const PROTECTED_BINDINGS = Object.freeze([
  'normalized_email',
  'expected_legacy_account_row_sha256',
  'expected_legacy_user_key_sha256',
  'expected_active_legacy_session_sha256_or_null',
  'adult_id',
  'human_account_id',
  'admin_membership_id',
  'parent_membership_id',
  'household_id',
  'household_access_aggregate_ref',
  'household_seat_limit',
  'create_occurred_at',
  'human_account_create_transition_key',
  'human_account_create_idempotency_key',
  'access_create_transition_key',
  'access_create_idempotency_key',
  'create_canonical_request_hash',
  'compensation_occurred_at',
  'human_account_compensation_transition_key',
  'human_account_compensation_idempotency_key',
  'access_compensation_transition_key',
  'access_compensation_idempotency_key',
  'compensation_canonical_request_hash',
] as const);

export const BEGIN_SQL = `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

export const ADVISORY_LOCK_SQL = `
SELECT pg_advisory_xact_lock(
  hashtextextended('ot-live-001.03:operator-fixture:' || $1::text, 0)
)
`;

const EXACT_READBACK_SQL = `
WITH legacy AS MATERIALIZED (
  SELECT legacy.*
  FROM onetime.account_users AS legacy
  WHERE legacy.email_normalized = $1
    AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
    AND legacy.status = 'active'
), active_legacy_sessions AS MATERIALIZED (
  SELECT session.*
  FROM onetime.user_sessions AS session
  JOIN legacy ON legacy.user_key = session.user_key
  WHERE session.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND session.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND session.revoked_at IS NULL
    AND session.expires_at > CURRENT_TIMESTAMP
    AND session.security_version = legacy.security_version
), broad_counts AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.v21_adult_identities
      WHERE normalized_email = $1 OR adult_id = $5) AS adult_identities,
    (SELECT count(*) FROM onetime.v21_human_accounts
      WHERE human_account_id = $6 OR adult_id = $5) AS human_accounts,
    (SELECT count(*) FROM onetime.v21_adult_credentials
      WHERE human_account_id = $6 OR adult_id = $5) AS adult_credentials,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships
      WHERE membership_id = $7 OR (human_account_id = $6 AND role = 'admin')) AS admin_memberships,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships
      WHERE membership_id = $8 OR (human_account_id = $6 AND role = 'parent')) AS parent_memberships,
    (SELECT count(*) FROM onetime.v21_households
      WHERE household_id = $9 OR owner_adult_id = $5 OR owner_human_account_id = $6) AS family_households,
    (SELECT count(*) FROM onetime.v21_adult_sessions
      WHERE human_account_id = $6) AS adult_sessions,
    (SELECT count(*) FROM onetime.canonical_state_transition_events
      WHERE transition_key IN ($13, $19)
         OR (aggregate_kind = 'human_account' AND aggregate_key = $6)) AS human_account_transition_events,
    (SELECT count(*) FROM onetime.canonical_state_transition_events
      WHERE transition_key IN ($15, $21)
         OR (aggregate_kind = 'access' AND aggregate_key = $9)) AS access_transition_events,
    (SELECT count(*) FROM onetime.canonical_aggregate_states
      WHERE (aggregate_kind = 'human_account' AND aggregate_key = $6)
         OR last_transition_key IN ($13, $19)) AS human_account_aggregate_states,
    (SELECT count(*) FROM onetime.canonical_aggregate_states
      WHERE (aggregate_kind = 'access' AND aggregate_key = $9)
         OR last_transition_key IN ($15, $21)) AS access_aggregate_states
), exact_rows AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.v21_adult_identities AS adult CROSS JOIN legacy
      WHERE adult.adult_id = $5
        AND adult.normalized_email = $1
        AND adult.display_name = legacy.display_name
        AND adult.state = 'active'
        AND adult.version = 1
        AND adult.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND adult.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND adult.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND adult.created_at = $12
        AND adult.updated_at = $12
        AND adult.archived_at IS NULL) AS adult_identities,
    (SELECT count(*) FROM onetime.v21_human_accounts AS account
      WHERE account.human_account_id = $6
        AND account.adult_id = $5
        AND account.state = 'active'
        AND account.security_version = 1
        AND account.version = 1
        AND account.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND account.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND account.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND account.created_at = $12
        AND account.updated_at = $12
        AND account.archived_at IS NULL) AS human_accounts,
    (SELECT count(*) FROM onetime.v21_adult_credentials AS credential CROSS JOIN legacy
      WHERE credential.human_account_id = $6
        AND credential.adult_id = $5
        AND credential.credential_kind = 'adult_email_password'
        AND credential.password_hash = ${V21_ARGON2ID_FROM_LEGACY_SQL}
        AND substring(credential.password_hash FROM length('argon2id-v1$') + 1) =
            substring(legacy.password_hash FROM length('argon2id$') + 1)
        AND credential.credential_state = 'active'
        AND credential.credential_version = 1
        AND credential.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND credential.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND credential.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND credential.created_at = $12
        AND credential.updated_at = $12) AS adult_credentials,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships AS membership
      WHERE membership.membership_id = $7
        AND membership.human_account_id = $6
        AND membership.role = 'admin'
        AND membership.granted_at = $12
        AND membership.granted_reason = 'operator_fixture_exact_reconciliation'
        AND membership.granted_by_human_account_id IS NULL
        AND membership.revoked_at IS NULL
        AND membership.revoked_reason IS NULL
        AND membership.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND membership.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND membership.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}') AS admin_memberships,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships AS membership
      WHERE membership.membership_id = $8
        AND membership.human_account_id = $6
        AND membership.role = 'parent'
        AND membership.granted_at = $12
        AND membership.granted_reason = 'operator_fixture_exact_reconciliation'
        AND membership.granted_by_human_account_id IS NULL
        AND membership.revoked_at IS NULL
        AND membership.revoked_reason IS NULL
        AND membership.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND membership.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND membership.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}') AS parent_memberships,
    (SELECT count(*) FROM onetime.v21_households AS household
      WHERE household.household_id = $9
        AND household.owner_adult_id = $5
        AND household.owner_human_account_id = $6
        AND household.classification = 'family'
        AND household.state = 'active'
        AND household.seat_limit = $11
        AND household.active_seat_count = 0
        AND household.billing_account_ref IS NULL
        AND household.access_aggregate_ref = $10
        AND household.version = 1
        AND household.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND household.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND household.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND household.created_at = $12
        AND household.updated_at = $12
        AND household.archived_at IS NULL) AS family_households
), exact_create_transitions AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.canonical_state_transition_events AS event
      WHERE event.transition_key = $13
        AND event.aggregate_kind = 'human_account'
        AND event.aggregate_key = $6
        AND event.previous_state IS NULL
        AND event.next_state = 'active'
        AND event.expected_version = 0
        AND event.resulting_version = 1
        AND event.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND event.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND event.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND event.actor_kind = 'reconciler'
        AND event.actor_key = '${RECONCILER_ACTOR_KEY}'
        AND event.idempotency_key = $14
        AND event.canonical_request_hash = $17
        AND event.access_cause IS NULL
        AND event.created_at = $12) AS human_account,
    (SELECT count(*) FROM onetime.canonical_state_transition_events AS event
      WHERE event.transition_key = $15
        AND event.aggregate_kind = 'access'
        AND event.aggregate_key = $9
        AND event.previous_state IS NULL
        AND event.next_state = 'free'
        AND event.expected_version = 0
        AND event.resulting_version = 1
        AND event.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND event.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND event.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND event.actor_kind = 'reconciler'
        AND event.actor_key = '${RECONCILER_ACTOR_KEY}'
        AND event.idempotency_key = $16
        AND event.canonical_request_hash = $17
        AND event.access_cause = 'free_period'
        AND event.created_at = $12) AS access
), exact_active_aggregates AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.canonical_aggregate_states AS state
      WHERE state.aggregate_kind = 'human_account'
        AND state.aggregate_key = $6
        AND state.current_state = 'active'
        AND state.version = 1
        AND state.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND state.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND state.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND state.last_transition_key = $13
        AND state.created_by_actor_kind = 'reconciler'
        AND state.created_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.last_mutated_by_actor_kind = 'reconciler'
        AND state.last_mutated_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.archived_at IS NULL
        AND state.created_at = $12
        AND state.updated_at = $12) AS human_account,
    (SELECT count(*) FROM onetime.canonical_aggregate_states AS state
      WHERE state.aggregate_kind = 'access'
        AND state.aggregate_key = $9
        AND state.current_state = 'free'
        AND state.version = 1
        AND state.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND state.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND state.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND state.last_transition_key = $15
        AND state.created_by_actor_kind = 'reconciler'
        AND state.created_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.last_mutated_by_actor_kind = 'reconciler'
        AND state.last_mutated_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.archived_at IS NULL
        AND state.created_at = $12
        AND state.updated_at = $12) AS access
), exact_compensation_transitions AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.canonical_state_transition_events AS event
      WHERE event.transition_key = $19
        AND event.aggregate_kind = 'human_account'
        AND event.aggregate_key = $6
        AND event.previous_state = 'active'
        AND event.next_state = 'archived'
        AND event.expected_version = 1
        AND event.resulting_version = 2
        AND event.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND event.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND event.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND event.actor_kind = 'reconciler'
        AND event.actor_key = '${RECONCILER_ACTOR_KEY}'
        AND event.idempotency_key = $20
        AND event.canonical_request_hash = $23
        AND event.access_cause IS NULL
        AND event.created_at = $18) AS human_account,
    (SELECT count(*) FROM onetime.canonical_state_transition_events AS event
      WHERE event.transition_key = $21
        AND event.aggregate_kind = 'access'
        AND event.aggregate_key = $9
        AND event.previous_state = 'free'
        AND event.next_state = 'inactive'
        AND event.expected_version = 1
        AND event.resulting_version = 2
        AND event.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND event.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND event.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND event.actor_kind = 'reconciler'
        AND event.actor_key = '${RECONCILER_ACTOR_KEY}'
        AND event.idempotency_key = $22
        AND event.canonical_request_hash = $23
        AND event.access_cause = 'household_archived'
        AND event.created_at = $18) AS access
), exact_terminal_aggregates AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.canonical_aggregate_states AS state
      WHERE state.aggregate_kind = 'human_account'
        AND state.aggregate_key = $6
        AND state.current_state = 'archived'
        AND state.version = 2
        AND state.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND state.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND state.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND state.last_transition_key = $19
        AND state.created_by_actor_kind = 'reconciler'
        AND state.created_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.last_mutated_by_actor_kind = 'reconciler'
        AND state.last_mutated_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.archived_at = $18
        AND state.created_at = $12
        AND state.updated_at = $18) AS human_account,
    (SELECT count(*) FROM onetime.canonical_aggregate_states AS state
      WHERE state.aggregate_kind = 'access'
        AND state.aggregate_key = $9
        AND state.current_state = 'inactive'
        AND state.version = 2
        AND state.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
        AND state.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
        AND state.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
        AND state.last_transition_key = $21
        AND state.created_by_actor_kind = 'reconciler'
        AND state.created_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.last_mutated_by_actor_kind = 'reconciler'
        AND state.last_mutated_by_actor_key = '${RECONCILER_ACTOR_KEY}'
        AND state.archived_at IS NULL
        AND state.created_at = $12
        AND state.updated_at = $18) AS access
)
SELECT
  to_regprocedure('digest(bytea,text)') IS NOT NULL AS pgcrypto_digest_available,
  ($1 = lower(btrim($1)) AND $1 LIKE '%@%'
    AND $5 <> '' AND $6 <> '' AND $7 <> $8 AND $9 <> ''
    AND $10 = 'access:' || $9 AND $11::integer > 0
    AND $12::timestamptz IS NOT NULL AND $18::timestamptz > $12::timestamptz
    AND $13 <> '' AND $14 <> '' AND $15 <> '' AND $16 <> ''
    AND $19 <> '' AND $20 <> '' AND $21 <> '' AND $22 <> ''
    AND $13 <> $15 AND $13 <> $19 AND $13 <> $21
    AND $15 <> $19 AND $15 <> $21 AND $19 <> $21
    AND $14 <> $16 AND $14 <> $20 AND $14 <> $22
    AND $16 <> $20 AND $16 <> $22 AND $20 <> $22
    AND $17 ~ '^[a-f0-9]{64}$' AND $23 ~ '^[a-f0-9]{64}$') AS protected_bindings_valid,
  (SELECT count(*) FROM legacy) AS active_legacy_admin_accounts,
  (SELECT count(*) FROM active_legacy_sessions) AS active_legacy_sessions,
  (SELECT account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}' FROM legacy) AS account_key_matches,
  (SELECT product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}' FROM legacy) AS product_key_matches,
  (SELECT role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}' FROM legacy) AS role_matches,
  (SELECT encode(digest(convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.accountRow}' || id::text, 'UTF8'), 'sha256'), 'hex') FROM legacy) = $2 AS account_row_hash_matches,
  (SELECT encode(digest(convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.userKey}' || user_key, 'UTF8'), 'sha256'), 'hex') FROM legacy) = $3 AS user_key_hash_matches,
  CASE
    WHEN (SELECT count(*) FROM active_legacy_sessions) = 0 THEN $4::text IS NULL
    WHEN (SELECT count(*) FROM active_legacy_sessions) = 1 THEN
      (SELECT encode(digest(convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.activeSession}' || id::text, 'UTF8'), 'sha256'), 'hex') FROM active_legacy_sessions) = $4::text
    ELSE false
  END AS active_session_hash_matches,
  (SELECT btrim(display_name) <> '' FROM legacy) AS display_name_compatible,
  (SELECT password_hash ~ ${LEGACY_ARGON2ID_PATTERN_SQL}
      AND (${V21_ARGON2ID_FROM_LEGACY_SQL}) ~ ${V21_ARGON2ID_PATTERN_SQL}
   FROM legacy) AS password_hash_compatible,
  (SELECT encode(digest(convert_to(jsonb_build_object(
    'account', to_jsonb(legacy),
    'active_sessions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(session) ORDER BY session.id) FROM active_legacy_sessions AS session),
      '[]'::jsonb
    )
  )::text, 'UTF8'), 'sha256'), 'hex') FROM legacy) AS legacy_immutable_fingerprint,
  broad_counts.*,
  (exact_rows.adult_identities = 1
    AND exact_rows.human_accounts = 1
    AND exact_rows.adult_credentials = 1
    AND exact_rows.admin_memberships = 1
    AND exact_rows.parent_memberships = 1
    AND exact_rows.family_households = 1) AS exact_created_ids_match,
  (exact_rows.adult_credentials = 1) AS credential_hash_matches_legacy_inside_database,
  (exact_create_transitions.human_account = 1
    AND exact_create_transitions.access = 1) AS exact_create_transition_fields_match,
  (exact_active_aggregates.human_account = 1
    AND exact_active_aggregates.access = 1) AS exact_active_aggregate_fields_match,
  (exact_compensation_transitions.human_account = 1
    AND exact_compensation_transitions.access = 1) AS exact_compensation_transition_fields_match,
  (exact_terminal_aggregates.human_account = 1
    AND exact_terminal_aggregates.access = 1) AS exact_terminal_aggregate_fields_match,
  ((SELECT count(*)
      FROM onetime.v21_households AS household
      JOIN onetime.v21_human_accounts AS account
        ON account.human_account_id = household.owner_human_account_id
       AND account.adult_id = household.owner_adult_id
       AND account.product_key = household.product_key
       AND account.runtime_tier = household.runtime_tier
       AND account.verification_environment_id = household.verification_environment_id
       AND account.state = 'active'
      JOIN onetime.v21_adult_identities AS adult
        ON adult.adult_id = household.owner_adult_id
       AND adult.product_key = household.product_key
       AND adult.runtime_tier = household.runtime_tier
       AND adult.verification_environment_id = household.verification_environment_id
       AND adult.state = 'active'
      JOIN onetime.v21_human_account_role_memberships AS parent_membership
        ON parent_membership.human_account_id = account.human_account_id
       AND parent_membership.role = 'parent'
       AND parent_membership.revoked_at IS NULL
       AND parent_membership.product_key = household.product_key
       AND parent_membership.runtime_tier = household.runtime_tier
       AND parent_membership.verification_environment_id = household.verification_environment_id
      JOIN onetime.canonical_aggregate_states AS access
        ON access.aggregate_kind = 'access'
       AND access.aggregate_key = household.household_id
       AND access.product_key = household.product_key
       AND access.runtime_tier = household.runtime_tier
       AND access.verification_environment_id = household.verification_environment_id
       AND access.current_state IN ('free', 'active', 'grace', 'inactive')
       AND access.archived_at IS NULL
     WHERE household.household_id = $9
       AND household.owner_human_account_id = $6
       AND household.owner_adult_id = $5
       AND household.classification = 'family'
       AND household.state = 'active'
       AND household.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
       AND household.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
       AND household.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
       AND EXISTS (
         SELECT 1
         FROM onetime.v21_human_account_role_memberships AS admin_membership
         WHERE admin_membership.human_account_id = account.human_account_id
           AND admin_membership.role = 'admin'
           AND admin_membership.revoked_at IS NULL
           AND admin_membership.product_key = household.product_key
           AND admin_membership.runtime_tier = household.runtime_tier
           AND admin_membership.verification_environment_id = household.verification_environment_id
       )) = 1) AS parent_context_discoverable
FROM broad_counts, exact_rows, exact_create_transitions, exact_active_aggregates,
     exact_compensation_transitions, exact_terminal_aggregates
`;

export const PREFLIGHT_SQL = EXACT_READBACK_SQL;

export const LEGACY_IMMUTABLE_READBACK_SQL = `
WITH legacy AS MATERIALIZED (
  SELECT legacy.*
  FROM onetime.account_users AS legacy
  WHERE legacy.email_normalized = $1
    AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
    AND legacy.status = 'active'
), active_legacy_sessions AS MATERIALIZED (
  SELECT session.*
  FROM onetime.user_sessions AS session
  JOIN legacy ON legacy.user_key = session.user_key
  WHERE session.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND session.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND session.revoked_at IS NULL
    AND session.expires_at > CURRENT_TIMESTAMP
    AND session.security_version = legacy.security_version
)
SELECT encode(digest(convert_to(jsonb_build_object(
  'account', to_jsonb(legacy),
  'active_sessions', COALESCE(
    (SELECT jsonb_agg(to_jsonb(session) ORDER BY session.id) FROM active_legacy_sessions AS session),
    '[]'::jsonb
  )
)::text, 'UTF8'), 'sha256'), 'hex') AS legacy_immutable_fingerprint
FROM legacy
`;

// Each tuple is indexed by local placeholder position minus one and stores the
// corresponding one-based canonical position in PROTECTED_BINDINGS.
export const APPLY_INSERT_PROTECTED_BINDING_POSITIONS = Object.freeze([
  Object.freeze([5, 1, 12] as const),
  Object.freeze([6, 5, 12] as const),
  Object.freeze([7, 6, 12] as const),
  Object.freeze([8, 6, 12] as const),
  Object.freeze([9, 5, 6, 11, 10, 12] as const),
  Object.freeze([6, 5, 12, 1] as const),
  Object.freeze([13, 6, 14, 17, 12] as const),
  Object.freeze([15, 9, 16, 17, 12] as const),
] as const);

export const APPLY_INSERT_SQL = Object.freeze([
  `INSERT INTO onetime.v21_adult_identities
     (adult_id, normalized_email, display_name, state, version, product_key,
      runtime_tier, verification_environment_id, created_at, updated_at)
   SELECT $1, $2, legacy.display_name, 'active', 1,
          '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
          '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
          '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $3, $3
   FROM onetime.account_users AS legacy
   WHERE legacy.email_normalized = $2
     AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
     AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
     AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
     AND legacy.status = 'active'
   RETURNING adult_id`,
  `INSERT INTO onetime.v21_human_accounts
     (human_account_id, adult_id, state, security_version, version, product_key,
      runtime_tier, verification_environment_id, created_at, updated_at)
   VALUES ($1, $2, 'active', 1, 1, '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $3, $3)
   RETURNING human_account_id`,
  `INSERT INTO onetime.v21_human_account_role_memberships
     (membership_id, human_account_id, role, granted_at, granted_reason,
      product_key, runtime_tier, verification_environment_id)
   VALUES ($1, $2, 'admin', $3, 'operator_fixture_exact_reconciliation',
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}')
   RETURNING membership_id`,
  `INSERT INTO onetime.v21_human_account_role_memberships
     (membership_id, human_account_id, role, granted_at, granted_reason,
      product_key, runtime_tier, verification_environment_id)
   VALUES ($1, $2, 'parent', $3, 'operator_fixture_exact_reconciliation',
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}')
   RETURNING membership_id`,
  `INSERT INTO onetime.v21_households
     (household_id, owner_adult_id, owner_human_account_id, classification,
      state, seat_limit, active_seat_count, access_aggregate_ref, version,
      product_key, runtime_tier, verification_environment_id, created_at, updated_at)
   VALUES ($1, $2, $3, 'family', 'active', $4, 0, $5, 1,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $6, $6)
   RETURNING household_id`,
  `INSERT INTO onetime.v21_adult_credentials
     (human_account_id, adult_id, credential_kind, password_hash,
      credential_state, credential_version, product_key, runtime_tier,
      verification_environment_id, created_at, updated_at)
   SELECT $1, $2, 'adult_email_password', ${V21_ARGON2ID_FROM_LEGACY_SQL}, 'active', 1,
          '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
          '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
          '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $3, $3
   FROM onetime.account_users AS legacy
   WHERE legacy.email_normalized = $4
     AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
     AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
     AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
     AND legacy.status = 'active'
     AND legacy.password_hash ~ ${LEGACY_ARGON2ID_PATTERN_SQL}
     AND (${V21_ARGON2ID_FROM_LEGACY_SQL}) ~ ${V21_ARGON2ID_PATTERN_SQL}
   RETURNING human_account_id`,
  `INSERT INTO onetime.canonical_state_transition_events
     (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
      expected_version, resulting_version, product_key, runtime_tier,
      verification_environment_id, actor_kind, actor_key, idempotency_key,
      canonical_request_hash, access_cause, created_at)
   VALUES ($1, 'human_account', $2, NULL, 'active', 0, 1,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}',
           'reconciler', '${RECONCILER_ACTOR_KEY}', $3, $4, NULL, $5)
   RETURNING transition_key`,
  `INSERT INTO onetime.canonical_state_transition_events
     (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
      expected_version, resulting_version, product_key, runtime_tier,
      verification_environment_id, actor_kind, actor_key, idempotency_key,
      canonical_request_hash, access_cause, created_at)
   VALUES ($1, 'access', $2, NULL, 'free', 0, 1,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}',
           'reconciler', '${RECONCILER_ACTOR_KEY}', $3, $4, 'free_period', $5)
   RETURNING transition_key`,
]);

export const AFTER_READBACK_SQL = EXACT_READBACK_SQL;

export const COMPENSATION_TRANSITION_INSERT_SQL = Object.freeze([
  `INSERT INTO onetime.canonical_state_transition_events
     (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
      expected_version, resulting_version, product_key, runtime_tier,
      verification_environment_id, actor_kind, actor_key, idempotency_key,
      canonical_request_hash, access_cause, created_at)
   VALUES ($19, 'human_account', $6, 'active', 'archived', 1, 2,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}',
           'reconciler', '${RECONCILER_ACTOR_KEY}', $20, $23, NULL, $18)
   RETURNING transition_key`,
  `INSERT INTO onetime.canonical_state_transition_events
     (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
      expected_version, resulting_version, product_key, runtime_tier,
      verification_environment_id, actor_kind, actor_key, idempotency_key,
      canonical_request_hash, access_cause, created_at)
   VALUES ($21, 'access', $9, 'free', 'inactive', 1, 2,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}',
           'reconciler', '${RECONCILER_ACTOR_KEY}', $22, $23, 'household_archived', $18)
   RETURNING transition_key`,
]);

export const COMPENSATION_DERIVED_STATE_READBACK_SQL = EXACT_READBACK_SQL;

export const COMPENSATION_DELETE_SQL = Object.freeze([
  `DELETE FROM onetime.v21_adult_credentials AS credential
   WHERE credential.human_account_id = $6
     AND credential.adult_id = $5
     AND credential.credential_kind = 'adult_email_password'
     AND credential.password_hash = (
       SELECT ${V21_ARGON2ID_FROM_LEGACY_SQL}
       FROM onetime.account_users AS legacy
       WHERE legacy.email_normalized = $1
         AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
         AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
         AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
         AND legacy.status = 'active'
     )
     AND substring(credential.password_hash FROM length('argon2id-v1$') + 1) = (
       SELECT substring(legacy.password_hash FROM length('argon2id$') + 1)
       FROM onetime.account_users AS legacy
       WHERE legacy.email_normalized = $1
         AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
         AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
         AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
         AND legacy.status = 'active'
     )
     AND credential.credential_state = 'active'
     AND credential.credential_version = 1
     AND credential.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND credential.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND credential.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
     AND credential.created_at = $12
     AND credential.updated_at = $12
   RETURNING human_account_id`,
  `DELETE FROM onetime.v21_human_account_role_memberships AS membership
   WHERE membership.membership_id = $8
     AND membership.human_account_id = $6
     AND membership.role = 'parent'
     AND membership.granted_at = $12
     AND membership.granted_reason = 'operator_fixture_exact_reconciliation'
     AND membership.granted_by_human_account_id IS NULL
     AND membership.revoked_at IS NULL
     AND membership.revoked_reason IS NULL
     AND membership.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND membership.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND membership.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
   RETURNING membership_id`,
  `DELETE FROM onetime.v21_human_account_role_memberships AS membership
   WHERE membership.membership_id = $7
     AND membership.human_account_id = $6
     AND membership.role = 'admin'
     AND membership.granted_at = $12
     AND membership.granted_reason = 'operator_fixture_exact_reconciliation'
     AND membership.granted_by_human_account_id IS NULL
     AND membership.revoked_at IS NULL
     AND membership.revoked_reason IS NULL
     AND membership.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND membership.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND membership.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
   RETURNING membership_id`,
  `DELETE FROM onetime.v21_households AS household
   WHERE household.household_id = $9
     AND household.owner_adult_id = $5
     AND household.owner_human_account_id = $6
     AND household.classification = 'family'
     AND household.state = 'active'
     AND household.seat_limit = $11
     AND household.active_seat_count = 0
     AND household.billing_account_ref IS NULL
     AND household.access_aggregate_ref = $10
     AND household.version = 1
     AND household.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND household.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND household.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
     AND household.created_at = $12
     AND household.updated_at = $12
     AND household.archived_at IS NULL
   RETURNING household_id`,
  `DELETE FROM onetime.v21_human_accounts AS account
   WHERE account.human_account_id = $6
     AND account.adult_id = $5
     AND account.state = 'active'
     AND account.security_version = 1
     AND account.version = 1
     AND account.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND account.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND account.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
     AND account.created_at = $12
     AND account.updated_at = $12
     AND account.archived_at IS NULL
   RETURNING human_account_id`,
  `DELETE FROM onetime.v21_adult_identities AS adult
   WHERE adult.adult_id = $5
     AND adult.normalized_email = $1
     AND adult.display_name = (
       SELECT legacy.display_name
       FROM onetime.account_users AS legacy
       WHERE legacy.email_normalized = $1
         AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
         AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
         AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
         AND legacy.status = 'active'
     )
     AND adult.state = 'active'
     AND adult.version = 1
     AND adult.product_key = '${FIXTURE_RECONCILIATION_SCOPE.productKey}'
     AND adult.runtime_tier = '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}'
     AND adult.verification_environment_id = '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}'
     AND adult.created_at = $12
     AND adult.updated_at = $12
     AND adult.archived_at IS NULL
   RETURNING adult_id`,
]);

export const COMPENSATION_PREFLIGHT_SQL = AFTER_READBACK_SQL;
export const COMPENSATION_AFTER_READBACK_SQL = EXACT_READBACK_SQL;
export const REPLAY_SQL = Object.freeze([] as readonly string[]);

export const COMMIT_SQL = `COMMIT`;
export const ABORT_SQL = `ROLLBACK`;

export const INERT_TRANSACTION_PROPOSAL = Object.freeze({
  sourceOnly: true,
  opensNetworkConnection: false,
  executesSql: false,
  effectAuthority: false,
  begin: BEGIN_SQL,
  advisoryLock: ADVISORY_LOCK_SQL,
  preflight: PREFLIGHT_SQL,
  preflightExactReadback: AFTER_READBACK_SQL,
  legacyImmutableReadback: LEGACY_IMMUTABLE_READBACK_SQL,
  apply: APPLY_INSERT_SQL,
  applyProtectedBindingPositions: APPLY_INSERT_PROTECTED_BINDING_POSITIONS,
  afterReadback: AFTER_READBACK_SQL,
  replay: REPLAY_SQL,
  compensationPreflight: COMPENSATION_PREFLIGHT_SQL,
  compensationTransitions: COMPENSATION_TRANSITION_INSERT_SQL,
  compensationDerivedStateReadback: COMPENSATION_DERIVED_STATE_READBACK_SQL,
  compensationDeletes: COMPENSATION_DELETE_SQL,
  compensationAfterReadback: COMPENSATION_AFTER_READBACK_SQL,
  commit: COMMIT_SQL,
  abort: ABORT_SQL,
  rowBudget: FIXTURE_RECONCILIATION_ROW_BUDGET,
});
