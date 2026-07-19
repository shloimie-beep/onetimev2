import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { runMigrations } from '../../../../packages/db/src/index.ts';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type MigrationFile = {
  id: string;
  file_name: string;
  checksum: string;
};

type Report = {
  schema_version: 'w13-101.pg16-migration-assurance.v1';
  generated_at: string;
  status: 'passed' | 'failed';
  environment: {
    node_version: string;
    postgres_server_version_num: string;
    railway_project_id_present: boolean;
    railway_environment_name: string | null;
    railway_service_name: string | null;
    used_tcp_proxy: boolean;
  };
  migrations: {
    local_count: number;
    latest_local_migration: string | null;
    contains_w13_100_gamification_2203: boolean;
    duplicate_numeric_prefixes: string[];
    first_run_applied_count: number;
    second_run_already_applied_count: number;
    ledger_count: number;
    latest_ledger_migration: string | null;
    ledger_matches_normalized_checksums: boolean;
    ledger_mismatch_ids: string[];
  };
  schema_checks: {
    gamification_tables_present: Record<string, boolean>;
  };
  disposable_databases: {
    created_count: number;
    dropped_count: number;
    remaining_w13_101_databases: number;
  };
  external_effects: {
    production_database: false;
    providers: false;
    sends: false;
    railway_deployment_or_config: false;
    nonproduction_disposable_database: true;
  };
};

const outputPath = path.resolve(
  process.env.W13_101_DB_ASSURANCE_OUT ??
    'ops/codex-runs/W13-101/evidence/pg16-migration-assurance.json',
);
const migrationsDir = path.resolve('packages/db/migrations');
const databasePrefix = `w13_101_pg16_${Date.now()}_${randomBytes(3).toString('hex')}`;

async function main() {
  const adminConfig = adminPoolConfigFromEnv();
  const adminPool = new pg.Pool(adminConfig);
  const createdDatabases: string[] = [];
  let droppedCount = 0;

  try {
    const version = await adminPool.query<{ server_version_num: string }>(
      "SELECT current_setting('server_version_num') AS server_version_num",
    );
    const databaseName = `${databasePrefix}_clean`;
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    createdDatabases.push(databaseName);

    const pool = new pg.Pool({
      ...adminConfig,
      database: databaseName,
      max: 10,
      connectionTimeoutMillis: 7_000,
      idleTimeoutMillis: 7_000,
      statement_timeout: 30_000,
    });

    let firstRun: Awaited<ReturnType<typeof runMigrations>> = [];
    let secondRun: Awaited<ReturnType<typeof runMigrations>> = [];
    let ledger: Array<{ id: string; checksum: string }> = [];
    const gamificationTables: Record<string, boolean> = {};
    try {
      firstRun = await runMigrations(pool);
      secondRun = await runMigrations(pool);
      const ledgerResult = await pool.query<{ id: string; checksum: string }>(
        'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id ASC',
      );
      ledger = ledgerResult.rows;

      for (const tableName of [
        'portal_parent_reward_goals',
        'portal_class_milestones',
        'portal_gamification_corrections',
      ]) {
        const result = await pool.query<{ table_name: string | null }>(
          'SELECT to_regclass($1) AS table_name',
          [`onetime.${tableName}`],
        );
        gamificationTables[tableName] = Boolean(result.rows[0]?.table_name);
      }
    } finally {
      await pool.end();
    }

    const migrationFiles = await discoverMigrationFiles();
    const checksumById = new Map(migrationFiles.map((file) => [file.id, file.checksum]));
    const ledgerMismatchIds = ledger
      .filter((row) => checksumById.get(row.id) !== row.checksum)
      .map((row) => row.id);
    const duplicateNumericPrefixes = duplicatePrefixes(migrationFiles);
    const report: Report = {
      schema_version: 'w13-101.pg16-migration-assurance.v1',
      generated_at: new Date().toISOString(),
      status:
        Number(version.rows[0]?.server_version_num ?? '0') >= 160000 &&
        firstRun.every((result) => result.status === 'applied') &&
        secondRun.every((result) => result.status === 'already_applied') &&
        ledger.length === migrationFiles.length &&
        ledgerMismatchIds.length === 0 &&
        duplicateNumericPrefixes.length === 0 &&
        Object.values(gamificationTables).every(Boolean)
          ? 'passed'
          : 'failed',
      environment: {
        node_version: process.version,
        postgres_server_version_num: String(version.rows[0]?.server_version_num ?? ''),
        railway_project_id_present: Boolean(process.env.RAILWAY_PROJECT_ID),
        railway_environment_name: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
        railway_service_name: process.env.RAILWAY_SERVICE_NAME ?? null,
        used_tcp_proxy: Boolean(process.env.W13_101_USED_RAILWAY_TCP_PROXY),
      },
      migrations: {
        local_count: migrationFiles.length,
        latest_local_migration: migrationFiles.at(-1)?.id ?? null,
        contains_w13_100_gamification_2203: migrationFiles.some(
          (file) => file.id === '2203_w13_100_student_gamification',
        ),
        duplicate_numeric_prefixes: duplicateNumericPrefixes,
        first_run_applied_count: firstRun.filter((result) => result.status === 'applied').length,
        second_run_already_applied_count: secondRun.filter(
          (result) => result.status === 'already_applied',
        ).length,
        ledger_count: ledger.length,
        latest_ledger_migration: ledger.at(-1)?.id ?? null,
        ledger_matches_normalized_checksums: ledgerMismatchIds.length === 0,
        ledger_mismatch_ids: ledgerMismatchIds,
      },
      schema_checks: {
        gamification_tables_present: gamificationTables,
      },
      disposable_databases: {
        created_count: createdDatabases.length,
        dropped_count: 0,
        remaining_w13_101_databases: 0,
      },
      external_effects: {
        production_database: false,
        providers: false,
        sends: false,
        railway_deployment_or_config: false,
        nonproduction_disposable_database: true,
      },
    };

    droppedCount = await dropCreatedDatabases(adminPool, createdDatabases);
    report.disposable_databases.dropped_count = droppedCount;
    report.disposable_databases.remaining_w13_101_databases =
      await remainingW13Databases(adminPool);
    await writeReport(report);
    process.stdout.write(`W13-101 PG16 migration assurance ${report.status}: ${outputPath}\n`);
    if (report.status !== 'passed') process.exitCode = 1;
  } finally {
    if (droppedCount < createdDatabases.length) {
      await dropCreatedDatabases(adminPool, createdDatabases).catch(() => undefined);
    }
    await adminPool.end();
  }
}

function adminPoolConfigFromEnv(): pg.PoolConfig {
  if (process.env.RAILWAY_TCP_PROXY_DOMAIN && process.env.RAILWAY_TCP_PROXY_PORT) {
    process.env.PGHOST = process.env.RAILWAY_TCP_PROXY_DOMAIN;
    process.env.PGPORT = process.env.RAILWAY_TCP_PROXY_PORT;
    process.env.W13_101_USED_RAILWAY_TCP_PROXY = 'true';
  }

  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    max: 8,
    connectionTimeoutMillis: 7_000,
    idleTimeoutMillis: 7_000,
    statement_timeout: 30_000,
  };
}

async function discoverMigrationFiles(): Promise<MigrationFile[]> {
  const fileNames = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  for (const fileName of fileNames) {
    const sql = await readFile(path.join(migrationsDir, fileName), 'utf8');
    files.push({
      id: fileName.replace(/\.sql$/, ''),
      file_name: fileName,
      checksum: sha256(sql.replace(/\r\n/g, '\n')),
    });
  }
  return files;
}

function duplicatePrefixes(files: MigrationFile[]) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const prefix = file.id.split('_')[0] ?? '';
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([prefix, count]) => /^\d+$/.test(prefix) && count > 1)
    .map(([prefix]) => prefix);
}

async function dropCreatedDatabases(adminPool: pg.Pool, databaseNames: string[]) {
  let dropped = 0;
  for (const databaseName of databaseNames) {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
    dropped += 1;
  }
  return dropped;
}

async function remainingW13Databases(adminPool: pg.Pool) {
  const result = await adminPool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM pg_database WHERE datname LIKE 'w13_101_pg16_%'",
  );
  return Number(result.rows[0]?.count ?? 0);
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeReport(report: Report) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath(outputPath), markdownReport(report), 'utf8');
}

function markdownPath(jsonPath: string) {
  return jsonPath.replace(/\.json$/, '.md');
}

function markdownReport(report: Report) {
  const tableRows = Object.entries(report.schema_checks.gamification_tables_present)
    .map(([name, present]) => `| ${name} | ${present} |`)
    .join('\n');
  return `# W13-101 PG16 Migration Assurance

Generated: ${report.generated_at}

Status: ${report.status}

- PostgreSQL server version num: ${report.environment.postgres_server_version_num}
- Railway environment: ${report.environment.railway_environment_name ?? 'unknown'}
- Railway service: ${report.environment.railway_service_name ?? 'unknown'}
- Used Railway TCP proxy: ${report.environment.used_tcp_proxy}
- Local migrations: ${report.migrations.local_count}
- Latest local migration: ${report.migrations.latest_local_migration ?? 'none'}
- First run applied count: ${report.migrations.first_run_applied_count}
- Second run already-applied count: ${report.migrations.second_run_already_applied_count}
- Ledger rows: ${report.migrations.ledger_count}
- Latest ledger migration: ${report.migrations.latest_ledger_migration ?? 'none'}
- Ledger matches normalized checksums: ${report.migrations.ledger_matches_normalized_checksums}
- Duplicate numeric prefixes: ${report.migrations.duplicate_numeric_prefixes.length}
- Disposable databases created: ${report.disposable_databases.created_count}
- Disposable databases dropped: ${report.disposable_databases.dropped_count}
- Remaining W13-101 disposable databases: ${report.disposable_databases.remaining_w13_101_databases}

| Gamification table | Present |
|---|---:|
${tableRows}

External effects: production_database=false, providers=false, sends=false, railway_deployment_or_config=false, nonproduction_disposable_database=true.
`;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}

main().catch(async (error: unknown) => {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const failed: Record<string, JsonValue> = {
    schema_version: 'w13-101.pg16-migration-assurance.v1',
    generated_at: new Date().toISOString(),
    status: 'failed',
    error_summary: safeError(error),
    external_effects: {
      production_database: false,
      providers: false,
      sends: false,
      railway_deployment_or_config: false,
    },
  };
  await writeFile(outputPath, `${JSON.stringify(failed, null, 2)}\n`, 'utf8');
  process.stderr.write(`W13-101 PG16 migration assurance failed: ${safeError(error)}\n`);
  process.exitCode = 1;
});
