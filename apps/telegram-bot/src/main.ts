import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createPgPool } from '../../../packages/db/src/index.ts';
import {
  createOneTimeRabbiTelegramRuntime,
  rabbiTelegramReadiness,
} from '../../../packages/domain/src/telegram/rabbi-runtime.ts';

export async function runRabbiTelegramWorker(source: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(source);
  const readiness = rabbiTelegramReadiness(config);
  if (!readiness.ready) return { started: false as const, readiness };
  const pool = createPgPool(config);
  const runtime = createOneTimeRabbiTelegramRuntime({ pool, config });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runtime.stop();
    await pool.end();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await runtime.start();
    return {
      started: true as const,
      readiness: { ...readiness, commandConsumerMounted: true as const },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function runRabbiTelegramWorkerOnce(source: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(source);
  const readiness = rabbiTelegramReadiness(config);
  if (!readiness.ready) return { started: false as const, readiness };
  const pool = createPgPool(config);
  const runtime = createOneTimeRabbiTelegramRuntime({ pool, config });
  try {
    const result = await runtime.runOnce();
    return { started: true as const, readiness, result };
  } finally {
    await runtime.stop();
    await pool.end();
  }
}

export async function runRabbiTelegramLocalAgentWorker(source: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(source);
  const readiness = rabbiTelegramReadiness(config);
  if (!readiness.ready) return { started: false as const, readiness };
  const pool = createPgPool(config);
  const runtime = createOneTimeRabbiTelegramRuntime({ pool, config });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runtime.stop();
    await pool.end();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await runtime.startLocalAgent();
    return {
      started: true as const,
      readiness: { ...readiness, localAgentConsumerMounted: true as const },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function runRabbiTelegramLocalAgentWorkerOnce(
  source: NodeJS.ProcessEnv = process.env,
) {
  const config = loadConfig(source);
  const readiness = rabbiTelegramReadiness(config);
  if (!readiness.ready) return { started: false as const, readiness };
  const pool = createPgPool(config);
  const runtime = createOneTimeRabbiTelegramRuntime({ pool, config });
  try {
    const result = await runtime.runAgentTaskOnce();
    return { started: true as const, readiness, result };
  } finally {
    await runtime.stop();
    await pool.end();
  }
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain && process.argv.includes('--local-agent-once')) {
  runRabbiTelegramLocalAgentWorkerOnce()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.started) process.exitCode = 2;
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'RABBI_LOCAL_AGENT_WORKER_FAILED';
      process.stderr.write(`${JSON.stringify({ started: false, code })}\n`);
      process.exitCode = 1;
    });
} else if (isMain && process.argv.includes('--local-agent')) {
  runRabbiTelegramLocalAgentWorker()
    .then((result) => {
      if (!result.started) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
        process.exitCode = 2;
      }
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'RABBI_LOCAL_AGENT_WORKER_FAILED';
      process.stderr.write(`${JSON.stringify({ started: false, code })}\n`);
      process.exitCode = 1;
    });
} else if (isMain && process.argv.includes('--once')) {
  runRabbiTelegramWorkerOnce()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.started) process.exitCode = 2;
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'RABBI_TELEGRAM_WORKER_FAILED';
      process.stderr.write(`${JSON.stringify({ started: false, code })}\n`);
      process.exitCode = 1;
    });
} else if (isMain) {
  runRabbiTelegramWorker()
    .then((result) => {
      if (!result.started) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
        process.exitCode = 2;
      }
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'RABBI_TELEGRAM_WORKER_FAILED';
      process.stderr.write(`${JSON.stringify({ started: false, code })}\n`);
      process.exitCode = 1;
    });
}
