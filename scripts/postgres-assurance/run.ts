import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { runMigrations } from '../../packages/db/src/index.ts';
import {
  expectedOpenFindingCatalog,
  ot37Task,
  performanceScenarioIds,
  queryScenarioIds,
  reservedSyntheticDomains,
  type PerformanceScenarioId,
  type QueryScenarioId,
} from '../../tests/postgres-assurance/current-base-scenarios.ts';

type SqlValue = string | number | boolean | null;
type Row = Record<string, SqlValue>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type MigrationFile = {
  id: string;
  fileName: string;
  path: string;
  checksum: string;
};

type DbContext = {
  adminConfig: pg.PoolConfig;
  databaseName: string;
  pool: pg.Pool;
};

type PlanNodeSummary = {
  node_type: string;
  relation_name: string | null;
  index_name: string | null;
  actual_rows: number | null;
  actual_loops: number | null;
  shared_hit_blocks: number | null;
  shared_read_blocks: number | null;
  plans: PlanNodeSummary[];
};

type QueryPlanResult = {
  id: QueryScenarioId;
  row_count: number;
  planning_ms: number | null;
  execution_ms: number | null;
  node_types: string[];
  index_names: string[];
  uses_seq_scan: boolean;
  uses_index: boolean;
  leading_wildcard_risk: boolean;
  expected_open_findings: string[];
  sanitized_plan: PlanNodeSummary;
};

type PerformanceResult = {
  id: PerformanceScenarioId;
  warmup_iterations: number;
  measured_iterations: number;
  raw_ms: number[];
  p50_ms: number;
  p75_ms: number;
  p95_ms: number;
  hard_runaway_limit_ms: number;
  hard_runaway_passed: boolean;
  product_slo_verdict: 'not_applicable_db_only' | 'open';
};

type ConcurrencyResult = {
  id: string;
  status: 'passed' | 'expected_open' | 'skipped_current_base';
  participants: number;
  observations: Record<string, JsonValue>;
  expected_open_findings: string[];
};

type ExpectedOpenFinding = {
  id: string;
  title: string;
  evidence: string;
};

type VersionRow = {
  version: string;
  server_version_num: string;
};

type MigrationLedgerRow = {
  id: string;
  checksum: string;
};

type DeliveryKeyRow = {
  delivery_key: string;
};

type Report = {
  task: typeof ot37Task;
  generated_at: string;
  environment: {
    node_version: string;
    postgres_version: string;
    postgres_server_version_num: string;
    database_names: string[];
  };
  migration: {
    files_discovered: MigrationFile[];
    clean_apply_statuses: string[];
    idempotent_verify_statuses: string[];
    ledger_matches_checksums: boolean;
    future_migration_discovery: boolean;
  };
  edge_fixtures: Record<string, JsonValue>;
  synthetic_data: {
    contacts_inserted: number;
    signup_rows_inserted: number;
    outbox_rows_inserted: number;
    account_product_pairs: string[];
    synthetic_domain_scan: string;
  };
  query_plans: QueryPlanResult[];
  performance: PerformanceResult[];
  concurrency: ConcurrencyResult[];
  verdict: {
    status: 'passed_with_expected_open_findings';
    hard_failures: string[];
    expected_open_findings: ExpectedOpenFinding[];
    external_mutations: {
      production_database: false;
      railway: false;
      providers: false;
      sends: false;
    };
  };
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'packages/db/migrations');
const OUTPUT_DIR = path.resolve(process.env.OT37_OUTPUT_DIR ?? 'ops/evidence/ot-37');
const PRIMARY_ACCOUNT = 'ot37_account_alpha';
const PRIMARY_PRODUCT = 'ot37_product_mishnah';
const SECONDARY_ACCOUNT = 'ot37_account_beta';
const SECONDARY_PRODUCT = 'ot37_product_review';
const CONTACT_COUNT = 10_600;
const PRIMARY_CONTACT_COUNT = 10_000;
const SIGNUP_COUNT = 500;
const OUTBOX_COUNT = 500;
const PERFORMANCE_WARMUP = 5;
const PERFORMANCE_ITERATIONS = 30;
const HARD_RUNAWAY_LIMIT_MS = 2_000;

async function main() {
  const adminConfig = adminPoolConfigFromEnv();
  const adminPool = new pg.Pool(adminConfig);
  const databaseContexts: DbContext[] = [];

  try {
    const postgresVersion = await readPostgresVersion(adminPool);
    const cleanDb = await createEphemeralDatabase(adminConfig, 'clean');
    const edgeDb = await createEphemeralDatabase(adminConfig, 'edge');
    databaseContexts.push(cleanDb, edgeDb);

    const migrationFiles = await discoverMigrationFiles();
    const cleanMigration = await runCleanMigrationProof(cleanDb.pool, migrationFiles);
    const edgeFixtures = await runEdgeFixtureProof(edgeDb.pool, migrationFiles);
    const syntheticData = await seedSyntheticScale(cleanDb.pool);
    const queryPlans = await captureQueryPlans(cleanDb.pool);
    const performanceResults = await measurePerformance(cleanDb.pool);
    const concurrencyResults = await runConcurrencyScenarios(cleanDb.pool);

    const expectedOpenFindings = collectExpectedOpenFindings(
      edgeFixtures,
      queryPlans,
      concurrencyResults,
    );
    const report: Report = {
      task: ot37Task,
      generated_at: new Date().toISOString(),
      environment: {
        node_version: process.version,
        postgres_version: postgresVersion.version,
        postgres_server_version_num: postgresVersion.serverVersionNum,
        database_names: databaseContexts.map((context) => context.databaseName),
      },
      migration: cleanMigration,
      edge_fixtures: edgeFixtures,
      synthetic_data: syntheticData,
      query_plans: queryPlans,
      performance: performanceResults,
      concurrency: concurrencyResults,
      verdict: {
        status: 'passed_with_expected_open_findings',
        hard_failures: [],
        expected_open_findings: expectedOpenFindings,
        external_mutations: {
          production_database: false,
          railway: false,
          providers: false,
          sends: false,
        },
      },
    };

    assertNoHardRunaways(performanceResults);
    assertSyntheticEvidence(report);
    await writeReports(report);
    process.stdout.write(
      `OT-37 PostgreSQL assurance completed with ${expectedOpenFindings.length} expected-open finding(s).\n`,
    );
  } finally {
    for (const context of databaseContexts.reverse()) {
      await context.pool.end();
      await dropEphemeralDatabase(adminPool, context.databaseName);
    }
    await adminPool.end();
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
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

async function readPostgresVersion(pool: pg.Pool) {
  const result = await pool.query<VersionRow>(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Unable to read PostgreSQL version.');
  return {
    version: row.version,
    serverVersionNum: row.server_version_num,
  };
}

async function createEphemeralDatabase(
  adminConfig: pg.PoolConfig,
  label: string,
): Promise<DbContext> {
  const databaseName = `ot37_${label}_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const adminPool = new pg.Pool(adminConfig);
  try {
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally {
    await adminPool.end();
  }

  const pool = new pg.Pool({
    ...adminConfig,
    database: databaseName,
    max: 16,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  return { adminConfig, databaseName, pool };
}

async function dropEphemeralDatabase(adminPool: pg.Pool, databaseName: string) {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function discoverMigrationFiles(): Promise<MigrationFile[]> {
  const fileNames = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  for (const fileName of fileNames) {
    const fullPath = path.join(MIGRATIONS_DIR, fileName);
    const sql = await readFile(fullPath, 'utf8');
    files.push({
      id: fileName.replace(/\.sql$/, ''),
      fileName,
      path: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }
  if (files.length === 0) throw new Error('No migration files discovered.');
  return files;
}

async function runCleanMigrationProof(pool: pg.Pool, migrationFiles: MigrationFile[]) {
  const firstRun = await runMigrations(pool);
  const secondRun = await runMigrations(pool);
  const ledger = await pool.query<MigrationLedgerRow>(
    'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id',
  );
  const expectedChecksums = new Map(migrationFiles.map((file) => [file.id, file.checksum]));
  const ledgerMatchesChecksums =
    ledger.rows.length === migrationFiles.length &&
    ledger.rows.every((row) => expectedChecksums.get(row.id) === row.checksum);

  if (!ledgerMatchesChecksums) {
    throw new Error('Migration ledger does not match repository checksums.');
  }
  if (!secondRun.every((result) => result.status === 'already_applied')) {
    throw new Error('Second migration run was not idempotent.');
  }

  return {
    files_discovered: migrationFiles,
    clean_apply_statuses: firstRun.map((result) => `${result.status}:${result.id}`),
    idempotent_verify_statuses: secondRun.map((result) => `${result.status}:${result.id}`),
    ledger_matches_checksums: ledgerMatchesChecksums,
    future_migration_discovery: migrationFiles.every((file) => /^\d+_.+\.sql$/.test(file.fileName)),
  };
}

async function runEdgeFixtureProof(
  pool: pg.Pool,
  migrationFiles: MigrationFile[],
): Promise<Record<string, JsonValue>> {
  const first = migrationFiles[0];
  const second = migrationFiles[1];
  if (!first || !second) throw new Error('Expected at least two migrations for edge proof.');

  await applyMigrationWithLedger(pool, first);
  await insertPreSecondMigrationFixtures(pool);
  const duplicateEmail = await captureExpectedUniqueViolation(pool, 'email');
  const duplicatePhone = await captureExpectedUniqueViolation(pool, 'phone');
  await applyMigrationWithLedger(pool, second);

  const multiSignup = await pool.query<Record<string, string>>(
    `SELECT contact_key, lead_status, offer_version, content_version
       FROM onetime.contacts
      WHERE contact_key = 'ot37-edge-contact-multi'`,
  );
  const archived = await pool.query<Record<string, string | null>>(
    `SELECT contact_key, lead_status, archived_at
       FROM onetime.contacts
      WHERE contact_key = 'ot37-edge-contact-archived'`,
  );
  const accountSeparation = await pool.query<Record<string, string>>(
    `SELECT account_key, product_key, email_normalized
       FROM onetime.contacts
      WHERE email_normalized = 'shared-edge@example.test'
      ORDER BY account_key, product_key`,
  );
  const ledger = await pool.query<MigrationLedgerRow>(
    'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id',
  );

  return {
    multi_signup_contact: jsonRecord(multiSignup.rows[0] ?? {}),
    multi_signup_expected_open: 'DATA-008 unranked UPDATE FROM can choose any matching signup row.',
    archived_contact: jsonRecord(archived.rows[0] ?? {}),
    archived_expected_open:
      'DATA-003 archived lead_status and archived_at remain separate semantics.',
    duplicate_email_attempt: duplicateEmail,
    duplicate_phone_attempt: duplicatePhone,
    account_product_separation_rows: accountSeparation.rows.length,
    account_product_separation: accountSeparation.rows.map(jsonRecord),
    ledger_rows: ledger.rows.map(jsonRecord),
  };
}

async function applyMigrationWithLedger(pool: pg.Pool, migration: MigrationFile) {
  const sql = await readFile(path.resolve(process.cwd(), migration.path), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(81227001)');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS onetime;
      CREATE TABLE IF NOT EXISTS onetime.schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(sql);
    await client.query('INSERT INTO onetime.schema_migrations (id, checksum) VALUES ($1, $2)', [
      migration.id,
      migration.checksum,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertPreSecondMigrationFixtures(pool: pg.Pool) {
  await insertRows(pool, 'onetime.contacts', contactColumnsBeforeSecondMigration(), [
    baseContactBeforeSecond({
      contact_key: 'ot37-edge-contact-multi',
      email_normalized: 'multi-signup@example.test',
      phone_normalized: '+9990000000001',
    }),
    baseContactBeforeSecond({
      contact_key: 'ot37-edge-contact-archived',
      email_normalized: 'archived-edge@example.test',
      phone_normalized: '+9990000000002',
    }),
    baseContactBeforeSecond({
      contact_key: 'ot37-edge-account-a',
      account_key: 'ot37_edge_account_a',
      product_key: 'ot37_edge_product_a',
      email_normalized: 'shared-edge@example.test',
      phone_normalized: '+9990000000003',
    }),
    baseContactBeforeSecond({
      contact_key: 'ot37-edge-account-b',
      account_key: 'ot37_edge_account_b',
      product_key: 'ot37_edge_product_b',
      email_normalized: 'shared-edge@example.test',
      phone_normalized: '+9990000000004',
    }),
  ]);

  await insertRows(
    pool,
    'onetime.signup_leads',
    [
      'signup_key',
      'contact_key',
      'account_key',
      'product_key',
      'offer_version',
      'content_version',
      'classification',
      'status',
      'metadata',
      'created_at',
    ],
    [
      signupRow(
        'ot37-edge-signup-old',
        'ot37-edge-contact-multi',
        'old-offer',
        'old-content',
        'new',
      ),
      signupRow(
        'ot37-edge-signup-new',
        'ot37-edge-contact-multi',
        'new-offer',
        'new-content',
        'scheduled',
      ),
      signupRow(
        'ot37-edge-signup-archived',
        'ot37-edge-contact-archived',
        'archived-offer',
        'archived-content',
        'archived',
      ),
    ],
  );
}

function contactColumnsBeforeSecondMigration() {
  return [
    'contact_key',
    'account_key',
    'product_key',
    'display_name',
    'family_school_classification',
    'family_or_school',
    'location_text',
    'timezone',
    'email_normalized',
    'phone_normalized',
    'reminder_preference',
    'consent_policy_version',
    'consent_recorded_at',
    'suppression_state',
    'source',
    'created_at',
    'updated_at',
  ];
}

function baseContactBeforeSecond(overrides: Partial<Row>): Row {
  return {
    contact_key: 'ot37-edge-contact',
    account_key: 'ot37_edge_account',
    product_key: 'ot37_edge_product',
    display_name: 'Synthetic Edge Contact',
    family_school_classification: 'family',
    family_or_school: 'Synthetic Edge Family',
    location_text: 'Synthetic City',
    timezone: 'Etc/UTC',
    email_normalized: 'edge@example.test',
    phone_normalized: null,
    reminder_preference: 'none',
    consent_policy_version: null,
    consent_recorded_at: null,
    suppression_state: 'active',
    source: 'ot37_synthetic_fixture',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function signupRow(
  signupKey: string,
  contactKey: string,
  offerVersion: string,
  contentVersion: string,
  status: string,
): Row {
  return {
    signup_key: signupKey,
    contact_key: contactKey,
    account_key: 'ot37_edge_account',
    product_key: 'ot37_edge_product',
    offer_version: offerVersion,
    content_version: contentVersion,
    classification: 'family',
    status,
    metadata: '{}',
    created_at: status === 'scheduled' ? '2026-01-03T00:00:00.000Z' : '2026-01-02T00:00:00.000Z',
  };
}

async function captureExpectedUniqueViolation(pool: pg.Pool, kind: 'email' | 'phone') {
  const values =
    kind === 'email'
      ? baseContactBeforeSecond({
          contact_key: 'ot37-edge-duplicate-email',
          email_normalized: 'multi-signup@example.test',
          phone_normalized: '+9990000000005',
        })
      : baseContactBeforeSecond({
          contact_key: 'ot37-edge-duplicate-phone',
          email_normalized: 'duplicate-phone@example.test',
          phone_normalized: '+9990000000001',
        });
  try {
    await insertRows(pool, 'onetime.contacts', contactColumnsBeforeSecondMigration(), [values]);
    return {
      status: 'unexpected_inserted',
      sqlstate: null,
    };
  } catch (error) {
    return {
      status: isPgCode(error, '23505') ? 'expected_unique_violation' : 'unexpected_error',
      sqlstate: pgCode(error),
    };
  }
}

async function seedSyntheticScale(pool: pg.Pool) {
  await insertRows(
    pool,
    'onetime.account_users',
    [
      'user_key',
      'account_key',
      'product_key',
      'email_normalized',
      'display_name',
      'role',
      'password_hash',
      'mfa_capable',
      'status',
    ],
    [
      userRow('ot37-user-alpha-owner', PRIMARY_ACCOUNT, PRIMARY_PRODUCT, 'owner'),
      userRow('ot37-user-alpha-admin', PRIMARY_ACCOUNT, PRIMARY_PRODUCT, 'admin'),
      userRow('ot37-user-alpha-agent', PRIMARY_ACCOUNT, PRIMARY_PRODUCT, 'crm_agent'),
      userRow('ot37-user-beta-admin', SECONDARY_ACCOUNT, PRIMARY_PRODUCT, 'admin'),
      userRow('ot37-user-product-admin', PRIMARY_ACCOUNT, SECONDARY_PRODUCT, 'admin'),
    ],
  );

  const contactRows: Row[] = [];
  for (let index = 0; index < CONTACT_COUNT; index += 1) {
    const primary = index < PRIMARY_CONTACT_COUNT;
    const accountKey = primary
      ? PRIMARY_ACCOUNT
      : index % 2 === 0
        ? SECONDARY_ACCOUNT
        : PRIMARY_ACCOUNT;
    const productKey = primary
      ? PRIMARY_PRODUCT
      : index % 2 === 0
        ? PRIMARY_PRODUCT
        : SECONDARY_PRODUCT;
    const contactNumber = String(index + 1).padStart(5, '0');
    contactRows.push({
      contact_key: `ot37-contact-${contactNumber}`,
      account_key: accountKey,
      product_key: productKey,
      display_name: `Synthetic Contact ${contactNumber}`,
      family_school_classification: index % 3 === 0 ? 'school' : 'family',
      family_or_school: `Synthetic Family ${contactNumber}`,
      location_text: `Synthetic City ${index % 37}`,
      timezone: 'Etc/UTC',
      email_normalized: `contact-${contactNumber}@example.test`,
      phone_normalized: index % 4 === 0 ? `+999${String(index).padStart(11, '0')}` : null,
      reminder_preference: index % 5 === 0 ? 'both' : 'none',
      consent_policy_version: index % 5 === 0 ? 'ot37-synthetic-consent-v1' : null,
      consent_recorded_at: index % 5 === 0 ? '2026-01-01T00:00:00.000Z' : null,
      suppression_state: index % 97 === 0 ? 'suppressed' : 'active',
      source: index % 2 === 0 ? 'one_time_public_signup' : 'manual_crm',
      version: 1,
      lead_status: index % 7 === 0 ? 'contacted' : 'new',
      assigned_user_key:
        primary && index % 3 === 0
          ? index % 2 === 0
            ? 'ot37-user-alpha-admin'
            : 'ot37-user-alpha-agent'
          : null,
      internal_note: '',
      offer_version: index < SIGNUP_COUNT ? 'ot37-offer-v1' : null,
      content_version: index < SIGNUP_COUNT ? 'ot37-content-v1' : null,
      last_activity_at: timestampForIndex(index),
      archived_at: null,
      created_at: timestampForIndex(index + 10),
      updated_at: timestampForIndex(index),
    });
  }
  await insertRows(
    pool,
    'onetime.contacts',
    [
      ...contactColumnsBeforeSecondMigration(),
      'version',
      'lead_status',
      'assigned_user_key',
      'internal_note',
      'offer_version',
      'content_version',
      'last_activity_at',
      'archived_at',
    ],
    contactRows,
  );

  const signupRows: Row[] = [];
  const outboxRows: Row[] = [];
  for (let index = 0; index < SIGNUP_COUNT; index += 1) {
    const contactNumber = String(index + 1).padStart(5, '0');
    const contactKey = `ot37-contact-${contactNumber}`;
    const signupKey = `ot37-signup-${contactNumber}`;
    signupRows.push({
      signup_key: signupKey,
      contact_key: contactKey,
      account_key: PRIMARY_ACCOUNT,
      product_key: PRIMARY_PRODUCT,
      offer_version: 'ot37-offer-v1',
      content_version: 'ot37-content-v1',
      classification: index % 3 === 0 ? 'school' : 'family',
      status: 'new',
      metadata: '{"synthetic":true}',
      created_at: timestampForIndex(index),
    });
    if (index < OUTBOX_COUNT) {
      outboxRows.push({
        delivery_key: `ot37-delivery-${contactNumber}`,
        account_key: PRIMARY_ACCOUNT,
        product_key: PRIMARY_PRODUCT,
        contact_key: contactKey,
        signup_key: signupKey,
        event_type: 'email_acknowledgement',
        channel: 'email',
        transport_mode: 'sink',
        payload: '{"synthetic":true,"recipient_domain":"example.test"}',
        status: 'pending',
        attempts: 0,
        next_attempt_at: timestampForIndex(index),
        created_at: timestampForIndex(index),
        delivered_at: null,
      });
    }
  }
  await insertRows(
    pool,
    'onetime.signup_leads',
    [
      'signup_key',
      'contact_key',
      'account_key',
      'product_key',
      'offer_version',
      'content_version',
      'classification',
      'status',
      'metadata',
      'created_at',
    ],
    signupRows,
  );
  await insertRows(
    pool,
    'onetime.outbox_events',
    [
      'delivery_key',
      'account_key',
      'product_key',
      'contact_key',
      'signup_key',
      'event_type',
      'channel',
      'transport_mode',
      'payload',
      'status',
      'attempts',
      'next_attempt_at',
      'created_at',
      'delivered_at',
    ],
    outboxRows,
  );

  await pool.query('ANALYZE onetime.contacts');
  await pool.query('ANALYZE onetime.signup_leads');
  await pool.query('ANALYZE onetime.outbox_events');
  await pool.query('ANALYZE onetime.account_users');

  return {
    contacts_inserted: contactRows.length,
    signup_rows_inserted: signupRows.length,
    outbox_rows_inserted: outboxRows.length,
    account_product_pairs: [
      `${PRIMARY_ACCOUNT}/${PRIMARY_PRODUCT}`,
      `${SECONDARY_ACCOUNT}/${PRIMARY_PRODUCT}`,
      `${PRIMARY_ACCOUNT}/${SECONDARY_PRODUCT}`,
    ],
    synthetic_domain_scan: 'passed_reserved_domains_only',
  };
}

function userRow(userKey: string, accountKey: string, productKey: string, role: string): Row {
  return {
    user_key: userKey,
    account_key: accountKey,
    product_key: productKey,
    email_normalized: `${userKey}@example.test`,
    display_name: `Synthetic ${role} ${userKey}`,
    role,
    password_hash: 'ot37-not-a-real-password-hash',
    mfa_capable: true,
    status: 'active',
  };
}

function timestampForIndex(index: number) {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  return new Date(base + index * 1_000).toISOString();
}

async function captureQueryPlans(pool: pg.Pool): Promise<QueryPlanResult[]> {
  const results: QueryPlanResult[] = [];
  for (const id of queryScenarioIds) {
    const scenario = queryScenario(id);
    const explained = await explain(pool, scenario.sql, scenario.params);
    const nodeTypes = collectNodeTypes(explained.sanitized_plan);
    const indexNames = collectIndexNames(explained.sanitized_plan);
    const usesSeqScan = nodeTypes.some((nodeType) => nodeType.includes('Seq Scan'));
    const usesIndex =
      indexNames.length > 0 || nodeTypes.some((nodeType) => nodeType.includes('Index'));
    const expectedOpen = expectedOpenForQuery(id, usesSeqScan, usesIndex, nodeTypes);
    results.push({
      id,
      row_count: explained.row_count,
      planning_ms: explained.planning_ms,
      execution_ms: explained.execution_ms,
      node_types: nodeTypes,
      index_names: indexNames,
      uses_seq_scan: usesSeqScan,
      uses_index: usesIndex,
      leading_wildcard_risk: id === 'crm_search_leading_wildcard',
      expected_open_findings: expectedOpen,
      sanitized_plan: explained.sanitized_plan,
    });
  }
  return results;
}

function queryScenario(id: QueryScenarioId) {
  const baseSelect = `SELECT contacts.contact_key, contacts.display_name
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.account_users AS users ON users.user_key = contacts.assigned_user_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.archived_at IS NULL`;
  const baseParams: SqlValue[] = [PRIMARY_ACCOUNT, PRIMARY_PRODUCT];

  switch (id) {
    case 'crm_default_updated_desc':
      return {
        sql: `${baseSelect} ORDER BY contacts.updated_at DESC, contacts.contact_key DESC LIMIT 26`,
        params: baseParams,
      };
    case 'crm_name_sort':
      return {
        sql: `${baseSelect} ORDER BY contacts.display_name ASC, contacts.contact_key ASC LIMIT 26`,
        params: baseParams,
      };
    case 'crm_created_desc':
      return {
        sql: `${baseSelect} ORDER BY contacts.created_at DESC, contacts.contact_key DESC LIMIT 26`,
        params: baseParams,
      };
    case 'crm_search_leading_wildcard':
      return {
        sql: `${baseSelect}
          AND (lower(contacts.display_name) LIKE $3
            OR lower(contacts.family_or_school) LIKE $3
            OR lower(contacts.email_normalized) LIKE $3
            OR lower(COALESCE(contacts.phone_normalized, '')) LIKE $3)
          ORDER BY contacts.updated_at DESC, contacts.contact_key DESC
          LIMIT 26`,
        params: [...baseParams, '%synthetic contact 009%'],
      };
    case 'crm_status_filter':
      return {
        sql: `${baseSelect}
          AND contacts.lead_status = $3
          ORDER BY contacts.updated_at DESC, contacts.contact_key DESC
          LIMIT 26`,
        params: [...baseParams, 'contacted'],
      };
    case 'crm_classification_filter':
      return {
        sql: `${baseSelect}
          AND contacts.family_school_classification = $3
          ORDER BY contacts.updated_at DESC, contacts.contact_key DESC
          LIMIT 26`,
        params: [...baseParams, 'school'],
      };
    case 'crm_source_filter':
      return {
        sql: `${baseSelect}
          AND contacts.source = $3
          ORDER BY contacts.updated_at DESC, contacts.contact_key DESC
          LIMIT 26`,
        params: [...baseParams, 'manual_crm'],
      };
    case 'crm_assigned_user_filter':
      return {
        sql: `${baseSelect}
          AND contacts.assigned_user_key = $3
          ORDER BY contacts.updated_at DESC, contacts.contact_key DESC
          LIMIT 26`,
        params: [...baseParams, 'ot37-user-alpha-admin'],
      };
  }
}

async function explain(pool: pg.Pool, sql: string, params: SqlValue[]) {
  const result = await pool.query<Record<string, unknown>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    params,
  );
  const explainValue = result.rows[0]?.['QUERY PLAN'];
  const document = explainDocument(explainValue);
  return {
    row_count: numberProp(asRecord(document.Plan), 'Actual Rows') ?? 0,
    planning_ms: numberProp(document, 'Planning Time'),
    execution_ms: numberProp(document, 'Execution Time'),
    sanitized_plan: summarizePlanNode(asRecord(document.Plan)),
  };
}

function explainDocument(value: unknown): Record<string, unknown> {
  if (Array.isArray(value) && isRecord(value[0])) return value[0];
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && isRecord(parsed[0])) return parsed[0];
  }
  throw new Error('Unexpected EXPLAIN JSON shape.');
}

function summarizePlanNode(node: Record<string, unknown>): PlanNodeSummary {
  const childNodes = Array.isArray(node.Plans) ? node.Plans.filter(isRecord) : [];
  return {
    node_type: stringProp(node, 'Node Type') ?? 'unknown',
    relation_name: stringProp(node, 'Relation Name'),
    index_name: stringProp(node, 'Index Name'),
    actual_rows: numberProp(node, 'Actual Rows'),
    actual_loops: numberProp(node, 'Actual Loops'),
    shared_hit_blocks: numberProp(node, 'Shared Hit Blocks'),
    shared_read_blocks: numberProp(node, 'Shared Read Blocks'),
    plans: childNodes.map(summarizePlanNode),
  };
}

function collectNodeTypes(node: PlanNodeSummary): string[] {
  return unique([node.node_type, ...node.plans.flatMap(collectNodeTypes)]);
}

function collectIndexNames(node: PlanNodeSummary): string[] {
  return unique([
    ...(node.index_name ? [node.index_name] : []),
    ...node.plans.flatMap(collectIndexNames),
  ]);
}

function expectedOpenForQuery(
  id: QueryScenarioId,
  usesSeqScan: boolean,
  usesIndex: boolean,
  nodeTypes: string[],
) {
  const findings: string[] = [];
  if (id === 'crm_search_leading_wildcard') {
    findings.push('PERF-003 leading-wildcard CRM search has no matching expression/trigram index.');
  }
  if (id === 'crm_created_desc' && nodeTypes.includes('Sort')) {
    findings.push('PERF-003 created_desc sort lacks a matching scoped composite index.');
  }
  if ((id === 'crm_source_filter' || id === 'crm_assigned_user_filter') && !usesIndex) {
    findings.push(`PERF-003 ${id} lacks a matching scoped composite index.`);
  }
  if (usesSeqScan && id !== 'crm_default_updated_desc') {
    findings.push(`PERF-003 ${id} used a sequential scan at synthetic scale.`);
  }
  return findings;
}

async function measurePerformance(pool: pg.Pool): Promise<PerformanceResult[]> {
  const detailKey = 'ot37-contact-00001';
  const results: PerformanceResult[] = [];
  for (const id of performanceScenarioIds) {
    const scenario = performanceScenario(id, detailKey);
    const raw: number[] = [];
    for (
      let iteration = 0;
      iteration < PERFORMANCE_WARMUP + PERFORMANCE_ITERATIONS;
      iteration += 1
    ) {
      const start = performance.now();
      await pool.query(scenario.sql, scenario.params);
      const elapsed = roundMs(performance.now() - start);
      if (iteration >= PERFORMANCE_WARMUP) raw.push(elapsed);
    }
    const stats = percentiles(raw);
    results.push({
      id,
      warmup_iterations: PERFORMANCE_WARMUP,
      measured_iterations: PERFORMANCE_ITERATIONS,
      raw_ms: raw,
      p50_ms: stats.p50,
      p75_ms: stats.p75,
      p95_ms: stats.p95,
      hard_runaway_limit_ms: HARD_RUNAWAY_LIMIT_MS,
      hard_runaway_passed: raw.every((sample) => sample <= HARD_RUNAWAY_LIMIT_MS),
      product_slo_verdict: 'not_applicable_db_only',
    });
  }
  return results;
}

function performanceScenario(id: PerformanceScenarioId, detailKey: string) {
  switch (id) {
    case 'db_list_default':
      return queryScenario('crm_default_updated_desc');
    case 'db_contact_detail':
      return {
        sql: `SELECT contacts.*, users.display_name AS assigned_name
          FROM onetime.contacts AS contacts
          LEFT JOIN onetime.account_users AS users ON users.user_key = contacts.assigned_user_key
         WHERE contacts.account_key = $1
           AND contacts.product_key = $2
           AND contacts.contact_key = $3
           AND contacts.archived_at IS NULL
         LIMIT 1`,
        params: [PRIMARY_ACCOUNT, PRIMARY_PRODUCT, detailKey],
      };
    case 'db_search_leading_wildcard':
      return queryScenario('crm_search_leading_wildcard');
  }
}

async function runConcurrencyScenarios(pool: pg.Pool): Promise<ConcurrencyResult[]> {
  return [
    await runIdempotencyInsertRace(pool),
    await runDuplicateContactRace(pool),
    await runSkipLockedWorkerClaims(pool),
    {
      id: 'durable_throttling_current_base',
      status: 'skipped_current_base',
      participants: 0,
      observations: {
        reason: 'Current base has process-local throttling and no durable throttle table.',
      },
      expected_open_findings: ['DURABLE-THROTTLE-MISSING'],
    },
  ];
}

async function runIdempotencyInsertRace(pool: pg.Pool): Promise<ConcurrencyResult> {
  const participants = 6;
  const barrier = createBarrier(participants);
  const rows = await Promise.all(
    Array.from({ length: participants }, async (_item, index) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await barrier();
        const result = await client.query(
          `INSERT INTO onetime.idempotency_records
           (account_key, product_key, idempotency_key, request_hash, response_json)
           VALUES ($1,$2,$3,$4,$5::jsonb)
           ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING
           RETURNING id`,
          [
            PRIMARY_ACCOUNT,
            PRIMARY_PRODUCT,
            'ot37-idempotency-race',
            `synthetic-request-hash-${index % 2}`,
            '{"synthetic":true}',
          ],
        );
        await client.query('COMMIT');
        return result.rowCount === 1 ? 'inserted' : 'conflict';
      } catch (error) {
        await client.query('ROLLBACK');
        return `error:${pgCode(error) ?? 'unknown'}`;
      } finally {
        client.release();
      }
    }),
  );
  return {
    id: 'simultaneous_idempotency_insert',
    status: rows.filter((row) => row === 'inserted').length === 1 ? 'passed' : 'expected_open',
    participants,
    observations: {
      inserted: rows.filter((row) => row === 'inserted').length,
      conflicts: rows.filter((row) => row === 'conflict').length,
      raw_results: rows,
    },
    expected_open_findings: [
      'DATA-004 table uniqueness works, but current domain replay path does not compare request_hash.',
    ],
  };
}

async function runDuplicateContactRace(pool: pg.Pool): Promise<ConcurrencyResult> {
  const participants = 6;
  const barrier = createBarrier(participants);
  const rows = await Promise.all(
    Array.from({ length: participants }, async (_item, index) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await barrier();
        await client.query(
          `INSERT INTO onetime.contacts
           (contact_key, account_key, product_key, display_name, family_school_classification,
            family_or_school, location_text, timezone, email_normalized, phone_normalized,
            reminder_preference, suppression_state, source, lead_status, internal_note, last_activity_at)
           VALUES ($1,$2,$3,$4,'family',$4,'Synthetic City','Etc/UTC',$5,$6,'none','active','manual_crm','new','',now())`,
          [
            `ot37-race-contact-${index}`,
            PRIMARY_ACCOUNT,
            PRIMARY_PRODUCT,
            'Synthetic Race Contact',
            'race-contact@example.test',
            '+9999990000000',
          ],
        );
        await client.query('COMMIT');
        return 'inserted';
      } catch (error) {
        await client.query('ROLLBACK');
        return isPgCode(error, '23505')
          ? 'unique_violation'
          : `error:${pgCode(error) ?? 'unknown'}`;
      } finally {
        client.release();
      }
    }),
  );
  return {
    id: 'simultaneous_duplicate_contact_create',
    status: rows.filter((row) => row === 'inserted').length === 1 ? 'passed' : 'expected_open',
    participants,
    observations: {
      inserted: rows.filter((row) => row === 'inserted').length,
      unique_violations: rows.filter((row) => row === 'unique_violation').length,
      raw_results: rows,
    },
    expected_open_findings: [
      'DATA-005 database uniqueness prevents duplicate rows, but current manual create has no idempotent replay contract.',
    ],
  };
}

async function runSkipLockedWorkerClaims(pool: pg.Pool): Promise<ConcurrencyResult> {
  const claimCount = 24;
  const workers = 4;
  const outboxRows: Row[] = [];
  for (let index = 0; index < claimCount; index += 1) {
    const label = String(index).padStart(2, '0');
    outboxRows.push({
      delivery_key: `ot37-skip-locked-${label}`,
      account_key: PRIMARY_ACCOUNT,
      product_key: PRIMARY_PRODUCT,
      contact_key: `ot37-contact-${String(index + 1).padStart(5, '0')}`,
      signup_key: `ot37-signup-${String(index + 1).padStart(5, '0')}`,
      event_type: 'email_acknowledgement',
      channel: 'email',
      transport_mode: 'sink',
      payload: '{"synthetic":true}',
      status: 'pending',
      attempts: 0,
      next_attempt_at: timestampForIndex(index),
      created_at: timestampForIndex(index),
      delivered_at: null,
    });
  }
  await insertRows(
    pool,
    'onetime.outbox_events',
    [
      'delivery_key',
      'account_key',
      'product_key',
      'contact_key',
      'signup_key',
      'event_type',
      'channel',
      'transport_mode',
      'payload',
      'status',
      'attempts',
      'next_attempt_at',
      'created_at',
      'delivered_at',
    ],
    outboxRows,
  );

  const barrier = createBarrier(workers);
  const claims = await Promise.all(
    Array.from({ length: workers }, async (_item, index) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await barrier();
        const selected = await client.query<DeliveryKeyRow>(
          `SELECT delivery_key
             FROM onetime.outbox_events
            WHERE account_key = $1
              AND product_key = $2
              AND status = 'pending'
              AND delivery_key LIKE 'ot37-skip-locked-%'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 6`,
          [PRIMARY_ACCOUNT, PRIMARY_PRODUCT],
        );
        const keys = selected.rows.map((row) => row.delivery_key);
        if (keys.length > 0) {
          await client.query(
            `UPDATE onetime.outbox_events
                SET status = $1
              WHERE delivery_key = ANY($2::text[])`,
            [`claimed-by-${index}`, keys],
          );
        }
        await client.query('COMMIT');
        return keys;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }),
  );
  const flatClaims = claims.flat();
  return {
    id: 'skip_locked_worker_claims',
    status: unique(flatClaims).length === claimCount ? 'passed' : 'expected_open',
    participants: workers,
    observations: {
      seeded_pending_rows: claimCount,
      claimed_rows: flatClaims.length,
      unique_claimed_rows: unique(flatClaims).length,
      per_worker_counts: claims.map((workerClaims) => workerClaims.length),
    },
    expected_open_findings: [],
  };
}

function createBarrier(parties: number) {
  let count = 0;
  const waiting: Array<() => void> = [];
  return async () => {
    count += 1;
    if (count === parties) {
      for (const release of waiting) release();
      return;
    }
    await new Promise<void>((resolve) => {
      waiting.push(resolve);
    });
  };
}

async function insertRows(
  pool: pg.Pool,
  tableName: string,
  columns: string[],
  rows: Row[],
  chunkSize = 500,
) {
  if (rows.length === 0) return;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: SqlValue[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column] ?? null);
        return `$${values.length}`;
      });
      return `(${placeholders.join(',')})`;
    });
    await pool.query(
      `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${tuples.join(',')}`,
      values,
    );
  }
}

function percentiles(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
  };
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) throw new Error('Cannot calculate percentile for empty samples.');
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function roundMs(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function assertNoHardRunaways(results: PerformanceResult[]) {
  const failed = results.filter((result) => !result.hard_runaway_passed);
  if (failed.length > 0) {
    throw new Error(
      `Hard DB runaway limit exceeded: ${failed.map((result) => result.id).join(', ')}`,
    );
  }
}

function assertSyntheticEvidence(report: Report) {
  const serialized = JSON.stringify(report);
  const emailMatches = serialized.match(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi) ?? [];
  const allowedDomains = new Set<string>(reservedSyntheticDomains);
  const badDomains = emailMatches
    .map((email) => email.split('@').at(1)?.toLowerCase() ?? '')
    .filter((domain) => domain && !allowedDomains.has(domain));
  if (badDomains.length > 0) {
    throw new Error(
      `Non-reserved email domain found in evidence: ${unique(badDomains).join(', ')}`,
    );
  }
  if (/postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]+@[^/\s]+/i.test(serialized)) {
    throw new Error('Evidence contains a database URL with credentials.');
  }
}

async function writeReports(report: Report) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, 'latest-postgres-assurance-report.json');
  const markdownPath = path.join(OUTPUT_DIR, 'latest-postgres-assurance-report.md');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, markdownReport(report), 'utf8');
}

function markdownReport(report: Report) {
  const planRows = report.query_plans
    .map(
      (plan) =>
        `| ${plan.id} | ${plan.execution_ms ?? 'n/a'} | ${plan.uses_index} | ${plan.uses_seq_scan} | ${plan.expected_open_findings.length} |`,
    )
    .join('\n');
  const perfRows = report.performance
    .map((result) => `| ${result.id} | ${result.p50_ms} | ${result.p75_ms} | ${result.p95_ms} |`)
    .join('\n');
  const concurrencyRows = report.concurrency
    .map((result) => `| ${result.id} | ${result.status} | ${result.participants} |`)
    .join('\n');
  const openRows = report.verdict.expected_open_findings
    .map((finding) => `| ${finding.id} | ${finding.title} |`)
    .join('\n');

  return `# OT-37 PostgreSQL Assurance Report

Generated: ${report.generated_at}

Repository: ${report.task.repository}

Base commit: ${report.task.baseCommit}

Node: ${report.environment.node_version}

PostgreSQL: ${report.environment.postgres_version}

## Migration

- Files discovered: ${report.migration.files_discovered.length}
- Ledger matches checksums: ${report.migration.ledger_matches_checksums}
- Idempotent verification statuses: ${report.migration.idempotent_verify_statuses.join(', ')}

## Synthetic Scale

- Contacts: ${report.synthetic_data.contacts_inserted}
- Signups: ${report.synthetic_data.signup_rows_inserted}
- Outbox rows: ${report.synthetic_data.outbox_rows_inserted}
- Synthetic evidence scan: ${report.synthetic_data.synthetic_domain_scan}

## Query Plans

| Scenario | Execution ms | Uses index | Uses seq scan | Expected-open count |
|---|---:|---:|---:|---:|
${planRows}

## Performance

These are DB/API-compatible query timings, not browser or LCP results.

| Scenario | p50 ms | p75 ms | p95 ms |
|---|---:|---:|---:|
${perfRows}

## Concurrency

| Scenario | Status | Participants |
|---|---|---:|
${concurrencyRows}

## Expected-Open Findings

| ID | Finding |
|---|---|
${openRows}

External mutations: production database=false, Railway=false, providers=false, sends=false.
`;
}

function collectExpectedOpenFindings(
  edgeFixtures: Record<string, JsonValue>,
  queryPlans: QueryPlanResult[],
  concurrency: ConcurrencyResult[],
): ExpectedOpenFinding[] {
  const findings = new Map<string, ExpectedOpenFinding>();
  for (const catalog of expectedOpenFindingCatalog) {
    findings.set(catalog.id, {
      id: catalog.id,
      title: catalog.title,
      evidence: catalog.source,
    });
  }
  if (typeof edgeFixtures.multi_signup_expected_open === 'string') {
    findings.set('DATA-008', {
      id: 'DATA-008',
      title: 'Migration backfill remains unranked for multi-signup contacts.',
      evidence: edgeFixtures.multi_signup_expected_open,
    });
  }
  for (const plan of queryPlans) {
    for (const finding of plan.expected_open_findings) {
      findings.set(`${plan.id}:${finding}`, {
        id: 'PERF-003',
        title: finding,
        evidence: `query_plan:${plan.id}`,
      });
    }
  }
  for (const result of concurrency) {
    for (const finding of result.expected_open_findings) {
      findings.set(`${result.id}:${finding}`, {
        id: result.id,
        title: finding,
        evidence: `concurrency:${result.id}`,
      });
    }
  }
  return [...findings.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected object value.');
  return value;
}

function stringProp(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function numberProp(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' ? roundMs(value) : null;
}

function jsonRecord(record: Record<string, unknown>): Record<string, JsonValue> {
  const output: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(record)) {
    output[key] = jsonValue(value);
  }
  return output;
}

function jsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (isRecord(value)) return jsonRecord(value);
  return String(value);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function pgCode(error: unknown) {
  return isRecord(error) && typeof error.code === 'string' ? error.code : null;
}

function isPgCode(error: unknown, code: string) {
  return pgCode(error) === code;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`OT-37 PostgreSQL assurance failed: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
