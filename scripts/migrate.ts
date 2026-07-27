import 'dotenv/config';
import { loadConfig } from '../packages/config/src/index.ts';
import { createPgPool, runMigrations } from '../packages/db/src/index.ts';

if (process.argv.includes('--verify')) {
  throw new Error('Use npm run db:verify; db:migrate is the only migration apply command.');
}

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const results = await runMigrations(pool);
  process.stdout.write(`migrated ${results.length} migrations\n`);
  for (const result of results) {
    process.stdout.write(`${result.status} ${result.id} ${result.checksum}\n`);
  }
} finally {
  await pool.end();
}
