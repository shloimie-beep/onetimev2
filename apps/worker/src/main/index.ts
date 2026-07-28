import 'dotenv/config';
import { createPgPool } from '../../../../packages/db/src/index.ts';
import {
  applyNextOt86Publication,
  createDisabledOt109TranscriptionPort,
  createDisabledOt109VimeoPort,
  contentFactoryStorageFromEnv,
  DeterministicFakeHighLevelAdapter,
  runAuthEmailChallengeDeliveryOutboxBatch,
  runHighLevelProjectionBatch,
  runLifecycleDeliveryOutboxBatch,
  runOt109PublisherWorkerOnce,
  runContentFactoryWorkerOnce,
  runSupportDeliveryBatch,
} from '../../../../packages/domain/src/index.ts';
import {
  markOpsWorkerDraining,
  markOpsWorkerStopped,
  opsWorkerInstanceKey,
  upsertOpsWorkerHeartbeat,
} from '../../../../packages/observability/src/index.ts';
import { loadDeliveryWorkerConfig } from '../delivery/config.ts';
import { createDeliveryLogger } from '../delivery/logger.ts';
import { PollingLoopControl, runNonOverlappingPollingLoop } from '../delivery/loop.ts';
import { OneTimeProviderDeliveryRouter } from '../delivery/provider-router.ts';
import { PostgresDeliveryRepository } from '../delivery/repository.ts';
import { SinkDeliveryRouter } from '../delivery/sink-router.ts';
import { runDeliveryBatch } from '../delivery/worker.ts';
import { HighLevelHttpAdapter } from '../highlevel/adapter.ts';
import { runWorkerRunners, workerRunnerRegistrations } from '../runners/registry/index.ts';

const WORKER_TYPE = 'delivery_outbox';

export async function runOutboxWorkerOnce(source: NodeJS.ProcessEnv = process.env) {
  const config = loadDeliveryWorkerConfig(source);
  const pool = createPgPool(config.appConfig);
  const logger = createDeliveryLogger();
  const workerInstanceKey = opsWorkerInstanceKey(WORKER_TYPE, source);
  try {
    await safeHeartbeat(
      () =>
        upsertOpsWorkerHeartbeat({
          pool,
          config: config.appConfig,
          workerType: WORKER_TYPE,
          workerInstanceKey,
          state: 'ready',
          readiness: {
            mode: 'once',
            batch_size: config.batchSize,
            transport_mode: config.transportMode,
            delivery_environment: config.appConfig.deliveryEnvironment,
            provider_readiness: config.provider.snapshot,
          },
        }),
      logger,
    );
    const delivery = await runDeliveryBatch({
      repository: new PostgresDeliveryRepository(pool),
      router: createOutboxRouter(config),
      logger,
      messageConfig: config.message,
      options: {
        accountKey: config.accountKey,
        productKey: config.productKey,
        batchSize: config.batchSize,
        concurrency: config.concurrency,
        transportMode: config.transportMode,
        claimLeaseMs: config.claimLeaseMs,
        providerTimeoutMs: config.providerTimeoutMs,
        providerTimeoutLeaseSafetyMs: config.providerTimeoutLeaseSafetyMs,
        maxAttempts: config.maxAttempts,
      },
    });
    const support = await runSupportDeliveryBatch({
      pool,
      config: config.appConfig,
      options: {
        batchSize: config.batchSize,
        claimLeaseMs: config.claimLeaseMs,
        requestTimeoutMs: config.providerTimeoutMs,
        maxAttempts: 12,
        maxAgeMs: 172_800_000,
      },
    });
    const lifecycle = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: config.appConfig,
      limit: config.batchSize,
      leaseMs: config.claimLeaseMs,
    });
    const authEmail = await runAuthEmailChallengeDeliveryOutboxBatch({
      pool,
      config: config.appConfig,
      limit: config.batchSize,
      leaseMs: config.claimLeaseMs,
    });
    const highLevel = await runHighLevelProjectionBatch({
      pool,
      config: config.appConfig,
      ...highLevelAdapter(config.appConfig),
      limit: config.batchSize,
    });
    const learningDelivery = await runLearningDeliveryWorkerOnce({
      pool,
      source,
      logger,
    });
    const contentFactory = await runDurableContentFactoryWorkerOnce({
      pool,
      config: config.appConfig,
      source,
      workerInstanceKey,
      logger,
    });
    const registeredRunners = await runWorkerRunners({
      context: {
        config: config.appConfig,
        pool,
        source,
        workerInstanceKey,
        logger,
      },
      registrations: workerRunnerRegistrations,
    });
    return {
      ...delivery,
      support,
      lifecycle,
      authEmail,
      highLevel,
      learningDelivery,
      contentFactory,
      registeredRunners,
    };
  } finally {
    await safeHeartbeat(
      () => markOpsWorkerStopped({ pool, workerType: WORKER_TYPE, workerInstanceKey }),
      logger,
    );
    await pool.end();
  }
}

export async function runOutboxSinkOnce(source: NodeJS.ProcessEnv = process.env) {
  return runOutboxWorkerOnce(source);
}

async function runContinuously(source: NodeJS.ProcessEnv = process.env) {
  const config = loadDeliveryWorkerConfig(source);
  const pool = createPgPool(config.appConfig);
  const logger = createDeliveryLogger();
  const control = new PollingLoopControl();
  const workerInstanceKey = opsWorkerInstanceKey(WORKER_TYPE, source);
  const heartbeat = () =>
    safeHeartbeat(
      () =>
        upsertOpsWorkerHeartbeat({
          pool,
          config: config.appConfig,
          workerType: WORKER_TYPE,
          workerInstanceKey,
          state: control.stopped ? 'draining' : 'ready',
          readiness: {
            mode: 'continuous',
            batch_size: config.batchSize,
            concurrency: config.concurrency,
            poll_interval_ms: config.pollIntervalMs,
            transport_mode: config.transportMode,
            delivery_environment: config.appConfig.deliveryEnvironment,
            provider_readiness: config.provider.snapshot,
          },
        }),
      logger,
    );
  await heartbeat();
  const heartbeatTimer = setInterval(
    () => {
      void heartbeat();
    },
    Math.max(5_000, Math.min(config.pollIntervalMs, 30_000)),
  );
  const stop = () => {
    logger.info('delivery_worker_shutdown_requested', { worker: 'ot36-delivery-sink' });
    void safeHeartbeat(
      () => markOpsWorkerDraining({ pool, workerType: WORKER_TYPE, workerInstanceKey }),
      logger,
    );
    control.stop();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  try {
    await runNonOverlappingPollingLoop({
      pollIntervalMs: config.pollIntervalMs,
      control,
      runOnce: async () => {
        try {
          await runDeliveryBatch({
            repository: new PostgresDeliveryRepository(pool),
            router: createOutboxRouter(config),
            logger,
            messageConfig: config.message,
            options: {
              accountKey: config.accountKey,
              productKey: config.productKey,
              batchSize: config.batchSize,
              concurrency: config.concurrency,
              transportMode: config.transportMode,
              claimLeaseMs: config.claimLeaseMs,
              providerTimeoutMs: config.providerTimeoutMs,
              providerTimeoutLeaseSafetyMs: config.providerTimeoutLeaseSafetyMs,
              maxAttempts: config.maxAttempts,
            },
          });
          await runSupportDeliveryBatch({
            pool,
            config: config.appConfig,
            options: {
              batchSize: config.batchSize,
              claimLeaseMs: config.claimLeaseMs,
              requestTimeoutMs: config.providerTimeoutMs,
              maxAttempts: 12,
              maxAgeMs: 172_800_000,
            },
          });
          await runLifecycleDeliveryOutboxBatch({
            pool,
            config: config.appConfig,
            limit: config.batchSize,
            leaseMs: config.claimLeaseMs,
          });
          await runAuthEmailChallengeDeliveryOutboxBatch({
            pool,
            config: config.appConfig,
            limit: config.batchSize,
            leaseMs: config.claimLeaseMs,
          });
          await runHighLevelProjectionBatch({
            pool,
            config: config.appConfig,
            ...highLevelAdapter(config.appConfig),
            limit: config.batchSize,
          });
          await runLearningDeliveryWorkerOnce({ pool, source, logger });
          await runDurableContentFactoryWorkerOnce({
            pool,
            config: config.appConfig,
            source,
            workerInstanceKey,
            logger,
          });
          await runWorkerRunners({
            context: {
              config: config.appConfig,
              pool,
              source,
              workerInstanceKey,
              logger,
            },
            registrations: workerRunnerRegistrations,
          });
        } catch (error) {
          void error;
          logger.error('delivery_batch_failed', {
            worker: 'ot36-delivery-sink',
            failure_code: 'worker_batch_failed',
          });
        }
      },
    });
  } finally {
    clearInterval(heartbeatTimer);
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
    await safeHeartbeat(
      () => markOpsWorkerStopped({ pool, workerType: WORKER_TYPE, workerInstanceKey }),
      logger,
    );
    await pool.end();
    logger.info('delivery_worker_shutdown_complete', { worker: 'ot36-delivery-sink' });
  }
}

async function safeHeartbeat(
  run: () => Promise<void>,
  logger: ReturnType<typeof createDeliveryLogger>,
) {
  try {
    await run();
  } catch (error) {
    void error;
    logger.warn('worker_heartbeat_failed', {
      worker: 'ot36-delivery-sink',
      failure_code: 'worker_heartbeat_failed',
    });
  }
}

function createOutboxRouter(config: ReturnType<typeof loadDeliveryWorkerConfig>) {
  if (config.transportMode === 'sink') return new SinkDeliveryRouter();
  return new OneTimeProviderDeliveryRouter(config.provider, {});
}

function highLevelAdapter(config: ReturnType<typeof loadDeliveryWorkerConfig>['appConfig']) {
  if (config.highLevelEventSyncMode === 'mock') {
    return { adapter: new DeterministicFakeHighLevelAdapter() };
  }
  if (config.highLevelEventSyncMode === 'provider') {
    return { adapter: new HighLevelHttpAdapter(config) };
  }
  return {};
}

async function runLearningDeliveryWorkerOnce(input: {
  pool: ReturnType<typeof createPgPool>;
  source: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createDeliveryLogger>;
}) {
  if (input.source.LEARNING_DELIVERY_WORKER_ENABLED !== 'true') {
    return { enabled: false as const };
  }
  const ot86 = await safeLearningDeliveryStep(
    () => applyNextOt86Publication({ pool: input.pool }),
    input.logger,
    'ot86_publication_apply',
  );
  const ot109 = await safeLearningDeliveryStep(
    () =>
      runOt109PublisherWorkerOnce({
        pool: input.pool,
        vimeo: createDisabledOt109VimeoPort(),
        transcription: createDisabledOt109TranscriptionPort(),
        actorId: 'learning_delivery_worker',
      }),
    input.logger,
    'ot109_publisher_advance',
  );
  return {
    enabled: true as const,
    provider_calls_performed: false,
    ot86,
    ot109,
  };
}

async function runDurableContentFactoryWorkerOnce(input: {
  pool: ReturnType<typeof createPgPool>;
  config: ReturnType<typeof loadDeliveryWorkerConfig>['appConfig'];
  source: NodeJS.ProcessEnv;
  workerInstanceKey: string;
  logger: ReturnType<typeof createDeliveryLogger>;
}) {
  if (input.source.CONTENT_FACTORY_WORKER_ENABLED !== 'true') {
    return { enabled: false as const, provider_calls_performed: false as const };
  }
  try {
    const result = await runContentFactoryWorkerOnce({
      pool: input.pool,
      config: input.config,
      storage: contentFactoryStorageFromEnv(input.source),
      workerIdentity: input.workerInstanceKey,
      mode: input.source.CONTENT_FACTORY_PROCESSING_MODE === 'vimeo' ? 'vimeo' : 'synthetic',
    });
    return { enabled: true as const, provider_calls_performed: false as const, result };
  } catch (error) {
    void error;
    input.logger.warn('content_factory_worker_step_failed', {
      worker: 'content_factory',
      failure_code: 'content_factory_worker_step_failed',
    });
    return {
      enabled: true as const,
      provider_calls_performed: false as const,
      safe_error_code: 'content_factory_worker_step_failed',
    };
  }
}

async function safeLearningDeliveryStep<T>(
  run: () => Promise<T>,
  logger: ReturnType<typeof createDeliveryLogger>,
  step: string,
): Promise<{ ok: true; result: T } | { ok: false; safe_error_code: string }> {
  try {
    return { ok: true, result: await run() };
  } catch (error) {
    void error;
    logger.warn('learning_delivery_worker_step_failed', {
      worker: 'learning_delivery',
      step,
      failure_code: 'learning_delivery_step_failed',
    });
    return { ok: false, safe_error_code: 'learning_delivery_step_failed' };
  }
}

if (process.argv.includes('--once')) {
  const summary = await runOutboxWorkerOnce();
  process.stdout.write(
    [
      `sink_delivered=${summary.sinkDelivered}`,
      `support_delivered=${summary.support.delivered}`,
      `lifecycle_sink_delivered=${summary.lifecycle.sink_delivered}`,
      `lifecycle_expired=${summary.lifecycle.expired}`,
      `auth_email_sink_delivered=${summary.authEmail.sink_delivered}`,
      `auth_email_expired=${summary.authEmail.expired}`,
      `highlevel_adapter_calls=${summary.highLevel.adapterCalls}`,
      `learning_delivery_enabled=${summary.learningDelivery.enabled}`,
      `content_factory_enabled=${summary.contentFactory.enabled}`,
    ].join('\n') + '\n',
  );
} else {
  await runContinuously();
}
