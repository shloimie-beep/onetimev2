import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  activateTotpEnrollment,
  createAccountUser,
  provisionTotpEnrollment,
  totpCode,
} from '../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let server: Awaited<ReturnType<typeof listenForTest>>;
let ownerTotpSecret: string;

const now = new Date('2026-07-17T05:30:00.000Z');

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'ops05-test',
    COMMIT_SHA: 'fb5f5ee',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
    ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
    ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
    ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'owner@example.test',
    RESEND_API_KEY: 'resend-api-secret-never-return',
    RESEND_WEBHOOK_SECRET: 'whsec_resend_secret_never_return',
    ONE_TIME_EMAIL_FROM: 'One Time <classes@example.test>',
    ONE_TIME_EMAIL_REPLY_TO: 'support@example.test',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  const ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
    mfaCapable: true,
  });
  const enrollment = await provisionTotpEnrollment({ pool, config, userKey: ownerUserKey });
  ownerTotpSecret = enrollment.secret;
  const activated = await activateTotpEnrollment({
    pool,
    config,
    enrollmentToken: enrollment.enrollmentToken,
    code: totpCode(enrollment.secret),
  });
  expect(activated).not.toBe(false);
  await createAccountUser({
    pool,
    config,
    email: 'viewer@example.test',
    password: 'ViewerPass!234',
    displayName: 'Viewer User',
    role: 'viewer',
    mfaCapable: false,
  });
  server = await listenForTest(createApp({ config, pool, clock: () => now }));
});

afterEach(async () => {
  await server.close();
  await pool.end();
});

describe('OPS-05 provider control center API', () => {
  it('is internal, owner-only, value-redacted, and no-store', async () => {
    const anonymous = await fetch(
      `${server.baseUrl}/api/internal/operations/provider-control-center/v1`,
    );
    expect(anonymous.status).toBe(401);

    const viewer = await loginAs('viewer@example.test', 'ViewerPass!234');
    const viewerResponse = await fetch(
      `${server.baseUrl}/api/internal/operations/provider-control-center/v1`,
      {
        headers: { cookie: viewer.cookies },
      },
    );
    expect(viewerResponse.status).toBe(403);

    const owner = await loginAs('owner@example.test', 'OwnerPass!234', ownerTotpSecret);
    const response = await fetch(
      `${server.baseUrl}/api/internal/operations/provider-control-center/v1`,
      {
        headers: { cookie: owner.cookies },
      },
    );
    const text = await response.text();
    expect(response.status, text).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(text).not.toContain('resend-api-secret-never-return');
    expect(text).not.toContain('whsec_resend_secret_never_return');
    const json = JSON.parse(text) as {
      owner_capability: string;
      providers: Array<{ provider: string; required_variable_names: string[] }>;
      webhook_endpoints: Array<{ provider: string; path: string | null }>;
      guardrail_proof: Record<string, boolean>;
    };
    expect(json.owner_capability).toBe('provider_control_center:read');
    expect(json.providers.find((provider) => provider.provider === 'resend_email')).toMatchObject({
      required_variable_names: expect.arrayContaining(['RESEND_WEBHOOK_SECRET']),
    });
    expect(
      json.webhook_endpoints.find((endpoint) => endpoint.provider === 'stripe_test'),
    ).toMatchObject({
      path: '/api/v1/billing/webhooks/provider',
    });
    expect(json.guardrail_proof).toMatchObject({
      no_provider_mutation: true,
      no_real_send: true,
      no_live_charge: true,
      no_bna_edit: true,
    });
  });

  it('dry-runs canary plans only with owner CSRF, recent assurance, and allowlisted fixture', async () => {
    const owner = await loginAs('owner@example.test', 'OwnerPass!234', ownerTotpSecret);
    const payload = {
      provider: 'resend_email',
      idempotency_key: 'ops05-canary-plan',
      fixture_mode: true,
      target_kind: 'email',
      target_ref: 'owner@example.test',
      explicit_confirmation: 'PLAN OPS-05 FIXTURE CANARY ONLY',
    };

    const noCsrf = await fetch(
      `${server.baseUrl}/api/internal/operations/provider-control-center/v1/canary-plan`,
      {
        method: 'POST',
        headers: { cookie: owner.cookies, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    expect(noCsrf.status).toBe(403);

    const noAssurance = await canaryPlan(owner, payload);
    expect(noAssurance.status).toBe(428);
    expect(await noAssurance.json()).toMatchObject({
      success: false,
      code: 'RECENT_EMAIL_ASSURANCE_REQUIRED',
    });

    const allowed = await canaryPlan(owner, payload, now.toISOString());
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      success: true,
      plan_status: 'fixture_contract_ready',
      external_mutation_allowed: false,
      real_provider_send_allowed: false,
    });
  });
});

async function canaryPlan(
  login: Awaited<ReturnType<typeof loginAs>>,
  payload: Record<string, unknown>,
  assuredAt?: string,
) {
  return fetch(`${server.baseUrl}/api/internal/operations/provider-control-center/v1/canary-plan`, {
    method: 'POST',
    headers: {
      cookie: login.cookies,
      'content-type': 'application/json',
      'x-csrf-token': login.json.csrf_token,
      ...(assuredAt ? { 'x-ot-ops-email-assured-at': assuredAt } : {}),
    },
    body: JSON.stringify({ ...payload, csrf_token: login.json.csrf_token }),
  });
}

async function loginAs(email: string, password: string, totpSecret?: string) {
  const csrf = await getLoginCsrf();
  const response = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  if (response.status === 403 && totpSecret) {
    const challenge = (await response.json()) as { code?: string; challenge_token?: string };
    expect(challenge.code).toBe('MFA_REQUIRED');
    const mfa = await fetch(`${server.baseUrl}/api/v1/auth/mfa/challenge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        totp_code: totpCode(totpSecret),
      }),
    });
    expect(mfa.status).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(mfa.headers)),
      json: (await mfa.json()) as { csrf_token: string },
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as { csrf_token: string },
  };
}

async function getLoginCsrf() {
  const page = await fetch(`${server.baseUrl}/login`);
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

async function listenForTest(app: ReturnType<typeof createApp>) {
  const nextServer = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = nextServer.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => nextServer.close(() => resolve())),
  };
}
