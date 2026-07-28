import type {
  ClaimDueJobsInput,
  JobFoundationRepository,
  JobLeaseToken,
  JobScope,
  ProviderJobRecord,
  RecordDispatchOutcomeInput,
  TransactionalOutboxIntent,
} from '../../../contracts/src/jobs/index.ts';
import {
  heartbeatProviderJob,
  leaseProviderJob,
  markJobInFlight,
  recordDispatchOutcome,
} from '../../../domain/src/jobs/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = {
  rows: Row[];
  rowCount: number | null;
};

export interface JobSqlClient {
  query<Row extends SqlRow = SqlRow>(text: string, values?: unknown[]): Promise<SqlResult<Row>>;
  release(): void;
}

export interface JobSqlPool {
  connect(): Promise<JobSqlClient>;
}

export interface ExecuteTransactionalCommandInput<Response> {
  scope: JobScope;
  actor_ref: string;
  operation_scope: string;
  idempotency_key: string;
  canonical_request_hash: string;
  expected_version: number;
  mutate(
    client: JobSqlClient,
  ): Promise<{
    response: Response;
    resulting_version: number;
    outbox_intents: readonly TransactionalOutboxIntent[];
  }>;
}

export type TransactionalCommandResult<Response> =
  | {
      disposition: 'applied';
      response: Response;
      resulting_version: number;
      outbox_job_ids: readonly string[];
    }
  | {
      disposition: 'replayed';
      response: Response;
      resulting_version: number;
      outbox_job_ids: readonly string[];
    };

export function createPostgresJobFoundationRepository(pool: JobSqlPool) {
  const repository: JobFoundationRepository = {
    async claimDueJobs(input) {
      return withTransaction(pool, async (client) => {
        const candidates = await client.query(
          `SELECT *
             FROM onetime.job_outbox
            WHERE product = $1
              AND runtime_tier = $2
              AND verification_environment_id = $3
              AND operation_type = ANY($4::text[])
              AND state IN ('not_started', 'retry_wait')
              AND unknown_effect = false
              AND dispatch_attempts < 8
              AND (next_attempt_at IS NULL OR next_attempt_at <= $5::timestamptz)
            ORDER BY COALESCE(next_attempt_at, created_at), created_at, job_id
            LIMIT $6
            FOR UPDATE SKIP LOCKED`,
          [
            input.scope.product,
            input.scope.runtime_tier,
            input.scope.verification_environment_id,
            input.operation_types,
            input.now.toISOString(),
            input.limit,
          ],
        );
        const claimed: ProviderJobRecord[] = [];
        for (const row of candidates.rows) {
          const current = mapJobRow(row);
          const next = leaseProviderJob(current, {
            owner: input.owner,
            now: input.now,
            expected_version: current.version,
          });
          claimed.push(await persistTransition(client, current, next));
        }
        return claimed;
      });
    },
    async heartbeat(lease, now) {
      return transitionOwnedJob(pool, lease, async (current, client) => {
        const next = heartbeatProviderJob(current, lease, now);
        const persisted = await persistTransition(client, current, next);
        return leaseFrom(persisted);
      });
    },
    async markInFlight(lease, expectedVersion, now) {
      return transitionOwnedJob(pool, lease, async (current, client) => {
        const next = markJobInFlight(current, lease, expectedVersion, now);
        return persistTransition(client, current, next);
      });
    },
    async recordDispatchOutcome(input) {
      return transitionOwnedJob(pool, input.lease, async (current, client) => {
        const next = recordDispatchOutcome(
          current,
          input.lease,
          input.expected_version,
          input.outcome,
          {
            now: input.now,
            random_unit_interval: input.random_unit_interval,
          },
        );
        return persistTransition(client, current, next);
      });
    },
  };

  return {
    ...repository,
    async executeTransactionalCommand<Response>(
      input: ExecuteTransactionalCommandInput<Response>,
    ): Promise<TransactionalCommandResult<Response>> {
      return withTransaction(pool, async (client) => {
        const lockIdentity = [
          input.scope.product,
          input.scope.runtime_tier,
          input.actor_ref,
          input.operation_scope,
          input.idempotency_key,
        ].join('\u0000');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          lockIdentity,
        ]);
        const existing = await client.query<{
          canonical_request_hash: unknown;
          response_json: unknown;
          resulting_version: unknown;
          outbox_job_ids: unknown;
        }>(
          `SELECT canonical_request_hash, response_json, resulting_version, outbox_job_ids
             FROM onetime.job_command_idempotency
            WHERE product = $1
              AND runtime_tier = $2
              AND actor_ref = $3
              AND operation_scope = $4
              AND idempotency_key = $5
            FOR UPDATE`,
          [
            input.scope.product,
            input.scope.runtime_tier,
            input.actor_ref,
            input.operation_scope,
            input.idempotency_key,
          ],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (String(prior.canonical_request_hash) !== input.canonical_request_hash) {
            throw new Error('job_command_idempotency_conflict');
          }
          return {
            disposition: 'replayed',
            response: prior.response_json as Response,
            resulting_version: Number(prior.resulting_version),
            outbox_job_ids: stringArray(prior.outbox_job_ids),
          };
        }

        const mutation = await input.mutate(client);
        if (mutation.resulting_version !== input.expected_version + 1) {
          throw new Error('job_command_stale_or_nonmonotonic_version');
        }
        for (const intent of mutation.outbox_intents) {
          await insertOutboxIntent(client, intent);
        }
        const outboxJobIds = mutation.outbox_intents.map((intent) => intent.job_id);
        await client.query(
          `INSERT INTO onetime.job_command_idempotency
             (product, runtime_tier, verification_environment_id, actor_ref,
              operation_scope, idempotency_key, canonical_request_hash, response_json,
              resulting_version, outbox_job_ids, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::text[],now())`,
          [
            input.scope.product,
            input.scope.runtime_tier,
            input.scope.verification_environment_id,
            input.actor_ref,
            input.operation_scope,
            input.idempotency_key,
            input.canonical_request_hash,
            JSON.stringify(mutation.response),
            mutation.resulting_version,
            outboxJobIds,
          ],
        );
        return {
          disposition: 'applied',
          response: mutation.response,
          resulting_version: mutation.resulting_version,
          outbox_job_ids: outboxJobIds,
        };
      });
    },
  };
}

async function insertOutboxIntent(
  client: JobSqlClient,
  intent: TransactionalOutboxIntent,
): Promise<void> {
  await client.query(
    `INSERT INTO onetime.job_outbox
       (job_id, operation_type, aggregate_ref, source_version, provider, product,
        runtime_tier, verification_environment_id, idempotency_key,
        canonical_request_hash, payload_ref, payload_digest, compensation_for_job_id,
        state, version, recovery_generation, dispatch_attempts,
        lifetime_dispatch_attempts, reconciliation_attempts, lease_generation,
        unknown_effect, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
             'not_started',1,0,0,0,0,0,false,now(),now())
     ON CONFLICT (product, runtime_tier, verification_environment_id, idempotency_key)
     DO NOTHING`,
    [
      intent.job_id,
      intent.operation_type,
      intent.aggregate_ref,
      intent.source_version,
      intent.provider,
      intent.scope.product,
      intent.scope.runtime_tier,
      intent.scope.verification_environment_id,
      intent.idempotency_key,
      intent.canonical_request_hash,
      intent.payload_ref,
      intent.payload_digest,
      intent.compensation_for_job_id,
    ],
  );
}

async function transitionOwnedJob<T>(
  pool: JobSqlPool,
  lease: JobLeaseToken,
  transition: (current: ProviderJobRecord, client: JobSqlClient) => Promise<T>,
): Promise<T | null> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query(
      `SELECT *
         FROM onetime.job_outbox
        WHERE job_id = $1
          AND lease_owner = $2
          AND lease_generation = $3
          AND lease_expires_at = $4::timestamptz
        FOR UPDATE`,
      [lease.job_id, lease.owner, lease.generation, lease.expires_at],
    );
    const row = selected.rows[0];
    if (!row) return null;
    return transition(mapJobRow(row), client);
  });
}

async function persistTransition(
  client: JobSqlClient,
  prior: ProviderJobRecord,
  next: ProviderJobRecord,
): Promise<ProviderJobRecord> {
  const updated = await client.query(
    `UPDATE onetime.job_outbox
        SET state = $2,
            version = $3,
            recovery_generation = $4,
            dispatch_attempts = $5,
            lifetime_dispatch_attempts = $6,
            reconciliation_attempts = $7,
            lease_owner = $8,
            lease_generation = $9,
            lease_expires_at = $10::timestamptz,
            last_heartbeat_at = $11::timestamptz,
            next_attempt_at = $12::timestamptz,
            unknown_effect = $13,
            provider_acceptance_digest = $14,
            reconciliation_digest = $15,
            safe_error_code = $16,
            updated_at = $17::timestamptz
      WHERE job_id = $1
        AND version = $18
      RETURNING *`,
    [
      next.job_id,
      next.state,
      next.version,
      next.recovery_generation,
      next.dispatch_attempts,
      next.lifetime_dispatch_attempts,
      next.reconciliation_attempts,
      next.lease_owner,
      next.lease_generation,
      next.lease_expires_at,
      next.last_heartbeat_at,
      next.next_attempt_at,
      next.unknown_effect,
      next.provider_acceptance_digest,
      next.reconciliation_digest,
      next.safe_error_code,
      next.updated_at,
      prior.version,
    ],
  );
  const row = updated.rows[0];
  if (!row) throw new Error('job_transition_concurrency_conflict');
  return mapJobRow(row);
}

async function withTransaction<T>(
  pool: JobSqlPool,
  run: (client: JobSqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function mapJobRow(row: SqlRow): ProviderJobRecord {
  return {
    job_id: String(row.job_id),
    operation_type: String(row.operation_type),
    aggregate_ref: String(row.aggregate_ref),
    source_version: Number(row.source_version),
    provider: String(row.provider),
    scope: {
      product: String(row.product) as ProviderJobRecord['scope']['product'],
      runtime_tier: String(row.runtime_tier) as ProviderJobRecord['scope']['runtime_tier'],
      verification_environment_id: String(
        row.verification_environment_id,
      ) as ProviderJobRecord['scope']['verification_environment_id'],
    },
    idempotency_key: String(row.idempotency_key),
    canonical_request_hash: String(row.canonical_request_hash),
    payload_ref: String(row.payload_ref),
    payload_digest: String(row.payload_digest),
    compensation_for_job_id: nullableString(row.compensation_for_job_id),
    state: String(row.state) as ProviderJobRecord['state'],
    version: Number(row.version),
    recovery_generation: Number(row.recovery_generation),
    dispatch_attempts: Number(row.dispatch_attempts),
    lifetime_dispatch_attempts: Number(row.lifetime_dispatch_attempts),
    reconciliation_attempts: Number(row.reconciliation_attempts),
    lease_owner: nullableString(row.lease_owner),
    lease_generation: Number(row.lease_generation),
    lease_expires_at: nullableIso(row.lease_expires_at),
    last_heartbeat_at: nullableIso(row.last_heartbeat_at),
    next_attempt_at: nullableIso(row.next_attempt_at),
    unknown_effect: Boolean(row.unknown_effect),
    provider_acceptance_digest: nullableString(row.provider_acceptance_digest),
    reconciliation_digest: nullableString(row.reconciliation_digest),
    safe_error_code: nullableString(row.safe_error_code),
    created_at: requiredIso(row.created_at),
    updated_at: requiredIso(row.updated_at),
  };
}

function leaseFrom(job: ProviderJobRecord): JobLeaseToken {
  if (job.lease_owner === null || job.lease_expires_at === null) {
    throw new Error('job_lease_missing');
  }
  return {
    job_id: job.job_id,
    owner: job.lease_owner,
    generation: job.lease_generation,
    expires_at: job.lease_expires_at,
    job_version: job.version,
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : requiredIso(value);
}

function requiredIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
