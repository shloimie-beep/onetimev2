import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  captureTishaBavRegistration,
  MockHighLevelEventClient,
  requestTishaBavJoin,
  resolveTishaBavRedirect,
} from '../../packages/domain/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';

let pool: DbPool;

const openWindow = new Date('2026-07-23T18:30:00.000Z');
const beforeWindow = new Date('2026-07-23T18:00:00.000Z');

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('Tisha BAv event registration', () => {
  it('stores event registration and a provider-off HighLevel delivery intent by default', async () => {
    const config = testConfig();
    const result = await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('parent@example.test'),
      now: openWindow,
    });

    expect(result).toMatchObject({
      success: true,
      duplicate_submission: false,
      event_code: 'tisha-bav-2026',
      confirmation_queued: true,
      ghl_sync_status: 'provider_off',
      message: {
        heading: 'Thank you — your spot has been reserved.',
        body: "We'll send your Zoom link and event details by email.",
        schedule: 'Thursday, July 23\n3:00 PM Eastern / 10:00 PM Israel',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/zoom\.us|join_url|start_url/i);

    await expectCount('event_registrations', 1);
    const delivery = await pool.query(
      `SELECT status, provider, protected_payload, public_metadata
         FROM onetime.event_delivery_events
        WHERE event_code = 'tisha-bav-2026'`,
    );
    expect(delivery.rows[0]).toMatchObject({ status: 'provider_off', provider: 'highlevel' });
    expect(delivery.rows[0].public_metadata.raw_zoom_url_present).toBe(false);
    expect(delivery.rows[0].public_metadata.communication_catalog_version).toBe(
      'tisha-bav-2026-email-copy-v1',
    );
    expect(delivery.rows[0].protected_payload.communication_catalog_version).toBe(
      'tisha-bav-2026-email-copy-v1',
    );
    expect(delivery.rows[0].protected_payload.workflow_schedule).toMatchObject({
      eventStart: '2026-07-23T19:00:00.000Z',
      oneHourReminder: { offsetMinutes: -60, sendAt: '2026-07-23T18:00:00.000Z' },
      tenMinuteReminder: { offsetMinutes: -10, sendAt: '2026-07-23T18:50:00.000Z' },
    });
    expect(delivery.rows[0].protected_payload.tags).toEqual([
      "OT | Event | Tisha B'Av 2026 | Registered",
      "OT | Source | Tisha B'Av 2026",
    ]);
  });

  it('replays the same idempotency key without duplicate rows', async () => {
    const config = testConfig();
    const payload = registrationPayload('same@example.test', { idempotency_key: 'event-same-1' });
    const first = await captureTishaBavRegistration({ pool, config, payload, now: openWindow });
    const second = await captureTishaBavRegistration({ pool, config, payload, now: openWindow });

    expect(second.duplicate_submission).toBe(true);
    expect(second.registration_key).toBe(first.registration_key);
    await expectCount('event_registrations', 1);
    await expectCount('event_delivery_events', 1);
  });

  it('queues the exact bounded confirmation copy when the Resend fallback is enabled', async () => {
    const config = testConfig({ ONE_TIME_EVENT_EMAIL_FALLBACK: 'resend' });
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('fallback@example.test'),
      now: openWindow,
    });

    const deliveries = await pool.query(
      `SELECT protected_payload, public_metadata
         FROM onetime.event_delivery_events
        WHERE event_code = 'tisha-bav-2026'
          AND provider = 'resend_fallback'`,
    );
    expect(deliveries.rowCount).toBe(1);
    expect(deliveries.rows[0].protected_payload).toMatchObject({
      communication_catalog_version: 'tisha-bav-2026-email-copy-v1',
      template: 'tisha_bav_2026_registration_confirmation_v1',
      subject: "You're registered for Rabbi Eli Scheller's live Tisha B'Av program",
      cta: { label: 'View Event Details', path: '/tisha-bav' },
      reply_to: 'info@onetimeonetime.com',
      sender: 'Rabbi Eli Scheller | One Time Mishnayos',
      from: 'info@onetimeonetime.com',
    });
    expect(deliveries.rows[0].protected_payload.body).toContain(
      'Thursday, July 23, 2026\n3:00 PM Eastern\n10:00 PM Israel',
    );
    expect(JSON.stringify(deliveries.rows[0])).not.toMatch(/zoom\.us|zoommtg|pwd=/i);
    expect(deliveries.rows[0].public_metadata).toMatchObject({
      bounded: true,
      confirmation_only: true,
      warm_list_invitation: false,
    });
  });

  it('syncs through the mock HighLevel adapter with newsletter consent isolated', async () => {
    const config = testConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const highLevel = new MockHighLevelEventClient();
    const result = await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('newsletter@example.test', {
        newsletter_opt_in: true,
        idempotency_key: 'newsletter-yes-1',
      }),
      now: openWindow,
      highLevelClient: highLevel,
    });

    expect(result.ghl_sync_status).toBe('succeeded');
    expect(highLevel.tags.has("OT | Event | Tisha B'Av 2026 | Registered")).toBe(true);
    expect([...highLevel.contacts.values()][0]?.tags).toContain('OT | Weekly Newsletter');
    expect(highLevel.workflowRequests).toHaveLength(1);
  });

  it('does not request the workflow again after a successful idempotent replay', async () => {
    const config = testConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const highLevel = new MockHighLevelEventClient();
    const payload = registrationPayload('operator@example.test', {
      idempotency_key: 'operator-idempotency-1',
    });

    const first = await captureTishaBavRegistration({
      pool,
      config,
      payload,
      now: openWindow,
      highLevelClient: highLevel,
    });
    const second = await captureTishaBavRegistration({
      pool,
      config,
      payload,
      now: openWindow,
      highLevelClient: highLevel,
    });

    expect(first.ghl_sync_status).toBe('succeeded');
    expect(second).toMatchObject({ duplicate_submission: true, ghl_sync_status: 'succeeded' });
    expect(highLevel.workflowRequests).toHaveLength(1);
  });

  it('does not add the weekly newsletter tag without explicit consent', async () => {
    const config = testConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const highLevel = new MockHighLevelEventClient();
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('nonews@example.test', {
        newsletter_opt_in: false,
        idempotency_key: 'newsletter-no-1',
      }),
      now: openWindow,
      highLevelClient: highLevel,
    });

    expect([...highLevel.contacts.values()][0]?.tags).not.toContain('OT | Weekly Newsletter');
  });
});

describe('Tisha BAv event join access', () => {
  it('verifies registration, creates a short session, and resolves only by server redirect', async () => {
    const config = testConfig({
      ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://zoom.example.test/j/123?pwd=protected',
    });
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('join@example.test'),
      now: openWindow,
    });

    const join = await requestTishaBavJoin({
      pool,
      config,
      payload: { email: 'join@example.test', idempotency_key: 'join-idem-1', homepage: '' },
      now: openWindow,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(join.response.redirect_path).toBe('/api/v1/events/tisha-bav-2026/redirect');
    expect(JSON.stringify(join.response)).not.toContain('zoom.example.test');

    const redirect = await resolveTishaBavRedirect({
      pool,
      config,
      sessionToken: join.sessionToken,
      now: openWindow,
    });
    expect(redirect.joinUrl).toBe('https://zoom.example.test/j/123?pwd=protected');
  });

  it('blocks join before the configured window and when Zoom is not mapped', async () => {
    const config = testConfig();
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('blocked@example.test'),
      now: beforeWindow,
    });

    await expect(
      requestTishaBavJoin({
        pool,
        config,
        payload: { email: 'blocked@example.test', idempotency_key: 'join-idem-2', homepage: '' },
        now: beforeWindow,
      }),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_OPEN' });

    await expect(
      requestTishaBavJoin({
        pool,
        config,
        payload: { email: 'blocked@example.test', idempotency_key: 'join-idem-3', homepage: '' },
        now: openWindow,
      }),
    ).rejects.toMatchObject({ code: 'EVENT_UNAVAILABLE' });
  });
});

describe('Tisha BAv event HTTP routes', () => {
  it('serves the production landing HTML with immediate revalidation headers', async () => {
    const config = testConfig({
      NODE_ENV: 'production',
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-production-cache-proof',
      MFA_SECRET_ENCRYPTION_KEY: 'test-only-32-byte-mfa-key-do-not-use',
    });
    const distDir = await mkdtemp(path.join(tmpdir(), 'tisha-cache-proof-'));
    await writeFile(
      path.join(distDir, 'tisha-bav.html'),
      '<!doctype html><html><head><title>Tisha</title></head><body><p>Ki Mala Haaretz Deas Hashem</p><h1>Live Zoom class with Rabbi Eli Scheller for boys</h1><p>3 p.m. Eastern Time</p><p>No charge</p></body></html>',
    );
    const server = await startServer(config, openWindow, distDir);
    try {
      for (const routePath of ['/tisha-bav', '/tisha-bav.html']) {
        const response = await fetch(`${server.baseUrl}${routePath}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-cache, max-age=0, must-revalidate');
        expect(response.headers.get('pragma')).toBe('no-cache');
        expect(response.headers.get('expires')).toBe('0');

        const html = await response.text();
        expect(html).toContain('Ki Mala Haaretz Deas Hashem');
        expect(html).toContain('Live Zoom class with Rabbi Eli Scheller for boys');
        expect(html).toContain('3 p.m. Eastern Time');
        expect(html).toContain('No charge');
        expect(html).not.toContain('10:00 PM Israel');
        expect(html).not.toContain('Bringing Knowledge of Hashem into the World');
        expect(html).not.toContain('Filling the World with Knowledge of Hashem');
      }
    } finally {
      await server.close();
      await rm(distDir, { recursive: true, force: true });
    }
  });

  it('registers, rate limits, joins, and server-redirects through Express routes', async () => {
    const config = testConfig({
      ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://zoom.example.test/j/456?pwd=protected',
      LEAD_RATE_LIMIT_MAX: '20',
      LEAD_IDENTIFIER_RATE_LIMIT_MAX: '20',
    });
    const server = await startServer(config, openWindow);
    try {
      const register = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(registrationPayload('route@example.test')),
      });
      expect(register.status).toBe(200);
      expect(await register.json()).toMatchObject({ success: true });

      const join = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'route@example.test',
          idempotency_key: 'route-join-1',
          homepage: '',
        }),
      });
      expect(join.status).toBe(200);
      const cookie = join.headers.get('set-cookie');
      expect(cookie).toContain('ot_tisha_bav_2026_session');
      const joinJson = await join.json();
      expect(joinJson.redirect_path).toBe('/api/v1/events/tisha-bav-2026/redirect');

      const redirect = await fetch(`${server.baseUrl}${joinJson.redirect_path}`, {
        redirect: 'manual',
        headers: { cookie: cookie ?? '' },
      });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get('location')).toBe(
        'https://zoom.example.test/j/456?pwd=protected',
      );
    } finally {
      await server.close();
    }
  });

  it('uses the event route rate-limit scopes', async () => {
    const config = testConfig({ LEAD_RATE_LIMIT_MAX: '1', LEAD_IDENTIFIER_RATE_LIMIT_MAX: '20' });
    const server = await startServer(config, openWindow);
    try {
      const first = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          registrationPayload('rate1@example.test', { idempotency_key: 'rate-one-1' }),
        ),
      });
      const second = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          registrationPayload('rate2@example.test', { idempotency_key: 'rate-two-2' }),
        ),
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(await second.json()).toMatchObject({ success: false, code: 'RATE_LIMITED' });
    } finally {
      await server.close();
    }
  });
});

function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    ...overrides,
  });
}

function registrationPayload(email: string, overrides: Record<string, unknown> = {}) {
  return {
    email,
    first_name: 'Miriam',
    newsletter_opt_in: false,
    source: 'tisha_bav_2026_landing',
    idempotency_key: `event-${email}`,
    homepage: '',
    ...overrides,
  };
}

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}

async function startServer(config: AppConfig, now: Date, distDir?: string) {
  const app = createApp({
    config,
    pool,
    clock: () => now,
    ...(distDir ? { distDir } : {}),
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
