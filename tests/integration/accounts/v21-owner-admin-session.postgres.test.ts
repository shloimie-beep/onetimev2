import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createPostgresV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { runMigrations } from '../../../packages/db/src/index.ts';
import { createPostgresV21AdultSessionRepository } from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { hashAuthPassword } from '../../../packages/domain/src/auth/policy.ts';

const nativeDatabaseUrl = process.env.OT_P0_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.OT_P0_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

describe.runIf(nativeProofEnabled)('OT-P0 native PostgreSQL owner Admin session', () => {
  it('defaults a dual-role owner to Admin and parameterizes readback and cleanup', async () => {
    const pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 2 });
    let ownsNativeSchema = false;
    let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
    let distDir: string | undefined;
    try {
      const database = await pool.query(
        `SELECT current_database() AS database_name,
                current_setting('server_version') AS server_version`,
      );
      expect(database.rows[0]?.database_name).toBe('ot_p0_owner_session');
      expect(Number.parseInt(String(database.rows[0]?.server_version), 10)).toBeGreaterThanOrEqual(
        16,
      );
      const blank = await pool.query(
        `SELECT count(*)::integer AS table_count
           FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
      );
      expect(blank.rows[0]).toEqual({ table_count: 0 });

      ownsNativeSchema = true;
      await runMigrations(pool);

      const now = new Date('2026-08-09T12:00:00.000Z');
      const password = 'native dual role owner password';
      await seedDualRoleOwner(pool, now, password);

      const runtime = createPostgresV21AdultSessionRuntime({
        db: pool,
        hmacSecret: 'ot-p0-native-admin-session-hmac-secret',
        clock: () => new Date(now),
      });
      const login = await runtime.login({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'ci',
        },
        email: 'native-dual-role-owner@example.test',
        password,
        now,
      });
      expect(login).toMatchObject({
        handled: true,
        authenticated: true,
        active_role: 'admin',
        role_selection_required: false,
        memberships: ['admin', 'parent'],
        household: null,
      });
      if (!login.handled || !login.authenticated) {
        throw new Error('Native dual-role owner login was not issued.');
      }

      const cookieHeader = `__Host-onetime-session=${encodeURIComponent(
        login.browser_session_token,
      )}`;
      const config = loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        APP_VERSION: 'test',
        COMMIT_SHA: 'test',
        OUTBOX_TRANSPORT_MODE: 'sink',
        AUTH_CSRF_SECRET: 'ot-p0-native-admin-session-hmac-secret',
      });
      distDir = await mkdtemp(path.join(tmpdir(), 'ot-p0-native-admin-shell-'));
      await mkdir(path.join(distDir, 'app'), { recursive: true });
      await writeFile(path.join(distDir, 'app', 'crm.html'), '<!doctype html><body>CRM</body>');
      await writeFile(path.join(distDir, 'app', 'live.html'), '<!doctype html><body>LIVE</body>');
      const app = createApp({
        config,
        pool,
        distDir,
        clock: () => new Date(now),
        v21AdultSessionRuntime: runtime,
      });
      const listeningServer = await new Promise<NonNullable<typeof server>>((resolve, reject) => {
        const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
          if (error) reject(error);
          else resolve(listening);
        });
      });
      server = listeningServer;
      const address = listeningServer.address();
      if (typeof address !== 'object' || !address)
        throw new Error('Missing native test server address.');
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const hostCookie = (response: Response) => {
        const cookie = response.headers
          .getSetCookie()
          .findLast((value) => value.startsWith('__Host-onetime-session='))
          ?.split(';')[0];
        if (!cookie) throw new Error('Missing v2.1 host-session cookie.');
        return cookie;
      };

      const adminBootstrapResponse = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
        headers: { cookie: cookieHeader },
      });
      const adminBootstrap = (await adminBootstrapResponse.json()) as {
        session_model: string;
        csrf_token: string;
        account_context: { active_role: string };
      };
      expect(adminBootstrapResponse.status).toBe(200);
      expect(adminBootstrap).toMatchObject({
        session_model: 'v21',
        account_context: { active_role: 'admin' },
      });
      const defaultOffOccurrences = await fetch(`${baseUrl}/api/app/content/ingest/occurrences`, {
        headers: {
          cookie: cookieHeader,
          'x-csrf-token': adminBootstrap.csrf_token,
        },
      });
      expect(defaultOffOccurrences.status).toBe(503);
      await expect(defaultOffOccurrences.json()).resolves.toMatchObject({
        success: false,
        code: 'content_media_default_off',
      });
      const defaultOffUploadSession = await fetch(`${baseUrl}/api/app/content/ingest/sessions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
          'x-csrf-token': adminBootstrap.csrf_token,
        },
        body: JSON.stringify({
          file_name: 'reviewed-canary.mp4',
          mime_type: 'video/mp4',
          byte_count: 1,
        }),
      });
      expect(defaultOffUploadSession.status).toBe(503);
      await expect(defaultOffUploadSession.json()).resolves.toMatchObject({
        success: false,
        code: 'content_media_default_off',
      });
      const missingContentIngestCsrf = await fetch(
        `${baseUrl}/api/app/content/ingest/occurrences`,
        { headers: { cookie: cookieHeader } },
      );
      expect(missingContentIngestCsrf.status).toBe(403);
      await expect(missingContentIngestCsrf.json()).resolves.toMatchObject({
        success: false,
        code: 'content_ingest_csrf_denied',
      });
      const alteredContentIngestCsrf = await fetch(
        `${baseUrl}/api/app/content/ingest/occurrences`,
        {
          headers: {
            cookie: cookieHeader,
            'x-csrf-token': `${adminBootstrap.csrf_token}altered`,
          },
        },
      );
      expect(alteredContentIngestCsrf.status).toBe(403);
      await expect(alteredContentIngestCsrf.json()).resolves.toMatchObject({
        success: false,
        code: 'content_ingest_csrf_denied',
      });
      const adminAssignees = await fetch(`${baseUrl}/api/v1/crm/assignees`, {
        headers: { cookie: cookieHeader },
      });
      expect(adminAssignees.status).toBe(200);
      await expect(adminAssignees.json()).resolves.toMatchObject({ success: true });
      const adminCrmShell = await fetch(`${baseUrl}/app/crm`, {
        redirect: 'manual',
        headers: { cookie: cookieHeader },
      });
      expect(adminCrmShell.status).toBe(200);
      const adminDashboardDeepLink = await fetch(`${baseUrl}/app/dashboard/overview`, {
        redirect: 'manual',
        headers: { cookie: cookieHeader },
      });
      expect(adminDashboardDeepLink.status).toBe(200);
      const adminLiveConsole = await fetch(`${baseUrl}/app/live-console`, {
        redirect: 'manual',
        headers: { cookie: cookieHeader },
      });
      expect(adminLiveConsole.status).toBe(200);
      const adminZoomHost = await fetch(`${baseUrl}/app/live-console/zoom-host`, {
        redirect: 'manual',
        headers: { cookie: cookieHeader },
      });
      expect(adminZoomHost.status).toBe(200);

      const csrfProtectedPost = await fetch(`${baseUrl}/api/v1/admin/classes/series`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
          'x-csrf-token': adminBootstrap.csrf_token,
        },
        body: JSON.stringify({}),
      });
      expect(csrfProtectedPost.status).toBe(400);

      const parentSwitch = await fetch(`${baseUrl}/api/v2.1/account-context/role`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
          origin: config.publicBaseUrl,
          'x-csrf-token': adminBootstrap.csrf_token,
        },
        body: JSON.stringify({ requested_role: 'parent' }),
      });
      const parentSwitchBody = (await parentSwitch.json()) as {
        csrf_token: string;
        active_role: string;
      };
      const parentCookie = hostCookie(parentSwitch);
      expect(parentSwitch.status).toBe(200);
      expect(parentSwitchBody.active_role).toBe('parent');

      const parentBootstrapResponse = await fetch(`${baseUrl}/api/v2.1/auth/session`, {
        headers: { cookie: parentCookie },
      });
      await expect(parentBootstrapResponse.json()).resolves.toMatchObject({
        session_model: 'v21',
        account_context: { active_role: 'parent' },
      });
      const parentAssignees = await fetch(`${baseUrl}/api/v1/crm/assignees`, {
        headers: { cookie: parentCookie },
      });
      expect(parentAssignees.status).toBe(403);
      await expect(parentAssignees.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
      const parentCrmShell = await fetch(`${baseUrl}/app/crm`, {
        redirect: 'manual',
        headers: { cookie: parentCookie },
      });
      expect(parentCrmShell.status).toBe(403);
      const parentZoomHost = await fetch(`${baseUrl}/app/live-console/zoom-host`, {
        redirect: 'manual',
        headers: { cookie: parentCookie },
      });
      expect(parentZoomHost.status).toBe(403);
      const parentPortal = await fetch(`${baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parentCookie },
      });
      expect(parentPortal.status).toBe(403);

      const adminSwitch = await fetch(`${baseUrl}/api/v2.1/account-context/role`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: parentCookie,
          origin: config.publicBaseUrl,
          'x-csrf-token': parentSwitchBody.csrf_token,
        },
        body: JSON.stringify({ requested_role: 'admin' }),
      });
      const adminSwitchBody = (await adminSwitch.json()) as {
        csrf_token: string;
        active_role: string;
      };
      const adminCookie = hostCookie(adminSwitch);
      expect(adminSwitch.status).toBe(200);
      expect(adminSwitchBody.active_role).toBe('admin');
      const restoredAdminAssignees = await fetch(`${baseUrl}/api/v1/crm/assignees`, {
        headers: { cookie: adminCookie },
      });
      expect(restoredAdminAssignees.status).toBe(200);

      await expect(
        runtime.resolveCookieHeader({ cookie_header: adminCookie, now }),
      ).resolves.toMatchObject({
        status: 'resolved',
        context: {
          memberships: ['admin', 'parent'],
          session: { activeRole: 'admin', activeHouseholdId: null },
          household: null,
        },
      });

      const repository = createPostgresV21AdultSessionRepository(pool);
      await expect(
        repository.revoke({
          sessionId: 'native_absent_admin_cleanup',
          adultId: 'adult_native_dual_role_owner',
          humanAccountId: 'account_native_dual_role_owner',
          householdId: null,
          activeRole: 'admin',
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'ci',
          securityVersion: 2,
          tokenKind: 'access',
          tokenDigest: 'c'.repeat(64),
          now,
          reason: 'explicit_revocation',
        }),
      ).resolves.toBe(false);

      await expect(
        runtime.logoutCookieHeader({
          cookie_header: adminCookie,
          csrf_token: adminSwitchBody.csrf_token,
          now: new Date(now.getTime() + 1_000),
        }),
      ).resolves.toEqual({ revoked: true });
      await expect(
        runtime.resolveCookieHeader({
          cookie_header: adminCookie,
          now: new Date(now.getTime() + 1_000),
        }),
      ).resolves.toEqual({ status: 'invalid' });
    } finally {
      const activeServer = server;
      if (activeServer) await new Promise<void>((resolve) => activeServer.close(() => resolve()));
      if (distDir) await rm(distDir, { recursive: true, force: true });
      if (ownsNativeSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
      await pool.end();
    }
  }, 60_000);
});

async function seedDualRoleOwner(pool: pg.Pool, now: Date, password: string) {
  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('adult_native_dual_role_owner', 'native-dual-role-owner@example.test',
             'Native Dual Role Owner', 'active', 1, 'one_time_mishnayos',
             'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('account_native_dual_role_owner', 'adult_native_dual_role_owner', 'active', 2, 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_account_role_memberships
       (human_account_id, role, granted_at, granted_reason, product_key,
        runtime_tier, verification_environment_id)
     VALUES
       ('account_native_dual_role_owner', 'admin', $1, 'native_owner_admin_proof',
        'one_time_mishnayos', 'isolated_staging', 'ci'),
       ('account_native_dual_role_owner', 'parent', $1, 'native_owner_parent_proof',
        'one_time_mishnayos', 'isolated_staging', 'ci')`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_adult_credentials
       (human_account_id, adult_id, password_hash, credential_state, credential_version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('account_native_dual_role_owner', 'adult_native_dual_role_owner', $1,
             'active', 1, 'one_time_mishnayos', 'isolated_staging', 'ci', $2, $2)`,
    [hashAuthPassword(password), now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_households
       (household_id, owner_adult_id, owner_human_account_id, classification,
        state, seat_limit, active_seat_count, access_aggregate_ref, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('household_native_dual_role_owner', 'adult_native_dual_role_owner',
             'account_native_dual_role_owner', 'family', 'active', 3, 0,
             'household_native_dual_role_owner', 1, 'one_time_mishnayos',
             'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.canonical_aggregate_states
       (aggregate_kind, aggregate_key, current_state, version, product_key,
        runtime_tier, verification_environment_id, last_transition_key,
        created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
        last_mutated_by_actor_key, created_at, updated_at)
     VALUES ('access', 'household_native_dual_role_owner', 'active', 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', 'native_owner_access',
             'system', 'ot_p0_native_proof', 'system', 'ot_p0_native_proof', $1, $1)`,
    [now],
  );
}
