import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertApplyReadback,
  assertCompensationReadback,
  classifyFixtureSnapshot,
  FIXTURE_RECONCILIATION_EXPECTED_COUNTS,
  FIXTURE_RECONCILIATION_ROW_BUDGET,
  FIXTURE_RECONCILIATION_SCOPE,
  type FixtureSnapshot,
} from './fixture-reconciliation.ts';
import {
  ADVISORY_LOCK_SQL,
  AFTER_READBACK_SQL,
  APPLY_INSERT_PROTECTED_BINDING_POSITIONS,
  APPLY_INSERT_SQL,
  BEGIN_SQL,
  COMPENSATION_AFTER_READBACK_SQL,
  COMPENSATION_DELETE_SQL,
  COMPENSATION_DERIVED_STATE_READBACK_SQL,
  COMPENSATION_PREFLIGHT_SQL,
  COMPENSATION_TRANSITION_INSERT_SQL,
  INERT_TRANSACTION_PROPOSAL,
  LEGACY_ARGON2ID_PATTERN_SQL,
  LEGACY_IDENTIFIER_HASH_DOMAINS,
  LEGACY_IMMUTABLE_READBACK_SQL,
  PREFLIGHT_SQL,
  PROTECTED_BINDINGS,
  RECONCILER_ACTOR_KEY,
  REPLAY_SQL,
  V21_ARGON2ID_FROM_LEGACY_SQL,
  V21_ARGON2ID_PATTERN_SQL,
} from './transaction-proposal.ts';

const fingerprint = 'a'.repeat(64);

function snapshot(
  state: 'empty' | 'applied' | 'compensationTransitioned' | 'compensated',
  overrides: Partial<FixtureSnapshot> = {},
): FixtureSnapshot {
  const stateFields = {
    empty: {
      v21: FIXTURE_RECONCILIATION_EXPECTED_COUNTS.before,
      exactCreatedIdsMatch: false,
      credentialHashMatchesLegacyInsideDatabase: false,
      exactCreateTransitionFieldsMatch: false,
      exactActiveAggregateFieldsMatch: false,
      exactCompensationTransitionFieldsMatch: false,
      exactTerminalAggregateFieldsMatch: false,
      parentContextDiscoverable: false,
    },
    applied: {
      v21: FIXTURE_RECONCILIATION_EXPECTED_COUNTS.after,
      exactCreatedIdsMatch: true,
      credentialHashMatchesLegacyInsideDatabase: true,
      exactCreateTransitionFieldsMatch: true,
      exactActiveAggregateFieldsMatch: true,
      exactCompensationTransitionFieldsMatch: false,
      exactTerminalAggregateFieldsMatch: false,
      parentContextDiscoverable: true,
    },
    compensationTransitioned: {
      v21: FIXTURE_RECONCILIATION_EXPECTED_COUNTS.compensationTransitioned,
      exactCreatedIdsMatch: true,
      credentialHashMatchesLegacyInsideDatabase: true,
      exactCreateTransitionFieldsMatch: true,
      exactActiveAggregateFieldsMatch: false,
      exactCompensationTransitionFieldsMatch: true,
      exactTerminalAggregateFieldsMatch: true,
      parentContextDiscoverable: true,
    },
    compensated: {
      v21: FIXTURE_RECONCILIATION_EXPECTED_COUNTS.compensation,
      exactCreatedIdsMatch: false,
      credentialHashMatchesLegacyInsideDatabase: false,
      exactCreateTransitionFieldsMatch: true,
      exactActiveAggregateFieldsMatch: false,
      exactCompensationTransitionFieldsMatch: true,
      exactTerminalAggregateFieldsMatch: true,
      parentContextDiscoverable: false,
    },
  }[state];

  return {
    pgcryptoDigestAvailable: true,
    protectedBindingsValid: true,
    legacy: {
      activeAdminAccounts: 1,
      activeSessions: 1,
      accountKeyMatches: true,
      productKeyMatches: true,
      roleMatches: true,
      accountRowHashMatches: true,
      userKeyHashMatches: true,
      activeSessionHashMatches: true,
      displayNameCompatible: true,
      passwordHashCompatible: true,
      immutableFingerprint: fingerprint,
    },
    ...stateFields,
    ...overrides,
  };
}

describe('OT-LIVE-001.03 inert fixture canonical-state reconciliation design', () => {
  it('admits only exact empty identity and canonical state for create', () => {
    expect(classifyFixtureSnapshot(snapshot('empty'))).toBe('create');
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.createExplicitInsertRows).toBe(8);
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.createTriggerDerivedAggregateRows).toBe(2);
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.createTotalRowEffects).toBe(10);
  });

  it('allows an expired legacy session without creating or refreshing one', () => {
    const before = snapshot('empty', {
      legacy: {
        ...snapshot('empty').legacy,
        activeSessions: 0,
        activeSessionHashMatches: null,
      },
    });
    expect(classifyFixtureSnapshot(before)).toBe('create');
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.sessions).toBe(0);
  });

  it('classifies the exact ten-effect result as a zero-write replay', () => {
    expect(classifyFixtureSnapshot(snapshot('applied'))).toBe('idempotent_replay');
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.replayTotalRowEffects).toBe(0);
    expect(REPLAY_SQL).toHaveLength(0);
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.openTransactionFailureCommittedEffects).toBe(0);
  });

  it.each([
    ['two legacy accounts', { legacy: { ...snapshot('empty').legacy, activeAdminAccounts: 2 } }],
    ['two legacy sessions', { legacy: { ...snapshot('empty').legacy, activeSessions: 2 } }],
    [
      'legacy hash mismatch',
      { legacy: { ...snapshot('empty').legacy, accountRowHashMatches: false } },
    ],
    [
      'active session hash mismatch',
      { legacy: { ...snapshot('empty').legacy, activeSessionHashMatches: false } },
    ],
    [
      'incompatible password hash',
      { legacy: { ...snapshot('empty').legacy, passwordHashCompatible: false } },
    ],
    ['digest unavailable', { pgcryptoDigestAvailable: false }],
    ['invalid protected bindings', { protectedBindingsValid: false }],
    ['partial identity state', { v21: { ...snapshot('empty').v21, adultIdentities: 1 } }],
    [
      'canonical transition collision',
      { v21: { ...snapshot('empty').v21, humanAccountTransitionEvents: 1 } },
    ],
    [
      'canonical aggregate collision',
      { v21: { ...snapshot('empty').v21, accessAggregateStates: 1 } },
    ],
  ])('fails closed on %s', (_label, overrides) => {
    expect(() => classifyFixtureSnapshot(snapshot('empty', overrides))).toThrow(
      'FIXTURE_RECONCILIATION_REJECTED',
    );
  });

  it('requires eight explicit inserts plus two trigger-derived create effects', () => {
    const before = snapshot('empty');
    const after = snapshot('applied');
    expect(() =>
      assertApplyReadback({
        mode: 'create',
        explicitInsertedRows: 8,
        triggerDerivedRowEffects: 2,
        totalRowEffects: 10,
        before,
        after,
      }),
    ).not.toThrow();
  });

  it('requires replay to issue no statements and cause no effects', () => {
    const applied = snapshot('applied');
    expect(() =>
      assertApplyReadback({
        mode: 'idempotent_replay',
        explicitInsertedRows: 0,
        triggerDerivedRowEffects: 0,
        totalRowEffects: 0,
        before: applied,
        after: applied,
      }),
    ).not.toThrow();
    expect(() =>
      assertApplyReadback({
        mode: 'idempotent_replay',
        explicitInsertedRows: 1,
        triggerDerivedRowEffects: 0,
        totalRowEffects: 1,
        before: applied,
        after: applied,
      }),
    ).toThrow('apply_row_budget');
  });

  it('fails closed when explicit, derived, or total create effects exceed budget', () => {
    const before = snapshot('empty');
    const after = snapshot('applied');
    expect(() =>
      assertApplyReadback({
        mode: 'create',
        explicitInsertedRows: 9,
        triggerDerivedRowEffects: 2,
        totalRowEffects: 11,
        before,
        after,
      }),
    ).toThrow('apply_hard_row_ceiling');
    expect(() =>
      assertApplyReadback({
        mode: 'create',
        explicitInsertedRows: 8,
        triggerDerivedRowEffects: 1,
        totalRowEffects: 9,
        before,
        after,
      }),
    ).toThrow('apply_row_budget');
  });

  it('requires Parent-context discoverability in applied and replay state', () => {
    expect(() =>
      classifyFixtureSnapshot(snapshot('applied', { parentContextDiscoverable: false })),
    ).toThrow('partial_or_ambiguous_v21_state');
    expect(AFTER_READBACK_SQL).toContain('AS parent_context_discoverable');
    expect(AFTER_READBACK_SQL).toContain("parent_membership.role = 'parent'");
    expect(AFTER_READBACK_SQL).toContain("admin_membership.role = 'admin'");
    expect(AFTER_READBACK_SQL).toContain('access.aggregate_key = household.household_id');
  });

  it('proves compensation leaves exactly six immutable canonical audit rows', () => {
    expect(() =>
      assertCompensationReadback({
        transitionExplicitRows: 2,
        triggerDerivedUpdates: 2,
        exactDeleteRows: 6,
        totalRowEffects: 10,
        beforeCompensation: snapshot('applied'),
        afterTransitions: snapshot('compensationTransitioned'),
        afterCompensation: snapshot('compensated'),
      }),
    ).not.toThrow();
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.terminalImmutableAuditRows).toBe(6);
    const audit = FIXTURE_RECONCILIATION_EXPECTED_COUNTS.compensation;
    expect(
      audit.humanAccountTransitionEvents +
        audit.accessTransitionEvents +
        audit.humanAccountAggregateStates +
        audit.accessAggregateStates,
    ).toBe(6);
  });

  it('rejects incomplete compensation and any legacy or session change', () => {
    expect(() =>
      assertCompensationReadback({
        transitionExplicitRows: 2,
        triggerDerivedUpdates: 2,
        exactDeleteRows: 5,
        totalRowEffects: 9,
        beforeCompensation: snapshot('applied'),
        afterTransitions: snapshot('compensationTransitioned'),
        afterCompensation: snapshot('compensated'),
      }),
    ).toThrow('compensation_row_budget');
    const changed = snapshot('compensated', {
      legacy: { ...snapshot('compensated').legacy, immutableFingerprint: 'b'.repeat(64) },
    });
    expect(() =>
      assertCompensationReadback({
        transitionExplicitRows: 2,
        triggerDerivedUpdates: 2,
        exactDeleteRows: 6,
        totalRowEffects: 10,
        beforeCompensation: snapshot('applied'),
        afterTransitions: snapshot('compensationTransitioned'),
        afterCompensation: changed,
      }),
    ).toThrow('compensation_legacy_mutation_detected');
  });

  it('declares the legacy alias used by every legacy CTE', () => {
    expect(PREFLIGHT_SQL).toMatch(/SELECT legacy\.\*\s+FROM onetime\.account_users AS legacy/u);
    expect(PREFLIGHT_SQL).not.toMatch(/SELECT legacy\.\*\s+FROM onetime\.account_users\s+WHERE/u);
  });

  it('uses only the canonical prefixed identifier-hash domains', () => {
    expect(PREFLIGHT_SQL).toContain(
      `convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.accountRow}' || id::text`,
    );
    expect(PREFLIGHT_SQL).toContain(
      `convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.userKey}' || user_key`,
    );
    expect(PREFLIGHT_SQL).toContain(
      `convert_to('${LEGACY_IDENTIFIER_HASH_DOMAINS.activeSession}' || id::text`,
    );
    expect(PREFLIGHT_SQL).not.toContain("convert_to(id::text, 'UTF8')");
    expect(PREFLIGHT_SQL).not.toContain("convert_to(user_key, 'UTF8')");
  });

  it('casts every expected active legacy session hash binding use to text', () => {
    expect(PREFLIGHT_SQL).toContain('THEN $4::text IS NULL');
    expect(PREFLIGHT_SQL).toMatch(/active_legacy_sessions\) = \$4::text/u);
    expect(PREFLIGHT_SQL.match(/\$4/g)).toHaveLength(2);
    expect(PREFLIGHT_SQL).not.toMatch(/\$4(?!::text)/u);
  });

  it('normalizes only the proven legacy Argon2id prefix inside PostgreSQL', () => {
    const credentialInsert = APPLY_INSERT_SQL.find((sql) =>
      sql.includes('INSERT INTO onetime.v21_adult_credentials'),
    );
    expect(LEGACY_ARGON2ID_PATTERN_SQL).toBe(
      "'^argon2id\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$'",
    );
    expect(V21_ARGON2ID_FROM_LEGACY_SQL).toBe(
      "'argon2id-v1$' || substring(legacy.password_hash FROM length('argon2id$') + 1)",
    );
    expect(V21_ARGON2ID_PATTERN_SQL).toBe(
      "'^argon2id-v1\\$v=19\\$m=19456,t=2,p=1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$'",
    );
    expect(PREFLIGHT_SQL).toContain(
      `(${V21_ARGON2ID_FROM_LEGACY_SQL}) ~ ${V21_ARGON2ID_PATTERN_SQL}`,
    );
    expect(credentialInsert).toContain(V21_ARGON2ID_FROM_LEGACY_SQL);
    expect(credentialInsert).toContain(`legacy.password_hash ~ ${LEGACY_ARGON2ID_PATTERN_SQL}`);
    expect(AFTER_READBACK_SQL).toContain(
      "substring(legacy.password_hash FROM length('argon2id$') + 1)",
    );
    expect(COMPENSATION_DELETE_SQL[0]).toContain(V21_ARGON2ID_FROM_LEGACY_SQL);
  });

  it('binds exact transition keys, idempotency keys, hashes, and timestamps', () => {
    expect(PROTECTED_BINDINGS).toHaveLength(23);
    expect(PROTECTED_BINDINGS).toContain('human_account_create_transition_key');
    expect(PROTECTED_BINDINGS).toContain('access_create_idempotency_key');
    expect(PROTECTED_BINDINGS).toContain('create_canonical_request_hash');
    expect(PROTECTED_BINDINGS).toContain('compensation_canonical_request_hash');
    expect(PREFLIGHT_SQL).toContain("$17 ~ '^[a-f0-9]{64}$'");
    expect(PREFLIGHT_SQL).toContain("$23 ~ '^[a-f0-9]{64}$'");
    expect(PREFLIGHT_SQL).toContain("$10 = 'access:' || $9");
  });

  it('uses exact compact local-to-canonical bindings for all eight apply statements', () => {
    const expectedMappings = [
      [5, 1, 12],
      [6, 5, 12],
      [7, 6, 12],
      [8, 6, 12],
      [9, 5, 6, 11, 10, 12],
      [6, 5, 12, 1],
      [13, 6, 14, 17, 12],
      [15, 9, 16, 17, 12],
    ];

    expect(APPLY_INSERT_PROTECTED_BINDING_POSITIONS).toEqual(expectedMappings);
    expect(APPLY_INSERT_PROTECTED_BINDING_POSITIONS).toHaveLength(APPLY_INSERT_SQL.length);
    expect(Object.isFrozen(APPLY_INSERT_PROTECTED_BINDING_POSITIONS)).toBe(true);

    for (const [index, sql] of APPLY_INSERT_SQL.entries()) {
      const mapping = APPLY_INSERT_PROTECTED_BINDING_POSITIONS[index];
      expect(mapping).toBeDefined();
      const localPositions = [
        ...new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]))),
      ].sort((left, right) => left - right);
      const exactContiguousPositions = Array.from(
        { length: mapping?.length ?? 0 },
        (_unused, position) => position + 1,
      );

      expect(localPositions).toEqual(exactContiguousPositions);
      expect(
        mapping?.every((position) => position >= 1 && position <= PROTECTED_BINDINGS.length),
      ).toBe(true);
      expect(Object.isFrozen(mapping)).toBe(true);
    }

    expect(APPLY_INSERT_PROTECTED_BINDING_POSITIONS[0]).toEqual([5, 1, 12]);
    expect(APPLY_INSERT_SQL[0]).toContain('SELECT $1, $2');
    expect(APPLY_INSERT_SQL[0]).toContain(
      `'${FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId}', $3, $3`,
    );
    expect(INERT_TRANSACTION_PROPOSAL.applyProtectedBindingPositions).toBe(
      APPLY_INSERT_PROTECTED_BINDING_POSITIONS,
    );
  });

  it('creates canonical HumanAccount null-to-active and access null-to-free events', () => {
    const humanCreate = APPLY_INSERT_SQL[6];
    const accessCreate = APPLY_INSERT_SQL[7];
    expect(humanCreate).toContain("$1, 'human_account', $2, NULL, 'active', 0, 1");
    expect(accessCreate).toContain("$1, 'access', $2, NULL, 'free', 0, 1");
    expect(APPLY_INSERT_PROTECTED_BINDING_POSITIONS[6]).toEqual([13, 6, 14, 17, 12]);
    expect(APPLY_INSERT_PROTECTED_BINDING_POSITIONS[7]).toEqual([15, 9, 16, 17, 12]);
    expect(accessCreate).toContain("'free_period'");
    expect(humanCreate).toContain("'reconciler'");
    expect(humanCreate).toContain(RECONCILER_ACTOR_KEY);
    expect(APPLY_INSERT_SQL).toHaveLength(8);
  });

  it('requires exact trigger-derived active aggregate readback', () => {
    expect(AFTER_READBACK_SQL).toContain("state.aggregate_kind = 'human_account'");
    expect(AFTER_READBACK_SQL).toContain("state.current_state = 'active'");
    expect(AFTER_READBACK_SQL).toContain("state.aggregate_kind = 'access'");
    expect(AFTER_READBACK_SQL).toContain("state.current_state = 'free'");
    expect(AFTER_READBACK_SQL).toContain('state.last_transition_key = $13');
    expect(AFTER_READBACK_SQL).toContain('state.last_transition_key = $15');
    expect(AFTER_READBACK_SQL).toContain('state.version = 1');
  });

  it('preflights both transition-event and aggregate-state collisions', () => {
    expect(PREFLIGHT_SQL).toContain('transition_key IN ($13, $19)');
    expect(PREFLIGHT_SQL).toContain('transition_key IN ($15, $21)');
    expect(PREFLIGHT_SQL).toContain('last_transition_key IN ($13, $19)');
    expect(PREFLIGHT_SQL).toContain('last_transition_key IN ($15, $21)');
  });

  it('compensates append-only before exact-deleting six proposal rows', () => {
    expect(COMPENSATION_TRANSITION_INSERT_SQL).toHaveLength(2);
    expect(COMPENSATION_DELETE_SQL).toHaveLength(6);
    expect(COMPENSATION_TRANSITION_INSERT_SQL[0]).toContain(
      "$19, 'human_account', $6, 'active', 'archived', 1, 2",
    );
    expect(COMPENSATION_TRANSITION_INSERT_SQL[1]).toContain(
      "$21, 'access', $9, 'free', 'inactive', 1, 2",
    );
    expect(COMPENSATION_TRANSITION_INSERT_SQL[1]).toContain("'household_archived'");
    expect(COMPENSATION_DERIVED_STATE_READBACK_SQL).toBe(COMPENSATION_AFTER_READBACK_SQL);
    expect(COMPENSATION_AFTER_READBACK_SQL).toContain("state.current_state = 'archived'");
    expect(COMPENSATION_AFTER_READBACK_SQL).toContain("state.current_state = 'inactive'");
    expect(COMPENSATION_AFTER_READBACK_SQL).toContain('state.version = 2');
  });

  it('keeps SQL inert, scoped, locked, and limited to authorized write targets', () => {
    const allSql = [
      BEGIN_SQL,
      ADVISORY_LOCK_SQL,
      PREFLIGHT_SQL,
      LEGACY_IMMUTABLE_READBACK_SQL,
      ...APPLY_INSERT_SQL,
      AFTER_READBACK_SQL,
      COMPENSATION_PREFLIGHT_SQL,
      ...COMPENSATION_TRANSITION_INSERT_SQL,
      COMPENSATION_DERIVED_STATE_READBACK_SQL,
      ...COMPENSATION_DELETE_SQL,
      COMPENSATION_AFTER_READBACK_SQL,
    ].join('\n');
    const writeTargets = [
      ...allSql.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+([\w.]+)/gi),
    ].map((match) => match[1]?.toLowerCase());
    const allowedTargets = new Set([
      'onetime.v21_adult_identities',
      'onetime.v21_human_accounts',
      'onetime.v21_human_account_role_memberships',
      'onetime.v21_households',
      'onetime.v21_adult_credentials',
      'onetime.canonical_state_transition_events',
    ]);

    expect(BEGIN_SQL).toContain('SERIALIZABLE');
    expect(ADVISORY_LOCK_SQL).toContain('pg_advisory_xact_lock');
    expect(PREFLIGHT_SQL).toContain("to_regprocedure('digest(bytea,text)')");
    expect(APPLY_INSERT_SQL).toHaveLength(
      FIXTURE_RECONCILIATION_ROW_BUDGET.createExplicitInsertRows,
    );
    expect(COMPENSATION_TRANSITION_INSERT_SQL).toHaveLength(
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationTransitionExplicitRows,
    );
    expect(COMPENSATION_DELETE_SQL).toHaveLength(
      FIXTURE_RECONCILIATION_ROW_BUDGET.compensationExactDeleteRows,
    );
    expect(writeTargets).toHaveLength(16);
    expect(writeTargets.every((target) => target !== undefined && allowedTargets.has(target))).toBe(
      true,
    );
    expect(allSql).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM)\s+onetime\.(?:account_users|user_sessions|v21_adult_sessions)/i,
    );
    expect(allSql).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM)\s+onetime\.canonical_aggregate_states/i,
    );
    expect(allSql).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+onetime\.canonical_state_transition_events/i,
    );
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.productKey);
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.runtimeTier);
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId);
    expect(INERT_TRANSACTION_PROPOSAL.opensNetworkConnection).toBe(false);
    expect(INERT_TRANSACTION_PROPOSAL.executesSql).toBe(false);
    expect(INERT_TRANSACTION_PROPOSAL.effectAuthority).toBe(false);
  });

  it('contains no literal email, password payload, token, cookie, or connection secret', async () => {
    const directory = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
    const files = ['fixture-reconciliation.ts', 'transaction-proposal.ts', 'README.md'];
    const source = (
      await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))
    ).join('\n');
    expect(source).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(source).not.toMatch(/\$argon2id\$v=/i);
    expect(source).not.toMatch(/DATABASE_URL|RAILWAY_TOKEN|COOKIE|BEARER\s+/i);
  });
});
