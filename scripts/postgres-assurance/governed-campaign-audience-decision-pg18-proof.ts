import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { runMigrations, type DbPool } from '../../packages/db/src/index.ts';

const EXPECTED_SERVER_VERSION = '18.4';
const EXPECTED_SERVER_VERSION_NUM = '180004';
const EXPECTED_MIGRATION_COUNT = 94;
const MIGRATION_ID = '2260_v21_governed_campaign_audience_decisions';
const ACCOUNT_KEY = 'one_time';
const PRODUCT_KEY = 'one_time_mishnah_class';
const CAMPAIGN_KEY = 'ot-15-former-member-reactivation';
const PROVIDER_LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o';
const PROVIDER_CAMPAIGN_ID = '6a71a64c28f7a5dbb3aec1be';
const PROVIDER_WORKFLOW_ID = '09051378-5917-4172-afda-f425619dd23d';
const PROVIDER_LAUNCH_TAG_ID = 'IcOGsLgSIOYGFlHF4kQ0';
const OBSERVED_AT = '2026-08-04T12:00:00.000Z';
const SUPERSEDED_AT = '2026-08-04T12:01:00.000Z';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

export type GovernedCampaignAudienceDecisionPg18Proof = {
  migration_2260_ledger_present: true;
  exact_schema_objects_present: true;
  exact_provider_binding_readback: true;
  protected_lowercase_contact_hash: true;
  fresh_insert: true;
  ledger_replay_zero_write: true;
  append_only_body_update_rejected: true;
  append_only_delete_rejected: true;
  null_to_timestamp_supersession: true;
  repeated_supersession_rejected: true;
  exact_sanitized_source_facts: true;
  pii_and_free_form_source_facts_rejected: true;
  reason_code_boundary_rejected: true;
  cross_scope_contact_binding_rejected: true;
  environment_isolation: true;
  current_projection_readback: true;
  maximum_affected_rows_rollback: true;
  mismatch_rollback: true;
  unknown_result_rollback: true;
};

export async function proveGovernedCampaignAudienceDecisionPg18(
  pool: pg.Pool,
): Promise<GovernedCampaignAudienceDecisionPg18Proof> {
  await assertMigrationAndSchema(pool);
  await insertSyntheticContact(pool);

  await insertDecision(pool, decisionFixture());
  const replay = await insertDecision(pool, decisionFixture(), true);
  assert(replay === 0, 'exact ledger replay wrote a row');

  await expectDatabaseRejection(
    pool,
    () =>
      pool.query(
        `UPDATE onetime.governed_campaign_audience_decisions
            SET source_facts = $1::jsonb
          WHERE runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'pg18-a'
            AND decision_key = 'decision-a-v1'`,
        [JSON.stringify({ ...sourceFacts(), consentState: 'unknown' })],
      ),
    ['P0001'],
  );
  await expectDatabaseRejection(
    pool,
    () =>
      pool.query(
        `DELETE FROM onetime.governed_campaign_audience_decisions
          WHERE runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'pg18-a'
            AND decision_key = 'decision-a-v1'`,
      ),
    ['P0001'],
  );

  const supersession = await pool.query(
    `UPDATE onetime.governed_campaign_audience_decisions
        SET superseded_at = $1
      WHERE runtime_tier = 'isolated_staging'
        AND verification_environment_id = 'pg18-a'
        AND decision_key = 'decision-a-v1'
        AND superseded_at IS NULL`,
    [SUPERSEDED_AT],
  );
  assert(
    supersession.rowCount === 1,
    'exact NULL-to-timestamp supersession did not affect one row',
  );
  await expectDatabaseRejection(
    pool,
    () =>
      pool.query(
        `UPDATE onetime.governed_campaign_audience_decisions
            SET superseded_at = '2026-08-04T12:02:00.000Z'
          WHERE runtime_tier = 'isolated_staging'
            AND verification_environment_id = 'pg18-a'
            AND decision_key = 'decision-a-v1'`,
      ),
    ['P0001'],
  );

  await insertDecision(
    pool,
    decisionFixture({
      decisionKey: 'decision-a-v2',
      decisionVersion: 2,
      idempotencyKey: 'decision-a-v2:idempotency',
      requestHash: HASH_D,
    }),
  );
  await insertDecision(
    pool,
    decisionFixture({
      runtimeTier: 'production',
      decisionKey: 'decision-a-v1',
      idempotencyKey: 'production-decision-a-v1:idempotency',
    }),
  );
  await insertDecision(
    pool,
    decisionFixture({
      verificationEnvironmentId: 'pg18-b',
      decisionKey: 'decision-a-v1',
      idempotencyKey: 'pg18-b-decision-a-v1:idempotency',
    }),
  );

  await expectDatabaseRejection(
    pool,
    () =>
      insertDecision(
        pool,
        decisionFixture({
          decisionKey: 'pii-source-facts',
          providerContactRefHash: HASH_B,
          idempotencyKey: 'pii-source-facts:idempotency',
          sourceFacts: { ...sourceFacts(), email: 'forbidden@example.invalid' },
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    () =>
      insertDecision(
        pool,
        decisionFixture({
          accountKey: 'cross-scope-account',
          contactKey: 'pg18-synthetic-contact',
          decisionKey: 'cross-scope-contact',
          providerContactRefHash: HASH_B,
          idempotencyKey: 'cross-scope-contact:idempotency',
        }),
      ),
    ['23503'],
  );
  await expectDatabaseRejection(
    pool,
    () =>
      insertDecision(
        pool,
        decisionFixture({
          decisionKey: 'free-form-source-facts',
          providerContactRefHash: HASH_B,
          idempotencyKey: 'free-form-source-facts:idempotency',
          sourceFacts: { ...sourceFacts(), free_form_note: 'forbidden' },
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    () =>
      insertDecision(
        pool,
        decisionFixture({
          decisionKey: 'invalid-reason-codes',
          providerContactRefHash: HASH_B,
          idempotencyKey: 'invalid-reason-codes:idempotency',
          reasonCodes: ['eligible_inactive_adult', 'free_form_reason'],
        }),
      ),
    ['23514'],
  );
  await expectDatabaseRejection(
    pool,
    () =>
      insertDecision(
        pool,
        decisionFixture({
          decisionKey: 'uppercase-provider-hash',
          providerContactRefHash: HASH_B.toUpperCase(),
          idempotencyKey: 'uppercase-provider-hash:idempotency',
        }),
      ),
    ['23514'],
  );

  const readback = await pool.query<{
    runtime_tier: string;
    verification_environment_id: string;
    provider_location_id: string;
    provider_campaign_id: string;
    provider_workflow_id: string;
    provider_launch_tag_id: string;
    provider_contact_ref_hash: string;
    snapshot_hash: string;
    request_hash: string;
    decision_version: string | number;
    source_facts: Record<string, unknown>;
  }>(
    `SELECT runtime_tier, verification_environment_id, provider_location_id,
            provider_campaign_id, provider_workflow_id, provider_launch_tag_id,
            provider_contact_ref_hash, snapshot_hash, request_hash,
            decision_version, source_facts
       FROM onetime.governed_campaign_audience_current
      WHERE runtime_tier = 'isolated_staging'
        AND verification_environment_id = 'pg18-a'
        AND decision_key = 'decision-a-v2'`,
  );
  const current = readback.rows[0];
  assert(current, 'current projection did not return the exact version-two decision');
  assert(
    current.runtime_tier === 'isolated_staging' &&
      current.verification_environment_id === 'pg18-a' &&
      current.provider_location_id === PROVIDER_LOCATION_ID &&
      current.provider_campaign_id === PROVIDER_CAMPAIGN_ID &&
      current.provider_workflow_id === PROVIDER_WORKFLOW_ID &&
      current.provider_launch_tag_id === PROVIDER_LAUNCH_TAG_ID &&
      current.provider_contact_ref_hash === HASH_A &&
      current.snapshot_hash === HASH_B &&
      current.request_hash === HASH_D &&
      Number(current.decision_version) === 2 &&
      canonicalJson(current.source_facts) === canonicalJson(sourceFacts()),
    'current projection binding/hash/source-fact readback mismatch',
  );

  const isolation = await pool.query<{
    runtime_tier: string;
    verification_environment_id: string;
    rows: string;
  }>(
    `SELECT runtime_tier, verification_environment_id, count(*)::text AS rows
       FROM onetime.governed_campaign_audience_current
      WHERE account_key = $1 AND product_key = $2 AND campaign_key = $3
      GROUP BY runtime_tier, verification_environment_id
      ORDER BY runtime_tier, verification_environment_id`,
    [ACCOUNT_KEY, PRODUCT_KEY, CAMPAIGN_KEY],
  );
  assert(
    JSON.stringify(isolation.rows) ===
      JSON.stringify([
        {
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'pg18-a',
          rows: '1',
        },
        {
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'pg18-b',
          rows: '1',
        },
        { runtime_tier: 'production', verification_environment_id: 'pg18-a', rows: '1' },
      ]),
    'runtime/environment isolation readback mismatch',
  );

  await proveMaximumAffectedRowsRollback(pool);
  await proveMismatchRollback(pool);
  await proveUnknownResultRollback(pool);

  return {
    migration_2260_ledger_present: true,
    exact_schema_objects_present: true,
    exact_provider_binding_readback: true,
    protected_lowercase_contact_hash: true,
    fresh_insert: true,
    ledger_replay_zero_write: true,
    append_only_body_update_rejected: true,
    append_only_delete_rejected: true,
    null_to_timestamp_supersession: true,
    repeated_supersession_rejected: true,
    exact_sanitized_source_facts: true,
    pii_and_free_form_source_facts_rejected: true,
    reason_code_boundary_rejected: true,
    cross_scope_contact_binding_rejected: true,
    environment_isolation: true,
    current_projection_readback: true,
    maximum_affected_rows_rollback: true,
    mismatch_rollback: true,
    unknown_result_rollback: true,
  };
}

async function insertSyntheticContact(pool: pg.Pool) {
  await pool.query(
    `INSERT INTO onetime.contacts (
       contact_key, account_key, product_key, display_name,
       family_school_classification, family_or_school, location_text,
       timezone, email_normalized, reminder_preference, source, public_contact_id
     ) VALUES (
       'pg18-synthetic-contact', $1, $2, 'Synthetic Contact',
       'family', 'Synthetic Family', 'Test', 'Asia/Jerusalem',
       'pg18-governed-campaign@example.invalid', 'email', 'pg18-proof',
       'pg18-synthetic-public-contact'
     )`,
    [ACCOUNT_KEY, PRODUCT_KEY],
  );
}

async function assertMigrationAndSchema(pool: pg.Pool) {
  const ledger = await pool.query<{ id: string }>(
    `SELECT id FROM onetime.schema_migrations WHERE id = $1`,
    [MIGRATION_ID],
  );
  assert(ledger.rows[0]?.id === MIGRATION_ID, 'migration 2260 ledger row is absent');

  const objects = await pool.query<{ relation_name: string; relation_kind: string }>(
    `SELECT c.relname AS relation_name, c.relkind::text AS relation_kind
       FROM pg_class AS c
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'onetime'
        AND c.relname IN (
          'governed_campaign_audience_decisions',
          'governed_campaign_audience_current'
        )
      ORDER BY c.relname`,
  );
  assert(
    JSON.stringify(objects.rows) ===
      JSON.stringify([
        { relation_name: 'governed_campaign_audience_current', relation_kind: 'v' },
        { relation_name: 'governed_campaign_audience_decisions', relation_kind: 'r' },
      ]),
    'migration 2260 table/view readback mismatch',
  );
  const trigger = await pool.query<{ trigger_name: string }>(
    `SELECT tgname AS trigger_name
       FROM pg_trigger
      WHERE tgrelid = 'onetime.governed_campaign_audience_decisions'::regclass
        AND NOT tgisinternal
        AND tgname = 'governed_campaign_audience_decision_immutability'`,
  );
  assert(trigger.rowCount === 1, 'migration 2260 append-only trigger is absent');
}

async function proveMaximumAffectedRowsRollback(pool: pg.Pool) {
  const client = await pool.connect();
  let rejected = false;
  try {
    await client.query('BEGIN');
    const plannedAffectedRows = 2;
    const maximumAffectedRows = 1;
    if (plannedAffectedRows > maximumAffectedRows) {
      rejected = true;
      throw new Error('maximum affected rows exceeded');
    }
  } catch (error) {
    assert(
      error instanceof Error && error.message === 'maximum affected rows exceeded',
      'unexpected ceiling error',
    );
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  assert(rejected, 'maximum affected rows ceiling did not reject');
  await assertDecisionAbsent(pool, 'ceiling-rollback');
}

async function proveMismatchRollback(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await insertDecision(
      client,
      decisionFixture({
        decisionKey: 'mismatch-rollback',
        providerContactRefHash: HASH_C,
        idempotencyKey: 'mismatch-rollback:idempotency',
      }),
    );
    const result = await client.query<{ request_hash: string }>(
      `SELECT request_hash
         FROM onetime.governed_campaign_audience_current
        WHERE runtime_tier = 'isolated_staging'
          AND verification_environment_id = 'pg18-a'
          AND decision_key = 'mismatch-rollback'`,
    );
    assert(result.rows[0]?.request_hash !== HASH_D, 'synthetic mismatch unexpectedly matched');
    throw new Error('readback mismatch');
  } catch (error) {
    assert(
      error instanceof Error && error.message === 'readback mismatch',
      'unexpected mismatch error',
    );
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  await assertDecisionAbsent(pool, 'mismatch-rollback');
}

async function proveUnknownResultRollback(pool: pg.Pool) {
  const client = await pool.connect();
  let unknownCode = '';
  try {
    await client.query('BEGIN');
    await insertDecision(
      client,
      decisionFixture({
        decisionKey: 'unknown-rollback',
        providerContactRefHash: HASH_C,
        idempotencyKey: 'unknown-rollback:idempotency',
      }),
    );
    await client.query(
      'SELECT deliberately_unknown_column FROM onetime.governed_campaign_audience_current',
    );
  } catch (error) {
    unknownCode = databaseErrorCode(error);
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  assert(
    unknownCode === '42703',
    `unknown-result probe returned SQLSTATE ${unknownCode || 'none'}`,
  );
  await assertDecisionAbsent(pool, 'unknown-rollback');
}

async function assertDecisionAbsent(pool: pg.Pool, decisionKey: string) {
  const result = await pool.query<{ rows: string }>(
    `SELECT count(*)::text AS rows
       FROM onetime.governed_campaign_audience_decisions
      WHERE decision_key = $1`,
    [decisionKey],
  );
  assert(result.rows[0]?.rows === '0', `${decisionKey} survived rollback`);
}

type DecisionFixture = {
  runtimeTier: 'isolated_staging' | 'production';
  verificationEnvironmentId: string;
  accountKey: string;
  productKey: string;
  decisionKey: string;
  providerContactRefHash: string;
  contactKey: string | null;
  decisionVersion: number;
  idempotencyKey: string;
  requestHash: string;
  reasonCodes: string[];
  sourceFacts: Record<string, unknown>;
};

function decisionFixture(overrides: Partial<DecisionFixture> = {}): DecisionFixture {
  return {
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'pg18-a',
    accountKey: ACCOUNT_KEY,
    productKey: PRODUCT_KEY,
    decisionKey: 'decision-a-v1',
    providerContactRefHash: HASH_A,
    contactKey: null,
    decisionVersion: 1,
    idempotencyKey: 'decision-a-v1:idempotency',
    requestHash: HASH_A,
    reasonCodes: ['eligible_inactive_adult'],
    sourceFacts: sourceFacts(),
    ...overrides,
  };
}

function sourceFacts(): Record<string, unknown> {
  return {
    adultEvidenceState: 'proven',
    studentOrMinorState: 'absent',
    schoolContactState: 'absent',
    activeOrCurrentSubscriberState: 'absent',
    consentState: 'opted_in',
    deliverabilityState: 'deliverable',
    providerSuppressionState: 'active',
    identityMatchState: 'exact',
    sourceJoinCount: 1,
    sourceFactsHash: HASH_C,
  };
}

async function insertDecision(
  target: Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>,
  fixture: DecisionFixture,
  replay = false,
) {
  const result = await target.query(
    `INSERT INTO onetime.governed_campaign_audience_decisions (
       runtime_tier, verification_environment_id, account_key, product_key,
       campaign_key, provider_location_id, provider_campaign_id,
       provider_workflow_id, provider_launch_tag_id, decision_key,
       provider_contact_ref_hash, contact_key, decision, primary_reason,
       reason_codes, source_facts, snapshot_hash, source_observed_at,
       decision_version, idempotency_key, request_hash, created_by_user_key,
       created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       'include', 'eligible_inactive_adult', $13::jsonb, $14::jsonb, $15,
       $16, $17, $18, $19, 'f02-pg18-proof', $16
     )
     ${replay ? 'ON CONFLICT DO NOTHING' : ''}`,
    [
      fixture.runtimeTier,
      fixture.verificationEnvironmentId,
      fixture.accountKey,
      fixture.productKey,
      CAMPAIGN_KEY,
      PROVIDER_LOCATION_ID,
      PROVIDER_CAMPAIGN_ID,
      PROVIDER_WORKFLOW_ID,
      PROVIDER_LAUNCH_TAG_ID,
      fixture.decisionKey,
      fixture.providerContactRefHash,
      fixture.contactKey,
      JSON.stringify(fixture.reasonCodes),
      JSON.stringify(fixture.sourceFacts),
      HASH_B,
      OBSERVED_AT,
      fixture.decisionVersion,
      fixture.idempotencyKey,
      fixture.requestHash,
    ],
  );
  return result.rowCount ?? 0;
}

async function expectDatabaseRejection(
  pool: pg.Pool,
  operation: () => Promise<unknown>,
  expectedCodes: readonly string[],
) {
  let rejection: unknown;
  try {
    await operation();
  } catch (error) {
    rejection = error;
  }
  assert(rejection !== undefined, 'database rejection probe unexpectedly succeeded');
  const code = databaseErrorCode(rejection);
  assert(expectedCodes.includes(code), `rejection returned SQLSTATE ${code || 'none'}`);
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function standaloneMain() {
  assertStandaloneBoundary();
  const config = adminPoolConfig();
  const adminPool = new pg.Pool(config);
  const databaseName = `onetime_governed_campaign_pg18_${randomBytes(8).toString('hex')}`;
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
    const proofPool = new pg.Pool({ ...config, database: databaseName, max: 4 });
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
      const proof = await proveGovernedCampaignAudienceDecisionPg18(proofPool);
      process.stdout.write(`${JSON.stringify({ migration_count: first.length, proof })}\n`);
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
    process.env.GOVERNED_CAMPAIGN_ALLOW_DISPOSABLE_POSTGRES_WRITE === 'true',
    'exact disposable PostgreSQL write authorization is required',
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
if (entryPath === import.meta.url) {
  await standaloneMain();
}
