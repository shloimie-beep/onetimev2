import { createHash } from 'node:crypto';
import type { ActionGatewayEventV1 } from '../../../contracts/src/action-gateway/events.ts';
import { assertActionGatewayEventV1 } from '../../../contracts/src/action-gateway/events.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  BotActionRequest,
  BotCapability,
  BotCommandResult,
  CanonicalOneTimeActor,
  OneTimeBotApplicationAdapter,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import { inTransaction, type DbPool } from '../../../db/src/index.ts';
import { getClassOccurrenceDetail, listClassOccurrences } from '../classes/service.ts';
import { getContentItemDetail, listContentLibrary } from '../content/service.ts';
import { getContactDetail, listContacts } from '../crm/service.ts';
import { stableDigest } from './crypto.ts';

const baseCapabilities: BotCapability[] = [
  'gateway.help',
  'gateway.identity.read_self',
  'gateway.scope.read',
  'crm.lead.list',
  'crm.lead.read',
  'crm.lead.create',
  'crm.contact.read_redacted',
  'crm.lead_tag.list',
  'crm.lead_tag.add',
  'crm.lead_tag.remove',
  'class.schedule.read',
  'class.status.read',
  'class.status.update',
  'content.pipeline.read',
  'content.item.read',
  'content.item.retry',
  'task.list',
  'task.read',
  'task.create',
  'task.update',
  'support.ticket.list',
  'support.ticket.read_redacted',
  'support.ticket.assign_self',
  'support.ticket.status.update',
  'class.question.list',
  'class.question.read_redacted',
  'class.question.select',
  'telegram.audit.read_recent',
];

export function createOneTimeTelegramApplicationAdapter(input: {
  pool: DbPool;
  config: AppConfig;
}): OneTimeBotApplicationAdapter {
  return new SqlBackedOneTimeTelegramApplicationAdapter(input.pool, input.config);
}

class SqlBackedOneTimeTelegramApplicationAdapter implements OneTimeBotApplicationAdapter {
  readonly adapterId = 'sql-backed-onetime-telegram-adapter';

  constructor(
    private readonly pool: DbPool,
    private readonly config: AppConfig,
  ) {}

  supportedCapabilities() {
    return baseCapabilities;
  }

  async resolveActor(input: { mapping: TelegramIdentityMapping }) {
    const result = await this.pool.query(
      `SELECT user_key, display_name, role, status, security_version
         FROM onetime.account_users
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
        LIMIT 1`,
      [input.mapping.accountKey, input.mapping.productKey, input.mapping.canonicalUserKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    const role = String(row.role);
    if (role !== 'owner' && role !== 'admin' && role !== 'crm_agent' && role !== 'viewer') {
      return null;
    }
    return {
      userKey: String(row.user_key) as never,
      displayLabel: String(row.display_name),
      accountKey: input.mapping.accountKey,
      productKey: input.mapping.productKey,
      membershipKey: input.mapping.membershipKey,
      membershipStatus: 'active',
      userStatus: String(row.status) === 'active' ? 'active' : 'disabled',
      role,
      securityVersion: Number(row.security_version),
      capabilities:
        role === 'owner'
          ? baseCapabilities
          : baseCapabilities.filter((capability) => capability !== 'telegram.audit.read_recent'),
    } satisfies CanonicalOneTimeActor;
  }

  async readAction(actor: CanonicalOneTimeActor, request: BotActionRequest) {
    const scopedConfig = {
      ...this.config,
      accountKey: actor.accountKey,
      productKey: actor.productKey,
    };
    switch (request.capability) {
      case 'crm.lead.list': {
        const list = await listContacts({
          pool: this.pool,
          config: scopedConfig,
          query: { search: stringArg(request, 'filter'), limit: 5 },
        });
        if (!list.contacts.length) return 'Leads: no scoped matches.';
        return list.contacts
          .map(
            (contact) => `${contact.contact_id}: ${contact.display_name} (${contact.lead_status})`,
          )
          .join('\n');
      }
      case 'crm.lead.read':
      case 'crm.contact.read_redacted': {
        const contact = await getContactDetail({
          pool: this.pool,
          config: scopedConfig,
          contactId: stringArg(request, 'ref'),
        });
        if (!contact) return 'No scoped contact was found.';
        return [
          `Contact ${contact.contact_id}: ${contact.display_name}`,
          `Status: ${contact.lead_status}`,
          `Assigned: ${contact.assigned_team_member ?? 'unassigned'}`,
          'Email/phone are redacted in Telegram.',
        ].join('\n');
      }
      case 'class.schedule.read': {
        const occurrences = await listClassOccurrences({
          pool: this.pool,
          config: scopedConfig,
          limit: 5,
        });
        if (!occurrences.length) return 'Classes: no scoped class occurrences found.';
        return occurrences
          .map(
            (occurrence) =>
              `${occurrence.occurrence_key}: ${occurrence.status} at ${occurrence.starts_at}`,
          )
          .join('\n');
      }
      case 'class.status.read': {
        const occurrence = await getClassOccurrenceDetail({
          pool: this.pool,
          config: scopedConfig,
          occurrenceKey: stringArg(request, 'ref'),
        });
        if (!occurrence) return 'No scoped class was found.';
        return `Class ${occurrence.occurrence_key}: ${occurrence.status}; provider ${occurrence.readiness.provider_status}.`;
      }
      case 'class.question.list':
        return this.listQuestions(actor, stringArg(request, 'filter'));
      case 'class.question.read_redacted':
        return this.readQuestion(actor, stringArg(request, 'ref'));
      case 'content.pipeline.read': {
        const items = await listContentLibrary({
          pool: this.pool,
          config: scopedConfig,
          query: { limit: 5 },
        });
        if (!items.length) return 'Content pipeline: no scoped items found.';
        return items
          .map((item) => `${item.item_key}: ${item.lifecycle_state} (${item.item_type})`)
          .join('\n');
      }
      case 'content.item.read': {
        const item = await getContentItemDetail({
          pool: this.pool,
          config: scopedConfig,
          itemKey: stringArg(request, 'ref'),
        });
        if (!item) return 'No scoped content item was found.';
        return `Content ${item.item_key}: ${item.lifecycle_state}; provider state is sanitized.`;
      }
      case 'crm.lead_tag.list':
      case 'task.list':
      case 'task.read':
      case 'support.ticket.list':
      case 'support.ticket.read_redacted':
        return 'That One Time service is not enabled yet. No data was changed.';
      case 'telegram.audit.read_recent':
        return this.recentAudit(actor, Number(request.args.count ?? 10));
      default:
        return 'That One Time read action is not enabled yet.';
    }
  }

  async previewAction(actor: CanonicalOneTimeActor, request: BotActionRequest) {
    return [
      `Preview ${request.capability}`,
      `Actor: ${actor.displayLabel}`,
      `Scope: ${actor.accountKey}/${actor.productKey}`,
      `Args: ${safeArgs(request.args)}`,
      'No write has been made.',
    ].join('\n');
  }

  async executeAction(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    if (input.request.capability === 'class.question.select') {
      return this.selectQuestion(actor, input);
    }
    return {
      status: 'feature_unavailable',
      publicMessage: `${input.request.capability} is not enabled through a real One Time application service yet. No write was made.`,
      idempotencyKey: input.idempotencyKey,
    };
  }

  private async recentAudit(actor: CanonicalOneTimeActor, count: number) {
    const result = await this.pool.query(
      `SELECT capability, outcome, reason, created_at
         FROM onetime.telegram_operation_audit
        WHERE account_key = $1
          AND product_key = $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [actor.accountKey, actor.productKey, Math.min(25, Math.max(1, count))],
    );
    if (!result.rows.length) return 'Recent gateway audit: no scoped entries.';
    return result.rows
      .map(
        (row) =>
          `${toIso(row.created_at)} ${String(row.capability ?? 'gateway')} ${String(row.outcome)}${row.reason ? ` (${String(row.reason)})` : ''}`,
      )
      .join('\n');
  }

  private async listQuestions(actor: CanonicalOneTimeActor, filter: string) {
    const normalized = filter.trim();
    const result = await this.pool.query(
      `SELECT question_key, occurrence_key, status, excerpt_redacted, submitted_at
         FROM onetime.classroom_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND (
            $3 = ''
            OR question_key = $3
            OR occurrence_key = $3
            OR status = $3
          )
        ORDER BY submitted_at DESC, question_key DESC
        LIMIT 10`,
      [actor.accountKey, actor.productKey, normalized],
    );
    if (!result.rows.length) return 'Questions: no scoped redacted questions.';
    return result.rows
      .map(
        (row) =>
          `${String(row.question_key)}: ${String(row.status)} for ${String(row.occurrence_key)} at ${toIso(row.submitted_at)} — ${String(row.excerpt_redacted)}`,
      )
      .join('\n');
  }

  private async readQuestion(actor: CanonicalOneTimeActor, questionRef: string) {
    const result = await this.pool.query(
      `SELECT question_key, occurrence_key, status, excerpt_redacted, submitted_at,
              selected_at, selection_revision
         FROM onetime.classroom_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
        LIMIT 1`,
      [actor.accountKey, actor.productKey, questionRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return 'No scoped redacted question was found.';
    return [
      `Question ${String(row.question_key)}: ${String(row.status)}`,
      `Class: ${String(row.occurrence_key)}`,
      `Submitted: ${toIso(row.submitted_at)}`,
      `Revision: ${Number(row.selection_revision ?? 0)}`,
      `Redacted excerpt: ${String(row.excerpt_redacted)}`,
    ].join('\n');
  }

  private async selectQuestion(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return {
        status: 'denied',
        publicMessage: 'Only authorized One Time owner/admin identities can moderate questions.',
        idempotencyKey: input.idempotencyKey,
      };
    }
    const questionRef = stringArg(input.request, 'question_ref');
    if (!questionRef) {
      return {
        status: 'unsupported',
        publicMessage: 'Question selection requires an opaque question reference.',
        idempotencyKey: input.idempotencyKey,
      };
    }

    return inTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT questions.*
           FROM onetime.classroom_question_moderation_actions AS actions
           JOIN onetime.classroom_student_questions AS questions
             ON questions.question_key = actions.question_key
          WHERE actions.account_key = $1
            AND actions.product_key = $2
            AND actions.question_key = $3
            AND actions.action_type = 'feature_next'
            AND actions.idempotency_key = $4
          LIMIT 1`,
        [actor.accountKey, actor.productKey, questionRef, input.idempotencyKey],
      );
      const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
      if (existingRow) {
        const eventId = selectedQuestionEventId(existingRow, input.idempotencyKey);
        return {
          status: 'already_completed',
          publicMessage: `Question ${questionRef} is already featured. No duplicate Zoom action was made.`,
          idempotencyKey: input.idempotencyKey,
          eventIds: [eventId],
          resultRef: questionRef,
        };
      }

      const locked = await client.query(
        `SELECT *
           FROM onetime.classroom_student_questions
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
          FOR UPDATE`,
        [actor.accountKey, actor.productKey, questionRef],
      );
      const row = locked.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return {
          status: 'denied',
          publicMessage: 'No scoped redacted question was found.',
          idempotencyKey: input.idempotencyKey,
        };
      }

      const updated = await client.query(
        `UPDATE onetime.classroom_student_questions
            SET status = 'featured',
                selected_at = COALESCE(selected_at, now()),
                selected_by_user_ref = $4,
                selection_revision = selection_revision + 1
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
          RETURNING *`,
        [actor.accountKey, actor.productKey, questionRef, actor.userKey],
      );
      const question = updated.rows[0] as Record<string, unknown>;
      await client.query(
        `INSERT INTO onetime.classroom_question_moderation_actions
           (moderation_action_key, account_key, product_key, question_key, occurrence_key,
            action_type, actor_user_ref, actor_role, idempotency_key, result_json)
         VALUES ($1,$2,$3,$4,$5,'feature_next',$6,$7,$8,$9::jsonb)
         ON CONFLICT (account_key, product_key, question_key, action_type, idempotency_key)
         DO NOTHING`,
        [
          `classroom_question_action_${stableDigest([questionRef, 'feature_next', input.idempotencyKey]).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          questionRef,
          String(question.occurrence_key),
          actor.userKey,
          actor.role,
          input.idempotencyKey,
          JSON.stringify({ status: 'featured', provider_action_state: 'disabled' }),
        ],
      );

      const event = selectedQuestionEvent(question, actor, input.idempotencyKey);
      await enqueueActionGatewayEvent(client, event, actor);
      await client.query(
        `INSERT INTO onetime.classroom_audit_events
           (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
            learner_key, occurrence_key, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'question_featured',$9::jsonb)`,
        [
          `classroom_audit_${stableDigest([questionRef, input.idempotencyKey, 'telegram']).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          actor.userKey,
          actor.role,
          String(question.household_key),
          String(question.learner_key),
          String(question.occurrence_key),
          JSON.stringify({ provider_action_state: 'disabled', transport: 'telegram' }),
        ],
      );

      return {
        status: 'completed',
        publicMessage: `Question ${questionRef} is featured for the Rabbi queue. Zoom participant controls remain manual.`,
        idempotencyKey: input.idempotencyKey,
        eventIds: [event.id],
        resultRef: questionRef,
      };
    });
  }
}

function stringArg(request: BotActionRequest, key: string) {
  const value = request.args[key];
  return typeof value === 'string' ? value : '';
}

function safeArgs(args: Record<string, unknown>) {
  return JSON.stringify(args)
    .replace(/[^\w\s.:@/-]/g, '')
    .slice(0, 240);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function selectedQuestionEvent(
  question: Record<string, unknown>,
  actor: CanonicalOneTimeActor,
  idempotencyKey: string,
): ActionGatewayEventV1 {
  const selectedAt = toIso(question.selected_at);
  const event: ActionGatewayEventV1 = {
    specversion: '1.0',
    id: selectedQuestionEventId(question, idempotencyKey),
    type: 'class.question.selected',
    source: 'onetime://classroom/questions',
    subject: `classes/${String(question.occurrence_key)}/questions/${String(question.question_key)}`,
    time: selectedAt,
    datacontenttype: 'application/json',
    schema_version: 1,
    scope: { account_id: actor.accountKey, product_id: actor.productKey },
    actor: {
      kind: 'user',
      principal_id: String(actor.userKey),
      role: actor.role === 'owner' ? 'one_time_owner' : 'one_time_admin',
      transport: 'telegram',
    },
    correlation_id: `question_corr_${stableDigest([String(question.question_key)]).slice(0, 24)}`,
    causation_id: null,
    idempotency_key: stableDigest([
      'class.question.selected',
      String(question.question_key),
      idempotencyKey,
    ]),
    trace_id: `question_trace_${stableDigest([String(actor.userKey), String(question.question_key)]).slice(0, 24)}`,
    data: {
      question_id: String(question.question_key),
      class_id: String(question.occurrence_key),
      selected_at: selectedAt,
      selected_by_principal_id: String(actor.userKey),
      selection_revision: Number(question.selection_revision ?? 0),
      status: 'selected',
      reason_code: 'INSTRUCTOR_QUEUE',
    },
  };
  assertActionGatewayEventV1(event);
  return event;
}

function selectedQuestionEventId(question: Record<string, unknown>, idempotencyKey: string) {
  return stableUuid(['class.question.selected', String(question.question_key), idempotencyKey]);
}

async function enqueueActionGatewayEvent(
  client: { query: DbPool['query'] },
  event: ActionGatewayEventV1,
  actor: CanonicalOneTimeActor,
) {
  await client.query(
    `INSERT INTO onetime.action_gateway_event_outbox
       (event_id, event_type, source, subject, account_key, product_key, actor_principal_id,
        actor_role, transport, correlation_id, causation_id, idempotency_key, event_json,
        event_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'telegram',$9,$10,$11,$12::jsonb,$13)
     ON CONFLICT (account_key, product_key, event_type, idempotency_key)
     DO NOTHING`,
    [
      event.id,
      event.type,
      event.source,
      event.subject,
      actor.accountKey,
      actor.productKey,
      actor.userKey,
      actor.role,
      event.correlation_id,
      event.causation_id ?? null,
      event.idempotency_key,
      JSON.stringify(event),
      sha256(JSON.stringify(event)),
    ],
  );
}

function stableUuid(parts: Array<string | number | boolean | null | undefined>) {
  const hex = stableDigest(parts);
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
