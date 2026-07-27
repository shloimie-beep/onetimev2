import 'dotenv/config';
import { loadConfig } from '../packages/config/src/index.ts';
import { createPgPool, verifyMigrations } from '../packages/db/src/index.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const report = await verifyMigrations(pool, undefined, {
    requireFullyApplied: !process.argv.includes('--allow-pending'),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
} finally {
  await pool.end();
}
