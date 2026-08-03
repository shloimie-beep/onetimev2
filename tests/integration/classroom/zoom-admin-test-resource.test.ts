import { type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  type ZoomAdminProviderPort,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let provider: ZoomAdminProviderPort;

const rawMeetingId = '88776655443';
const rawRegistrantToken = 'registrant-private-token';

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
    ONE_TIME_OWNER_TEST_EMAIL: 'operator-owned@example.test',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
  });
  provider = {
    checkConnection: vi.fn(async () => undefined),
    createTestMeeting: vi.fn(
      async (input: Parameters<ZoomAdminProviderPort['createTestMeeting']>[0]) => ({
        meeting: {
          provider: 'zoom' as const,
          meeting_id: rawMeetingId,
          provider_meeting_ref_digest: 'd'.repeat(48),
          type: 2 as const,
          starts_at: input.startsAt.toISOString(),
          duration_minutes: input.durationMinutes,
          raw_start_url_present: false as const,
          raw_join_url_present: false as const,
        },
        password: 'private-meeting-password',
      }),
    ),
    registerTestLearner: vi.fn(
      async (input: Parameters<ZoomAdminProviderPort['registerTestLearner']>[0]) => ({
        provider: 'zoom' as const,
        meeting_id_digest: 'd'.repeat(48),
        occurrence_id: 'single',
        learner_key: input.learnerKey,
        registrant_id_digest: 'e'.repeat(48),
        registrant_token: rawRegistrantToken,
        registrant_token_ref: 'registrant-ref-fixture',
        join_url_digest: 'f'.repeat(48),
        raw_join_url_present: false as const,
      }),
    ),
    deleteTestMeeting: vi.fn(async () => ({ already_absent: false })),
  };
});

afterEach(async () => {
  await pool.end();
});

describe('Zoom Admin authenticated app-owned test resource API', () => {
  it('requires auth and CSRF and never accepts an arbitrary delete meeting id', async () => {
    const server = await listenForTest(createApp({ config, pool, zoomAdminProvider: provider }));
    try {
      const anonymous = await fetch(`${server.baseUrl}/api/v1/live-class/zoom/admin/status`);
      expect(anonymous.status).toBe(401);

      const owner = await loginAs(server.baseUrl, 'owner@example.test', 'OwnerPass!234');
      const noCsrf = await fetch(`${server.baseUrl}/api/v1/live-class/zoom/admin/test-meeting`, {
        method: 'POST',
        headers: { cookie: owner.cookies, 'content-type': 'application/json' },
        body: JSON.stringify({ idempotency_key: 'zoom-create-no-csrf' }),
      });
      expect(noCsrf.status).toBe(403);

      const created = await post(owner, server.baseUrl, 'test-meeting', {
        idempotency_key: 'zoom-create-api-1',
      });
      expect(created.status).toBe(200);
      expect(created.text).not.toContain(rawMeetingId);
      expect(created.text).not.toMatch(/https?:\/\/|zoom\.us|private-meeting-password/i);

      const arbitrary = await post(owner, server.baseUrl, 'test-meeting/delete', {
        idempotency_key: 'zoom-delete-api-arbitrary',
        confirmed: true,
        meeting_id: '123456789',
      });
      expect(arbitrary.status).toBe(400);
      expect(provider.deleteTestMeeting).not.toHaveBeenCalled();

      const deleted = await post(owner, server.baseUrl, 'test-meeting/delete', {
        idempotency_key: 'zoom-delete-api-1',
        confirmed: true,
      });
      expect(deleted.status).toBe(200);
      expect(provider.deleteTestMeeting).toHaveBeenCalledOnce();
      expect(provider.deleteTestMeeting).toHaveBeenCalledWith(rawMeetingId);
      expect(deleted.text).not.toContain(rawMeetingId);
    } finally {
      await server.close();
    }
  });
});

async function post(
  session: { cookies: string; csrfToken: string },
  baseUrl: string,
  route: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/v1/live-class/zoom/admin/${route}`, {
    method: 'POST',
    headers: {
      cookie: session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': session.csrfToken,
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, text: await response.text() };
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
    const challenge = JSON.parse(text) as {
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
    const verifiedText = await verified.text();
    expect(verified.status, verifiedText).toBe(200);
    const verifiedJson = JSON.parse(verifiedText) as { csrf_token: string };
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      csrfToken: verifiedJson.csrf_token,
    };
  }
  expect(response.status, text).toBe(200);
  const json = JSON.parse(text) as { csrf_token: string };
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    csrfToken: json.csrf_token,
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
  if (!token) throw new Error('missing login csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return (
    headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .filter(Boolean)
      .join('; ') || ''
  );
}

function mergeCookies(...cookieHeaders: string[]) {
  const cookies = new Map<string, string>();
  for (const header of cookieHeaders) {
    for (const item of header.split(/;\s*/)) {
      const [name] = item.split('=');
      if (name) cookies.set(name, item);
    }
  }
  return [...cookies.values()].join('; ');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
