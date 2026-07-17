const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const [, , outputPath, proxyEndpoint] = process.argv;

if (!outputPath || !proxyEndpoint) {
  console.error('Usage: node runtime-metadata-query.cjs <output-path> <proxy-host:port>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required but will not be printed.');
  process.exit(1);
}

const [proxyHost, proxyPort] = proxyEndpoint.split(':');
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.hostname = proxyHost;
databaseUrl.port = proxyPort;

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl:
    process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1'
      ? { rejectUnauthorized: true }
      : undefined,
});

function redact(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}

async function optionalCount(queue, sql) {
  try {
    const result = await pool.query(sql);
    return { queue, ...result.rows[0] };
  } catch (error) {
    return { queue, error_summary: redact(error) };
  }
}

async function main() {
  const generatedAt = new Date();
  const heartbeats = await pool.query(`
    SELECT worker_type,
           state,
           version,
           commit_sha,
           EXTRACT(EPOCH FROM (now() - last_seen_at)) * 1000 AS heartbeat_age_ms,
           EXTRACT(EPOCH FROM (lease_expires_at - now())) * 1000 AS lease_remaining_ms
      FROM onetime.worker_heartbeats
     ORDER BY worker_type ASC, last_seen_at DESC
  `);

  const queues = await Promise.all([
    optionalCount(
      'delivery_outbox',
      `SELECT sum(CASE WHEN status = 'pending' AND next_attempt_at <= now() THEN 1 ELSE 0 END)::int AS ready_count,
              sum(CASE WHEN status IN ('dead_lettered','dead_letter') THEN 1 ELSE 0 END)::int AS dead_letter_count,
              sum(CASE WHEN status = 'pending' AND attempts > 0 THEN 1 ELSE 0 END)::int AS retry_count
         FROM onetime.outbox_events`,
    ),
    optionalCount(
      'support_outbox',
      `SELECT sum(CASE WHEN status = 'PENDING' AND next_attempt_at <= now() THEN 1 ELSE 0 END)::int AS ready_count,
              sum(CASE WHEN status = 'DEAD_LETTER' THEN 1 ELSE 0 END)::int AS dead_letter_count,
              sum(CASE WHEN status = 'PENDING' AND attempts > 0 THEN 1 ELSE 0 END)::int AS retry_count
         FROM onetime.support_outbox`,
    ),
    optionalCount(
      'account_lifecycle_outbox',
      `SELECT sum(CASE WHEN state IN ('queued','retry') AND next_attempt_at <= now() THEN 1 ELSE 0 END)::int AS ready_count,
              sum(CASE WHEN state = 'dead_letter' THEN 1 ELSE 0 END)::int AS dead_letter_count,
              sum(CASE WHEN state = 'retry' THEN 1 ELSE 0 END)::int AS retry_count
         FROM onetime.account_lifecycle_delivery_outbox`,
    ),
  ]);

  const output = {
    schema_version: 'onetime.w12_100.staging_runtime_metadata.v1',
    generated_at: generatedAt.toISOString(),
    worker_count: heartbeats.rowCount,
    workers: heartbeats.rows.map((row) => ({
      worker_type: String(row.worker_type),
      state: String(row.state),
      version: String(row.version),
      commit_sha: String(row.commit_sha),
      heartbeat_age_ms: Math.max(0, Math.round(Number(row.heartbeat_age_ms))),
      lease_remaining_ms: Math.round(Number(row.lease_remaining_ms)),
    })),
    queues,
    database_mutation_performed: false,
    raw_source_rows_included: false,
    private_values_recorded: false,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error(redact(error));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
