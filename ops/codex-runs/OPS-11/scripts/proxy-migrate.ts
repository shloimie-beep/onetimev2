/* eslint-disable no-console */
import pg from 'pg';
import { runMigrations } from '../../../../packages/db/src/index.ts';

const proxyHost = process.env.OPS11_PROXY_HOST;
const proxyPort = process.env.OPS11_PROXY_PORT;
const databaseUrl = process.env.DATABASE_URL;

if (!proxyHost || !proxyPort) {
  throw new Error('OPS11_PROXY_HOST and OPS11_PROXY_PORT are required.');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const url = new URL(databaseUrl);
url.hostname = proxyHost;
url.port = proxyPort;

const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});

try {
  const results = await runMigrations(pool);
  const applied = results.filter((result) => result.status === 'applied');
  const alreadyApplied = results.filter((result) => result.status === 'already_applied');
  const latest = results.at(-1)?.id ?? null;

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        total: results.length,
        applied: applied.length,
        already_applied: alreadyApplied.length,
        latest,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
