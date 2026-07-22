import 'dotenv/config';
import { createPgPool } from '../../../../packages/db/src/index.ts';
import {
  contentFactoryStorageFromEnv,
  runContentFactoryWorkerOnce,
} from '../../../../packages/domain/src/index.ts';
import {
  markOpsWorkerDraining,
  markOpsWorkerStopped,
  opsWorkerInstanceKey,
  upsertOpsWorkerHeartbeat,
} from '../../../../packages/observability/src/index.ts';
import { createDeliveryLogger } from '../delivery/logger.ts';
import { PollingLoopControl, runNonOverlappingPollingLoop } from '../delivery/loop.ts';
import {
  assertNarrowContentFactoryReadiness,
  CONTENT_FACTORY_MIGRATION_ID,
  loadNarrowContentFactoryRuntime,
} from './runtime.ts';

const WORKER_TYPE = 'content_factory';

export async function runNarrowContentFactoryWorker(source: NodeJS.ProcessEnv = process.env) {
  const runtime = loadNarrowContentFactoryRuntime(source);
  const pool = createPgPool(runtime.appConfig);
  const storage = contentFactoryStorageFromEnv(runtime.storageSource);
  const logger = createDeliveryLogger();
  const control = new PollingLoopControl();
  const workerInstanceKey = opsWorkerInstanceKey(WORKER_TYPE, source);
  let started = false;
  const readiness = {
    mode: 'continuous',
    processing_mode: 'synthetic',
    provider_calls_enabled: false,
    storage_driver: 'volume',
    migration: CONTENT_FACTORY_MIGRATION_ID,
    poll_interval_ms: runtime.pollIntervalMs,
    lease_ms: runtime.leaseMs,
  };
  const heartbeat = async (state: 'ready' | 'draining' | 'stopped') => {
    await upsertOpsWorkerHeartbeat({
      pool,
      config: runtime.appConfig,
      workerType: WORKER_TYPE,
      workerInstanceKey,
      state,
      readiness,
    });
  };
  const stop = () => {
    if (control.stopped) return;
    control.stop();
    logger.info('content_factory_worker_shutdown_requested', {
      worker: WORKER_TYPE,
      provider_calls_enabled: false,
    });
    void markOpsWorkerDraining({ pool, workerType: WORKER_TYPE, workerInstanceKey });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  try {
    await assertNarrowContentFactoryReadiness({ pool, runtime });
    await heartbeat('ready');
    started = true;
    logger.info('content_factory_worker_ready', readiness);
    await runNonOverlappingPollingLoop({
      pollIntervalMs: runtime.pollIntervalMs,
      control,
      runOnce: async () => {
        await heartbeat('ready');
        const result = await runContentFactoryWorkerOnce({
          pool,
          config: runtime.appConfig,
          storage,
          workerIdentity: workerInstanceKey,
          leaseMs: runtime.leaseMs,
          mode: 'synthetic',
        });
        if (result.claimed || result.safeErrorCode) {
          logger.info('content_factory_worker_iteration', {
            worker: WORKER_TYPE,
            claimed: result.claimed,
            stage: result.stage ?? 'none',
            completed: result.completed,
            provider_calls_performed: result.providerCallsPerformed,
            safe_error_code: result.safeErrorCode ?? 'none',
          });
        }
      },
    });
  } finally {
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
    if (started) {
      await markOpsWorkerStopped({ pool, workerType: WORKER_TYPE, workerInstanceKey }).catch(
        () => undefined,
      );
    }
    await pool.end();
    logger.info('content_factory_worker_shutdown_complete', {
      worker: WORKER_TYPE,
      provider_calls_enabled: false,
    });
  }
}

try {
  await runNarrowContentFactoryWorker();
} catch (error) {
  const safeErrorCode =
    error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
      ? error.message
      : 'content_factory_worker_startup_failed';
  process.stderr.write(
    `${JSON.stringify({ event: 'content_factory_worker_startup_failed', safe_error_code: safeErrorCode })}\n`,
  );
  process.exitCode = 1;
}
