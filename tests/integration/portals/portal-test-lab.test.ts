import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  W12_PORTAL_TEST_LAB,
  W12_PORTAL_TEST_LAB_ROUTE,
  seedPortalTestLab,
} from '../../../apps/web/src/server/features/portal-test-lab/router.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
} from '../../../packages/domain/src/index.ts';

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
  distDir = await mkdtemp(path.join(tmpdir(), 'w12-portal-test-lab-'));
  await writePortalShells(distDir);
  await createAccountUser({
    pool,
    config,
    email: 'w12-viewer@example.test',
    password: 'W12ViewerPass!234',
    displayName: 'W12 Fictional Viewer',
    role: 'viewer',
  });
  await seedPortalTestLab({ pool, config });
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('W12-03 Portal Test Lab', () => {
  it('keeps the lab owner/admin-only and hides runnable secrets', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const anonymous = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        redirect: 'manual',
      });
      expect(anonymous.status).toBe(302);
      expect(anonymous.headers.get('location')).toContain('return_to=%2Fapp%2Fportal-test-lab');

      const parent = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.parent.email,
        W12_PORTAL_TEST_LAB.parent.defaultPassword,
      );
      const forbidden = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        headers: { cookie: parent.cookies },
      });
      expect(forbidden.status).toBe(403);
      expect(await forbidden.text()).toContain('Portal Test Lab access unavailable');

      const admin = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.admin.email,
        W12_PORTAL_TEST_LAB.admin.defaultPassword,
      );
      const page = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        headers: { cookie: admin.cookies },
      });
      const html = await page.text();
      expect(page.status, html).toBe(200);
      expect(page.headers.get('cache-control')).toContain('no-store');
      expect(html).toContain('W12 Portal Test Lab');
      expect(html).toContain(W12_PORTAL_TEST_LAB.parent.email);
      for (const learner of W12_PORTAL_TEST_LAB.learners) {
        expect(html).toContain(learner.email);
        expect(html).toContain(learner.learnerKey);
        expect(html).not.toContain(learner.defaultPassword);
      }
      expect(html).not.toContain(W12_PORTAL_TEST_LAB.parent.defaultPassword);
      expect(html).not.toContain(W12_PORTAL_TEST_LAB.admin.defaultPassword);
      expect(html).not.toMatch(/view as|impersonat|https?:\/\/|zoom|vimeo|drive|meet/i);

      const reset = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}/reset`, {
        method: 'POST',
        headers: {
          cookie: admin.cookies,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ csrf_token: admin.json.csrf_token }),
        redirect: 'manual',
      });
      expect(reset.status).toBe(303);
      expect(reset.headers.get('location')).toBe(`${W12_PORTAL_TEST_LAB_ROUTE}?status=reset`);
    } finally {
      await server.close();
    }
  });

  it('provisions separate parent and learner sessions with no sibling bleed', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const parent = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.parent.email,
        W12_PORTAL_TEST_LAB.parent.defaultPassword,
      );
      const parentDashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parent.cookies },
      });
      const parentText = await parentDashboard.text();
      expect(parentDashboard.status, parentText).toBe(200);
      const parentJson = JSON.parse(parentText);
      expect(parentJson.data.household.household_key).toBe(W12_PORTAL_TEST_LAB.householdKey);
      expect(parentJson.data.learners).toHaveLength(3);
      expect(parentJson.data.billing.grants_access).toBe(true);
      expect(JSON.stringify(parentJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);

      const learner = W12_PORTAL_TEST_LAB.learners[0];
      const resetAccess = await parentStudentAccessAction(server.baseUrl, parent, learner, 'reset');
      expect(resetAccess.status).toBe(200);
      expect((await resetAccess.json()).data.status).toBe('active');
      const suspendAccess = await parentStudentAccessAction(
        server.baseUrl,
        parent,
        learner,
        'suspend',
      );
      expect(suspendAccess.status).toBe(200);
      expect((await suspendAccess.json()).data.status).toBe('suspended');
      const restoreAccess = await parentStudentAccessAction(
        server.baseUrl,
        parent,
        learner,
        'restore',
      );
      expect(restoreAccess.status).toBe(200);
      expect((await restoreAccess.json()).data.status).toBe('active');

      const parentLaunch = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/${W12_PORTAL_TEST_LAB.householdKey}/learners/${learner.learnerKey}/classes/${W12_PORTAL_TEST_LAB.occurrenceKey}/launch`,
        {
          method: 'POST',
          headers: { cookie: parent.cookies, 'x-csrf-token': parent.json.csrf_token },
        },
      );
      expect(parentLaunch.status).toBe(200);
      expect(JSON.stringify(await parentLaunch.json())).not.toMatch(
        /https?:\/\/|zoom|vimeo|drive|meet/i,
      );

      for (const current of W12_PORTAL_TEST_LAB.learners) {
        const student = await loginAs(server.baseUrl, current.email, current.defaultPassword);
        const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
          headers: { cookie: student.cookies },
        });
        const dashboardJson = await dashboard.json();
        expect(dashboard.status).toBe(200);
        expect(dashboardJson.data.learner.learner_key).toBe(current.learnerKey);
        expect(dashboardJson.data.progress.attendance_count).toBe(1);
        expect(dashboardJson.data.rewards.balance).toBe(5);
        expect(dashboardJson.data.questions).toHaveLength(1);
        expect(dashboardJson.data.helper.available).toBe(true);
        for (const sibling of W12_PORTAL_TEST_LAB.learners) {
          if (sibling.learnerKey === current.learnerKey) continue;
          expect(JSON.stringify(dashboardJson)).not.toContain(sibling.learnerKey);
          expect(JSON.stringify(dashboardJson)).not.toContain(sibling.displayName);
        }

        const helper = await fetch(`${server.baseUrl}/api/v1/portals/student/helper/query`, {
          method: 'POST',
          headers: {
            cookie: student.cookies,
            'content-type': 'application/json',
            'x-csrf-token': student.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: `w12-helper-${current.learnerKey}`,
            question: 'What should I review from the Mishnah lesson?',
          }),
        });
        const helperJson = await helper.json();
        expect(helper.status, JSON.stringify(helperJson)).toBe(200);
        expect(helperJson.data.abstained).toBe(false);
        expect(JSON.stringify(helperJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);
      }
    } finally {
      await server.close();
    }
  });
});

async function parentStudentAccessAction(
  baseUrl: string,
  parent: Awaited<ReturnType<typeof loginAs>>,
  learner: (typeof W12_PORTAL_TEST_LAB.learners)[number],
  action: 'reset' | 'suspend' | 'restore',
) {
  return fetch(
    `${baseUrl}/api/v1/portals/parent/households/${W12_PORTAL_TEST_LAB.householdKey}/learners/${learner.learnerKey}/student-access/${action}`,
    {
      method: 'POST',
      headers: {
        cookie: parent.cookies,
        'content-type': 'application/json',
        'x-csrf-token': parent.json.csrf_token,
      },
      body: JSON.stringify({
        idempotency_key: `w12-${action}-${learner.learnerKey}`,
        ...(action === 'reset' ? { password: learner.defaultPassword } : {}),
      }),
    },
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
  if (response.status === 403) {
    const challenge = JSON.parse(text) as { code?: string; challenge_token?: string };
    expect(challenge.code).toBe('EMAIL_CHALLENGE_REQUIRED');
    expect(challenge.challenge_token).toBeTruthy();
    const payload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
      }),
    });
    const verifiedText = await verified.text();
    expect(verified.status, verifiedText).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      json: JSON.parse(verifiedText) as { csrf_token: string },
    };
  }
  expect(response.status, text).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as { csrf_token: string },
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
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
