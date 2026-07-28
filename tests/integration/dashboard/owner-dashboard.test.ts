import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  captureLead,
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
} from '../../../packages/domain/src/index.ts';
import type { OwnerDashboardResponse } from '../../../packages/contracts/src/dashboard/index.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;

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
  distDir = await mkdtemp(path.join(tmpdir(), 'ot71-dashboard-'));
  await writeShells(distDir);

  await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
    mfaCapable: true,
  });

  await createAccountUser({
    pool,
    config,
    email: 'viewer@example.test',
    password: 'ViewerPass!234',
    displayName: 'Viewer User',
    role: 'viewer',
  });

  await seedDashboardSources();
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('OT-71 owner/admin dashboard shell', () => {
  it('mounts only working owner/admin surfaces and returns a complete visible-action registry', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const anonymous = await fetch(`${server.baseUrl}/app/dashboard`, { redirect: 'manual' });
      expect(anonymous.status).toBe(302);
      expect(anonymous.headers.get('location')).toContain('return_to=%2Fapp%2Fdashboard');

      const owner = await loginAs(server.baseUrl, 'owner@example.test', 'OwnerPass!234');
      for (const appPath of [
        '/app/dashboard',
        '/app/classes',
        '/app/content',
        '/app/billing',
        '/app/operations',
      ]) {
        const shell = await fetch(`${server.baseUrl}${appPath}`, {
          headers: { cookie: owner.cookies },
        });
        const shellText = await shell.text();
        expect(shell.status, shellText).toBe(200);
        expect(shell.headers.get('cache-control')).toContain('no-store');
        expect(shellText).toContain('crm-root');
      }

      const dashboard = await fetch(`${server.baseUrl}/api/v1/dashboard/owner`, {
        headers: { cookie: owner.cookies },
      });
      const dashboardText = await dashboard.text();
      expect(dashboard.status, dashboardText).toBe(200);
      expect(dashboard.headers.get('cache-control')).toContain('no-store');
      expect(dashboardText).not.toMatch(
        /https?:\/\/|stripe_live|provider_secret|token_for_local_proof|zoom|vimeo|drive/i,
      );
      const json = JSON.parse(dashboardText) as OwnerDashboardResponse;
      const sections = new Map(json.dashboard.sections.map((section) => [section.id, section]));
      expect(sections.get('new_leads')).toMatchObject({
        state: 'action_needed',
        value: 1,
        href: '/app/crm',
      });
      expect(sections.get('next_class')).toMatchObject({
        state: 'not_connected',
        href: '/app/classes',
      });
      expect(sections.get('communications_delivery')?.value).toBeGreaterThan(0);
      expect(sections.get('content_review')).toMatchObject({
        state: 'action_needed',
        value: 1,
        href: '/app/content',
      });
      expect(sections.get('portal_account_setup')).toMatchObject({
        state: 'action_needed',
        href: null,
      });
      expect(sections.get('billing_readiness')).toMatchObject({
        state: 'ready',
        label: 'Household access',
        value: 1,
        href: '/app/billing',
        diagnostics: {
          source: 'account_access_projections',
        },
      });
      expect(sections.get('support')).toMatchObject({
        state: 'temporarily_unavailable',
        href: null,
      });
      expect(json.dashboard.household_access).toEqual([
        expect.objectContaining({
          household_key: 'dashboard_household',
          household_label: 'Dashboard Family',
          household_status: 'active',
          state: 'active',
          source_kind: 'free_pilot',
          source_label: 'Complimentary pilot',
          grants_access: true,
          review_or_revocation_reason: null,
        }),
      ]);
      expect(json.dashboard.household_access[0]?.effective_at).toMatch(/T/);
      expect(json.dashboard.household_access[0]?.expires_at).toMatch(/T/);
      expect(json.dashboard.household_access[0]?.updated_at).toMatch(/T/);
      expect(JSON.stringify(json.dashboard.household_access)).not.toMatch(
        /amount|invoice|card|subscription|checkout|payment_history/iu,
      );

      const actionIds = json.actions.map((action) => action.action_id);
      expect(new Set(actionIds).size).toBe(actionIds.length);
      expect(actionIds).toEqual(
        expect.arrayContaining([
          'dashboard.view.route',
          'dashboard.refresh.button',
          'dashboard.open_crm.button',
          'crm.contacts.search.form',
          'classes.view.route',
          'classes.open_detail.button',
          'classes.back_to_list.button',
          'content.library.view.route',
          'communications.view.route',
          'billing.status.view.route',
          'household.access.refresh.button',
          'auth.logout.button',
        ]),
      );
      expect(
        json.actions.find((action) => action.action_id === 'household.access.refresh.button'),
      ).toMatchObject({
        label: 'Refresh household access',
        capability: 'accounts:access:read',
        audit: { event: 'account_access_status_read' },
      });
      for (const action of json.actions) {
        expect(action.roles.length).toBeGreaterThan(0);
        expect(action.capability).toMatch(/:/);
        expect(action.handler.path).toMatch(/^\//);
        expect(action.audit.event).toBeTruthy();
        expect(Object.keys(action.states).sort()).toEqual([
          'error',
          'loading',
          'offline',
          'permission',
          'success',
        ]);
      }
      expect(actionIds.join(' ')).not.toMatch(/studio|agent|bna|coming|report|task/i);

      const launchStatus = await fetch(`${server.baseUrl}/api/v1/launch-status`, {
        headers: { cookie: owner.cookies },
      });
      const launchStatusText = await launchStatus.text();
      expect(launchStatus.status, launchStatusText).toBe(404);
      expect(launchStatus.headers.get('cache-control')).toContain('no-store');
      expect(launchStatusText).not.toMatch(
        /https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|provider_secret|password=/iu,
      );
      expect(JSON.parse(launchStatusText)).toMatchObject({
        success: false,
        code: 'NOT_FOUND',
        message: 'Launch status is unavailable.',
      });

      const viewer = await loginAs(server.baseUrl, 'viewer@example.test', 'ViewerPass!234');
      const deniedApi = await fetch(`${server.baseUrl}/api/v1/dashboard/owner`, {
        headers: { cookie: viewer.cookies },
      });
      expect(deniedApi.status).toBe(403);
      const deniedShell = await fetch(`${server.baseUrl}/app/dashboard`, {
        headers: { cookie: viewer.cookies },
      });
      expect(deniedShell.status).toBe(403);
      const deniedLaunchStatusApi = await fetch(`${server.baseUrl}/api/v1/launch-status`, {
        headers: { cookie: viewer.cookies },
      });
      expect(deniedLaunchStatusApi.status).toBe(404);
      const deniedOperationsShell = await fetch(`${server.baseUrl}/app/operations`, {
        headers: { cookie: viewer.cookies },
      });
      expect(deniedOperationsShell.status).toBe(403);
      const removedLaunchStatusShell = await fetch(`${server.baseUrl}/app/launch-status`, {
        headers: { cookie: owner.cookies },
      });
      expect(removedLaunchStatusShell.status).toBe(404);
      const crmShell = await fetch(`${server.baseUrl}/app/crm`, {
        headers: { cookie: viewer.cookies },
      });
      expect(crmShell.status).toBe(200);
    } finally {
      await server.close();
    }
  });
});

async function seedDashboardSources() {
  const classStartsAt = new Date(Date.now() + 24 * 60 * 60_000);
  const reminderDueAt = new Date(classStartsAt.getTime() - 30 * 60_000);
  const joinableUntil = new Date(classStartsAt.getTime() + 90 * 60_000);
  await captureLead({
    pool,
    config,
    payload: {
      contact_name: 'Lead Parent',
      family_or_school: 'Lead Family',
      audience_type: 'family',
      location: 'Ramat Beit Shemesh',
      timezone: 'Asia/Jerusalem',
      email: 'lead@example.test',
      phone: '',
      reminder_preference: 'email',
      reminder_consent: true,
      idempotency_key: 'dashboard-lead-001',
      attribution: { landing_path: '/signup' },
    },
  });
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time, reminder_local_time)
     VALUES ('class_series_dashboard', $1, $2, 'Dashboard Class', 'Asia/Jerusalem', '19:00', '18:30')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, access_state)
     VALUES
       ('class_dashboard_001', $1, $2, 'class_series_dashboard', $6,
        $3, $4, $5, 'scheduled', 'provider_unavailable')`,
    [
      config.accountKey,
      config.productKey,
      classStartsAt,
      reminderDueAt,
      joinableUntil,
      classStartsAt.toISOString().slice(0, 10),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, event_type, channel, payload, status)
     VALUES
       ('dashboard_delivery_001', $1, $2, 'family_class_reminder_email.v1', 'email', '{}'::jsonb, 'pending')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type, lifecycle_state)
     VALUES
       ('dashboard_content_001', $1, $2, 'class_dashboard_001', 'Review Sheet', 'review', 'review_needed')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('dashboard_household', $1, $2, 'Dashboard Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ('dashboard_learner', $1, $2, 'dashboard_household', 'Dashboard Learner')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status)
     VALUES ('dashboard_access', $1, $2, 'dashboard_household', 'dashboard_learner', 'not_configured')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES ('dashboard_household_access',$1,$2,'dashboard_household','active','free_pilot',
       now() - interval '1 day',now() + interval '30 days','dashboard_free_pilot',1,
       now(),$3,'dashboard-current-access-v1','dashboard_access_event')`,
    [config.accountKey, config.productKey, 'd'.repeat(64)],
  );
}

async function writeShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
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
  if (response.status === 403) {
    const challenge = (await response.json()) as {
      code?: string;
      challenge_token?: string;
    };
    expect(challenge.code).toBe('EMAIL_CHALLENGE_REQUIRED');
    const payload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
      }),
    });
    expect(verified.status).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      json: (await verified.json()) as { csrf_token: string },
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as { csrf_token: string },
  };
}

async function latestEmailChallengePayload() {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new Error('missing auth email challenge payload');
  return decryptAuthEmailChallengeDeliveryPayloadForTests(config, {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
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
  const jar = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [name, ...value] = trimmed.split('=');
      if (name) jar.set(name, value.join('='));
    }
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}
