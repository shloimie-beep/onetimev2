import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  PORT: process.env.PORT ?? '3100',
});
const pool = createMemoryPool();
await runMigrations(pool);
const app = createApp({ config, pool });
const server = app.listen(config.port);

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});
