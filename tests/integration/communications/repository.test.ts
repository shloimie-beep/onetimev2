import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCommunicationsReadRepository } from '../../../apps/web/src/server/communications/repository.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import type {
  CommunicationsReadRepository,
  ReadOnlySessionScope,
} from '../../../packages/domain/src/communications/service.ts';

const scope: ReadOnlySessionScope = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnah_class',
  userKey: 'owner_user',
  role: 'owner',
};

let pool: DbPool;
let repository: CommunicationsReadRepository;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  repository = new PostgresCommunicationsReadRepository(pool);
  await seedCommunicationHistory(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('PostgresCommunicationsReadRepository', () => {
  it('projects canonical history, local intents, stored webhooks, and provider statuses truthfully', async () => {
    const result = await repository.list({
      scope,
      mode: { kind: 'global' },
      filters: {
        from: '2026-07-14T00:00:00.000Z',
        to: '2026-07-15T00:00:00.000Z',
        limit: 25,
      },
      cursor: null,
    });
    expect(result.sourceAvailable).toBe(true);
    expect(result.rows.map((row) => row.source)).toEqual([
      'historical_import',
      'account_lifecycle_outbox',
      'account_lifecycle_outbox',
      'stored_provider_delivery_event',
      'stored_whatsapp_webhook',
      'local_outbox_intent',
    ]);
    expect(result.rows.map((row) => row.status)).toEqual([
      'history_unavailable',
      'delivered',
      'superseded',
      'delivered',
      'received',
      'pending',
    ]);
    expect(JSON.stringify(result.rows)).not.toContain('private body');
    expect(JSON.stringify(result.rows)).not.toContain('encrypted_private_body');
    expect(JSON.stringify(result.rows)).not.toContain('lifecycle_token_hash_private');
    expect(JSON.stringify(result.rows)).not.toContain('lifecycle_provider_ref_private');
    expect(JSON.stringify(result.rows)).not.toContain('lifecycle_destination_private');
  });

  it('projects reset and setup delivery truth without recipient, link, token, or provider leakage', async () => {
    const passwordReset = await repository.list({
      scope,
      mode: { kind: 'global' },
      filters: {
        from: '2026-07-14T00:00:00.000Z',
        to: '2026-07-15T00:00:00.000Z',
        source: 'account_lifecycle_outbox',
        intent_type: 'password_reset',
        status: 'delivered',
        limit: 25,
      },
      cursor: null,
      rawEventType: 'account_password_reset.v1',
    });
    expect(passwordReset.rows).toHaveLength(1);
    expect(passwordReset.rows[0]).toMatchObject({
      eventType: 'account_password_reset.v1',
      status: 'delivered',
      source: 'account_lifecycle_outbox',
      participantKind: 'account',
      participantLabel: 'Protected Admin · Admin account',
      providerReferenceDigest: null,
      idempotencyKey: null,
    });

    const accountSetup = await repository.list({
      scope,
      mode: { kind: 'global' },
      filters: {
        from: '2026-07-14T00:00:00.000Z',
        to: '2026-07-15T00:00:00.000Z',
        source: 'account_lifecycle_outbox',
        intent_type: 'account_activation',
        status: 'superseded',
        limit: 25,
      },
      cursor: null,
      rawEventType: 'account_activation.v1',
    });
    expect(accountSetup.rows).toHaveLength(1);
    expect(accountSetup.rows[0]).toMatchObject({
      eventType: 'account_activation.v1',
      status: 'superseded',
      source: 'account_lifecycle_outbox',
      participantKind: 'account',
      participantLabel: 'Protected Parent · Parent account',
    });
    const serialized = JSON.stringify([...passwordReset.rows, ...accountSetup.rows]);
    expect(serialized).not.toContain('lifecycle_token_hash_private');
    expect(serialized).not.toContain('lifecycle_provider_ref_private');
    expect(serialized).not.toContain('lifecycle_destination_private');
    expect(serialized).not.toContain('ciphertext_private');
    expect(serialized).not.toContain('Disabled Account');
  });

  it('filters by source and refuses cross-contact projection through scoped contact mode', async () => {
    const webhookOnly = await repository.list({
      scope,
      mode: { kind: 'global' },
      filters: {
        from: '2026-07-14T00:00:00.000Z',
        to: '2026-07-15T00:00:00.000Z',
        source: 'stored_whatsapp_webhook',
        direction: 'inbound',
        limit: 25,
      },
      cursor: null,
    });
    expect(webhookOnly.rows).toHaveLength(1);
    expect(webhookOnly.rows[0]).toMatchObject({
      source: 'stored_whatsapp_webhook',
      direction: 'inbound',
      providerReferenceDigest: 'a'.repeat(64),
    });

    const missingContact = await repository.contactExists({
      scope,
      contactId: 'contact_other_account',
    });
    expect(missingContact).toBe(false);
  });
});

async function seedCommunicationHistory(db: DbPool) {
  await db.query(
    `INSERT INTO onetime.account_users
      (user_key, account_key, product_key, email_normalized, display_name, role, password_hash, status)
     VALUES
      ('active_admin_user','one_time','one_time_mishnah_class','active.admin@example.test',
       'Protected Admin','admin','hash-not-a-secret','active'),
      ('active_parent_user','one_time','one_time_mishnah_class','active.parent@example.test',
       'Protected Parent','parent','hash-not-a-secret','active'),
      ('disabled_parent_user','one_time','one_time_mishnah_class','disabled.parent@example.test',
       'Disabled Account','parent','hash-not-a-secret','disabled')`,
  );

  await db.query(
    `INSERT INTO onetime.contacts
      (contact_key, account_key, product_key, display_name, family_school_classification,
       family_or_school, location_text, timezone, email_normalized, phone_normalized,
       reminder_preference, source)
     VALUES
      ('contact_public_test','one_time','one_time_mishnah_class','Redacted Contact','family',
       'Family','RBS','Asia/Jerusalem','parent.person@example.test','+12125557890','both','test')`,
  );

  await db.query(
    `INSERT INTO onetime.outbox_events
      (delivery_key, account_key, product_key, contact_key, event_type, channel, payload, status, created_at)
     VALUES
      ('delivery_local_1','one_time','one_time_mishnah_class','contact_public_test',
       'family_signup_email_ack.v1','email','{"redacted":true}'::jsonb,'pending',
       '2026-07-14T09:00:00.000Z')`,
  );

  await db.query(
    `INSERT INTO onetime.account_lifecycle_tokens
      (token_key, account_key, product_key, token_type, token_hash, email_normalized,
       display_name, target_role, subject_user_key, expires_at, created_at)
     VALUES
      ('lifecycle_token_reset','one_time','one_time_mishnah_class','password_reset',
       'lifecycle_token_hash_private','protected@example.test','Protected Adult','admin',
       'active_admin_user',
       '2026-07-14T12:00:00.000Z','2026-07-14T11:00:00.000Z'),
      ('lifecycle_token_setup','one_time','one_time_mishnah_class','parent_activation',
       'lifecycle_setup_token_hash_private','protected@example.test','Protected Adult','parent',
       'active_parent_user',
       '2026-07-21T10:59:00.000Z','2026-07-14T10:59:00.000Z'),
      ('lifecycle_token_disabled','one_time','one_time_mishnah_class','password_reset',
       'lifecycle_disabled_token_hash_private','disabled.parent@example.test','Disabled Account',
       'parent','disabled_parent_user',
       '2026-07-14T13:00:00.000Z','2026-07-14T11:30:00.000Z')`,
  );

  await db.query(
    `INSERT INTO onetime.account_lifecycle_delivery_outbox
      (delivery_key, account_key, product_key, token_key, purpose, channel, transport_mode,
       destination_ref, key_id, encrypted_payload_expires_at, state, attempts, max_attempts,
       next_attempt_at, idempotency_key, provider_message_ref_hash, provider_accepted_at,
       final_delivery_state, final_state_at, delivered_at, cleared_at, created_at, updated_at,
       metadata)
     VALUES
      ('lifecycle_delivery_reset','one_time','one_time_mishnah_class','lifecycle_token_reset',
       'password_reset','email','provider','lifecycle_destination_private','key_test',
       '2026-07-14T12:00:00.000Z','provider_accepted',1,5,'2026-07-14T11:00:00.000Z',
       'lifecycle_idempotency_private','lifecycle_provider_ref_private',
       '2026-07-14T11:00:01.000Z','delivered','2026-07-14T11:00:02.000Z',
       '2026-07-14T11:00:02.000Z','2026-07-14T11:00:01.000Z',
       '2026-07-14T11:00:00.000Z','2026-07-14T11:00:02.000Z','{"raw_token_included":false}'::jsonb),
      ('lifecycle_delivery_setup','one_time','one_time_mishnah_class','lifecycle_token_setup',
       'parent_activation','email','provider','lifecycle_destination_private','key_test',
       '2026-07-21T10:59:00.000Z','superseded',0,5,'2026-07-14T10:59:00.000Z',
       'lifecycle_setup_idempotency_private',NULL,NULL,NULL,NULL,NULL,
       '2026-07-14T10:59:30.000Z','2026-07-14T10:59:00.000Z',
       '2026-07-14T10:59:30.000Z','{"raw_token_included":false}'::jsonb),
      ('lifecycle_delivery_disabled','one_time','one_time_mishnah_class','lifecycle_token_disabled',
       'password_reset','email','provider','disabled_destination_private','key_test',
       '2026-07-14T13:00:00.000Z','provider_accepted',1,5,'2026-07-14T11:30:00.000Z',
       'disabled_idempotency_private','disabled_provider_ref_private',
       '2026-07-14T11:30:01.000Z','delivered','2026-07-14T11:30:02.000Z',
       '2026-07-14T11:30:02.000Z','2026-07-14T11:30:01.000Z',
       '2026-07-14T11:30:00.000Z','2026-07-14T11:30:02.000Z','{"raw_token_included":false}'::jsonb)`,
  );

  await db.query(
    `INSERT INTO onetime.whatsapp_conversations
      (conversation_key, account_key, product_key, provider_account_key, sender_key,
       sender_e164_ciphertext, sender_e164_iv, sender_e164_tag, contact_key)
     VALUES
      ('conv_1','one_time','one_time_mishnah_class','wapi_main','sender_digest_1',
       'cipher','iv','tag','contact_public_test')`,
  );

  await db.query(
    `INSERT INTO onetime.whatsapp_inbox_events
      (event_key, account_key, product_key, provider_account_key, conversation_key,
       provider_message_ref_hash, sender_key, raw_body_digest, payload_digest,
       message_ciphertext, message_iv, message_tag, provider_timestamp, status)
     VALUES
      ('inbox_1','one_time','one_time_mishnah_class','wapi_main','conv_1',
       $1,'sender_digest_1','raw_digest','payload_digest','encrypted_private_body','iv','tag',
       '2026-07-14T10:00:00.000Z','durable')`,
    ['a'.repeat(64)],
  );

  await db.query(
    `INSERT INTO onetime.whatsapp_outbox_messages
      (outbox_message_key, account_key, product_key, provider_account_key, conversation_key,
       recipient_key, recipient_e164_ciphertext, recipient_e164_iv, recipient_e164_tag,
       message_kind, body_ciphertext, body_iv, body_tag, idempotency_key, status, created_at)
     VALUES
      ('wa_outbox_1','one_time','one_time_mishnah_class','wapi_main','conv_1',
       'sender_digest_1','cipher','iv','tag','PUBLIC_PROGRAM_ANSWER','encrypted_private_body',
       'iv','tag','idem_wa_1','sent','2026-07-14T10:30:00.000Z')`,
  );

  await db.query(
    `INSERT INTO onetime.whatsapp_delivery_events
      (delivery_event_key, account_key, product_key, outbox_message_key,
       provider_event_ref_hash, status, occurred_at)
     VALUES
      ('delivery_event_1','one_time','one_time_mishnah_class','wa_outbox_1',
       $1,'delivered','2026-07-14T10:31:00.000Z')`,
    ['b'.repeat(64)],
  );

  await db.query(
    `INSERT INTO onetime.communication_import_batches
      (batch_key, account_key, product_key, source, mode, source_fingerprint, summary)
     VALUES
      ('batch_missing_resend','one_time','one_time_mishnah_class','provider_history_unavailable',
       'dry_run',$1,'{"missing_history":true}'::jsonb)`,
    ['c'.repeat(64)],
  );

  await db.query(
    `INSERT INTO onetime.communication_threads
      (thread_key, account_key, product_key, channel, participant_ref_digest, contact_key,
       display_label, source, last_event_at)
     VALUES
      ('thread_missing_resend','one_time','one_time_mishnah_class','email',$1,
       'contact_public_test','Missing Resend history','provider_history_unavailable',
       '2026-07-14T12:00:00.000Z')`,
    ['d'.repeat(64)],
  );

  await db.query(
    `INSERT INTO onetime.communication_history_events
      (event_key, account_key, product_key, thread_key, channel, direction, event_kind,
       truthful_state, source, provenance, contact_key, occurred_at, redacted_preview,
       import_batch_key, source_event_key)
     VALUES
      ('event_missing_resend','one_time','one_time_mishnah_class','thread_missing_resend',
       'email','outbound','history_unavailable.v1','history_unavailable','historical_import',
       'capability_limitation','contact_public_test','2026-07-14T12:00:00.000Z',
       'Resend historical export was not supplied.','batch_missing_resend','missing_resend')`,
  );
}
