import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { DELIVERY_EVENT_TYPES } from '../../packages/contracts/src/delivery/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { captureLead, processOutboxSink } from '../../packages/domain/src/index.ts';
import type { AppConfig } from '../../packages/config/src/index.ts';

let pool: DbPool;
let config: AppConfig;

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
  idempotency_key: 'idem-family-1',
  attribution: { landing_path: '/signup' },
};

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
});

afterEach(async () => {
  await pool.end();
});

describe('lead capture transaction', () => {
  it('writes one Family lead, contact, audit event, and deterministic outbox intents', async () => {
    const result = await captureLead({ pool, config, payload });
    expect(result.success).toBe(true);
    expect(result.duplicate_submission).toBe(false);
    expect(result.message.heading).toBe("You're signed up.");
    expect(result.outbox_intents).toHaveLength(2);

    await expectCount('contacts', 1);
    await expectCount('signup_leads', 1);
    await expectCount('audit_events', 1);
    await expectCount('outbox_events', 2);
  });

  it('replays the same idempotency key without duplicating persistence', async () => {
    const first = await captureLead({ pool, config, payload });
    const second = await captureLead({ pool, config, payload });
    expect(second.duplicate_submission).toBe(true);
    expect(second.contact_key).toBe(first.contact_key);
    expect(second.signup_key).toBe(first.signup_key);
    const count = await pool.query('SELECT count(*)::int AS outbox FROM onetime.outbox_events');
    expect(count.rows[0].outbox).toBe(2);
  });

  it('handles School classification without private class-link exposure', async () => {
    const school = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        audience_type: 'school',
        family_or_school: 'North School',
        email: 'school@example.test',
        idempotency_key: 'idem-school-1',
      },
    });
    expect(school.message.heading).toBe('Thank you.');
    expect(JSON.stringify(school)).not.toContain('class_link');
    const row = await pool.query('SELECT family_school_classification FROM onetime.contacts');
    expect(row.rows[0].family_school_classification).toBe('school');
    const outbox = await pool.query(
      'SELECT event_type, channel, payload FROM onetime.outbox_events ORDER BY event_type, channel',
    );
    expect(outbox.rows.map((outboxRow) => `${outboxRow.event_type}:${outboxRow.channel}`)).toEqual([
      `${DELIVERY_EVENT_TYPES.internalLeadAlert}:internal_email`,
      `${DELIVERY_EVENT_TYPES.schoolSignupEmailAck}:email`,
    ]);
    expect(JSON.stringify(outbox.rows)).not.toMatch(/class_link|class target|https?:\/\//i);
  });

  it('queues public WhatsApp only when channel, phone, and consent allow it', async () => {
    const both = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email: 'both@example.test',
        idempotency_key: 'idem-both-1',
        phone: '050-111-2222',
        reminder_preference: 'both',
      },
    });
    expect(both.outbox_intents).toHaveLength(3);
    const rows = await pool.query(
      "SELECT event_type, channel, payload FROM onetime.outbox_events WHERE channel = 'whatsapp'",
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].event_type).toBe(DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation);
    expect(rows.rows[0].payload.public_recipient).toBe(true);
  });

  it('queues a School WhatsApp receipt only when channel, phone, and consent allow it', async () => {
    const school = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        audience_type: 'school',
        family_or_school: 'North School',
        email: 'school-both@example.test',
        idempotency_key: 'idem-school-both-1',
        phone: '050-222-3333',
        reminder_preference: 'both',
      },
    });
    expect(school.outbox_intents).toHaveLength(3);
    const rows = await pool.query(
      'SELECT event_type, channel, payload FROM onetime.outbox_events WHERE contact_key = $1 ORDER BY event_type, channel',
      [school.contact_key],
    );
    expect(rows.rows.map((row) => `${row.event_type}:${row.channel}`)).toEqual([
      `${DELIVERY_EVENT_TYPES.internalLeadAlert}:internal_email`,
      `${DELIVERY_EVENT_TYPES.schoolSignupEmailAck}:email`,
      `${DELIVERY_EVENT_TYPES.schoolSignupWhatsAppReceipt}:whatsapp`,
    ]);
    expect(JSON.stringify(rows.rows)).not.toMatch(/class_link|class target|https?:\/\//i);
  });

  it('queues a Family email acknowledgement when reminder preference is none', async () => {
    const none = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email: 'none@example.test',
        idempotency_key: 'idem-none-1',
        reminder_preference: 'none',
        reminder_consent: false,
      },
    });
    expect(none.outbox_intents).toHaveLength(2);
    const rows = await pool.query(
      'SELECT event_type, channel FROM onetime.outbox_events WHERE contact_key = $1 ORDER BY event_type, channel',
      [none.contact_key],
    );
    expect(rows.rows.map((row) => `${row.event_type}:${row.channel}`)).toEqual([
      `${DELIVERY_EVENT_TYPES.familySignupEmailAck}:email`,
      `${DELIVERY_EVENT_TYPES.internalLeadAlert}:internal_email`,
    ]);
  });

  it('sink worker delivers deterministic intents without external transport', async () => {
    await captureLead({ pool, config, payload });
    const sink = await processOutboxSink(pool);
    expect(sink.delivered).toBe(2);
    const rows = await pool.query(
      "SELECT count(*)::int AS delivered FROM onetime.outbox_events WHERE status = 'sink_delivered'",
    );
    expect(rows.rows[0].delivered).toBe(2);
  });
});

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}
