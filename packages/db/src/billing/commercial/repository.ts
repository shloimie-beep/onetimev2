import type {
  CommercialBillingCommandResult,
  CommercialBillingProjection,
  CommercialBillingRepository,
} from '../../../../contracts/src/billing/commercial/index.ts';
import { createPostgresJobFoundationRepository, type JobSqlPool } from '../../jobs/repository.ts';

type StoredCommandResponse =
  | {
      projection: CommercialBillingProjection;
      intent?: CommercialBillingCommandResult['intent'];
    }
  | CommercialBillingProjection;

export function createPostgresCommercialBillingRepository(
  pool: JobSqlPool,
): CommercialBillingRepository {
  const commands = createPostgresJobFoundationRepository(pool);

  return {
    async load(householdId) {
      const client = await pool.connect();
      try {
        const result = await client.query<{ response_json: unknown }>(
          `SELECT response_json
             FROM onetime.job_command_idempotency
            WHERE response_json -> 'projection' ->> 'householdId' = $1
               OR response_json ->> 'householdId' = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [householdId],
        );
        const response = result.rows[0]?.response_json as StoredCommandResponse | undefined;
        if (!response) return null;
        return 'projection' in response ? response.projection : response;
      } finally {
        client.release();
      }
    },

    async replayCommand(input) {
      const client = await pool.connect();
      try {
        const result = await client.query<{
          canonical_request_hash: unknown;
          response_json: unknown;
        }>(
          `SELECT canonical_request_hash, response_json
             FROM onetime.job_command_idempotency
            WHERE actor_ref = $1
              AND operation_scope = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [input.actorRef, input.operationScope, input.idempotencyKey],
        );
        const prior = result.rows[0];
        if (!prior) return null;
        if (String(prior.canonical_request_hash) !== input.canonicalRequestHash) {
          throw new Error('job_command_idempotency_conflict');
        }
        const response = prior.response_json as {
          projection: CommercialBillingProjection;
          intent: CommercialBillingCommandResult['intent'];
        };
        return {
          disposition: 'replayed',
          projection: response.projection,
          intent: response.intent,
        };
      } finally {
        client.release();
      }
    },

    async createSignup(input) {
      const result = await commands.executeTransactionalCommand<{
        projection: CommercialBillingProjection;
      }>({
        scope: input.scope,
        actor_ref: input.projection.ownerAdultId,
        operation_scope: `billing.commercial.signup:${input.projection.householdId}`,
        idempotency_key: input.idempotencyKey,
        canonical_request_hash: input.canonicalRequestHash,
        expected_version: 0,
        async mutate() {
          return {
            response: { projection: input.projection },
            resulting_version: input.projection.version,
            outbox_intents: [],
          };
        },
      });
      return {
        disposition: result.disposition,
        projection: result.response.projection,
      };
    },

    async execute(input) {
      const result = await commands.executeTransactionalCommand<{
        projection: CommercialBillingProjection;
        intent: CommercialBillingCommandResult['intent'];
      }>({
        scope: input.scope,
        actor_ref: input.actorRef,
        operation_scope: input.operationScope,
        idempotency_key: input.idempotencyKey,
        canonical_request_hash: input.canonicalRequestHash,
        expected_version: input.expectedVersion,
        async mutate() {
          return {
            response: {
              projection: input.nextProjection,
              intent: input.intent,
            },
            resulting_version: input.nextProjection.version,
            outbox_intents: [input.intent],
          };
        },
      });
      return {
        disposition: result.disposition,
        projection: result.response.projection,
        intent: result.response.intent,
      };
    },

    async applyEvidence(prior, evidence, nextProjection) {
      const result = await commands.executeTransactionalCommand<{
        projection: CommercialBillingProjection;
      }>({
        scope: evidence.scope,
        actor_ref: 'verified-stripe-evidence',
        operation_scope: `billing.commercial.evidence:${prior.householdId}`,
        idempotency_key: evidence.evidenceId,
        canonical_request_hash: evidence.evidenceDigest,
        expected_version: prior.version,
        async mutate() {
          return {
            response: { projection: nextProjection },
            resulting_version: nextProjection.version,
            outbox_intents: [],
          };
        },
      });
      return {
        disposition: result.disposition,
        projection: result.response.projection,
      };
    },
  };
}
