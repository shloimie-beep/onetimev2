import type { GhlIdentityPlanRepository } from '../../../../contracts/src/communications/ghl-identity/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = { rows: Row[]; rowCount: number | null };

export interface GhlIdentitySqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface GhlIdentitySqlPool {
  connect(): Promise<GhlIdentitySqlClient>;
}

export function createPostgresGhlIdentityRepository(
  pool: GhlIdentitySqlPool,
): GhlIdentityPlanRepository {
  return {
    async persistPlan(plan, expected_version) {
      try {
        return await withTransaction(pool, async (client) => {
          const operation = await client.query(
            `INSERT INTO onetime.ghl_identity_sync_operation
           (operation_id, local_commit_id, adult_id, household_id, classification,
            link_state, review_id, intent_count, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (operation_id) DO UPDATE SET
             classification = EXCLUDED.classification,
             link_state = EXCLUDED.link_state,
             review_id = EXCLUDED.review_id,
             intent_count = EXCLUDED.intent_count,
             version = EXCLUDED.version
           WHERE onetime.ghl_identity_sync_operation.version = $10`,
            [
              plan.operation_id,
              plan.local_commit_id,
              plan.identity_link.adult_id,
              plan.household.household_id,
              plan.adult_classification,
              plan.identity_link.state,
              plan.review_case?.review_id ?? null,
              plan.intents.length,
              expected_version + 1,
              expected_version,
            ],
          );
          if ((operation.rowCount ?? 0) !== 1) throw STALE_WRITE;
          const household = await client.query(
            `INSERT INTO onetime.ghl_household_identity_projection
           (household_id, adult_id, classification, lifecycle_state,
            access_projection, stripe_customer_ref_hash, service_reminders_enabled,
            source_evidence_digest, policy_consent_evidence_digest, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (household_id) DO UPDATE SET
             adult_id = EXCLUDED.adult_id,
             classification = EXCLUDED.classification,
             lifecycle_state = EXCLUDED.lifecycle_state,
             access_projection = EXCLUDED.access_projection,
             stripe_customer_ref_hash = EXCLUDED.stripe_customer_ref_hash,
             service_reminders_enabled = EXCLUDED.service_reminders_enabled,
             source_evidence_digest = EXCLUDED.source_evidence_digest,
             policy_consent_evidence_digest = EXCLUDED.policy_consent_evidence_digest,
             version = EXCLUDED.version
           WHERE onetime.ghl_household_identity_projection.version = $11`,
            [
              plan.household.household_id,
              plan.household.owner_adult_id,
              plan.household.classification,
              plan.household.lifecycle_state,
              plan.household.access_projection,
              plan.household.stripe_customer_ref_hash,
              plan.household.service_reminders_enabled,
              plan.household.source_evidence_digest,
              plan.household.policy_consent_evidence_digest,
              expected_version + 1,
              expected_version,
            ],
          );
          if ((household.rowCount ?? 0) !== 1) throw STALE_WRITE;
          if (plan.review_case !== null) {
            await client.query(
              `INSERT INTO onetime.ghl_identity_review_case
             (review_id, adult_id, household_id, candidate_contact_ref_hashes,
              quarantined_intent_ids, safe_reason, status)
             VALUES ($1,$2,$3,$4,$5,$6,'open')
             ON CONFLICT (review_id) DO NOTHING`,
              [
                plan.review_case.review_id,
                plan.review_case.adult_id,
                plan.review_case.household_id,
                plan.review_case.candidate_contact_ref_hashes,
                plan.review_case.quarantined_intent_ids,
                plan.review_case.safe_reason,
              ],
            );
          }
          return true;
        });
      } catch (error) {
        if (error === STALE_WRITE) return false;
        throw error;
      }
    },

    async markRetry(input) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `UPDATE onetime.ghl_identity_sync_operation
              SET safe_error_code = $1,
                  retry_count = retry_count + 1,
                  version = version + 1
            WHERE operation_id = $2
              AND version = $3`,
          [input.safe_error_code, input.operation_id, input.expected_version],
        );
        return (result.rowCount ?? 0) === 1;
      } finally {
        client.release();
      }
    },
  };
}

const STALE_WRITE = Symbol('ghl_identity_stale_write');

async function withTransaction<T>(
  pool: GhlIdentitySqlPool,
  run: (client: GhlIdentitySqlClient) => Promise<T>,
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
