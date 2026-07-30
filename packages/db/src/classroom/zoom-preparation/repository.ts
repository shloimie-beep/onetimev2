import type {
  ClassroomResource,
  OccurrenceRosterSnapshot,
  StudentRegistrant,
  ZoomPreparationCommandReceipt,
  ZoomPreparationRepository,
  ZoomPreparationUnitOfWork,
  ZoomPreparationSaga,
} from '../../../../contracts/src/classroom/zoom-preparation/index.ts';
import type { ProviderOperation } from '../../../../contracts/src/providers/v21-provider-core.ts';

export type ZoomPreparationSqlResult = { rows: readonly Record<string, unknown>[] };
export interface ZoomPreparationSqlClient {
  query(sql: string, values?: readonly unknown[]): Promise<ZoomPreparationSqlResult>;
  release?(): void;
}
export interface ZoomPreparationSqlPool {
  connect(): Promise<ZoomPreparationSqlClient>;
}

export function createZoomPreparationRepository(
  pool: ZoomPreparationSqlPool,
): ZoomPreparationRepository {
  return {
    inTransaction: async (run) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run(createUnit(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release?.();
      }
    },
  };
}

function createUnit(client: ZoomPreparationSqlClient): ZoomPreparationUnitOfWork {
  return {
    getSaga: (scope, id) =>
      read<ZoomPreparationSaga>(client, 'onetime.zoom_preparations', 'preparation_key', scope, id),
    saveSaga: (record) =>
      saveVersioned(client, 'onetime.zoom_preparations', 'preparation_key', record.id, record),
    getRoster: (scope, id) =>
      read<OccurrenceRosterSnapshot>(
        client,
        'onetime.zoom_roster_snapshots',
        'roster_snapshot_key',
        scope,
        id,
      ),
    saveRoster: (record) =>
      insertImmutable(
        client,
        'onetime.zoom_roster_snapshots',
        'roster_snapshot_key',
        record.id,
        record,
      ),
    getClassroomResource: (scope, occurrenceId) =>
      read<ClassroomResource>(
        client,
        'onetime.zoom_classroom_resources',
        'occurrence_key',
        scope,
        occurrenceId,
      ),
    saveClassroomResource: (record) =>
      saveVersioned(
        client,
        'onetime.zoom_classroom_resources',
        'classroom_resource_key',
        record.id,
        record,
      ),
    listRegistrants: async (scope, occurrenceId) => {
      const result = await client.query(
        `SELECT record_json FROM onetime.zoom_student_registrants
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          ORDER BY student_key FOR UPDATE`,
        [scope.accountKey, scope.productKey, occurrenceId],
      );
      return result.rows.map((row) => parse<StudentRegistrant>(row.record_json)!);
    },
    saveRegistrant: (record) =>
      saveVersioned(
        client,
        'onetime.zoom_student_registrants',
        'registrant_key',
        record.id,
        record,
      ),
    saveProviderOperation: async (operation) => {
      const outbox = await client.query(
        `INSERT INTO onetime.job_outbox
           (job_id, operation_type, aggregate_ref, source_version, provider, product,
            runtime_tier, verification_environment_id, idempotency_key,
            canonical_request_hash, payload_ref, payload_digest, compensation_for_job_id,
            state, version, recovery_generation, dispatch_attempts,
            lifetime_dispatch_attempts, reconciliation_attempts, lease_generation,
            unknown_effect, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                 'not_started',1,0,0,0,0,0,false,$14,$15)
         ON CONFLICT (product, runtime_tier, verification_environment_id, idempotency_key)
         DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           WHERE job_outbox.operation_type = EXCLUDED.operation_type
             AND job_outbox.aggregate_ref = EXCLUDED.aggregate_ref
             AND job_outbox.source_version = EXCLUDED.source_version
             AND job_outbox.provider = EXCLUDED.provider
             AND job_outbox.canonical_request_hash = EXCLUDED.canonical_request_hash
             AND job_outbox.payload_digest = EXCLUDED.payload_digest
             AND job_outbox.compensation_for_job_id IS NOT DISTINCT FROM EXCLUDED.compensation_for_job_id
         RETURNING job_id`,
        [
          operation.job_id,
          operation.operation_type,
          operation.aggregate_ref,
          operation.source_version,
          operation.provider,
          operation.scope.product,
          operation.scope.runtime_tier,
          operation.scope.verification_environment_id,
          operation.idempotency_key,
          operation.canonical_request_hash,
          operation.payload_ref,
          operation.payload_digest,
          operation.compensation_for_job_id,
          operation.created_at,
          operation.updated_at,
        ],
      );
      if (String(outbox.rows[0]?.job_id ?? '') !== operation.job_id) {
        throw new Error('job_outbox_idempotency_conflict');
      }
      const binding = await client.query(
        `INSERT INTO onetime.provider_operation_binding
           (job_id, registry_binding_key, provider_account_ref_hash, effect_kind, household_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (job_id) DO UPDATE SET job_id = EXCLUDED.job_id
           WHERE provider_operation_binding.registry_binding_key = EXCLUDED.registry_binding_key
             AND provider_operation_binding.provider_account_ref_hash = EXCLUDED.provider_account_ref_hash
             AND provider_operation_binding.effect_kind = EXCLUDED.effect_kind
             AND provider_operation_binding.household_id IS NOT DISTINCT FROM EXCLUDED.household_id
         RETURNING job_id`,
        [
          operation.job_id,
          operation.registry_binding_key,
          operation.provider_account_ref_hash,
          operation.effect_kind,
          operation.household_id,
        ],
      );
      if (String(binding.rows[0]?.job_id ?? '') !== operation.job_id) {
        throw new Error('provider_operation_binding_conflict');
      }
    },
    getReceipt: async (scope, idempotencyKey) => {
      const result = await client.query(
        `SELECT record_json FROM onetime.zoom_preparation_commands
          WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3 FOR UPDATE`,
        [scope.accountKey, scope.productKey, idempotencyKey],
      );
      return parse<ZoomPreparationCommandReceipt>(result.rows[0]?.record_json);
    },
    saveReceipt: async (record) => {
      await client.query(
        `INSERT INTO onetime.zoom_preparation_commands
           (account_key, product_key, idempotency_key, request_hash, operation,
            result_ref, result_version, record_json, committed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
         ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING`,
        [
          record.accountKey,
          record.productKey,
          record.idempotencyKey,
          record.requestHash,
          record.operation,
          record.resultRef,
          record.resultVersion,
          JSON.stringify(record),
          record.committedAt,
        ],
      );
    },
  };
}

async function read<T>(
  client: ZoomPreparationSqlClient,
  table: string,
  keyColumn: string,
  scope: { accountKey: string; productKey: string },
  id: string,
) {
  const result = await client.query(
    `SELECT record_json FROM ${table}
      WHERE account_key = $1 AND product_key = $2 AND ${keyColumn} = $3 FOR UPDATE`,
    [scope.accountKey, scope.productKey, id],
  );
  return parse<T>(result.rows[0]?.record_json);
}

async function saveVersioned(
  client: ZoomPreparationSqlClient,
  table: string,
  keyColumn: string,
  id: string,
  record: {
    accountKey: string;
    productKey: string;
    version: number;
    updatedAt?: string;
    lastHeartbeatAt?: string;
  },
) {
  const updatedAt = record.updatedAt ?? record.lastHeartbeatAt;
  if (!updatedAt) throw new Error('zoom_preparation_updated_at_required');
  await client.query(
    `INSERT INTO ${table}
       (${keyColumn}, account_key, product_key, version, record_json, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     ON CONFLICT (account_key, product_key, ${keyColumn})
     DO UPDATE SET version=EXCLUDED.version, record_json=EXCLUDED.record_json,
       updated_at=EXCLUDED.updated_at
     WHERE ${table}.version = EXCLUDED.version - 1`,
    [id, record.accountKey, record.productKey, record.version, JSON.stringify(record), updatedAt],
  );
}

async function insertImmutable(
  client: ZoomPreparationSqlClient,
  table: string,
  keyColumn: string,
  id: string,
  record: { accountKey: string; productKey: string },
) {
  await client.query(
    `INSERT INTO ${table} (${keyColumn}, account_key, product_key, record_json)
     VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
    [id, record.accountKey, record.productKey, JSON.stringify(record)],
  );
}

function parse<T>(value: unknown): T | null {
  if (!value) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export type ZoomPreparationSqlSaga = ZoomPreparationSaga;
export type ZoomPreparationSqlRoster = OccurrenceRosterSnapshot;
export type ZoomPreparationSqlResource = ClassroomResource;
export type ZoomPreparationSqlRegistrant = StudentRegistrant;
export type ZoomPreparationSqlOperation = ProviderOperation;
