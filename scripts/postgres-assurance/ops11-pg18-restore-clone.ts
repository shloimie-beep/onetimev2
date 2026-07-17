import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { runMigrations } from '../../packages/db/src/index.ts';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type Report = {
  generated_at: string;
  environment: {
    node_version: string;
    postgres_server_version: string;
    postgres_server_version_num: string;
    pg_dump_version: string;
    pg_restore_version: string;
  };
  dump: {
    format: 'custom';
    no_owner: true;
    no_acl: true;
    size_bytes: number;
    sha256: string;
    archive_list_entries: number;
  };
  restore: {
    source_database: string;
    restored_database: string;
    migration_rows_source: number;
    migration_rows_restored: number;
    latest_migration_source: string | null;
    latest_migration_restored: string | null;
    schema_summary_source: SchemaSummary;
    schema_summary_restored: SchemaSummary;
    restored_migrations_idempotent: boolean;
  };
  verdict: {
    status: 'passed';
    hard_failures: string[];
    external_mutations: {
      production_database: false;
      railway: false;
      providers: false;
      sends: false;
    };
  };
};

type SchemaSummary = {
  table_count: number;
  index_count: number;
  constraint_count: number;
  sequence_count: number;
  table_row_count_hash: string;
  migration_ledger_hash: string;
};

type DatabaseContext = {
  name: string;
  pool: pg.Pool;
  markTeardownStarted: () => void;
};

const OUTPUT_DIR = path.resolve(process.env.OPS11_PG18_OUTPUT_DIR ?? 'ops/evidence/ops-11/pg18');
const ADMIN_DB = process.env.PGDATABASE ?? 'postgres';

async function main() {
  const adminConfig = adminPoolConfigFromEnv();
  const adminPool = new pg.Pool(adminConfig);
  const dumpDir = path.join(
    os.tmpdir(),
    `ops11-pg18-${Date.now()}-${randomBytes(4).toString('hex')}`,
  );
  const dumpPath = path.join(dumpDir, 'ops11-pg18.dump');
  const contexts: DatabaseContext[] = [];

  try {
    await assertDockerAvailable();
    await mkdir(dumpDir, { recursive: true });
    const versions = await readVersions(adminPool);
    const source = await createDatabase(adminConfig, 'source');
    const restored = await createDatabase(adminConfig, 'restored');
    contexts.push(source, restored);

    const sourceMigration = await runMigrations(source.pool);
    if (!sourceMigration.some((result) => result.status === 'applied')) {
      throw new Error('Source database did not apply migrations from zero.');
    }

    await dumpDatabase(source.name, dumpDir);
    const archiveList = await listArchive(dumpDir);
    await restoreDatabase(restored.name, dumpDir);

    const sourceSummary = await schemaSummary(source.pool);
    const restoredSummary = await schemaSummary(restored.pool);
    assertEqualSummaries(sourceSummary, restoredSummary);

    const restoredMigration = await runMigrations(restored.pool);
    const restoredMigrationsIdempotent = restoredMigration.every(
      (result) => result.status === 'already_applied',
    );
    if (!restoredMigrationsIdempotent) {
      throw new Error('Restored clone migrations were not idempotent.');
    }

    const dumpStats = await stat(dumpPath);
    const sourceMigrationRows = await migrationLedger(source.pool);
    const restoredMigrationRows = await migrationLedger(restored.pool);
    const report: Report = {
      generated_at: new Date().toISOString(),
      environment: versions,
      dump: {
        format: 'custom',
        no_owner: true,
        no_acl: true,
        size_bytes: dumpStats.size,
        sha256: await fileSha256(dumpPath),
        archive_list_entries: archiveList.split(/\r?\n/).filter(Boolean).length,
      },
      restore: {
        source_database: source.name,
        restored_database: restored.name,
        migration_rows_source: sourceMigrationRows.count,
        migration_rows_restored: restoredMigrationRows.count,
        latest_migration_source: sourceMigrationRows.latest,
        latest_migration_restored: restoredMigrationRows.latest,
        schema_summary_source: sourceSummary,
        schema_summary_restored: restoredSummary,
        restored_migrations_idempotent: restoredMigrationsIdempotent,
      },
      verdict: {
        status: 'passed',
        hard_failures: [],
        external_mutations: {
          production_database: false,
          railway: false,
          providers: false,
          sends: false,
        },
      },
    };
    await writeReports(report);
    process.stdout.write('OPS-11 PostgreSQL 18 restore-clone smoke passed.\n');
  } finally {
    for (const context of contexts.reverse()) {
      context.markTeardownStarted();
      await context.pool.end();
      await dropDatabase(adminPool, context.name);
    }
    await adminPool.end();
    await rm(dumpDir, { recursive: true, force: true });
  }
}

function adminPoolConfigFromEnv(): pg.PoolConfig {
  const port = Number(process.env.PGPORT ?? 5432);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PGPORT must be a positive integer.');
  }
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port,
    database: ADMIN_DB,
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

async function assertDockerAvailable() {
  const result = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Docker is required for official PostgreSQL 18 client tools: ${result.stderr}`);
  }
}

async function readVersions(adminPool: pg.Pool): Promise<Report['environment']> {
  const server = await adminPool.query<{ version: string; server_version_num: string }>(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  const row = server.rows[0];
  if (!row) throw new Error('Unable to read PostgreSQL server version.');
  return {
    node_version: process.version,
    postgres_server_version: row.version,
    postgres_server_version_num: row.server_version_num,
    pg_dump_version: runPostgresClient(['pg_dump', '--version']).trim(),
    pg_restore_version: runPostgresClient(['pg_restore', '--version']).trim(),
  };
}

async function createDatabase(
  adminConfig: pg.PoolConfig,
  label: 'source' | 'restored',
): Promise<DatabaseContext> {
  const name = `ops11_pg18_${label}_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const adminPool = new pg.Pool(adminConfig);
  try {
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
  } finally {
    await adminPool.end();
  }
  let teardownStarted = false;
  const pool = new pg.Pool({
    ...adminConfig,
    database: name,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  pool.on('error', (error: unknown) => {
    if (teardownStarted && pgCode(error) === '57P01') return;
    process.stderr.write(`OPS-11 PostgreSQL 18 pool error (${name}): ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });

  return {
    name,
    pool,
    markTeardownStarted: () => {
      teardownStarted = true;
    },
  };
}

async function dropDatabase(adminPool: pg.Pool, databaseName: string) {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
}

async function dumpDatabase(databaseName: string, dumpDir: string) {
  runPostgresClient(
    [
      'pg_dump',
      '-h',
      process.env.PGHOST ?? '127.0.0.1',
      '-p',
      String(process.env.PGPORT ?? 5432),
      '-U',
      process.env.PGUSER ?? 'postgres',
      '-d',
      databaseName,
      '-Fc',
      '--no-owner',
      '--no-acl',
      '-f',
      '/backup/ops11-pg18.dump',
    ],
    dumpDir,
  );
}

async function listArchive(dumpDir: string) {
  return runPostgresClient(['pg_restore', '-l', '/backup/ops11-pg18.dump'], dumpDir);
}

async function restoreDatabase(databaseName: string, dumpDir: string) {
  runPostgresClient(
    [
      'pg_restore',
      '-h',
      process.env.PGHOST ?? '127.0.0.1',
      '-p',
      String(process.env.PGPORT ?? 5432),
      '-U',
      process.env.PGUSER ?? 'postgres',
      '-d',
      databaseName,
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '/backup/ops11-pg18.dump',
    ],
    dumpDir,
  );
}

function runPostgresClient(args: string[], dumpDir?: string) {
  const dockerArgs = ['run', '--rm', '--network', 'host'];
  if (process.env.PGPASSWORD) {
    dockerArgs.push('-e', 'PGPASSWORD');
  }
  if (dumpDir) {
    dockerArgs.push('-v', `${dumpDir}:/backup`);
  }
  dockerArgs.push('postgres:18', ...args);
  const result = spawnSync('docker', dockerArgs, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD ?? '',
    },
  });
  if (result.status !== 0) {
    throw new Error(`${args[0]} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function schemaSummary(pool: pg.Pool): Promise<SchemaSummary> {
  const [tables, indexes, constraints, sequences, rowCounts, ledger] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT count(*)::text
         FROM information_schema.tables
        WHERE table_schema = 'onetime'
          AND table_type = 'BASE TABLE'`,
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text
         FROM pg_indexes
        WHERE schemaname = 'onetime'`,
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text
         FROM information_schema.table_constraints
        WHERE table_schema = 'onetime'`,
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text
         FROM information_schema.sequences
        WHERE sequence_schema = 'onetime'`,
    ),
    tableRowCounts(pool),
    pool.query<{ id: string; checksum: string }>(
      'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id',
    ),
  ]);

  return {
    table_count: numberFromCount(tables.rows[0]?.count),
    index_count: numberFromCount(indexes.rows[0]?.count),
    constraint_count: numberFromCount(constraints.rows[0]?.count),
    sequence_count: numberFromCount(sequences.rows[0]?.count),
    table_row_count_hash: sha256Json(rowCounts),
    migration_ledger_hash: sha256Json(ledger.rows),
  };
}

async function tableRowCounts(pool: pg.Pool) {
  const tableNames = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'onetime'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const counts: Record<string, number> = {};
  for (const row of tableNames.rows) {
    const table = row.table_name;
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM onetime.${quoteIdentifier(table)}`,
    );
    counts[table] = numberFromCount(result.rows[0]?.count);
  }
  return counts;
}

async function migrationLedger(pool: pg.Pool) {
  const result = await pool.query<{ count: string; latest: string | null }>(
    'SELECT count(*)::text AS count, max(id) AS latest FROM onetime.schema_migrations',
  );
  return {
    count: numberFromCount(result.rows[0]?.count),
    latest: result.rows[0]?.latest ?? null,
  };
}

function assertEqualSummaries(source: SchemaSummary, restored: SchemaSummary) {
  if (JSON.stringify(source) !== JSON.stringify(restored)) {
    throw new Error('Restored clone schema summary does not match source summary.');
  }
}

async function fileSha256(filePath: string) {
  const { readFile } = await import('node:fs/promises');
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

async function writeReports(report: Report) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, 'pg18-restore-clone-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(OUTPUT_DIR, 'pg18-restore-clone-report.md'), markdownReport(report));
}

function markdownReport(report: Report) {
  return `# OPS-11 PostgreSQL 18 Restore Clone

Generated: ${report.generated_at}

PostgreSQL server: ${report.environment.postgres_server_version}

pg_dump: ${report.environment.pg_dump_version}

pg_restore: ${report.environment.pg_restore_version}

## Dump

- Format: custom
- No owner: ${report.dump.no_owner}
- No ACL: ${report.dump.no_acl}
- Size bytes: ${report.dump.size_bytes}
- SHA-256: ${report.dump.sha256}
- Archive list entries: ${report.dump.archive_list_entries}

## Restore Verification

- Source database: ${report.restore.source_database}
- Restored database: ${report.restore.restored_database}
- Migration rows source: ${report.restore.migration_rows_source}
- Migration rows restored: ${report.restore.migration_rows_restored}
- Latest migration source: ${report.restore.latest_migration_source}
- Latest migration restored: ${report.restore.latest_migration_restored}
- Restored migrations idempotent: ${report.restore.restored_migrations_idempotent}
- Source row-count hash: ${report.restore.schema_summary_source.table_row_count_hash}
- Restored row-count hash: ${report.restore.schema_summary_restored.table_row_count_hash}
- Source migration-ledger hash: ${report.restore.schema_summary_source.migration_ledger_hash}
- Restored migration-ledger hash: ${report.restore.schema_summary_restored.migration_ledger_hash}

External mutations: production_database=false, Railway=false, providers=false, sends=false.
`;
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function numberFromCount(value: string | undefined) {
  const parsed = Number(value ?? '0');
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid count: ${value}`);
  }
  return parsed;
}

function sha256Json(value: JsonValue) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pgCode(error: unknown) {
  return isRecord(error) && typeof error.code === 'string' ? error.code : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

main().catch((error: unknown) => {
  process.stderr.write(`OPS-11 PostgreSQL 18 restore-clone smoke failed: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
