import type {
  AdultGhlIdentityLink,
  HouseholdProviderMapping,
  ProviderOperation,
  ProviderReconciliationRepository,
} from '../../../contracts/src/providers/v21-provider-core.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = {
  rows: Row[];
  rowCount: number | null;
};

export interface ProviderCoreSqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface ProviderCoreSqlPool {
  connect(): Promise<ProviderCoreSqlClient>;
}

export function createPostgresProviderCoreRepository(pool: ProviderCoreSqlPool) {
  const reconciliation: ProviderReconciliationRepository = {
    async claimAcceptanceUnknown(input) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT j.*, b.registry_binding_key, b.provider_account_ref_hash,
                  b.effect_kind, b.household_id
             FROM onetime.job_outbox AS j
             JOIN onetime.provider_operation_binding AS b ON b.job_id = j.job_id
            WHERE j.product = $1
              AND j.runtime_tier = $2
              AND j.verification_environment_id = $3
              AND j.provider = ANY($4::text[])
              AND j.state = 'acceptance_unknown'
              AND j.unknown_effect = true
            ORDER BY j.updated_at, j.job_id
            LIMIT $5`,
          [
            input.scope.product,
            input.scope.runtime_tier,
            input.scope.verification_environment_id,
            input.provider_keys,
            input.limit,
          ],
        );
        return result.rows.map(mapProviderOperation);
      } finally {
        client.release();
      }
    },

    async persistReconciliation(input) {
      return withTransaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE onetime.job_outbox
              SET state = $1,
                  version = $2,
                  reconciliation_attempts = $3,
                  next_attempt_at = $4,
                  unknown_effect = $5,
                  provider_acceptance_digest = $6,
                  reconciliation_digest = $7,
                  safe_error_code = $8,
                  updated_at = $9
            WHERE job_id = $10
              AND version = $11
              AND state = 'acceptance_unknown'
              AND unknown_effect = true
          RETURNING job_id`,
          [
            input.next.state,
            input.next.version,
            input.next.reconciliation_attempts,
            input.next.next_attempt_at,
            input.next.unknown_effect,
            input.next.provider_acceptance_digest,
            input.next.reconciliation_digest,
            input.next.safe_error_code,
            input.next.updated_at,
            input.prior.job_id,
            input.prior.version,
          ],
        );
        if ((updated.rowCount ?? 0) !== 1) return false;
        await client.query(
          `INSERT INTO onetime.provider_readback_ledger
           (operation_id, operation_version, provider, runtime_tier,
            verification_environment_id, provider_account_ref_hash, disposition,
            provider_resource_ref_hash, reconciliation_digest, observed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (operation_id, operation_version, reconciliation_digest) DO NOTHING`,
          [
            input.readback.operation_id,
            input.next.version,
            input.readback.provider,
            input.readback.scope.runtime_tier,
            input.readback.scope.verification_environment_id,
            input.readback.provider_account_ref_hash,
            input.readback.disposition,
            input.readback.provider_resource_ref_hash,
            input.readback.reconciliation_digest,
            input.readback.observed_at,
          ],
        );
        return true;
      });
    },
  };

  return {
    ...reconciliation,
    async saveAdultGhlIdentityLink(
      link: AdultGhlIdentityLink,
      expectedVersion: number,
    ): Promise<boolean> {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO onetime.adult_ghl_identity_link
           (adult_id, normalized_email_hash, state, verified_contact_ref_hash,
            candidate_contact_ref_hashes, quarantined_outbox_intent_ids,
            suppression_json, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
           ON CONFLICT (adult_id) DO UPDATE SET
             normalized_email_hash = EXCLUDED.normalized_email_hash,
             state = EXCLUDED.state,
             verified_contact_ref_hash = EXCLUDED.verified_contact_ref_hash,
             candidate_contact_ref_hashes = EXCLUDED.candidate_contact_ref_hashes,
             quarantined_outbox_intent_ids = EXCLUDED.quarantined_outbox_intent_ids,
             suppression_json = EXCLUDED.suppression_json,
             version = EXCLUDED.version
           WHERE onetime.adult_ghl_identity_link.version = $9`,
          [
            link.adult_id,
            link.normalized_email_hash,
            link.state,
            link.verified_contact_ref_hash,
            link.candidate_contact_ref_hashes,
            link.quarantined_outbox_intent_ids,
            JSON.stringify(link.suppression),
            link.version,
            expectedVersion,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      } finally {
        client.release();
      }
    },

    async saveHouseholdProviderMapping(
      mapping: HouseholdProviderMapping,
      expectedVersion: number,
    ): Promise<boolean> {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO onetime.household_provider_mapping
           (household_id, owner_adult_id, runtime_tier, verification_environment_id,
            billing_program, ghl_household_record_ref_hash,
            projected_owner_contact_ref_hash, stripe_customer_ref_hash,
            service_reminders_enabled, lifecycle_state, access_projection,
            reconciliation_state, transfer_target_contact_ref_hash,
            provider_revision, last_readback_digest, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (runtime_tier, verification_environment_id, household_id, billing_program)
           DO UPDATE SET
             owner_adult_id = EXCLUDED.owner_adult_id,
             projected_owner_contact_ref_hash = EXCLUDED.projected_owner_contact_ref_hash,
             service_reminders_enabled = EXCLUDED.service_reminders_enabled,
             lifecycle_state = EXCLUDED.lifecycle_state,
             access_projection = EXCLUDED.access_projection,
             reconciliation_state = EXCLUDED.reconciliation_state,
             transfer_target_contact_ref_hash = EXCLUDED.transfer_target_contact_ref_hash,
             provider_revision = EXCLUDED.provider_revision,
             last_readback_digest = EXCLUDED.last_readback_digest,
             version = EXCLUDED.version
           WHERE onetime.household_provider_mapping.version = $17`,
          [
            mapping.household_id,
            mapping.owner_adult_id,
            mapping.runtime_tier,
            mapping.verification_environment_id,
            mapping.billing_program,
            mapping.ghl_household_record_ref_hash,
            mapping.projected_owner_contact_ref_hash,
            mapping.stripe_customer_ref_hash,
            mapping.service_reminders_enabled,
            mapping.lifecycle_state,
            mapping.access_projection,
            mapping.reconciliation_state,
            mapping.transfer_target_contact_ref_hash,
            mapping.provider_revision,
            mapping.last_readback_digest,
            mapping.version,
            expectedVersion,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      } finally {
        client.release();
      }
    },
  };
}

async function withTransaction<T>(
  pool: ProviderCoreSqlPool,
  run: (client: ProviderCoreSqlClient) => Promise<T>,
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

function mapProviderOperation(row: SqlRow): ProviderOperation {
  return {
    job_id: String(row.job_id),
    operation_type: String(row.operation_type),
    aggregate_ref: String(row.aggregate_ref),
    source_version: Number(row.source_version),
    provider: String(row.provider) as ProviderOperation['provider'],
    scope: {
      product: String(row.product) as ProviderOperation['scope']['product'],
      runtime_tier: String(row.runtime_tier) as ProviderOperation['scope']['runtime_tier'],
      verification_environment_id: String(
        row.verification_environment_id,
      ) as ProviderOperation['scope']['verification_environment_id'],
    },
    idempotency_key: String(row.idempotency_key),
    canonical_request_hash: String(row.canonical_request_hash),
    payload_ref: String(row.payload_ref),
    payload_digest: String(row.payload_digest),
    compensation_for_job_id: nullableString(row.compensation_for_job_id),
    state: String(row.state) as ProviderOperation['state'],
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
    registry_binding_key: String(row.registry_binding_key),
    provider_account_ref_hash: String(row.provider_account_ref_hash),
    effect_kind: String(row.effect_kind) as ProviderOperation['effect_kind'],
    household_id: nullableString(row.household_id),
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
