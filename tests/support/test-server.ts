import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import { createAccountUser } from '../../packages/domain/src/index.ts';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  PORT: process.env.PORT ?? '3100',
});
const pool = createMemoryPool();
await runMigrations(pool);
await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_ADMIN_EMAIL ?? 'ot-admin@example.test',
  password: process.env.OT_TEST_ADMIN_PASSWORD ?? 'TestPassword!234',
  displayName: 'Test Admin',
  role: 'crm_agent',
  mfaCapable: true,
});
const app = createApp({ config, pool });
const server = app.listen(config.port);

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});
