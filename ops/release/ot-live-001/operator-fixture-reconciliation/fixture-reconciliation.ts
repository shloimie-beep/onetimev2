export const FIXTURE_RECONCILIATION_SCOPE = Object.freeze({
  productKey: 'one_time_mishnayos',
  runtimeTier: 'production',
  verificationEnvironmentId: 'production_operator_canary',
  legacyAccountKey: 'one_time',
  legacyProductKey: 'one_time_mishnah_class',
  legacyRole: 'admin',
});

export const FIXTURE_RECONCILIATION_ROW_BUDGET = Object.freeze({
  createExplicitInsertRows: 8,
  createTriggerDerivedAggregateRows: 2,
  createTotalRowEffects: 10,
  replayTotalRowEffects: 0,
  openTransactionFailureCommittedEffects: 0,
  compensationTransitionExplicitRows: 2,
  compensationExplicitRows: 8,
  compensationTriggerDerivedUpdates: 2,
  compensationExactDeleteRows: 6,
  compensationTotalRowEffects: 10,
  terminalImmutableAuditRows: 6,
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
  humanAccountTransitionEvents: number;
  accessTransitionEvents: number;
  humanAccountAggregateStates: number;
  accessAggregateStates: number;
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
  exactCreateTransitionFieldsMatch: boolean;
  exactActiveAggregateFieldsMatch: boolean;
  exactCompensationTransitionFieldsMatch: boolean;
  exactTerminalAggregateFieldsMatch: boolean;
  parentContextDiscoverable: boolean;
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
  humanAccountTransitionEvents: 0,
  accessTransitionEvents: 0,
  humanAccountAggregateStates: 0,
  accessAggregateStates: 0,
});

const EXACT_APPLIED_COUNTS: V21FixtureCounts = Object.freeze({
  adultIdentities: 1,
  humanAccounts: 1,
  adultCredentials: 1,
  adminMemberships: 1,
  parentMemberships: 1,
  familyHouseholds: 1,
  adultSessions: 0,
  humanAccountTransitionEvents: 1,
  accessTransitionEvents: 1,
  humanAccountAggregateStates: 1,
  accessAggregateStates: 1,
});

const EXACT_COMPENSATED_COUNTS: V21FixtureCounts = Object.freeze({
  adultIdentities: 0,
  humanAccounts: 0,
  adultCredentials: 0,
  adminMemberships: 0,
  parentMemberships: 0,
  familyHouseholds: 0,
  adultSessions: 0,
  humanAccountTransitionEvents: 2,
  accessTransitionEvents: 2,
  humanAccountAggregateStates: 1,
  accessAggregateStates: 1,
});

const EXACT_COMPENSATION_TRANSITIONED_COUNTS: V21FixtureCounts = Object.freeze({
  ...EXACT_APPLIED_COUNTS,
  humanAccountTransitionEvents: 2,
  accessTransitionEvents: 2,
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

function isExactEmpty(snapshot: FixtureSnapshot) {
  return (
    sameCounts(snapshot.v21, ZERO_V21_COUNTS) &&
    !snapshot.exactCreatedIdsMatch &&
    !snapshot.credentialHashMatchesLegacyInsideDatabase &&
    !snapshot.exactCreateTransitionFieldsMatch &&
    !snapshot.exactActiveAggregateFieldsMatch &&
    !snapshot.exactCompensationTransitionFieldsMatch &&
    !snapshot.exactTerminalAggregateFieldsMatch &&
    !snapshot.parentContextDiscoverable
  );
}

function isExactApplied(snapshot: FixtureSnapshot) {
  return (
    sameCounts(snapshot.v21, EXACT_APPLIED_COUNTS) &&
    snapshot.exactCreatedIdsMatch &&
    snapshot.credentialHashMatchesLegacyInsideDatabase &&
    snapshot.exactCreateTransitionFieldsMatch &&
    snapshot.exactActiveAggregateFieldsMatch &&
    !snapshot.exactCompensationTransitionFieldsMatch &&
    !snapshot.exactTerminalAggregateFieldsMatch &&
    snapshot.parentContextDiscoverable
  );
}

function isExactCompensated(snapshot: FixtureSnapshot) {
  return (
    sameCounts(snapshot.v21, EXACT_COMPENSATED_COUNTS) &&
    !snapshot.exactCreatedIdsMatch &&
    !snapshot.credentialHashMatchesLegacyInsideDatabase &&
    snapshot.exactCreateTransitionFieldsMatch &&
    !snapshot.exactActiveAggregateFieldsMatch &&
    snapshot.exactCompensationTransitionFieldsMatch &&
    snapshot.exactTerminalAggregateFieldsMatch &&
    !snapshot.parentContextDiscoverable
  );
}

function isExactCompensationTransitioned(snapshot: FixtureSnapshot) {
  return (
    sameCounts(snapshot.v21, EXACT_COMPENSATION_TRANSITIONED_COUNTS) &&
    snapshot.exactCreatedIdsMatch &&
    snapshot.credentialHashMatchesLegacyInsideDatabase &&
    snapshot.exactCreateTransitionFieldsMatch &&
    !snapshot.exactActiveAggregateFieldsMatch &&
    snapshot.exactCompensationTransitionFieldsMatch &&
    snapshot.exactTerminalAggregateFieldsMatch &&
    snapshot.parentContextDiscoverable
  );
}

export function classifyFixtureSnapshot(snapshot: FixtureSnapshot): ReconciliationMode {
  if (!snapshot.pgcryptoDigestAvailable) fail('pgcrypto_digest_unavailable');
  if (!snapshot.protectedBindingsValid) fail('protected_bindings');
  requireLegacyGate(snapshot.legacy);

  if (isExactEmpty(snapshot)) return 'create';
  if (isExactApplied(snapshot)) return 'idempotent_replay';
  return fail('partial_or_ambiguous_v21_state');
}

export function assertApplyReadback(input: {
  mode: ReconciliationMode;
  explicitInsertedRows: number;
  triggerDerivedRowEffects: number;
  totalRowEffects: number;
  before: FixtureSnapshot;
  after: FixtureSnapshot;
}) {
  if (classifyFixtureSnapshot(input.before) !== input.mode) fail('apply_mode_mismatch');
  const expected =
    input.mode === 'create'
      ? {
          explicit: FIXTURE_RECONCILIATION_ROW_BUDGET.createExplicitInsertRows,
          derived: FIXTURE_RECONCILIATION_ROW_BUDGET.createTriggerDerivedAggregateRows,
          total: FIXTURE_RECONCILIATION_ROW_BUDGET.createTotalRowEffects,
        }
      : { explicit: 0, derived: 0, total: FIXTURE_RECONCILIATION_ROW_BUDGET.replayTotalRowEffects };
  if (
    input.explicitInsertedRows > FIXTURE_RECONCILIATION_ROW_BUDGET.createExplicitInsertRows ||
    input.triggerDerivedRowEffects >
      FIXTURE_RECONCILIATION_ROW_BUDGET.createTriggerDerivedAggregateRows ||
    input.totalRowEffects > FIXTURE_RECONCILIATION_ROW_BUDGET.createTotalRowEffects
  ) {
    fail('apply_hard_row_ceiling');
  }
  if (
    input.explicitInsertedRows !== expected.explicit ||
    input.triggerDerivedRowEffects !== expected.derived ||
    input.totalRowEffects !== expected.total
  ) {
    fail('apply_row_budget');
  }
  requireLegacyGate(input.after.legacy);
  if (input.after.legacy.immutableFingerprint !== input.before.legacy.immutableFingerprint) {
    fail('legacy_mutation_detected');
  }
  if (input.after.legacy.activeSessions !== input.before.legacy.activeSessions) {
    fail('legacy_session_effect_detected');
  }
  if (!isExactApplied(input.after)) fail('after_exact_state');
}

export function assertCompensationReadback(input: {
  transitionExplicitRows: number;
  triggerDerivedUpdates: number;
  exactDeleteRows: number;
  totalRowEffects: number;
  beforeCompensation: FixtureSnapshot;
  afterTransitions: FixtureSnapshot;
  afterCompensation: FixtureSnapshot;
}) {
  if (
    input.transitionExplicitRows >
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTransitionExplicitRows ||
    input.triggerDerivedUpdates >
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTriggerDerivedUpdates ||
    input.exactDeleteRows > FIXTURE_RECONCILIATION_ROW_BUDGET.compensationExactDeleteRows ||
    input.totalRowEffects > FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTotalRowEffects
  ) {
    fail('compensation_hard_row_ceiling');
  }
  if (
    input.transitionExplicitRows !==
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTransitionExplicitRows ||
    input.triggerDerivedUpdates !==
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTriggerDerivedUpdates ||
    input.exactDeleteRows !== FIXTURE_RECONCILIATION_ROW_BUDGET.compensationExactDeleteRows ||
    input.transitionExplicitRows + input.exactDeleteRows !==
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationExplicitRows ||
    input.totalRowEffects !== FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTotalRowEffects
  ) {
    fail('compensation_row_budget');
  }
  if (!input.beforeCompensation.pgcryptoDigestAvailable) {
    fail('compensation_pgcrypto_digest_unavailable');
  }
  requireLegacyGate(input.beforeCompensation.legacy);
  if (!isExactApplied(input.beforeCompensation)) fail('compensation_before_exact_state');
  if (!isExactCompensationTransitioned(input.afterTransitions)) {
    fail('compensation_transition_readback');
  }
  if (
    input.afterTransitions.legacy.immutableFingerprint !==
      input.beforeCompensation.legacy.immutableFingerprint ||
    input.afterTransitions.legacy.activeSessions !== input.beforeCompensation.legacy.activeSessions
  ) {
    fail('compensation_transition_legacy_or_session_effect');
  }
  if (!isExactCompensated(input.afterCompensation)) fail('compensation_after_exact_state');
  requireLegacyGate(input.afterCompensation.legacy);
  if (
    input.afterCompensation.legacy.immutableFingerprint !==
    input.beforeCompensation.legacy.immutableFingerprint
  ) {
    fail('compensation_legacy_mutation_detected');
  }
  if (
    input.afterCompensation.legacy.activeSessions !== input.beforeCompensation.legacy.activeSessions
  ) {
    fail('compensation_session_effect_detected');
  }
}

export const FIXTURE_RECONCILIATION_EXPECTED_COUNTS = Object.freeze({
  before: ZERO_V21_COUNTS,
  after: EXACT_APPLIED_COUNTS,
  compensationTransitioned: EXACT_COMPENSATION_TRANSITIONED_COUNTS,
  compensation: EXACT_COMPENSATED_COUNTS,
});
