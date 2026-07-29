import type {
  ClassroomResource,
  LaunchGrantRecord,
  LiveStudentSession,
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
      await client.query(
        `INSERT INTO onetime.provider_operations
           (job_id, provider_key, operation_type, aggregate_ref, source_version,
            idempotency_key, canonical_request_hash, operation_state, record_json, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT (job_id) DO NOTHING`,
        [
          operation.job_id,
          operation.provider,
          operation.operation_type,
          operation.aggregate_ref,
          operation.source_version,
          operation.idempotency_key,
          operation.canonical_request_hash,
          operation.state,
          JSON.stringify(operation),
          operation.updated_at,
        ],
      );
    },
    saveLaunchGrant: (record) =>
      insertImmutable(client, 'onetime.zoom_launch_grants', 'launch_grant_key', record.id, record),
    getLiveSession: async (scope, studentId, occurrenceId) => {
      const result = await client.query(
        `SELECT record_json FROM onetime.zoom_live_student_sessions
          WHERE account_key = $1 AND product_key = $2
            AND student_key = $3 AND occurrence_key = $4 FOR UPDATE`,
        [scope.accountKey, scope.productKey, studentId, occurrenceId],
      );
      return parse<LiveStudentSession>(result.rows[0]?.record_json);
    },
    saveLiveSession: (record) =>
      saveVersioned(
        client,
        'onetime.zoom_live_student_sessions',
        'live_session_key',
        record.id,
        record,
      ),
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
export type ZoomPreparationSqlGrant = LaunchGrantRecord;
export type ZoomPreparationSqlOperation = ProviderOperation;
