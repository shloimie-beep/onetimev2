import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
} from '../../../packages/domain/src/index.ts';

type Harness = {
  config: AppConfig;
  pool: DbPool;
  server: ReturnType<ReturnType<typeof createApp>['listen']>;
  baseUrl: string;
};

const openHarnesses: Harness[] = [];

afterEach(async () => {
  while (openHarnesses.length > 0) {
    const harness = openHarnesses.pop();
    if (!harness) continue;
    await new Promise<void>((resolve) => harness.server.close(() => resolve()));
    await harness.pool.end();
  }
});

describe('W12-100-01 auth browser security boundaries', () => {
  it('sets strict production auth cookies and security headers without open redirects', async () => {
    const harness = await startHarness({
      NODE_ENV: 'production',
      AUTH_CSRF_SECRET: 'prod-test-auth-csrf-secret-32-bytes-min',
      MFA_SECRET_ENCRYPTION_KEY: 'prod-test-mfa-secret-32-bytes-minimum',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'prod-test-lifecycle-key-32-bytes-min',
    });
    await createAccountUser({
      pool: harness.pool,
      config: harness.config,
      email: 'parent-secure@example.test',
      password: 'ParentSecure!234',
      displayName: 'Secure Parent',
      role: 'parent',
    });

    const csrf = await getCsrf(harness, '/login?return_to=%2Fapp%2Fparent');
    expect(csrf.response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    );
    expect(csrf.response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(csrf.response.headers.get('x-content-type-options')).toBe('nosniff');

    const loginCsrfCookie = csrf.response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('otcrm_csrf='));
    expect(loginCsrfCookie).toContain('Secure');
    expect(loginCsrfCookie).toContain('SameSite=Strict');
    expect(loginCsrfCookie).not.toContain('HttpOnly');

    const login = await fetch(`${harness.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: csrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        email: 'parent-secure@example.test',
        password: 'ParentSecure!234',
        csrf_token: csrf.token,
        return_to: 'https://evil.example/phish',
      }),
    });
    expect(login.status).toBe(200);
    expect(await login.json()).toMatchObject({ success: true, return_to: '/app/parent' });

    const setCookies = login.headers.getSetCookie();
    const sessionCookie = setCookies.find((cookie) => cookie.startsWith('otcrm_session='));
    const sessionCsrfCookie = setCookies.find((cookie) => cookie.startsWith('otcrm_csrf='));
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(sessionCsrfCookie).toContain('Secure');
    expect(sessionCsrfCookie).toContain('SameSite=Strict');
    expect(sessionCsrfCookie).not.toContain('HttpOnly');
  });

  it('canonicalizes hostile return_to inputs on login pages, password login, and email assurance', async () => {
    const harness = await startHarness();
    await createAccountUser({
      pool: harness.pool,
      config: harness.config,
      email: 'parent-return@example.test',
      password: 'ParentReturn!234',
      displayName: 'Return Parent',
      role: 'parent',
    });
    await createAccountUser({
      pool: harness.pool,
      config: harness.config,
      email: 'admin-return@example.test',
      password: 'AdminReturn!234',
      displayName: 'Return Admin',
      role: 'admin',
    });

    for (const unsafeReturnTo of [
      'https://evil.example/app/parent',
      '//evil.example/app/parent',
      'javascript:alert(1)',
      '/api/v1/auth/session',
      '/app\\parent',
      '/%5cevil',
    ]) {
      const page = await fetch(
        `${harness.baseUrl}/login?return_to=${encodeURIComponent(unsafeReturnTo)}`,
      );
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('name="return_to" value="/app/crm"');
      expect(html).not.toContain(unsafeReturnTo);
    }

    const safePage = await fetch(
      `${harness.baseUrl}/login?return_to=${encodeURIComponent('/app/parent?view=learners#top')}`,
    );
    expect(await safePage.text()).toContain(
      'name="return_to" value="/app/parent?view=learners#top"',
    );

    const csrf = await getCsrf(harness, '/login');
    const parentLogin = await fetch(`${harness.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: csrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        email: 'parent-return@example.test',
        password: 'ParentReturn!234',
        csrf_token: csrf.token,
        return_to: '//evil.example/app/parent',
      }),
    });
    expect(parentLogin.status).toBe(200);
    expect(await parentLogin.json()).toMatchObject({ success: true, return_to: '/app/parent' });

    const adminCsrf = await getCsrf(harness, '/login');
    const passwordStep = await fetch(`${harness.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: adminCsrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': adminCsrf.token,
      },
      body: JSON.stringify({
        email: 'admin-return@example.test',
        password: 'AdminReturn!234',
        csrf_token: adminCsrf.token,
        return_to: '/app/dashboard',
      }),
    });
    expect(passwordStep.status).toBe(403);
    const challenge = (await passwordStep.json()) as { challenge_token?: string };
    expect(challenge.challenge_token).toBeTruthy();

    const payload = await latestEmailChallengePayload(harness);
    const verified = await fetch(`${harness.baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
        return_to: 'https://evil.example/dashboard',
      }),
    });
    expect(verified.status).toBe(200);
    expect(await verified.json()).toMatchObject({ success: true, return_to: '/app/dashboard' });
  });
});

async function startHarness(env: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ...env,
  });
  const pool = createMemoryPool();
  await runMigrations(pool);
  const app = createApp({ config, pool });
  const server = await new Promise<ReturnType<ReturnType<typeof createApp>['listen']>>(
    (resolve, reject) => {
      const started = app.listen(0, (error?: Error) => {
        if (error) reject(error);
        else resolve(started);
      });
    },
  );
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  const harness = { config, pool, server, baseUrl: `http://127.0.0.1:${address.port}` };
  openHarnesses.push(harness);
  return harness;
}

async function getCsrf(harness: Harness, path: string) {
  const response = await fetch(`${harness.baseUrl}${path}`);
  const html = await response.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error(`missing csrf token for ${path}`);
  return { response, token, cookies: cookieHeader(response.headers) };
}

async function latestEmailChallengePayload(harness: Harness) {
  const result = await harness.pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('missing auth email challenge payload');
  return decryptAuthEmailChallengeDeliveryPayloadForTests(harness.config, {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
