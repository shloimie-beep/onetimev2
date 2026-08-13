import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import {
  RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER,
  type RabbiConversationProvider,
} from '../../packages/contracts/src/index.ts';
import {
  asBotKey,
  asCanonicalUserKey,
  asChatRef,
  asProviderUserRef,
  type NormalizedBotUpdate,
} from '../../packages/contracts/src/telegram/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  TelegramSqlAuditSink,
  TelegramSqlConsumerLeaseRepository,
  TelegramSqlIdentityMappingRepository,
} from '../../packages/db/src/telegram/repositories.ts';
import {
  createAccountUser,
  encryptRabbiParentConversationRef,
  RabbiCommunicationService,
  RabbiParentReplyWorker,
  RabbiTelegramCommunicationEngine,
  RabbiTelegramIdentityAdapter,
  SyntheticRabbiConversationProvider,
} from '../../packages/domain/src/index.ts';
import { DeterministicTestPayloadCodec } from '../../packages/domain/src/telegram/crypto.ts';
import { TelegramIdentityResolver } from '../../packages/domain/src/telegram/identity.ts';
import { createRabbiTelegramOperationsReader } from '../../packages/domain/src/telegram/rabbi-operations.ts';

const botKey = asBotKey('one_time_rabbi_torah_console');
const environment = 'local' as const;
const providerUserRef = asProviderUserRef('rabbi-provider-user-fixture');
const chatRef = asChatRef('rabbi-private-chat-fixture');
const codec = new DeterministicTestPayloadCodec();
const accountKey = 'one_time';
const productKey = 'one_time_mishnayos';
const exactStudentAnswer = `${RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER} Learner 1.`;

let pool: DbPool;
let config: AppConfig;
let actorUserKey: string;

beforeAll(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  config = loadConfig({ NODE_ENV: 'test' });
  actorUserKey = await seedFixtures();
});

describe('OT-LAUNCH-01 Rabbi Telegram communications', () => {
  it('previews and explicitly confirms same-conversation Parent and exact local Student answers with replay and scope denial', async () => {
    const provider = new SyntheticRabbiConversationProvider();
    const audit = new TelegramSqlAuditSink(pool);
    const service = new RabbiCommunicationService(pool, codec, 'synthetic');
    const engine = new RabbiTelegramCommunicationEngine(
      new TelegramIdentityResolver(
        new TelegramSqlIdentityMappingRepository(pool),
        new RabbiTelegramIdentityAdapter(pool),
      ),
      service,
      audit,
      createRabbiTelegramOperationsReader({ pool, config }),
    );
    const replyWorker = new RabbiParentReplyWorker(pool, codec, provider, audit, {
      botKey,
      environment,
      ownerId: 'rabbi-reply-worker-acceptance',
      rowLeaseMs: 30_000,
      baseBackoffMs: 100,
    });
    const now = new Date('2026-07-24T08:00:00.000Z');

    const parentPreview = await engine.handle(
      update({
        updateId: '1001',
        text: '/parent-reply parent_conversation_fixture | Exact synthetic Parent answer.',
      }),
      now,
    );
    expect(parentPreview[0]?.text).toContain('same email HighLevel conversation');
    const parentConfirmCallback = confirmCallback(parentPreview);
    expect(provider.calls).toHaveLength(0);
    expect(await countRows('onetime.rabbi_parent_reply_outbox')).toBe(0);

    const parentConfirmed = await engine.handle(
      update({ updateId: '1002', kind: 'callback_query', callbackData: parentConfirmCallback }),
      new Date(now.getTime() + 1_000),
    );
    expect(parentConfirmed[0]?.text).toContain('synthetic same-conversation');
    const parentReplay = await engine.handle(
      update({ updateId: '1003', kind: 'callback_query', callbackData: parentConfirmCallback }),
      new Date(now.getTime() + 2_000),
    );
    expect(parentReplay[0]?.text).toContain('synthetic same-conversation');
    expect(await countRows('onetime.rabbi_parent_reply_outbox')).toBe(1);

    const drained = await replyWorker.runOnce(new Date(now.getTime() + 3_000));
    expect(drained).toMatchObject({ claimed: 1, disposition: 'delivered' });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      conversationRef: 'ghl-conversation-synthetic-001',
      body: 'Exact synthetic Parent answer.',
    });
    expect(provider.readback('ghl-conversation-synthetic-001')).toHaveLength(1);
    const retainedParentPayload = await pool.query(
      `SELECT confirmations.payload_ciphertext AS confirmation_payload,
              outbox.payload_ciphertext AS outbox_payload
         FROM onetime.rabbi_action_confirmations AS confirmations
         JOIN onetime.rabbi_parent_reply_outbox AS outbox
           ON outbox.idempotency_key = confirmations.idempotency_key
        WHERE confirmations.confirmation_key = $1`,
      [parentConfirmCallback.replace('rabbi:confirm:', '')],
    );
    expect(retainedParentPayload.rows[0]).toMatchObject({
      confirmation_payload: null,
      outbox_payload: null,
    });
    expect(await replyWorker.runOnce(new Date(now.getTime() + 4_000))).toMatchObject({
      claimed: 0,
      disposition: 'empty',
    });
    expect(provider.calls).toHaveLength(1);

    const studentPreview = await engine.handle(
      update({
        updateId: '1004',
        text: `/student-answer student_question_fixture | ${exactStudentAnswer}`,
      }),
      new Date(now.getTime() + 5_000),
    );
    expect(studentPreview[0]?.text).toContain(exactStudentAnswer);
    const studentConfirmCallback = confirmCallback(studentPreview);
    const studentConfirmed = await engine.handle(
      update({
        updateId: '1005',
        kind: 'callback_query',
        callbackData: studentConfirmCallback,
      }),
      new Date(now.getTime() + 6_000),
    );
    expect(studentConfirmed[0]?.text).toContain('existing Student portal question');
    const question = await pool.query(
      `SELECT question_status, answer_preview, rabbi_answer_revision
         FROM onetime.portal_student_questions
        WHERE question_key = 'student_question_fixture'`,
    );
    expect(question.rows[0]).toMatchObject({
      question_status: 'answered',
      answer_preview: exactStudentAnswer,
      rabbi_answer_revision: 1,
    });
    await engine.handle(
      update({
        updateId: '1006',
        kind: 'callback_query',
        callbackData: studentConfirmCallback,
      }),
      new Date(now.getTime() + 7_000),
    );
    const replayedQuestion = await pool.query(
      `SELECT rabbi_answer_revision
         FROM onetime.portal_student_questions
        WHERE question_key = 'student_question_fixture'`,
    );
    expect(Number(replayedQuestion.rows[0]?.rabbi_answer_revision)).toBe(1);

    const taskPreview = await engine.handle(
      update({
        updateId: '1007',
        text: '/internal-task-create Review exact synthetic proof | Operator-only follow-up | high',
      }),
      new Date(now.getTime() + 8_000),
    );
    const taskConfirmed = await engine.handle(
      update({
        updateId: '1008',
        kind: 'callback_query',
        callbackData: confirmCallback(taskPreview),
      }),
      new Date(now.getTime() + 9_000),
    );
    expect(taskConfirmed[0]?.text).toContain('without a GHL contact');
    expect(await countRows('onetime.rabbi_internal_tasks')).toBe(1);
    const taskList = await engine.handle(
      update({ updateId: '1008-list', text: '/internal-tasks' }),
      new Date(now.getTime() + 9_500),
    );
    expect(taskList[0]?.text).toContain('Review exact synthetic proof');
    const taskRow = await pool.query(`SELECT task_key FROM onetime.rabbi_internal_tasks LIMIT 1`);
    const taskKey = String(taskRow.rows[0]?.task_key);
    const stalePreview = await engine.handle(
      update({
        updateId: '1008-stale-preview',
        text: `/internal-task-update ${taskKey} | in_progress`,
      }),
      new Date(now.getTime() + 9_600),
    );
    await pool.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET version = version + 1
        WHERE task_key = $1`,
      [taskKey],
    );
    const staleResult = await engine.handle(
      update({
        updateId: '1008-stale-confirm',
        kind: 'callback_query',
        callbackData: confirmCallback(stalePreview),
      }),
      new Date(now.getTime() + 9_700),
    );
    expect(staleResult[0]?.text).toContain('changed; preview again');

    const classReadiness = await engine.handle(
      update({ updateId: '1008-class', text: '/class-readiness occurrence_fixture' }),
      new Date(now.getTime() + 9_800),
    );
    expect(classReadiness[0]?.text).toContain('No scoped class');
    const contentStatus = await engine.handle(
      update({ updateId: '1008-content', text: '/content-processing-status' }),
      new Date(now.getTime() + 9_900),
    );
    expect(contentStatus[0]?.text).toContain('no scoped Vimeo sources');
    const incidents = await engine.handle(
      update({ updateId: '1008-incidents', text: '/incidents' }),
      new Date(now.getTime() + 10_000),
    );
    expect(incidents[0]?.text).toContain('no scoped matches');

    const agentPreview = await engine.handle(
      update({
        updateId: '1008-agent-preview',
        text: '/agent-task-create login_access | high',
      }),
      new Date(now.getTime() + 10_100),
    );
    expect(agentPreview[0]?.text).toContain('No credentials, provider references, or Student data');
    const agentConfirmed = await engine.handle(
      update({
        updateId: '1008-agent-confirm',
        kind: 'callback_query',
        callbackData: confirmCallback(agentPreview),
      }),
      new Date(now.getTime() + 10_200),
    );
    expect(agentConfirmed[0]?.text).toContain('No provider action, notification');
    const agentTask = await pool.query(
      `SELECT task_key, detail
         FROM onetime.rabbi_internal_tasks
        WHERE task_key LIKE 'rabbi_agent_%'
        LIMIT 1`,
    );
    expect(String(agentTask.rows[0]?.task_key)).toContain('rabbi_agent_');
    expect(String(agentTask.rows[0]?.detail)).not.toMatch(/credential|provider reference|student/i);
    const agentKey = String(agentTask.rows[0]?.task_key);
    const agentList = await engine.handle(
      update({ updateId: '1008-agent-list', text: '/agent-tasks' }),
      new Date(now.getTime() + 10_300),
    );
    expect(agentList[0]?.text).toContain('login_access');
    const agentUpdate = await engine.handle(
      update({
        updateId: '1008-agent-update',
        text: `/agent-task-update ${agentKey} | in_progress`,
      }),
      new Date(now.getTime() + 10_400),
    );
    const agentUpdated = await engine.handle(
      update({
        updateId: '1008-agent-update-confirm',
        kind: 'callback_query',
        callbackData: confirmCallback(agentUpdate),
      }),
      new Date(now.getTime() + 10_500),
    );
    expect(agentUpdated[0]?.text).toContain('No provider action or notification');
    const sensitiveOperation = await engine.handle(
      update({
        updateId: '1008-sensitive-operation',
        text: '/agent-task-create login_access | high | https://zoom.us/j/123456789',
      }),
      new Date(now.getTime() + 10_600),
    );
    expect(sensitiveOperation[0]?.text).toContain('outside this communication-only Rabbi bot');

    const otherAccountParent = await engine.handle(
      update({
        updateId: '1012',
        text: '/parent-reply other_account_conversation | Must be denied.',
      }),
      new Date(now.getTime() + 10_000),
    );
    expect(otherAccountParent[0]?.text).toContain('No assigned scoped parent conversation');
    const otherAccountStudent = await engine.handle(
      update({
        updateId: '1013',
        text: '/student-answer other_account_question | Must be denied.',
      }),
      new Date(now.getTime() + 11_000),
    );
    expect(otherAccountStudent[0]?.text).toContain('No open scoped Student question');

    const unconfirmed = await engine.handle(
      update({
        updateId: '1014',
        text: '/parent-reply parent_conversation_fixture | Unconfirmed answer must not send.',
      }),
      new Date(now.getTime() + 12_000),
    );
    expect(unconfirmed[0]?.buttons?.some((button) => button.label === 'Confirm')).toBe(true);
    expect(await replyWorker.runOnce(new Date(now.getTime() + 13_000))).toMatchObject({
      claimed: 0,
    });
    expect(provider.calls).toHaveLength(1);

    expect(await countRows('onetime.contacts')).toBe(2);
    expect(await countRows('onetime.crm_tasks')).toBe(0);
    expect(await countRows('onetime.communication_history_events')).toBe(0);
    const childContacts = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.contacts
        WHERE display_name ILIKE '%student%' OR display_name ILIKE '%learner%'`,
    );
    expect(Number(childContacts.rows[0]?.count)).toBe(0);
    const audits = await pool.query(
      `SELECT capability, outcome
         FROM onetime.telegram_operation_audit
        WHERE bot_key = $1
        ORDER BY created_at`,
      [botKey],
    );
    expect(audits.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'conversation.parent.reply.confirm',
          outcome: 'completed',
        }),
        expect.objectContaining({
          capability: 'student.question.reply.confirm',
          outcome: 'confirmed',
        }),
        expect.objectContaining({ capability: 'internal_task.create', outcome: 'confirmed' }),
      ]),
    );
  });

  it('holds Parent delivery provider-off and fences one leased owner with restart', async () => {
    const service = new RabbiCommunicationService(pool, codec, 'disabled');
    const context = {
      botKey,
      environment,
      providerUserRef,
      chatRef,
      actor: {
        userKey: asCanonicalUserKey(actorUserKey),
        displayLabel: 'Rabbi Owner',
        accountKey,
        productKey,
        role: 'owner' as const,
        securityVersion: 1,
      },
      mappingKey: 'rabbi_mapping_fixture',
      mappingVersion: 1,
    };
    const preview = await service.preview(
      context,
      {
        capability: 'conversation.parent.reply.preview',
        conversationKey: 'parent_conversation_fixture',
        replyText: 'Provider-off answer.',
      },
      new Date('2026-07-24T09:00:00.000Z'),
    );
    expect('confirmationKey' in preview).toBe(true);
    if (!('confirmationKey' in preview)) throw new Error('expected preview');
    const result = await service.confirm(
      context,
      preview.confirmationKey,
      new Date('2026-07-24T09:00:01.000Z'),
    );
    expect(result.status).toBe('provider_off');
    expect(result.publicMessage).toContain('Nothing was sent or queued');

    const leases = new TelegramSqlConsumerLeaseRepository(pool);
    const first = await leases.acquire({
      botKey,
      environment,
      tokenFingerprint: 'distinct-rabbi-token-fingerprint-hash',
      ownerId: 'rabbi-owner-a',
      leaseMs: 30_000,
      now: new Date('2026-07-24T09:10:00.000Z'),
    });
    expect(first).toMatchObject({ acquired: true, generation: 1 });
    const conflict = await leases.acquire({
      botKey,
      environment,
      tokenFingerprint: 'distinct-rabbi-token-fingerprint-hash',
      ownerId: 'rabbi-owner-b',
      leaseMs: 30_000,
      now: new Date('2026-07-24T09:10:01.000Z'),
    });
    expect(conflict).toEqual({ acquired: false, reason: 'already_owned' });
    if (!first.acquired) throw new Error('expected lease');
    expect(
      await leases.heartbeat(
        'rabbi-owner-a',
        first.generation,
        30_000,
        new Date('2026-07-24T09:10:02.000Z'),
      ),
    ).toBe(true);
    await leases.release('rabbi-owner-a', first.generation);
    const restarted = await leases.acquire({
      botKey,
      environment,
      tokenFingerprint: 'distinct-rabbi-token-fingerprint-hash',
      ownerId: 'rabbi-owner-b',
      leaseMs: 30_000,
      now: new Date('2026-07-24T09:10:03.000Z'),
    });
    expect(restarted).toMatchObject({ acquired: true, generation: 2 });
  });

  it('retries a synthetic provider failure without duplicate delivery', async () => {
    const flaky = new FlakySyntheticProvider();
    const audit = new TelegramSqlAuditSink(pool);
    const service = new RabbiCommunicationService(pool, codec, 'synthetic');
    const context = {
      botKey,
      environment,
      providerUserRef,
      chatRef,
      actor: {
        userKey: asCanonicalUserKey(actorUserKey),
        displayLabel: 'Rabbi Owner',
        accountKey,
        productKey,
        role: 'owner' as const,
        securityVersion: 1,
      },
      mappingKey: 'rabbi_mapping_fixture',
      mappingVersion: 1,
    };
    const preview = await service.preview(
      context,
      {
        capability: 'conversation.parent.reply.preview',
        conversationKey: 'parent_conversation_fixture',
        replyText: 'Retry-safe synthetic reply.',
      },
      new Date('2026-07-24T10:00:00.000Z'),
    );
    if (!('confirmationKey' in preview)) throw new Error('expected preview');
    await service.confirm(context, preview.confirmationKey, new Date('2026-07-24T10:00:01.000Z'));
    const worker = new RabbiParentReplyWorker(pool, codec, flaky, audit, {
      botKey,
      environment,
      ownerId: 'rabbi-retry-worker',
      rowLeaseMs: 30_000,
      baseBackoffMs: 100,
    });
    expect(await worker.runOnce(new Date('2026-07-24T10:00:02.000Z'))).toMatchObject({
      disposition: 'retry',
    });
    expect(await worker.runOnce(new Date('2026-07-24T10:00:02.200Z'))).toMatchObject({
      disposition: 'delivered',
    });
    expect(flaky.successful).toBe(1);
    expect(await worker.runOnce(new Date('2026-07-24T10:00:03.000Z'))).toMatchObject({
      claimed: 0,
    });
    expect(flaky.successful).toBe(1);
  });

  it('prevents a stale same-owner generation from overwriting a newer delivered projection', async () => {
    const provider = new SameOwnerGenerationRaceProvider();
    const audit = new TelegramSqlAuditSink(pool);
    const service = new RabbiCommunicationService(pool, codec, 'synthetic');
    const context = {
      botKey,
      environment,
      providerUserRef,
      chatRef,
      actor: {
        userKey: asCanonicalUserKey(actorUserKey),
        displayLabel: 'Rabbi Owner',
        accountKey,
        productKey,
        role: 'owner' as const,
        securityVersion: 1,
      },
      mappingKey: 'rabbi_mapping_fixture',
      mappingVersion: 1,
    };
    const preview = await service.preview(
      context,
      {
        capability: 'conversation.parent.reply.preview',
        conversationKey: 'parent_conversation_fixture',
        replyText: 'Generation-fenced synthetic reply.',
      },
      new Date('2026-07-24T11:00:00.000Z'),
    );
    if (!('confirmationKey' in preview)) throw new Error('expected preview');
    await service.confirm(context, preview.confirmationKey, new Date('2026-07-24T11:00:01.000Z'));
    const delivery = await pool.query(
      `SELECT delivery_key
         FROM onetime.rabbi_parent_reply_outbox
        WHERE state = 'confirmed'
        ORDER BY created_at DESC, delivery_key DESC
        LIMIT 1`,
    );
    const deliveryKey = String(delivery.rows[0]?.delivery_key);
    await pool.query(
      `UPDATE onetime.rabbi_parent_reply_outbox
          SET max_attempts = 1
        WHERE delivery_key = $1`,
      [deliveryKey],
    );

    const workerConfig = {
      botKey,
      environment,
      ownerId: 'rabbi-reused-worker-identity',
      rowLeaseMs: 100,
      baseBackoffMs: 100,
    };
    const staleWorker = new RabbiParentReplyWorker(pool, codec, provider, audit, workerConfig);
    const newerWorker = new RabbiParentReplyWorker(pool, codec, provider, audit, workerConfig);
    const staleRun = staleWorker.runOnce(new Date('2026-07-24T11:00:02.000Z'));
    await provider.firstAttemptStarted;

    const newerRun = newerWorker.runOnce(new Date('2026-07-24T11:00:02.200Z'));
    await provider.secondAttemptStarted;
    const reclaimed = await pool.query(
      `SELECT state, lease_owner, lease_generation
         FROM onetime.rabbi_parent_reply_outbox
        WHERE delivery_key = $1`,
      [deliveryKey],
    );
    expect(reclaimed.rows[0]).toMatchObject({
      state: 'leased',
      lease_owner: workerConfig.ownerId,
      lease_generation: 2,
    });
    provider.completeNewerAttempt();
    expect(await newerRun).toMatchObject({
      claimed: 1,
      disposition: 'delivered',
    });
    provider.rejectStaleAttempt(new Error('SYNTHETIC_STALE_TERMINAL_FAILURE'));
    await expect(staleRun).resolves.toMatchObject({
      claimed: 1,
      disposition: 'lease_lost',
    });

    const preserved = await pool.query(
      `SELECT outbox.state, outbox.lease_generation, outbox.last_error_code,
              conversation.last_reply_state
         FROM onetime.rabbi_parent_reply_outbox AS outbox
         JOIN onetime.rabbi_parent_conversations AS conversation
           ON conversation.conversation_key = outbox.conversation_key
        WHERE outbox.delivery_key = $1`,
      [deliveryKey],
    );
    expect(preserved.rows[0]).toMatchObject({
      state: 'delivered',
      lease_generation: 2,
      last_error_code: null,
      last_reply_state: 'delivered',
    });
    const staleFailureAudit = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.telegram_operation_audit
        WHERE correlation_key = $1
          AND outcome IN ('failed', 'dead_letter')`,
      [deliveryKey],
    );
    expect(Number(staleFailureAudit.rows[0]?.count)).toBe(0);
    expect(provider.successful).toBe(1);
  });
});

class FlakySyntheticProvider implements RabbiConversationProvider {
  readonly mode = 'synthetic' as const;
  attempts = 0;
  successful = 0;

  async sendReply(input: Parameters<RabbiConversationProvider['sendReply']>[0]) {
    this.attempts += 1;
    if (this.attempts === 1) throw new Error('SYNTHETIC_TRANSIENT_FAILURE');
    this.successful += 1;
    return {
      providerMessageRef: 'synthetic-retry-message',
      conversationRef: input.conversationRef,
    };
  }
}

class SameOwnerGenerationRaceProvider implements RabbiConversationProvider {
  readonly mode = 'synthetic' as const;
  successful = 0;
  private attempts = 0;
  private markFirstAttemptStarted!: () => void;
  private markSecondAttemptStarted!: () => void;
  private rejectFirstAttempt!: (reason?: unknown) => void;
  private resolveSecondAttempt!: () => void;
  readonly firstAttemptStarted = new Promise<void>((resolve) => {
    this.markFirstAttemptStarted = resolve;
  });
  readonly secondAttemptStarted = new Promise<void>((resolve) => {
    this.markSecondAttemptStarted = resolve;
  });
  private readonly staleAttempt = new Promise<never>((_resolve, reject) => {
    this.rejectFirstAttempt = reject;
  });
  private readonly newerAttempt = new Promise<void>((resolve) => {
    this.resolveSecondAttempt = resolve;
  });

  async sendReply(input: Parameters<RabbiConversationProvider['sendReply']>[0]) {
    this.attempts += 1;
    if (this.attempts === 1) {
      this.markFirstAttemptStarted();
      return this.staleAttempt;
    }
    this.markSecondAttemptStarted();
    await this.newerAttempt;
    this.successful += 1;
    return {
      providerMessageRef: 'synthetic-generation-fenced-message',
      conversationRef: input.conversationRef,
    };
  }

  rejectStaleAttempt(reason: unknown) {
    this.rejectFirstAttempt(reason);
  }

  completeNewerAttempt() {
    this.resolveSecondAttempt();
  }
}

async function seedFixtures() {
  const userKey = await createAccountUser({
    pool,
    config,
    email: 'rabbi-owner@example.test',
    password: 'RabbiOwnerPassword!234',
    displayName: 'Rabbi Owner',
    role: 'owner',
    mfaCapable: true,
  });
  await pool.query(
    `INSERT INTO onetime.telegram_bot_registry
       (bot_key, environment, account_key, product_key, token_fingerprint_hash, status)
     VALUES ($1,$2,$3,$4,'rabbi-token-fingerprint-fixture','active')`,
    [botKey, environment, accountKey, productKey],
  );
  await new TelegramSqlIdentityMappingRepository(pool).upsertProtectedMapping({
    mappingKey: 'rabbi_mapping_fixture',
    botKey,
    environment,
    providerUserRef,
    chatRef,
    canonicalUserKey: asCanonicalUserKey(userKey),
    accountKey,
    productKey,
    membershipKey: 'rabbi_membership_fixture',
    mappingVersion: 1,
    securityVersion: 1,
    status: 'active',
  });
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_fixture',$1,$2,'Synthetic Household'),
       ('other_household','other_account','other_product','Other Household')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, reminder_preference, source)
     VALUES
       ('adult_contact_fixture',$1,$2,'Synthetic Adult','family','Synthetic Household',
        'Jerusalem','Asia/Jerusalem','adult@example.test','email','manual_crm'),
       ('other_adult_contact','other_account','other_product','Other Adult','family',
        'Other Household','Jerusalem','Asia/Jerusalem','other-adult@example.test','email',
        'manual_crm')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES
       ('learner_fixture',$1,$2,'household_fixture','Synthetic Learner'),
       ('other_learner','other_account','other_product','other_household','Other Learner')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_questions
       (question_key, account_key, product_key, household_key, learner_key,
        submitted_by_user_ref, question_text, idempotency_key, request_hash)
     VALUES
       ('student_question_fixture',$1,$2,'household_fixture','learner_fixture',
        'student-user-fixture','What is the exact synthetic lesson answer?',
        'student-question-idempotency','a'),
       ('other_account_question','other_account','other_product','other_household',
        'other_learner','other-student','Other account question?',
        'other-question-idempotency','b')`,
    [accountKey, productKey],
  );
  await seedConversation({
    conversationKey: 'parent_conversation_fixture',
    targetAccountKey: accountKey,
    targetProductKey: productKey,
    householdKey: 'household_fixture',
    contactKey: 'adult_contact_fixture',
    providerConversationRef: 'ghl-conversation-synthetic-001',
  });
  await seedConversation({
    conversationKey: 'other_account_conversation',
    targetAccountKey: 'other_account',
    targetProductKey: 'other_product',
    householdKey: 'other_household',
    contactKey: 'other_adult_contact',
    providerConversationRef: 'ghl-conversation-other-account',
  });
  return userKey;
}

async function seedConversation(input: {
  conversationKey: string;
  targetAccountKey: string;
  targetProductKey: string;
  householdKey: string;
  contactKey: string;
  providerConversationRef: string;
}) {
  const encrypted = await encryptRabbiParentConversationRef({
    codec,
    botKey,
    environment,
    accountKey: input.targetAccountKey,
    productKey: input.targetProductKey,
    conversationRef: input.providerConversationRef,
  });
  await pool.query(
    `INSERT INTO onetime.rabbi_parent_conversations
       (conversation_key, account_key, product_key, household_key, adult_contact_key, channel,
        provider_conversation_ciphertext, provider_conversation_digest, provider_contact_digest)
     VALUES ($1,$2,$3,$4,$5,'email',$6,$7,$8)`,
    [
      input.conversationKey,
      input.targetAccountKey,
      input.targetProductKey,
      input.householdKey,
      input.contactKey,
      encrypted.ciphertext,
      encrypted.digest,
      'c'.repeat(64),
    ],
  );
}

function update(overrides: Partial<NormalizedBotUpdate>): NormalizedBotUpdate {
  return {
    updateId: overrides.updateId ?? '1',
    kind: overrides.kind ?? 'message',
    botKey,
    environment,
    providerUserRef,
    chatRef,
    chatContext: 'private',
    isForwarded: false,
    isEdited: false,
    isAnonymousAdmin: false,
    receivedAt: '2026-07-24T08:00:00.000Z',
    ...(overrides.text === undefined ? {} : { text: overrides.text }),
    ...(overrides.callbackData === undefined ? {} : { callbackData: overrides.callbackData }),
  };
}

function confirmCallback(replies: Awaited<ReturnType<RabbiTelegramCommunicationEngine['handle']>>) {
  const callback = replies[0]?.buttons?.find((button) => button.label === 'Confirm')?.callbackData;
  if (!callback) throw new Error('expected confirm callback');
  return callback;
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count);
}
