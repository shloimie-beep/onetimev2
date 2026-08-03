import { createHash, randomUUID } from 'node:crypto';
import type {
  ReplyCopilotGhlDelivery,
  ReplyCopilotGhlProvider,
  ReplyCopilotGhlReply,
  ReplyCopilotProviderMessage,
  ReplyCopilotStore,
  ReplyCopilotTelegramCard,
  ReplyCopilotTelegramDelivery,
  ReplyCopilotTelegramProvider,
} from '../../../../contracts/src/telegram/reply-copilot.ts';
import {
  asBotKey,
  type BotEnvironment,
  type SensitivePayloadCodec,
} from '../../../../contracts/src/telegram/types.ts';

export type ReplyCopilotDispatcherConfig = Readonly<{
  botKey?: string;
  environment: BotEnvironment;
  ownerId: string;
  leaseMs?: number;
  baseBackoffMs?: number;
  unknownBackoffMs?: number;
}>;

export class ReplyCopilotTelegramDispatcher {
  constructor(
    private readonly store: ReplyCopilotStore,
    private readonly codec: SensitivePayloadCodec,
    private readonly provider: ReplyCopilotTelegramProvider,
    private readonly config: ReplyCopilotDispatcherConfig,
  ) {}

  async runOnce(now = new Date()) {
    const delivery = await this.store.claimTelegram(
      now.toISOString(),
      this.config.ownerId,
      this.config.leaseMs ?? 30_000,
    );
    if (!delivery) return null;
    const card = await decryptTelegramCard(this.codec, delivery, this.config);
    if (delivery.lastErrorCode?.startsWith('UNKNOWN_')) {
      const reconciled = await this.provider.reconcile(card, delivery.idempotencyKey);
      if (reconciled.outcome === 'sent') {
        return this.markSent(delivery, card, reconciled.providerMessageRef, now, 'reconciled');
      }
      if (reconciled.outcome === 'unknown') {
        return this.markUnknown(delivery, 'UNKNOWN_TELEGRAM_RESULT', now);
      }
    }
    const result = await this.provider.send(card, delivery.idempotencyKey);
    if (result.outcome === 'sent') {
      return this.markSent(delivery, card, result.providerMessageRef, now, 'provider_response');
    }
    if (result.outcome === 'unknown') return this.markUnknown(delivery, result.errorCode, now);
    return this.markRetry(delivery, result.errorCode, now);
  }

  private async markSent(
    delivery: ReplyCopilotTelegramDelivery,
    card: ReplyCopilotTelegramCard,
    providerMessageRef: string,
    now: Date,
    evidence: string,
  ) {
    const providerMessageRefHash = sha256(providerMessageRef);
    const sent: ReplyCopilotTelegramDelivery = {
      ...delivery,
      state: 'sent',
      leaseOwner: null,
      leaseExpiresAt: null,
      providerMessageRefHash,
      lastErrorCode: null,
    };
    if (!(await this.store.updateTelegram(sent))) throw new Error('TELEGRAM_OUTBOX_LEASE_LOST');
    await this.store.bindTelegramMessage(delivery.intentKey, providerMessageRefHash);
    const intent = await this.store.getIntent(delivery.intentKey);
    if (intent && card.kind === 'inbound_card') {
      await this.store.updateIntent({
        ...intent,
        state: 'card_delivered',
        updatedAt: now.toISOString(),
      });
    }
    await audit(this.store, delivery.intentKey, 'telegram_sent', evidence, now, {
      attempts: delivery.attempts,
    });
    return sent;
  }

  private async markUnknown(delivery: ReplyCopilotTelegramDelivery, code: string, now: Date) {
    const terminal = delivery.attempts >= delivery.maxAttempts;
    const unknown: ReplyCopilotTelegramDelivery = {
      ...delivery,
      state: terminal ? 'dead_letter' : 'unknown',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(
        now.getTime() + (this.config.unknownBackoffMs ?? 30_000),
      ).toISOString(),
      lastErrorCode: code.startsWith('UNKNOWN_') ? code : `UNKNOWN_${safeCode(code)}`,
    };
    if (!(await this.store.updateTelegram(unknown))) throw new Error('TELEGRAM_OUTBOX_LEASE_LOST');
    await audit(
      this.store,
      delivery.intentKey,
      terminal ? 'telegram_dead_letter' : 'telegram_unknown',
      unknown.lastErrorCode ?? 'UNKNOWN',
      now,
    );
    return unknown;
  }

  private async markRetry(delivery: ReplyCopilotTelegramDelivery, code: string, now: Date) {
    const terminal = delivery.attempts >= delivery.maxAttempts;
    const retry: ReplyCopilotTelegramDelivery = {
      ...delivery,
      state: terminal ? 'dead_letter' : 'retry',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(
        now.getTime() + backoff(delivery.attempts, this.config.baseBackoffMs),
      ).toISOString(),
      lastErrorCode: safeCode(code),
    };
    if (!(await this.store.updateTelegram(retry))) throw new Error('TELEGRAM_OUTBOX_LEASE_LOST');
    await audit(
      this.store,
      delivery.intentKey,
      terminal ? 'telegram_dead_letter' : 'telegram_retry',
      retry.lastErrorCode ?? 'FAILED',
      now,
      {
        attempts: delivery.attempts,
      },
    );
    return retry;
  }
}

export class ReplyCopilotGhlDispatcher {
  constructor(
    private readonly store: ReplyCopilotStore,
    private readonly codec: SensitivePayloadCodec,
    private readonly provider: ReplyCopilotGhlProvider,
    private readonly config: ReplyCopilotDispatcherConfig,
  ) {}

  async runOnce(now = new Date()) {
    const delivery = await this.store.claimGhl(
      now.toISOString(),
      this.config.ownerId,
      this.config.leaseMs ?? 30_000,
    );
    if (!delivery) return null;
    const reply = await decryptGhlReply(this.codec, delivery, this.config);
    if (delivery.attempts > 1 || delivery.lastErrorCode !== null) {
      const reconciled = await this.provider.reconcile(reply);
      if (reconciled) return this.markReadback(delivery, reply, reconciled, now, 'reconciled');
    }
    const result = await this.provider.send(reply);
    if (result.outcome === 'sent') {
      const readback = await this.provider.readMessage(result.message.messageId);
      if (!readback) return this.markUnknown(delivery, 'UNKNOWN_GHL_READBACK_MISSING', now);
      return this.markReadback(delivery, reply, readback, now, 'provider_readback');
    }
    if (result.outcome === 'unknown') return this.markUnknown(delivery, result.errorCode, now);
    return this.markRetry(delivery, result.errorCode, now);
  }

  private async markReadback(
    delivery: ReplyCopilotGhlDelivery,
    reply: ReplyCopilotGhlReply,
    message: ReplyCopilotProviderMessage,
    now: Date,
    evidence: string,
  ) {
    try {
      assertSameThreadReadback(reply, message);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'GHL_READBACK_MISMATCH';
      const failed: ReplyCopilotGhlDelivery = {
        ...delivery,
        state: 'dead_letter',
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: safeCode(code),
      };
      if (!(await this.store.updateGhl(failed))) throw new Error('GHL_OUTBOX_LEASE_LOST');
      const intent = await this.store.getIntent(delivery.intentKey);
      if (intent) {
        await this.store.updateIntent({ ...intent, state: 'failed', updatedAt: now.toISOString() });
      }
      await audit(
        this.store,
        delivery.intentKey,
        'ghl_thread_mismatch',
        failed.lastErrorCode ?? 'GHL_READBACK_MISMATCH',
        now,
      );
      return failed;
    }
    const sent: ReplyCopilotGhlDelivery = {
      ...delivery,
      state: 'sent',
      leaseOwner: null,
      leaseExpiresAt: null,
      providerMessageRefHash: sha256(message.messageId),
      providerConversationRefHash: sha256(message.conversationId),
      providerThreadRefHash: sha256(message.threadId),
      lastErrorCode: null,
    };
    if (!(await this.store.updateGhl(sent))) throw new Error('GHL_OUTBOX_LEASE_LOST');
    const intent = await this.store.getIntent(delivery.intentKey);
    if (intent)
      await this.store.updateIntent({ ...intent, state: 'sent', updatedAt: now.toISOString() });
    await audit(this.store, delivery.intentKey, 'ghl_sent', evidence, now, {
      attempts: delivery.attempts,
      sameConversation: true,
      sameThread: true,
      bodyMatched: true,
    });
    return sent;
  }

  private async markUnknown(delivery: ReplyCopilotGhlDelivery, code: string, now: Date) {
    const terminal = delivery.attempts >= delivery.maxAttempts;
    const unknown: ReplyCopilotGhlDelivery = {
      ...delivery,
      state: terminal ? 'dead_letter' : 'unknown',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(
        now.getTime() + (this.config.unknownBackoffMs ?? 30_000),
      ).toISOString(),
      lastErrorCode: code.startsWith('UNKNOWN_') ? code : `UNKNOWN_${safeCode(code)}`,
    };
    if (!(await this.store.updateGhl(unknown))) throw new Error('GHL_OUTBOX_LEASE_LOST');
    await audit(
      this.store,
      delivery.intentKey,
      terminal ? 'ghl_dead_letter' : 'ghl_unknown',
      unknown.lastErrorCode ?? 'UNKNOWN',
      now,
    );
    return unknown;
  }

  private async markRetry(delivery: ReplyCopilotGhlDelivery, code: string, now: Date) {
    const terminal = delivery.attempts >= delivery.maxAttempts;
    const retry: ReplyCopilotGhlDelivery = {
      ...delivery,
      state: terminal ? 'dead_letter' : 'retry',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(
        now.getTime() + backoff(delivery.attempts, this.config.baseBackoffMs),
      ).toISOString(),
      lastErrorCode: safeCode(code),
    };
    if (!(await this.store.updateGhl(retry))) throw new Error('GHL_OUTBOX_LEASE_LOST');
    await audit(
      this.store,
      delivery.intentKey,
      terminal ? 'ghl_dead_letter' : 'ghl_retry',
      retry.lastErrorCode ?? 'FAILED',
      now,
      {
        attempts: delivery.attempts,
      },
    );
    return retry;
  }
}

export function assertSameThreadReadback(
  reply: ReplyCopilotGhlReply,
  readback: ReplyCopilotProviderMessage,
) {
  if (readback.direction !== 'outbound') throw new Error('GHL_READBACK_DIRECTION_MISMATCH');
  if (readback.conversationId !== reply.conversationId) {
    throw new Error('GHL_READBACK_CONVERSATION_MISMATCH');
  }
  if (readback.threadId !== reply.threadId) throw new Error('GHL_READBACK_THREAD_MISMATCH');
  if (sha256(readback.body.trim()) !== sha256(reply.message.trim())) {
    throw new Error('GHL_READBACK_BODY_MISMATCH');
  }
}

async function decryptTelegramCard(
  codec: SensitivePayloadCodec,
  delivery: ReplyCopilotTelegramDelivery,
  config: ReplyCopilotDispatcherConfig,
) {
  const value = await codec.decrypt(delivery.payloadRef, context(config, delivery.outboxKey));
  if (!isTelegramCard(value)) throw new Error('TELEGRAM_OUTBOX_PAYLOAD_INVALID');
  return value;
}

async function decryptGhlReply(
  codec: SensitivePayloadCodec,
  delivery: ReplyCopilotGhlDelivery,
  config: ReplyCopilotDispatcherConfig,
) {
  const value = await codec.decrypt(delivery.payloadRef, context(config, delivery.outboxKey));
  if (!isGhlReply(value)) throw new Error('GHL_OUTBOX_PAYLOAD_INVALID');
  return value;
}

function context(config: ReplyCopilotDispatcherConfig, actorKey: string) {
  return {
    botKey: asBotKey(config.botKey ?? 'one_time_rabbi_torah_console'),
    environment: config.environment,
    productKey: 'one_time',
    actorKey,
    classification: 'intent_payload' as const,
  };
}

function isTelegramCard(value: unknown): value is ReplyCopilotTelegramCard {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.intentKey === 'string' &&
    typeof record.chatRef === 'string' &&
    typeof record.text === 'string' &&
    Array.isArray(record.buttons)
  );
}

function isGhlReply(value: unknown): value is ReplyCopilotGhlReply {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === 'Email' &&
    typeof record.contactId === 'string' &&
    typeof record.conversationId === 'string' &&
    typeof record.message === 'string' &&
    typeof record.threadId === 'string'
  );
}

function backoff(attempts: number, configured?: number) {
  return Math.min(60_000, (configured ?? 1_000) * 2 ** Math.max(0, attempts - 1));
}

function safeCode(value: string) {
  return value.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
}

async function audit(
  store: ReplyCopilotStore,
  intentKey: string,
  outcome: string,
  reasonCode: string,
  now: Date,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  await store.appendAudit({
    eventKey: `ot3_audit_${randomUUID()}`,
    intentKey,
    outcome,
    reasonCode,
    actorUserRefHash: null,
    metadata,
    occurredAt: now.toISOString(),
  });
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
