import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import type { TishaBavRegistrationPayload } from '../../packages/contracts/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  captureTishaBavRegistration,
  MockHighLevelEventClient,
  reprocessTishaBavRegistrationDelivery,
  requestTishaBavJoin,
  resolveTishaBavRedirect,
  runTishaBavEventEmailFallbackBatch,
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
      confirmation_queued: false,
      ghl_sync_status: 'provider_off',
      message: {
        heading: 'Thank you — your spot has been reserved.',
        body: 'Your spot is reserved, but event email delivery is not confirmed yet.',
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
    const permission = await pool.query(
      `SELECT status, permission_scope, disclosure_version
         FROM onetime.event_email_permissions
        WHERE event_code = 'tisha-bav-2026'`,
    );
    expect(permission.rows[0]).toMatchObject({
      status: 'granted',
      permission_scope: 'event_service_email',
      disclosure_version: 'tisha-bav-2026-event-email-v1',
    });
    await expectCount('account_lifecycle_delivery_outbox', 0);
    await expectCount('auth_email_challenge_delivery_outbox', 0);
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

  it('queues and processes the exact bounded confirmation only after HighLevel is provider-off', async () => {
    const config = fallbackConfig();
    const registration = await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('fallback@example.test'),
      now: openWindow,
    });

    expect(registration).toMatchObject({
      confirmation_queued: true,
      ghl_sync_status: 'provider_off',
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
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: 'provider-message-private' }, { status: 200 }));
    const summary = await runTishaBavEventEmailFallbackBatch({
      pool,
      config,
      now: openWindow,
      fetchImpl,
    });
    expect(summary).toMatchObject({ claimed: 1, delivered: 1, external_send_performed: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const sendBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(sendBody.to).toEqual(['fallback@example.test']);
    expect(JSON.stringify(sendBody)).not.toMatch(/zoom\.us|zoommtg|pwd=/i);
  });

  it('rejects newsletter permission on the event registration contract', async () => {
    await expect(
      captureTishaBavRegistration({
        pool,
        config: testConfig(),
        payload: registrationPayload('newsletter@example.test', {
          newsletter_opt_in: true,
          idempotency_key: 'newsletter-yes-1',
        }),
        now: openWindow,
      }),
    ).rejects.toThrow();
    await expectCount('event_registrations', 0);
    await expectCount('event_email_permissions', 0);
  });

  it('materializes one event-only permission for an exact pre-2220 registration and reprocesses idempotently', async () => {
    const initial = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('reprocess@example.test', {
        idempotency_key: 'provider-off-reprocess-1',
      }),
      now: openWindow,
    });
    await pool.query(
      `DELETE FROM onetime.event_email_permissions
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    await pool.query(
      `DELETE FROM onetime.event_email_permission_events
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    await expectCount('event_email_permissions', 0);
    await expectCount('event_email_permission_events', 0);

    const highLevel = new MockHighLevelEventClient();
    const reprocessInput = {
      pool,
      config: fallbackConfig({
        HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
        HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
      }),
      registrationKey: initial.registration_key ?? '',
      now: openWindow,
      highLevelClient: highLevel,
    };
    const result = await reprocessTishaBavRegistrationDelivery(reprocessInput);

    expect(result).toEqual({ status: 'succeeded', fallback_queued: false });
    expect(highLevel.tags.has("OT | Event | Tisha B'Av 2026 | Registered")).toBe(true);
    expect([...highLevel.contacts.values()][0]?.tags).not.toContain('OT | Weekly Newsletter');
    expect(highLevel.workflowRequests).toHaveLength(1);
    await expectCount('event_registrations', 1);
    await expectCount('event_delivery_events', 1);
    const permission = await pool.query(
      `SELECT registration_key, status, permission_scope, disclosure_version
         FROM onetime.event_email_permissions
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    expect(permission.rows).toEqual([
      expect.objectContaining({
        registration_key: initial.registration_key,
        status: 'granted',
        permission_scope: 'event_service_email',
        disclosure_version: 'legacy:tisha-bav-2026-service-v1',
      }),
    ]);
    const permissionEvents = await pool.query(
      `SELECT action, metadata
         FROM onetime.event_email_permission_events
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    expect(permissionEvents.rows).toEqual([
      expect.objectContaining({
        action: 'granted',
        metadata: expect.objectContaining({
          materialized_from_existing_registration: true,
          event_only: true,
          newsletter_permission_granted: false,
          student_contact: false,
        }),
      }),
    ]);

    const replay = await reprocessTishaBavRegistrationDelivery(reprocessInput);
    expect(replay).toEqual({ status: 'succeeded', fallback_queued: false });
    expect(highLevel.workflowRequests).toHaveLength(1);
    await expectCount('event_email_permissions', 1);
    await expectCount('event_email_permission_events', 1);
  });

  it('denies legacy materialization when the exact registration lacks stored event-consent proof', async () => {
    const initial = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('legacy-no-proof@example.test', {
        idempotency_key: 'legacy-no-proof-1',
      }),
      now: openWindow,
    });
    await pool.query(
      `DELETE FROM onetime.event_email_permissions
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    await pool.query(
      `DELETE FROM onetime.event_email_permission_events
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    await pool.query(
      `UPDATE onetime.event_registrations
          SET metadata = '{"event_service_consent":{"purpose":"unknown","channels":[]}}'::jsonb
        WHERE registration_key = $1`,
      [initial.registration_key],
    );
    const highLevel = new MockHighLevelEventClient();
    const result = await reprocessTishaBavRegistrationDelivery({
      pool,
      config: fallbackConfig({
        HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
        HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
      }),
      registrationKey: initial.registration_key ?? '',
      now: openWindow,
      highLevelClient: highLevel,
    });

    expect(result).toEqual({ status: 'skipped', fallback_queued: false });
    expect(highLevel.workflowRequests).toHaveLength(0);
    await expectCount('event_email_permissions', 0);
    await expectCount('event_email_permission_events', 0);
    const deliveries = await pool.query(
      `SELECT provider, status
         FROM onetime.event_delivery_events
        WHERE registration_key = $1
        ORDER BY provider`,
      [initial.registration_key],
    );
    expect(deliveries.rows).toEqual([
      expect.objectContaining({ provider: 'highlevel', status: 'skipped' }),
    ]);
  });

  it('allows only one concurrent HighLevel reprocess when no fallback row exists', async () => {
    const initial = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('reprocess-race@example.test', {
        idempotency_key: 'provider-off-reprocess-race-1',
      }),
      now: openWindow,
    });
    const highLevel = new MockHighLevelEventClient();
    const originalAddToWorkflow = highLevel.addToWorkflow.bind(highLevel);
    let releaseWorkflow!: () => void;
    const workflowGate = new Promise<void>((resolve) => {
      releaseWorkflow = resolve;
    });
    let reportWorkflowStarted!: () => void;
    const workflowStarted = new Promise<void>((resolve) => {
      reportWorkflowStarted = resolve;
    });
    highLevel.addToWorkflow = async (request) => {
      reportWorkflowStarted();
      await workflowGate;
      await originalAddToWorkflow(request);
    };
    const config = fallbackConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const first = reprocessTishaBavRegistrationDelivery({
      pool,
      config,
      registrationKey: initial.registration_key ?? '',
      now: openWindow,
      highLevelClient: highLevel,
    });
    await workflowStarted;
    const second = await reprocessTishaBavRegistrationDelivery({
      pool,
      config,
      registrationKey: initial.registration_key ?? '',
      now: openWindow,
      highLevelClient: highLevel,
    });
    expect(second).toEqual({ status: 'blocked', fallback_queued: false });
    releaseWorkflow();
    await expect(first).resolves.toEqual({ status: 'succeeded', fallback_queued: false });
    expect(highLevel.workflowRequests).toHaveLength(1);
  });

  it('prevents the fallback worker from claiming while a HighLevel reprocess owns the row', async () => {
    const config = fallbackConfig();
    const initial = await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('fallback-race@example.test', {
        idempotency_key: 'fallback-reprocess-race-1',
      }),
      now: openWindow,
    });
    const highLevel = new MockHighLevelEventClient();
    const originalAddToWorkflow = highLevel.addToWorkflow.bind(highLevel);
    let releaseWorkflow!: () => void;
    const workflowGate = new Promise<void>((resolve) => {
      releaseWorkflow = resolve;
    });
    let reportWorkflowStarted!: () => void;
    const workflowStarted = new Promise<void>((resolve) => {
      reportWorkflowStarted = resolve;
    });
    highLevel.addToWorkflow = async (request) => {
      reportWorkflowStarted();
      await workflowGate;
      await originalAddToWorkflow(request);
    };
    const reprocess = reprocessTishaBavRegistrationDelivery({
      pool,
      config: fallbackConfig({
        HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
        HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
      }),
      registrationKey: initial.registration_key ?? '',
      now: openWindow,
      highLevelClient: highLevel,
    });
    await workflowStarted;
    const fallbackFetch = vi.fn<typeof fetch>();
    const fallbackBatch = await runTishaBavEventEmailFallbackBatch({
      pool,
      config,
      now: openWindow,
      fetchImpl: fallbackFetch,
    });
    expect(fallbackBatch).toEqual({
      claimed: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      external_send_performed: false,
    });
    expect(fallbackFetch).not.toHaveBeenCalled();
    releaseWorkflow();
    await expect(reprocess).resolves.toEqual({ status: 'succeeded', fallback_queued: false });
    const fallback = await pool.query(
      `SELECT status, lease_owner_hash, lease_expires_at
         FROM onetime.event_delivery_events
        WHERE registration_key = $1
          AND provider = 'resend_fallback'`,
      [initial.registration_key],
    );
    expect(fallback.rows).toEqual([
      expect.objectContaining({
        status: 'skipped',
        lease_owner_hash: null,
        lease_expires_at: null,
      }),
    ]);
    expect(highLevel.workflowRequests).toHaveLength(1);
  });

  it('queues fallback only after a proven HighLevel workflow failure', async () => {
    const config = fallbackConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const highLevel = new MockHighLevelEventClient();
    highLevel.addToWorkflow = async () => {
      throw new Error('workflow_enrollment_rejected');
    };
    const result = await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('workflow-failed@example.test'),
      now: openWindow,
      highLevelClient: highLevel,
    });
    expect(result).toMatchObject({ ghl_sync_status: 'pending', confirmation_queued: true });
    const deliveries = await pool.query(
      `SELECT provider, status
         FROM onetime.event_delivery_events
        WHERE registration_key = $1
        ORDER BY provider`,
      [result.registration_key],
    );
    expect(deliveries.rows).toEqual([
      expect.objectContaining({ provider: 'highlevel', status: 'failed' }),
      expect.objectContaining({ provider: 'resend_fallback', status: 'pending' }),
    ]);
  });

  it('lets hard-bounce permission state win over re-registration', async () => {
    const first = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('suppressed@example.test'),
      now: openWindow,
    });
    await pool.query(
      `UPDATE onetime.event_email_permissions
          SET status = 'hard_bounced', deny_reason = 'provider_hard_bounce'
        WHERE registration_key = $1`,
      [first.registration_key],
    );
    const replay = await captureTishaBavRegistration({
      pool,
      config: fallbackConfig({
        HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
        HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
      }),
      payload: registrationPayload('suppressed@example.test', {
        idempotency_key: 'suppressed-second-registration',
      }),
      now: openWindow,
      highLevelClient: new MockHighLevelEventClient(),
    });
    expect(replay).toMatchObject({ ghl_sync_status: 'skipped', confirmation_queued: false });
    const permission = await pool.query(
      `SELECT status FROM onetime.event_email_permissions WHERE registration_key = $1`,
      [first.registration_key],
    );
    expect(permission.rows[0]?.status).toBe('hard_bounced');
    const fallback = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.event_delivery_events
        WHERE registration_key = $1 AND provider = 'resend_fallback'`,
      [first.registration_key],
    );
    expect(fallback.rows[0]?.count).toBe(0);
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

  it('claims the public HighLevel delivery once across concurrent same-idempotency submissions', async () => {
    const config = testConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'wf_tisha_bav_confirmation',
    });
    const highLevel = new MockHighLevelEventClient();
    const originalAddToWorkflow = highLevel.addToWorkflow.bind(highLevel);
    let releaseWorkflow!: () => void;
    const workflowGate = new Promise<void>((resolve) => {
      releaseWorkflow = resolve;
    });
    let reportWorkflowStarted!: () => void;
    const workflowStarted = new Promise<void>((resolve) => {
      reportWorkflowStarted = resolve;
    });
    highLevel.addToWorkflow = async (request) => {
      reportWorkflowStarted();
      await workflowGate;
      await originalAddToWorkflow(request);
    };
    const payload = registrationPayload('public-race@example.test', {
      idempotency_key: 'public-same-idempotency-race-1',
    });

    const first = captureTishaBavRegistration({
      pool,
      config,
      payload,
      now: openWindow,
      highLevelClient: highLevel,
    });
    await workflowStarted;
    const second = await captureTishaBavRegistration({
      pool,
      config,
      payload,
      now: openWindow,
      highLevelClient: highLevel,
    });

    expect(second).toMatchObject({
      duplicate_submission: true,
      ghl_sync_status: 'pending',
      confirmation_queued: false,
    });
    releaseWorkflow();
    await expect(first).resolves.toMatchObject({
      ghl_sync_status: 'succeeded',
      confirmation_queued: true,
    });
    expect(highLevel.workflowRequests).toHaveLength(1);
    const deliveries = await pool.query(
      `SELECT provider, status, lease_owner_hash, lease_expires_at
         FROM onetime.event_delivery_events
        WHERE event_code = 'tisha-bav-2026'`,
    );
    expect(deliveries.rows).toEqual([
      expect.objectContaining({
        provider: 'highlevel',
        status: 'succeeded',
        lease_owner_hash: null,
        lease_expires_at: null,
      }),
    ]);
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
      [
        '<!doctype html><html><head><title>Tisha</title>',
        '<meta property="og:image" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<meta property="og:image:secure_url" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<meta property="og:image:type" content="image/png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="One Time logo for the Tisha B&#39;Av live Zoom class">',
        '<meta name="twitter:image" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<link rel="icon" type="image/png" href="/assets/events/tisha-bav-2026/tisha-bav-favicon-v20260722.png">',
        '<link rel="apple-touch-icon" href="/assets/events/tisha-bav-2026/tisha-bav-apple-touch-icon-v20260722.png">',
        '</head><body><p lang="he" dir="rtl">כי מלאה הארץ דעה את השם</p><h1>Live Zoom class with Rabbi Eli Scheller for boys</h1><p>Live class with Rabbi Eli Scheller</p><p>3 p.m. Eastern Time</p><p>No charge</p><button>Reserve My Spot</button><p>By reserving, you’ll receive emails about this event.</p></body></html>',
      ].join(''),
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
        expect(html).toContain('כי מלאה הארץ דעה את השם');
        expect(html).toContain('Live Zoom class with Rabbi Eli Scheller for boys');
        expect(html).toContain('Live class with Rabbi Eli Scheller');
        expect(html).toContain('3 p.m. Eastern Time');
        expect(html).toContain('No charge');
        expect(html).toContain('By reserving, you’ll receive emails about this event.');
        expect(html).toContain('tisha-bav-social-card-v20260722.png');
        expect(html).toContain('<meta property="og:image:type" content="image/png">');
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="630">');
        expect(html).toContain('tisha-bav-favicon-v20260722.png');
        expect(html).toContain('tisha-bav-apple-touch-icon-v20260722.png');
        expect(html).not.toContain('10:00 PM Israel');
        expect(html).not.toContain('Ki Mala Haaretz Deas Hashem');
        expect(html).not.toContain('Bringing Knowledge of Hashem into the World');
        expect(html).not.toContain('Filling the World with Knowledge of Hashem');
        expect(html).not.toContain('Rabbi Elly');
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

function registrationPayload(
  email: string,
  overrides: Record<string, unknown> = {},
): TishaBavRegistrationPayload {
  return {
    email,
    first_name: 'Miriam',
    newsletter_opt_in: false as const,
    source: 'tisha_bav_2026_landing',
    idempotency_key: `event-${email}`,
    homepage: '',
    ...overrides,
  } as TishaBavRegistrationPayload;
}

function fallbackConfig(overrides: NodeJS.ProcessEnv = {}) {
  return testConfig({
    ONE_TIME_EVENT_EMAIL_FALLBACK: 'resend',
    RESEND_API_KEY: 'test-only-resend-key',
    ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
    ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
    DELIVERY_PROVIDER_AUTHORIZATION_ID: 'test-only-tisha-fallback-authorization',
    DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
    DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
    ...overrides,
  });
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
