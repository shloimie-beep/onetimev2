import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { captureLead } from '../../../packages/domain/src/lead/service.ts';
import {
  recordHighLevelWebhookInbox,
  signHighLevelWebhook,
  verifyHighLevelWebhook,
} from '../../../packages/domain/src/highlevel/webhook.ts';

let pool: DbPool;

const payload = {
  contact_name: 'Miriam Parent',
  family_or_school: 'Dratler Family',
  audience_type: 'family' as const,
  location: 'Ramat Beit Shemesh',
  timezone: 'Asia/Jerusalem',
  email: 'miriam.parent@example.test',
  phone: '',
  reminder_preference: 'email' as const,
  reminder_consent: true,
  idempotency_key: 'idem-family-highlevel-1',
  attribution: { landing_path: '/signup' },
};

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('HighLevel migration and signup integration', () => {
  it('adds the 2205 projection tables without production side effects', async () => {
    await expect(
      Promise.all([
        pool.query('SELECT count(*)::int AS count FROM onetime.highlevel_parent_links'),
        pool.query('SELECT count(*)::int AS count FROM onetime.highlevel_outbox_events'),
        pool.query('SELECT count(*)::int AS count FROM onetime.highlevel_event_inbox'),
        pool.query('SELECT count(*)::int AS count FROM onetime.highlevel_entitlement_projection'),
      ]),
    ).resolves.toHaveLength(4);
  });

  it('keeps public signup local when HighLevel is disabled or unavailable', async () => {
    const config = loadTestConfig();
    const result = await captureLead({
      pool,
      config,
      payload,
      now: new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(result.success).toBe(true);
    const highLevelOutbox = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.highlevel_outbox_events',
    );
    expect(count(highLevelOutbox.rows[0].count)).toBe(0);
  });

  it('queues a local HighLevel outbox event in mock mode without a live provider call', async () => {
    const config = loadTestConfig({
      HIGHLEVEL_MODE: 'mock',
      HIGHLEVEL_SYNC_ENABLED: 'true',
    });
    const result = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email: 'mock.highlevel@example.test',
        phone: '050-111-2222',
        reminder_preference: 'both',
        idempotency_key: 'idem-family-highlevel-mock-1',
      },
      now: new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(result.success).toBe(true);
    const outbox = await pool.query(
      `SELECT event_type, status, protected_payload
         FROM onetime.highlevel_outbox_events
        ORDER BY created_at`,
    );
    expect(outbox.rowCount).toBe(1);
    expect(outbox.rows[0]).toMatchObject({
      event_type: 'lead.created',
      status: 'pending',
    });
    expect(JSON.stringify(outbox.rows[0].protected_payload)).toContain('OT | Signup Website');
    expect(JSON.stringify(outbox.rows[0].protected_payload)).not.toMatch(/student/i);
  });

  it('dedupes webhook inbox events by provider event ID', async () => {
    const config = loadTestConfig({
      HIGHLEVEL_MODE: 'provider',
      HIGHLEVEL_LOCATION_ID: 'loc_test_123',
      HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'pit_test_token_123456',
      HIGHLEVEL_OUTBOUND_WEBHOOK_SECRET: 'test-highlevel-webhook-secret',
    });
    const now = new Date('2026-07-20T10:00:00.000Z');
    const rawBody = Buffer.from(
      JSON.stringify({
        provider_event_id: 'evt_payment_failed_inbox',
        event_type: 'payment.failed',
        location_id: 'loc_test_123',
        contact_id: 'contact_123',
        subscription_id: 'sub_123',
        occurred_at: now.toISOString(),
      }),
    );
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const verified = verifyHighLevelWebhook({
      config,
      rawBody,
      headers: {
        contentType: 'application/json',
        signature: signHighLevelWebhook({
          rawBody,
          timestamp,
          secret: String(config.highLevelOutboundWebhookSecret),
        }),
        timestamp,
        eventId: 'evt_payment_failed_inbox',
      },
      now,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error('webhook_not_verified');

    expect(
      await recordHighLevelWebhookInbox({
        target: pool,
        payload: verified.payload,
        payloadDigest: verified.digest,
        receivedAt: now,
      }),
    ).toBe('first_seen');
    expect(
      await recordHighLevelWebhookInbox({
        target: pool,
        payload: verified.payload,
        payloadDigest: verified.digest,
        receivedAt: now,
      }),
    ).toBe('duplicate');
    const inbox = await pool.query(
      'SELECT count(*)::int AS count, dedupe_state, replay_state FROM onetime.highlevel_event_inbox GROUP BY dedupe_state, replay_state',
    );
    expect(count(inbox.rows[0].count)).toBe(1);
    expect(inbox.rows[0]).toMatchObject({ dedupe_state: 'duplicate', replay_state: 'replayed' });
  });
});

function loadTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ...overrides,
  });
}

function count(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}
