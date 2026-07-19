import { writeFile } from 'node:fs/promises';
import pg from 'pg';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg?.startsWith('--')) {
    args.set(arg, process.argv[index + 1]);
    index += 1;
  }
}

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('A database connection variable is required.');
}

const sslEnabled = ['1', 'true', 'yes'].includes(
  String(process.env.DATABASE_SSL ?? '').toLowerCase(),
);

const pool = new pg.Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
  max: 2,
});

const generatedAt = new Date().toISOString();

function quoteIdent(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function scalar(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] ?? null;
}

async function tableExists(tableName) {
  const row = await scalar(`SELECT to_regclass($1) IS NOT NULL AS present`, [
    `onetime.${tableName}`,
  ]);
  return Boolean(row?.present);
}

async function columnsFor(tableName) {
  const result = await pool.query(
    `
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'onetime'
         AND table_name = $1
       ORDER BY ordinal_position
    `,
    [tableName],
  );
  return result.rows.map((row) => String(row.column_name));
}

async function outboxSummary(tableName) {
  const columns = await columnsFor(tableName);
  const total = await scalar(`SELECT count(*)::int AS count FROM onetime.${quoteIdent(tableName)}`);
  const stateColumn = ['status', 'state', 'delivery_state', 'command_state', 'local_state'].find(
    (candidate) => columns.includes(candidate),
  );
  const summary = {
    table: tableName,
    total_rows: Number(total?.count ?? 0),
    state_column: stateColumn ?? null,
    states: [],
    oldest_created_at: null,
    newest_created_at: null,
    next_scheduled_for: null,
  };

  if (stateColumn) {
    const states = await pool.query(
      `
        SELECT ${quoteIdent(stateColumn)}::text AS state, count(*)::int AS count
          FROM onetime.${quoteIdent(tableName)}
         GROUP BY ${quoteIdent(stateColumn)}
         ORDER BY count DESC, state ASC
      `,
    );
    summary.states = states.rows.map((row) => ({
      state: row.state,
      count: Number(row.count),
    }));
  }

  if (columns.includes('created_at')) {
    const ages = await scalar(
      `
        SELECT min(created_at)::text AS oldest_created_at,
               max(created_at)::text AS newest_created_at
          FROM onetime.${quoteIdent(tableName)}
      `,
    );
    summary.oldest_created_at = ages?.oldest_created_at ?? null;
    summary.newest_created_at = ages?.newest_created_at ?? null;
  }

  if (columns.includes('scheduled_for')) {
    const next = await scalar(
      `
        SELECT min(scheduled_for)::text AS next_scheduled_for
          FROM onetime.${quoteIdent(tableName)}
         WHERE scheduled_for >= now()
      `,
    );
    summary.next_scheduled_for = next?.next_scheduled_for ?? null;
  }

  return summary;
}

async function workerHeartbeatSummary() {
  if (!(await tableExists('worker_heartbeats'))) {
    return { present: false, rows: [] };
  }
  const columns = await columnsFor('worker_heartbeats');
  const workerColumn = ['worker_type', 'worker_name', 'worker_id'].find((candidate) =>
    columns.includes(candidate),
  );
  const heartbeatColumn = [
    'last_heartbeat_at',
    'heartbeat_at',
    'last_seen_at',
    'updated_at',
    'created_at',
  ].find((candidate) => columns.includes(candidate));

  if (!workerColumn || !heartbeatColumn) {
    return {
      present: true,
      rows: [],
      aggregate_only: true,
      columns_detected: {
        worker_column: workerColumn ?? null,
        heartbeat_column: heartbeatColumn ?? null,
      },
    };
  }

  const rows = await pool.query(
    `
      SELECT ${quoteIdent(workerColumn)}::text AS worker,
             count(*)::int AS rows,
             max(${quoteIdent(heartbeatColumn)})::text AS latest_heartbeat_at
        FROM onetime.worker_heartbeats
       GROUP BY ${quoteIdent(workerColumn)}
       ORDER BY worker ASC
    `,
  );

  return {
    present: true,
    worker_column: workerColumn,
    heartbeat_column: heartbeatColumn,
    rows: rows.rows.map((row) => ({
      worker: row.worker,
      rows: Number(row.rows),
      latest_heartbeat_at: row.latest_heartbeat_at,
    })),
  };
}

try {
  const migration = await scalar(
    `
      SELECT count(*)::int AS migration_rows,
             max(id) AS latest_migration
        FROM onetime.schema_migrations
    `,
  );
  const outboxTablesResult = await pool.query(
    `
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'onetime'
         AND table_type = 'BASE TABLE'
         AND table_name ILIKE '%outbox%'
       ORDER BY table_name
    `,
  );

  const outboxes = [];
  for (const row of outboxTablesResult.rows) {
    outboxes.push(await outboxSummary(String(row.table_name)));
  }

  const heartbeat = await workerHeartbeatSummary();
  const readyLikeStates = new Set([
    'pending',
    'queued',
    'scheduled',
    'ready',
    'sink_queued',
    'processing',
    'retry',
  ]);
  const readyLikeRows = outboxes.reduce((sum, table) => {
    return (
      sum +
      table.states.reduce((inner, state) => {
        const key = String(state.state ?? '').toLowerCase();
        return inner + (readyLikeStates.has(key) ? state.count : 0);
      }, 0)
    );
  }, 0);
  const deadLetterRows = outboxes.reduce((sum, table) => {
    return (
      sum +
      table.states.reduce((inner, state) => {
        const key = String(state.state ?? '').toLowerCase();
        return inner + (key.includes('dead') || key.includes('failed') ? state.count : 0);
      }, 0)
    );
  }, 0);

  const report = {
    schema_version: 'onetime.w13_101.production_safe_core_audit.v1',
    generated_at: generatedAt,
    scope: args.get('--scope') ?? 'production',
    migration: {
      rows: Number(migration?.migration_rows ?? 0),
      latest: migration?.latest_migration ?? null,
    },
    outboxes,
    worker_heartbeats: heartbeat,
    aggregate: {
      outbox_table_count: outboxes.length,
      outbox_total_rows: outboxes.reduce((sum, table) => sum + table.total_rows, 0),
      ready_like_rows: readyLikeRows,
      dead_letter_like_rows: deadLetterRows,
    },
    secrets_printed: false,
    raw_payloads_printed: false,
  };

  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outPath = args.get('--out');
  if (outPath) {
    await writeFile(outPath, output, 'utf8');
  }
  process.stdout.write(output);
} finally {
  await pool.end();
}
