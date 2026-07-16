import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createAccountUser } from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let parentUserKey: string;
let studentUserKey: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'ot71-portals-'));
  await writePortalShells(distDir);
  parentUserKey = await createAccountUser({
    pool,
    config,
    email: 'parent@example.test',
    password: 'ParentPass!234',
    displayName: 'Parent User',
    role: 'parent',
  });
  studentUserKey = await createAccountUser({
    pool,
    config,
    email: 'student@example.test',
    password: 'StudentPass!234',
    displayName: 'Student User',
    role: 'student',
  });
  await createAccountUser({
    pool,
    config,
    email: 'viewer@example.test',
    password: 'ViewerPass!234',
    displayName: 'Viewer User',
    role: 'viewer',
  });
  await seedPortalRecords();
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('OT-71 mounted parent and student portals', () => {
  it('mounts parent shell and APIs through canonical parent sessions only', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const anonymousShell = await fetch(`${server.baseUrl}/app/parent`, { redirect: 'manual' });
      expect(anonymousShell.status).toBe(302);
      expect(anonymousShell.headers.get('location')).toContain('return_to=%2Fapp%2Fparent');

      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      const parentShell = await fetch(`${server.baseUrl}/app/parent`, {
        headers: { cookie: parent.cookies },
      });
      expect(parentShell.status).toBe(200);
      expect(parentShell.headers.get('cache-control')).toContain('no-store');
      expect(await parentShell.text()).toContain('portal-root');

      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parent.cookies },
      });
      expect(dashboard.status).toBe(200);
      const dashboardJson = await dashboard.json();
      expect(dashboardJson.data.household.household_key).toBe('household_alpha');
      expect(JSON.stringify(dashboardJson)).toContain('learner_alpha');
      expect(JSON.stringify(dashboardJson)).toContain('learner_setup');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_beta');
      expect(JSON.stringify(dashboardJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      await pool.query(
        `DELETE FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = 'learner_setup'`,
        [config.accountKey, config.productKey],
      );

      const crossHousehold = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_beta/dashboard`,
        { headers: { cookie: parent.cookies } },
      );
      expect(crossHousehold.status).toBe(404);

      const setup = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_setup/student-access/setup`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: 'portal-student-setup-001',
            email: 'new.student@example.test',
            display_name: 'Setup Learner',
          }),
        },
      );
      const setupText = await setup.text();
      expect(setup.status, setupText).toBe(200);
      expect(setupText).not.toContain('token_for_local_proof');
      expect(JSON.parse(setupText)).toMatchObject({
        success: true,
        data: { learner_key: 'learner_setup', status: 'setup_requested' },
      });
      const repairedAccessRows = await pool.query(
        `SELECT status, last_operation_type
           FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = 'learner_setup'`,
        [config.accountKey, config.productKey],
      );
      expect(repairedAccessRows.rows).toEqual([
        { status: 'setup_requested', last_operation_type: 'setup' },
      ]);

      const tokenRows = await pool.query(
        `SELECT token_hash, metadata
           FROM onetime.account_lifecycle_tokens
          WHERE token_type = 'student_setup'
            AND learner_key = 'learner_setup'`,
      );
      expect(tokenRows.rows).toHaveLength(1);
      expect(tokenRows.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(tokenRows.rows)).not.toContain('token_for_local_proof');

      const viewer = await loginAs(server.baseUrl, 'viewer@example.test', 'ViewerPass!234');
      const denied = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: viewer.cookies },
      });
      expect(denied.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('mounts student portal as one server-resolved learner and expires after parent suspend', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      expect(dashboard.status).toBe(200);
      const dashboardJson = await dashboard.json();
      expect(dashboardJson.data.learner.learner_key).toBe('learner_alpha');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_sibling');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_beta');
      expect(JSON.stringify(dashboardJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      const missingCsrf = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/class_week_001/launch`,
        {
          method: 'POST',
          headers: { cookie: student.cookies },
        },
      );
      expect(missingCsrf.status).toBe(403);

      const launch = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/class_week_001/launch`,
        {
          method: 'POST',
          headers: { cookie: student.cookies, 'x-csrf-token': student.json.csrf_token },
        },
      );
      expect(launch.status).toBe(200);
      const launchJson = await launch.json();
      expect(launchJson).toMatchObject({
        success: true,
        data: { kind: 'class_launch', launch_token_ref: 'provider_unavailable' },
      });
      expect(JSON.stringify(launchJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      const revoke = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_alpha/student-access/revoke_sessions`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({ idempotency_key: 'portal-student-revoke-sessions-001' }),
        },
      );
      const revokeText = await revoke.text();
      expect(revoke.status, revokeText).toBe(200);
      expect(JSON.parse(revokeText)).toMatchObject({
        success: true,
        data: {
          learner_key: 'learner_alpha',
          status: 'active',
          last_operation_type: 'revoke_sessions',
        },
      });
      const revokedSession = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      expect(revokedSession.status).toBe(401);

      const studentAfterRevoke = await loginAs(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
      );
      const suspend = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_alpha/student-access/suspend`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({ idempotency_key: 'portal-student-suspend-001' }),
        },
      );
      expect(suspend.status).toBe(200);
      const expired = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: studentAfterRevoke.cookies },
      });
      expect(expired.status).toBe(401);
    } finally {
      await server.close();
    }
  });
});

async function seedPortalRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha', $1, $2, 'Alpha Family'),
       ('household_beta', $1, $2, 'Beta Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('relationship_alpha', $1, $2, 'household_alpha', $3, 'Parent', 'primary_guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
     VALUES
       ('learner_alpha', $1, $2, 'household_alpha', 'Alpha Learner', '6'),
       ('learner_setup', $1, $2, 'household_alpha', 'Setup Learner', '5'),
       ('learner_sibling', $1, $2, 'household_alpha', 'Sibling Learner', '4'),
       ('learner_beta', $1, $2, 'household_beta', 'Beta Learner', '7')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
     VALUES
       ('access_alpha', $1, $2, 'household_alpha', 'learner_alpha', $3, 'active'),
       ('access_setup', $1, $2, 'household_alpha', 'learner_setup', NULL, 'not_configured'),
       ('access_sibling', $1, $2, 'household_alpha', 'learner_sibling', NULL, 'not_configured'),
       ('access_beta', $1, $2, 'household_beta', 'learner_beta', NULL, 'not_configured')`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
     VALUES ('link_alpha_student', $1, $2, 'household_alpha', 'learner_alpha', $3)`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type,
        status, policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES (
       'billing_entitlement:' || $1 || ':' || $2 || ':household_alpha',
       $1,
       $2,
       'household_alpha',
       'opaque',
       'active',
       '2026-07-15.1',
       'test_fixture_paid_invoice',
       'active_paid_current_invoice',
       '2026-07-15T12:00:00.000Z',
       '2026-07-15T12:00:01.000Z',
       true
     )`,
    [config.accountKey, config.productKey],
  );
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function loginAs(baseUrl: string, email: string, password: string) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as { csrf_token: string },
  };
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
