import { afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

import { createBroadBoundPublicationRepositories } from '../../../apps/worker/src/runners/content-media/runtime.ts';

const nativeUrl = process.env.CONTENT_MEDIA_BROAD_TEST_DATABASE_URL;
const pool = nativeUrl ? new Pool({ connectionString: nativeUrl }) : null;

afterAll(async () => {
  if (pool) await pool.end();
});

describe.skipIf(!nativeUrl)('production-broad disposable PostgreSQL claims', () => {
  it('leases only approved in-scope work and respects the configured batch ceiling', async () => {
    assertDisposableLoopback(nativeUrl!);
    await pool!.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool!.query('CREATE SCHEMA onetime');
    await createNativeSchema(pool!);
    for (const id of ['eligible-one', 'eligible-two', 'eligible-three']) {
      await insertPublication(pool!, { id });
    }
    await insertPublication(pool!, { id: 'cross-account', accountKey: 'account-other' });
    await insertPublication(pool!, { id: 'unapproved', approved: false });
    await insertPublication(pool!, {
      id: 'canary-scope',
      verificationEnvironmentId: 'production_operator_canary',
    });

    const repositories = createBroadBoundPublicationRepositories({
      pool: pool! as never,
      accountKey: 'account-broad',
      maxBatchSize: 2,
      jobRepository: {
        claimDueJobs: vi.fn(),
        heartbeat: vi.fn(),
        markInFlight: vi.fn(),
        recordDispatchOutcome: vi.fn(),
      } as never,
      publicationRepository: {
        inTransaction: vi.fn(),
        reopenDispatchContext: vi.fn(),
        listAcceptanceUnknownOperations: vi.fn(),
        listAcceptedPendingWork: vi.fn(),
      } as never,
    });
    const claimed = await repositories.jobRepository.claimDueJobs({
      owner: 'worker-broad',
      now: new Date('2026-08-07T12:00:00.000Z'),
      limit: 10,
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_broad',
      },
      operation_types: ['publish_private'],
    });

    expect(claimed).toHaveLength(2);
    expect(claimed.every((job) => job.state === 'leased')).toBe(true);
    const rows = await pool!.query<{ job_id: string; state: string }>(
      `SELECT job_id, state FROM onetime.job_outbox ORDER BY job_id`,
    );
    const state = new Map(rows.rows.map((row) => [row.job_id, row.state]));
    expect(
      ['eligible-one', 'eligible-two', 'eligible-three'].filter((id) => state.get(id) === 'leased'),
    ).toHaveLength(2);
    expect(state.get('cross-account')).toBe('not_started');
    expect(state.get('unapproved')).toBe('not_started');
    expect(state.get('canary-scope')).toBe('not_started');
  }, 30_000);
});

function assertDisposableLoopback(value: string) {
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^onetime_media_broad_/u.test(url.pathname.slice(1))
  ) {
    throw new Error(
      'CONTENT_MEDIA_BROAD_TEST_DATABASE_URL must be an onetime_media_broad_* loopback database',
    );
  }
}

async function createNativeSchema(database: Pool) {
  await database.query(`
    CREATE TABLE onetime.job_outbox (
      job_id text PRIMARY KEY, operation_type text NOT NULL, aggregate_ref text NOT NULL,
      source_version bigint NOT NULL, provider text NOT NULL, product text NOT NULL,
      runtime_tier text NOT NULL, verification_environment_id text NOT NULL,
      idempotency_key text NOT NULL, canonical_request_hash text NOT NULL,
      payload_ref text NOT NULL, payload_digest text NOT NULL,
      compensation_for_job_id text, state text NOT NULL, version bigint NOT NULL,
      recovery_generation integer NOT NULL, dispatch_attempts integer NOT NULL,
      lifetime_dispatch_attempts integer NOT NULL, reconciliation_attempts integer NOT NULL,
      lease_owner text, lease_generation integer NOT NULL, lease_expires_at timestamptz,
      last_heartbeat_at timestamptz, next_attempt_at timestamptz, unknown_effect boolean NOT NULL,
      provider_acceptance_digest text, reconciliation_digest text, safe_error_code text,
      created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
    );
    CREATE TABLE onetime.content_publication_outbox (
      provider_operation_id text PRIMARY KEY, account_key text NOT NULL, product_key text NOT NULL,
      provider text NOT NULL, operation text NOT NULL, content_id text NOT NULL,
      content_version_id text NOT NULL, publication_generation bigint NOT NULL,
      request_hash text NOT NULL, state text NOT NULL, intent_id text NOT NULL,
      intent_json jsonb NOT NULL
    );
    CREATE TABLE onetime.provider_operation_binding (
      job_id text PRIMARY KEY, registry_binding_key text NOT NULL,
      provider_account_ref_hash text NOT NULL, effect_kind text NOT NULL, household_id text
    );
    CREATE TABLE onetime.content_publications (
      account_key text NOT NULL, product_key text NOT NULL, content_id text NOT NULL,
      content_version_id text NOT NULL, publication_generation bigint NOT NULL,
      pending_provider_operation_id text, state text NOT NULL, version bigint NOT NULL,
      record_json jsonb NOT NULL
    );
    CREATE TABLE onetime.content_processing_versions (
      account_key text NOT NULL, product_key text NOT NULL, content_version_key text NOT NULL,
      processing_state text NOT NULL
    );
  `);
}

async function insertPublication(
  database: Pool,
  input: {
    id: string;
    accountKey?: string;
    approved?: boolean;
    verificationEnvironmentId?: string;
  },
) {
  const accountKey = input.accountKey ?? 'account-broad';
  const approved = input.approved ?? true;
  const verificationEnvironmentId = input.verificationEnvironmentId ?? 'production_broad';
  const versionId = `version-${input.id}`;
  const requestHash = input.id.padEnd(64, 'a').slice(0, 64);
  await database.query(
    `INSERT INTO onetime.job_outbox VALUES
       ($1, 'publish_private', $2, 1, 'vimeo', 'one_time_mishnayos', 'production', $3,
        $4, $5, $6, $7, NULL, 'not_started', 1, 0, 0, 0, 0, NULL, 0, NULL, NULL, NULL,
        false, NULL, NULL, NULL, '2026-08-07T11:00:00Z', '2026-08-07T11:00:00Z')`,
    [
      input.id,
      `content-${input.id}`,
      verificationEnvironmentId,
      `idempotency-${input.id}`,
      requestHash,
      versionId,
      'b'.repeat(64),
    ],
  );
  await database.query(
    `INSERT INTO onetime.content_publication_outbox VALUES
       ($1, $2, 'one_time_mishnayos', 'vimeo', 'publish_private', $3, $4, 1, $5,
        'pending', $6, $7::jsonb)`,
    [
      input.id,
      accountKey,
      `content-${input.id}`,
      versionId,
      requestHash,
      `intent-${input.id}`,
      JSON.stringify(approved ? { approvalEvidence: { projectionDigest: 'c'.repeat(64) } } : {}),
    ],
  );
  await database.query(
    `INSERT INTO onetime.provider_operation_binding VALUES
       ($1, 'vimeo_publication_primary', $2, 'mutation', NULL)`,
    [input.id, 'd'.repeat(64)],
  );
  await database.query(
    `INSERT INTO onetime.content_publications VALUES
       ($1, 'one_time_mishnayos', $2, $3, 1, $4, $5, 1, $6::jsonb)`,
    [
      accountKey,
      `content-${input.id}`,
      versionId,
      input.id,
      approved ? 'publishing' : 'needs_review',
      JSON.stringify(approved ? { approval: { projectionDigest: 'c'.repeat(64) } } : {}),
    ],
  );
  await database.query(
    `INSERT INTO onetime.content_processing_versions VALUES
       ($1, 'one_time_mishnayos', $2, $3)`,
    [accountKey, versionId, approved ? 'approved' : 'needs_review'],
  );
}
