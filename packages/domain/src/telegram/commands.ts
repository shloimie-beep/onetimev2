import type {
  BotAuditSink,
  BotCapability,
  BotCommand,
  BotCommandResult,
  BotReply,
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

const HELP_TEXT =
  'Available commands: status, classes, content, contacts <query>, tasks [query], task create <title>, task update <task> <version> <open|done|blocked>.';

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
        outcome: 'unsupported',
        reason: command.reason,
      });
      return [
        {
          chatRef: update.chatRef,
          correlationKey: baseAudit.correlationKey,
          text:
            command.reason === 'ambiguous' ? 'I need a more specific One Time command.' : HELP_TEXT,
        },
      ];
    }

    if (command.type === 'help') {
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
      const text = await this.handleRead(command.capability, auth.actor, command.query);
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

    const preview = await this.previewWrite(command, auth.actor);
    const actionDigest = stableDigest([
      command.capability,
      auth.actor.userKey,
      auth.actor.accountKey,
      auth.actor.productKey,
      command.title,
      command.taskKey,
      command.nextStatus,
      command.entityVersion ?? '',
    ]);
    const idempotencyKey = stableDigest([
      'ot51',
      update.botKey,
      update.environment,
      update.updateId,
      auth.actor.userKey,
      actionDigest,
    ]);
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    const confirmationKey = `ot51_confirm_${stableDigest([idempotencyKey]).slice(0, 32)}`;
    const payloadRef = await this.codec.encrypt(command, {
      botKey: update.botKey,
      environment: update.environment,
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      actorKey: auth.actor.userKey,
      classification: 'confirmation_payload',
    });
    const record: ConfirmationRecord = {
      confirmationKey,
      botKey: update.botKey,
      environment: update.environment,
      providerUserRef: update.providerUserRef,
      chatRef: update.chatRef,
      actorUserKey: asCanonicalUserKey(auth.actor.userKey),
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      capability: command.capability,
      actionDigest,
      securityVersion: auth.actor.securityVersion,
      idempotencyKey,
      payloadRef,
      expiresAt,
    };
    if (command.entityVersion !== undefined) record.entityVersion = command.entityVersion;
    await this.confirmations.create(record);
    await this.audit.record({
      ...baseAudit,
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      actorUserKey: auth.actor.userKey,
      capability: command.capability,
      outcome: 'previewed',
      metadata: { confirmation_key: confirmationKey, action_digest: actionDigest },
    });
    return [
      {
        chatRef: update.chatRef,
        correlationKey: baseAudit.correlationKey,
        text: `${preview}\n\nConfirm before ${expiresAt}.`,
        buttons: [
          { label: 'Confirm', callbackData: `confirm:${confirmationKey}` },
          { label: 'Cancel', callbackData: `cancel:${confirmationKey}` },
        ],
      },
    ];
  }

  private async handleRead(
    capability: Exclude<BotCapability, 'task_create' | 'task_update'>,
    actor: CanonicalOneTimeActor,
    query?: string,
  ) {
    switch (capability) {
      case 'product_status':
        return this.adapter.getProductStatus?.(actor) ?? 'Product status is not enabled here.';
      case 'upcoming_classes':
        return (
          this.adapter.listUpcomingClasses?.(actor) ?? 'Upcoming classes are not enabled here.'
        );
      case 'content_pipeline_status':
        return (
          this.adapter.getContentPipelineStatus?.(actor) ??
          'Content pipeline status is not enabled here.'
        );
      case 'contact_lookup':
        return (
          this.adapter.searchContacts?.(actor, query ?? '') ?? 'Contact lookup is not enabled here.'
        );
      case 'task_lookup':
        return this.adapter.lookupTasks?.(actor, query) ?? 'Task lookup is not enabled here.';
    }
  }

  private async previewWrite(
    command: Extract<BotCommand, { type: 'write_preview' }>,
    actor: CanonicalOneTimeActor,
  ) {
    if (command.capability === 'task_create') {
      if (!command.title || !this.adapter.previewTaskCreate)
        return 'Task creation is not enabled here.';
      return this.adapter.previewTaskCreate(actor, command.title);
    }
    if (
      !command.taskKey ||
      !command.nextStatus ||
      command.entityVersion === undefined ||
      !this.adapter.previewTaskUpdate
    ) {
      return 'Task update is not enabled here.';
    }
    return this.adapter.previewTaskUpdate(actor, {
      taskKey: command.taskKey,
      nextStatus: command.nextStatus,
      entityVersion: command.entityVersion,
    });
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
    if (
      record.botKey !== input.update.botKey ||
      record.environment !== input.update.environment ||
      !opaqueRefMatches(record.providerUserRef, input.update.providerUserRef) ||
      !opaqueRefMatches(record.chatRef, input.update.chatRef) ||
      record.actorUserKey !== auth.actor.userKey ||
      record.accountKey !== auth.actor.accountKey ||
      record.productKey !== auth.actor.productKey ||
      record.securityVersion !== auth.actor.securityVersion
    ) {
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text: 'Confirmation denied because the actor, chat, or account changed.',
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
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text: 'That confirmation was already handled.',
      };
    }
    if (consumed !== 'consumed') {
      return {
        chatRef: input.update.chatRef,
        correlationKey: input.correlation,
        text: 'That confirmation expired. No write was made.',
      };
    }

    const payload = (await this.codec.decrypt(record.payloadRef, {
      botKey: record.botKey,
      environment: record.environment,
      accountKey: record.accountKey,
      productKey: record.productKey,
      actorKey: record.actorUserKey,
      classification: 'confirmation_payload',
    })) as BotCommand;
    const result = await this.executeConfirmed(record, payload, auth.actor);
    await this.audit.record({
      botKey: input.update.botKey,
      environment: input.update.environment,
      accountKey: auth.actor.accountKey,
      productKey: auth.actor.productKey,
      actorUserKey: auth.actor.userKey,
      correlationKey: input.correlation,
      capability: record.capability,
      outcome: result.status === 'completed' ? 'completed' : 'failed',
      metadata: { idempotency_key: record.idempotencyKey },
    });
    return {
      chatRef: input.update.chatRef,
      correlationKey: input.correlation,
      text: result.publicMessage,
    };
  }

  private async executeConfirmed(
    record: ConfirmationRecord,
    payload: BotCommand,
    actor: CanonicalOneTimeActor,
  ): Promise<BotCommandResult> {
    if (payload.type !== 'write_preview') {
      return { status: 'denied', publicMessage: 'Unsupported confirmation payload.' };
    }
    if (payload.capability === 'task_create' && payload.title && this.adapter.createTask) {
      return this.adapter.createTask(actor, {
        title: payload.title,
        idempotencyKey: record.idempotencyKey,
      });
    }
    if (
      payload.capability === 'task_update' &&
      payload.taskKey &&
      payload.nextStatus &&
      payload.entityVersion !== undefined &&
      this.adapter.updateTask
    ) {
      if (record.entityVersion !== undefined && record.entityVersion !== payload.entityVersion) {
        return { status: 'denied', publicMessage: 'Task version changed before confirmation.' };
      }
      return this.adapter.updateTask(actor, {
        taskKey: payload.taskKey,
        nextStatus: payload.nextStatus,
        entityVersion: payload.entityVersion,
        idempotencyKey: record.idempotencyKey,
      });
    }
    return { status: 'unsupported', publicMessage: 'That write is not enabled here.' };
  }
}

export function classifyCommand(update: NormalizedBotUpdate): BotCommand {
  const callback = update.callbackData?.trim();
  if (callback?.startsWith('confirm:'))
    return { type: 'confirm', confirmationKey: callback.slice(8) };
  if (callback?.startsWith('cancel:'))
    return { type: 'cancel', confirmationKey: callback.slice(7) };
  const text = update.text?.trim().replace(/\s+/g, ' ') ?? '';
  const lower = text.toLowerCase();
  if (!text || lower === '/help' || lower === 'help') return { type: 'help' };
  if (['/status', 'status', 'readiness'].includes(lower)) {
    return { type: 'read', capability: 'product_status' };
  }
  if (['/classes', 'classes', 'upcoming classes'].includes(lower)) {
    return { type: 'read', capability: 'upcoming_classes' };
  }
  if (['/content', 'content', 'pipeline'].includes(lower)) {
    return { type: 'read', capability: 'content_pipeline_status' };
  }
  if (lower.startsWith('/contacts ') || lower.startsWith('contacts ')) {
    const query = text.replace(/^\/?contacts\s+/i, '').trim();
    if (query.length < 2) return { type: 'unsupported', reason: 'missing_argument' };
    return { type: 'read', capability: 'contact_lookup', query: query.slice(0, 80) };
  }
  if (lower === '/tasks' || lower === 'tasks') return { type: 'read', capability: 'task_lookup' };
  if (lower.startsWith('/tasks ') || lower.startsWith('tasks ')) {
    const query = text.replace(/^\/?tasks\s+/i, '').trim();
    return { type: 'read', capability: 'task_lookup', query: query.slice(0, 80) };
  }
  if (lower.startsWith('/task create ') || lower.startsWith('task create ')) {
    const title = text.replace(/^\/?task\s+create\s+/i, '').trim();
    if (title.length < 3) return { type: 'unsupported', reason: 'missing_argument' };
    return { type: 'write_preview', capability: 'task_create', title: title.slice(0, 160) };
  }
  if (lower.startsWith('/task update ') || lower.startsWith('task update ')) {
    const [, taskKey, version, status] =
      text.match(/^\/?task\s+update\s+([A-Za-z0-9:_-]{2,80})\s+(\d+)\s+(open|done|blocked)$/i) ??
      [];
    if (!taskKey || !version || !status) return { type: 'unsupported', reason: 'missing_argument' };
    return {
      type: 'write_preview',
      capability: 'task_update',
      taskKey,
      entityVersion: Number(version),
      nextStatus: status.toLowerCase() as 'open' | 'done' | 'blocked',
    };
  }
  if (lower.includes(' or ')) return { type: 'unsupported', reason: 'ambiguous' };
  return { type: 'unsupported', reason: 'unknown' };
}

function commandCapability(command: BotCommand): BotCapability | undefined {
  if (command.type === 'read' || command.type === 'write_preview') return command.capability;
  return undefined;
}

function opaqueRefMatches(stored: string, actual: string) {
  return stored === actual || stored === `hashed:${sha256(actual)}`;
}
