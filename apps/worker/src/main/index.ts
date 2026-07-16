import 'dotenv/config';
import { createPgPool } from '../../../../packages/db/src/index.ts';
import {
  runLifecycleDeliveryOutboxBatch,
  runSupportDeliveryBatch,
} from '../../../../packages/domain/src/index.ts';
import { loadDeliveryWorkerConfig } from '../delivery/config.ts';
import { createDeliveryLogger } from '../delivery/logger.ts';
import { PollingLoopControl, runNonOverlappingPollingLoop } from '../delivery/loop.ts';
import { PostgresDeliveryRepository } from '../delivery/repository.ts';
import { SinkDeliveryRouter } from '../delivery/sink-router.ts';
import { runDeliveryBatch } from '../delivery/worker.ts';

export async function runOutboxWorkerOnce(source: NodeJS.ProcessEnv = process.env) {
  const config = loadDeliveryWorkerConfig(source);
  const pool = createPgPool(config.appConfig);
  try {
    const delivery = await runDeliveryBatch({
      repository: new PostgresDeliveryRepository(pool),
      router: new SinkDeliveryRouter(),
      logger: createDeliveryLogger(),
      messageConfig: config.message,
      options: {
        accountKey: config.accountKey,
        productKey: config.productKey,
        batchSize: config.batchSize,
        concurrency: config.concurrency,
        claimLeaseMs: config.claimLeaseMs,
        providerTimeoutMs: config.providerTimeoutMs,
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
    return { ...delivery, support, lifecycle };
  } finally {
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
  const stop = () => {
    logger.info('delivery_worker_shutdown_requested', { worker: 'ot36-delivery-sink' });
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
            router: new SinkDeliveryRouter(),
            logger,
            messageConfig: config.message,
            options: {
              accountKey: config.accountKey,
              productKey: config.productKey,
              batchSize: config.batchSize,
              concurrency: config.concurrency,
              claimLeaseMs: config.claimLeaseMs,
              providerTimeoutMs: config.providerTimeoutMs,
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
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
    await pool.end();
    logger.info('delivery_worker_shutdown_complete', { worker: 'ot36-delivery-sink' });
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
    ].join('\n') + '\n',
  );
} else {
  await runContinuously();
}
