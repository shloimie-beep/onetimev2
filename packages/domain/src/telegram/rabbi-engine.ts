import type {
  RabbiCommunicationActor,
  RabbiCommunicationCapability,
  RabbiConfirmationContext,
  RabbiPreviewRequest,
  RabbiReadRequest,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import { rabbiCommunicationCapabilities } from '../../../contracts/src/telegram/rabbi-communications.ts';
import type {
  BotAuditSink,
  BotCapability,
  BotReply,
  CanonicalOneTimeActor,
  NormalizedBotUpdate,
  OneTimeBotApplicationAdapter,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { correlationKey } from './crypto.ts';
import { TelegramIdentityResolver } from './identity.ts';
import { RabbiCommunicationService } from './rabbi-communications.ts';
import type { RabbiTelegramOperationsReader } from './rabbi-operations.ts';

const HELP_TEXT = [
  'One Time Rabbi communications:',
  '/parent-conversations',
  '/parent-conversation <ref>',
  '/parent-reply <ref> | <reply>',
  '/student-questions',
  '/student-question <ref>',
  '/student-answer <ref> | <answer>',
  '/student-close <ref>',
  '/internal-tasks',
  '/internal-task-create <title> | <detail> | <low|normal|high>',
  '/internal-task-update <ref> | <queued|in_progress|blocked|completed|cancelled> | <optional title>',
  '/class-readiness <occurrence-ref>',
  '/content-processing-status',
  '/incidents',
  '/incident <safe-incident-ref>',
  '/agent-tasks',
  '/agent-task-create <login_access|support_incident|class_readiness|content_processing> | <low|normal|high>',
  '/agent-task-update <ref> | <queued|in_progress|blocked|completed|cancelled>',
  'Every write produces a typed preview and requires an explicit Confirm button.',
].join('\n');

const forbiddenPattern =
  /\b(access|zoom|social|voice|studio|shell|codex|deploy|publish|campaign|bulk|mass|billing|refund|password|login|token|secret|production|bna|impersonate|child contact|student contact)\b/i;
const sensitiveOperationPattern =
  /(?:https?:\/\/|www\.|\b(?:password|passcode|token|secret|api[ _-]?key|credential|authorization|bearer|meeting[ _-]?(?:id|link|url)|provider[ _-]?id|student|learner|child|email|phone)\b|\b\d{7,}\b)/i;
const safeReferencePattern = /^[a-z][a-z0-9_-]{0,119}$/i;

type RabbiCommand =
  | { type: 'help' }
  | { type: 'read'; request: RabbiReadRequest }
  | { type: 'preview'; request: RabbiPreviewRequest }
  | { type: 'confirm'; confirmationKey: string }
  | { type: 'cancel'; confirmationKey: string }
  | { type: 'unsupported'; reason: 'unknown' | 'forbidden' | 'missing_argument' };

export class RabbiTelegramCommunicationEngine {
  constructor(
    private readonly resolver: TelegramIdentityResolver,
    private readonly service: RabbiCommunicationService,
    private readonly audit: BotAuditSink,
    private readonly operations?: RabbiTelegramOperationsReader,
  ) {}

  async handle(update: NormalizedBotUpdate, now = new Date()): Promise<BotReply[]> {
    const command = classifyRabbiCommand(update);
    const capability = await this.commandCapability(command);
    const auth = await this.resolver.authorize(
      update,
      capability as BotCapability | undefined,
      now,
    );
    const correlation = correlationKey('rabbi_bot');
    if (!auth.allowed) {
      await this.audit.record({
        botKey: update.botKey,
        environment: update.environment,
        ...(capability ? { capability: capability as BotCapability } : {}),
        correlationKey: correlation,
        outcome: 'denied',
        reason: auth.reason,
      });
      return update.chatRef
        ? [
            {
              chatRef: update.chatRef,
              correlationKey: correlation,
              text: 'This Rabbi bot only works in its authorized One Time owner/admin private chat.',
            },
          ]
        : [];
    }
    if (!update.chatRef || !update.providerUserRef) return [];

    const actor = toRabbiActor(auth.actor);
    const context: RabbiConfirmationContext = {
      botKey: update.botKey,
      environment: update.environment,
      providerUserRef: update.providerUserRef,
      chatRef: update.chatRef,
      actor,
      mappingKey: auth.mapping.mappingKey,
      mappingVersion: auth.mapping.mappingVersion,
    };
    const auditBase = {
      botKey: update.botKey,
      environment: update.environment,
      accountKey: actor.accountKey,
      productKey: actor.productKey,
      actorUserKey: actor.userKey,
      correlationKey: correlation,
    };

    if (command.type === 'unsupported') {
      await this.audit.record({
        ...auditBase,
        outcome: command.reason === 'forbidden' ? 'denied' : 'unsupported',
        reason: command.reason,
      });
      return [
        {
          chatRef: update.chatRef,
          correlationKey: correlation,
          text:
            command.reason === 'forbidden'
              ? 'That request is outside this communication-only Rabbi bot.'
              : HELP_TEXT,
        },
      ];
    }
    if (command.type === 'help') {
      await this.audit.record({ ...auditBase, outcome: 'completed' });
      return [{ chatRef: update.chatRef, correlationKey: correlation, text: HELP_TEXT }];
    }
    if (command.type === 'read') {
      const text = isOperationRead(command.request)
        ? this.operations
          ? await this.operations.read(actor, command.request)
          : 'Read-only operations status is unavailable in this runtime.'
        : await this.service.read(actor, command.request);
      await this.audit.record({
        ...auditBase,
        capability: command.request.capability as BotCapability,
        outcome: 'completed',
      });
      return [
        {
          chatRef: update.chatRef as never,
          correlationKey: correlation,
          text: text ?? 'This scoped read is unavailable.',
        },
      ];
    }
    if (command.type === 'preview') {
      const preview = await this.service.preview(context, command.request, now);
      if ('confirmationKey' in preview) {
        await this.audit.record({
          ...auditBase,
          capability: command.request.capability,
          outcome: 'previewed',
          metadata: {
            action_digest: preview.actionDigest,
            confirmation_key: preview.confirmationKey,
          },
        });
        return [
          {
            chatRef: update.chatRef,
            correlationKey: correlation,
            text: preview.summary,
            buttons: [
              {
                label: 'Confirm',
                callbackData: `rabbi:confirm:${preview.confirmationKey}`,
              },
              { label: 'Cancel', callbackData: `rabbi:cancel:${preview.confirmationKey}` },
            ],
          },
        ];
      }
      await this.audit.record({
        ...auditBase,
        capability: command.request.capability,
        outcome: preview.status === 'denied' ? 'denied' : 'failed',
        reason: preview.status,
      });
      return [
        {
          chatRef: update.chatRef,
          correlationKey: correlation,
          text: preview.publicMessage,
        },
      ];
    }
    if (command.type === 'cancel') {
      const result = await this.service.cancel(context, command.confirmationKey, now);
      await this.audit.record({
        ...auditBase,
        ...(capability ? { capability: capability as BotCapability } : {}),
        outcome: result.status === 'cancelled' ? 'cancelled' : 'denied',
        reason: result.status,
      });
      return [{ chatRef: update.chatRef, correlationKey: correlation, text: result.publicMessage }];
    }

    const result = await this.service.confirm(context, command.confirmationKey, now);
    await this.audit.record({
      ...auditBase,
      ...(capability ? { capability: capability as BotCapability } : {}),
      outcome:
        result.status === 'completed' ||
        result.status === 'confirmed' ||
        result.status === 'already_completed'
          ? 'confirmed'
          : result.status === 'provider_off'
            ? 'denied'
            : 'failed',
      reason: result.status,
      metadata: result.resultRef ? { result_ref: result.resultRef } : {},
    });
    return [{ chatRef: update.chatRef, correlationKey: correlation, text: result.publicMessage }];
  }

  private async commandCapability(
    command: RabbiCommand,
  ): Promise<RabbiCommunicationCapability | null> {
    if (command.type === 'read' || command.type === 'preview') return command.request.capability;
    if (command.type === 'confirm' || command.type === 'cancel') {
      const previewCapability = await this.service.confirmationCapability(command.confirmationKey);
      if (previewCapability === 'conversation.parent.reply.preview') {
        return 'conversation.parent.reply.confirm';
      }
      if (previewCapability === 'student.question.reply.preview') {
        return 'student.question.reply.confirm';
      }
      return previewCapability;
    }
    return null;
  }
}

export class RabbiTelegramIdentityAdapter implements OneTimeBotApplicationAdapter {
  readonly adapterId = 'one-time-rabbi-communications';
  private readonly capabilities = [...rabbiCommunicationCapabilities] as BotCapability[];

  constructor(private readonly pool: DbPool) {}

  supportedCapabilities() {
    return [...this.capabilities];
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
    if (!row || !['owner', 'admin'].includes(String(row.role))) return null;
    return {
      userKey: String(row.user_key) as never,
      displayLabel: String(row.display_name),
      accountKey: input.mapping.accountKey,
      productKey: input.mapping.productKey,
      membershipKey: input.mapping.membershipKey,
      membershipStatus: 'active',
      userStatus: String(row.status) === 'active' ? 'active' : 'disabled',
      role: String(row.role) as 'owner' | 'admin',
      securityVersion: Number(row.security_version),
      capabilities: [...this.capabilities],
    } satisfies CanonicalOneTimeActor;
  }
}

function classifyRabbiCommand(update: NormalizedBotUpdate): RabbiCommand {
  const callback = update.callbackData?.trim();
  if (callback?.startsWith('rabbi:confirm:')) {
    return { type: 'confirm', confirmationKey: callback.slice('rabbi:confirm:'.length) };
  }
  if (callback?.startsWith('rabbi:cancel:')) {
    return { type: 'cancel', confirmationKey: callback.slice('rabbi:cancel:'.length) };
  }
  const text = update.text?.trim() ?? '';
  if (!text || text === '/help' || text === '/start') return { type: 'help' };
  const isOperation =
    /^\/(?:class-readiness|content-processing-status|incidents|incident|agent-tasks|agent-task-create|agent-task-update)\b/i.test(
      text,
    );
  if (
    (isOperation && sensitiveOperationPattern.test(text)) ||
    (!isOperation && forbiddenPattern.test(text))
  ) {
    return { type: 'unsupported', reason: 'forbidden' };
  }

  const [name = '', ...tail] = text.split(/\s+/);
  const rest = text.slice(name.length).trim();
  switch (name.toLowerCase()) {
    case '/parent-conversations':
      return { type: 'read', request: { capability: 'conversation.parent.list' } };
    case '/parent-conversation':
      return rest
        ? {
            type: 'read',
            request: {
              capability: 'conversation.parent.read_redacted',
              conversationKey: rest,
            },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/parent-reply': {
      const fields = pipeFields(rest);
      return fields[0] && fields[1]
        ? {
            type: 'preview',
            request: {
              capability: 'conversation.parent.reply.preview',
              conversationKey: fields[0],
              replyText: fields.slice(1).join(' | '),
            },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    }
    case '/student-questions':
      return { type: 'read', request: { capability: 'student.question.list' } };
    case '/student-question':
      return rest
        ? {
            type: 'read',
            request: { capability: 'student.question.read', questionKey: rest },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/student-answer': {
      const fields = pipeFields(rest);
      return fields[0] && fields[1]
        ? {
            type: 'preview',
            request: {
              capability: 'student.question.reply.preview',
              questionKey: fields[0],
              answerText: fields.slice(1).join(' | '),
            },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    }
    case '/student-close':
      return rest
        ? {
            type: 'preview',
            request: { capability: 'student.question.close', questionKey: rest },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/internal-tasks':
      return { type: 'read', request: { capability: 'internal_task.list' } };
    case '/internal-task-create': {
      const fields = pipeFields(rest);
      const priority = fields[2] ?? 'normal';
      if (!fields[0] || !['low', 'normal', 'high'].includes(priority) || fields.length > 3) {
        return { type: 'unsupported', reason: 'missing_argument' };
      }
      return {
        type: 'preview',
        request: {
          capability: 'internal_task.create',
          title: fields[0],
          detail: fields[1] ?? '',
          priority: priority as 'low' | 'normal' | 'high',
        },
      };
    }
    case '/internal-task-update': {
      const fields = pipeFields(rest);
      const statuses = ['queued', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
      if (!fields[0] || !statuses.includes(fields[1] as (typeof statuses)[number])) {
        return { type: 'unsupported', reason: 'missing_argument' };
      }
      return {
        type: 'preview',
        request: {
          capability: 'internal_task.update',
          taskKey: fields[0],
          status: fields[1] as (typeof statuses)[number],
          ...(fields[2] ? { title: fields[2] } : {}),
        },
      };
    }
    case '/class-readiness':
      return safeReference(rest)
        ? {
            type: 'read',
            request: { capability: 'operation.class.readiness', occurrenceKey: rest },
          }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/content-processing-status':
      return rest
        ? { type: 'unsupported', reason: 'missing_argument' }
        : { type: 'read', request: { capability: 'operation.content.processing.read' } };
    case '/incidents':
      return rest
        ? { type: 'unsupported', reason: 'missing_argument' }
        : { type: 'read', request: { capability: 'operation.incident.list' } };
    case '/incident':
      return safeReference(rest)
        ? { type: 'read', request: { capability: 'operation.incident.read', incidentKey: rest } }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/agent-tasks':
      return rest
        ? { type: 'unsupported', reason: 'missing_argument' }
        : { type: 'read', request: { capability: 'agent_task.list' } };
    case '/agent-task-create': {
      const fields = pipeFields(rest);
      const kind = fields[0];
      const priority = fields[1] ?? 'normal';
      if (
        !['login_access', 'support_incident', 'class_readiness', 'content_processing'].includes(
          kind ?? '',
        ) ||
        !['low', 'normal', 'high'].includes(priority) ||
        fields.length > 2
      ) {
        return { type: 'unsupported', reason: 'missing_argument' };
      }
      return {
        type: 'preview',
        request: {
          capability: 'internal_task.create',
          agentKind: kind as
            'login_access' | 'support_incident' | 'class_readiness' | 'content_processing',
          priority: priority as 'low' | 'normal' | 'high',
        },
      };
    }
    case '/agent-task-update': {
      const fields = pipeFields(rest);
      const statuses = ['queued', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
      if (
        !safeReference(fields[0] ?? '') ||
        !statuses.includes(fields[1] as (typeof statuses)[number])
      ) {
        return { type: 'unsupported', reason: 'missing_argument' };
      }
      return {
        type: 'preview',
        request: {
          capability: 'internal_task.update',
          taskKey: fields[0] ?? '',
          status: fields[1] as (typeof statuses)[number],
          agentTask: true,
        },
      };
    }
    case '/confirm':
      return rest
        ? { type: 'confirm', confirmationKey: rest }
        : { type: 'unsupported', reason: 'missing_argument' };
    case '/cancel':
      return rest
        ? { type: 'cancel', confirmationKey: rest }
        : { type: 'unsupported', reason: 'missing_argument' };
  }

  const parentNatural = /^reply to parent\s+(\S+)\s*:\s*(.+)$/i.exec(text);
  if (parentNatural) {
    return {
      type: 'preview',
      request: {
        capability: 'conversation.parent.reply.preview',
        conversationKey: parentNatural[1] ?? '',
        replyText: parentNatural[2] ?? '',
      },
    };
  }
  const studentNatural = /^answer student question\s+(\S+)\s*:\s*(.+)$/i.exec(text);
  if (studentNatural) {
    return {
      type: 'preview',
      request: {
        capability: 'student.question.reply.preview',
        questionKey: studentNatural[1] ?? '',
        answerText: studentNatural[2] ?? '',
      },
    };
  }
  const taskNatural = /^create internal task\s*:\s*(.+)$/i.exec(text);
  if (taskNatural) {
    return {
      type: 'preview',
      request: {
        capability: 'internal_task.create',
        title: taskNatural[1] ?? '',
        detail: '',
        priority: 'normal',
      },
    };
  }
  return { type: 'unsupported', reason: tail.length ? 'unknown' : 'unknown' };
}

function pipeFields(value: string) {
  return value
    .split('|')
    .map((field) => field.trim())
    .filter((field, index, all) => field.length > 0 || index < all.length - 1);
}

function safeReference(value: string) {
  return safeReferencePattern.test(value) && !/^\d+$/u.test(value);
}

function isOperationRead(
  request: RabbiReadRequest,
): request is Extract<RabbiReadRequest, { capability: `operation.${string}` }> {
  return request.capability.startsWith('operation.');
}

function toRabbiActor(actor: CanonicalOneTimeActor): RabbiCommunicationActor {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('RABBI_ACTOR_ROLE_INVALID');
  }
  return {
    userKey: actor.userKey,
    displayLabel: actor.displayLabel,
    accountKey: actor.accountKey,
    productKey: actor.productKey,
    role: actor.role,
    securityVersion: actor.securityVersion,
  };
}
