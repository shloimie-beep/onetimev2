import 'dotenv/config';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import {
  createMemoryPool,
  createPgPool,
  runMigrations,
} from '../../../../packages/db/src/index.ts';
import { logger } from '../../../../packages/observability/src/index.ts';
import { createApp } from './app.ts';
import { createContentMediaWebRuntime } from './features/content/media-runtime.ts';

const config = loadConfig(process.env);
const pool =
  config.nodeEnv === 'test' && process.env.OT_TEST_DATABASE === 'memory'
    ? createMemoryPool()
    : createPgPool(config);

if (config.runMigrationsOnStartup) {
  await runMigrations(pool);
}

const contentMediaRuntime = createContentMediaWebRuntime({ config, pool, source: process.env });
const app = createApp({
  config,
  pool,
  ...(contentMediaRuntime ? { contentMediaRuntime } : {}),
});
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'One Time web listening');
});

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});
