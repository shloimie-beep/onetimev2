import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { runMigrations } from '../../../packages/db/src/index.ts';
import {
  BASELINE_MIGRATION_ID,
  BRANCH_NAME,
  CANONICAL_STARTING_COMMIT,
  TARGET_MIGRATION_IDS,
  buildReport,
  buildTransitionPlan,
  discoverMigrationInventory,
  parseTargetsFromEnv,
  renderCompatibilityMatrix,
  renderFinalReport,
  renderForwardRollbackPlan,
  renderResume,
  renderStagingRunbook,
  renderState,
  sha256,
  type MigrationInventoryItem,
  type ObjectiveStatus,
  type ParsedTarget,
  type PgTargetResult,
  type ScenarioResult,
} from './rehearsal-model.ts';

type VersionRow = {
  version: string;
  server_version_num: string;
};

type LedgerRow = {
  id: string;
  checksum: string;
};

type PgContext = {
  databaseName: string;
  connectionString: string;
  pool: pg.Pool;
};

const OUTPUT_DIR = path.resolve('ops/codex-runs/W12-100-05');
const MIGRATIONS_DIR = path.resolve('packages/db/migrations');
const LOCK_TIMEOUT_MS = 150;
const APP_STARTUP_TIMEOUT_MS = 8_000;

async function main() {
  const generatedAt = new Date().toISOString();
  const inventory = await discoverMigrationInventory(process.cwd(), MIGRATIONS_DIR);
  const transitionPlan = buildTransitionPlan(inventory);
  const targets = parseTargetsFromEnv(process.env);
  const environmentBlockers = await collectEnvironmentBlockers(targets);
  const targetResults: PgTargetResult[] = [];

  for (const target of targets) {
    targetResults.push(await runTarget(target, inventory));
  }

  const report = buildReport({
    generatedAt,
    nodeVersion: process.version,
    dockerAvailable: await commandAvailable('docker'),
    nativePostgresToolsAvailable:
      (await commandAvailable('pg_dump')) && (await commandAvailable('pg_restore')),
    targets,
    environmentBlockers,
    inventory,
    transitionPlan,
    targetResults,
  });

  await writeArtifacts(report);

  const hasHardTargetFailure = targetResults.some(
    (target) => target.status === 'blocked' && target.scenarios.length > 0,
  );
  const allowBlocked = process.argv.includes('--allow-blocked');
  if (hasHardTargetFailure && !allowBlocked) {
    process.exitCode = 1;
  }
  process.stdout.write(
    `W12-100-05 migration rehearsal wrote ${path.relative(process.cwd(), OUTPUT_DIR)} with ${
      report.objectives.filter((objective) => objective.status === 'blocked').length
    } blocked objective(s).\n`,
  );
}

async function collectEnvironmentBlockers(targets: ParsedTarget[]) {
  const blockers: string[] = [];
  if (targets.length === 0) {
    blockers.push(
      'No disposable PostgreSQL targets configured. Set W12_PG16_ADMIN_DATABASE_URL and W12_PG18_ADMIN_DATABASE_URL, or W12_POSTGRES_TARGETS_JSON, to run live PG16/PG18 rehearsal.',
    );
  }
  if (!(await commandAvailable('docker'))) {
    blockers.push(
      'Docker CLI is unavailable in this environment; local PostgreSQL containers cannot be started here.',
    );
  }
  if (!(await commandAvailable('pg_dump')) || !(await commandAvailable('pg_restore'))) {
    blockers.push(
      'Native pg_dump/pg_restore tools are unavailable; backup/restore clone can only run when PostgreSQL client tools are installed.',
    );
  }
  return blockers;
}

async function runTarget(
  target: ParsedTarget,
  inventory: MigrationInventoryItem[],
): Promise<PgTargetResult> {
  const scenarios: ScenarioResult[] = [];
  const blockers: string[] = [];
  let observedMajor: number | null = null;
  const adminPool = new pg.Pool(poolConfig(target.admin_database_url, target.database_ssl));
  const contexts: PgContext[] = [];

  try {
    const version = await readVersion(adminPool);
    observedMajor = Number(version.server_version_num.slice(0, -4));
    if (observedMajor !== target.expected_major) {
      throw new Error(
        `Expected PostgreSQL ${target.expected_major}, observed ${version.server_version_num}.`,
      );
    }

    const clean = await createDisposableDatabase(adminPool, target, 'clean');
    contexts.push(clean);
    scenarios.push(await runCleanScenario(clean.pool, inventory));
    scenarios.push(await runLockScenario(clean.pool));

    const upgrade = await createDisposableDatabase(adminPool, target, 'upgrade2190');
    contexts.push(upgrade);
    scenarios.push(await runUpgradeScenario(upgrade.pool, inventory));

    const failure = await createDisposableDatabase(adminPool, target, 'failure');
    contexts.push(failure);
    scenarios.push(await runTransactionalFailureScenario(failure.pool, inventory));

    const startupBaseline = await createDisposableDatabase(adminPool, target, 'startup2190');
    contexts.push(startupBaseline);
    const startupBaselineDir = await writeMigrationSubset(BASELINE_MIGRATION_ID, inventory);
    try {
      await runMigrations(startupBaseline.pool, startupBaselineDir);
    } finally {
      await rm(path.dirname(startupBaselineDir), { recursive: true, force: true });
    }

    scenarios.push(
      await runAppStartupScenario(startupBaseline.connectionString, clean.connectionString),
    );
    scenarios.push(await runBackupRestoreScenario(adminPool, target, clean, inventory));
  } catch (error) {
    blockers.push(safeError(error));
  } finally {
    for (const context of contexts.reverse()) {
      await context.pool.end().catch(() => undefined);
      await dropDisposableDatabase(adminPool, context.databaseName).catch(() => undefined);
    }
    await adminPool.end().catch(() => undefined);
  }

  return {
    label: target.label,
    expected_major: target.expected_major,
    observed_major: observedMajor,
    status:
      blockers.length === 0 && scenarios.every((scenario) => scenario.status === 'done')
        ? 'done'
        : 'blocked',
    scenarios,
    blockers,
  };
}

async function runCleanScenario(
  pool: pg.Pool,
  inventory: MigrationInventoryItem[],
): Promise<ScenarioResult> {
  const timings: Record<string, number> = {};
  const started = performance.now();
  const first = await runMigrations(pool);
  timings.first_apply_ms = elapsed(started);
  assertLatestApplied(first.map((result) => result.id));
  await assertLedgerMatches(pool, inventory);
  const schemaHashAfterFirst = await schemaHash(pool);
  const tableCountsAfterFirst = await tableCounts(pool);

  const repeatStarted = performance.now();
  const repeat = await runMigrations(pool);
  timings.repeat_verify_ms = elapsed(repeatStarted);
  if (!repeat.every((result) => result.status === 'already_applied')) {
    throw new Error('Repeat migration verification was not idempotent.');
  }
  const schemaHashAfterRepeat = await schemaHash(pool);
  if (schemaHashAfterFirst !== schemaHashAfterRepeat) {
    throw new Error('Schema hash changed after idempotent repeat verification.');
  }

  await assertForeignKeysValidated(pool);
  const indexCount = await countIndexes(pool);
  return scenario({
    id: 'clean_database_migration',
    timings_ms: timings,
    table_counts: tableCountsAfterFirst,
    schema_hash: schemaHashAfterRepeat,
    notes: [
      `applied_migrations=${first.length}`,
      `index_count=${indexCount}`,
      'checksum_verification=passed',
      'repeat_idempotence=passed',
      'foreign_key_ordering=validated',
      'index_creation_behavior=transactional_indexes_present',
    ],
  });
}

async function runUpgradeScenario(
  pool: pg.Pool,
  inventory: MigrationInventoryItem[],
): Promise<ScenarioResult> {
  const timings: Record<string, number> = {};
  const baselineDir = await writeMigrationSubset(BASELINE_MIGRATION_ID, inventory);
  try {
    const baselineStarted = performance.now();
    await runMigrations(pool, baselineDir);
    timings.apply_to_2190_ms = elapsed(baselineStarted);
    await seedTelegramCompatibilityRows(pool);

    const upgradeStarted = performance.now();
    const upgrade = await runMigrations(pool, MIGRATIONS_DIR);
    timings.apply_2200_2202_ms = elapsed(upgradeStarted);
    const applied = upgrade
      .filter((result) => result.status === 'applied')
      .map((result) => result.id);
    for (const id of TARGET_MIGRATION_IDS) {
      if (!applied.includes(id)) throw new Error(`Upgrade from 2190 did not apply ${id}.`);
    }
    await assertLedgerMatches(pool, inventory);
    await assertTelegramCompatibilityRows(pool);
    await assertForeignKeysValidated(pool);
    return scenario({
      id: 'upgrade_from_2190',
      timings_ms: timings,
      table_counts: await tableCounts(pool),
      schema_hash: await schemaHash(pool),
      notes: [
        'checksum_verification=passed',
        'constraint_compatibility=passed',
        'telegram_existing_row_compatibility=passed',
        'foreign_key_ordering=validated',
      ],
    });
  } finally {
    await rm(path.dirname(baselineDir), { recursive: true, force: true });
  }
}

async function runTransactionalFailureScenario(
  pool: pg.Pool,
  inventory: MigrationInventoryItem[],
): Promise<ScenarioResult> {
  await runMigrations(pool);
  const beforeHash = await schemaHash(pool);
  const failureDir = await writeFailureMigrationSet(inventory);
  const timings: Record<string, number> = {};
  try {
    const started = performance.now();
    try {
      await runMigrations(pool, failureDir);
      throw new Error('Forced failure migration unexpectedly succeeded.');
    } catch (error) {
      timings.forced_failure_ms = elapsed(started);
      if (!safeError(error).includes('w12_100_forced_failure')) {
        throw error;
      }
    }
    const marker = await pool.query(
      `SELECT to_regclass('onetime.w12_100_forced_failure_marker') AS marker`,
    );
    if (marker.rows[0]?.marker !== null) {
      throw new Error('Transactional failure left behind the marker table.');
    }
    const ledger = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.schema_migrations
        WHERE id = '2203_w12_100_forced_failure'`,
    );
    if (Number(ledger.rows[0]?.count ?? 0) !== 0) {
      throw new Error('Transactional failure inserted a ledger row.');
    }
    const afterHash = await schemaHash(pool);
    if (beforeHash !== afterHash) {
      throw new Error('Transactional failure changed the schema hash.');
    }
    return scenario({
      id: 'transactional_failure',
      timings_ms: timings,
      table_counts: await tableCounts(pool),
      schema_hash: afterHash,
      notes: ['forced_failure_rolled_back=true'],
    });
  } finally {
    await rm(path.dirname(failureDir), { recursive: true, force: true });
  }
}

async function runLockScenario(pool: pg.Pool): Promise<ScenarioResult> {
  const holder = await pool.connect();
  const waiter = await pool.connect();
  const timings: Record<string, number> = {};
  try {
    await holder.query('SELECT pg_advisory_lock(81227001)');
    await waiter.query(`SET lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
    const started = performance.now();
    let observed = 'unexpected';
    try {
      await waiter.query('BEGIN');
      await waiter.query('SELECT pg_advisory_xact_lock(81227001)');
      observed = 'acquired_without_wait';
    } catch (error) {
      observed = `blocked:${pgCode(error) ?? 'unknown'}`;
    } finally {
      await waiter.query('ROLLBACK').catch(() => undefined);
    }
    timings.lock_wait_ms = elapsed(started);
    if (!observed.includes('55P03')) {
      throw new Error(`Expected lock timeout 55P03, observed ${observed}.`);
    }
    return scenario({
      id: 'lock_acquisition_blocking',
      timings_ms: timings,
      table_counts: {},
      schema_hash: null,
      lock_observations: [
        'advisory_lock_key=81227001',
        `lock_timeout_ms=${LOCK_TIMEOUT_MS}`,
        `observed=${observed}`,
      ],
      notes: ['estimated_blocking=bounded_by_lock_timeout'],
    });
  } finally {
    await holder.query('SELECT pg_advisory_unlock(81227001)').catch(() => undefined);
    holder.release();
    waiter.release();
  }
}

async function runAppStartupScenario(
  baselineDatabaseUrl: string,
  migratedDatabaseUrl: string,
): Promise<ScenarioResult> {
  const timings: Record<string, number> = {};
  const webBefore = await probeWebStartup(baselineDatabaseUrl, 'before');
  timings.web_before_ready_ms = webBefore.elapsedMs;
  const webAfter = await probeWebStartup(migratedDatabaseUrl, 'after');
  timings.web_after_ready_ms = webAfter.elapsedMs;
  const workerStarted = performance.now();
  await runWorkerOnce(migratedDatabaseUrl);
  timings.worker_once_ms = elapsed(workerStarted);
  return scenario({
    id: 'app_startup_before_after',
    timings_ms: timings,
    table_counts: {},
    schema_hash: null,
    notes: [
      `web_before=${webBefore.status}`,
      `web_after=${webAfter.status}`,
      'rolling_web_worker_compatibility=provider_off_sink_worker_once',
    ],
  });
}

async function runBackupRestoreScenario(
  adminPool: pg.Pool,
  target: ParsedTarget,
  source: PgContext,
  inventory: MigrationInventoryItem[],
): Promise<ScenarioResult> {
  if (!(await commandAvailable('pg_dump')) || !(await commandAvailable('pg_restore'))) {
    return scenario({
      id: 'backup_restore_clone',
      status: 'blocked',
      timings_ms: {},
      table_counts: {},
      schema_hash: null,
      notes: ['pg_dump_or_pg_restore_unavailable'],
    });
  }
  const dumpPath = path.join(os.tmpdir(), `w12-100-${source.databaseName}.dump`);
  const clone = await createDisposableDatabase(adminPool, target, 'restore');
  const timings: Record<string, number> = {};
  try {
    let started = performance.now();
    await execFileChecked('pg_dump', [
      '--format=custom',
      '--file',
      dumpPath,
      source.connectionString,
    ]);
    timings.pg_dump_ms = elapsed(started);
    started = performance.now();
    await execFileChecked('pg_restore', ['--dbname', clone.connectionString, dumpPath]);
    timings.pg_restore_ms = elapsed(started);
    await assertLedgerMatches(clone.pool, inventory);
    return scenario({
      id: 'backup_restore_clone',
      timings_ms: timings,
      table_counts: await tableCounts(clone.pool),
      schema_hash: await schemaHash(clone.pool),
      notes: ['restore_checksum_verification=passed'],
    });
  } finally {
    await rm(dumpPath, { force: true }).catch(() => undefined);
    await clone.pool.end().catch(() => undefined);
    await dropDisposableDatabase(adminPool, clone.databaseName).catch(() => undefined);
  }
}

async function writeArtifacts(report: Awaited<ReturnType<typeof buildReport>>) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, 'MIGRATION-REHEARSAL.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    path.join(OUTPUT_DIR, 'COMPATIBILITY-MATRIX.md'),
    renderCompatibilityMatrix(report),
  );
  await writeFile(
    path.join(OUTPUT_DIR, 'STAGING-MIGRATION-RUNBOOK.md'),
    renderStagingRunbook(report),
  );
  await writeFile(
    path.join(OUTPUT_DIR, 'FORWARD-ROLLBACK-PLAN.md'),
    renderForwardRollbackPlan(report),
  );
  await writeFile(path.join(OUTPUT_DIR, 'FINAL-REPORT.md'), renderFinalReport(report));
  await writeFile(path.join(OUTPUT_DIR, 'RESUME.md'), renderResume(report));
  await writeFile(path.join(OUTPUT_DIR, 'STATE.json'), renderState(report));
  await writeFile(
    path.join(OUTPUT_DIR, 'ORIGINAL-PROMPT.md'),
    [
      '# W12-100-05 Original Prompt',
      '',
      'The operator prompt for this lane is preserved in the Codex task transcript. This artifact records the stable lane identifiers used for execution.',
      '',
      `- Lane ID: ${report.lane_id}`,
      `- Branch: ${BRANCH_NAME}`,
      `- Canonical starting commit: ${CANONICAL_STARTING_COMMIT}`,
      '- Exclusive ownership: scripts/w12-100/postgres/**, tests/integration/w12-100-postgres/**, ops/codex-runs/W12-100-05/**',
      '- Required target migrations: 2200_w12_02_communication_history.sql, 2201_w12_01_crm_audience_import.sql, 2202_w12_05_telegram_operations.sql',
      '',
    ].join('\n'),
  );
}

async function readVersion(pool: pg.Pool) {
  const result = await pool.query<VersionRow>(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Unable to read PostgreSQL version.');
  return row;
}

async function createDisposableDatabase(
  adminPool: pg.Pool,
  target: ParsedTarget,
  label: string,
): Promise<PgContext> {
  const databaseName = `w12_100_05_${target.expected_major}_${label.toLowerCase()}_${Date.now()}_${randomBytes(3).toString('hex')}`;
  await adminPool.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
  const connectionString = databaseUrlFor(target.admin_database_url, databaseName);
  const pool = new pg.Pool(poolConfig(connectionString, target.database_ssl));
  return { databaseName, connectionString, pool };
}

async function dropDisposableDatabase(adminPool: pg.Pool, databaseName: string) {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdent(databaseName)}`);
}

async function assertLedgerMatches(pool: pg.Pool, inventory: MigrationInventoryItem[]) {
  const expected = new Map(inventory.map((item) => [item.id, item.sha256]));
  const result = await pool.query<LedgerRow>(
    `SELECT id, checksum FROM onetime.schema_migrations ORDER BY id`,
  );
  if (result.rows.length !== inventory.length) {
    throw new Error(
      `Migration ledger row count ${result.rows.length} did not match repository count ${inventory.length}.`,
    );
  }
  for (const row of result.rows) {
    if (expected.get(row.id) !== row.checksum) {
      throw new Error(`Migration checksum mismatch for ${row.id}.`);
    }
  }
}

async function assertForeignKeysValidated(pool: pg.Pool) {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'onetime'::regnamespace
        AND convalidated = false`,
  );
  if (Number(result.rows[0]?.count ?? 0) !== 0) {
    throw new Error('One or more onetime foreign keys are not validated.');
  }
}

async function seedTelegramCompatibilityRows(pool: pg.Pool) {
  await pool.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role, password_hash)
     VALUES
       ('w12_100_user','one_time','one_time_mishnah_class','w12-100@example.test','W12 Synthetic User','owner','hash')`,
  );
  await pool.query(
    `INSERT INTO onetime.telegram_bot_registry
       (bot_key, environment, account_key, product_key, token_fingerprint_hash, status)
     VALUES
       ('one_time_internal_ops','local','one_time','one_time_mishnah_class',$1,'active')`,
    ['f'.repeat(64)],
  );
  await pool.query(
    `INSERT INTO onetime.telegram_command_executions
       (execution_key, bot_key, environment, account_key, product_key, actor_user_key,
        capability, idempotency_key, action_digest, status)
     VALUES
       ('w12_100_existing_execution','one_time_internal_ops','local','one_time',
        'one_time_mishnah_class','w12_100_user','task.create','w12_100_existing_idem',
        'w12_100_existing_digest','completed')`,
  );
  await pool.query(
    `INSERT INTO onetime.telegram_confirmations
       (confirmation_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
        actor_user_key, account_key, product_key, capability, action_digest, security_version,
        idempotency_key, payload_ciphertext, payload_digest, payload_classification, expires_at)
     VALUES
       ('w12_100_existing_confirmation','one_time_internal_ops','local',$1,$2,
        'w12_100_user','one_time','one_time_mishnah_class','task.create',
        'w12_100_existing_confirmation_digest',1,'w12_100_confirmation_idem',
        'ciphertext',$3,'confirmation_payload','2026-08-01T00:00:00Z')`,
    ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
  );
}

async function assertTelegramCompatibilityRows(pool: pg.Pool) {
  const existing = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM onetime.telegram_command_executions WHERE execution_key = 'w12_100_existing_execution') AS executions,
       (SELECT count(*)::int FROM onetime.telegram_confirmations WHERE confirmation_key = 'w12_100_existing_confirmation') AS confirmations`,
  );
  if (
    Number(existing.rows[0]?.executions ?? 0) !== 1 ||
    Number(existing.rows[0]?.confirmations ?? 0) !== 1
  ) {
    throw new Error('Existing Telegram compatibility rows were not preserved.');
  }
  await pool.query(
    `INSERT INTO onetime.telegram_command_executions
       (execution_key, bot_key, environment, account_key, product_key, actor_user_key,
        capability, idempotency_key, action_digest, status)
     VALUES
       ('w12_100_delivery_retry_execution','one_time_internal_ops','local','one_time',
        'one_time_mishnah_class','w12_100_user','delivery.retry','w12_100_retry_idem',
        'w12_100_retry_digest','completed'),
       ('w12_100_app_link_execution','one_time_internal_ops','local','one_time',
        'one_time_mishnah_class','w12_100_user','app.link.open','w12_100_link_idem',
        'w12_100_link_digest','completed')`,
  );
  await pool.query(
    `INSERT INTO onetime.telegram_confirmations
       (confirmation_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
        actor_user_key, account_key, product_key, capability, source, risk_class,
        action_digest, security_version, idempotency_key, payload_ciphertext, payload_digest,
        payload_classification, expires_at)
     VALUES
       ('w12_100_delivery_retry_confirmation','one_time_internal_ops','local',$1,$2,
        'w12_100_user','one_time','one_time_mishnah_class','delivery.retry','callback','R1',
        'w12_100_retry_confirmation_digest',1,'w12_100_retry_confirmation_idem',
        'ciphertext',$3,'confirmation_payload','2026-08-01T00:00:00Z')`,
    ['d'.repeat(64), 'e'.repeat(64), 'f'.repeat(64)],
  );
}

async function schemaHash(pool: pg.Pool) {
  const result = await pool.query(
    `WITH columns AS (
       SELECT 'column' AS kind, table_schema, table_name, column_name AS name,
              data_type AS detail, is_nullable, column_default, ordinal_position::text AS extra
         FROM information_schema.columns
        WHERE table_schema = 'onetime'
      ),
      constraints AS (
       SELECT 'constraint' AS kind, n.nspname AS table_schema, c.relname AS table_name,
              con.conname AS name, con.contype::text AS detail, con.convalidated::text AS is_nullable,
              pg_get_constraintdef(con.oid) AS column_default, '' AS extra
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = con.connamespace
        WHERE n.nspname = 'onetime'
      ),
      indexes AS (
       SELECT 'index' AS kind, schemaname AS table_schema, tablename AS table_name,
              indexname AS name, indexdef AS detail, '' AS is_nullable, '' AS column_default, '' AS extra
         FROM pg_indexes
        WHERE schemaname = 'onetime'
      )
      SELECT * FROM columns
      UNION ALL SELECT * FROM constraints
      UNION ALL SELECT * FROM indexes
      ORDER BY kind, table_schema, table_name, name, extra`,
  );
  return sha256(JSON.stringify(result.rows));
}

async function tableCounts(pool: pg.Pool) {
  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'onetime'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const counts: Record<string, number> = {};
  for (const row of tables.rows) {
    const result = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.${quoteIdent(row.table_name)}`,
    );
    counts[row.table_name] = Number(result.rows[0]?.count ?? 0);
  }
  return counts;
}

async function countIndexes(pool: pg.Pool) {
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname = 'onetime'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function writeMigrationSubset(maxMigrationId: string, inventory: MigrationInventoryItem[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'w12-100-baseline-'));
  const dir = path.join(root, 'migrations');
  await mkdir(dir, { recursive: true });
  for (const item of inventory) {
    if (item.id.localeCompare(maxMigrationId) > 0) continue;
    await copyFile(path.resolve(item.repo_path), path.join(dir, item.file_name));
  }
  return dir;
}

async function writeFailureMigrationSet(inventory: MigrationInventoryItem[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'w12-100-failure-'));
  const dir = path.join(root, 'migrations');
  await mkdir(dir, { recursive: true });
  for (const item of inventory) {
    await copyFile(path.resolve(item.repo_path), path.join(dir, item.file_name));
  }
  await writeFile(
    path.join(dir, '2203_w12_100_forced_failure.sql'),
    [
      'CREATE TABLE onetime.w12_100_forced_failure_marker (id integer PRIMARY KEY);',
      "SELECT 'w12_100_forced_failure'::integer;",
      '',
    ].join('\n'),
  );
  return dir;
}

async function probeWebStartup(databaseUrl: string, label: string) {
  const port = 35_000 + Math.floor(Math.random() * 10_000);
  const started = performance.now();
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/web/src/server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      RUN_MIGRATIONS_ON_STARTUP: 'false',
      OUTBOX_TRANSPORT_MODE: 'sink',
      DELIVERY_TRANSPORT_MODE: 'sink',
      PORT: String(port),
      PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
      APP_VERSION: `w12-100-${label}`,
      COMMIT_SHA: CANONICAL_STARTING_COMMIT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/health`, APP_STARTUP_TIMEOUT_MS);
    const ready = await fetch(`http://127.0.0.1:${port}/ready`);
    if (![200, 503].includes(ready.status)) {
      throw new Error(`Unexpected /ready status ${ready.status}.`);
    }
    return { status: `health_200_ready_${ready.status}`, elapsedMs: elapsed(started) };
  } finally {
    child.kill('SIGTERM');
  }
}

async function runWorkerOnce(databaseUrl: string) {
  await execFileChecked(
    process.execPath,
    ['--import', 'tsx', 'apps/worker/src/main/index.ts', '--once'],
    {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      OUTBOX_TRANSPORT_MODE: 'sink',
      DELIVERY_TRANSPORT_MODE: 'sink',
      APP_VERSION: 'w12-100-worker',
      COMMIT_SHA: CANONICAL_STARTING_COMMIT,
    },
  );
}

async function waitForHttp(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `status=${response.status}`;
    } catch (error) {
      lastError = safeError(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function execFileChecked(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

async function commandAvailable(command: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'where' : 'which', [command], {
      stdio: 'ignore',
    });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

function poolConfig(connectionString: string, databaseSsl: boolean): pg.PoolConfig {
  return {
    connectionString,
    ssl: databaseSsl ? { rejectUnauthorized: true } : undefined,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

function databaseUrlFor(adminDatabaseUrl: string, databaseName: string) {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function assertLatestApplied(ids: string[]) {
  for (const id of TARGET_MIGRATION_IDS) {
    if (!ids.includes(id)) throw new Error(`Clean migration did not apply ${id}.`);
  }
}

function scenario(input: {
  id: string;
  status?: ObjectiveStatus;
  timings_ms: Record<string, number>;
  table_counts: Record<string, number>;
  schema_hash: string | null;
  lock_observations?: string[];
  notes: string[];
}): ScenarioResult {
  const scenarioIds = splitScenarioId(input.id);
  return {
    id: input.id,
    status: input.status ?? 'done',
    timings_ms: input.timings_ms,
    table_counts: input.table_counts,
    schema_hash: input.schema_hash,
    lock_observations: input.lock_observations ?? [],
    notes: [...scenarioIds, ...input.notes],
  };
}

function splitScenarioId(id: string) {
  if (id === 'clean_database_migration') {
    return [
      'checksum_verification=covered',
      'repeat_idempotence=covered',
      'foreign_key_ordering=covered',
      'index_creation_behavior=covered',
    ];
  }
  if (id === 'upgrade_from_2190') {
    return ['constraint_compatibility=covered', 'telegram_existing_row_compatibility=covered'];
  }
  if (id === 'app_startup_before_after') {
    return ['rolling_web_worker_compatibility=covered'];
  }
  return [];
}

function elapsed(started: number) {
  return Math.round((performance.now() - started) * 100) / 100;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function pgCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : null;
}

await main();
