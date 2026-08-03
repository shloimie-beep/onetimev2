import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createAccountUser } from '../../../packages/domain/src/index.ts';

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
    const parentUserKey = await createAccountUser({
      pool: harness.pool,
      config: harness.config,
      email: 'parent-secure@example.test',
      password: 'ParentSecure!234',
      displayName: 'Secure Parent',
      role: 'parent',
    });
    await seedParentCurrentAccess(harness, parentUserKey, 'secure');

    const csrfResponse = await rawRequest(
      harness,
      '/login?return_to=%2Fapp%2Fparent',
      'app.onetimeonetime.com',
    );
    expect(csrfResponse.status).toBe(200);
    expect(csrfResponse.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(csrfResponse.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(csrfResponse.headers['x-content-type-options']).toBe('nosniff');

    const csrfToken = csrfResponse.body.match(/name="csrf_token" value="([^"]+)"/)?.[1];
    expect(csrfToken).toBeTruthy();
    const csrfSetCookies = headerValues(csrfResponse.headers['set-cookie']);
    const loginCsrfCookie = csrfSetCookies.find((cookie) => cookie.startsWith('otcrm_csrf='));
    expect(loginCsrfCookie).toContain('Secure');
    expect(loginCsrfCookie).toContain('SameSite=Strict');
    expect(loginCsrfCookie).not.toContain('HttpOnly');

    const login = await rawRequest(harness, '/api/v1/auth/login', 'app.onetimeonetime.com', {
      method: 'POST',
      headers: {
        cookie: cookieHeaderFromSetCookies(csrfSetCookies),
        'content-type': 'application/json',
        'x-csrf-token': csrfToken!,
      },
      body: JSON.stringify({
        email: 'parent-secure@example.test',
        password: 'ParentSecure!234',
        csrf_token: csrfToken,
        return_to: 'https://evil.example/phish',
      }),
    });
    expect(login.status).toBe(200);
    expect(JSON.parse(login.body)).toMatchObject({ success: true, return_to: '/app/parent' });

    const setCookies = headerValues(login.headers['set-cookie']);
    const sessionCookie = setCookies.find((cookie) => cookie.startsWith('otcrm_session='));
    const sessionCsrfCookie = setCookies.find((cookie) => cookie.startsWith('otcrm_csrf='));
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(sessionCsrfCookie).toContain('Secure');
    expect(sessionCsrfCookie).toContain('SameSite=Strict');
    expect(sessionCsrfCookie).not.toContain('HttpOnly');
  });

  it('canonicalizes hostile return_to inputs on login pages and password login', async () => {
    const harness = await startHarness();
    const parentUserKey = await createAccountUser({
      pool: harness.pool,
      config: harness.config,
      email: 'parent-return@example.test',
      password: 'ParentReturn!234',
      displayName: 'Return Parent',
      role: 'parent',
    });
    await seedParentCurrentAccess(harness, parentUserKey, 'return');
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
    const safeHtml = await safePage.text();
    expect(safeHtml).toContain('name="return_to" value="/app/parent?view=learners#top"');
    expect(safeHtml).not.toContain('data-email-link-confirm');
    expect(safeHtml).not.toContain('Confirm email sign-in');

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
    expect(passwordStep.status).toBe(200);
    expect(await passwordStep.json()).toMatchObject({ success: true, return_to: '/app/dashboard' });
  });

  it('serves only the exact configured isolated-staging host under production Node mode', async () => {
    const stagingHost = 'ot99-web-staging.up.railway.app';
    const stagingPublicBaseUrl = `https://${stagingHost}`;
    const stagingHarness = await startHarness({
      NODE_ENV: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      PUBLIC_BASE_URL: stagingPublicBaseUrl,
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-staging-host-proof',
      MFA_SECRET_ENCRYPTION_KEY: 'test-only-mfa-secret-for-staging-host-proof',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'test-only-lifecycle-key-for-staging-host-proof',
    });

    const bootstrap = await rawRequest(
      stagingHarness,
      '/api/v1/signup/family/bootstrap',
      stagingHost,
    );
    expect(bootstrap.status).toBe(200);
    expect(JSON.parse(bootstrap.body)).toMatchObject({ success: true, writes_allowed: true });

    const nearMatch = await rawRequest(
      stagingHarness,
      '/api/v1/signup/family/bootstrap',
      `${stagingHost}.attacker.invalid`,
    );
    expect(nearMatch.status).toBe(404);
    expect(nearMatch.body).toBe('Not found.');

    const productionHarness = await startHarness({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: stagingPublicBaseUrl,
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-production-host-proof',
      MFA_SECRET_ENCRYPTION_KEY: 'test-only-mfa-secret-for-production-host-proof',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'test-only-lifecycle-key-for-production-host-proof',
    });
    const productionResponse = await rawRequest(
      productionHarness,
      '/api/v1/signup/family/bootstrap',
      stagingHost,
    );
    expect(productionResponse.status).toBe(404);
    expect(productionResponse.body).toBe('Not found.');
  });
});

async function startHarness(env: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'test-only-protected-payload-key-32-bytes',
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

async function rawRequest(
  harness: Harness,
  path: string,
  host: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  const url = new URL(harness.baseUrl);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method: init.method ?? 'GET',
        headers: { host, ...init.headers },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    if (init.body) request.write(init.body);
    request.end();
  });
}

function headerValues(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cookieHeaderFromSetCookies(setCookies: readonly string[]): string {
  return setCookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

async function seedParentCurrentAccess(
  harness: Harness,
  parentUserKey: string,
  fixtureKey: string,
) {
  const householdKey = `auth_${fixtureKey}_household`;
  await harness.pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1,$2,$3,'Auth fixture household')`,
    [householdKey, harness.config.accountKey, harness.config.productKey],
  );
  await harness.pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ($1,$2,$3,$4,$5,'Parent','primary_guardian')`,
    [
      `auth_${fixtureKey}_relationship`,
      harness.config.accountKey,
      harness.config.productKey,
      householdKey,
      parentUserKey,
    ],
  );
  await harness.pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES ($1,$2,$3,$4,'active','free_pilot',
       now() - interval '1 hour',now() + interval '30 days',$5,1,
       now(),$6,'auth-boundary-access-v1',$7)`,
    [
      `auth_${fixtureKey}_access`,
      harness.config.accountKey,
      harness.config.productKey,
      householdKey,
      `auth_${fixtureKey}_free_pilot`,
      'b'.repeat(64),
      `auth_${fixtureKey}_access_seed`,
    ],
  );
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
