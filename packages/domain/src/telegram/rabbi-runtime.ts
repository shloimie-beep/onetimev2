import type { AppConfig } from '../../../config/src/index.ts';
import { asBotKey, type BotTransportAdapter } from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import {
  TelegramSqlAuditSink,
  TelegramSqlConsumerLeaseRepository,
  TelegramSqlIdentityMappingRepository,
  TelegramSqlInboxRepository,
  TelegramSqlResponseOutboxTransportAdapter,
} from '../../../db/src/telegram/repositories.ts';
import { AesGcmPayloadCodec } from './crypto.ts';
import { TelegramIdentityResolver } from './identity.ts';
import { RabbiCommunicationService } from './rabbi-communications.ts';
import { RabbiTelegramCommunicationEngine, RabbiTelegramIdentityAdapter } from './rabbi-engine.ts';
import {
  DisabledRabbiConversationProvider,
  SyntheticRabbiConversationProvider,
} from './rabbi-provider.ts';
import { RabbiParentReplyWorker } from './rabbi-worker.ts';
import { TelegramBotWorkerEngine, acquireConsumerLeaseOrThrow } from './worker.ts';
import type { RabbiConversationProvider } from '../../../contracts/src/telegram/rabbi-communications.ts';

const LEASE_MS = 30_000;

export function rabbiTelegramReadiness(config: AppConfig) {
  const blockers = [
    !config.oneTimeRabbiTelegramEnabled && 'runtime_disabled',
    !config.oneTimeRabbiTelegramTokenConfigured && 'distinct_token_unconfigured',
    !config.oneTimeRabbiTelegramOwnerMappingConfigured && 'owner_mapping_unconfigured',
    !config.oneTimeRabbiTelegramSingleConsumerGate && 'single_consumer_gate_off',
    !config.oneTimeRabbiTelegramTokenFingerprintHash && 'token_fingerprint_unconfigured',
    !config.oneTimeRabbiTelegramPayloadKey && 'distinct_payload_key_unconfigured',
  ].filter((value): value is string => Boolean(value));
  return {
    status: blockers.length === 0 ? ('ready' as const) : ('provider_off' as const),
    ready: blockers.length === 0,
    botKey: config.oneTimeRabbiTelegramBotKey,
    environment: config.oneTimeTelegramEnvironment,
    providerMode: config.oneTimeRabbiGhlReplyMode,
    customerDeliveryAuthorized: false,
    customerDeliveryStatus: 'provider_off' as const,
    blockers,
  };
}

export function createOneTimeRabbiTelegramRuntime(input: {
  pool: DbPool;
  config: AppConfig;
  ownerId?: string;
  transport?: BotTransportAdapter;
  provider?: RabbiConversationProvider;
}) {
  const botKey = asBotKey(input.config.oneTimeRabbiTelegramBotKey);
  const environment = input.config.oneTimeTelegramEnvironment;
  const ownerId = input.ownerId ?? `rabbi-telegram-worker-${process.pid}`;
  const codec = new AesGcmPayloadCodec(
    input.config.oneTimeRabbiTelegramPayloadKey ??
      `${input.config.mfaSecretEncryptionKey}:disabled-rabbi-runtime-only`,
  );
  const audit = new TelegramSqlAuditSink(input.pool);
  const serviceProvider =
    input.provider ??
    (input.config.oneTimeRabbiGhlReplyMode === 'synthetic'
      ? new SyntheticRabbiConversationProvider()
      : new DisabledRabbiConversationProvider());
  const service = new RabbiCommunicationService(input.pool, codec, serviceProvider.mode);
  const identityAdapter = new RabbiTelegramIdentityAdapter(input.pool);
  const engine = new RabbiTelegramCommunicationEngine(
    new TelegramIdentityResolver(
      new TelegramSqlIdentityMappingRepository(input.pool),
      identityAdapter,
    ),
    service,
    audit,
  );
  const transport =
    input.transport ??
    new TelegramSqlResponseOutboxTransportAdapter(input.pool, { botKey, environment });
  const commandWorker = new TelegramBotWorkerEngine(
    new TelegramSqlInboxRepository(input.pool),
    codec,
    engine,
    transport,
    audit,
    {
      ownerId,
      leaseMs: LEASE_MS,
      handlerDeadlineMs: 4_000,
      maxAttempts: 5,
      baseBackoffMs: 1_000,
      jitter: Math.random,
    },
  );
  const replyWorker = new RabbiParentReplyWorker(input.pool, codec, serviceProvider, audit, {
    botKey,
    environment,
    ownerId,
    rowLeaseMs: LEASE_MS,
    baseBackoffMs: 1_000,
  });
  const leases = new TelegramSqlConsumerLeaseRepository(input.pool);
  let leaseGeneration: number | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const acquireLease = async (now = new Date()) => {
    const tokenFingerprint = input.config.oneTimeRabbiTelegramTokenFingerprintHash;
    if (!tokenFingerprint) throw new Error('RABBI_TELEGRAM_TOKEN_FINGERPRINT_UNCONFIGURED');
    leaseGeneration = await acquireConsumerLeaseOrThrow(leases, {
      botKey,
      environment,
      tokenFingerprint,
      ownerId,
      leaseMs: LEASE_MS,
      now,
    });
    return leaseGeneration;
  };

  const start = async (intervalMs = 250) => {
    if (!rabbiTelegramReadiness(input.config).ready) {
      throw new Error('RABBI_TELEGRAM_RUNTIME_NOT_READY');
    }
    await acquireLease();
    commandWorker.start(intervalMs);
    replyWorker.start(intervalMs);
    heartbeat = setInterval(
      async () => {
        if (leaseGeneration === null) return;
        const renewed = await leases.heartbeat(ownerId, leaseGeneration, LEASE_MS, new Date());
        if (!renewed) {
          await commandWorker.stop();
          await replyWorker.stop();
        }
      },
      Math.floor(LEASE_MS / 3),
    );
  };

  const stop = async () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    await commandWorker.stop();
    await replyWorker.stop();
    if (leaseGeneration !== null) await leases.release(ownerId, leaseGeneration);
    leaseGeneration = null;
  };

  return {
    botKey,
    environment,
    engine,
    service,
    provider: serviceProvider,
    commandWorker,
    replyWorker,
    readiness: rabbiTelegramReadiness(input.config),
    acquireLease,
    start,
    stop,
    async runOnce(now = new Date()) {
      if (leaseGeneration === null) await acquireLease(now);
      const command = await commandWorker.runOnce(now);
      const reply = await replyWorker.runOnce(now);
      return { command, reply };
    },
  };
}
