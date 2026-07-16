import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import {
  asBotKey,
  asCanonicalUserKey,
  asChatRef,
  asProviderUserRef,
  type NormalizedBotUpdate,
} from '../../packages/contracts/src/telegram/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  TelegramSqlConfirmationRepository,
  TelegramSqlIdentityMappingRepository,
} from '../../packages/db/src/telegram/repositories.ts';
import {
  createAccountUser,
  createOneTimeTelegramApplicationAdapter,
} from '../../packages/domain/src/index.ts';
import { TelegramCommandEngine } from '../../packages/domain/src/telegram/commands.ts';
import { DeterministicTestPayloadCodec } from '../../packages/domain/src/telegram/crypto.ts';
import { TelegramIdentityResolver } from '../../packages/domain/src/telegram/identity.ts';
import { TelegramSqlAuditSink } from '../../packages/db/src/telegram/repositories.ts';

let pool: DbPool;

const botKey = asBotKey('one_time_internal_ops');
const providerUserRef = asProviderUserRef('telegram_user_fixture');
const chatRef = asChatRef('telegram_chat_fixture');

beforeEach(async () => {
  pool = createMemoryPool();
});

afterEach(async () => {
  await pool.end();
});

describe('OT-101R SQL-backed Telegram admin runtime', () => {
  it('handles scoped reads and confirmed local writes without provider sends', async () => {
    await runMigrations(pool);
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://staging.onetime.example',
      ONE_TIME_TELEGRAM_ENVIRONMENT: 'local',
    });
    const { engine } = await seedRuntime(config);

    const status = await engine.handle(updateFixture({ text: '/status' }));
    const signups = await engine.handle(updateFixture({ updateId: '2', text: '/signups' }));
    const social = await engine.handle(updateFixture({ updateId: '3', text: '/social' }));
    expect(status[0]?.text).toContain('Writes require preview');
    expect(signups[0]?.text).toContain('signup_fixture_1');
    expect(social[0]?.text).toContain('draft_fixture_1');

    const taskPreview = await engine.handle(
      updateFixture({
        updateId: '4',
        text: '/task-create contact_public_fixture | Call fixture family',
      }),
    );
    expect(taskPreview[0]?.text).toContain('Payload hash:');
    const taskCreated = await engine.handle(
      updateFixture({
        updateId: '5',
        kind: 'callback_query',
        callbackData: requireString(taskPreview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(taskCreated[0]?.text).toContain('created for contact_public_fixture');
    const task = await pool.query(
      `SELECT task_key, version FROM onetime.crm_tasks WHERE account_key = $1 LIMIT 1`,
      [config.accountKey],
    );
    const taskKey = String(task.rows[0].task_key);
    expect(Number(task.rows[0].version)).toBe(1);

    const updatePreview = await engine.handle(
      updateFixture({ updateId: '6', text: `/task-update ${taskKey} 1 completed` }),
    );
    expect(updatePreview[0]?.text).toContain('Action: task.update');
    const taskUpdated = await engine.handle(
      updateFixture({
        updateId: '7',
        kind: 'callback_query',
        callbackData: requireString(updatePreview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(taskUpdated[0]?.text).toContain('updated to completed');

    const supportPreview = await engine.handle(
      updateFixture({ updateId: '8', text: '/ticket-status ots_fixture_1 resolved' }),
    );
    const supportUpdated = await engine.handle(
      updateFixture({
        updateId: '9',
        kind: 'callback_query',
        callbackData: requireString(supportPreview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(supportUpdated[0]?.text).toContain('updated to resolved');

    const events = await pool.query(
      `SELECT event_type FROM onetime.action_gateway_event_outbox ORDER BY event_type`,
    );
    expect(events.rows.map((row) => row.event_type)).toEqual(['task.created', 'task.updated']);
    const responseOutbox = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.telegram_response_outbox`,
    );
    expect(Number(responseOutbox.rows[0].count)).toBe(0);
  });
});

async function seedRuntime(config: AppConfig) {
  const userKey = await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'Password!234',
    displayName: 'Owner',
    role: 'owner',
    mfaCapable: true,
  });
  await pool.query(
    `INSERT INTO onetime.telegram_bot_registry
       (bot_key, environment, account_key, product_key, token_fingerprint_hash, status)
     VALUES ($1,'local',$2,$3,'token_fp_fixture','active')`,
    [botKey, config.accountKey, config.productKey],
  );
  const mappings = new TelegramSqlIdentityMappingRepository(pool);
  await mappings.upsertProtectedMapping({
    mappingKey: 'mapping_1',
    botKey,
    environment: 'local',
    providerUserRef,
    chatRef,
    canonicalUserKey: asCanonicalUserKey(userKey),
    accountKey: config.accountKey,
    productKey: config.productKey,
    membershipKey: 'membership_owner',
    mappingVersion: 1,
    securityVersion: 1,
    status: 'active',
  });
  await seedContact(config, userKey);
  await seedSupport(config, userKey);
  await seedSocial(config);

  const adapter = createOneTimeTelegramApplicationAdapter({ pool, config });
  const engine = new TelegramCommandEngine(
    new TelegramIdentityResolver(mappings, adapter),
    adapter,
    new TelegramSqlConfirmationRepository(pool),
    new DeterministicTestPayloadCodec(),
    new TelegramSqlAuditSink(pool),
  );
  return { engine };
}

async function seedContact(config: AppConfig, userKey: string) {
  await pool.query(
    `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, phone_normalized, reminder_preference, source, lead_status,
        assigned_user_key, internal_note, offer_version, content_version, last_activity_at)
     VALUES
       ('contact_fixture_1','contact_public_fixture',$1,$2,'Fixture Family','family',
        'Fixture Family','Jerusalem','Asia/Jerusalem','fixture@example.test',NULL,'email',
        'manual_crm','new',$3,'','offer-v1','content-v1','2026-07-16T09:00:00Z')`,
    [config.accountKey, config.productKey, userKey],
  );
  await pool.query(
    `INSERT INTO onetime.signup_leads
       (signup_key, contact_key, account_key, product_key, offer_version, content_version,
        classification, status, created_at)
     VALUES
       ('signup_fixture_1','contact_fixture_1',$1,$2,'offer-v1','content-v1','family','new',
        '2026-07-16T09:05:00Z')`,
    [config.accountKey, config.productKey],
  );
}

async function seedSupport(config: AppConfig, userKey: string) {
  const digest = 'a'.repeat(64);
  await pool.query(
    `INSERT INTO onetime.support_submissions
       (source_ticket_id, receipt_id, event_id, outbox_id, account_key, product_key,
        actor_user_key, actor_role, entitlement_id, entitlement_checked_at, category, title,
        message, issue_details, client_context, reply_preference, idempotency_key,
        request_hash, body_fingerprint, privacy, delivery_state)
     VALUES
       ('ots_fixture_1','otr_fixture_1','evt_fixture_1','otx_fixture_1',$1,$2,$3,'owner',
        'ent_fixture_1','2026-07-16T09:00:00Z','other','Fixture support',
        'Redacted fixture support message','{}'::jsonb,'{}'::jsonb,'email','support_idem_1',
        $4,$4,'{}'::jsonb,'QUEUED')`,
    [config.accountKey, config.productKey, userKey, digest],
  );
  await pool.query(
    `INSERT INTO onetime.support_status_projection
       (source_ticket_id, receipt_id, account_key, product_key, actor_user_key,
        status, public_summary, delivery_state)
     VALUES
       ('ots_fixture_1','otr_fixture_1',$1,$2,$3,'pending_operator',
        'Operator decision needed for a fixture ticket.','queued')`,
    [config.accountKey, config.productKey, userKey],
  );
}

async function seedSocial(config: AppConfig) {
  await pool.query(
    `INSERT INTO onetime.ot86b_social_sources
       (source_id, event_id, tenant_id, content_id, version_id, sequence, canonical_title,
        canonical_url, summary, approved_excerpts_json, media_json, privacy_json, payload_sha256)
     VALUES
       ('source_fixture_1','11111111-1111-4111-8111-111111111111',$1,'content_fixture_1',
        'version_fixture_1',1,'Fixture title','https://example.test/content','Safe summary',
        '[]'::jsonb,'[]'::jsonb,'{}'::jsonb,$2)`,
    [config.accountKey, 'b'.repeat(64)],
  );
  await pool.query(
    `INSERT INTO onetime.ot86b_social_drafts
       (draft_id, source_id, tenant_id, content_id, version_id, platform, workflow_state,
        current_revision_id)
     VALUES
       ('draft_fixture_1','source_fixture_1',$1,'content_fixture_1','version_fixture_1',
        'linkedin','review_needed',NULL)`,
    [config.accountKey],
  );
}

function updateFixture(overrides: Partial<NormalizedBotUpdate>): NormalizedBotUpdate {
  const update: NormalizedBotUpdate = {
    updateId: overrides.updateId ?? '1',
    kind: overrides.kind ?? 'message',
    botKey,
    environment: 'local',
    providerUserRef,
    chatRef,
    chatContext: overrides.chatContext ?? 'private',
    isForwarded: overrides.isForwarded ?? false,
    isEdited: overrides.isEdited ?? false,
    isAnonymousAdmin: overrides.isAnonymousAdmin ?? false,
    receivedAt: '2026-07-16T10:00:00Z',
  };
  if (overrides.text !== undefined) update.text = overrides.text;
  if (overrides.callbackData !== undefined) update.callbackData = overrides.callbackData;
  return update;
}

function requireString(value: string | undefined): string {
  if (!value) throw new Error('expected callback data');
  return value;
}
