import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertApplyReadback,
  assertRollbackReadback,
  classifyFixtureSnapshot,
  FIXTURE_RECONCILIATION_ROW_BUDGET,
  FIXTURE_RECONCILIATION_SCOPE,
  type FixtureSnapshot,
} from './fixture-reconciliation.ts';
import {
  ADVISORY_LOCK_SQL,
  AFTER_READBACK_SQL,
  APPLY_INSERT_SQL,
  BEGIN_SQL,
  INERT_TRANSACTION_PROPOSAL,
  LEGACY_IMMUTABLE_READBACK_SQL,
  PREFLIGHT_SQL,
  PROTECTED_BINDINGS,
  ROLLBACK_AFTER_READBACK_SQL,
  ROLLBACK_DELETE_SQL,
  ROLLBACK_PREFLIGHT_SQL,
} from './transaction-proposal.ts';

const fingerprint = 'a'.repeat(64);

function snapshot(
  state: 'empty' | 'applied',
  overrides: Partial<FixtureSnapshot> = {},
): FixtureSnapshot {
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
    v21:
      state === 'empty'
        ? {
            adultIdentities: 0,
            humanAccounts: 0,
            adultCredentials: 0,
            adminMemberships: 0,
            parentMemberships: 0,
            familyHouseholds: 0,
            adultSessions: 0,
          }
        : {
            adultIdentities: 1,
            humanAccounts: 1,
            adultCredentials: 1,
            adminMemberships: 1,
            parentMemberships: 1,
            familyHouseholds: 1,
            adultSessions: 0,
          },
    exactCreatedIdsMatch: state === 'applied',
    credentialHashMatchesLegacyInsideDatabase: state === 'applied',
    ...overrides,
  };
}

describe('OT-LIVE-001.03 inert fixture reconciliation design', () => {
  it('admits only the exact empty v2.1 state for a six-row create', () => {
    expect(classifyFixtureSnapshot(snapshot('empty'))).toBe('create');
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.apply).toBe(6);
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

  it('classifies the exact desired rows as a zero-write idempotent replay', () => {
    expect(classifyFixtureSnapshot(snapshot('applied'))).toBe('idempotent_replay');
    expect(FIXTURE_RECONCILIATION_ROW_BUDGET.replay).toBe(0);
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
      'blank display name',
      { legacy: { ...snapshot('empty').legacy, displayNameCompatible: false } },
    ],
    [
      'incompatible password hash',
      { legacy: { ...snapshot('empty').legacy, passwordHashCompatible: false } },
    ],
    ['digest unavailable', { pgcryptoDigestAvailable: false }],
    ['invalid protected bindings', { protectedBindingsValid: false }],
    ['partial v2.1 state', { v21: { ...snapshot('empty').v21, adultIdentities: 1 } }],
  ])('fails closed on %s', (_label, overrides) => {
    expect(() => classifyFixtureSnapshot(snapshot('empty', overrides))).toThrow(
      'FIXTURE_RECONCILIATION_REJECTED',
    );
  });

  it('proves exact apply and replay row budgets with unchanged legacy state', () => {
    const before = snapshot('empty');
    const after = snapshot('applied');
    expect(() =>
      assertApplyReadback({ mode: 'create', affectedRows: 6, before, after }),
    ).not.toThrow();
    expect(() =>
      assertApplyReadback({
        mode: 'idempotent_replay',
        affectedRows: 0,
        before: after,
        after,
      }),
    ).not.toThrow();
    expect(() => assertApplyReadback({ mode: 'create', affectedRows: 7, before, after })).toThrow(
      'apply_hard_row_ceiling',
    );
    expect(() => assertApplyReadback({ mode: 'create', affectedRows: 5, before, after })).toThrow(
      'apply_row_budget',
    );
  });

  it('proves six exact-ID reverse deletes restore zero v2.1 rows', () => {
    expect(() =>
      assertRollbackReadback({
        affectedRows: 6,
        beforeRollback: snapshot('applied'),
        afterRollback: snapshot('empty'),
      }),
    ).not.toThrow();
    expect(() =>
      assertRollbackReadback({
        affectedRows: 7,
        beforeRollback: snapshot('applied'),
        afterRollback: snapshot('empty'),
      }),
    ).toThrow('rollback_hard_row_ceiling');
    expect(() =>
      assertRollbackReadback({
        affectedRows: 5,
        beforeRollback: snapshot('applied'),
        afterRollback: snapshot('empty'),
      }),
    ).toThrow('rollback_row_budget');
  });

  it('rejects any legacy or session change during apply or rollback', () => {
    const before = snapshot('empty');
    const changedLegacy = snapshot('applied', {
      legacy: { ...snapshot('applied').legacy, immutableFingerprint: 'b'.repeat(64) },
    });
    expect(() =>
      assertApplyReadback({ mode: 'create', affectedRows: 6, before, after: changedLegacy }),
    ).toThrow('legacy_mutation_detected');

    const expiredSession = snapshot('empty', {
      legacy: {
        ...snapshot('empty').legacy,
        activeSessions: 0,
        activeSessionHashMatches: null,
      },
    });
    expect(() =>
      assertRollbackReadback({
        affectedRows: 6,
        beforeRollback: snapshot('applied'),
        afterRollback: expiredSession,
      }),
    ).toThrow('rollback_session_effect_detected');
  });

  it('keeps SQL inert, parameterized, scoped, locked, and write-target bounded', () => {
    const allSql = [
      BEGIN_SQL,
      ADVISORY_LOCK_SQL,
      PREFLIGHT_SQL,
      LEGACY_IMMUTABLE_READBACK_SQL,
      ...APPLY_INSERT_SQL,
      AFTER_READBACK_SQL,
      ROLLBACK_PREFLIGHT_SQL,
      ...ROLLBACK_DELETE_SQL,
      ROLLBACK_AFTER_READBACK_SQL,
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
    ]);

    expect(BEGIN_SQL).toContain('SERIALIZABLE');
    expect(ADVISORY_LOCK_SQL).toContain('pg_advisory_xact_lock');
    expect(PREFLIGHT_SQL).toContain("to_regprocedure('digest(bytea,text)')");
    expect(PREFLIGHT_SQL).toContain('password_hash_compatible');
    expect(PREFLIGHT_SQL).toContain('display_name_compatible');
    expect(PREFLIGHT_SQL).toContain('protected_bindings_valid');
    expect(PREFLIGHT_SQL).toContain('argon2id-v1');
    expect(ROLLBACK_PREFLIGHT_SQL).toBe(AFTER_READBACK_SQL);
    expect(ROLLBACK_AFTER_READBACK_SQL).toBe(PREFLIGHT_SQL);
    expect(APPLY_INSERT_SQL).toHaveLength(FIXTURE_RECONCILIATION_ROW_BUDGET.apply);
    expect(ROLLBACK_DELETE_SQL).toHaveLength(FIXTURE_RECONCILIATION_ROW_BUDGET.rollback);
    expect(writeTargets).toHaveLength(12);
    expect(writeTargets.every((target) => target !== undefined && allowedTargets.has(target))).toBe(
      true,
    );
    expect(allSql).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM)\s+onetime\.(?:account_users|user_sessions|v21_adult_sessions)/i,
    );
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.productKey);
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.runtimeTier);
    expect(allSql).toContain(FIXTURE_RECONCILIATION_SCOPE.verificationEnvironmentId);
    expect(INERT_TRANSACTION_PROPOSAL.opensNetworkConnection).toBe(false);
    expect(INERT_TRANSACTION_PROPOSAL.executesSql).toBe(false);
    expect(INERT_TRANSACTION_PROPOSAL.effectAuthority).toBe(false);
    expect(INERT_TRANSACTION_PROPOSAL.preflightExactReadback).toBe(AFTER_READBACK_SQL);
    expect(PROTECTED_BINDINGS).toHaveLength(12);
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
