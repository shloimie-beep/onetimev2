import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import type {
  ContentApprovalEvidence,
  ContentPublicationRecord,
} from '../../packages/contracts/src/content/publication/index.ts';
import { runMigrations, verifyMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createPostgresContentPublicationRepository,
  type ContentPublicationSqlPool,
} from '../../packages/db/src/content/publication/repository.ts';
import {
  buildCandidate,
  NATIVE_POSTGRESQL_PROBE_IDS,
  type CandidateBuildRequest,
  type NativePostgresqlResult,
} from '../operations/v21/candidate/build-candidate.ts';
import {
  proveGovernedCampaignAudienceDecisionPg18,
  type GovernedCampaignAudienceDecisionPg18Proof,
} from './governed-campaign-audience-decision-pg18-proof.ts';

const EXPECTED_ENGINE_VERSION = '18.4';
const EXPECTED_SERVER_VERSION_NUM = '180004';
const EXPECTED_MIGRATION_COUNT = 96;
const EXPECTED_LAST_MIGRATION_ORDINAL = 2265;
const OUTPUT_DIR = path.resolve(
  process.env.CANDIDATE_PG18_OUTPUT_DIR ?? 'ops/evidence/ops-11/pg18/candidate',
);
const REQUEST_OUTPUT = 'candidate-build-request.json';
const PROOF_OUTPUT = 'candidate-postgresql-18.4-proof.json';
const PRODUCT_KEY = 'one_time_mishnayos' as const;
const CI_TIMESTAMP = '2026-08-02T10:00:00.000Z';
const CI_TIMESTAMP_NEXT = '2026-08-02T10:01:00.000Z';
const MIGRATION_2253_PREFIX = '2253_';
const MIGRATION_2254_PREFIX = '2254_';
const MIGRATION_2260_PREFIX = '2260_';

type LedgerRow = {
  id: string;
  checksum: string;
};

type VersionRow = {
  server_version: string;
  server_version_num: string;
  version: string;
};

type ProviderProbeId = Exclude<(typeof NATIVE_POSTGRESQL_PROBE_IDS)[number], 'cleanup'>;

type ProviderProbeResults = Record<ProviderProbeId, true>;

type MigrationProof = {
  apply_count: number;
  replay_count: number;
  migration_file_count: number;
  ledger_row_count: number;
  pending_count: number;
  issue_count: number;
  ledger_digest: string;
  ledger_rows: LedgerRow[];
  migration_2253: LedgerRow;
  migration_2254: LedgerRow;
  migration_2260: LedgerRow;
  last_migration_id: string;
};

type ContentProof = {
  raw_content_id_key: true;
  bootstrap_event_count: 4;
  ordered_states: ['received', 'validating', 'processing', 'needs_review'];
  ordered_resulting_versions: [1, 2, 3, 4];
  replay_no_write: true;
  replay_resulting_version: 4;
  subsequent_transition: 'needs_review_to_approved';
  final_state: 'approved';
  final_version: 5;
};

type LearningProof = {
  projection_table_present: true;
  transition_ledger_present: true;
  required_triggers_present: true;
  valid_ci_insert: true;
  valid_version_step: true;
  stale_update_rejected: true;
  append_only_delete_rejected: true;
  rollback_cleanup: true;
};

type DatabaseProof = {
  migration: MigrationProof;
  provider_probes: ProviderProbeResults;
  content_2253: ContentProof;
  learning_2254: LearningProof;
  governed_campaign_2260: GovernedCampaignAudienceDecisionPg18Proof;
};

async function main() {
  assertExecutionBoundary();
  assertOutputBoundary();

  const repositorySourceSha = requiredSourceSha();
  const checkoutSha = toolOutput('git', ['rev-parse', 'HEAD']);
  assert(
    checkoutSha === repositorySourceSha,
    `checked out source ${checkoutSha} does not match candidate source ${repositorySourceSha}`,
  );

  const adminConfig = adminPoolConfigFromEnv();
  const adminPool = new pg.Pool(adminConfig);
  const databaseName = `onetime_candidate_pg18_${randomBytes(8).toString('hex')}`;
  let databaseCreated = false;
  let databaseProof: DatabaseProof | undefined;
  let proofFailure: unknown;
  let cleanupPassed = false;
  let postgresVersion: VersionRow | undefined;

  try {
    postgresVersion = await readPostgresVersion(adminPool);
    assertExactPostgresVersion(postgresVersion);
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    databaseCreated = true;

    const proofPool = new pg.Pool({
      ...adminConfig,
      database: databaseName,
      max: 8,
      statement_timeout: 30_000,
    });
    try {
      databaseProof = await runDatabaseProof(proofPool);
    } finally {
      await proofPool.end();
    }
  } catch (error) {
    proofFailure = error;
  } finally {
    try {
      if (databaseCreated) {
        await dropExactDatabase(adminPool, databaseName);
        cleanupPassed = await databaseIsAbsent(adminPool, databaseName);
      }
    } finally {
      await adminPool.end();
    }
  }

  assert(databaseCreated, 'disposable candidate database was not created');
  assert(cleanupPassed, 'exact disposable candidate database cleanup was not verified');
  if (proofFailure !== undefined) throw proofFailure;
  assert(databaseProof, 'candidate PostgreSQL proof did not produce evidence');
  assert(postgresVersion, 'PostgreSQL version evidence is unavailable');

  const probes = NATIVE_POSTGRESQL_PROBE_IDS.map((id) => ({
    id,
    passed: id === 'cleanup' ? cleanupPassed : databaseProof.provider_probes[id],
  }));
  const nativePostgresql = {
    engine_version: EXPECTED_ENGINE_VERSION,
    migration_count: EXPECTED_MIGRATION_COUNT,
    ledger_digest: databaseProof.migration.ledger_digest,
    pending_count: databaseProof.migration.pending_count,
    issue_count: databaseProof.migration.issue_count,
    probes,
  } satisfies NativePostgresqlResult;

  const candidateBuildRequest = {
    schema_version: 1,
    repository_source_sha: repositorySourceSha,
    tool_versions: {
      node: process.version,
      npm: toolOutput('npm', ['--version']),
      git: toolOutput('git', ['--version']),
      postgresql: EXPECTED_ENGINE_VERSION,
    },
    commands: ['npm ci', 'npx tsx scripts/postgres-assurance/candidate-pg18-proof.ts'],
    native_postgresql: nativePostgresql,
  } satisfies CandidateBuildRequest;

  // This validates the generated request against the candidate builder without
  // writing candidate metadata. It deliberately fails until the builder, the
  // source inventory, and this proof all agree on the complete-launch count of 93.
  buildCandidate(candidateBuildRequest, { repository_root: process.cwd() });

  const proofReport = {
    schema_version: 'onetime.candidate.postgresql-18.4-proof.v1',
    repository_source_sha: repositorySourceSha,
    generated_at: new Date().toISOString(),
    environment: {
      node: process.version,
      postgres_engine_version: EXPECTED_ENGINE_VERSION,
      postgres_server_version: postgresVersion.server_version,
      postgres_server_version_num: postgresVersion.server_version_num,
      postgres_version_string: postgresVersion.version,
      execution_environment: 'github_actions_disposable_service',
    },
    migration: databaseProof.migration,
    native_postgresql: nativePostgresql,
    content_2253: databaseProof.content_2253,
    learning_2254: {
      classification: 'native_schema_compatibility_not_deployed_runtime_attachment',
      ...databaseProof.learning_2254,
    },
    governed_campaign_2260: databaseProof.governed_campaign_2260,
    cleanup: {
      exact_disposable_database_absent: cleanupPassed,
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

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeJson(path.join(OUTPUT_DIR, REQUEST_OUTPUT), candidateBuildRequest);
  await writeJson(path.join(OUTPUT_DIR, PROOF_OUTPUT), proofReport);
  process.stdout.write(
    `Candidate PostgreSQL ${EXPECTED_ENGINE_VERSION} proof passed for ${repositorySourceSha}.\n`,
  );
}

function assertExecutionBoundary() {
  assert(
    process.env.CANDIDATE_ALLOW_DISPOSABLE_POSTGRES_WRITE === 'true',
    'candidate PostgreSQL proof requires its exact disposable-write authorization',
  );
  assert(
    process.env.GITHUB_ACTIONS === 'true',
    'candidate PostgreSQL proof is GitHub Actions only',
  );
  const host = process.env.PGHOST ?? '127.0.0.1';
  assert(
    host === '127.0.0.1' || host === 'localhost',
    'candidate PostgreSQL host must be loopback',
  );
  assert((process.env.PGDATABASE ?? 'postgres') === 'postgres', 'admin database must be postgres');
  assert(
    (process.env.PGUSER ?? 'postgres') === 'postgres',
    'disposable service user must be postgres',
  );
}

function assertOutputBoundary() {
  const allowedRoot = path.resolve(process.cwd(), 'ops/evidence/ops-11/pg18/candidate');
  const relative = path.relative(allowedRoot, OUTPUT_DIR);
  assert(
    relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)),
    'candidate proof output must remain under ops/evidence/ops-11/pg18/candidate',
  );
}

function requiredSourceSha() {
  const sourceSha = process.env.CANDIDATE_SOURCE_SHA ?? '';
  assert(
    /^[0-9a-f]{40}$/.test(sourceSha),
    'CANDIDATE_SOURCE_SHA must be an exact lowercase Git SHA',
  );
  return sourceSha;
}

function adminPoolConfigFromEnv(): pg.PoolConfig {
  const port = Number(process.env.PGPORT ?? 5432);
  assert(Number.isSafeInteger(port) && port > 0, 'PGPORT must be a positive integer');
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port,
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

async function readPostgresVersion(pool: pg.Pool): Promise<VersionRow> {
  const result = await pool.query<VersionRow>(
    `SELECT current_setting('server_version') AS server_version,
            current_setting('server_version_num') AS server_version_num,
            version() AS version`,
  );
  const row = result.rows[0];
  assert(row, 'PostgreSQL version readback returned no row');
  return row;
}

function assertExactPostgresVersion(version: VersionRow) {
  const engineVersion = /^([0-9]+\.[0-9]+)/.exec(version.server_version)?.[1];
  assert(
    engineVersion === EXPECTED_ENGINE_VERSION,
    `expected PostgreSQL ${EXPECTED_ENGINE_VERSION}, received ${version.server_version}`,
  );
  assert(
    version.server_version_num === EXPECTED_SERVER_VERSION_NUM,
    `expected server_version_num ${EXPECTED_SERVER_VERSION_NUM}, received ${version.server_version_num}`,
  );
}

async function runDatabaseProof(pool: pg.Pool): Promise<DatabaseProof> {
  const migration = await proveMigrations(pool);
  const providerProbes = await proveProviderRegistryGuards(pool);
  const content2253 = await proveCanonicalContentPopulation(pool);
  const learning2254 = await proveLearningMigrationCompatibility(pool);
  const governedCampaign2260 = await proveGovernedCampaignAudienceDecisionPg18(pool);
  return {
    migration,
    provider_probes: providerProbes,
    content_2253: content2253,
    learning_2254: learning2254,
    governed_campaign_2260: governedCampaign2260,
  };
}

async function proveMigrations(pool: pg.Pool): Promise<MigrationProof> {
  const dbPool = pool as unknown as DbPool;
  const firstRun = await runMigrations(dbPool);
  const secondRun = await runMigrations(dbPool);
  const verification = await verifyMigrations(dbPool);

  assert(
    firstRun.length === EXPECTED_MIGRATION_COUNT,
    'first migration run did not contain 93 rows',
  );
  assert(
    firstRun.every((result) => result.status === 'applied'),
    'first migration run was not a clean 94/94 apply',
  );
  assert(
    secondRun.length === EXPECTED_MIGRATION_COUNT,
    `migration replay did not contain ${EXPECTED_MIGRATION_COUNT} rows`,
  );
  assert(
    secondRun.every((result) => result.status === 'already_applied'),
    'migration replay was not 94/94 already-applied',
  );
  assert(verification.ok && verification.status === 'verified', 'migration verification failed');
  assert(
    verification.migration_file_count === EXPECTED_MIGRATION_COUNT &&
      verification.ledger_row_count === EXPECTED_MIGRATION_COUNT &&
      verification.applied_count === EXPECTED_MIGRATION_COUNT,
    'migration verification counts were not exactly 93',
  );
  assert(verification.pending_count === 0, 'migration verification reported pending migrations');
  assert(verification.issues.length === 0, 'migration verification reported issues');

  const lastMigration = firstRun.at(-1);
  assert(lastMigration, 'migration inventory was empty');
  assert(
    migrationOrdinal(lastMigration.id) === EXPECTED_LAST_MIGRATION_ORDINAL,
    `last migration must be ordinal ${EXPECTED_LAST_MIGRATION_ORDINAL}`,
  );

  const ledgerResult = await pool.query<LedgerRow>(
    'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id',
  );
  const ledgerRows = ledgerResult.rows.map((row) => ({
    id: String(row.id),
    checksum: String(row.checksum),
  }));
  assert(
    ledgerRows.length === EXPECTED_MIGRATION_COUNT,
    `ledger did not contain exactly ${EXPECTED_MIGRATION_COUNT} rows`,
  );

  const expectedById = new Map(firstRun.map((result) => [result.id, result.checksum]));
  assert(
    ledgerRows.every((row) => expectedById.get(row.id) === row.checksum),
    'ledger rows did not exactly match repository migration checksums',
  );

  const migration2253 = requiredMigration(ledgerRows, MIGRATION_2253_PREFIX);
  const migration2254 = requiredMigration(ledgerRows, MIGRATION_2254_PREFIX);
  const migration2260 = requiredMigration(ledgerRows, MIGRATION_2260_PREFIX);
  return {
    apply_count: firstRun.length,
    replay_count: secondRun.length,
    migration_file_count: verification.migration_file_count,
    ledger_row_count: verification.ledger_row_count,
    pending_count: verification.pending_count,
    issue_count: verification.issues.length,
    ledger_digest: digestLedger(ledgerRows),
    ledger_rows: ledgerRows,
    migration_2253: migration2253,
    migration_2254: migration2254,
    migration_2260: migration2260,
    last_migration_id: lastMigration.id,
  };
}

async function proveProviderRegistryGuards(pool: pg.Pool): Promise<ProviderProbeResults> {
  await pool.query(
    PROVIDER_BINDING_INSERT,
    providerBindingValues({ bindingKey: 'candidate-valid' }),
  );
  const valid = await pool.query<{ version: string | number }>(
    `SELECT version FROM onetime.provider_registry_binding_v21
      WHERE registry_binding_key = 'candidate-valid'
        AND product_key = $1
        AND runtime_tier = 'isolated_staging'
        AND verification_environment_id = 'ci'`,
    [PRODUCT_KEY],
  );
  assert(Number(valid.rows[0]?.version) === 1, 'valid provider binding was not persisted');

  await expectDatabaseRejection(
    pool,
    'null_operation_arrays',
    (client) =>
      client.query(
        PROVIDER_BINDING_INSERT,
        providerBindingValues({
          bindingKey: 'candidate-null-array',
          allowedOperationTypes: ['send_transactional', null],
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    'digest_shape',
    (client) =>
      client.query(
        PROVIDER_BINDING_INSERT,
        providerBindingValues({
          bindingKey: 'candidate-bad-digest',
          registryDigest: 'g'.repeat(64),
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    'stripe_policy',
    (client) =>
      client.query(
        PROVIDER_BINDING_INSERT,
        providerBindingValues({
          bindingKey: 'candidate-stripe-policy',
          provider: 'stripe',
          mutationPolicy: 'allowed',
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    'stale_update',
    (client) =>
      client.query(
        `UPDATE onetime.provider_registry_binding_v21
            SET active = true, updated_at = $1, version = 1
          WHERE registry_binding_key = 'candidate-valid'
            AND product_key = $2
            AND runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'ci'`,
        [CI_TIMESTAMP_NEXT, PRODUCT_KEY],
      ),
    ['P0001'],
  );
  await expectDatabaseRejection(
    pool,
    'version_jump_update',
    (client) =>
      client.query(
        `UPDATE onetime.provider_registry_binding_v21
            SET active = true, updated_at = $1, version = 3
          WHERE registry_binding_key = 'candidate-valid'
            AND product_key = $2
            AND runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'ci'`,
        [CI_TIMESTAMP_NEXT, PRODUCT_KEY],
      ),
    ['P0001'],
  );
  await expectDatabaseRejection(
    pool,
    'delete_denial',
    (client) =>
      client.query(
        `DELETE FROM onetime.provider_registry_binding_v21
          WHERE registry_binding_key = 'candidate-valid'
            AND product_key = $1
            AND runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'ci'`,
        [PRODUCT_KEY],
      ),
    ['P0001'],
  );

  const rollbackClient = await pool.connect();
  try {
    await rollbackClient.query('BEGIN');
    await rollbackClient.query(
      PROVIDER_BINDING_INSERT,
      providerBindingValues({ bindingKey: 'candidate-rollback' }),
    );
    const inside = await rollbackClient.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM onetime.provider_registry_binding_v21
        WHERE registry_binding_key = 'candidate-rollback'`,
    );
    assert(
      inside.rows[0]?.count === '1',
      'rollback probe insert was not visible in its transaction',
    );
    await rollbackClient.query('ROLLBACK');
  } finally {
    await rollbackClient.query('ROLLBACK').catch(() => undefined);
    rollbackClient.release();
  }
  const afterRollback = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM onetime.provider_registry_binding_v21
      WHERE registry_binding_key = 'candidate-rollback'`,
  );
  assert(afterRollback.rows[0]?.count === '0', 'rollback probe row persisted');

  const validAfterRejections = await pool.query<{ active: boolean; version: string | number }>(
    `SELECT active, version FROM onetime.provider_registry_binding_v21
      WHERE registry_binding_key = 'candidate-valid'`,
  );
  assert(
    validAfterRejections.rows[0]?.active === false &&
      Number(validAfterRejections.rows[0]?.version) === 1,
    'rejected provider probes changed the valid binding',
  );

  return {
    delete_denial: true,
    digest_shape: true,
    null_operation_arrays: true,
    rollback: true,
    stale_update: true,
    stripe_policy: true,
    version_jump_update: true,
  };
}

async function proveCanonicalContentPopulation(pool: pg.Pool): Promise<ContentProof> {
  const evidence = contentApprovalEvidence();
  const record = contentPublicationRecord(evidence);
  await pool.query(
    `INSERT INTO onetime.content_sources_v21 (
       source_key, account_key, product_key, source_sha256, source_kind,
       lifecycle_state, object_version_id, byte_count, original_preserved,
       version, record_json, updated_at
     ) VALUES ($1, $2, $3, $4, 'app_upload', 'approved', $5, 1024, true, 1, $6::jsonb, $7)`,
    [
      evidence.sourceId,
      evidence.accountKey,
      evidence.productKey,
      evidence.sourceSha256,
      evidence.sourceObjectVersionId,
      JSON.stringify({
        id: evidence.sourceId,
        sha256: evidence.sourceSha256,
        objectVersionId: evidence.sourceObjectVersionId,
        captureMethod: 'obs',
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'ci',
        checksumReadbackReceiptId: 'candidate-checksum-receipt',
        originalPreserved: true,
      }),
      CI_TIMESTAMP,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_processing_versions (
       content_version_key, account_key, product_key, source_key, source_sha256,
       source_object_version_id, processing_state, retry_state, attempt_count,
       version, record_json, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'approved', 'ready', 1, 1, $7::jsonb, $8)`,
    [
      evidence.contentVersionId,
      evidence.accountKey,
      evidence.productKey,
      evidence.sourceId,
      evidence.sourceSha256,
      evidence.sourceObjectVersionId,
      JSON.stringify({
        id: evidence.contentVersionId,
        contentId: evidence.contentId,
        runtimeTier: 'isolated_staging',
        publicationApproval: { contentVersionDigest: evidence.contentVersionDigest },
      }),
      CI_TIMESTAMP,
    ],
  );

  const repository = createPostgresContentPublicationRepository(
    pool as unknown as ContentPublicationSqlPool,
  );
  const first = await repository.inTransaction(async (unit) => {
    const registration = await unit.registerContent(record);
    assert(registration.inserted, 'candidate content record was not inserted');
    return unit.bootstrapCanonicalContentState(record, evidence);
  });
  assert(
    !first.replay && first.resultingVersion === 4,
    'content bootstrap did not reach version 4',
  );

  const firstEvents = await readContentEvents(pool, record.contentId);
  assert(firstEvents.length === 4, 'content bootstrap did not write exactly four events');
  assert(
    firstEvents.every((event) => event.aggregate_key === record.contentId),
    'content bootstrap did not preserve the raw contentId aggregate key',
  );
  const expectedStates = ['received', 'validating', 'processing', 'needs_review'] as const;
  assert(
    expectedStates.every((state, index) => firstEvents[index]?.next_state === state),
    'content bootstrap event order was not canonical',
  );
  assert(
    firstEvents.every((event, index) => Number(event.resulting_version) === index + 1),
    'content bootstrap versions were not 1 through 4',
  );

  const replay = await repository.inTransaction((unit) =>
    unit.bootstrapCanonicalContentState(record, evidence),
  );
  assert(replay.replay && replay.resultingVersion === 4, 'content bootstrap replay was not exact');
  const replayEvents = await readContentEvents(pool, record.contentId);
  assert(replayEvents.length === 4, 'content bootstrap replay wrote another event');

  const approvedRecord: ContentPublicationRecord = {
    ...record,
    state: 'approved',
    version: 2,
    updatedAt: CI_TIMESTAMP_NEXT,
    approval: {
      approvalId: 'candidate-approval',
      approvedByAdminId: evidence.approvedByAdminId,
      approvedAt: evidence.approvedAt,
      policyVersion: 'candidate-policy-v1',
      evidence,
    },
  };
  const transition = await repository.inTransaction((unit) =>
    unit.appendCanonicalContentStateTransition({
      record: approvedRecord,
      operation: 'approve',
      scopeDerivation: 'approved_projection',
      previousState: 'needs_review',
      nextState: 'approved',
      actorKind: 'admin',
      actorKey: evidence.approvedByAdminId,
      idempotencyKey: 'candidate-content-approval',
      requestHash: 'd'.repeat(64),
      occurredAt: CI_TIMESTAMP_NEXT,
    }),
  );
  assert(!transition.replay && transition.resultingVersion === 5, 'approval transition failed');

  const finalEvents = await readContentEvents(pool, record.contentId);
  assert(finalEvents.length === 5, 'approval transition did not append exactly one event');
  const state = await pool.query<{ current_state: string; version: string | number }>(
    `SELECT current_state, version
       FROM onetime.canonical_aggregate_states
      WHERE aggregate_kind = 'content' AND aggregate_key = $1`,
    [record.contentId],
  );
  assert(
    state.rows[0]?.current_state === 'approved' && Number(state.rows[0]?.version) === 5,
    'canonical content state did not reach approved version 5',
  );

  return {
    raw_content_id_key: true,
    bootstrap_event_count: 4,
    ordered_states: ['received', 'validating', 'processing', 'needs_review'],
    ordered_resulting_versions: [1, 2, 3, 4],
    replay_no_write: true,
    replay_resulting_version: 4,
    subsequent_transition: 'needs_review_to_approved',
    final_state: 'approved',
    final_version: 5,
  };
}

async function proveLearningMigrationCompatibility(pool: pg.Pool): Promise<LearningProof> {
  const schema = await pool.query<{
    projection: string | null;
    transition_ledger: string | null;
    trigger_count: string;
  }>(
    `SELECT to_regclass('onetime.learning_question_projection')::text AS projection,
            to_regclass('onetime.learning_question_transition_ledger')::text AS transition_ledger,
            (SELECT count(*)::text
               FROM pg_trigger
              WHERE NOT tgisinternal
                AND tgname IN (
                  'learning_question_projection_version_guard',
                  'learning_question_transition_append_only'
                )) AS trigger_count`,
  );
  const schemaRow = schema.rows[0];
  assert(schemaRow?.projection !== null, 'learning question projection table is absent');
  assert(schemaRow?.transition_ledger !== null, 'learning transition ledger table is absent');
  assert(schemaRow?.trigger_count === '2', 'required learning triggers are absent');

  await pool.query(
    `INSERT INTO onetime.learning_question_projection (
       account_key, product_key, runtime_tier, verification_environment_id,
       question_key, learner_key, household_key, class_key, private_body,
       private_answer, question_state, version, submitted_at, updated_at
     ) VALUES (
       'candidate-account', $1, 'isolated_staging', 'ci', 'candidate-question',
       'candidate-learner', 'candidate-household', 'candidate-class',
       'What is the first mishnah?', NULL, 'submitted', 1, $2, $2
     )`,
    [PRODUCT_KEY, CI_TIMESTAMP],
  );
  await pool.query(
    `INSERT INTO onetime.learning_question_transition_ledger (
       account_key, product_key, runtime_tier, verification_environment_id,
       transition_event_id, question_key, learner_key, household_key, class_key,
       idempotency_key, request_hash, actor_key, event_source, audit_ref,
       from_state, to_state, reason, occurred_at
     ) VALUES (
       'candidate-account', $1, 'isolated_staging', 'ci',
       'candidate-question-submit:transition', 'candidate-question',
       'candidate-learner', 'candidate-household', 'candidate-class',
       'candidate-question-submit', $2, 'candidate-learner',
       'authenticated_student_submit', 'candidate-audit-submit',
       NULL, 'submitted', NULL, $3
     )`,
    [PRODUCT_KEY, 'e'.repeat(64), CI_TIMESTAMP],
  );
  await pool.query(
    `UPDATE onetime.learning_question_projection
        SET private_answer = 'The opening time for Shema.',
            question_state = 'answered_private', version = 2, updated_at = $1
      WHERE account_key = 'candidate-account'
        AND product_key = $2
        AND runtime_tier = 'isolated_staging'
        AND verification_environment_id = 'ci'
        AND question_key = 'candidate-question'`,
    [CI_TIMESTAMP_NEXT, PRODUCT_KEY],
  );
  const updated = await pool.query<{ question_state: string; version: string | number }>(
    `SELECT question_state, version FROM onetime.learning_question_projection
      WHERE account_key = 'candidate-account' AND question_key = 'candidate-question'`,
  );
  assert(
    updated.rows[0]?.question_state === 'answered_private' &&
      Number(updated.rows[0]?.version) === 2,
    'valid learning version step failed',
  );

  await expectDatabaseRejection(
    pool,
    'learning_stale_update',
    (client) =>
      client.query(
        `UPDATE onetime.learning_question_projection
            SET question_state = 'approved_for_class', version = 2, updated_at = $1
          WHERE account_key = 'candidate-account'
            AND product_key = $2
            AND runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'ci'
            AND question_key = 'candidate-question'`,
        ['2026-08-02T10:02:00.000Z', PRODUCT_KEY],
      ),
    ['P0001'],
  );
  await expectDatabaseRejection(
    pool,
    'learning_append_only_delete',
    (client) =>
      client.query(
        `DELETE FROM onetime.learning_question_transition_ledger
          WHERE account_key = 'candidate-account'
            AND product_key = $1
            AND runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'ci'
            AND transition_event_id = 'candidate-question-submit:transition'`,
        [PRODUCT_KEY],
      ),
    ['P0001'],
  );

  const rollbackClient = await pool.connect();
  try {
    await rollbackClient.query('BEGIN');
    await rollbackClient.query(
      `INSERT INTO onetime.learning_question_projection (
         account_key, product_key, runtime_tier, verification_environment_id,
         question_key, learner_key, household_key, class_key, private_body,
         private_answer, question_state, version, submitted_at, updated_at
       ) VALUES (
         'candidate-account', $1, 'isolated_staging', 'ci', 'candidate-question-rollback',
         'candidate-learner', 'candidate-household', 'candidate-class',
         'Rollback question', NULL, 'submitted', 1, $2, $2
       )`,
      [PRODUCT_KEY, CI_TIMESTAMP],
    );
    await rollbackClient.query('ROLLBACK');
  } finally {
    await rollbackClient.query('ROLLBACK').catch(() => undefined);
    rollbackClient.release();
  }
  const rolledBack = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM onetime.learning_question_projection
      WHERE question_key = 'candidate-question-rollback'`,
  );
  assert(rolledBack.rows[0]?.count === '0', 'learning rollback row persisted');

  return {
    projection_table_present: true,
    transition_ledger_present: true,
    required_triggers_present: true,
    valid_ci_insert: true,
    valid_version_step: true,
    stale_update_rejected: true,
    append_only_delete_rejected: true,
    rollback_cleanup: true,
  };
}

const PROVIDER_BINDING_INSERT = `INSERT INTO onetime.provider_registry_binding_v21 (
  registry_binding_key, provider, product_key, runtime_tier,
  verification_environment_id, provider_account_ref_hash,
  allowed_operation_types, mutation_policy, active, registry_evidence_digest,
  provider_readback_evidence_digest, observed_at, version, created_at, updated_at
) VALUES ($1, $2, $3, 'isolated_staging', 'ci', $4, $5::text[], $6, false, $7, $8, $9, 1, $9, $9)`;

function providerBindingValues(overrides: {
  bindingKey: string;
  provider?: string;
  allowedOperationTypes?: Array<string | null>;
  mutationPolicy?: string;
  registryDigest?: string;
}): unknown[] {
  return [
    overrides.bindingKey,
    overrides.provider ?? 'resend',
    PRODUCT_KEY,
    'a'.repeat(64),
    overrides.allowedOperationTypes ?? ['send_transactional'],
    overrides.mutationPolicy ?? 'allowed',
    overrides.registryDigest ?? 'b'.repeat(64),
    'c'.repeat(64),
    CI_TIMESTAMP,
  ];
}

async function expectDatabaseRejection(
  pool: pg.Pool,
  label: string,
  operation: (client: pg.PoolClient) => Promise<unknown>,
  expectedCodes: readonly string[],
) {
  const client = await pool.connect();
  let rejection: unknown;
  try {
    await client.query('BEGIN');
    try {
      await operation(client);
    } catch (error) {
      rejection = error;
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  assert(rejection !== undefined, `${label} unexpectedly succeeded`);
  const code = databaseErrorCode(rejection);
  assert(
    expectedCodes.includes(code),
    `${label} failed with unexpected SQLSTATE ${code || 'none'}`,
  );
}

function contentApprovalEvidence(): ContentApprovalEvidence {
  return {
    accountKey: 'candidate-account',
    productKey: PRODUCT_KEY,
    contentId: 'candidate-content-raw-id',
    contentVersionId: 'candidate-content-version',
    contentVersionDigest: '1'.repeat(64),
    sourceId: 'candidate-source',
    sourceSha256: '2'.repeat(64),
    sourceObjectVersionId: 'candidate-object-version',
    participantSetVersion: '3'.repeat(64),
    participantSnapshotDigest: '4'.repeat(64),
    participantReviewState: 'complete',
    unresolvedParticipantCount: 0,
    requiredRedactionCount: 1,
    completedRedactionCount: 1,
    redactionReviewDigest: '5'.repeat(64),
    title: 'Candidate Berachos Review',
    englishTranscriptText: 'Synthetic candidate transcript.',
    classTopic: 'Berachos',
    mishnahReferences: ['Berachos 1:1'],
    occurredAt: CI_TIMESTAMP,
    durationMs: 60_000,
    approvedByAdminId: 'candidate-admin',
    approvedAt: CI_TIMESTAMP,
    artifacts: [],
    approvedArtifactSetDigest: '6'.repeat(64),
    sourceEvidenceDigest: '7'.repeat(64),
    projectionDigest: '8'.repeat(64),
  };
}

function contentPublicationRecord(evidence: ContentApprovalEvidence): ContentPublicationRecord {
  return {
    accountKey: evidence.accountKey,
    productKey: evidence.productKey,
    contentId: evidence.contentId,
    contentVersionId: evidence.contentVersionId,
    contentVersionDigest: evidence.contentVersionDigest,
    participantSetVersion: evidence.participantSetVersion,
    participantSnapshotSetDigest: evidence.participantSnapshotDigest,
    participantReviewState: evidence.participantReviewState,
    unresolvedParticipantCount: evidence.unresolvedParticipantCount,
    requiredRedactionCount: evidence.requiredRedactionCount,
    completedRedactionCount: evidence.completedRedactionCount,
    redactionReviewDigest: evidence.redactionReviewDigest,
    version: 1,
    state: 'needs_review',
    title: evidence.title,
    englishTranscriptText: evidence.englishTranscriptText,
    classTopic: evidence.classTopic,
    mishnahReferences: evidence.mishnahReferences,
    occurredAt: evidence.occurredAt,
    updatedAt: evidence.approvedAt,
    durationMs: evidence.durationMs,
    approval: null,
    publicationGeneration: 0,
    playbackGrantGeneration: 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: null,
    providerReadbackDigest: null,
    publishedAt: null,
    archivedAt: null,
    occurrenceRelations: [],
  };
}

async function readContentEvents(pool: pg.Pool, contentId: string) {
  const result = await pool.query<{
    aggregate_key: string;
    next_state: string;
    resulting_version: string | number;
  }>(
    `SELECT aggregate_key, next_state, resulting_version
       FROM onetime.canonical_state_transition_events
      WHERE aggregate_kind = 'content' AND aggregate_key = $1
      ORDER BY expected_version`,
    [contentId],
  );
  return result.rows;
}

function requiredMigration(rows: readonly LedgerRow[], prefix: string): LedgerRow {
  const matches = rows.filter((row) => row.id.startsWith(prefix));
  assert(matches.length === 1, `expected exactly one migration with prefix ${prefix}`);
  return matches[0]!;
}

function migrationOrdinal(id: string) {
  const match = /^(\d+)_/.exec(id);
  assert(match, `migration id has no ordinal: ${id}`);
  return Number(match[1]);
}

function digestLedger(rows: readonly LedgerRow[]) {
  const bytes = rows.map((row) => `${row.id}\0${row.checksum}\n`).join('');
  return createHash('sha256').update(bytes).digest('hex');
}

async function dropExactDatabase(adminPool: pg.Pool, databaseName: string) {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
}

async function databaseIsAbsent(adminPool: pg.Pool, databaseName: string) {
  const result = await adminPool.query<{ present: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS present',
    [databaseName],
  );
  return result.rows[0]?.present === false;
}

function quoteIdentifier(identifier: string) {
  assert(/^[a-z0-9_]+$/.test(identifier), `unsafe database identifier: ${identifier}`);
  return `"${identifier}"`;
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
}

function toolOutput(command: string, args: readonly string[]) {
  if (process.platform === 'win32' && command === 'npm') {
    assert(
      args.length === 1 && args[0] === '--version',
      'Windows npm proof invocation must be the exact version readback',
    );
    return execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm --version'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
  return execFileSync(command, [...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await main();
