import {
  FIXTURE_RECONCILIATION_ROW_BUDGET,
  FIXTURE_RECONCILIATION_SCOPE,
} from './fixture-reconciliation.ts';

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
  'occurred_at',
] as const);

export const BEGIN_SQL = `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

export const ADVISORY_LOCK_SQL = `
SELECT pg_advisory_xact_lock(
  hashtextextended('ot-live-001.03:operator-fixture:' || $1::text, 0)
)
`;

export const PREFLIGHT_SQL = `
WITH legacy AS MATERIALIZED (
  SELECT legacy.*
  FROM onetime.account_users
  WHERE email_normalized = $1
    AND account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
    AND status = 'active'
), active_legacy_sessions AS MATERIALIZED (
  SELECT session.*
  FROM onetime.user_sessions AS session
  JOIN legacy ON legacy.user_key = session.user_key
  WHERE session.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND session.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND session.revoked_at IS NULL
    AND session.expires_at > CURRENT_TIMESTAMP
    AND session.security_version = legacy.security_version
), v21_counts AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM onetime.v21_adult_identities WHERE normalized_email = $1 OR adult_id = $5) AS adult_identities,
    (SELECT count(*) FROM onetime.v21_human_accounts WHERE human_account_id = $6 OR adult_id = $5) AS human_accounts,
    (SELECT count(*) FROM onetime.v21_adult_credentials WHERE human_account_id = $6 OR adult_id = $5) AS adult_credentials,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships WHERE membership_id = $7 OR (human_account_id = $6 AND role = 'admin')) AS admin_memberships,
    (SELECT count(*) FROM onetime.v21_human_account_role_memberships WHERE membership_id = $8 OR (human_account_id = $6 AND role = 'parent')) AS parent_memberships,
    (SELECT count(*) FROM onetime.v21_households WHERE household_id = $9 OR owner_adult_id = $5 OR owner_human_account_id = $6) AS family_households,
    (SELECT count(*) FROM onetime.v21_adult_sessions WHERE human_account_id = $6) AS adult_sessions
)
SELECT
  to_regprocedure('digest(bytea,text)') IS NOT NULL AS pgcrypto_digest_available,
  ($1 = lower(btrim($1)) AND $1 LIKE '%@%'
    AND $5 <> '' AND $6 <> '' AND $7 <> $8 AND $9 <> ''
    AND $10::text <> '' AND $11::integer > 0
    AND $12::timestamptz IS NOT NULL) AS protected_bindings_valid,
  (SELECT count(*) FROM legacy) AS active_legacy_admin_accounts,
  (SELECT count(*) FROM active_legacy_sessions) AS active_legacy_sessions,
  (SELECT account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}' FROM legacy) AS account_key_matches,
  (SELECT product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}' FROM legacy) AS product_key_matches,
  (SELECT role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}' FROM legacy) AS role_matches,
  (SELECT encode(digest(convert_to(id::text, 'UTF8'), 'sha256'), 'hex') FROM legacy) = $2 AS account_row_hash_matches,
  (SELECT encode(digest(convert_to(user_key, 'UTF8'), 'sha256'), 'hex') FROM legacy) = $3 AS user_key_hash_matches,
  CASE
    WHEN (SELECT count(*) FROM active_legacy_sessions) = 0 THEN $4 IS NULL
    WHEN (SELECT count(*) FROM active_legacy_sessions) = 1 THEN
      (SELECT encode(digest(convert_to(id::text, 'UTF8'), 'sha256'), 'hex') FROM active_legacy_sessions) = $4
    ELSE false
  END AS active_session_hash_matches,
  (SELECT btrim(display_name) <> '' FROM legacy) AS display_name_compatible,
  (SELECT password_hash ~ '^argon2id-v1\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$' FROM legacy) AS password_hash_compatible,
  (SELECT encode(digest(convert_to(jsonb_build_object(
    'account', to_jsonb(legacy),
    'active_sessions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(session) ORDER BY session.id) FROM active_legacy_sessions AS session),
      '[]'::jsonb
    )
  )::text, 'UTF8'), 'sha256'), 'hex') FROM legacy) AS legacy_immutable_fingerprint,
  v21_counts.*
FROM v21_counts
`;

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

export const APPLY_INSERT_SQL = Object.freeze([
  `INSERT INTO onetime.v21_adult_identities
     (adult_id, normalized_email, display_name, state, version, product_key,
      runtime_tier, verification_environment_id, created_at, updated_at)
   SELECT $5, $1, legacy.display_name, 'active', 1,
          '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
          '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
          '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $12, $12
   FROM onetime.account_users AS legacy
   WHERE legacy.email_normalized = $1
     AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
     AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
     AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
     AND legacy.status = 'active'
   RETURNING adult_id`,
  `INSERT INTO onetime.v21_human_accounts
     (human_account_id, adult_id, state, security_version, version, product_key,
      runtime_tier, verification_environment_id, created_at, updated_at)
   VALUES ($6, $5, 'active', 1, 1, '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $12, $12)
   RETURNING human_account_id`,
  `INSERT INTO onetime.v21_human_account_role_memberships
     (membership_id, human_account_id, role, granted_at, granted_reason,
      product_key, runtime_tier, verification_environment_id)
   VALUES ($7, $6, 'admin', $12, 'operator_fixture_exact_reconciliation',
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}')
   RETURNING membership_id`,
  `INSERT INTO onetime.v21_human_account_role_memberships
     (membership_id, human_account_id, role, granted_at, granted_reason,
      product_key, runtime_tier, verification_environment_id)
   VALUES ($8, $6, 'parent', $12, 'operator_fixture_exact_reconciliation',
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}')
   RETURNING membership_id`,
  `INSERT INTO onetime.v21_households
     (household_id, owner_adult_id, owner_human_account_id, classification,
      state, seat_limit, active_seat_count, access_aggregate_ref, version,
      product_key, runtime_tier, verification_environment_id, created_at, updated_at)
   VALUES ($9, $5, $6, 'family', 'active', $11, 0, $10, 1,
           '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
           '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
           '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $12, $12)
   RETURNING household_id`,
  `INSERT INTO onetime.v21_adult_credentials
     (human_account_id, adult_id, credential_kind, password_hash,
      credential_state, credential_version, product_key, runtime_tier,
      verification_environment_id, created_at, updated_at)
   SELECT $6, $5, 'adult_email_password', legacy.password_hash, 'active', 1,
          '${FIXTURE_RECONCILIATION_SCOPE.productKey}',
          '${FIXTURE_RECONCILIATION_SCOPE.runtimeTier}',
          '${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $12, $12
   FROM onetime.account_users AS legacy
   WHERE legacy.email_normalized = $1
     AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
     AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
     AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
     AND legacy.status = 'active'
     AND legacy.password_hash ~ '^argon2id-v1\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$'
   RETURNING human_account_id`,
]);

export const AFTER_READBACK_SQL = `
WITH legacy AS MATERIALIZED (
  SELECT legacy.*
  FROM onetime.account_users AS legacy
  WHERE legacy.email_normalized = $1
    AND legacy.account_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyAccountKey}'
    AND legacy.product_key = '${FIXTURE_RECONCILIATION_SCOPE.legacyProductKey}'
    AND legacy.role = '${FIXTURE_RECONCILIATION_SCOPE.legacyRole}'
    AND legacy.status = 'active'
)
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
      AND credential.password_hash = legacy.password_hash
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
      AND household.archived_at IS NULL) AS family_households,
  (SELECT count(*) FROM onetime.v21_adult_sessions WHERE human_account_id = $6) AS adult_sessions
`;

export const ROLLBACK_DELETE_SQL = Object.freeze([
  `DELETE FROM onetime.v21_adult_credentials AS credential
   WHERE credential.human_account_id = $6
     AND credential.adult_id = $5
     AND credential.credential_kind = 'adult_email_password'
     AND credential.password_hash = (
       SELECT legacy.password_hash
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

export const ROLLBACK_PREFLIGHT_SQL = AFTER_READBACK_SQL;
export const ROLLBACK_AFTER_READBACK_SQL = PREFLIGHT_SQL;

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
  afterReadback: AFTER_READBACK_SQL,
  rollbackPreflight: ROLLBACK_PREFLIGHT_SQL,
  rollback: ROLLBACK_DELETE_SQL,
  rollbackAfterReadback: ROLLBACK_AFTER_READBACK_SQL,
  commit: COMMIT_SQL,
  abort: ABORT_SQL,
  rowBudget: FIXTURE_RECONCILIATION_ROW_BUDGET,
});
