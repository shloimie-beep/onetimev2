import type {
  ContentIngestCommandReceipt,
  ContentIngestRepository,
  ContentIngestScope,
  ContentIngestUnitOfWork,
  ContentSourceLinkRecord,
  ContentSourceRecord,
  DriveFileObservation,
  UploadPartRecord,
  UploadSessionRecord,
} from '../../../../contracts/src/content/ingest/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../index.ts';

export function createContentIngestRepository(pool: DbPool): ContentIngestRepository {
  return {
    inTransaction: (run) => inTransaction(pool, (client) => run(createUnit(client))),
  };
}

function createUnit(client: Queryable): ContentIngestUnitOfWork {
  return {
    getUploadSession: async (scope, uploadSessionId) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_ingest_upload_sessions
          WHERE account_key = $1 AND product_key = $2 AND upload_session_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, uploadSessionId],
      );
      return parseRecord<UploadSessionRecord>(result.rows[0]?.record_json);
    },
    saveUploadSession: async (session) => {
      await client.query(
        `INSERT INTO onetime.content_ingest_upload_sessions
           (upload_session_key, account_key, product_key, idempotency_key, request_hash,
            session_state, declared_byte_count, expires_at, version, record_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         ON CONFLICT (account_key, product_key, upload_session_key)
         DO UPDATE SET
           session_state = EXCLUDED.session_state,
           expires_at = EXCLUDED.expires_at,
           version = EXCLUDED.version,
           record_json = EXCLUDED.record_json,
           updated_at = EXCLUDED.updated_at`,
        [
          session.id,
          session.accountKey,
          session.productKey,
          session.idempotencyKey,
          session.requestHash,
          session.state,
          session.declaredByteCount,
          session.expiresAt,
          session.version,
          JSON.stringify(session),
          session.updatedAt,
        ],
      );
    },
    listUploadParts: async (scope, uploadSessionId) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_ingest_upload_parts
          WHERE account_key = $1 AND product_key = $2 AND upload_session_key = $3
          ORDER BY part_number`,
        [scope.accountKey, scope.productKey, uploadSessionId],
      );
      return result.rows.map((row) => parseRecord<UploadPartRecord>(row.record_json)!);
    },
    saveUploadPart: async (part) => {
      await client.query(
        `INSERT INTO onetime.content_ingest_upload_parts
           (account_key, product_key, upload_session_key, part_number, byte_offset,
            byte_count, part_sha256, provider_part_ref_digest, record_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (account_key, product_key, upload_session_key, part_number)
         DO NOTHING`,
        [
          part.accountKey,
          part.productKey,
          part.uploadSessionId,
          part.partNumber,
          part.byteOffset,
          part.byteCount,
          part.partSha256,
          part.providerPartRefDigest,
          JSON.stringify(part),
        ],
      );
    },
    findSourceByChecksum: async (scope, sha256) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_sources_v21
          WHERE account_key = $1 AND product_key = $2 AND source_sha256 = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, sha256],
      );
      return parseRecord<ContentSourceRecord>(result.rows[0]?.record_json);
    },
    getSource: async (scope, sourceId) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_sources_v21
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, sourceId],
      );
      return parseRecord<ContentSourceRecord>(result.rows[0]?.record_json);
    },
    saveSource: async (source) => {
      await client.query(
        `INSERT INTO onetime.content_sources_v21
           (source_key, account_key, product_key, source_sha256, source_kind,
            lifecycle_state, object_version_id, byte_count, original_preserved,
            version, record_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10::jsonb, $11)
         ON CONFLICT (account_key, product_key, source_sha256)
         DO UPDATE SET
           lifecycle_state = EXCLUDED.lifecycle_state,
           version = EXCLUDED.version,
           record_json = EXCLUDED.record_json,
           updated_at = EXCLUDED.updated_at`,
        [
          source.id,
          source.accountKey,
          source.productKey,
          source.sha256,
          source.sourceKind,
          source.lifecycleState,
          source.objectVersionId,
          source.byteCount,
          source.version,
          JSON.stringify(source),
          source.updatedAt,
        ],
      );
    },
    saveSourceLink: async (link) => {
      await client.query(
        `INSERT INTO onetime.content_source_links_v21
           (source_link_key, account_key, product_key, source_key, source_kind,
            provenance_ref_digest, provider_change_marker, record_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (account_key, product_key, source_link_key) DO NOTHING`,
        [
          link.id,
          link.accountKey,
          link.productKey,
          link.sourceId,
          link.sourceKind,
          link.provenanceRefDigest,
          link.providerChangeMarker ?? null,
          JSON.stringify(link),
        ],
      );
    },
    getDriveObservation: async (scope, driveFileRefDigest) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_drive_observations
          WHERE account_key = $1 AND product_key = $2 AND drive_file_ref_digest = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, driveFileRefDigest],
      );
      return parseRecord<DriveFileObservation>(result.rows[0]?.record_json);
    },
    saveDriveObservation: async (observation) => {
      await client.query(
        `INSERT INTO onetime.content_drive_observations
           (account_key, product_key, drive_file_ref_digest, parent_folder_ref_digest,
            drive_state, change_marker, byte_count, version, record_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         ON CONFLICT (account_key, product_key, drive_file_ref_digest)
         DO UPDATE SET
           drive_state = EXCLUDED.drive_state,
           change_marker = EXCLUDED.change_marker,
           byte_count = EXCLUDED.byte_count,
           version = EXCLUDED.version,
           record_json = EXCLUDED.record_json,
           updated_at = EXCLUDED.updated_at`,
        [
          observation.accountKey,
          observation.productKey,
          observation.driveFileRefDigest,
          observation.parentFolderRefDigest,
          observation.state,
          observation.changeMarker,
          observation.byteCount,
          observation.version,
          JSON.stringify(observation),
          observation.lastObservedAt,
        ],
      );
    },
    getReceipt: async (scope, idempotencyKey) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_ingest_commands
          WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, idempotencyKey],
      );
      return parseRecord<ContentIngestCommandReceipt>(result.rows[0]?.record_json);
    },
    saveReceipt: async (receipt) => {
      await client.query(
        `INSERT INTO onetime.content_ingest_commands
           (account_key, product_key, idempotency_key, request_hash, operation,
            result_ref, result_version, record_json, committed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING`,
        [
          receipt.accountKey,
          receipt.productKey,
          receipt.idempotencyKey,
          receipt.requestHash,
          receipt.operation,
          receipt.resultRef,
          receipt.resultVersion,
          JSON.stringify(receipt),
          receipt.committedAt,
        ],
      );
    },
  };
}

function parseRecord<T>(value: unknown): T | null {
  if (!value) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export type ContentIngestSqlScope = ContentIngestScope;
export type ContentIngestSqlUnit = ContentIngestUnitOfWork;
export type ContentIngestSourceSqlRecord = ContentSourceRecord;
export type ContentIngestSourceLinkSqlRecord = ContentSourceLinkRecord;
