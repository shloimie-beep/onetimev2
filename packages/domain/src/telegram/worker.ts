import type {
  BotAuditSink,
  BotInboxRepository,
  BotTransportAdapter,
  ConsumerLeaseRepository,
  NormalizedBotUpdate,
  SensitivePayloadCodec,
} from '../../../contracts/src/telegram/types.ts';
import { correlationKey, stableDigest } from './crypto.ts';
import type { TelegramCommandEngine } from './commands.ts';

export class TelegramPollingConflictError extends Error {
  readonly code = 409;

  constructor() {
    super('Mock Telegram polling conflict: another consumer owns polling.');
  }
}

export type TelegramWorkerConfig = {
  ownerId: string;
  leaseMs: number;
  handlerDeadlineMs: number;
  maxAttempts: number;
  baseBackoffMs: number;
  jitter: () => number;
};

export class TelegramBotWorkerEngine {
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly inbox: BotInboxRepository,
    private readonly codec: SensitivePayloadCodec,
    private readonly engine: TelegramCommandEngine,
    private readonly transport: BotTransportAdapter,
    private readonly audit: BotAuditSink,
    private readonly config: TelegramWorkerConfig,
  ) {}

  async runOnce(now = new Date()) {
    if (this.running) return { claimed: false, reason: 'already_running' as const };
    this.running = true;
    try {
      const item = await this.inbox.claimNext(now, this.config.ownerId, this.config.leaseMs);
      if (!item) return { claimed: false, reason: 'empty' as const };
      try {
        const update = (await withDeadline(
          this.codec.decrypt(item.payloadRef, {
            botKey: item.botKey,
            environment: item.environment,
            classification: 'normalized_update',
          }),
          this.config.handlerDeadlineMs,
        )) as NormalizedBotUpdate;
        const replies = await withDeadline(
          this.engine.handle(update, now),
          this.config.handlerDeadlineMs,
        );
        for (const reply of replies) await this.transport.sendReply(reply);
        await this.inbox.complete(item.inboxKey, item.leaseGeneration);
        return { claimed: true as const, disposition: 'completed' as const };
      } catch (error) {
        const reasonCode = safeReasonCode(error);
        if (item.attempts + 1 >= this.config.maxAttempts) {
          await this.inbox.deadLetter(item.inboxKey, item.leaseGeneration, reasonCode);
          await this.audit.record({
            botKey: item.botKey,
            environment: item.environment,
            correlationKey: correlationKey('worker'),
            outcome: 'dead_letter',
            reason: reasonCode,
          });
          return { claimed: true as const, disposition: 'dead_letter' as const };
        }
        const backoff = this.config.baseBackoffMs * 2 ** item.attempts;
        const jitter = Math.floor(Math.max(0, this.config.jitter()) * this.config.baseBackoffMs);
        await this.inbox.retry(
          item.inboxKey,
          item.leaseGeneration,
          new Date(now.getTime() + backoff + jitter),
          reasonCode,
        );
        return { claimed: true as const, disposition: 'retry' as const };
      }
    } finally {
      this.running = false;
    }
  }

  start(intervalMs: number) {
    this.stopping = false;
    const tick = async () => {
      if (this.stopping) return;
      await this.runOnce();
      if (!this.stopping) this.timer = setTimeout(tick, intervalMs);
    };
    this.timer = setTimeout(tick, 0);
  }

  async stop() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function acquireConsumerLeaseOrThrow(
  leases: ConsumerLeaseRepository,
  input: Parameters<ConsumerLeaseRepository['acquire']>[0],
) {
  const result = await leases.acquire(input);
  if (!result.acquired) {
    throw new Error('One Time Telegram bot consumer is already owned for this bot/environment.');
  }
  return result.generation;
}

export function validateTelegramRuntimeTopology(input: {
  webhookEnabled: boolean;
  localPollingEnabled: boolean;
  productionPollingEnabled: boolean;
}) {
  if (input.productionPollingEnabled) {
    throw new Error('Production Telegram polling is not implemented in OT-51P.');
  }
  if (input.webhookEnabled && input.localPollingEnabled) {
    throw new Error('Telegram webhook mode and local polling mode are mutually exclusive.');
  }
}

export async function runMockPollingAdapter(input: {
  poll: () => Promise<NormalizedBotUpdate[]>;
  onUpdate: (update: NormalizedBotUpdate) => Promise<void>;
  onShutdown: (reason: string) => Promise<void>;
}) {
  try {
    const updates = await input.poll();
    for (const update of updates) await input.onUpdate(update);
    return { stopped: false };
  } catch (error) {
    if (error instanceof TelegramPollingConflictError) {
      await input.onShutdown('telegram_409_conflict');
      return { stopped: true, reason: 'telegram_409_conflict' as const };
    }
    throw error;
  }
}

function safeReasonCode(error: unknown) {
  if (error instanceof Error) {
    return stableDigest([error.name, error.message]).slice(0, 24);
  }
  return 'unknown_error';
}

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('telegram_worker_deadline_exceeded')), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
