import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';
import {
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  createPostgresGovernedCampaignAudienceDecisionStore,
  governedCampaignDecisionKey,
  governedCampaignRequestHash,
  runMigrations,
  type DbPool,
  type GovernedCampaignAudienceDecisionInput,
  type GovernedCampaignDecisionStoreSqlClient,
  type GovernedCampaignDecisionStoreSqlPool,
  type GovernedCampaignSha256,
  type ReconcileGovernedCampaignAudienceRequest,
} from '../../packages/db/src/index.ts';

const EXPECTED_SERVER_VERSION = '18.4';
const EXPECTED_SERVER_VERSION_NUM = '180004';
const EXPECTED_MIGRATION_COUNT = 92;
const EXPECTED_MIGRATION_SHA256 =
  '93e7879ce7861cd37733335ca64e49310af1025fc099e6bce4abadb8f25c3740';
const MIGRATION_ID = '2260_v21_governed_campaign_audience_decisions';
const CONTACT_A = digest('native-provider-contact-a');
const CONTACT_B = digest('native-provider-contact-b');

type Proof = {
  server_version: '18.4';
  migration_sha256: typeof EXPECTED_MIGRATION_SHA256;
  migration_apply: '91/91';
  migration_replay: '91/91';
  serializable_transaction: true;
  exact_scope_advisory_lock: true;
  current_base_rows_for_update: true;
  concurrent_same_scope_fenced: true;
  positive_maximum_affected_rows: true;
  insert_plus_supersede_ceiling_rollback: true;
  exact_replay_zero_mutations: true;
  idempotency_conflict_rejected: true;
  historical_max_version_reintroduction: true;
  one_way_supersession_and_append: true;
  exact_projection_hash_count_reason_readback: true;
  mismatch_rollback: true;
  unknown_result_rollback_without_retry: true;
  environment_isolation: true;
  sanitized_no_pii_boundary: true;
  contact_effects: 0;
  provider_effects: 0;
  send_effects: 0;
};

export async function proveGovernedCampaignDecisionStorePg18(pool: pg.Pool): Promise<Proof> {
  const store = createPostgresGovernedCampaignAudienceDecisionStore(pool);
  const initial = request({
    idempotencyKey: 'native-initial',
    snapshot: 'native-initial',
    maximumAffectedRows: 2,
    decisions: [decision(CONTACT_A, 1), decision(CONTACT_B, 1)],
  });
  const inserted = await store.reconcile(initial);
  assert(
    inserted.insertedRows === 2 &&
      inserted.supersededRows === 0 &&
      inserted.mutationStatements === 1 &&
      inserted.currentRows === 2 &&
      inserted.reasonCounts[0]?.rows === 2 &&
      inserted.contactEffects === 0 &&
      inserted.providerEffects === 0 &&
      inserted.sendEffects === 0,
    'initial repository write/readback mismatch',
  );

  const replay = await store.reconcile(initial);
  assert(
    replay.replayed &&
      replay.insertedRows === 0 &&
      replay.supersededRows === 0 &&
      replay.affectedRows === 0 &&
      replay.mutationStatements === 0,
    'exact replay was not a zero-mutation transaction',
  );

  await expectStoreCode(
    () =>
      store.reconcile(
        request({
          idempotencyKey: 'native-initial',
          snapshot: 'native-idempotency-conflict',
          maximumAffectedRows: 2,
          decisions: [decision(CONTACT_A, 1), decision(CONTACT_B, 1)],
        }),
      ),
    ['IDEMPOTENCY_CONFLICT'],
  );

  await store.reconcile(
    request({
      idempotencyKey: 'native-omission',
      snapshot: 'native-omission',
      maximumAffectedRows: 3,
      decisions: [decision(CONTACT_B, 2)],
    }),
  );
  const reintroduced = await store.reconcile(
    request({
      idempotencyKey: 'native-reintroduced',
      snapshot: 'native-reintroduced',
      maximumAffectedRows: 2,
      decisions: [decision(CONTACT_A, 2)],
    }),
  );
  assert(
    reintroduced.affectedRows === 2 && (await currentVersion(pool, CONTACT_A)) === 2,
    'reintroduced contact did not advance from maximum immutable history',
  );
  await expectStoreCode(
    () =>
      store.reconcile(
        request({
          idempotencyKey: 'native-stale-reintroduction',
          snapshot: 'native-stale-reintroduction',
          maximumAffectedRows: 2,
          decisions: [decision(CONTACT_B, 2)],
        }),
      ),
    ['DECISION_VERSION_CONFLICT'],
  );

  const concurrentRequests = ['native-concurrent-a', 'native-concurrent-b'].map((key) =>
    store.reconcile(
      request({
        idempotencyKey: key,
        snapshot: key,
        maximumAffectedRows: 2,
        decisions: [decision(CONTACT_A, 3)],
      }),
    ),
  );
  const concurrent = await Promise.allSettled(concurrentRequests);
  const concurrentSuccesses = concurrent.filter((result) => result.status === 'fulfilled');
  const concurrentFailures = concurrent.filter((result) => result.status === 'rejected');
  assert(
    concurrentSuccesses.length === 1 && concurrentFailures.length === 1,
    'same-scope concurrent repository operations were not fenced to one success',
  );
  const concurrentCode = storeErrorCode(concurrentFailures[0]?.reason);
  assert(
    concurrentCode === 'DECISION_VERSION_CONFLICT' ||
      concurrentCode === 'TRANSACTION_FAILED_NO_RETRY',
    `concurrent loser returned unexpected code ${concurrentCode || 'none'}`,
  );
  assert((await currentVersion(pool, CONTACT_A)) === 3, 'concurrent winner projection mismatch');

  await proveCurrentRowFencing(pool);

  await expectStoreCode(
    () =>
      store.reconcile(
        request({
          idempotencyKey: 'native-ceiling',
          snapshot: 'native-ceiling',
          maximumAffectedRows: 1,
          decisions: [decision(CONTACT_A, 4)],
        }),
      ),
    ['AFFECTED_ROWS_CEILING'],
  );
  assert((await currentVersion(pool, CONTACT_A)) === 3, 'ceiling rejection changed projection');

  const mismatchStore = createPostgresGovernedCampaignAudienceDecisionStore(
    interceptFinalProjection(pool, 'mismatch'),
  );
  await expectStoreCode(
    () =>
      mismatchStore.reconcile(
        request({
          idempotencyKey: 'native-mismatch',
          snapshot: 'native-mismatch',
          maximumAffectedRows: 2,
          decisions: [decision(CONTACT_A, 4)],
        }),
      ),
    ['READBACK_MISMATCH'],
  );
  assert((await currentVersion(pool, CONTACT_A)) === 3, 'mismatch rollback changed projection');

  let unknownConnections = 0;
  const unknownStore = createPostgresGovernedCampaignAudienceDecisionStore(
    interceptFinalProjection(pool, 'unknown', () => {
      unknownConnections += 1;
    }),
  );
  await expectStoreCode(
    () =>
      unknownStore.reconcile(
        request({
          idempotencyKey: 'native-unknown',
          snapshot: 'native-unknown',
          maximumAffectedRows: 2,
          decisions: [decision(CONTACT_A, 4)],
        }),
      ),
    ['TRANSACTION_FAILED_NO_RETRY'],
  );
  assert(unknownConnections === 1, 'unknown result was retried automatically');
  assert((await currentVersion(pool, CONTACT_A)) === 3, 'unknown rollback changed projection');

  await store.reconcile(
    request({
      verificationEnvironmentId: 'native-pg18-environment-b',
      idempotencyKey: 'native-environment-b',
      snapshot: 'native-environment-b',
      maximumAffectedRows: 1,
      decisions: [decision(CONTACT_A, 1)],
    }),
  );
  assert(
    (await currentVersion(pool, CONTACT_A, 'native-pg18-environment-b')) === 1,
    'verification environment isolation failed',
  );

  const unsafe = request({
    idempotencyKey: 'native-unsafe',
    snapshot: 'native-unsafe',
    maximumAffectedRows: 2,
    decisions: [decision(CONTACT_A, 4)],
  });
  Object.assign(unsafe.decisions[0]!.sourceFacts, { free_form_note: 'forbidden' });
  await expectStoreCode(() => store.reconcile(unsafe), ['INVALID_REQUEST']);

  return {
    server_version: '18.4',
    migration_sha256: EXPECTED_MIGRATION_SHA256,
    migration_apply: '91/91',
    migration_replay: '91/91',
    serializable_transaction: true,
    exact_scope_advisory_lock: true,
    current_base_rows_for_update: true,
    concurrent_same_scope_fenced: true,
    positive_maximum_affected_rows: true,
    insert_plus_supersede_ceiling_rollback: true,
    exact_replay_zero_mutations: true,
    idempotency_conflict_rejected: true,
    historical_max_version_reintroduction: true,
    one_way_supersession_and_append: true,
    exact_projection_hash_count_reason_readback: true,
    mismatch_rollback: true,
    unknown_result_rollback_without_retry: true,
    environment_isolation: true,
    sanitized_no_pii_boundary: true,
    contact_effects: 0,
    provider_effects: 0,
    send_effects: 0,
  };
}

async function proveCurrentRowFencing(pool: pg.Pool) {
  const holder = await pool.connect();
  const contender = await pool.connect();
  let contenderCode = '';
  try {
    await holder.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const locked = await holder.query(
      `SELECT decision_key
         FROM onetime.governed_campaign_audience_decisions
        WHERE ${scopePredicate()}
          AND superseded_at IS NULL
        FOR UPDATE`,
      scopeValues('native-pg18-environment-a'),
    );
    assert(locked.rowCount === 1, 'current-row fencing preimage was not exactly one row');
    await contender.query('BEGIN');
    await contender.query("SET LOCAL lock_timeout = '250ms'");
    try {
      await contender.query(
        `UPDATE onetime.governed_campaign_audience_decisions
            SET superseded_at = CURRENT_TIMESTAMP
          WHERE ${scopePredicate()}
            AND superseded_at IS NULL`,
        scopeValues('native-pg18-environment-a'),
      );
    } catch (error) {
      contenderCode = databaseErrorCode(error);
    }
    assert(contenderCode === '55P03', `current-row contender returned ${contenderCode || 'none'}`);
  } finally {
    await contender.query('ROLLBACK').catch(() => undefined);
    await holder.query('ROLLBACK').catch(() => undefined);
    contender.release();
    holder.release();
  }
}

function interceptFinalProjection(
  pool: pg.Pool,
  mode: 'mismatch' | 'unknown',
  onConnect: () => void = () => undefined,
): GovernedCampaignDecisionStoreSqlPool {
  return {
    async connect() {
      onConnect();
      const client = await pool.connect();
      let intercepted = false;
      return {
        async query<Row extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          values?: readonly unknown[],
        ) {
          if (
            !intercepted &&
            /FROM onetime\.governed_campaign_audience_current[\s\S]*ORDER BY provider_contact_ref_hash/iu.test(
              text,
            )
          ) {
            intercepted = true;
            if (mode === 'unknown') throw new Error('synthetic unknown projection result');
            const result = await client.query(text, values as unknown[]);
            const rows = result.rows.map((row, index) =>
              index === 0 ? { ...row, decision_key: 'synthetic-readback-mismatch' } : row,
            );
            return { ...result, rows } as { rows: Row[]; rowCount?: number | null };
          }
          return client.query(text, values as unknown[]) as Promise<{
            rows: Row[];
            rowCount?: number | null;
          }>;
        },
        release() {
          client.release();
        },
      } satisfies GovernedCampaignDecisionStoreSqlClient;
    },
  };
}

async function currentVersion(
  pool: pg.Pool,
  providerContactRefHash: GovernedCampaignSha256,
  verificationEnvironmentId = 'native-pg18-environment-a',
) {
  const result = await pool.query<{ decision_version: string | number }>(
    `SELECT decision_version
       FROM onetime.governed_campaign_audience_current
      WHERE ${scopePredicate()}
        AND provider_contact_ref_hash = $10`,
    [...scopeValues(verificationEnvironmentId), providerContactRefHash],
  );
  assert(result.rowCount === 1, 'current-version readback was not exactly one row');
  return Number(result.rows[0]!.decision_version);
}

function request(input: {
  verificationEnvironmentId?: string;
  idempotencyKey: string;
  snapshot: string;
  maximumAffectedRows: number;
  decisions: readonly GovernedCampaignAudienceDecisionInput[];
}): ReconcileGovernedCampaignAudienceRequest {
  const decisions = [...input.decisions].sort(
    (left, right) =>
      left.providerContactRefHash.localeCompare(right.providerContactRefHash) ||
      left.decisionKey.localeCompare(right.decisionKey),
  );
  const withoutHash: Omit<ReconcileGovernedCampaignAudienceRequest, 'requestHash'> = {
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: input.verificationEnvironmentId ?? 'native-pg18-environment-a',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    campaignKey: 'ot-15-former-member-reactivation',
    binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
    idempotencyKey: input.idempotencyKey,
    snapshotHash: digest(input.snapshot),
    sourceObservedAt: '2026-08-04T12:00:00.000Z',
    createdByUserKey: 'ot-live-002-pg18-proof',
    expectedDecisionRows: decisions.length,
    maximumAffectedRows: input.maximumAffectedRows,
    decisions,
  };
  return { ...withoutHash, requestHash: governedCampaignRequestHash(withoutHash) };
}

function decision(
  providerContactRefHash: GovernedCampaignSha256,
  decisionVersion: number,
): GovernedCampaignAudienceDecisionInput {
  return {
    decisionKey: governedCampaignDecisionKey(providerContactRefHash, decisionVersion),
    providerContactRefHash,
    contactKey: null,
    decision: 'include',
    primaryReason: 'eligible_inactive_adult',
    reasonCodes: ['eligible_inactive_adult'],
    sourceFacts: {
      adultEvidenceState: 'proven',
      studentOrMinorState: 'absent',
      schoolContactState: 'absent',
      activeOrCurrentSubscriberState: 'absent',
      consentState: 'opted_in',
      deliverabilityState: 'deliverable',
      providerSuppressionState: 'active',
      identityMatchState: 'exact',
      sourceJoinCount: 1,
      sourceFactsHash: digest(`source-facts-${providerContactRefHash}`),
    },
    decisionVersion,
  };
}

function scopePredicate() {
  return `runtime_tier = $1
    AND verification_environment_id = $2
    AND account_key = $3
    AND product_key = $4
    AND campaign_key = $5
    AND provider_location_id = $6
    AND provider_campaign_id = $7
    AND provider_workflow_id = $8
    AND provider_launch_tag_id = $9`;
}

function scopeValues(verificationEnvironmentId: string) {
  return [
    'isolated_staging',
    verificationEnvironmentId,
    'one_time',
    'one_time_mishnah_class',
    'ot-15-former-member-reactivation',
    GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId,
    GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerCampaignId,
    GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerWorkflowId,
    GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLaunchTagId,
  ];
}

async function expectStoreCode(operation: () => Promise<unknown>, expected: readonly string[]) {
  let error: unknown;
  try {
    await operation();
  } catch (candidate) {
    error = candidate;
  }
  const code = storeErrorCode(error);
  assert(expected.includes(code), `expected ${expected.join('/')} but received ${code || 'none'}`);
}

function storeErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
}

function digest(value: string): GovernedCampaignSha256 {
  return createHash('sha256').update(value).digest('hex') as GovernedCampaignSha256;
}

async function standaloneMain() {
  assertStandaloneBoundary();
  const migration = await readFile(
    path.resolve(
      process.cwd(),
      'packages/db/migrations/2260_v21_governed_campaign_audience_decisions.sql',
    ),
    'utf8',
  );
  assert(
    createHash('sha256').update(migration.replace(/\r\n/gu, '\n')).digest('hex') ===
      EXPECTED_MIGRATION_SHA256,
    'migration 2260 bytes changed',
  );

  const config = adminPoolConfig();
  const adminPool = new pg.Pool(config);
  const databaseName = `onetime_decision_store_pg18_${randomBytes(8).toString('hex')}`;
  let created = false;
  try {
    const version = await adminPool.query<{ server_version: string; server_version_num: string }>(
      `SELECT current_setting('server_version') AS server_version,
              current_setting('server_version_num') AS server_version_num`,
    );
    assert(
      version.rows[0]?.server_version.startsWith(EXPECTED_SERVER_VERSION) &&
        version.rows[0]?.server_version_num === EXPECTED_SERVER_VERSION_NUM,
      `expected PostgreSQL ${EXPECTED_SERVER_VERSION}`,
    );
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    created = true;
    const proofPool = new pg.Pool({ ...config, database: databaseName, max: 8 });
    try {
      const first = await runMigrations(proofPool as unknown as DbPool);
      const replay = await runMigrations(proofPool as unknown as DbPool);
      assert(
        first.length === EXPECTED_MIGRATION_COUNT &&
          first.at(-1)?.id === MIGRATION_ID &&
          first.every(({ status }) => status === 'applied'),
        'fresh PostgreSQL 18 migration apply mismatch',
      );
      assert(
        replay.length === EXPECTED_MIGRATION_COUNT &&
          replay.every(({ status }) => status === 'already_applied'),
        'PostgreSQL 18 migration replay mismatch',
      );
      const proof = await proveGovernedCampaignDecisionStorePg18(proofPool);
      process.stdout.write(`${JSON.stringify({ database_disposition: 'dropped', proof })}\n`);
    } finally {
      await proofPool.end();
    }
  } finally {
    if (created) {
      await adminPool.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
      );
    }
    await adminPool.end();
  }
}

function assertStandaloneBoundary() {
  assert(
    process.env.GOVERNED_CAMPAIGN_DECISION_STORE_ALLOW_DISPOSABLE_POSTGRES_WRITE === 'true',
    'exact disposable PostgreSQL decision-store write authorization is required',
  );
  const host = process.env.PGHOST ?? '127.0.0.1';
  assert(host === '127.0.0.1' || host === 'localhost', 'PostgreSQL host must be loopback');
  assert((process.env.PGDATABASE ?? 'postgres') === 'postgres', 'admin database must be postgres');
  assert((process.env.PGUSER ?? 'postgres') === 'postgres', 'admin user must be postgres');
}

function adminPoolConfig(): pg.PoolConfig {
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

function quoteIdentifier(value: string) {
  assert(/^[a-z0-9_]+$/u.test(value), 'unsafe disposable database identifier');
  return `"${value}"`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entryPath === import.meta.url) await standaloneMain();
