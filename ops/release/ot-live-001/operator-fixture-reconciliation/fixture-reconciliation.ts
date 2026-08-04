export const FIXTURE_RECONCILIATION_SCOPE = Object.freeze({
  productKey: 'one_time_mishnayos',
  runtimeTier: 'production',
  verificationEnvironmentId: 'production_operator_canary',
  legacyAccountKey: 'one_time',
  legacyProductKey: 'one_time_mishnah_class',
  legacyRole: 'admin',
});

export const FIXTURE_RECONCILIATION_ROW_BUDGET = Object.freeze({
  apply: 6,
  replay: 0,
  rollback: 6,
  legacy: 0,
  sessions: 0,
  students: 0,
  customers: 0,
  providers: 0,
});

export type V21FixtureCounts = Readonly<{
  adultIdentities: number;
  humanAccounts: number;
  adultCredentials: number;
  adminMemberships: number;
  parentMemberships: number;
  familyHouseholds: number;
  adultSessions: number;
}>;

export type LegacyFixtureSnapshot = Readonly<{
  activeAdminAccounts: number;
  activeSessions: number;
  accountKeyMatches: boolean;
  productKeyMatches: boolean;
  roleMatches: boolean;
  accountRowHashMatches: boolean;
  userKeyHashMatches: boolean;
  activeSessionHashMatches: boolean | null;
  displayNameCompatible: boolean;
  passwordHashCompatible: boolean;
  immutableFingerprint: string;
}>;

export type FixtureSnapshot = Readonly<{
  pgcryptoDigestAvailable: boolean;
  protectedBindingsValid: boolean;
  legacy: LegacyFixtureSnapshot;
  v21: V21FixtureCounts;
  exactCreatedIdsMatch: boolean;
  credentialHashMatchesLegacyInsideDatabase: boolean;
}>;

export type ReconciliationMode = 'create' | 'idempotent_replay';

const ZERO_V21_COUNTS: V21FixtureCounts = Object.freeze({
  adultIdentities: 0,
  humanAccounts: 0,
  adultCredentials: 0,
  adminMemberships: 0,
  parentMemberships: 0,
  familyHouseholds: 0,
  adultSessions: 0,
});

const EXACT_APPLIED_COUNTS: V21FixtureCounts = Object.freeze({
  adultIdentities: 1,
  humanAccounts: 1,
  adultCredentials: 1,
  adminMemberships: 1,
  parentMemberships: 1,
  familyHouseholds: 1,
  adultSessions: 0,
});

function sameCounts(actual: V21FixtureCounts, expected: V21FixtureCounts) {
  return (Object.keys(expected) as Array<keyof V21FixtureCounts>).every(
    (key) => actual[key] === expected[key],
  );
}

function fail(reason: string): never {
  throw new Error(`FIXTURE_RECONCILIATION_REJECTED:${reason}`);
}

function requireLegacyGate(legacy: LegacyFixtureSnapshot) {
  if (legacy.activeAdminAccounts !== 1) fail('legacy_admin_cardinality');
  if (legacy.activeSessions !== 0 && legacy.activeSessions !== 1) {
    fail('legacy_session_cardinality');
  }
  if (!legacy.accountKeyMatches || !legacy.productKeyMatches || !legacy.roleMatches) {
    fail('legacy_scope_or_role');
  }
  if (!legacy.accountRowHashMatches || !legacy.userKeyHashMatches) {
    fail('legacy_identifier_hash');
  }
  if (legacy.activeSessions === 1 && legacy.activeSessionHashMatches !== true) {
    fail('legacy_session_hash');
  }
  if (legacy.activeSessions === 0 && legacy.activeSessionHashMatches !== null) {
    fail('unexpected_legacy_session_hash');
  }
  if (!legacy.displayNameCompatible) fail('legacy_display_name');
  if (!legacy.passwordHashCompatible) fail('legacy_password_hash_format');
  if (legacy.immutableFingerprint.length !== 64) fail('legacy_fingerprint_format');
}

export function classifyFixtureSnapshot(snapshot: FixtureSnapshot): ReconciliationMode {
  if (!snapshot.pgcryptoDigestAvailable) fail('pgcrypto_digest_unavailable');
  if (!snapshot.protectedBindingsValid) fail('protected_bindings');
  requireLegacyGate(snapshot.legacy);

  if (sameCounts(snapshot.v21, ZERO_V21_COUNTS)) {
    if (snapshot.exactCreatedIdsMatch) fail('unexpected_created_ids_before_apply');
    if (snapshot.credentialHashMatchesLegacyInsideDatabase) {
      fail('unexpected_credential_hash_match_before_apply');
    }
    return 'create';
  }

  if (sameCounts(snapshot.v21, EXACT_APPLIED_COUNTS)) {
    if (!snapshot.exactCreatedIdsMatch) fail('replay_exact_id_mismatch');
    if (!snapshot.credentialHashMatchesLegacyInsideDatabase) {
      fail('replay_credential_hash_mismatch');
    }
    return 'idempotent_replay';
  }

  return fail('partial_or_ambiguous_v21_state');
}

export function assertApplyReadback(input: {
  mode: ReconciliationMode;
  affectedRows: number;
  before: FixtureSnapshot;
  after: FixtureSnapshot;
}) {
  if (classifyFixtureSnapshot(input.before) !== input.mode) fail('apply_mode_mismatch');
  const expectedRows =
    input.mode === 'create'
      ? FIXTURE_RECONCILIATION_ROW_BUDGET.apply
      : FIXTURE_RECONCILIATION_ROW_BUDGET.replay;
  if (input.affectedRows > FIXTURE_RECONCILIATION_ROW_BUDGET.apply) {
    fail('apply_hard_row_ceiling');
  }
  if (input.affectedRows !== expectedRows) fail('apply_row_budget');
  requireLegacyGate(input.after.legacy);
  if (input.after.legacy.immutableFingerprint !== input.before.legacy.immutableFingerprint) {
    fail('legacy_mutation_detected');
  }
  if (input.after.legacy.activeSessions !== input.before.legacy.activeSessions) {
    fail('legacy_session_effect_detected');
  }
  if (!sameCounts(input.after.v21, EXACT_APPLIED_COUNTS)) fail('after_cardinality');
  if (!input.after.exactCreatedIdsMatch) fail('after_exact_id_mismatch');
  if (!input.after.credentialHashMatchesLegacyInsideDatabase) {
    fail('after_credential_hash_mismatch');
  }
}

export function assertRollbackReadback(input: {
  affectedRows: number;
  beforeRollback: FixtureSnapshot;
  afterRollback: FixtureSnapshot;
}) {
  if (input.affectedRows > FIXTURE_RECONCILIATION_ROW_BUDGET.rollback) {
    fail('rollback_hard_row_ceiling');
  }
  if (input.affectedRows !== FIXTURE_RECONCILIATION_ROW_BUDGET.rollback) {
    fail('rollback_row_budget');
  }
  if (!input.beforeRollback.pgcryptoDigestAvailable) {
    fail('rollback_pgcrypto_digest_unavailable');
  }
  requireLegacyGate(input.beforeRollback.legacy);
  if (!sameCounts(input.beforeRollback.v21, EXACT_APPLIED_COUNTS)) {
    fail('rollback_before_cardinality');
  }
  if (!input.beforeRollback.exactCreatedIdsMatch) fail('rollback_before_exact_id_mismatch');
  if (!input.beforeRollback.credentialHashMatchesLegacyInsideDatabase) {
    fail('rollback_before_credential_hash_mismatch');
  }
  if (!sameCounts(input.afterRollback.v21, ZERO_V21_COUNTS)) {
    fail('rollback_after_cardinality');
  }
  if (input.afterRollback.exactCreatedIdsMatch) fail('rollback_exact_ids_still_present');
  if (input.afterRollback.credentialHashMatchesLegacyInsideDatabase) {
    fail('rollback_credential_still_present');
  }
  requireLegacyGate(input.afterRollback.legacy);
  if (
    input.afterRollback.legacy.immutableFingerprint !==
    input.beforeRollback.legacy.immutableFingerprint
  ) {
    fail('rollback_legacy_mutation_detected');
  }
  if (input.afterRollback.legacy.activeSessions !== input.beforeRollback.legacy.activeSessions) {
    fail('rollback_session_effect_detected');
  }
}

export const FIXTURE_RECONCILIATION_EXPECTED_COUNTS = Object.freeze({
  before: ZERO_V21_COUNTS,
  after: EXACT_APPLIED_COUNTS,
  rollback: ZERO_V21_COUNTS,
});
