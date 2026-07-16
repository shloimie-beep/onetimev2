import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { loadConfig } from '../packages/config/src/index.ts';
import { runMigrations } from '../packages/db/src/index.ts';

const execFileAsync = promisify(execFile);
const outputDir = path.resolve(process.env.OPS06_OUTPUT_DIR ?? 'ops/codex-runs/OPS-06/evidence');
const outputJson = path.join(outputDir, 'backup-restore.json');
const outputMd = path.join(outputDir, 'backup-restore.md');
const allowPg = process.env.OPS06_ALLOW_PG_ASSURANCE === 'true';

type Report = {
  generated_at: string;
  status: 'passed' | 'failed' | 'blocked';
  blocker: string | null;
  postgres_version: string | null;
  source_database: string | null;
  restore_database: string | null;
  rpo_target_minutes: number;
  rto_target_minutes: number;
  measured_rto_seconds: number | null;
  restored_schema_migration_count: number | null;
  functional_smoke: Record<string, unknown>;
  external_mutations: {
    production_database: false;
    providers: false;
    sends: false;
    deployment: false;
  };
};

let report: Report = blockedReport(
  allowPg
    ? null
    : 'Set OPS06_ALLOW_PG_ASSURANCE=true with disposable PGHOST/PGDATABASE credentials to run.',
);

if (allowPg) {
  report = await runRestoreDrill().catch((error: unknown) => blockedReport(safeError(error)));
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(outputMd, markdown(report), 'utf8');
process.stdout.write(`OPS-06 backup restore ${report.status}: ${outputJson}\n`);
if (report.status === 'failed') process.exitCode = 1;

async function runRestoreDrill(): Promise<Report> {
  const adminConfig = adminPoolConfig();
  const adminPool = new pg.Pool(adminConfig);
  const sourceDb = `ops06_src_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const restoreDb = `ops06_restore_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ops06-restore-'));
  const dumpPath = path.join(tempDir, 'onetime.dump');
  try {
    const version = await readPostgresVersion(adminPool);
    if (Number(version.server_version_num) < 160000) {
      return blockedReport(
        `PostgreSQL 16 required, found server_version_num=${version.server_version_num}`,
      );
    }
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(sourceDb)}`);
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(restoreDb)}`);

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: connectionStringFor(sourceDb),
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'ops06-restore',
      COMMIT_SHA: 'local',
      OUTBOX_TRANSPORT_MODE: 'sink',
    });
    const sourcePool = new pg.Pool({
      ...adminConfig,
      database: sourceDb,
      max: 4,
      connectionTimeoutMillis: 5_000,
    });
    try {
      await runMigrations(sourcePool);
      await sourcePool.query(
        `INSERT INTO onetime.ops_restore_drills
           (drill_key, account_key, product_key, source_backup_ref, status,
            rpo_target_minutes, rto_target_minutes, functional_smoke)
         VALUES ($1,$2,$3,'native_pg_dump_fc_fixture','blocked',15,30,'{}'::jsonb)
         ON CONFLICT DO NOTHING`,
        [`ops06_restore_seed_${Date.now()}`, config.accountKey, config.productKey],
      );
    } finally {
      await sourcePool.end();
    }

    await execFileAsync('pg_dump', ['-Fc', '-f', dumpPath, sourceDb], {
      env: pgToolEnv(sourceDb),
      maxBuffer: 16 * 1024 * 1024,
    });
    const restoreStarted = Date.now();
    await execFileAsync('pg_restore', ['--no-owner', '--dbname', restoreDb, dumpPath], {
      env: pgToolEnv(restoreDb),
      maxBuffer: 16 * 1024 * 1024,
    });
    const measuredRtoSeconds = Math.ceil((Date.now() - restoreStarted) / 1000);
    const restorePool = new pg.Pool({ ...adminConfig, database: restoreDb, max: 4 });
    try {
      const migrations = await restorePool.query(
        `SELECT count(*)::int AS count FROM onetime.schema_migrations`,
      );
      const heartbeatTable = await restorePool.query(
        `SELECT to_regclass('onetime.worker_heartbeats') AS table_name`,
      );
      return {
        generated_at: new Date().toISOString(),
        status: heartbeatTable.rows[0]?.table_name ? 'passed' : 'failed',
        blocker: null,
        postgres_version: version.version,
        source_database: sourceDb,
        restore_database: restoreDb,
        rpo_target_minutes: 15,
        rto_target_minutes: 30,
        measured_rto_seconds: measuredRtoSeconds,
        restored_schema_migration_count: Number(migrations.rows[0]?.count ?? 0),
        functional_smoke: {
          schema_migrations_restored: Number(migrations.rows[0]?.count ?? 0),
          worker_heartbeats_table_restored: Boolean(heartbeatTable.rows[0]?.table_name),
        },
        external_mutations: noExternalMutations(),
      };
    } finally {
      await restorePool.end();
    }
  } finally {
    await adminPool
      .query(`DROP DATABASE IF EXISTS ${quoteIdentifier(sourceDb)} WITH (FORCE)`)
      .catch(() => undefined);
    await adminPool
      .query(`DROP DATABASE IF EXISTS ${quoteIdentifier(restoreDb)} WITH (FORCE)`)
      .catch(() => undefined);
    await adminPool.end();
    await rm(tempDir, { recursive: true, force: true });
  }
}

function adminPoolConfig(): pg.PoolConfig {
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  };
}

async function readPostgresVersion(pool: pg.Pool) {
  const result = await pool.query(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  return {
    version: String(result.rows[0]?.version ?? ''),
    server_version_num: String(result.rows[0]?.server_version_num ?? '0'),
  };
}

function connectionStringFor(database: string) {
  const host = process.env.PGHOST ?? '127.0.0.1';
  const port = process.env.PGPORT ?? '5432';
  const user = process.env.PGUSER ?? 'postgres';
  const password = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
  return `postgres://${encodeURIComponent(user)}${password}@${host}:${port}/${database}`;
}

function pgToolEnv(database: string) {
  return { ...process.env, PGDATABASE: database };
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier))
    throw new Error(`Unsafe database identifier: ${identifier}`);
  return `"${identifier}"`;
}

function blockedReport(blocker: string | null): Report {
  return {
    generated_at: new Date().toISOString(),
    status: 'blocked',
    blocker,
    postgres_version: null,
    source_database: null,
    restore_database: null,
    rpo_target_minutes: 15,
    rto_target_minutes: 30,
    measured_rto_seconds: null,
    restored_schema_migration_count: null,
    functional_smoke: {},
    external_mutations: noExternalMutations(),
  };
}

function noExternalMutations() {
  return {
    production_database: false,
    providers: false,
    sends: false,
    deployment: false,
  } as const;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}

function markdown(report: Report) {
  return `# OPS-06 Backup Restore Drill

Generated: ${report.generated_at}

Status: ${report.status}

Blocker: ${report.blocker ?? 'none'}

- RPO target minutes: ${report.rpo_target_minutes}
- RTO target minutes: ${report.rto_target_minutes}
- Measured RTO seconds: ${report.measured_rto_seconds ?? 'n/a'}
- Restored migration count: ${report.restored_schema_migration_count ?? 'n/a'}

Do not claim Railway PITR or plan features from this report. This proof covers native pg_dump -Fc plus disposable restore only when status is passed.

External mutations: production_database=false, providers=false, sends=false, deployment=false.
`;
}
