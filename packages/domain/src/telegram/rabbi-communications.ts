import { createHash, randomUUID } from 'node:crypto';
import type {
  RabbiCommunicationActor,
  RabbiCommunicationResult,
  RabbiConfirmationContext,
  RabbiConfirmationPayload,
  RabbiPreview,
  RabbiPreviewCapability,
  RabbiPreviewRequest,
  RabbiReadRequest,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import type { SensitivePayloadCodec } from '../../../contracts/src/telegram/types.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';

type DeliveryMode = 'disabled' | 'synthetic' | 'provider';

type ConfirmationRow = {
  confirmation_key: string;
  bot_key: string;
  environment: string;
  provider_user_ref_hash: string;
  chat_ref_hash: string;
  actor_user_key: string;
  account_key: string;
  product_key: string;
  capability: RabbiPreviewCapability;
  target_key: string;
  target_revision: number;
  mapping_key: string;
  mapping_version: number;
  security_version: number;
  action_digest: string;
  preview_digest: string;
  idempotency_key: string;
  payload_ciphertext: string | null;
  payload_digest: string;
  payload_classification: 'confirmation_payload';
  expires_at: string | Date;
  consumed_at: string | Date | null;
  cancelled_at: string | Date | null;
  result_json: unknown;
};

export class RabbiCommunicationService {
  constructor(
    private readonly pool: DbPool,
    private readonly codec: SensitivePayloadCodec,
    private readonly deliveryMode: DeliveryMode,
  ) {}

  async read(actor: RabbiCommunicationActor, request: RabbiReadRequest) {
    switch (request.capability) {
      case 'conversation.parent.list':
        return this.listParentConversations(actor);
      case 'conversation.parent.read_redacted':
        return this.readParentConversation(actor, request.conversationKey);
      case 'student.question.list':
        return this.listStudentQuestions(actor);
      case 'student.question.read':
        return this.readStudentQuestion(actor, request.questionKey);
      case 'internal_task.list':
        return this.listInternalTasks(actor);
    }
  }

  async preview(
    context: RabbiConfirmationContext,
    request: RabbiPreviewRequest,
    now = new Date(),
  ): Promise<RabbiPreview | RabbiCommunicationResult> {
    const validated = await this.validatePreviewTarget(context.actor, request);
    if (!validated.ok) return validated.result;
    const normalized = normalizePreviewRequest(request);
    const actionDigest = digest(
      canonicalJson({
        capability: normalized.capability,
        actor: context.actor.userKey,
        account: context.actor.accountKey,
        product: context.actor.productKey,
        target: validated.targetKey,
        target_revision: validated.targetRevision,
        mapping: context.mappingKey,
        mapping_revision: context.mappingVersion,
        request: normalized,
      }),
    );
    const existing = await this.findOpenByDigest(context, actionDigest, now);
    if (existing) return previewFromRow(existing, validated.summary);

    const confirmationKey = `rabbi_confirm_${randomUUID()}`;
    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
    const idempotencyKey = digest(
      [
        context.botKey,
        context.environment,
        context.actor.userKey,
        actionDigest,
        validated.targetRevision,
      ].join('\u001f'),
    );
    const payloadRef = await this.codec.encrypt(normalized, {
      botKey: context.botKey,
      environment: context.environment,
      accountKey: context.actor.accountKey,
      productKey: context.actor.productKey,
      actorKey: context.actor.userKey,
      classification: 'confirmation_payload',
    });
    const previewDigest = digest(validated.summary);
    await this.pool.query(
      `INSERT INTO onetime.rabbi_action_confirmations
       (confirmation_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
        actor_user_key, account_key, product_key, capability, target_key, target_revision,
        mapping_key, mapping_version, security_version, action_digest, preview_digest,
        idempotency_key, payload_ciphertext, payload_digest, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        confirmationKey,
        context.botKey,
        context.environment,
        digest(context.providerUserRef),
        digest(context.chatRef),
        context.actor.userKey,
        context.actor.accountKey,
        context.actor.productKey,
        normalized.capability,
        validated.targetKey,
        validated.targetRevision,
        context.mappingKey,
        context.mappingVersion,
        context.actor.securityVersion,
        actionDigest,
        previewDigest,
        idempotencyKey,
        payloadRef.ciphertext,
        payloadRef.digest,
        expiresAt,
      ],
    );
    return {
      confirmationKey,
      capability: normalized.capability,
      summary: validated.summary,
      actionDigest,
      expiresAt,
    };
  }

  async confirmationCapability(confirmationKey: string) {
    const result = await this.pool.query(
      `SELECT capability
         FROM onetime.rabbi_action_confirmations
        WHERE confirmation_key = $1`,
      [confirmationKey],
    );
    return (result.rows[0]?.capability as RabbiPreviewCapability | undefined) ?? null;
  }

  async confirm(
    context: RabbiConfirmationContext,
    confirmationKey: string,
    now = new Date(),
  ): Promise<RabbiCommunicationResult> {
    const before = await this.getConfirmation(confirmationKey);
    const validation = validateConfirmationContext(before, context, now);
    if (validation) return validation;
    if (!before) return denied('Confirmation not found.');
    if (before.result_json) return parseStoredResult(before.result_json);
    if (!before.payload_ciphertext) return denied('Confirmation payload is no longer available.');

    const payload = (await this.codec.decrypt(
      {
        ciphertext: before.payload_ciphertext,
        digest: before.payload_digest,
        classification: before.payload_classification,
      },
      {
        botKey: context.botKey,
        environment: context.environment,
        accountKey: context.actor.accountKey,
        productKey: context.actor.productKey,
        actorKey: context.actor.userKey,
        classification: 'confirmation_payload',
      },
    )) as RabbiConfirmationPayload;

    return inTransaction(this.pool, async (client) => {
      const consumed = await client.query(
        `UPDATE onetime.rabbi_action_confirmations
            SET consumed_at = $2
          WHERE confirmation_key = $1
            AND consumed_at IS NULL
            AND cancelled_at IS NULL
            AND expires_at > $2`,
        [confirmationKey, now.toISOString()],
      );
      if (!consumed.rowCount) {
        const replay = await getConfirmation(client, confirmationKey);
        if (replay?.result_json) return parseStoredResult(replay.result_json);
        if (replay?.cancelled_at) return cancelled();
        if (replay && new Date(replay.expires_at).getTime() <= now.getTime()) return expired();
        return denied('Confirmation is no longer available.');
      }

      const result = await this.executeConfirmed(client, context.actor, before, payload, now);
      await client.query(
        `UPDATE onetime.rabbi_action_confirmations
            SET result_json = $2::jsonb,
                payload_ciphertext = NULL
          WHERE confirmation_key = $1`,
        [confirmationKey, JSON.stringify(result)],
      );
      return result;
    });
  }

  async cancel(
    context: RabbiConfirmationContext,
    confirmationKey: string,
    now = new Date(),
  ): Promise<RabbiCommunicationResult> {
    const row = await this.getConfirmation(confirmationKey);
    const validation = validateConfirmationContext(row, context, now);
    if (validation) return validation;
    if (!row) return denied('Confirmation not found.');
    const result = await this.pool.query(
      `UPDATE onetime.rabbi_action_confirmations
          SET cancelled_at = $2,
              result_json = $3::jsonb,
              payload_ciphertext = NULL
        WHERE confirmation_key = $1
          AND consumed_at IS NULL
          AND cancelled_at IS NULL
          AND expires_at > $2`,
      [confirmationKey, now.toISOString(), JSON.stringify(cancelled())],
    );
    if (result.rowCount) return cancelled();
    const latest = await this.getConfirmation(confirmationKey);
    if (latest?.result_json) return parseStoredResult(latest.result_json);
    return denied('Confirmation is no longer available.');
  }

  private async listParentConversations(actor: RabbiCommunicationActor) {
    const result = await this.pool.query(
      `SELECT conversation_key, channel, assignment_state, last_reply_state, updated_at
         FROM onetime.rabbi_parent_conversations
        WHERE account_key = $1
          AND product_key = $2
          AND assignment_state = 'assigned_to_rabbi'
        ORDER BY updated_at DESC, conversation_key
        LIMIT 10`,
      [actor.accountKey, actor.productKey],
    );
    if (!result.rowCount) return 'Parent conversations: no assigned scoped conversations.';
    return [
      'Assigned parent conversations:',
      ...result.rows.map(
        (row) =>
          `${String(row.conversation_key)} · ${String(row.channel)} · reply ${String(row.last_reply_state)}`,
      ),
      'Customer transcript remains in HighLevel Conversations.',
    ].join('\n');
  }

  private async readParentConversation(actor: RabbiCommunicationActor, conversationKey: string) {
    const result = await this.pool.query(
      `SELECT conversation_key, channel, assignment_state, scope_revision,
              last_reply_state, last_reply_digest
         FROM onetime.rabbi_parent_conversations
        WHERE account_key = $1
          AND product_key = $2
          AND conversation_key = $3
        LIMIT 1`,
      [actor.accountKey, actor.productKey, conversationKey],
    );
    const row = result.rows[0];
    if (!row) return 'No scoped parent conversation was found.';
    return [
      `Parent conversation ${String(row.conversation_key)}`,
      `Channel: ${String(row.channel)}.`,
      `Assignment: ${String(row.assignment_state)}.`,
      `Reply state: ${String(row.last_reply_state)}.`,
      `Scope revision: ${Number(row.scope_revision)}.`,
      'Transcript content is intentionally read from HighLevel, not copied into One Time.',
    ].join('\n');
  }

  private async listStudentQuestions(actor: RabbiCommunicationActor) {
    const result = await this.pool.query(
      `SELECT question_key, learner_key, question_status, created_at
         FROM onetime.portal_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND question_status IN ('submitted', 'in_review')
        ORDER BY created_at, question_key
        LIMIT 10`,
      [actor.accountKey, actor.productKey],
    );
    if (!result.rowCount) return 'Student questions: no open scoped questions.';
    return [
      'Open Student questions:',
      ...result.rows.map(
        (row) =>
          `${String(row.question_key)} · learner ${String(row.learner_key)} · ${String(row.question_status)}`,
      ),
    ].join('\n');
  }

  private async readStudentQuestion(actor: RabbiCommunicationActor, questionKey: string) {
    const result = await this.pool.query(
      `SELECT question_key, learner_key, question_text, question_status,
              answer_preview, rabbi_answer_revision
         FROM onetime.portal_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
        LIMIT 1`,
      [actor.accountKey, actor.productKey, questionKey],
    );
    const row = result.rows[0];
    if (!row) return 'No scoped Student question was found.';
    return [
      `Student question ${String(row.question_key)} (learner ${String(row.learner_key)})`,
      `Status: ${String(row.question_status)}.`,
      String(row.question_text),
      row.answer_preview ? `Current answer: ${String(row.answer_preview)}` : 'No answer yet.',
    ].join('\n');
  }

  private async listInternalTasks(actor: RabbiCommunicationActor) {
    const result = await this.pool.query(
      `SELECT task_key, title, status, priority, version
         FROM onetime.rabbi_internal_tasks
        WHERE account_key = $1
          AND product_key = $2
        ORDER BY updated_at DESC, task_key
        LIMIT 10`,
      [actor.accountKey, actor.productKey],
    );
    if (!result.rowCount) return 'Internal Rabbi/operator tasks: none.';
    return [
      'Internal Rabbi/operator tasks:',
      ...result.rows.map(
        (row) =>
          `${String(row.task_key)} · ${String(row.title)} · ${String(row.status)} · ${String(row.priority)} · v${Number(row.version)}`,
      ),
    ].join('\n');
  }

  private async validatePreviewTarget(
    actor: RabbiCommunicationActor,
    request: RabbiPreviewRequest,
  ): Promise<
    | { ok: true; targetKey: string; targetRevision: number; summary: string }
    | { ok: false; result: RabbiCommunicationResult }
  > {
    switch (request.capability) {
      case 'conversation.parent.reply.preview': {
        if (!validText(request.replyText, 1, 4_000)) return invalidText('reply');
        const result = await this.pool.query(
          `SELECT conversation_key, channel, assignment_state, scope_revision
             FROM onetime.rabbi_parent_conversations
            WHERE account_key = $1
              AND product_key = $2
              AND conversation_key = $3
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.conversationKey],
        );
        const row = result.rows[0];
        if (!row || row.assignment_state !== 'assigned_to_rabbi') {
          return { ok: false, result: denied('No assigned scoped parent conversation was found.') };
        }
        return {
          ok: true,
          targetKey: request.conversationKey,
          targetRevision: Number(row.scope_revision),
          summary: [
            `Preview Parent reply for ${request.conversationKey}.`,
            request.replyText.trim(),
            `On confirmation this is queued only for the same ${String(row.channel)} HighLevel conversation.`,
          ].join('\n'),
        };
      }
      case 'student.question.reply.preview': {
        if (!validText(request.answerText, 1, 4_000)) return invalidText('answer');
        const result = await this.pool.query(
          `SELECT question_key, question_text, question_status, rabbi_answer_revision
             FROM onetime.portal_student_questions
            WHERE account_key = $1
              AND product_key = $2
              AND question_key = $3
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.questionKey],
        );
        const row = result.rows[0];
        if (!row || !['submitted', 'in_review'].includes(String(row.question_status))) {
          return { ok: false, result: denied('No open scoped Student question was found.') };
        }
        return {
          ok: true,
          targetKey: request.questionKey,
          targetRevision: Number(row.rabbi_answer_revision),
          summary: [
            `Preview Student answer for ${request.questionKey}.`,
            request.answerText.trim(),
            'On confirmation this answer is written to the existing Student portal question.',
          ].join('\n'),
        };
      }
      case 'student.question.close': {
        const result = await this.pool.query(
          `SELECT question_key, question_status, rabbi_answer_revision
             FROM onetime.portal_student_questions
            WHERE account_key = $1
              AND product_key = $2
              AND question_key = $3
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.questionKey],
        );
        const row = result.rows[0];
        if (!row || row.question_status === 'archived') {
          return { ok: false, result: denied('No closable scoped Student question was found.') };
        }
        return {
          ok: true,
          targetKey: request.questionKey,
          targetRevision: Number(row.rabbi_answer_revision),
          summary: `Preview close for Student question ${request.questionKey}.`,
        };
      }
      case 'internal_task.create':
        if (!validText(request.title, 2, 240) || !validText(request.detail, 0, 2_000)) {
          return invalidText('internal task');
        }
        return {
          ok: true,
          targetKey: 'new_internal_task',
          targetRevision: 0,
          summary: `Preview internal task create: ${request.title.trim()} · ${request.priority}.`,
        };
      case 'internal_task.update': {
        if (request.title !== undefined && !validText(request.title, 2, 240)) {
          return invalidText('internal task');
        }
        const result = await this.pool.query(
          `SELECT task_key, title, version
             FROM onetime.rabbi_internal_tasks
            WHERE account_key = $1
              AND product_key = $2
              AND task_key = $3
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.taskKey],
        );
        const row = result.rows[0];
        if (!row) return { ok: false, result: denied('No scoped internal task was found.') };
        return {
          ok: true,
          targetKey: request.taskKey,
          targetRevision: Number(row.version),
          summary: `Preview internal task update: ${String(row.title)} → ${request.status}${request.title ? ` · ${request.title.trim()}` : ''}.`,
        };
      }
    }
  }

  private async findOpenByDigest(
    context: RabbiConfirmationContext,
    actionDigest: string,
    now: Date,
  ) {
    const result = await this.pool.query(
      `SELECT *
         FROM onetime.rabbi_action_confirmations
        WHERE bot_key = $1
          AND environment = $2
          AND actor_user_key = $3
          AND action_digest = $4
          AND consumed_at IS NULL
          AND cancelled_at IS NULL
          AND expires_at > $5
        LIMIT 1`,
      [context.botKey, context.environment, context.actor.userKey, actionDigest, now.toISOString()],
    );
    return (result.rows[0] as ConfirmationRow | undefined) ?? null;
  }

  private async getConfirmation(confirmationKey: string) {
    return getConfirmation(this.pool, confirmationKey);
  }

  private async executeConfirmed(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: RabbiConfirmationPayload,
    now: Date,
  ): Promise<RabbiCommunicationResult> {
    if (payload.capability !== row.capability) return denied('Confirmation payload mismatch.');
    switch (payload.capability) {
      case 'conversation.parent.reply.preview':
        return this.confirmParentReply(client, actor, row, payload, now);
      case 'student.question.reply.preview':
        return this.confirmStudentAnswer(client, actor, row, payload, now);
      case 'student.question.close':
        return this.confirmStudentClose(client, actor, row, payload, now);
      case 'internal_task.create':
        return this.confirmInternalTaskCreate(client, actor, row, payload);
      case 'internal_task.update':
        return this.confirmInternalTaskUpdate(client, actor, row, payload, now);
    }
  }

  private async confirmParentReply(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: Extract<RabbiConfirmationPayload, { capability: 'conversation.parent.reply.preview' }>,
    now: Date,
  ): Promise<RabbiCommunicationResult> {
    const target = await client.query(
      `SELECT scope_revision, assignment_state
         FROM onetime.rabbi_parent_conversations
        WHERE account_key = $1
          AND product_key = $2
          AND conversation_key = $3`,
      [actor.accountKey, actor.productKey, payload.conversationKey],
    );
    const conversation = target.rows[0];
    if (
      !conversation ||
      conversation.assignment_state !== 'assigned_to_rabbi' ||
      Number(conversation.scope_revision) !== row.target_revision
    ) {
      return stale('Parent conversation scope changed; preview again.');
    }
    if (this.deliveryMode === 'disabled') {
      return {
        status: 'provider_off',
        publicMessage:
          'Reply confirmed, but HighLevel delivery is provider-off. Nothing was sent or queued.',
      };
    }
    const replyText = payload.replyText.trim();
    const replyDigest = digest(replyText);
    const deliveryKey = `rabbi_delivery_${row.idempotency_key.slice(0, 32)}`;
    const payloadRef = await this.codec.encrypt(
      { replyText },
      {
        botKey: row.bot_key as never,
        environment: row.environment as never,
        accountKey: actor.accountKey,
        productKey: actor.productKey,
        actorKey: actor.userKey,
        classification: 'intent_payload',
      },
    );
    await client.query(
      `INSERT INTO onetime.rabbi_parent_reply_outbox
       (delivery_key, bot_key, environment, account_key, product_key, conversation_key,
        actor_user_key, idempotency_key, reply_digest, payload_ciphertext, payload_digest,
        provider_mode, next_attempt_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (
         bot_key, environment, account_key, product_key, actor_user_key, idempotency_key
       ) DO NOTHING`,
      [
        deliveryKey,
        row.bot_key,
        row.environment,
        actor.accountKey,
        actor.productKey,
        payload.conversationKey,
        actor.userKey,
        row.idempotency_key,
        replyDigest,
        payloadRef.ciphertext,
        payloadRef.digest,
        this.deliveryMode,
        now.toISOString(),
      ],
    );
    await client.query(
      `UPDATE onetime.rabbi_parent_conversations
          SET last_reply_digest = $4,
              last_reply_state = 'confirmed',
              updated_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND conversation_key = $3`,
      [actor.accountKey, actor.productKey, payload.conversationKey, replyDigest, now.toISOString()],
    );
    return {
      status: 'confirmed',
      publicMessage:
        this.deliveryMode === 'synthetic'
          ? 'Parent reply confirmed for synthetic same-conversation delivery.'
          : 'Parent reply confirmed and queued for the same HighLevel conversation.',
      resultRef: deliveryKey,
    };
  }

  private async confirmStudentAnswer(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: Extract<RabbiConfirmationPayload, { capability: 'student.question.reply.preview' }>,
    now: Date,
  ): Promise<RabbiCommunicationResult> {
    const answer = payload.answerText.trim();
    const result = await client.query(
      `UPDATE onetime.portal_student_questions
          SET answer_preview = $5,
              question_status = 'answered',
              answered_at = $6,
              rabbi_answer_revision = rabbi_answer_revision + 1,
              rabbi_answer_digest = $7,
              rabbi_answered_by_user_ref = $8,
              updated_at = $6
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
          AND rabbi_answer_revision = $4
          AND question_status IN ('submitted', 'in_review')`,
      [
        actor.accountKey,
        actor.productKey,
        payload.questionKey,
        row.target_revision,
        answer,
        now.toISOString(),
        digest(answer),
        actor.userKey,
      ],
    );
    if (!result.rowCount) return stale('Student question changed; preview again.');
    return {
      status: 'completed',
      publicMessage:
        'Student answer confirmed and written to the existing Student portal question.',
      resultRef: payload.questionKey,
    };
  }

  private async confirmStudentClose(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: Extract<RabbiConfirmationPayload, { capability: 'student.question.close' }>,
    now: Date,
  ): Promise<RabbiCommunicationResult> {
    const result = await client.query(
      `UPDATE onetime.portal_student_questions
          SET question_status = 'archived',
              closed_at = $5,
              rabbi_answer_revision = rabbi_answer_revision + 1,
              rabbi_answered_by_user_ref = $6,
              updated_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
          AND rabbi_answer_revision = $4
          AND question_status <> 'archived'`,
      [
        actor.accountKey,
        actor.productKey,
        payload.questionKey,
        row.target_revision,
        now.toISOString(),
        actor.userKey,
      ],
    );
    if (!result.rowCount) return stale('Student question changed; preview again.');
    return {
      status: 'completed',
      publicMessage: 'Student question closed in the existing Student portal question record.',
      resultRef: payload.questionKey,
    };
  }

  private async confirmInternalTaskCreate(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: Extract<RabbiConfirmationPayload, { capability: 'internal_task.create' }>,
  ): Promise<RabbiCommunicationResult> {
    const taskKey = `rabbi_task_${row.idempotency_key.slice(0, 24)}`;
    await client.query(
      `INSERT INTO onetime.rabbi_internal_tasks
       (task_key, account_key, product_key, title, detail, priority, created_by_user_key,
        updated_by_user_key, idempotency_key, request_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
       ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING`,
      [
        taskKey,
        actor.accountKey,
        actor.productKey,
        payload.title.trim(),
        payload.detail.trim(),
        payload.priority,
        actor.userKey,
        row.idempotency_key,
        row.action_digest,
      ],
    );
    return {
      status: 'completed',
      publicMessage: 'Internal Rabbi/operator task created without a GHL contact.',
      resultRef: taskKey,
    };
  }

  private async confirmInternalTaskUpdate(
    client: Queryable,
    actor: RabbiCommunicationActor,
    row: ConfirmationRow,
    payload: Extract<RabbiConfirmationPayload, { capability: 'internal_task.update' }>,
    now: Date,
  ): Promise<RabbiCommunicationResult> {
    const result = await client.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET status = $5,
              title = COALESCE($6, title),
              updated_by_user_key = $7,
              version = version + 1,
              completed_at = CASE WHEN $5 = 'completed' THEN $8 ELSE NULL END,
              updated_at = $8
        WHERE account_key = $1
          AND product_key = $2
          AND task_key = $3
          AND version = $4`,
      [
        actor.accountKey,
        actor.productKey,
        payload.taskKey,
        row.target_revision,
        payload.status,
        payload.title?.trim() ?? null,
        actor.userKey,
        now.toISOString(),
      ],
    );
    if (!result.rowCount) return stale('Internal task changed; preview again.');
    return {
      status: 'completed',
      publicMessage: 'Internal Rabbi/operator task updated.',
      resultRef: payload.taskKey,
    };
  }
}

async function getConfirmation(target: Pick<DbPool, 'query'>, confirmationKey: string) {
  const result = await target.query(
    `SELECT *
       FROM onetime.rabbi_action_confirmations
      WHERE confirmation_key = $1`,
    [confirmationKey],
  );
  return (result.rows[0] as ConfirmationRow | undefined) ?? null;
}

function validateConfirmationContext(
  row: ConfirmationRow | null,
  context: RabbiConfirmationContext,
  now: Date,
): RabbiCommunicationResult | null {
  if (!row) return null;
  if (row.result_json) return parseStoredResult(row.result_json);
  if (row.cancelled_at) return cancelled();
  if (row.consumed_at) {
    return {
      status: 'already_completed',
      publicMessage: 'This confirmation was already consumed; no action was repeated.',
    };
  }
  if (new Date(row.expires_at).getTime() <= now.getTime()) return expired();
  if (
    row.bot_key !== context.botKey ||
    row.environment !== context.environment ||
    row.actor_user_key !== context.actor.userKey ||
    row.account_key !== context.actor.accountKey ||
    row.product_key !== context.actor.productKey ||
    row.provider_user_ref_hash !== digest(context.providerUserRef) ||
    row.chat_ref_hash !== digest(context.chatRef) ||
    row.mapping_key !== context.mappingKey ||
    row.mapping_version !== context.mappingVersion ||
    row.security_version !== context.actor.securityVersion
  ) {
    return denied('Confirmation scope or identity changed; preview again.');
  }
  return null;
}

function normalizePreviewRequest(request: RabbiPreviewRequest): RabbiPreviewRequest {
  switch (request.capability) {
    case 'conversation.parent.reply.preview':
      return { ...request, replyText: request.replyText.trim() };
    case 'student.question.reply.preview':
      return { ...request, answerText: request.answerText.trim() };
    case 'student.question.close':
      return { ...request };
    case 'internal_task.create':
      return { ...request, title: request.title.trim(), detail: request.detail.trim() };
    case 'internal_task.update':
      return {
        ...request,
        ...(request.title === undefined ? {} : { title: request.title.trim() }),
      };
  }
}

function previewFromRow(row: ConfirmationRow, summary: string): RabbiPreview {
  return {
    confirmationKey: row.confirmation_key,
    capability: row.capability,
    summary,
    actionDigest: row.action_digest,
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

function validText(value: string, min: number, max: number) {
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max && !trimmed.includes('\u0000');
}

function invalidText(label: string) {
  return {
    ok: false as const,
    result: denied(`The ${label} text is missing or outside the allowed length.`),
  };
}

function denied(publicMessage: string): RabbiCommunicationResult {
  return { status: 'denied', publicMessage };
}

function stale(publicMessage: string): RabbiCommunicationResult {
  return { status: 'stale', publicMessage };
}

function cancelled(): RabbiCommunicationResult {
  return { status: 'cancelled', publicMessage: 'Confirmation cancelled. Nothing was changed.' };
}

function expired(): RabbiCommunicationResult {
  return { status: 'expired', publicMessage: 'Confirmation expired. Preview the action again.' };
}

function parseStoredResult(value: unknown): RabbiCommunicationResult {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RabbiCommunicationResult;
    } catch {
      return { status: 'failed', publicMessage: 'Stored confirmation result is invalid.' };
    }
  }
  return value as RabbiCommunicationResult;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
