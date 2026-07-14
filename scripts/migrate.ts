import 'dotenv/config';
import { loadConfig } from '../packages/config/src/index.ts';
import { createPgPool, runMigrations } from '../packages/db/src/index.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const results = await runMigrations(pool);
  const mode = process.argv.includes('--verify') ? 'verified' : 'migrated';
  process.stdout.write(`${mode} ${results.length} migrations\n`);
  for (const result of results) {
    process.stdout.write(`${result.status} ${result.id} ${result.checksum}\n`);
  }
} finally {
  await pool.end();
}
