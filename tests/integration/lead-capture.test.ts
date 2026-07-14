import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  LeadDuplicateIdentityError,
  LeadIdempotencyConflictError,
  captureLead,
  processOutboxSink,
  stableKey,
} from '../../packages/domain/src/index.ts';
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
    expect(result.contact_key).toMatch(/^contact_/);
    expect(result.contact_key).not.toBe(
      stableKey('contact', [config.accountKey, config.productKey, payload.email]),
    );

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

  it('rejects idempotency key reuse with a different canonical payload without writing rows', async () => {
    await captureLead({ pool, config, payload });
    await expect(
      captureLead({
        pool,
        config,
        payload: {
          ...payload,
          email: 'different@example.test',
        },
      }),
    ).rejects.toBeInstanceOf(LeadIdempotencyConflictError);

    await expectCount('contacts', 1);
    await expectCount('signup_leads', 1);
    await expectCount('audit_events', 1);
    await expectCount('outbox_events', 2);
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
  });

  it('queues public WhatsApp only when channel, phone, and consent allow it', async () => {
    const both = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email: 'both@example.test',
        idempotency_key: 'idem-both-1',
        phone: '+972 50-111-2222',
        reminder_preference: 'both',
      },
    });
    expect(both.outbox_intents).toHaveLength(3);
    const rows = await pool.query(
      "SELECT channel, payload FROM onetime.outbox_events WHERE channel = 'whatsapp'",
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].payload.public_recipient).toBe(true);
  });

  it('rejects same-phone different-email public signup without leaking or partially writing', async () => {
    await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email: 'phone-one@example.test',
        idempotency_key: 'idem-phone-one',
        phone: '+1 212 555 0199',
        reminder_preference: 'email',
      },
    });

    await expect(
      captureLead({
        pool,
        config,
        payload: {
          ...payload,
          email: 'phone-two@example.test',
          idempotency_key: 'idem-phone-two',
          phone: '001-212-555-0199',
          reminder_preference: 'email',
        },
      }),
    ).rejects.toBeInstanceOf(LeadDuplicateIdentityError);

    await expectCount('contacts', 1);
    await expectCount('signup_leads', 1);
    await expectCount('audit_events', 1);
    await expectCount('outbox_events', 2);
  });

  it('reactivates exact-email archived contacts while preserving CRM-owned fields', async () => {
    const email = 'archived@example.test';
    const contactKey = stableKey('contact', [config.accountKey, config.productKey, email]);
    const publicId = 'contact_archived_public';
    await pool.query(
      `INSERT INTO onetime.contacts
       (contact_key, public_id, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, phone_normalized,
        reminder_preference, suppression_state, source, lead_status, assigned_user_key,
        internal_note, archived_at)
       VALUES ($1,$2,$3,$4,'CRM Owned Name','school','CRM School','CRM Location',
        'America/New_York',$5,'+12125550000','none','suppressed_no_consent','manual_crm',
        'archived','user_preserve','Keep this note.',now())`,
      [contactKey, publicId, config.accountKey, config.productKey, email],
    );

    const result = await captureLead({
      pool,
      config,
      payload: {
        ...payload,
        email,
        phone: '+1 212 555 0101',
        reminder_preference: 'email',
        reminder_consent: true,
        idempotency_key: 'idem-archived-reactivation',
      },
    });
    expect(result.contact_key).toBe(publicId);

    const row = await pool.query(
      `SELECT display_name, family_school_classification, family_or_school, location_text,
              timezone, phone_normalized, reminder_preference, consent_recorded_at,
              suppression_state, source, lead_status, assigned_user_key, internal_note,
              archived_at, version
         FROM onetime.contacts
        WHERE contact_key = $1`,
      [contactKey],
    );
    expect(row.rows[0]).toMatchObject({
      display_name: 'CRM Owned Name',
      family_school_classification: 'school',
      family_or_school: 'CRM School',
      location_text: 'CRM Location',
      timezone: 'America/New_York',
      phone_normalized: '+12125550000',
      reminder_preference: 'email',
      suppression_state: 'active',
      source: 'manual_crm',
      lead_status: 'new',
      assigned_user_key: 'user_preserve',
      internal_note: 'Keep this note.',
    });
    expect(row.rows[0].archived_at).toBeNull();
    expect(row.rows[0].consent_recorded_at).toBeTruthy();
    expect(Number(row.rows[0].version)).toBe(2);

    const audit = await pool.query(
      "SELECT count(*)::int AS count FROM onetime.audit_events WHERE event_type = 'public_signup_reactivated_archived_contact'",
    );
    expect(audit.rows[0].count).toBe(1);
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
