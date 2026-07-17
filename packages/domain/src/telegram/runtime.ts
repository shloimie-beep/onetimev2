import type { AppConfig } from '../../../config/src/index.ts';
import { asBotKey, type BotTransportAdapter } from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import {
  TelegramSqlAuditSink,
  TelegramSqlConfirmationRepository,
  TelegramSqlIdentityMappingRepository,
  TelegramSqlInboxRepository,
  TelegramSqlResponseOutboxTransportAdapter,
} from '../../../db/src/telegram/repositories.ts';
import { TelegramCommandEngine } from './commands.ts';
import { AesGcmPayloadCodec } from './crypto.ts';
import { TelegramIdentityResolver } from './identity.ts';
import { createOneTimeTelegramApplicationAdapter } from './application-adapter.ts';
import { telegramTransportReadiness } from './transport.ts';
import { TelegramBotWorkerEngine, validateTelegramRuntimeTopology } from './worker.ts';

export type OneTimeTelegramAdminRuntime = {
  engine: TelegramCommandEngine;
  worker: TelegramBotWorkerEngine;
  transport: BotTransportAdapter;
  runOnce(now?: Date): Promise<Awaited<ReturnType<TelegramBotWorkerEngine['runOnce']>>>;
  readiness: ReturnType<typeof telegramTransportReadiness>;
};

export function createOneTimeTelegramAdminRuntime(input: {
  pool: DbPool;
  config: AppConfig;
  ownerId?: string;
  transport?: BotTransportAdapter;
  now?: () => Date;
}): OneTimeTelegramAdminRuntime {
  validateTelegramRuntimeTopology({
    webhookEnabled: input.config.oneTimeTelegramWebhookEnabled,
    localPollingEnabled: false,
    productionPollingEnabled: false,
  });

  const botKey = asBotKey(input.config.oneTimeTelegramBotKey);
  const environment = input.config.oneTimeTelegramEnvironment;
  const codec = new AesGcmPayloadCodec(
    `${input.config.mfaSecretEncryptionKey}:telegram-payload-v1`,
  );
  const adapter = createOneTimeTelegramApplicationAdapter({
    pool: input.pool,
    config: input.config,
  });
  const audit = new TelegramSqlAuditSink(input.pool);
  const engine = new TelegramCommandEngine(
    new TelegramIdentityResolver(new TelegramSqlIdentityMappingRepository(input.pool), adapter),
    adapter,
    new TelegramSqlConfirmationRepository(input.pool),
    codec,
    audit,
  );
  const transport =
    input.transport ??
    new TelegramSqlResponseOutboxTransportAdapter(input.pool, {
      botKey,
      environment,
    });
  const worker = new TelegramBotWorkerEngine(
    new TelegramSqlInboxRepository(input.pool),
    codec,
    engine,
    transport,
    audit,
    {
      ownerId: input.ownerId ?? `telegram-worker-${process.pid}`,
      leaseMs: 30_000,
      handlerDeadlineMs: 4_000,
      maxAttempts: 5,
      baseBackoffMs: 1_000,
      jitter: Math.random,
    },
  );
  const readiness = telegramTransportReadiness({
    enabled: input.config.oneTimeTelegramWebhookEnabled,
    botKey,
    environment,
    tokenConfigured: false,
    ownerMappingConfigured: false,
    singleConsumerGate: true,
    canaryChatConfigured: false,
  });
  return {
    engine,
    worker,
    transport,
    readiness,
    runOnce: (now = input.now?.() ?? new Date()) => worker.runOnce(now),
  };
}
