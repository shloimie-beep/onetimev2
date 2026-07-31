import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppliedOwnershipTransfer } from '../../../contracts/src/accounts/v21-household-identity.ts';
import type { Queryable } from '../index.ts';
import {
  createPostgresV21AdultSessionRepository,
  createV21ParentSession,
  inHouseholdIdentityTransaction,
  listOwnedHouseholdContexts,
  persistAppliedOwnershipTransfer,
  resolveV21ParentSession,
  revokeV21ParentSession,
} from './v21-household-identity-repository.ts';

const issuedAt = new Date('2026-07-30T18:30:00.000Z');
const accessDigest = 'a'.repeat(64);
const refreshDigest = 'b'.repeat(64);
const binding = {
  sessionId: 'session_parent_one',
  adultId: 'adult_owner_one',
  humanAccountId: 'account_owner_one',
  householdId: 'household_one',
  runtimeTier: 'isolated_staging' as const,
  verificationEnvironmentId: 'ci' as const,
  securityVersion: 3,
};

describe('F04 PostgreSQL v2.1 adult-session repository', () => {
  it('creates one exact Parent/owner session and persists only separated digests', async () => {
    const capture = capturingDb(() => [sessionRow()]);
    const repository = createPostgresV21AdultSessionRepository(capture.db);

    const created = await repository.create({
      ...binding,
      accessTokenDigest: accessDigest,
      refreshTokenDigest: refreshDigest,
      issuedAt,
    });

    expect(created).toMatchObject({
      adultId: binding.adultId,
      normalizedEmail: 'owner@example.test',
      ownerDisplayName: 'Owner One',
      session: {
        sessionId: binding.sessionId,
        activeRole: 'parent',
        activeHouseholdId: binding.householdId,
        securityVersion: 3,
      },
      household: {
        householdId: binding.householdId,
        displayName: 'Owner One household',
        accessState: 'active',
      },
    });
    const query = capture.queries[0]!;
    expect(query.text).toContain("membership.role = 'parent'");
    expect(query.text).toContain('household.owner_human_account_id = account.human_account_id');
    expect(query.text).toContain('household.owner_adult_id = adult.adult_id');
    expect(query.text).toContain('account.security_version = $7');
    expect(query.text).toContain("access.aggregate_kind = 'access'");
    expect(query.text).toContain('ON CONFLICT (session_id) DO NOTHING');
    expect(query.values?.[7]).toBe(accessDigest);
    expect(query.values?.[8]).toBe(refreshDigest);
    expect(query.values?.[9]).toBe('2026-07-31T18:30:00.000Z');
    expect(query.values?.[10]).toBe('2026-08-29T18:30:00.000Z');
    expect(JSON.stringify(query.values)).not.toContain('raw-session-material');
  });

  it('resolves access and refresh digests only through the exact live binding', async () => {
    const capture = capturingDb(() => [sessionRow({ access_state: 'inactive' })]);

    const resolved = await resolveV21ParentSession(capture.db, {
      ...binding,
      tokenKind: 'access',
      tokenDigest: accessDigest,
      now: new Date('2026-07-30T18:31:00.000Z'),
    });

    expect(resolved?.household).toMatchObject({
      householdId: binding.householdId,
      accessState: 'inactive',
    });
    const query = capture.queries[0]!;
    expect(query.text).toContain("session.active_role = 'parent'");
    expect(query.text).toContain('membership.revoked_at IS NULL');
    expect(query.text).toContain('session.revoked_at IS NULL');
    expect(query.text).toContain('session.idle_expires_at > $10');
    expect(query.text).toContain('session.absolute_expires_at > $10');
    expect(query.text).toContain("WHEN 'access' THEN session.access_token_digest = $9");
    expect(query.text).toContain("WHEN 'refresh' THEN session.refresh_token_digest = $9");
    expect(query.values?.slice(0, 10)).toEqual([
      binding.sessionId,
      binding.humanAccountId,
      binding.adultId,
      binding.householdId,
      binding.runtimeTier,
      binding.verificationEnvironmentId,
      binding.securityVersion,
      'access',
      accessDigest,
      '2026-07-30T18:31:00.000Z',
    ]);
  });

  it('returns null rather than broadening a missing or mismatched session', async () => {
    const capture = capturingDb(() => []);
    await expect(
      resolveV21ParentSession(capture.db, {
        ...binding,
        householdId: 'sibling_household',
        tokenKind: 'refresh',
        tokenDigest: refreshDigest,
        now: new Date('2026-07-30T18:31:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('revokes once with a bounded reason and the same exact live binding', async () => {
    const first = capturingDb(() => [{ session_id: binding.sessionId }]);
    await expect(
      revokeV21ParentSession(first.db, {
        ...binding,
        tokenKind: 'refresh',
        tokenDigest: refreshDigest,
        now: new Date('2026-07-30T18:31:00.000Z'),
        reason: 'adult_logout',
      }),
    ).resolves.toBe(true);
    expect(first.queries[0]?.text).toContain('FOR UPDATE OF session');
    expect(first.queries[0]?.text).toContain('version = session.version + 1');
    expect(first.queries[0]?.values?.at(-1)).toBe('adult_logout');

    const replay = capturingDb(() => []);
    await expect(
      revokeV21ParentSession(replay.db, {
        ...binding,
        tokenKind: 'refresh',
        tokenDigest: refreshDigest,
        now: new Date('2026-07-30T18:31:01.000Z'),
        reason: 'adult_logout',
      }),
    ).resolves.toBe(false);
  });

  it('rejects malformed or non-separated digests before any SQL runs', async () => {
    const capture = capturingDb(() => {
      throw new Error('SQL must not run');
    });
    await expect(
      createV21ParentSession(capture.db, {
        ...binding,
        accessTokenDigest: 'raw-session-material',
        refreshTokenDigest: refreshDigest,
        issuedAt,
      }),
    ).rejects.toMatchObject({ code: 'invalid_session_input' });
    await expect(
      createV21ParentSession(capture.db, {
        ...binding,
        accessTokenDigest: accessDigest,
        refreshTokenDigest: accessDigest,
        issuedAt,
      }),
    ).rejects.toMatchObject({ code: 'invalid_session_input' });
    expect(capture.queries).toHaveLength(0);
  });

  it('derives deterministic family and school labels from the active owner identity', async () => {
    const capture = capturingDb(() => [
      {
        household_id: 'household_family',
        owner_display_name: '  Owner One  ',
        classification: 'family',
        access_state: 'free',
      },
      {
        household_id: 'household_school',
        owner_display_name: 'School Owner',
        classification: 'school',
        access_state: 'grace',
      },
    ]);

    await expect(
      listOwnedHouseholdContexts(capture.db, {
        humanAccountId: binding.humanAccountId,
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'ci',
      }),
    ).resolves.toEqual([
      {
        householdId: 'household_family',
        displayName: 'Owner One household',
        classification: 'family',
        accessState: 'free',
        ownerRelationship: 'account_owner',
      },
      {
        householdId: 'household_school',
        displayName: 'School Owner school',
        classification: 'school',
        accessState: 'grace',
        ownerRelationship: 'account_owner',
      },
    ]);
    const sql = capture.queries[0]!.text;
    expect(sql).toContain('owner.display_name AS owner_display_name');
    expect(sql).toContain('owner.adult_id = household.owner_adult_id');
    expect(sql).not.toContain('household.display_name');
  });

  it('uses the exact migration-2235 revocation fields and requires every requested row', async () => {
    const capture = rowCountDb((text) => {
      if (text.includes('UPDATE onetime.v21_adult_sessions')) return 2;
      if (text.includes('UPDATE onetime.v21_billing_portal_sessions')) return 1;
      if (text.includes('UPDATE onetime.v21_account_action_tokens')) return 1;
      return 1;
    });

    await expect(persistAppliedOwnershipTransfer(capture.db, appliedTransfer())).resolves.toBe(
      undefined,
    );

    const adult = capture.queries.find((query) =>
      query.text.includes('UPDATE onetime.v21_adult_sessions'),
    )!;
    expect(adult.text).toContain('revoke_reason');
    expect(adult.text).toContain('version = version + 1');
    expect(adult.text).toContain('updated_at = $2');
    expect(adult.text).not.toContain('revocation_reason');
    expect(adult.values).toEqual([
      ['session_transfer_household', 'session_replacement'],
      '2026-07-30T19:00:00.000Z',
    ]);

    const billing = capture.queries.find((query) =>
      query.text.includes('UPDATE onetime.v21_billing_portal_sessions'),
    )!;
    expect(billing.text).toContain("state = 'revoked'");
    expect(billing.text).toContain("state = 'issued'");
    expect(billing.text).toContain('used_at IS NULL');
    expect(billing.text).toContain('revoked_at IS NULL');
    expect(billing.text).toContain('version = version + 1');

    const action = capture.queries.find((query) =>
      query.text.includes('UPDATE onetime.v21_account_action_tokens'),
    )!;
    expect(action.text).toContain('action_token_id = ANY($1::text[])');
    expect(action.text).toContain('used_at IS NULL');
    expect(action.text).toContain('revoked_at IS NULL');
    expect(action.text).toContain('version = version + 1');
    expect(action.text).not.toContain('invalidated_at');
    expect(action.text).not.toContain('invalidation_reason');
  });

  it.each([
    ['adult session', 'UPDATE onetime.v21_adult_sessions'],
    ['billing portal session', 'UPDATE onetime.v21_billing_portal_sessions'],
    ['account action token', 'UPDATE onetime.v21_account_action_tokens'],
  ])(
    'fails closed when the locked %s inventory is missing, stale, used, or already revoked',
    async (_label, failingSql) => {
      const capture = rowCountDb((text) => {
        if (text.includes(failingSql)) return 0;
        if (text.includes('UPDATE onetime.v21_adult_sessions')) return 2;
        if (text.includes('UPDATE onetime.v21_billing_portal_sessions')) return 1;
        return 1;
      });

      await expect(
        persistAppliedOwnershipTransfer(capture.db, appliedTransfer()),
      ).rejects.toMatchObject({ code: 'stale_version' });
      expect(capture.queries.at(-1)?.text).toContain(failingSql);
    },
  );

  it('rejects duplicate revocation identifiers before broadening the inventory update', async () => {
    const capture = rowCountDb(() => 1);
    const result = appliedTransfer({
      outgoingSessionIdsRevoked: ['session_duplicate'],
      replacementSessionIdsRevoked: ['session_duplicate'],
    });

    await expect(persistAppliedOwnershipTransfer(capture.db, result)).rejects.toMatchObject({
      code: 'persistence_invariant',
    });
    expect(
      capture.queries.some((query) => query.text.includes('UPDATE onetime.v21_adult_sessions')),
    ).toBe(false);
  });
});

const nativeDatabaseUrl = process.env.F04_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.F04_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

describe.runIf(nativeProofEnabled)('F04 unchanged-2235 native PostgreSQL proof', () => {
  let pool: pg.Pool | undefined;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 1 });
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await pool.query('CREATE SCHEMA onetime');
    const migrations = path.resolve(process.cwd(), 'packages/db/migrations');
    await pool.query(
      await readFile(path.join(migrations, '2234_canonical_state_machines.sql'), 'utf8'),
    );
    await pool.query(
      await readFile(path.join(migrations, '2235_v21_household_identity.sql'), 'utf8'),
    );
    await seedNativeParent(pool);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DROP SCHEMA onetime CASCADE');
    await pool.end();
  }, 30_000);

  it('creates, resolves, isolates, expires, and revokes against the applied schema', async () => {
    const db = pool!;
    const rawAccess = 'native-access-material-never-persist';
    const rawRefresh = 'native-refresh-material-never-persist';
    const nativeAccessDigest = domainDigest('adult-session-access-v1', rawAccess);
    const nativeRefreshDigest = domainDigest('adult-session-refresh-v1', rawRefresh);
    const nativeIssuedAt = new Date();
    const nativeBinding = {
      sessionId: 'session_native_parent',
      adultId: 'adult_native_owner',
      humanAccountId: 'account_native_owner',
      householdId: 'household_native',
      runtimeTier: 'isolated_staging' as const,
      verificationEnvironmentId: 'ci' as const,
      securityVersion: 7,
    };

    const created = await createV21ParentSession(db, {
      ...nativeBinding,
      accessTokenDigest: nativeAccessDigest,
      refreshTokenDigest: nativeRefreshDigest,
      issuedAt: nativeIssuedAt,
    });
    expect(created.household).toMatchObject({
      householdId: 'household_native',
      displayName: 'Native Owner household',
      accessState: 'active',
    });

    const stored = await db.query(
      `SELECT access_token_digest, refresh_token_digest
         FROM onetime.v21_adult_sessions
        WHERE session_id = $1`,
      [nativeBinding.sessionId],
    );
    expect(stored.rows[0]).toEqual({
      access_token_digest: nativeAccessDigest,
      refresh_token_digest: nativeRefreshDigest,
    });
    expect(JSON.stringify(stored.rows[0])).not.toContain(rawAccess);
    expect(JSON.stringify(stored.rows[0])).not.toContain(rawRefresh);

    const liveNow = new Date(nativeIssuedAt.getTime() + 1_000);
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'access',
        tokenDigest: nativeAccessDigest,
        now: liveNow,
      }),
    ).resolves.toMatchObject({
      adultId: nativeBinding.adultId,
      session: { activeRole: 'parent', securityVersion: 7 },
    });
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        householdId: 'household_wrong',
        tokenKind: 'access',
        tokenDigest: nativeAccessDigest,
        now: liveNow,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        securityVersion: 8,
        tokenKind: 'access',
        tokenDigest: nativeAccessDigest,
        now: liveNow,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'access',
        tokenDigest: 'c'.repeat(64),
        now: liveNow,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'access',
        tokenDigest: nativeAccessDigest,
        now: new Date(nativeIssuedAt.getTime() + 24 * 60 * 60 * 1000),
      }),
    ).resolves.toBeNull();

    await db.query(
      `UPDATE onetime.v21_human_account_role_memberships
          SET revoked_at = $1, revoked_reason = 'native_proof'
        WHERE human_account_id = $2 AND role = 'parent'`,
      [liveNow.toISOString(), nativeBinding.humanAccountId],
    );
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'refresh',
        tokenDigest: nativeRefreshDigest,
        now: liveNow,
      }),
    ).resolves.toBeNull();
    await db.query(
      `UPDATE onetime.v21_human_account_role_memberships
          SET revoked_at = NULL, revoked_reason = NULL
        WHERE human_account_id = $1 AND role = 'parent'`,
      [nativeBinding.humanAccountId],
    );

    await expect(
      revokeV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'refresh',
        tokenDigest: nativeRefreshDigest,
        now: liveNow,
        reason: 'adult_logout',
      }),
    ).resolves.toBe(true);
    await expect(
      revokeV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'refresh',
        tokenDigest: nativeRefreshDigest,
        now: new Date(liveNow.getTime() + 1),
        reason: 'adult_logout',
      }),
    ).resolves.toBe(false);
    await expect(
      resolveV21ParentSession(db, {
        ...nativeBinding,
        tokenKind: 'access',
        tokenDigest: nativeAccessDigest,
        now: liveNow,
      }),
    ).resolves.toBeNull();
  }, 30_000);

  it('atomically revokes the exact transfer inventory while leaving a sibling household live', async () => {
    const result = await seedNativeTransferScenario(pool!, 'commit', false);

    await expect(
      inHouseholdIdentityTransaction(pool!, (db) => persistAppliedOwnershipTransfer(db, result)),
    ).resolves.toBe(undefined);

    const transfer = await pool!.query(
      `SELECT state, version, replacement_adult_id
         FROM onetime.v21_household_ownership_transfers
        WHERE transfer_id = $1`,
      [result.transfer.transferId],
    );
    expect(transfer.rows[0]).toEqual({
      state: 'accepted',
      version: '3',
      replacement_adult_id: result.replacementAdult.adultId,
    });

    const sessions = await pool!.query(
      `SELECT session_id, revoked_at, revoke_reason, version
         FROM onetime.v21_adult_sessions
        WHERE session_id = ANY($1::text[])
        ORDER BY session_id`,
      [
        [
          ...result.outgoingSessionIdsRevoked,
          ...result.replacementSessionIdsRevoked,
          'session_commit_sibling',
        ],
      ],
    );
    expect(sessions.rows).toEqual([
      {
        session_id: 'session_commit_replacement',
        revoked_at: new Date(result.transfer.acceptedAt!),
        revoke_reason: 'household_ownership_transfer',
        version: '2',
      },
      {
        session_id: 'session_commit_sibling',
        revoked_at: null,
        revoke_reason: null,
        version: '1',
      },
      {
        session_id: 'session_commit_transfer',
        revoked_at: new Date(result.transfer.acceptedAt!),
        revoke_reason: 'household_ownership_transfer',
        version: '2',
      },
    ]);

    const billing = await pool!.query(
      `SELECT state, revoked_at, version
         FROM onetime.v21_billing_portal_sessions
        WHERE billing_session_id = $1`,
      [result.billingSessionIdsRevoked[0]],
    );
    expect(billing.rows[0]).toEqual({
      state: 'revoked',
      revoked_at: new Date(result.transfer.acceptedAt!),
      version: '2',
    });

    const action = await pool!.query(
      `SELECT used_at, revoked_at, version
         FROM onetime.v21_account_action_tokens
        WHERE action_token_id = $1`,
      [result.setupOrResetTokenIdsInvalidated[0]],
    );
    expect(action.rows[0]).toEqual({
      used_at: null,
      revoked_at: new Date(result.transfer.acceptedAt!),
      version: '2',
    });
  }, 30_000);

  it('rolls back the whole transfer when a late action token is already used', async () => {
    const result = await seedNativeTransferScenario(pool!, 'rollback', true);

    await expect(
      inHouseholdIdentityTransaction(pool!, (db) => persistAppliedOwnershipTransfer(db, result)),
    ).rejects.toMatchObject({ code: 'stale_version' });

    const transfer = await pool!.query(
      `SELECT state, version, replacement_adult_id, accepted_at
         FROM onetime.v21_household_ownership_transfers
        WHERE transfer_id = $1`,
      [result.transfer.transferId],
    );
    expect(transfer.rows[0]).toEqual({
      state: 'pending',
      version: '2',
      replacement_adult_id: null,
      accepted_at: null,
    });

    const household = await pool!.query(
      `SELECT owner_adult_id, owner_human_account_id, version
         FROM onetime.v21_households
        WHERE household_id = $1`,
      [result.household.householdId],
    );
    expect(household.rows[0]).toEqual({
      owner_adult_id: 'adult_rollback_outgoing',
      owner_human_account_id: 'account_rollback_outgoing',
      version: '4',
    });

    const sessions = await pool!.query(
      `SELECT count(*)::int AS changed
         FROM onetime.v21_adult_sessions
        WHERE session_id = ANY($1::text[])
          AND (revoked_at IS NOT NULL OR version <> 1)`,
      [[...result.outgoingSessionIdsRevoked, ...result.replacementSessionIdsRevoked]],
    );
    expect(sessions.rows[0]).toEqual({ changed: 0 });

    const billing = await pool!.query(
      `SELECT state, revoked_at, version
         FROM onetime.v21_billing_portal_sessions
        WHERE billing_session_id = $1`,
      [result.billingSessionIdsRevoked[0]],
    );
    expect(billing.rows[0]).toEqual({ state: 'issued', revoked_at: null, version: '1' });

    const effects = await pool!.query(
      `SELECT
         (SELECT count(*)::int
            FROM onetime.v21_provider_reassociation_intents
           WHERE household_id = $1) AS intents,
         (SELECT count(*)::int
            FROM onetime.v21_account_audit_events
           WHERE household_id = $1) AS audit_events`,
      [result.household.householdId],
    );
    expect(effects.rows[0]).toEqual({ intents: 0, audit_events: 0 });
  }, 30_000);
});

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: binding.sessionId,
    human_account_id: binding.humanAccountId,
    active_role: 'parent',
    active_household_id: binding.householdId,
    security_version: binding.securityVersion,
    version: 1,
    idle_expires_at: '2026-07-31T18:30:00.000Z',
    absolute_expires_at: '2026-08-29T18:30:00.000Z',
    revoked_at: null,
    revoke_reason: null,
    product_key: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
    created_at: '2026-07-30T18:30:00.000Z',
    updated_at: '2026-07-30T18:30:00.000Z',
    adult_id: binding.adultId,
    normalized_email: 'owner@example.test',
    owner_display_name: 'Owner One',
    classification: 'family',
    access_state: 'active',
    owned_household_count: 1,
    ...overrides,
  };
}

function capturingDb(
  rowsFor: (text: string, values?: readonly unknown[]) => readonly Record<string, unknown>[],
) {
  const queries: { text: string; values?: readonly unknown[] }[] = [];
  const query = (async (text: string, values?: readonly unknown[]) => {
    const record = values === undefined ? { text } : { text, values };
    queries.push(record);
    const rows = [...rowsFor(text, values)];
    return { rows, rowCount: rows.length };
  }) as unknown as Queryable['query'];
  return { db: { query } satisfies Queryable, queries };
}

function rowCountDb(rowCountFor: (text: string, values?: readonly unknown[]) => number) {
  const queries: { text: string; values?: readonly unknown[] }[] = [];
  const query = (async (text: string, values?: readonly unknown[]) => {
    const record = values === undefined ? { text } : { text, values };
    queries.push(record);
    return { rows: [], rowCount: rowCountFor(text, values) };
  }) as unknown as Queryable['query'];
  return { db: { query } satisfies Queryable, queries };
}

function appliedTransfer(
  overrides: Partial<AppliedOwnershipTransfer> = {},
): AppliedOwnershipTransfer {
  const acceptedAt = '2026-07-30T19:00:00.000Z';
  const canonicalRequestHash = 'c'.repeat(64);
  return {
    disposition: 'applied',
    transfer: {
      transferId: 'transfer_repository',
      product: 'one_time_mishnayos',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      householdId: 'household_transfer',
      outgoingAdultId: 'adult_transfer_outgoing',
      outgoingHumanAccountId: 'account_transfer_outgoing',
      replacementNormalizedEmail: 'replacement@example.test',
      replacementAdultId: 'adult_transfer_replacement',
      initiatedByAdminAccountId: 'account_admin_actor',
      state: 'accepted',
      expiresAt: '2026-08-05T19:00:00.000Z',
      acceptedAt,
      acceptedByAdultId: 'adult_transfer_replacement',
      acceptanceRequestHash: canonicalRequestHash,
      requiredPolicies: {
        policySetVersion: 'policy-set-7',
        serviceAccountVersion: 'service-4',
        recordingParticipationVersion: 'recording-9',
      },
      version: 3,
      createdAt: '2026-07-30T18:00:00.000Z',
      updatedAt: acceptedAt,
    },
    household: {
      householdId: 'household_transfer',
      product: 'one_time_mishnayos',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      ownerAdultId: 'adult_transfer_replacement',
      ownerHumanAccountId: 'account_transfer_replacement',
      classification: 'family',
      displayName: 'Transfer household',
      seatLimit: 3,
      activeSeatCount: 0,
      state: 'active',
      version: 5,
      createdAt: '2026-07-30T18:00:00.000Z',
      updatedAt: acceptedAt,
    },
    replacementAdult: {
      adultId: 'adult_transfer_replacement',
      product: 'one_time_mishnayos',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      normalizedEmail: 'replacement@example.test',
      displayName: 'Replacement',
      state: 'active',
      version: 1,
      createdAt: '2026-07-30T18:00:00.000Z',
      updatedAt: '2026-07-30T18:00:00.000Z',
    },
    replacementAccount: {
      humanAccountId: 'account_transfer_replacement',
      product: 'one_time_mishnayos',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      adultId: 'adult_transfer_replacement',
      memberships: ['parent'],
      state: 'active',
      securityVersion: 2,
      version: 1,
      createdAt: '2026-07-30T18:00:00.000Z',
      updatedAt: '2026-07-30T18:00:00.000Z',
    },
    parentMembershipAdded: false,
    outgoingSessionIdsRevoked: ['session_transfer_household'],
    replacementSessionIdsRevoked: ['session_replacement'],
    billingSessionIdsRevoked: ['billing_transfer'],
    setupOrResetTokenIdsInvalidated: ['action_transfer'],
    providerIntent: {
      intentType: 'household_owner_reassociation',
      householdId: 'household_transfer',
      previousAdultId: 'adult_transfer_outgoing',
      replacementAdultId: 'adult_transfer_replacement',
      changesFinancialIdentity: false,
      canonicalRequestHash,
    },
    auditEvent: {
      eventType: 'household_ownership_transferred',
      transferId: 'transfer_repository',
      householdId: 'household_transfer',
      initiatingAdminAccountId: 'account_admin_actor',
      outgoingAdultId: 'adult_transfer_outgoing',
      replacementAdultId: 'adult_transfer_replacement',
      occurredAt: acceptedAt,
      canonicalRequestHash,
    },
    ...overrides,
  };
}

async function seedNativeTransferScenario(
  pool: pg.Pool,
  suffix: string,
  actionTokenUsed: boolean,
): Promise<AppliedOwnershipTransfer> {
  const createdAt = '2026-07-30T18:00:00.000Z';
  const acceptedAt = '2026-07-30T19:00:00.000Z';
  const outgoingAdultId = `adult_${suffix}_outgoing`;
  const replacementAdultId = `adult_${suffix}_replacement`;
  const outgoingAccountId = `account_${suffix}_outgoing`;
  const replacementAccountId = `account_${suffix}_replacement`;
  const householdId = `household_${suffix}_transfer`;
  const siblingHouseholdId = `household_${suffix}_sibling`;
  const transferId = `transfer_${suffix}`;
  const transferSessionId = `session_${suffix}_transfer`;
  const siblingSessionId = `session_${suffix}_sibling`;
  const replacementSessionId = `session_${suffix}_replacement`;
  const billingSessionId = `billing_${suffix}`;
  const actionTokenId = `action_${suffix}`;
  const canonicalRequestHash = domainDigest('native-transfer-request', suffix);

  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ($1, $2, 'Outgoing Owner', 'active', 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $5, $5),
       ($3, $4, 'Replacement Owner', 'active', 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $5, $5)`,
    [
      outgoingAdultId,
      `${suffix}-outgoing@example.test`,
      replacementAdultId,
      `${suffix}-replacement@example.test`,
      createdAt,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ($1, $2, 'active', 2, 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $5, $5),
       ($3, $4, 'active', 3, 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $5, $5)`,
    [outgoingAccountId, outgoingAdultId, replacementAccountId, replacementAdultId, createdAt],
  );
  await pool.query(
    `INSERT INTO onetime.v21_households
       (household_id, owner_adult_id, owner_human_account_id, classification,
        state, seat_limit, active_seat_count, access_aggregate_ref, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ($1, $3, $4, 'family', 'active', 3, 0, $1, 4,
        'one_time_mishnayos', 'isolated_staging', 'ci', $5, $5),
       ($2, $3, $4, 'family', 'active', 3, 0, $2, 1,
        'one_time_mishnayos', 'isolated_staging', 'ci', $5, $5)`,
    [householdId, siblingHouseholdId, outgoingAdultId, outgoingAccountId, createdAt],
  );
  await pool.query(
    `INSERT INTO onetime.v21_household_ownership_transfers
       (transfer_id, household_id, outgoing_adult_id, replacement_adult_id,
        replacement_normalized_email, acceptance_token_digest, state,
        requested_by_human_account_id, canonical_request_hash,
        service_account_policy_version, recording_participation_policy_version,
        expires_at, version, product_key, runtime_tier, verification_environment_id,
        created_at, updated_at)
     VALUES
       ($1, $2, $3, NULL, $4, $5, 'pending', $6, $7, 'service-4',
        'recording-9', '2026-08-05T18:00:00.000Z', 2, 'one_time_mishnayos',
        'isolated_staging', 'ci', $8, $8)`,
    [
      transferId,
      householdId,
      outgoingAdultId,
      `${suffix}-replacement@example.test`,
      domainDigest('native-transfer-token', suffix),
      `account_${suffix}_admin_actor`,
      canonicalRequestHash,
      createdAt,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.v21_adult_sessions
       (session_id, human_account_id, active_role, active_household_id,
        access_token_digest, refresh_token_digest, security_version, version,
        idle_expires_at, absolute_expires_at, product_key, runtime_tier,
        verification_environment_id, created_at, updated_at)
     VALUES
       ($1, $4, 'parent', $6, $8, $9, 2, 1,
        '2026-07-31T18:00:00.000Z', '2026-08-29T18:00:00.000Z',
        'one_time_mishnayos', 'isolated_staging', 'ci', $10, $10),
       ($2, $4, 'parent', $7, $11, $12, 2, 1,
        '2026-07-31T18:00:00.000Z', '2026-08-29T18:00:00.000Z',
        'one_time_mishnayos', 'isolated_staging', 'ci', $10, $10),
       ($3, $5, 'parent', $6, $13, $14, 3, 1,
        '2026-07-31T18:00:00.000Z', '2026-08-29T18:00:00.000Z',
        'one_time_mishnayos', 'isolated_staging', 'ci', $10, $10)`,
    [
      transferSessionId,
      siblingSessionId,
      replacementSessionId,
      outgoingAccountId,
      replacementAccountId,
      householdId,
      siblingHouseholdId,
      domainDigest('access-transfer', suffix),
      domainDigest('refresh-transfer', suffix),
      createdAt,
      domainDigest('access-sibling', suffix),
      domainDigest('refresh-sibling', suffix),
      domainDigest('access-replacement', suffix),
      domainDigest('refresh-replacement', suffix),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.v21_billing_portal_sessions
       (billing_session_id, household_id, billing_reference_digest, state,
        expires_at, version, product_key, runtime_tier, verification_environment_id, created_at)
     VALUES
       ($1, $2, $3, 'issued', '2026-08-01T18:00:00.000Z', 1,
        'one_time_mishnayos', 'isolated_staging', 'ci', $4)`,
    [billingSessionId, householdId, domainDigest('billing-reference', suffix), createdAt],
  );
  await pool.query(
    `INSERT INTO onetime.v21_account_action_tokens
       (action_token_id, human_account_id, action_kind, token_digest,
        canonical_request_hash, expires_at, used_at, version, product_key,
        runtime_tier, verification_environment_id, created_at)
     VALUES
       ($1, $2, 'ownership_transfer_reset', $3, $4,
        '2026-08-01T18:00:00.000Z', $5, 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $6)`,
    [
      actionTokenId,
      outgoingAccountId,
      domainDigest('action-token', suffix),
      canonicalRequestHash,
      actionTokenUsed ? createdAt : null,
      createdAt,
    ],
  );

  const base = appliedTransfer();
  return {
    ...base,
    transfer: {
      ...base.transfer,
      transferId,
      householdId,
      outgoingAdultId,
      outgoingHumanAccountId: outgoingAccountId,
      replacementNormalizedEmail: `${suffix}-replacement@example.test`,
      replacementAdultId,
      initiatedByAdminAccountId: `account_${suffix}_admin_actor`,
      acceptedAt,
      acceptedByAdultId: replacementAdultId,
      acceptanceRequestHash: canonicalRequestHash,
      createdAt,
      updatedAt: acceptedAt,
    },
    household: {
      ...base.household,
      householdId,
      ownerAdultId: replacementAdultId,
      ownerHumanAccountId: replacementAccountId,
      createdAt,
      updatedAt: acceptedAt,
    },
    replacementAdult: {
      ...base.replacementAdult,
      adultId: replacementAdultId,
      normalizedEmail: `${suffix}-replacement@example.test`,
      createdAt,
      updatedAt: createdAt,
    },
    replacementAccount: {
      ...base.replacementAccount,
      humanAccountId: replacementAccountId,
      adultId: replacementAdultId,
      securityVersion: 3,
      createdAt,
      updatedAt: createdAt,
    },
    outgoingSessionIdsRevoked: [transferSessionId],
    replacementSessionIdsRevoked: [replacementSessionId],
    billingSessionIdsRevoked: [billingSessionId],
    setupOrResetTokenIdsInvalidated: [actionTokenId],
    providerIntent: {
      ...base.providerIntent,
      householdId,
      previousAdultId: outgoingAdultId,
      replacementAdultId,
      canonicalRequestHash,
    },
    auditEvent: {
      ...base.auditEvent,
      transferId,
      householdId,
      initiatingAdminAccountId: `account_${suffix}_admin_actor`,
      outgoingAdultId,
      replacementAdultId,
      occurredAt: acceptedAt,
      canonicalRequestHash,
    },
  };
}

async function seedNativeParent(pool: pg.Pool) {
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ('adult_native_owner', 'native-owner@example.test', 'Native Owner', 'active', 1,
        'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ('account_native_owner', 'adult_native_owner', 'active', 7, 1,
        'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_account_role_memberships
       (human_account_id, role, granted_at, granted_reason, product_key,
        runtime_tier, verification_environment_id)
     VALUES
       ('account_native_owner', 'parent', $1, 'native_proof',
        'one_time_mishnayos', 'isolated_staging', 'ci')`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_households
       (household_id, owner_adult_id, owner_human_account_id, classification,
        state, seat_limit, active_seat_count, access_aggregate_ref, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES
       ('household_native', 'adult_native_owner', 'account_native_owner', 'family',
        'active', 3, 0, 'household_native', 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.canonical_aggregate_states
       (aggregate_kind, aggregate_key, current_state, version, product_key,
        runtime_tier, verification_environment_id, last_transition_key,
        created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
        last_mutated_by_actor_key, created_at, updated_at)
     VALUES
       ('access', 'household_native', 'active', 1, 'one_time_mishnayos',
        'isolated_staging', 'ci', 'native_access_transition', 'system',
        'f04_native_proof', 'system', 'f04_native_proof', $1, $1)`,
    [now],
  );
}

function domainDigest(domain: string, raw: string) {
  return createHash('sha256').update(`${domain}\0${raw}`, 'utf8').digest('hex');
}
