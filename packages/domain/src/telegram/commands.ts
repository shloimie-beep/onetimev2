import { randomUUID } from 'node:crypto';
import type {
  BotActionArgs,
  BotActionRequest,
  BotAuditSink,
  BotCapability,
  BotCommand,
  BotCommandResult,
  BotCommandSource,
  BotConfirmationMode,
  BotReadCapability,
  BotReply,
  BotRiskClass,
  BotWriteCapability,
  CanonicalOneTimeActor,
  ConfirmationRecord,
  ConfirmationRepository,
  NormalizedBotUpdate,
  OneTimeBotApplicationAdapter,
  SensitivePayloadCodec,
} from '../../../contracts/src/telegram/types.ts';
import { asCanonicalUserKey } from '../../../contracts/src/telegram/types.ts';
import { correlationKey, sha256, stableDigest } from './crypto.ts';
import { TelegramIdentityResolver } from './identity.ts';

const HELP_TEXT = [
  'One Time Telegram commands:',
  '/whoami, /scope, /leads, /lead <ref>, /contact <ref>, /classes, /class <ref>, /content, /content-item <ref>, /tasks, /task <ref>, /support, /ticket <ref>.',
  'Write commands include /lead-create, /tag-add, /tag-remove, /class-status, /content-retry, /task-create, /task-update, /ticket-assign, /ticket-status, and /question-select when enabled.',
].join('\n');

const forbiddenRequestPattern =
  /delete|drop table|select\s+\*|sql|shell|print env|token|secret|export|mass send|charge|refund|impersonate|view as|act as|switch role|another account|other product|bna bot/i;

export class TelegramCommandEngine {
  constructor(
    private readonly resolver: TelegramIdentityResolver,
    private readonly adapter: OneTimeBotApplicationAdapter,
    private readonly confirmations: ConfirmationRepository,
    private readonly codec: SensitivePayloadCodec,
    private readonly audit: BotAuditSink,
  ) {}

  async handle(update: NormalizedBotUpdate, now = new Date()): Promise<BotReply[]> {
    const command = classifyCommand(update);
    const capability = commandCapability(command);
    const auth = await this.resolver.authorize(update, capability, now);
    const baseAudit = {
      botKey: update.botKey,
      environment: update.environment,
      correlationKey: correlationKey('bot'),
    };

    if (!auth.allowed) {
      await this.audit.record({
        ...baseAudit,
        outcome: 'denied',
        reason: auth.reason,
        ...(capability ? { capability } : {}),
      });
      return update.chatRef
        ? [
            {
              chatRef: update.chatRef,
              correlationKey: baseAudit.correlationKey,
              text:
                command.type === 'confirm' || command.type === 'cancel'
                  ? 'Confirmation denied.'
                  : 'This One Time bot only works for authorized owner/admin private chats.',
            },
          ]
        : [];
    }

    if (!update.chatRef || !update.providerUserRef) return [];

    if (command.type === 'unsupported') {
      await this.audit.record({
        ...baseAudit,
        accountKey: auth.actor.accountKey,
        productKey: auth.actor.productKey,
        actorUserKey: auth.actor.userKey,
        outcome: command.reason === 'forbidden' ? 'denied' : 'unsupported',
        reason: command.reason,
      });
      return [
        {
          chatRef: update.chatRef,
          correlationKey: baseAudit.correlationKey,
          text:
            command.reason === 'forbidden'
              ? 'That request is not available through the One Time Telegram gateway.'
              : command.reason === 'ambiguous'
                ? 'I need a more specific One Time command.'
                : HELP_TEXT,
        },
      ];
    }

    if (command.type === 'help') {
      await this.audit.record({
        ...baseAudit,
        accountKey: auth.actor.accountKey,
        productKey: auth.actor.productKey,
        actorUserKey: auth.actor.userKey,
        capability: 'gateway.help',
        outcome: 'completed',
      });
      return [
        { chatRef: update.chatRef, correlationKey: baseAudit.correlationKey, text: HELP_TEXT },
      ];
    }

    if (command.type === 'confirm' || command.type === 'cancel') {
      return [
        await this.handleConfirmation({
          command,
          update,
          now,
          correlation: baseAudit.correlationKey,
        }),
      ];
    }

    if (command.type === 'read') {
      const text = await this.handleRead(command.capability, auth.actor, actionRequest(command));
      await this.audit.record({
        ...baseAudit,
        accountKey: auth.actor.accountKey,
        productKey: auth.actor.productKey,
        actorUserKey: auth.actor.userKey,
        capability: command.capability,
        outcome: 'completed',
      });
      return [{ chatRef: update.chatRef, correlationKey: baseAudit.correlationKey, text }];
    }

    const request = actionRequest(command);
    if (requiresConfirmation(command)) {
      return [
        await this.createPreview({
          command,
          request,
          update,
          actor: auth.actor,
          mappingKey: auth.mapping.mappingKey,
          mappingVersion: auth.mapping.mappingVersion,
          now,
          correlation: baseAudit.correlationKey,
        }),
      ];
    }

    const result = await this.executeAction(request, auth.actor, directIdempotencyKey(update));
    await this.audit.record({
      ...baseAudit,
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      actorUserKey: auth.actor.userKey,
      capability: command.capability,
      outcome:
        result.status === 'completed' || result.status === 'already_completed'
          ? 'completed'
          : 'failed',
      metadata: { idempotency_key: result.idempotencyKey },
    });
    return [
      {
        chatRef: update.chatRef,
        correlationKey: baseAudit.correlationKey,
        text: result.publicMessage,
      },
    ];
  }

  private async handleRead(
    capability: BotReadCapability,
    actor: CanonicalOneTimeActor,
    request: BotActionRequest,
  ) {
    if (capability === 'gateway.help') return HELP_TEXT;
    if (capability === 'gateway.identity.read_self') {
      return `Signed in as ${actor.displayLabel} (${gatewayRole(actor.role)}). Acting only as yourself.`;
    }
    if (capability === 'gateway.scope.read') {
      return `Scope: account ${actor.accountKey}; product ${actor.productKey}. Telegram cannot override this scope.`;
    }
    return (
      this.adapter.readAction?.(actor, request) ??
      'That One Time read action is not enabled in this environment.'
    );
  }

  private async createPreview(input: {
    command: Extract<BotCommand, { type: 'write' }>;
    request: BotActionRequest;
    update: NormalizedBotUpdate;
    actor: CanonicalOneTimeActor;
    mappingKey: string;
    mappingVersion: number;
    now: Date;
    correlation: string;
  }): Promise<BotReply> {
    const preview =
      (await this.adapter.previewAction?.(input.actor, input.request)) ??
      'That One Time write action is not enabled in this environment.';
    const actionDigest = stableDigest([
      input.command.capability,
      input.actor.userKey,
      input.actor.accountKey,
      input.actor.productKey,
      canonicalJson(input.command.args),
      input.mappingKey,
      String(input.mappingVersion),
    ]);
    const actionRequestId = `tg_action_${randomUUID()}`;
    const idempotencyKey = stableDigest([
      actionRequestId,
      input.update.botKey,
      input.update.environment,
      input.actor.userKey,
      input.command.capability,
    ]);
    const expiresAt = new Date(input.now.getTime() + 5 * 60 * 1000).toISOString();
    const confirmationKey = `ot84_${randomUUID()}`;
    const payloadRef = await this.codec.encrypt(input.request, {
      botKey: input.update.botKey,
      environment: input.update.environment,
      accountKey: input.actor.accountKey,
      productKey: input.actor.productKey,
      actorKey: input.actor.userKey,
      classification: 'confirmation_payload',
    });
    const record: ConfirmationRecord = {
      confirmationKey,
      botKey: input.update.botKey,
      environment: input.update.environment,
      providerUserRef: input.update.providerUserRef as never,
      chatRef: input.update.chatRef as never,
      actorUserKey: asCanonicalUserKey(input.actor.userKey),
      accountKey: input.actor.accountKey,
      productKey: input.actor.productKey,
      capability: input.command.capability,
      source: input.command.source,
      riskClass: input.command.riskClass,
      actionDigest,
      mappingKey: input.mappingKey,
      mappingVersion: input.mappingVersion,
      roleAtPreview: input.actor.role,
      securityVersion: input.actor.securityVersion,
      idempotencyKey,
      previewDigest: stableDigest([preview]),
      payloadRef,
      expiresAt,
    };
    const targetVersion = numericArg(input.command.args.version);
    if (targetVersion !== undefined) record.targetVersion = targetVersion;
    await this.confirmations.create(record);
    await this.audit.record({
      botKey: input.update.botKey,
      environment: input.update.environment,
      accountKey: input.actor.accountKey,
      productKey: input.actor.productKey,
      actorUserKey: input.actor.userKey,
      correlationKey: input.correlation,
      capability: input.command.capability,
      outcome: 'previewed',
      metadata: {
        confirmation_key: confirmationKey,
        action_digest: actionDigest,
        risk_class: input.command.riskClass,
      },
    });
    return {
      chatRef: input.update.chatRef as never,
      correlationKey: input.correlation,
      text: `${preview}\n\nAction: ${input.command.capability}\nScope: ${input.actor.accountKey}/${input.actor.productKey}\nConfirm before ${expiresAt}.`,
      buttons: [
        { label: 'Confirm', callbackData: `confirm:v1:${confirmationKey}` },
        { label: 'Cancel', callbackData: `cancel:v1:${confirmationKey}` },
      ],
    };
  }

  private async handleConfirmation(input: {
    command: Extract<BotCommand, { type: 'confirm' | 'cancel' }>;
    update: NormalizedBotUpdate;
    now: Date;
    correlation: string;
  }): Promise<BotReply> {
    const record = await this.confirmations.get(input.command.confirmationKey);
    if (!record || !input.update.chatRef || !input.update.providerUserRef) {
      return {
        chatRef: input.update.chatRef ?? record?.chatRef ?? ('' as never),
        correlationKey: input.correlation,
        text: 'That confirmation is no longer available.',
      };
    }
    const auth = await this.resolver.authorize(input.update, record.capability, input.now);
    if (!auth.allowed) {
      await this.audit.record({
        botKey: input.update.botKey,
        environment: input.update.environment,
        correlationKey: input.correlation,
        capability: record.capability,
        outcome: 'denied',
        reason: auth.reason,
      });
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text: 'Confirmation denied.',
      };
    }
    const mismatch = confirmationMismatch(record, input.update, auth.actor, auth.mapping);
    if (mismatch) {
      await this.audit.record({
        botKey: input.update.botKey,
        environment: input.update.environment,
        accountKey: auth.actor.accountKey,
        productKey: auth.actor.productKey,
        actorUserKey: auth.actor.userKey,
        correlationKey: input.correlation,
        capability: record.capability,
        outcome: 'denied',
        reason: mismatch,
      });
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text: confirmationDenialText(mismatch),
      };
    }
    if (input.command.type === 'cancel') {
      const cancelled = await this.confirmations.cancel(record.confirmationKey, input.now);
      await this.audit.record({
        botKey: input.update.botKey,
        environment: input.update.environment,
        accountKey: auth.actor.accountKey,
        productKey: auth.actor.productKey,
        actorUserKey: auth.actor.userKey,
        correlationKey: input.correlation,
        capability: record.capability,
        outcome: cancelled === 'cancelled' ? 'cancelled' : 'expired',
      });
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text:
          cancelled === 'cancelled'
            ? 'Cancelled. No write was made.'
            : 'That confirmation expired.',
      };
    }

    const consumed = await this.confirmations.consume(record.confirmationKey, input.now);
    if (consumed === 'already_consumed') {
      const current = await this.confirmations.get(record.confirmationKey);
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text:
          current?.result?.publicMessage ??
          'That confirmation was already handled. No duplicate write was made.',
      };
    }
    if (consumed !== 'consumed') {
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text:
          consumed === 'expired'
            ? 'That confirmation expired. No write was made.'
            : 'That confirmation is no longer available.',
      };
    }

    const payload = (await this.codec.decrypt(record.payloadRef, {
      botKey: record.botKey,
      environment: record.environment,
      accountKey: record.accountKey,
      productKey: record.productKey,
      actorKey: record.actorUserKey,
      classification: 'confirmation_payload',
    })) as BotActionRequest;
    const result = await this.executeAction(payload, auth.actor, record.idempotencyKey);
    await this.confirmations.recordResult(record.confirmationKey, result, input.now);
    await this.audit.record({
      botKey: input.update.botKey,
      environment: input.update.environment,
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      actorUserKey: auth.actor.userKey,
      correlationKey: input.correlation,
      capability: record.capability,
      outcome:
        result.status === 'completed' || result.status === 'already_completed'
          ? 'completed'
          : 'failed',
      metadata: {
        idempotency_key: record.idempotencyKey,
        event_ids: result.eventIds ?? [],
      },
    });
    return {
      chatRef: input.update.chatRef,
      correlationKey: input.correlation,
      text: result.publicMessage,
    };
  }

  private async executeAction(
    request: BotActionRequest,
    actor: CanonicalOneTimeActor,
    idempotencyKey: string,
  ): Promise<BotCommandResult> {
    if (!isWriteCapability(request.capability)) {
      return { status: 'denied', publicMessage: 'Unsupported confirmation payload.' };
    }
    return (
      this.adapter.executeAction?.(actor, { request, idempotencyKey }) ?? {
        status: 'feature_unavailable',
        publicMessage: 'That One Time write action is not enabled in this environment.',
        idempotencyKey,
      }
    );
  }
}

export function classifyCommand(update: NormalizedBotUpdate): BotCommand {
  const callback = update.callbackData?.trim();
  if (callback?.startsWith('confirm:v1:'))
    return { type: 'confirm', confirmationKey: callback.slice('confirm:v1:'.length) };
  if (callback?.startsWith('cancel:v1:'))
    return { type: 'cancel', confirmationKey: callback.slice('cancel:v1:'.length) };
  if (callback?.startsWith('confirm:'))
    return { type: 'confirm', confirmationKey: callback.slice('confirm:'.length) };
  if (callback?.startsWith('cancel:'))
    return { type: 'cancel', confirmationKey: callback.slice('cancel:'.length) };

  const text = update.text?.trim().replace(/\s+/g, ' ') ?? '';
  const lower = text.toLowerCase();
  if (!text || lower === '/help' || lower === 'help') return { type: 'help' };
  if (lower === 'yes' || lower === 'confirm' || lower === 'ok') {
    return { type: 'unsupported', reason: 'ambiguous' };
  }
  if (forbiddenRequestPattern.test(text)) return { type: 'unsupported', reason: 'forbidden' };

  const deterministic = classifyDeterministic(text);
  if (deterministic) return deterministic;

  const nl = classifyNaturalLanguage(text);
  if (nl) return nl;
  if (lower.includes(' or ')) return { type: 'unsupported', reason: 'ambiguous' };
  return { type: 'unsupported', reason: 'unknown' };
}

function classifyDeterministic(text: string): BotCommand | null {
  const lower = text.toLowerCase();
  if (['/whoami', 'whoami'].includes(lower)) {
    return read('gateway.identity.read_self');
  }
  if (['/scope', 'scope'].includes(lower)) return read('gateway.scope.read');
  if (lower === '/leads' || lower === 'leads') return read('crm.lead.list');
  if (lower.startsWith('/leads ') || lower.startsWith('leads ')) {
    return read('crm.lead.list', { filter: stripCommand(text, 'leads').slice(0, 80) });
  }
  if (lower.startsWith('/lead ')) return readWithRef(text, 'lead', 'crm.lead.read');
  if (lower.startsWith('/contact '))
    return readWithRef(text, 'contact', 'crm.contact.read_redacted');
  if (lower.startsWith('/tags ')) return readWithRef(text, 'tags', 'crm.lead_tag.list');
  if (lower.startsWith('/tag-add ')) {
    const args = splitArgs(stripCommand(text, 'tag-add'), 2);
    if (!args) return missing();
    return write('crm.lead_tag.add', { lead_ref: args[0], tag: args[1] }, 'deterministic');
  }
  if (lower.startsWith('/tag-remove ')) {
    const args = splitArgs(stripCommand(text, 'tag-remove'), 2);
    if (!args) return missing();
    return write('crm.lead_tag.remove', { lead_ref: args[0], tag: args[1] }, 'deterministic');
  }
  if (lower.startsWith('/lead-create ')) {
    return write(
      'crm.lead.create',
      { summary: stripCommand(text, 'lead-create').slice(0, 240) },
      'deterministic',
    );
  }
  if (lower === '/classes' || lower === 'classes') return read('class.schedule.read');
  if (lower.startsWith('/classes ')) {
    return read('class.schedule.read', { date: stripCommand(text, 'classes').slice(0, 40) });
  }
  if (lower.startsWith('/class-status ')) {
    const args = splitArgs(stripCommand(text, 'class-status'), 2);
    if (!args) return missing();
    return write('class.status.update', { class_ref: args[0], status: args[1] }, 'deterministic');
  }
  if (lower.startsWith('/class ')) return readWithRef(text, 'class', 'class.status.read');
  if (lower === '/content' || lower === 'content') return read('content.pipeline.read');
  if (lower.startsWith('/content ')) {
    return read('content.pipeline.read', { filter: stripCommand(text, 'content').slice(0, 80) });
  }
  if (lower.startsWith('/content-item ')) {
    return readWithRef(text, 'content-item', 'content.item.read');
  }
  if (lower.startsWith('/content-retry ')) {
    return write(
      'content.item.retry',
      { content_ref: stripCommand(text, 'content-retry') },
      'deterministic',
    );
  }
  if (lower === '/tasks' || lower === 'tasks') return read('task.list');
  if (lower.startsWith('/tasks ') || lower.startsWith('tasks ')) {
    return read('task.list', { filter: stripCommand(text, 'tasks').slice(0, 80) });
  }
  if (lower.startsWith('/task-create ') || lower.startsWith('task create ')) {
    const title = stripCommand(text.replace(/^task create/i, '/task-create'), 'task-create');
    if (title.length < 3) return missing();
    return write('task.create', { title: title.slice(0, 160) }, 'deterministic');
  }
  if (lower.startsWith('/task-update ') || lower.startsWith('task update ')) {
    const normalized = text.replace(/^task update/i, '/task-update');
    const [, taskRef, version, status] =
      normalized.match(/^\/task-update\s+([A-Za-z0-9:_-]{2,80})\s+(\d+)\s+([A-Za-z_-]{2,40})$/i) ??
      [];
    if (!taskRef || !version || !status) return missing();
    return write(
      'task.update',
      { task_ref: taskRef, version: Number(version), status: status.toLowerCase() },
      'deterministic',
    );
  }
  if (lower.startsWith('/task ')) return readWithRef(text, 'task', 'task.read');
  if (lower === '/support' || lower === 'support') return read('support.ticket.list');
  if (lower.startsWith('/support ')) {
    return read('support.ticket.list', { filter: stripCommand(text, 'support').slice(0, 80) });
  }
  if (lower.startsWith('/ticket-assign ')) {
    const args = splitArgs(stripCommand(text, 'ticket-assign'), 2);
    if (!args || !args[1] || args[1].toLowerCase() !== 'me') return missing();
    return write(
      'support.ticket.assign_self',
      { ticket_ref: args[0], assignee: 'self' },
      'deterministic',
    );
  }
  if (lower.startsWith('/ticket-status ')) {
    const args = splitArgs(stripCommand(text, 'ticket-status'), 2);
    if (!args) return missing();
    return write(
      'support.ticket.status.update',
      { ticket_ref: args[0], status: args[1] },
      'deterministic',
    );
  }
  if (lower.startsWith('/ticket '))
    return readWithRef(text, 'ticket', 'support.ticket.read_redacted');
  if (lower === '/questions' || lower === 'questions') return read('class.question.list');
  if (lower.startsWith('/questions ')) {
    return read('class.question.list', { filter: stripCommand(text, 'questions').slice(0, 80) });
  }
  if (lower.startsWith('/question-select ')) {
    return write(
      'class.question.select',
      { question_ref: stripCommand(text, 'question-select') },
      'deterministic',
    );
  }
  if (lower.startsWith('/question ')) {
    return readWithRef(text, 'question', 'class.question.read_redacted');
  }
  if (lower === '/gateway-audit' || lower === 'gateway-audit') {
    return read('telegram.audit.read_recent', { count: 10 });
  }
  if (lower.startsWith('/gateway-audit ')) {
    const count = Number(stripCommand(text, 'gateway-audit'));
    return read('telegram.audit.read_recent', {
      count: Number.isFinite(count) ? Math.min(25, Math.max(1, count)) : 10,
    });
  }
  return null;
}

function classifyNaturalLanguage(text: string): BotCommand | null {
  const createTask = text.match(/^create task (.+)$/i);
  if (createTask?.[1]) {
    return write('task.create', { title: createTask[1].slice(0, 160) }, 'natural_language');
  }
  const updateTask = text.match(/^mark task ([A-Za-z0-9:_-]{2,80}) as ([A-Za-z_-]{2,40})$/i);
  if (updateTask?.[1] && updateTask[2]) {
    return write(
      'task.update',
      { task_ref: updateTask[1], status: updateTask[2].toLowerCase() },
      'natural_language',
    );
  }
  const assignTicket = text.match(/^assign ticket ([A-Za-z0-9:_-]{2,80}) to me$/i);
  if (assignTicket?.[1]) {
    return write(
      'support.ticket.assign_self',
      { ticket_ref: assignTicket[1], assignee: 'self' },
      'natural_language',
    );
  }
  return null;
}

function read(capability: BotReadCapability, args: BotActionArgs = {}): BotCommand {
  return { type: 'read', capability, source: 'deterministic', args };
}

function write(
  capability: BotWriteCapability,
  args: BotActionArgs,
  source: BotCommandSource,
): BotCommand {
  return {
    type: 'write',
    capability,
    source,
    args,
    confirmationMode: confirmationMode(capability),
    riskClass: riskClass(capability),
  };
}

function readWithRef(text: string, command: string, capability: BotReadCapability): BotCommand {
  const ref = stripCommand(text, command);
  if (!ref) return missing();
  return read(capability, { ref: ref.slice(0, 100) });
}

function stripCommand(text: string, command: string) {
  return text.replace(new RegExp(`^/?${command}\\s*`, 'i'), '').trim();
}

function splitArgs(value: string, count: number) {
  const args = value.split(/\s+/).filter(Boolean);
  if (args.length < count) return null;
  if (count === 2) return [args[0], args.slice(1).join(' ')];
  return args.slice(0, count);
}

function missing(): BotCommand {
  return { type: 'unsupported', reason: 'missing_argument' };
}

function commandCapability(command: BotCommand): BotCapability | undefined {
  if (command.type === 'help') return 'gateway.help';
  if (command.type === 'read' || command.type === 'write') return command.capability;
  return undefined;
}

function actionRequest(command: Extract<BotCommand, { type: 'read' | 'write' }>): BotActionRequest {
  return {
    capability: command.capability,
    source: command.source,
    args: command.args,
    confirmationMode: command.type === 'write' ? command.confirmationMode : 'none',
    riskClass: command.type === 'write' ? command.riskClass : 'R0',
  };
}

function confirmationMode(capability: BotWriteCapability): BotConfirmationMode {
  switch (capability) {
    case 'crm.lead.create':
    case 'crm.lead_tag.remove':
    case 'class.status.update':
    case 'content.item.retry':
    case 'support.ticket.status.update':
    case 'class.question.select':
      return 'always';
    default:
      return 'nl_preview';
  }
}

function riskClass(capability: BotWriteCapability): BotRiskClass {
  return confirmationMode(capability) === 'always' ? 'R2' : 'R1';
}

function requiresConfirmation(command: Extract<BotCommand, { type: 'write' }>) {
  return command.confirmationMode === 'always' || command.source === 'natural_language';
}

function isWriteCapability(capability: BotCapability): capability is BotWriteCapability {
  return [
    'crm.lead.create',
    'crm.lead_tag.add',
    'crm.lead_tag.remove',
    'class.status.update',
    'content.item.retry',
    'task.create',
    'task.update',
    'support.ticket.assign_self',
    'support.ticket.status.update',
    'class.question.select',
  ].includes(capability);
}

function directIdempotencyKey(update: NormalizedBotUpdate) {
  return stableDigest(['direct', update.botKey, update.environment, update.updateId]);
}

function confirmationMismatch(
  record: ConfirmationRecord,
  update: NormalizedBotUpdate,
  actor: CanonicalOneTimeActor,
  mapping: { mappingKey: string; mappingVersion: number },
) {
  if (record.botKey !== update.botKey || record.environment !== update.environment) {
    return 'CONFIRMATION_SCOPE_MISMATCH';
  }
  if (!opaqueRefMatches(record.providerUserRef, update.providerUserRef ?? ('' as never))) {
    return 'CONFIRMATION_PRINCIPAL_MISMATCH';
  }
  if (!opaqueRefMatches(record.chatRef, update.chatRef ?? ('' as never))) {
    return 'CONFIRMATION_PRINCIPAL_MISMATCH';
  }
  if (record.actorUserKey !== actor.userKey) return 'CONFIRMATION_PRINCIPAL_MISMATCH';
  if (record.accountKey !== actor.accountKey || record.productKey !== actor.productKey) {
    return 'CONFIRMATION_SCOPE_MISMATCH';
  }
  if (
    record.mappingKey !== mapping.mappingKey ||
    record.mappingVersion !== mapping.mappingVersion
  ) {
    return 'CONFIRMATION_MAPPING_CHANGED';
  }
  if (record.roleAtPreview !== actor.role || record.securityVersion !== actor.securityVersion) {
    return 'CONFIRMATION_STATE_CHANGED';
  }
  return null;
}

function confirmationDenialText(reason: string) {
  if (reason === 'CONFIRMATION_MAPPING_CHANGED') {
    return 'Confirmation denied because the Telegram mapping changed.';
  }
  if (reason === 'CONFIRMATION_STATE_CHANGED') {
    return 'Confirmation denied because your role, session, or target state changed.';
  }
  return 'Confirmation denied because the actor, chat, or scope changed.';
}

function opaqueRefMatches(stored: string, actual: string) {
  return stored === actual || stored === `hashed:${sha256(actual)}`;
}

function gatewayRole(role: CanonicalOneTimeActor['role']) {
  return role === 'owner' ? 'one_time_owner' : 'one_time_admin';
}

function canonicalJson(value: BotActionArgs) {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {}),
  );
}

function numericArg(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}
