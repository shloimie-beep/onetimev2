import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { runMigrations, verifyMigrations, type DbPool } from '../../packages/db/src/index.ts';

const outputPath = path.resolve(
  process.cwd(),
  'ops/evidence/a11/READ-ONLY-MIGRATION-VERIFICATION.json',
);

if (process.env.A11_ALLOW_DISPOSABLE_POSTGRES_WRITE !== 'true') {
  throw new Error('A11 disposable PostgreSQL proof requires its exact test-only authorization.');
}

const pool = new pg.Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'postgres',
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD,
  max: 6,
}) as DbPool;
const directory = await copyMigrationInventory();

try {
  const emptyBefore = await databaseSnapshot(pool);
  const missingLedger = await verifyMigrations(pool, directory);
  assert(
    missingLedger.status === 'invalid' &&
      missingLedger.issues.some((issue) => issue.code === 'MIGRATION_LEDGER_MISSING'),
    'missing ledger did not fail closed',
  );
  assertEqual(await databaseSnapshot(pool), emptyBefore, 'missing-ledger verify mutated database');

  const concurrent = await Promise.all([
    runMigrations(pool, directory),
    runMigrations(pool, directory),
  ]);
  assert(
    concurrent.some((results) => results.every((result) => result.status === 'applied')),
    'concurrent apply did not produce one applying worker',
  );
  assert(
    concurrent.some((results) => results.every((result) => result.status === 'already_applied')),
    'concurrent apply did not serialize the second worker',
  );

  const allAppliedBefore = await databaseSnapshot(pool);
  const allApplied = await verifyMigrations(pool, directory);
  assert(allApplied.ok && allApplied.pending_count === 0, 'fully applied ledger did not verify');
  assertEqual(
    await databaseSnapshot(pool),
    allAppliedBefore,
    'fully-applied verify mutated database',
  );

  await writeFile(
    path.join(directory, '9999_a11_pending_probe.sql'),
    'CREATE TABLE onetime.a11_pending_probe (id text PRIMARY KEY);\n',
    'utf8',
  );
  const pendingBefore = await databaseSnapshot(pool);
  const pending = await verifyMigrations(pool, directory);
  assert(
    pending.status === 'pending' &&
      pending.pending_count === 1 &&
      pending.issues.some((issue) => issue.code === 'PENDING_MIGRATIONS'),
    'pending migration did not fail closed',
  );
  assertEqual(await databaseSnapshot(pool), pendingBefore, 'pending verify mutated database');
  assert(
    !pendingBefore.tables.includes('a11_pending_probe'),
    'pending migration unexpectedly created its table',
  );

  const firstMigration = allAppliedBefore.ledger[0];
  assert(firstMigration, 'migration ledger was empty after apply');
  await pool.query('UPDATE onetime.schema_migrations SET checksum = $1 WHERE id = $2', [
    '0'.repeat(64),
    firstMigration.id,
  ]);
  const mismatchBefore = await databaseSnapshot(pool);
  const mismatch = await verifyMigrations(pool, directory);
  assert(
    mismatch.status === 'invalid' &&
      mismatch.issues.some((issue) => issue.code === 'MIGRATION_CHECKSUM_MISMATCH'),
    'checksum mismatch did not fail closed',
  );
  assertEqual(await databaseSnapshot(pool), mismatchBefore, 'checksum verify mutated database');

  const report = {
    schema_version: 'onetime.a11.read_only_migration_verification.v1',
    status: 'passed',
    postgres_major: 16,
    migration_file_count: allApplied.migration_file_count,
    checks: {
      missing_ledger_read_only: true,
      concurrent_apply_serialized: true,
      fully_applied_read_only: true,
      pending_migration_unapplied: true,
      schema_objects_unchanged_by_verify: true,
      ledger_rows_and_checksums_unchanged_by_verify: true,
      checksum_mismatch_failed: true,
    },
    evidence: {
      schema_object_count: allAppliedBefore.tables.length,
      ledger_row_count: allAppliedBefore.ledger.length,
      schema_fingerprint: allAppliedBefore.schemaFingerprint,
      ledger_fingerprint: allAppliedBefore.ledgerFingerprint,
    },
    external_effects: {
      disposable_postgresql_fixture: true,
      production_database: false,
      staging_database: false,
      deployment: false,
      providers: false,
      sends: false,
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await pool.end();
}

async function copyMigrationInventory() {
  const source = path.resolve(process.cwd(), 'packages/db/migrations');
  const target = await mkdtemp(path.join(os.tmpdir(), 'onetime-a11-migrations-'));
  const names = (await readdir(source)).filter((name) => name.endsWith('.sql'));
  await Promise.all(
    names.map((name) => copyFile(path.join(source, name), path.join(target, name))),
  );
  return target;
}

async function databaseSnapshot(targetPool: DbPool) {
  const tables = await targetPool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'onetime'
      ORDER BY table_name`,
  );
  const tableNames = tables.rows.map((row) => String(row.table_name));
  const hasLedger = tableNames.includes('schema_migrations');
  const ledger = hasLedger
    ? await targetPool.query('SELECT id, checksum FROM onetime.schema_migrations ORDER BY id')
    : { rows: [] };
  const ledgerRows = ledger.rows.map((row) => ({
    id: String(row.id),
    checksum: String(row.checksum),
  }));
  return {
    tables: tableNames,
    ledger: ledgerRows,
    schemaFingerprint: hash(JSON.stringify(tableNames)),
    ledgerFingerprint: hash(JSON.stringify(ledgerRows)),
  };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}
