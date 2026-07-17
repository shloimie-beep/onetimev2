import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  consumeWhatsAppAccountLink,
  createAccountUser,
  processQueuedWhatsAppOutbox,
  receiveWhatsAppWebhook,
  SinkWhatsAppProviderAdapter,
  WHATSAPP_ASSISTANT_COPY,
} from '../../../packages/domain/src/index.ts';
import { decryptForWhatsApp } from '../../../packages/domain/src/whatsapp/crypto.ts';

const PHONE = '+14155552671';
const NOW = new Date('2026-07-15T16:00:00.000Z');
const LATER = new Date('2099-01-01T00:00:00.000Z');

let pool: DbPool;
let config: AppConfig;
let adapter: SinkWhatsAppProviderAdapter;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY: 'ot85_test_provider',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  adapter = new SinkWhatsAppProviderAdapter();
});

afterEach(async () => {
  await pool.end();
});

describe('OT-85 WhatsApp assistant', () => {
  it('opens with the W12-06 public assistant copy and stores no raw reply body', async () => {
    await send('copy-1', 'Hello');

    const messages = await outboxMessages();
    expect(messages).toEqual([
      expect.objectContaining({
        message_kind: 'QUALIFY_AUDIENCE',
        body: WHATSAPP_ASSISTANT_COPY.openingQuestion,
      }),
    ]);
    expect(messages[0]?.metadata).toMatchObject({
      raw_body_present: false,
      raw_recipient_present: false,
    });
  });

  it('captures a Family WhatsApp lead with encrypted inbox/outbox and explicit reminder consent', async () => {
    await send('family-1', 'I want to sign up my family');
    await send('family-2', 'Miriam Parent');
    await send('family-3', 'WhatsApp');
    await send('family-4', 'yes');

    const contacts = await pool.query(
      `SELECT display_name, family_school_classification, phone_normalized, reminder_preference,
              consent_recorded_at, source
         FROM onetime.contacts`,
    );
    expect(contacts.rowCount).toBe(1);
    expect(contacts.rows[0]).toMatchObject({
      display_name: 'Miriam Parent',
      family_school_classification: 'family',
      phone_normalized: null,
      reminder_preference: 'whatsapp',
      source: 'one_time_whatsapp_assistant',
    });
    expect(contacts.rows[0].consent_recorded_at).toBeTruthy();

    const lead = await pool.query(
      `SELECT classification, metadata
         FROM onetime.signup_leads`,
    );
    expect(lead.rowCount).toBe(1);
    expect(lead.rows[0].classification).toBe('family');
    expect(lead.rows[0].metadata.no_class_link_sent).toBe(true);

    const consent = await pool.query(
      `SELECT event_type, consent_scope
         FROM onetime.whatsapp_consent_events
        ORDER BY recorded_at ASC`,
    );
    expect(consent.rows).toEqual([
      expect.objectContaining({ event_type: 'granted', consent_scope: 'family_reminders' }),
    ]);

    const encrypted = await pool.query(
      `SELECT message_ciphertext, metadata
         FROM onetime.whatsapp_inbox_events
        ORDER BY received_at ASC`,
    );
    expect(JSON.stringify(encrypted.rows)).not.toContain(PHONE);
    expect(JSON.stringify(encrypted.rows)).not.toContain('Miriam Parent');
    expect(encrypted.rows[0].metadata.raw_sender_present).toBe(false);

    const outbox = await pool.query(
      `SELECT message_kind, body_ciphertext, metadata
         FROM onetime.whatsapp_outbox_messages
        ORDER BY created_at ASC`,
    );
    expect(outbox.rows.map((row) => row.message_kind)).toContain('FAMILY_LEAD_ACK');
    expect(JSON.stringify(outbox.rows)).not.toContain(PHONE);
    expect(JSON.stringify(outbox.rows)).not.toContain('class link');
    expect(outbox.rows.every((row) => row.metadata.raw_body_present === false)).toBe(true);
  });

  it('captures School interest as lead-only with no household, portal, reminder, access, or class-link side effects', async () => {
    await send('school-1', 'Our school is interested in the program');
    await send('school-2', 'Rabbi School Contact');
    await send('school-3', 'phone');

    const contacts = await pool.query(
      `SELECT family_school_classification, reminder_preference
         FROM onetime.contacts`,
    );
    expect(contacts.rows[0]).toMatchObject({
      family_school_classification: 'school',
      reminder_preference: 'none',
    });

    const lead = await pool.query(
      `SELECT metadata
         FROM onetime.signup_leads`,
    );
    expect(lead.rows[0].metadata).toMatchObject({
      no_household_created: true,
      no_portal_created: true,
      no_class_access_created: true,
      no_class_link_sent: true,
    });

    const leadEvents = await pool.query(
      `SELECT event_type, metadata
         FROM onetime.whatsapp_lead_events`,
    );
    expect(leadEvents.rows[0]).toMatchObject({
      event_type: 'school_lead_captured',
    });
    expect(leadEvents.rows[0].metadata.school_lead_only).toBe(true);

    await expectCount('portal_households', 0);
    await expectCount('portal_student_access_state', 0);
    const outbox = await pool.query(
      `SELECT message_kind
         FROM onetime.whatsapp_outbox_messages`,
    );
    expect(outbox.rows.map((row) => row.message_kind)).toContain('SCHOOL_LEAD_ACK');
    expect(outbox.rows.map((row) => row.message_kind)).not.toContain(
      'ASK_FAMILY_REMINDER_PREFERENCE',
    );
  });

  it('applies STOP before intent processing, suppresses queued messages, and resumes only reactive conversation on START', async () => {
    await send('stop-1', 'I want to sign up my family');
    await send('stop-2', 'STOP');
    await send('stop-3', 'I want to sign up my family');
    await send('stop-4', 'START');

    const suppression = await pool.query(
      `SELECT status, reason
         FROM onetime.whatsapp_suppressions
        ORDER BY created_at ASC`,
    );
    expect(suppression.rows).toEqual([
      expect.objectContaining({ status: 'released', reason: 'user_stop' }),
    ]);

    const conversations = await pool.query(
      `SELECT state, suppression_state
         FROM onetime.whatsapp_conversations`,
    );
    expect(conversations.rows[0]).toMatchObject({
      state: 'PUBLIC_IDLE',
      suppression_state: 'active',
    });

    const outbox = await pool.query(
      `SELECT message_kind, status
         FROM onetime.whatsapp_outbox_messages
        ORDER BY created_at ASC`,
    );
    expect(outbox.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message_kind: 'ASK_GUARDIAN_NAME', status: 'suppressed' }),
        expect.objectContaining({ message_kind: 'STOP_CONFIRMATION', status: 'queued' }),
        expect.objectContaining({ message_kind: 'SUPPRESSION_STATE_NOTICE', status: 'queued' }),
        expect.objectContaining({ message_kind: 'START_CONFIRMATION', status: 'queued' }),
      ]),
    );

    const consents = await pool.query(
      `SELECT event_type, consent_scope
         FROM onetime.whatsapp_consent_events
        ORDER BY recorded_at ASC`,
    );
    expect(consents.rows.map((row) => `${row.event_type}:${row.consent_scope}`)).toEqual([
      'revoked:reactive_conversation',
      'resumed:reactive_conversation',
    ]);
  });

  it('dedupes provider replay without duplicate processing', async () => {
    const first = await send('replay-1', 'I want to sign up my family');
    const second = await send('replay-1', 'I want to sign up my family');
    expect(first.accepted).toBe(1);
    expect(second.duplicates).toBe(1);
    await expectCount('whatsapp_inbox_events', 1);
    await expectCount('whatsapp_outbox_messages', 1);
  });

  it('rate-limits public assistant chatter before mutating lead records', async () => {
    config.whatsappAssistantSenderRateLimitMax = 1;

    await send('rate-1', 'Hello');
    await send('rate-2', 'I want to sign up my family');

    await expectCount('contacts', 0);
    await expectCount('signup_leads', 0);

    const messages = await outboxMessages();
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message_kind: 'UNKNOWN_FALLBACK',
          body: WHATSAPP_ASSISTANT_COPY.rateLimited,
          metadata: expect.objectContaining({
            rate_limited: true,
            limit_scope: 'whatsapp_assistant_sender',
          }),
        }),
      ]),
    );
  });

  it('suppresses abusive public chats with redacted audit metadata and no lead side effects', async () => {
    await send('abuse-1', 'you stupid spam bot');

    await expectCount('contacts', 0);
    await expectCount('signup_leads', 0);

    const suppression = await pool.query(
      `SELECT status, reason
         FROM onetime.whatsapp_suppressions`,
    );
    expect(suppression.rows).toEqual([
      expect.objectContaining({ status: 'active', reason: 'abuse' }),
    ]);

    const conversations = await pool.query(
      `SELECT state, suppression_state
         FROM onetime.whatsapp_conversations`,
    );
    expect(conversations.rows[0]).toMatchObject({
      state: 'SUPPRESSED',
      suppression_state: 'suppressed',
    });

    const events = await pool.query(
      `SELECT event_type, metadata
         FROM onetime.whatsapp_lead_events`,
    );
    expect(events.rows).toEqual([
      expect.objectContaining({
        event_type: 'human_handoff_requested',
        metadata: expect.objectContaining({
          reason: 'abuse_detected',
          raw_body_stored: false,
        }),
      }),
    ]);

    const messages = await outboxMessages();
    expect(messages).toEqual([
      expect.objectContaining({
        message_kind: 'SUPPRESSION_STATE_NOTICE',
        body: WHATSAPP_ASSISTANT_COPY.abuseSuppressed,
        metadata: expect.objectContaining({
          abuse_detected: true,
          raw_body_stored: false,
        }),
      }),
    ]);
  });

  it('blocks private data, billing, class-link, CRM, and ticket requests without creating leads', async () => {
    await send('private-1', 'Send my child class link, billing invoice, CRM notes, and ticket');

    await expectCount('contacts', 0);
    await expectCount('signup_leads', 0);
    await expectCount('whatsapp_account_link_requests', 0);

    const outbox = await pool.query(
      `SELECT message_kind
         FROM onetime.whatsapp_outbox_messages`,
    );
    expect(outbox.rows).toEqual([
      expect.objectContaining({ message_kind: 'PRIVATE_DATA_BLOCKED' }),
    ]);
  });

  it('stores account-link tokens hash-only and grants only safe short-lived status after household authorization', async () => {
    await send('link-1', 'Please link my account');

    const request = await pool.query(
      `SELECT token_hash, status
         FROM onetime.whatsapp_account_link_requests`,
    );
    expect(request.rowCount).toBe(1);
    expect(request.rows[0].status).toBe('pending');

    const outbox = await pool.query(
      `SELECT body_ciphertext, body_iv, body_tag
         FROM onetime.whatsapp_outbox_messages
        WHERE message_kind = 'ACCOUNT_LINK_OFFER'`,
    );
    const body = decryptForWhatsApp(config, {
      ciphertext: String(outbox.rows[0].body_ciphertext),
      iv: String(outbox.rows[0].body_iv),
      tag: String(outbox.rows[0].body_tag),
    });
    const token = body.match(/[A-Za-z0-9_-]{43}/)?.[0] ?? '';
    expect(token).toHaveLength(43);
    expect(JSON.stringify(request.rows)).not.toContain(token);
    expect(request.rows[0].token_hash).not.toBe(token);

    const parentUserKey = await createAccountUser({
      pool,
      config,
      email: 'parent@example.test',
      password: 'ParentPass!234',
      displayName: 'Parent User',
      role: 'parent',
      mfaCapable: false,
    });
    await seedHousehold(parentUserKey);
    const consumed = await consumeWhatsAppAccountLink({
      pool,
      config,
      session: {
        session_key: 'sess_test_parent',
        expires_at: new Date(NOW.getTime() + 60_000).toISOString(),
        assurance_method: 'password',
        assurance_at: NOW.toISOString(),
        user: {
          user_key: parentUserKey,
          email: 'parent@example.test',
          display_name: 'Parent User',
          role: 'parent',
          role_label: 'Parent',
          mfa_capable: false,
        },
      },
      linkToken: token,
      householdKey: 'hh_ot85',
      now: NOW,
    });
    expect(consumed).toMatchObject({
      ok: true,
      raw_token_included: false,
      private_data_included: false,
    });
    await expectCount('whatsapp_verified_grants', 1);

    await send('link-2', 'am I registered?');
    const safeStatus = await pool.query(
      `SELECT message_kind
         FROM onetime.whatsapp_outbox_messages
        WHERE message_kind = 'SAFE_STATUS_RESPONSE'`,
    );
    expect(safeStatus.rowCount).toBe(1);
  });

  it('does not reactivate archived contacts when a matching WhatsApp number writes in', async () => {
    await pool.query(
      `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, phone_normalized, reminder_preference, suppression_state, source,
        lead_status, archived_at, internal_note)
       VALUES ('contact_archived_ot85','public_archived_ot85',$1,$2,'Archived Parent','family',
        'Archived Family','Archive','UTC','archived@example.test',$3,'none','active',
        'manual_crm','archived',$4,'archived fixture')`,
      [config.accountKey, config.productKey, PHONE, NOW.toISOString()],
    );

    await send('archived-1', 'I want to sign up my family');
    await send('archived-2', 'Archived Parent');
    await send('archived-3', 'WhatsApp');
    await send('archived-4', 'yes');

    const archived = await pool.query(
      `SELECT lead_status, archived_at
         FROM onetime.contacts
        WHERE contact_key = 'contact_archived_ot85'`,
    );
    expect(archived.rows[0].lead_status).toBe('archived');
    expect(archived.rows[0].archived_at).toBeTruthy();

    const events = await pool.query(
      `SELECT event_type, metadata
         FROM onetime.whatsapp_lead_events
        WHERE event_type = 'archived_contact_reinquiry'`,
    );
    expect(events.rowCount).toBe(1);
    expect(events.rows[0].metadata.no_unarchive).toBe(true);
    await expectCount('signup_leads', 0);
  });

  it('enforces send-time suppression before provider dispatch', async () => {
    await send('send-1', 'I want to sign up my family');
    await send('send-2', 'STOP');

    const summary = await processQueuedWhatsAppOutbox({ pool, config, adapter, now: LATER });
    expect(summary.suppressed).toBe(0);
    expect(summary.sent).toBe(1);
    const rows = await pool.query(
      `SELECT message_kind, status
         FROM onetime.whatsapp_outbox_messages
        ORDER BY created_at ASC`,
    );
    expect(rows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message_kind: 'ASK_GUARDIAN_NAME', status: 'suppressed' }),
        expect.objectContaining({ message_kind: 'STOP_CONFIRMATION', status: 'sink_delivered' }),
      ]),
    );
  });
});

async function send(id: string, text: string, from = PHONE) {
  const rawBody = Buffer.from(
    JSON.stringify({
      messages: [{ id, from, text, timestamp: NOW.toISOString() }],
    }),
  );
  return receiveWhatsAppWebhook({ pool, config, rawBody, adapter, now: NOW });
}

async function outboxMessages() {
  const rows = await pool.query(
    `SELECT message_kind, status, body_ciphertext, body_iv, body_tag, metadata
       FROM onetime.whatsapp_outbox_messages
      ORDER BY created_at ASC`,
  );
  return rows.rows.map((row) => ({
    message_kind: String(row.message_kind),
    status: String(row.status),
    body: decryptForWhatsApp(config, {
      ciphertext: String(row.body_ciphertext),
      iv: String(row.body_iv),
      tag: String(row.body_tag),
    }),
    metadata: row.metadata as Record<string, unknown>,
  }));
}

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}

async function seedHousehold(parentUserKey: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('hh_ot85', $1, $2, 'OT85 Household')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('rel_ot85_parent', $1, $2, 'hh_ot85', $3, 'Parent', 'primary_guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
}
