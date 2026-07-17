/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

async function query(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

try {
  const [version] = await query(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  const [tables] = await query(`
    SELECT count(*)::int AS table_count
      FROM information_schema.tables
     WHERE table_schema = 'onetime'
       AND table_type = 'BASE TABLE'
  `);
  const [indexes] = await query(`
    SELECT count(*)::int AS index_count
      FROM pg_indexes
     WHERE schemaname = 'onetime'
  `);
  const [constraints] = await query(`
    SELECT count(*)::int AS constraint_count
      FROM information_schema.table_constraints
     WHERE table_schema = 'onetime'
  `);
  const [sequences] = await query(`
    SELECT count(*)::int AS sequence_count
      FROM information_schema.sequences
     WHERE sequence_schema = 'onetime'
  `);
  const ledger = await query('SELECT id, checksum FROM onetime.schema_migrations ORDER BY id');
  const [latest] = await query(`
    SELECT count(*)::int AS migration_rows, max(id) AS latest_migration
      FROM onetime.schema_migrations
  `);
  const extensions = await query(`
    SELECT extname, extversion
      FROM pg_extension
     ORDER BY extname
  `);
  const [collations] = await query('SELECT count(*)::int AS collation_count FROM pg_collation');

  const result = {
    generated_at: new Date().toISOString(),
    database_service: 'Postgres-j9Pi',
    server_version: version.version,
    server_version_num: version.server_version_num,
    schema_summary: {
      table_count: tables.table_count,
      index_count: indexes.index_count,
      constraint_count: constraints.constraint_count,
      sequence_count: sequences.sequence_count,
      migration_rows: latest.migration_rows,
      latest_migration: latest.latest_migration,
      migration_ledger_hash: createHash('sha256').update(JSON.stringify(ledger)).digest('hex'),
    },
    extensions,
    collation_count: collations.collation_count,
    external_mutations: {
      production_database: false,
      railway: false,
      providers: false,
      sends: false,
    },
  };

  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
