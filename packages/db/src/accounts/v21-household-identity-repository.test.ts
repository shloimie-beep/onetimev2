import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Queryable } from '../index.ts';
import {
  createPostgresV21AdultSessionRepository,
  createV21ParentSession,
  listOwnedHouseholdContexts,
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
