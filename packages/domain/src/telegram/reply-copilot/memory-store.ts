import type {
  ReplyCopilotActionBinding,
  ReplyCopilotAuditEvent,
  ReplyCopilotGhlDelivery,
  ReplyCopilotIntent,
  ReplyCopilotStore,
  ReplyCopilotTelegramDelivery,
  ReplyCopilotVoiceExample,
} from '../../../../contracts/src/telegram/reply-copilot.ts';

export class MemoryReplyCopilotStore implements ReplyCopilotStore {
  private readonly intents = new Map<string, ReplyCopilotIntent>();
  private readonly sourceIdentities = new Map<string, string>();
  private readonly actions = new Map<string, ReplyCopilotActionBinding>();
  private readonly telegram = new Map<string, ReplyCopilotTelegramDelivery>();
  private readonly telegramMessages = new Map<string, string>();
  private readonly ghl = new Map<string, ReplyCopilotGhlDelivery>();
  private readonly examples = new Map<string, ReplyCopilotVoiceExample>();
  private readonly audit: ReplyCopilotAuditEvent[] = [];

  async ingest(input: { intent: ReplyCopilotIntent; sourceIdentity: string }) {
    const existingKey = this.sourceIdentities.get(input.sourceIdentity);
    if (existingKey) {
      const existing = this.intents.get(existingKey);
      if (!existing) throw new Error('REPLY_COPILOT_SOURCE_INDEX_CORRUPT');
      return { duplicate: true, intent: clone(existing) };
    }
    this.sourceIdentities.set(input.sourceIdentity, input.intent.intentKey);
    this.intents.set(input.intent.intentKey, clone(input.intent));
    return { duplicate: false, intent: clone(input.intent) };
  }

  async getIntent(intentKey: string) {
    const value = this.intents.get(intentKey);
    return value ? clone(value) : null;
  }

  async updateIntent(intent: ReplyCopilotIntent) {
    const existing = this.intents.get(intent.intentKey);
    if (!existing || intent.version < existing.version) return false;
    this.intents.set(intent.intentKey, clone(intent));
    return true;
  }

  async saveAction(binding: ReplyCopilotActionBinding) {
    const existing = this.actions.get(binding.tokenDigest);
    if (existing && JSON.stringify(existing) !== JSON.stringify(binding)) {
      throw new Error('REPLY_COPILOT_ACTION_COLLISION');
    }
    this.actions.set(binding.tokenDigest, clone(binding));
  }

  async consumeAction(input: {
    tokenDigest: string;
    expectedChatRefHash: string;
    expectedUserRefHash: string;
    consumedAt: string;
  }) {
    const existing = this.actions.get(input.tokenDigest);
    if (
      !existing ||
      existing.consumedAt ||
      existing.expectedChatRefHash !== input.expectedChatRefHash ||
      existing.expectedUserRefHash !== input.expectedUserRefHash
    ) {
      return null;
    }
    const consumed = { ...existing, consumedAt: input.consumedAt };
    this.actions.set(input.tokenDigest, consumed);
    return clone(consumed);
  }

  async enqueueTelegram(delivery: ReplyCopilotTelegramDelivery) {
    if (this.telegram.has(delivery.outboxKey)) return false;
    this.telegram.set(delivery.outboxKey, clone(delivery));
    return true;
  }

  async claimTelegram(now: string, ownerId: string, leaseMs: number) {
    const claimed = claimDelivery(this.telegram, now, ownerId, leaseMs);
    return claimed ? clone(claimed) : null;
  }

  async updateTelegram(delivery: ReplyCopilotTelegramDelivery) {
    const existing = this.telegram.get(delivery.outboxKey);
    if (!existing || existing.leaseGeneration !== delivery.leaseGeneration) return false;
    this.telegram.set(delivery.outboxKey, clone(delivery));
    return true;
  }

  async bindTelegramMessage(intentKey: string, providerMessageRefHash: string) {
    this.telegramMessages.set(providerMessageRefHash, intentKey);
  }

  async findIntentByTelegramMessage(providerMessageRefHash: string) {
    const intentKey = this.telegramMessages.get(providerMessageRefHash);
    if (!intentKey) return null;
    return this.getIntent(intentKey);
  }

  async enqueueGhl(delivery: ReplyCopilotGhlDelivery) {
    if (this.ghl.has(delivery.outboxKey)) return false;
    this.ghl.set(delivery.outboxKey, clone(delivery));
    return true;
  }

  async claimGhl(now: string, ownerId: string, leaseMs: number) {
    const claimed = claimDelivery(this.ghl, now, ownerId, leaseMs);
    return claimed ? clone(claimed) : null;
  }

  async updateGhl(delivery: ReplyCopilotGhlDelivery) {
    const existing = this.ghl.get(delivery.outboxKey);
    if (!existing || existing.leaseGeneration !== delivery.leaseGeneration) return false;
    this.ghl.set(delivery.outboxKey, clone(delivery));
    return true;
  }

  async saveVoiceExample(example: ReplyCopilotVoiceExample) {
    if (this.examples.has(example.exampleKey)) return false;
    this.examples.set(example.exampleKey, clone(example));
    return true;
  }

  async listVoiceExamples() {
    return [...this.examples.values()].map(clone);
  }

  async appendAudit(event: ReplyCopilotAuditEvent) {
    this.audit.push(clone(event));
  }

  telegramDeliveries() {
    return [...this.telegram.values()].map(clone);
  }

  ghlDeliveries() {
    return [...this.ghl.values()].map(clone);
  }

  auditEvents() {
    return this.audit.map(clone);
  }
}

type Claimable = {
  outboxKey: string;
  state: 'queued' | 'leased' | 'retry' | 'unknown' | 'sent' | 'dead_letter';
  attempts: number;
  nextAttemptAt: string;
  leaseOwner: string | null;
  leaseGeneration: number;
  leaseExpiresAt: string | null;
};

function claimDelivery<T extends Claimable>(
  deliveries: Map<string, T>,
  now: string,
  ownerId: string,
  leaseMs: number,
) {
  const nowMs = new Date(now).getTime();
  const claimable = [...deliveries.values()]
    .filter((delivery) => {
      if (['queued', 'retry', 'unknown'].includes(delivery.state)) {
        return new Date(delivery.nextAttemptAt).getTime() <= nowMs;
      }
      return (
        delivery.state === 'leased' &&
        delivery.leaseExpiresAt !== null &&
        new Date(delivery.leaseExpiresAt).getTime() <= nowMs
      );
    })
    .sort((left, right) => left.nextAttemptAt.localeCompare(right.nextAttemptAt))[0];
  if (!claimable) return null;
  const claimed = {
    ...claimable,
    state: 'leased' as const,
    attempts: claimable.attempts + 1,
    leaseOwner: ownerId,
    leaseGeneration: claimable.leaseGeneration + 1,
    leaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
  } as T;
  deliveries.set(claimed.outboxKey, claimed);
  return claimed;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
