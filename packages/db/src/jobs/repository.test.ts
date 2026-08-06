import { describe, expect, it, vi } from 'vitest';

import type { TransactionalOutboxIntent } from '../../../contracts/src/jobs/index.ts';
import {
  createPostgresJobFoundationRepository,
  type JobSqlClient,
  type JobSqlPool,
} from './repository.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const JOB_ID = 'job-ot16-exact';
const SCOPE = {
  product: 'one_time_mishnayos' as const,
  runtime_tier: 'isolated_staging' as const,
  verification_environment_id: 'ci' as const,
};

describe('F05 PostgreSQL exact-job and transactional post-outbox boundary', () => {
  it('claims only explicitly fenced job identities and treats an empty fence as no work', async () => {
    const capture = capturingPool(() => ({ rows: [], rowCount: 0 }));
    const repository = createPostgresJobFoundationRepository(capture.pool);

    await expect(
      repository.claimDueJobs({
        owner: 'worker-ot16',
        now: new Date('2026-08-06T03:00:00.000Z'),
        limit: 1,
        scope: SCOPE,
        operation_types: ['ghl.workflow.ot16_checkpoint'],
        job_ids: [JOB_ID, JOB_ID],
      }),
    ).resolves.toEqual([]);

    const selection = capture.queries.find((query) =>
      query.text.includes('FROM onetime.job_outbox'),
    );
    expect(selection?.text).toContain('job_id = ANY($7::text[])');
    expect(selection?.values?.[6]).toEqual([JOB_ID]);
    const connectsBeforeEmptyFence = capture.connect.mock.calls.length;
    await expect(
      repository.claimDueJobs({
        owner: 'worker-ot16',
        now: new Date('2026-08-06T03:00:00.000Z'),
        limit: 1,
        scope: SCOPE,
        operation_types: ['ghl.workflow.ot16_checkpoint'],
        job_ids: [],
      }),
    ).resolves.toEqual([]);
    expect(capture.connect).toHaveBeenCalledTimes(connectsBeforeEmptyFence);
  });

  it('runs the payload and provider-binding hook after the outbox row and before idempotency commit', async () => {
    const order: string[] = [];
    const capture = capturingPool((text) => {
      if (text.includes('SELECT canonical_request_hash')) return { rows: [], rowCount: 0 };
      if (text.includes('INSERT INTO onetime.job_outbox')) {
        order.push('outbox');
        return { rows: [{ job_id: JOB_ID }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO onetime.job_command_idempotency')) {
        order.push('idempotency');
      }
      return { rows: [], rowCount: 0 };
    });
    const repository = createPostgresJobFoundationRepository(capture.pool);

    await expect(
      repository.executeTransactionalCommand({
        scope: SCOPE,
        actor_ref: 'adult-ot16',
        operation_scope: 'ghl.workflow.ot16_checkpoint',
        idempotency_key: HASH_A,
        canonical_request_hash: HASH_B,
        expected_version: 0,
        async mutate() {
          return {
            response: { state: 'queued' },
            resulting_version: 1,
            outbox_intents: [intent()],
          };
        },
        async afterOutbox(_client, jobIds) {
          expect(jobIds).toEqual([JOB_ID]);
          order.push('after_outbox');
        },
      }),
    ).resolves.toMatchObject({ disposition: 'applied', outbox_job_ids: [JOB_ID] });
    expect(order).toEqual(['outbox', 'after_outbox', 'idempotency']);
  });
});

function intent(): TransactionalOutboxIntent {
  return {
    job_id: JOB_ID,
    operation_type: 'ghl.workflow.ot16_checkpoint',
    aggregate_ref: 'household-ot16',
    source_version: 1,
    provider: 'highlevel',
    scope: SCOPE,
    idempotency_key: HASH_A,
    canonical_request_hash: HASH_B,
    payload_ref: `ot16-f05:${HASH_A}`,
    payload_digest: HASH_B,
    compensation_for_job_id: null,
  };
}

function capturingPool(
  respond: (
    text: string,
    values?: unknown[],
  ) => { rows: Record<string, unknown>[]; rowCount: number },
) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client: JobSqlClient = {
    async query(text, values) {
      queries.push(values === undefined ? { text } : { text, values });
      return respond(text, values) as never;
    },
    release: vi.fn(),
  };
  const connect = vi.fn(async () => client);
  return { pool: { connect } satisfies JobSqlPool, connect, queries };
}
