import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createDbBackedTestAdultSessionRepository } from '../../support/pgmem-v21-parent-session-repository.ts';
import {
  createPostgresV21AdultSessionRuntime,
  createV21AdultSessionRuntime,
} from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import type { V21AdultSessionRepository } from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { createPostgresV21AdultSessionRepository } from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import {
  completePasswordReset,
  createAccountUser,
  createSession,
  getSessionUserByKey,
  requestPasswordReset,
} from '../../../packages/domain/src/index.ts';

type SignupProjection = {
  adult_id: string;
  human_account_id: string;
  household_id: string;
  access_state: 'free' | 'inactive';
  access_branch:
    'immediate_free' | 'inactive_checkout' | 'inactive_identity_review' | 'inactive_support';
  checkout_required: boolean;
  checkout_blocked_by_identity_review: boolean;
};

type SignupResult = {
  response: Response;
  body: Record<string, unknown>;
  hostCookie: string;
  browserToken: string;
  projection: SignupProjection;
};

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let now: Date;
let repositoryUnavailable: boolean;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    AUTH_CSRF_SECRET: 'v21-family-parent-composition-test-secret',
    ONE_TIME_LIFECYCLE_DELIVERY_KEY:
      'v21-family-parent-composition-lifecycle-delivery-key-for-tests',
    ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-13T16:24:00.000Z',
    PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: 'test-only-parent-student-service-v1',
    PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE:
      'test-only-evidence/parent-student-service-v1',
  });
  const memoryPool = createMemoryPool();
  await runMigrations(memoryPool);
  pool = pgMemCompatiblePool(memoryPool);
  distDir = await mkdtemp(path.join(tmpdir(), 'v21-family-parent-composition-'));
  await mkdir(path.join(distDir, 'app'), { recursive: true });
  await writeFile(
    path.join(distDir, 'app', 'parent.html'),
    '<!doctype html><html><body>V21_PARENT_SHELL</body></html>',
    'utf8',
  );
  now = new Date('2026-09-13T16:23:59.000Z');
  repositoryUnavailable = false;
  const repository = createDbBackedTestAdultSessionRepository(pool);
  const v21AdultSessionRuntime = createV21AdultSessionRuntime({
    repository: availabilityGuardedRepository(repository, () => repositoryUnavailable),
    hmacSecret: config.authCsrfSecret,
    clock: () => new Date(now),
  });
  const app = createApp({
    config,
    pool,
    distDir,
    clock: () => new Date(now),
    v21AdultSessionRuntime,
  });
  server = await new Promise<typeof server>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (pool) await pool.end();
  if (distDir) await rm(distDir, { recursive: true, force: true });
});

function availabilityGuardedRepository(
  repository: V21AdultSessionRepository,
  unavailable: () => boolean,
): V21AdultSessionRepository {
  const guard =
    <Input, Output>(run: (input: Input) => Promise<Output>) =>
    async (input: Input) => {
      if (unavailable()) throw new Error('simulated adult-session repository outage');
      return run(input);
    };
  return {
    create: guard(repository.create),
    resolve: guard(repository.resolve),
    revoke: guard(repository.revoke),
    findLoginIdentity: guard(repository.findLoginIdentity),
    upgradeCredentialPasswordHash: guard(repository.upgradeCredentialPasswordHash),
  };
}

describe('I36 central Family-signup and Parent-session composition', () => {
  it('replaces malformed host and legacy cookies after valid credentials', async () => {
    await submitFamily('stale-cookie-parent@example.test', 'Stale', 'Cookie');
    const loginPage = await fetch(`${baseUrl}/login`);
    const loginCookie = loginPage.headers
      .getSetCookie()
      .find((value) => value.startsWith('otcrm_csrf='))
      ?.split(';')[0];
    const loginCsrf = /name="csrf_token" value="([^"]+)"/u.exec(await loginPage.text())?.[1];
    if (!loginCookie || !loginCsrf) throw new Error('missing login CSRF binding');

    const recovered = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `__Host-onetime-session=malformed; otcrm_session=malformed; ${loginCookie}`,
      },
      body: JSON.stringify({
        identifier: 'stale-cookie-parent@example.test',
        password: 'correct horse battery staple',
        csrf_token: loginCsrf,
      }),
    });
    expect(recovered.status).toBe(200);
    await expect(recovered.json()).resolves.toMatchObject({
      success: true,
      session_model: 'v21',
      return_to: '/app/parent',
    });
    expect(recovered.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('__Host-onetime-session='),
        expect.stringContaining('otcrm_session='),
      ]),
    );
  });

  it('recovers a canonical v2.1 Parent credential once and revokes prior sessions', async () => {
    const signup = await submitFamily(
      'recoverable-v21-parent@example.test',
      'Recoverable',
      'Parent',
    );
    const issued = await requestPasswordReset({
      pool,
      config,
      payload: {
        idempotency_key: 'v21-parent-recovery-request-0001',
        email: 'recoverable-v21-parent@example.test',
      },
      now,
      includeLocalProofToken: true,
    });
    if (!('token_for_local_proof' in issued) || !issued.token_for_local_proof) {
      throw new Error('missing local v2.1 recovery proof token');
    }

    const completed = await completePasswordReset({
      pool,
      config,
      payload: {
        token: issued.token_for_local_proof,
        password: 'replacement horse battery staple',
        password_confirmation: 'replacement horse battery staple',
      },
      now: new Date(now.getTime() + 1_000),
    });
    expect(completed).toMatchObject({
      user_key: signup.projection.human_account_id,
      role: 'parent',
      status: 'active',
      sessions_invalidated: 1,
    });
    const recovered = await pool.query(
      `SELECT account.security_version,
              credential.credential_version,
              credential.credential_state,
              session.revoked_at,
              session.revoke_reason
         FROM onetime.v21_human_accounts AS account
         JOIN onetime.v21_adult_credentials AS credential
           ON credential.human_account_id = account.human_account_id
         JOIN onetime.v21_adult_sessions AS session
           ON session.human_account_id = account.human_account_id
        WHERE account.human_account_id = $1`,
      [signup.projection.human_account_id],
    );
    expect(recovered.rows[0]).toMatchObject({
      security_version: 2,
      credential_version: 2,
      credential_state: 'active',
      revoked_at: expect.anything(),
      revoke_reason: 'password_reset',
    });
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: {
          token: issued.token_for_local_proof,
          password: 'another replacement password value',
          password_confirmation: 'another replacement password value',
        },
        now: new Date(now.getTime() + 2_000),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
  });

  it('binds real P08 signup to one fail-closed v2.1 Parent middleware runtime', async () => {
    const preExpiry = await submitFamily('pre-expiry-parent@example.test', 'Pre', 'Expiry');

    expect(preExpiry.response.status).toBe(201);
    expect(preExpiry.body).toMatchObject({
      success: true,
      code: 'FAMILY_SIGNUP_COMPLETE',
      local_access_state: 'free',
      session_established: true,
      next_action: 'parent_overview',
      continue_to: 'https://app.onetimeonetime.com/app/parent',
      provider_effects_completed_inline: 0,
    });
    expect(preExpiry.projection.access_state).toBe('free');
    expect(preExpiry.projection).toMatchObject({
      access_branch: 'immediate_free',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
    });
    await expectParentShell(preExpiry.hostCookie, '/app/parent', 200);
    await expectParentShell(preExpiry.hostCookie, '/select-household', 200);
    const household = await fetch(`${baseUrl}/api/app/parent/household`, {
      headers: { cookie: preExpiry.hostCookie },
    });
    expect(household.status, await household.clone().text()).toBe(200);
    await expect(household.json()).resolves.toMatchObject({
      success: true,
      data: {
        snapshot: {
          contract_version: '1.2.0',
          household_id: preExpiry.projection.household_id,
          access_state: 'free',
          student_allowance: 3,
          active_student_count: 0,
          can_manage_students: true,
          students: [],
        },
        csrf_token: expect.stringMatching(/^c1\./u),
      },
    });
    await expectDigestOnlySessionPersistence(preExpiry);

    now = new Date('2026-09-13T16:24:00.000Z');
    const cutoff = await submitFamily('cutoff-parent@example.test', 'At', 'Cutoff');

    expect(cutoff.response.status).toBe(202);
    expect(cutoff.body).toMatchObject({
      success: true,
      code: 'SIGNUP_COMMITTED_SUPPORT_REQUIRED',
      local_access_state: 'inactive',
      checkout_required: false,
      checkout_handoff_state: 'not_configured',
      session_established: true,
      next_action: 'support',
      checkout_provider: 'highlevel',
      direct_stripe_mutation_by_one_time: false,
      provider_effects_completed_inline: 0,
    });
    expect(cutoff.body).not.toHaveProperty('financial_provider');
    expect(cutoff.projection).toMatchObject({
      access_state: 'inactive',
      access_branch: 'inactive_support',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
    });
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 200);
    await expectParentShell(cutoff.hostCookie, '/select-household', 200);
    await expectParentShell(cutoff.hostCookie, '/app/parent/students', 403);
    await expectDigestOnlySessionPersistence(cutoff);

    const cutoffSession = await sessionRow(cutoff.projection.human_account_id);
    const originalIdleExpiry = cutoffSession.idle_expires_at;

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET active_household_id = $1
        WHERE session_id = $2`,
      [preExpiry.projection.household_id, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET active_household_id = $1
        WHERE session_id = $2`,
      [cutoff.projection.household_id, cutoffSession.session_id],
    );

    await pool.query(
      `UPDATE onetime.v21_human_accounts
          SET security_version = security_version + 1
        WHERE human_account_id = $1`,
      [cutoff.projection.human_account_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_human_accounts
          SET security_version = 1
        WHERE human_account_id = $1`,
      [cutoff.projection.human_account_id],
    );

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET idle_expires_at = $1
        WHERE session_id = $2`,
      [now, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET idle_expires_at = $1
        WHERE session_id = $2`,
      [originalIdleExpiry, cutoffSession.session_id],
    );

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET revoked_at = $1,
              revoke_reason = 'explicit_revocation'
        WHERE session_id = $2`,
      [now, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);

    const legacyUserKey = await createAccountUser({
      pool,
      config,
      email: 'legacy-parent@example.test',
      password: 'LegacyParentPassword!234',
      displayName: 'Legacy Parent',
      role: 'parent',
    });
    const legacyUser = await getSessionUserByKey({ pool, config, userKey: legacyUserKey });
    if (!legacyUser) throw new Error('missing legacy Parent fixture');
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('legacy_composition_household', $1, $2, 'Legacy composition household')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES ('legacy_composition_relationship', $1, $2, 'legacy_composition_household', $3,
         'Parent', 'primary_guardian')`,
      [config.accountKey, config.productKey, legacyUserKey],
    );
    const legacySession = await createSession({
      pool,
      config,
      user: legacyUser,
      assuranceMethod: 'password',
    });
    const legacyCookie = `otcrm_session=${encodeURIComponent(legacySession.session_token)}`;
    await expectParentShell(legacyCookie, '/app/parent', 200);
    await expectParentShell(
      `__Host-onetime-session=malformed; ${legacyCookie}`,
      '/app/parent',
      403,
    );
  });

  it('keeps outage cookies retryable and clears only after exact CSRF-bound logout', async () => {
    const signup = await submitFamily(
      'retryable-session-parent@example.test',
      'Retryable',
      'Parent',
    );
    const firstBootstrapResponse = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
      headers: { cookie: signup.hostCookie },
    });
    const firstBootstrap = (await firstBootstrapResponse.json()) as { csrf_token: string };
    expect(firstBootstrapResponse.status).toBe(200);
    const outageLoginBinding = await loginCsrfBinding();

    repositoryUnavailable = true;
    const unavailableBootstrap = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
      headers: { cookie: signup.hostCookie },
    });
    expect(unavailableBootstrap.status).toBe(503);
    expect(unavailableBootstrap.headers.getSetCookie()).toEqual([]);
    const unavailableShell = await fetch(`${baseUrl}/app/parent`, {
      headers: { cookie: signup.hostCookie },
    });
    expect(unavailableShell.status).toBe(503);
    expect(unavailableShell.headers.getSetCookie()).toEqual([]);
    const unavailableLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${signup.hostCookie}; ${outageLoginBinding.cookie}`,
      },
      body: JSON.stringify({
        identifier: 'retryable-session-parent@example.test',
        password: 'correct horse battery staple',
        csrf_token: outageLoginBinding.token,
      }),
    });
    expect(unavailableLogin.status).toBe(503);
    expect(unavailableLogin.headers.getSetCookie()).toEqual([]);
    repositoryUnavailable = false;

    const recoveredBootstrapResponse = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
      headers: { cookie: signup.hostCookie },
    });
    const recoveredBootstrap = (await recoveredBootstrapResponse.json()) as { csrf_token: string };
    expect(recoveredBootstrapResponse.status).toBe(200);

    const invalidCsrfLogout = await fetch(`${baseUrl}/api/v2.1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: signup.hostCookie,
        'x-csrf-token': `${recoveredBootstrap.csrf_token.slice(0, -1)}x`,
      },
    });
    expect(invalidCsrfLogout.status).toBe(403);
    expect(invalidCsrfLogout.headers.getSetCookie()).toEqual([]);
    const stillLive = await pool.query(
      `SELECT revoked_at
         FROM onetime.v21_adult_sessions
        WHERE human_account_id = $1`,
      [signup.projection.human_account_id],
    );
    expect(stillLive.rows[0]?.revoked_at).toBeNull();

    const retryBootstrapResponse = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
      headers: { cookie: signup.hostCookie },
    });
    const retryBootstrap = (await retryBootstrapResponse.json()) as { csrf_token: string };
    expect(retryBootstrapResponse.status).toBe(200);
    const validLogout = await fetch(`${baseUrl}/api/v2.1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: signup.hostCookie,
        'x-csrf-token': retryBootstrap.csrf_token,
        'user-agent': 'I36 redaction proof',
      },
    });
    expect(validLogout.status).toBe(200);
    expect(validLogout.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('otcrm_session='),
        expect.stringContaining('otcrm_csrf='),
        expect.stringContaining('__Host-onetime-session='),
      ]),
    );
    const audit = await pool.query(
      `SELECT user_key, event_type, success, reason, ip_hash, user_agent_hash, metadata
         FROM onetime.auth_audit_events
        WHERE event_type = 'logout_succeeded'
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    expect(audit.rows[0]).toMatchObject({
      user_key: null,
      event_type: 'logout_succeeded',
      success: true,
      reason: null,
      ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      user_agent_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      metadata: { session_model: 'v21' },
    });
    expect(JSON.stringify(audit.rows[0])).not.toContain('I36 redaction proof');
    expect(JSON.stringify(audit.rows[0])).not.toContain(firstBootstrap.csrf_token);
    expect(JSON.stringify(audit.rows[0])).not.toContain(signup.browserToken);
  });

  it('retains only invalid-credential reservations and releases successful or ineligible attempts', async () => {
    const denied = await submitFamily('budget-denied-parent@example.test', 'Budget', 'Denied');
    const loginBinding = await loginCsrfBinding();
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: loginBinding.cookie },
          body: JSON.stringify({
            identifier: 'budget-denied-parent@example.test',
            password: 'wrong password value',
            csrf_token: loginBinding.token,
          }),
        }),
      ),
    );
    expect(attempts.filter((response) => response.status === 401)).toHaveLength(5);
    expect(attempts.filter((response) => response.status === 429)).toHaveLength(1);
    await expectLoginBudgetCounts([5]);

    const accepted = await submitFamily('budget-success-parent@example.test', 'Budget', 'Success');
    const acceptedBinding = await loginCsrfBinding();
    const acceptedLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: acceptedBinding.cookie },
      body: JSON.stringify({
        identifier: 'budget-success-parent@example.test',
        password: 'correct horse battery staple',
        csrf_token: acceptedBinding.token,
      }),
    });
    expect(acceptedLogin.status).toBe(200);
    await expectLoginBudgetCounts([0, 5]);

    await pool.query(
      `UPDATE onetime.v21_human_accounts
          SET state = 'archived',
              archived_at = now()
        WHERE human_account_id = $1`,
      [accepted.projection.human_account_id],
    );
    const archivedBinding = await loginCsrfBinding();
    const archivedLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: archivedBinding.cookie },
      body: JSON.stringify({
        identifier: 'budget-success-parent@example.test',
        password: 'correct horse battery staple',
        csrf_token: archivedBinding.token,
      }),
    });
    expect(archivedLogin.status).toBe(401);
    await expectLoginBudgetCounts([0, 5]);

    expect(denied.projection.human_account_id).not.toBe(accepted.projection.human_account_id);
  });
});

async function loginCsrfBinding() {
  const loginPage = await fetch(`${baseUrl}/login`);
  const cookie = loginPage.headers
    .getSetCookie()
    .find((value) => value.startsWith('otcrm_csrf='))
    ?.split(';')[0];
  const html = await loginPage.text();
  const token = /name="csrf_token" value="([^"]+)"/u.exec(html)?.[1];
  if (!cookie || !token) throw new Error('missing login CSRF binding');
  return { cookie, token };
}

async function expectLoginBudgetCounts(expectedAccountIpCounts: number[]) {
  const result = await pool.query(
    `SELECT scope, count
       FROM onetime.rate_limit_buckets
      WHERE scope IN ('login_account_ip', 'login_ip', 'login_account_product', 'login_global')
      ORDER BY scope, count`,
  );
  const byScope = new Map<string, number[]>();
  for (const row of result.rows) {
    const counts = byScope.get(String(row.scope)) ?? [];
    counts.push(Number(row.count));
    byScope.set(String(row.scope), counts);
  }
  expect(byScope.get('login_account_ip')).toEqual(expectedAccountIpCounts);
  expect(byScope.get('login_ip')).toEqual([5]);
  expect(byScope.get('login_account_product')).toEqual([5]);
  expect(byScope.get('login_global')).toEqual([5]);
}

const nativeDatabaseUrl = process.env.I36_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.I36_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

describe.runIf(nativeProofEnabled)(
  'I36 full-migration native PostgreSQL Parent-session composition',
  () => {
    it('uses the production repository/runtime for signup, bootstrap, logout, login, cutoff, and invalid-cookie recovery', async () => {
      const nativePool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 2 });
      let nativeServer: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
      let nativeDistDir: string | undefined;
      let ownsNativeSchema = false;
      try {
        const database = await nativePool.query(
          `SELECT current_database() AS database_name,
                    current_setting('server_version') AS server_version`,
        );
        expect(database.rows[0]?.database_name).toBe('ot_i36');
        expect(String(database.rows[0]?.server_version)).toMatch(/^18\./u);
        const blank = await nativePool.query(
          `SELECT count(*)::integer AS table_count
               FROM information_schema.tables
              WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
        );
        expect(Number(blank.rows[0]?.table_count)).toBe(0);
        const unexpectedSchemas = await nativePool.query(
          `SELECT schema_name
             FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public', 'pg_toast')
            ORDER BY schema_name`,
        );
        expect(unexpectedSchemas.rows).toEqual([]);

        ownsNativeSchema = true;
        const migrations = await runMigrations(nativePool);
        expect(migrations.length).toBeGreaterThan(0);
        expect(
          migrations.some(
            (migration) =>
              migration.id === '2248_v21_family_signup' && migration.status === 'applied',
          ),
        ).toBe(true);

        const nativeConfig = loadConfig({
          NODE_ENV: 'test',
          PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
          APP_VERSION: 'test',
          COMMIT_SHA: 'test',
          OUTBOX_TRANSPORT_MODE: 'sink',
          AUTH_CSRF_SECRET: 'i36-native-parent-session-test-secret',
          ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-13T16:24:00.000Z',
        });
        let nativeNow = new Date('2026-09-13T16:23:59.000Z');
        nativeDistDir = await mkdtemp(path.join(tmpdir(), 'i36-native-parent-session-'));
        await mkdir(path.join(nativeDistDir, 'app'), { recursive: true });
        await writeFile(
          path.join(nativeDistDir, 'app', 'parent.html'),
          '<!doctype html><html><body>I36_NATIVE_PARENT_SHELL</body></html>',
          'utf8',
        );
        const productionRuntime = createPostgresV21AdultSessionRuntime({
          db: nativePool,
          hmacSecret: nativeConfig.authCsrfSecret,
          clock: () => new Date(nativeNow),
        });
        const nativeApp = createApp({
          config: nativeConfig,
          pool: nativePool,
          distDir: nativeDistDir,
          clock: () => new Date(nativeNow),
          v21AdultSessionRuntime: productionRuntime,
        });
        const listeningServer = await new Promise<NonNullable<typeof nativeServer>>(
          (resolve, reject) => {
            const listening = nativeApp.listen(0, '127.0.0.1', (error?: Error) => {
              if (error) reject(error);
              else resolve(listening);
            });
          },
        );
        nativeServer = listeningServer;
        const nativeAddress = listeningServer.address();
        if (typeof nativeAddress !== 'object' || !nativeAddress) {
          throw new Error('missing native test server address');
        }
        const nativeBaseUrl = `http://127.0.0.1:${nativeAddress.port}`;

        const submitNativeFamily = async (email: string) => {
          const bootstrapResponse = await fetch(`${nativeBaseUrl}/api/v1/signup/family/bootstrap`);
          const bootstrap = (await bootstrapResponse.json()) as {
            idempotency_key: string;
            csrf_token: string;
          };
          const signupCsrfCookie = bootstrapResponse.headers
            .getSetCookie()
            .find((value) => value.startsWith('ot_family_signup_csrf='))
            ?.split(';')[0];
          if (!signupCsrfCookie) throw new Error('missing native signup CSRF cookie');
          const response = await fetch(`${nativeBaseUrl}/api/v1/signup/family`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              cookie: signupCsrfCookie,
              origin: nativeConfig.publicBaseUrl,
              'x-csrf-token': bootstrap.csrf_token,
            },
            body: JSON.stringify({
              classification: 'family',
              idempotency_key: bootstrap.idempotency_key,
              first_name: 'Native',
              last_name: 'Parent',
              email,
              password: 'correct horse battery staple',
              password_confirmation: 'correct horse battery staple',
              timezone: 'Asia/Jerusalem',
              terms_accepted: true,
              privacy_accepted: true,
              general_marketing_consent: false,
              parent_newsletter_consent: false,
            }),
          });
          const body = (await response.json()) as Record<string, unknown>;
          const hostCookie = response.headers
            .getSetCookie()
            .find((value) => value.startsWith('__Host-onetime-session='))
            ?.split(';')[0];
          if (!hostCookie) throw new Error(`missing native host cookie: ${JSON.stringify(body)}`);
          return { response, body, hostCookie };
        };

        const signup = await submitNativeFamily('native-parent@example.test');
        expect(signup.response.status).toBe(201);
        expect(signup.body).toMatchObject({
          session_established: true,
          local_access_state: 'free',
        });

        const firstBootstrapResponse = await fetch(`${nativeBaseUrl}/api/v2.1/auth/session`, {
          headers: { cookie: signup.hostCookie },
        });
        const firstBootstrap = (await firstBootstrapResponse.json()) as {
          session_model: string;
          csrf_token: string;
          parent_context: { owned_household_count: number };
        };
        expect(firstBootstrapResponse.status).toBe(200);
        expect(firstBootstrap).toMatchObject({
          session_model: 'v21',
          parent_context: { owned_household_count: 1 },
        });
        const secondBootstrapResponse = await fetch(`${nativeBaseUrl}/api/v2.1/auth/session`, {
          headers: { cookie: signup.hostCookie },
        });
        const secondBootstrap = (await secondBootstrapResponse.json()) as {
          csrf_token: string;
        };
        expect(secondBootstrap.csrf_token).not.toBe(firstBootstrap.csrf_token);

        const selection = await fetch(`${nativeBaseUrl}/select-household`, {
          redirect: 'manual',
          headers: { cookie: signup.hostCookie },
        });
        expect(selection.status).toBe(302);
        expect(selection.headers.get('location')).toBe('/app/parent');

        const logout = await fetch(`${nativeBaseUrl}/api/v2.1/auth/logout`, {
          method: 'POST',
          headers: {
            cookie: signup.hostCookie,
            'x-csrf-token': secondBootstrap.csrf_token,
          },
        });
        expect(logout.status).toBe(200);
        expect(logout.headers.getSetCookie()).toEqual(
          expect.arrayContaining([
            expect.stringContaining('otcrm_session='),
            expect.stringContaining('otcrm_csrf='),
            expect.stringContaining('__Host-onetime-session='),
          ]),
        );
        const revoked = await nativePool.query(
          `SELECT revoke_reason, revoked_at
               FROM onetime.v21_adult_sessions
              ORDER BY created_at
              LIMIT 1`,
        );
        expect(revoked.rows[0]).toMatchObject({
          revoke_reason: 'adult_logout',
          revoked_at: expect.any(Date),
        });
        const logoutAudit = await nativePool.query(
          `SELECT user_key, event_type, success, reason, ip_hash, user_agent_hash, metadata
             FROM onetime.auth_audit_events
            WHERE event_type = 'logout_succeeded'
            ORDER BY created_at DESC
            LIMIT 1`,
        );
        expect(logoutAudit.rows[0]).toMatchObject({
          user_key: null,
          event_type: 'logout_succeeded',
          success: true,
          reason: null,
          ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          user_agent_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          metadata: { session_model: 'v21' },
        });
        const nativeBrowserToken = decodeURIComponent(
          signup.hostCookie.slice(signup.hostCookie.indexOf('=') + 1),
        );
        expect(JSON.stringify(logoutAudit.rows[0])).not.toContain(nativeBrowserToken);
        expect(JSON.stringify(logoutAudit.rows[0])).not.toContain(secondBootstrap.csrf_token);
        const revokedReplay = await fetch(`${nativeBaseUrl}/api/v2.1/auth/session`, {
          headers: { cookie: signup.hostCookie },
        });
        expect(revokedReplay.status).toBe(401);
        expect(revokedReplay.headers.getSetCookie()).toEqual(
          expect.arrayContaining([
            expect.stringContaining('__Host-onetime-session='),
            expect.stringContaining('otcrm_session='),
          ]),
        );

        const loginPage = await fetch(`${nativeBaseUrl}/login`);
        const loginCookie = loginPage.headers
          .getSetCookie()
          .find((value) => value.startsWith('otcrm_csrf='))
          ?.split(';')[0];
        const loginHtml = await loginPage.text();
        const loginCsrf = /name="csrf_token" value="([^"]+)"/u.exec(loginHtml)?.[1];
        if (!loginCookie || !loginCsrf) throw new Error('missing native login CSRF binding');
        const deniedLogin = await fetch(`${nativeBaseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: loginCookie },
          body: JSON.stringify({
            identifier: 'native-parent@example.test',
            password: 'wrong password value',
            csrf_token: loginCsrf,
          }),
        });
        expect(deniedLogin.status).toBe(401);
        await expect(deniedLogin.json()).resolves.toMatchObject({
          code: 'INVALID_CREDENTIALS',
        });
        const acceptedLogin = await fetch(`${nativeBaseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: loginCookie },
          body: JSON.stringify({
            identifier: 'native-parent@example.test',
            password: 'correct horse battery staple',
            csrf_token: loginCsrf,
            return_to: '/app/parent/account',
          }),
        });
        const acceptedLoginBody = (await acceptedLogin.json()) as Record<string, unknown>;
        expect(acceptedLogin.status).toBe(200);
        expect(acceptedLoginBody).toMatchObject({
          success: true,
          session_model: 'v21',
          return_to: '/app/parent/account',
        });
        const acceptedHostCookie = acceptedLogin.headers
          .getSetCookie()
          .find(
            (value) => value.startsWith('__Host-onetime-session=') && !value.includes('Max-Age=0'),
          )
          ?.split(';')[0];
        if (!acceptedHostCookie) throw new Error('missing re-login host cookie');

        const legacyUserKey = await createAccountUser({
          pool: nativePool,
          config: nativeConfig,
          email: 'native-legacy-parent@example.test',
          password: 'LegacyParentPassword!234',
          displayName: 'Native Legacy Parent',
          role: 'parent',
        });
        const legacyUser = await getSessionUserByKey({
          pool: nativePool,
          config: nativeConfig,
          userKey: legacyUserKey,
        });
        if (!legacyUser) throw new Error('missing native legacy Parent');
        const legacySession = await createSession({
          pool: nativePool,
          config: nativeConfig,
          user: legacyUser,
          assuranceMethod: 'password',
        });
        const mixedBootstrapResponse = await fetch(`${nativeBaseUrl}/api/v2.1/auth/session`, {
          headers: {
            cookie: `${acceptedHostCookie}; otcrm_session=${encodeURIComponent(
              legacySession.session_token,
            )}`,
          },
        });
        const mixedBootstrap = (await mixedBootstrapResponse.json()) as {
          csrf_token: string;
        };
        const mixedLogout = await fetch(`${nativeBaseUrl}/api/v2.1/auth/logout`, {
          method: 'POST',
          headers: {
            cookie: `${acceptedHostCookie}; otcrm_session=${encodeURIComponent(
              legacySession.session_token,
            )}`,
            'x-csrf-token': mixedBootstrap.csrf_token,
          },
        });
        expect(mixedLogout.status).toBe(200);
        const legacyReadback = await nativePool.query(
          `SELECT revoked_at
               FROM onetime.user_sessions
              WHERE session_key = $1`,
          [legacySession.session_key],
        );
        expect(legacyReadback.rows[0]?.revoked_at).toBeInstanceOf(Date);
        const invalidRecovery = await fetch(`${nativeBaseUrl}/api/v1/auth/session`, {
          headers: {
            cookie: `__Host-onetime-session=malformed; otcrm_session=${encodeURIComponent(
              legacySession.session_token,
            )}`,
          },
        });
        expect(invalidRecovery.status).toBe(401);
        expect(invalidRecovery.headers.getSetCookie()).toEqual(
          expect.arrayContaining([
            expect.stringContaining('__Host-onetime-session='),
            expect.stringContaining('otcrm_session='),
          ]),
        );
        const recoveredLogin = await fetch(`${nativeBaseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `__Host-onetime-session=malformed; otcrm_session=${encodeURIComponent(
              legacySession.session_token,
            )}; ${loginCookie}`,
          },
          body: JSON.stringify({
            identifier: 'native-parent@example.test',
            password: 'correct horse battery staple',
            csrf_token: loginCsrf,
          }),
        });
        expect(recoveredLogin.status).toBe(200);
        await expect(recoveredLogin.json()).resolves.toMatchObject({
          success: true,
          session_model: 'v21',
        });
        expect(recoveredLogin.headers.getSetCookie()).toEqual(
          expect.arrayContaining([
            expect.stringContaining('__Host-onetime-session='),
            expect.stringContaining('otcrm_session='),
          ]),
        );

        const cardinality = await submitNativeFamily('native-cardinality-parent@example.test');
        const cardinalityBinding = await nativePool.query(
          `SELECT adult.adult_id,
                  account.human_account_id,
                  account.security_version,
                  household.household_id
             FROM onetime.v21_adult_identities AS adult
             JOIN onetime.v21_human_accounts AS account
               ON account.adult_id = adult.adult_id
             JOIN onetime.v21_households AS household
               ON household.owner_adult_id = adult.adult_id
              AND household.owner_human_account_id = account.human_account_id
            WHERE adult.normalized_email = $1`,
          ['native-cardinality-parent@example.test'],
        );
        const cardinalityRow = cardinalityBinding.rows[0] as
          | {
              adult_id: string;
              human_account_id: string;
              security_version: number;
              household_id: string;
            }
          | undefined;
        if (!cardinalityRow) throw new Error('missing native cardinality binding');
        await nativePool.query(
          `INSERT INTO onetime.v21_households
             (household_id, owner_adult_id, owner_human_account_id, classification,
              state, seat_limit, active_seat_count, access_aggregate_ref,
              product_key, runtime_tier, verification_environment_id, created_at, updated_at)
           VALUES
             ('native_missing_access_household', $1, $2, 'family',
              'active', 3, 0, 'native_missing_access_household',
              'one_time_mishnayos', 'isolated_staging', 'ci', $3, $3)`,
          [cardinalityRow.adult_id, cardinalityRow.human_account_id, nativeNow],
        );
        const cardinalityReadback = await fetch(`${nativeBaseUrl}/api/v2.1/auth/session`, {
          headers: { cookie: cardinality.hostCookie },
        });
        expect(cardinalityReadback.status).toBe(401);
        const productionRepository = createPostgresV21AdultSessionRepository(nativePool);
        await expect(
          productionRepository.create({
            sessionId: 'native_cardinality_race_session',
            adultId: cardinalityRow.adult_id,
            humanAccountId: cardinalityRow.human_account_id,
            householdId: cardinalityRow.household_id,
            runtimeTier: 'isolated_staging',
            verificationEnvironmentId: 'ci',
            securityVersion: Number(cardinalityRow.security_version),
            accessTokenDigest: 'a'.repeat(64),
            refreshTokenDigest: 'b'.repeat(64),
            issuedAt: nativeNow,
          }),
        ).rejects.toMatchObject({ code: 'session_not_created' });

        nativeNow = new Date('2026-09-13T16:24:00.000Z');
        const cutoff = await submitNativeFamily('native-cutoff-parent@example.test');
        expect(cutoff.response.status).toBe(202);
        expect(cutoff.body).toMatchObject({
          local_access_state: 'inactive',
          session_established: true,
        });

        const storedCredentials = await nativePool.query(
          `SELECT count(*)::integer AS credential_count,
                    bool_and(password_hash NOT LIKE '%correct horse%') AS plaintext_absent
               FROM onetime.v21_adult_credentials`,
        );
        expect(storedCredentials.rows[0]).toEqual({
          credential_count: 3,
          plaintext_absent: true,
        });
      } finally {
        if (nativeServer) {
          await new Promise<void>((resolve) => nativeServer!.close(() => resolve()));
        }
        if (nativeDistDir) await rm(nativeDistDir, { recursive: true, force: true });
        if (ownsNativeSchema) {
          await nativePool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
        }
        await nativePool.end();
      }
    }, 60_000);
  },
);

async function submitFamily(
  email: string,
  firstName: string,
  lastName: string,
): Promise<SignupResult> {
  const bootstrapResponse = await fetch(`${baseUrl}/api/v1/signup/family/bootstrap`);
  expect(bootstrapResponse.status).toBe(200);
  const bootstrap = (await bootstrapResponse.json()) as {
    idempotency_key: string;
    csrf_token: string;
    writes_allowed: boolean;
  };
  expect(bootstrap.writes_allowed).toBe(true);
  const csrfCookie = bootstrapResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith('ot_family_signup_csrf='))
    ?.split(';')[0];
  if (!csrfCookie) throw new Error('missing Family-signup CSRF cookie');

  const response = await fetch(`${baseUrl}/api/v1/signup/family`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: csrfCookie,
      origin: config.publicBaseUrl,
      'x-csrf-token': bootstrap.csrf_token,
    },
    body: JSON.stringify({
      classification: 'family',
      idempotency_key: bootstrap.idempotency_key,
      first_name: firstName,
      last_name: lastName,
      email,
      password: 'correct horse battery staple',
      password_confirmation: 'correct horse battery staple',
      timezone: 'Asia/Jerusalem',
      terms_accepted: true,
      privacy_accepted: true,
      general_marketing_consent: true,
      parent_newsletter_consent: true,
    }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  expect(JSON.stringify(body)).not.toContain(email);
  const hostCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Host-onetime-session='))
    ?.split(';')[0];
  if (!hostCookie) throw new Error(`missing v2.1 Parent session cookie: ${JSON.stringify(body)}`);
  const browserToken = decodeURIComponent(hostCookie.slice(hostCookie.indexOf('=') + 1));
  const projection = await signupProjection(email);
  return { response, body, hostCookie, browserToken, projection };
}

async function signupProjection(normalizedEmail: string): Promise<SignupProjection> {
  const result = await pool.query(
    `SELECT adult.adult_id,
            account.human_account_id,
            household.household_id,
            access.current_state AS access_state,
            signup_access.access_branch,
            signup_access.checkout_required,
            signup_access.checkout_blocked_by_identity_review
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
       JOIN onetime.v21_households AS household
         ON household.owner_adult_id = adult.adult_id
        AND household.owner_human_account_id = account.human_account_id
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
       JOIN onetime.family_signup_access_projections AS signup_access
         ON signup_access.household_id = household.household_id
        AND signup_access.product = household.product_key
        AND signup_access.runtime_tier = household.runtime_tier
        AND signup_access.verification_environment_id = household.verification_environment_id
       WHERE adult.normalized_email = $1`,
    [normalizedEmail],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`missing signup projection for ${normalizedEmail}`);
  return {
    adult_id: String(row.adult_id),
    human_account_id: String(row.human_account_id),
    household_id: String(row.household_id),
    access_state: String(row.access_state) as SignupProjection['access_state'],
    access_branch: String(row.access_branch) as SignupProjection['access_branch'],
    checkout_required: Boolean(row.checkout_required),
    checkout_blocked_by_identity_review: Boolean(row.checkout_blocked_by_identity_review),
  };
}

async function sessionRow(humanAccountId: string) {
  const result = await pool.query(
    `SELECT session_id,
            active_household_id,
            access_token_digest,
            refresh_token_digest,
            idle_expires_at,
            absolute_expires_at,
            revoked_at
       FROM onetime.v21_adult_sessions
      WHERE human_account_id = $1`,
    [humanAccountId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`missing v2.1 session for ${humanAccountId}`);
  return row;
}

async function expectDigestOnlySessionPersistence(signup: SignupResult) {
  const row = await sessionRow(signup.projection.human_account_id);
  expect(String(row.access_token_digest)).toMatch(/^[a-f0-9]{64}$/u);
  expect(String(row.refresh_token_digest)).toMatch(/^[a-f0-9]{64}$/u);
  expect(row.access_token_digest).not.toBe(row.refresh_token_digest);

  const payloadSegment = signup.browserToken.split('.')[1];
  if (!payloadSegment) throw new Error('missing signed Parent-session payload');
  const claims = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
    access_material: string;
    refresh_material: string;
  };
  const persisted = JSON.stringify(row);
  expect(persisted).not.toContain(signup.browserToken);
  expect(persisted).not.toContain(claims.access_material);
  expect(persisted).not.toContain(claims.refresh_material);
}

async function expectParentShell(cookie: string, route: string, expectedStatus: number) {
  const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
  const body = await response.text();
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('cache-control')).toContain('no-store');
  if (expectedStatus === 200) expect(body).toContain('V21_PARENT_SHELL');
  else expect(body).not.toContain('V21_PARENT_SHELL');
}

function pgMemCompatiblePool(memoryPool: DbPool): DbPool {
  const wrapQuery = <T extends DbPool['query']>(query: T, receiver: object): T => {
    const invoke = query.bind(receiver) as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      const [statement, ...rest] = args;
      const rewritten =
        typeof statement === 'string'
          ? rewritePgMemLockClause(statement)
          : statement &&
              typeof statement === 'object' &&
              'text' in statement &&
              typeof statement.text === 'string'
            ? { ...statement, text: rewritePgMemLockClause(statement.text) }
            : statement;
      const result = invoke(rewritten, ...rest);
      if (result && typeof result === 'object' && 'catch' in result) {
        return result;
      }
      return result;
    }) as T;
  };

  return {
    query: wrapQuery(memoryPool.query, memoryPool),
    connect: (async () => {
      const client = await memoryPool.connect();
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') return wrapQuery(target.query, target);
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: memoryPool.end.bind(memoryPool) as DbPool['end'],
  };
}

function rewritePgMemLockClause(statement: string): string {
  return statement
    .replace('FOR SHARE OF request, receipt', 'FOR SHARE')
    .replace('FOR UPDATE OF household', 'FOR UPDATE');
}
