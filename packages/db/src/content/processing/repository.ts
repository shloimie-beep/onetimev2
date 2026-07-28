import type {
  ContentProcessingCommandReceipt,
  ContentProcessingRepository,
  ContentProcessingScope,
  ContentProcessingUnitOfWork,
  ContentProcessingVersion,
  ControlledCaptureEvidence,
  ProcessingArtifact,
} from '../../../../contracts/src/content/processing/index.ts';

export type ContentProcessingSqlResult = {
  rows: readonly Record<string, unknown>[];
};

export interface ContentProcessingSqlClient {
  query(sql: string, values?: readonly unknown[]): Promise<ContentProcessingSqlResult>;
  release?(): void;
}

export interface ContentProcessingSqlPool {
  connect(): Promise<ContentProcessingSqlClient>;
}

export function createContentProcessingRepository(
  pool: ContentProcessingSqlPool,
): ContentProcessingRepository {
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

function createUnit(client: ContentProcessingSqlClient): ContentProcessingUnitOfWork {
  return {
    getVersion: async (scope, contentVersionId) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_processing_versions
          WHERE account_key = $1
            AND product_key = $2
            AND content_version_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, contentVersionId],
      );
      return parseRecord<ContentProcessingVersion>(result.rows[0]?.record_json);
    },
    saveVersion: async (version) => {
      await client.query(
        `INSERT INTO onetime.content_processing_versions
           (content_version_key, account_key, product_key, source_key, source_sha256,
            source_object_version_id, processing_state, retry_state, attempt_count,
            version, record_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
         ON CONFLICT (account_key, product_key, content_version_key)
         DO UPDATE SET
           processing_state = EXCLUDED.processing_state,
           retry_state = EXCLUDED.retry_state,
           attempt_count = EXCLUDED.attempt_count,
           version = EXCLUDED.version,
           record_json = EXCLUDED.record_json,
           updated_at = EXCLUDED.updated_at
         WHERE onetime.content_processing_versions.version = EXCLUDED.version - 1`,
        [
          version.id,
          version.accountKey,
          version.productKey,
          version.sourceId,
          version.sourceSha256,
          version.sourceObjectVersionId,
          version.state,
          version.retryState,
          version.attemptCount,
          version.version,
          JSON.stringify(version),
          version.updatedAt,
        ],
      );
    },
    saveArtifact: async (artifact) => {
      await client.query(
        `INSERT INTO onetime.content_processing_artifacts
           (artifact_key, account_key, product_key, content_version_key, artifact_kind,
            artifact_revision, source_key, source_sha256, source_object_version_id,
            artifact_status, payload_digest, record_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
         ON CONFLICT (account_key, product_key, artifact_key) DO NOTHING`,
        [
          artifact.id,
          artifact.accountKey,
          artifact.productKey,
          artifact.contentVersionId,
          artifact.kind,
          artifact.revision,
          artifact.sourceId,
          artifact.sourceSha256,
          artifact.sourceObjectVersionId,
          artifact.status,
          artifact.payloadDigest,
          JSON.stringify(artifact),
          artifact.createdAt,
          artifact.updatedAt,
        ],
      );
    },
    saveCaptureEvidence: async (scope, evidence) => {
      await client.query(
        `INSERT INTO onetime.content_processing_capture_evidence
           (account_key, product_key, source_key, evidence_version,
            participant_snapshot_digest, checksum_readback_receipt_key,
            linked_ingest_source_key, record_json, captured_at, upload_confirmed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         ON CONFLICT (account_key, product_key, source_key)
         DO UPDATE SET
           record_json = EXCLUDED.record_json,
           upload_confirmed_at = EXCLUDED.upload_confirmed_at`,
        [
          scope.accountKey,
          scope.productKey,
          evidence.sourceId,
          evidence.evidenceVersion,
          evidence.consentedParticipantSnapshotDigest,
          evidence.durableChecksumReadbackReceiptId,
          evidence.linkedIngestSourceId,
          JSON.stringify(evidence),
          evidence.capturedAt,
          evidence.uploadConfirmedAt,
        ],
      );
    },
    getReceipt: async (scope, idempotencyKey) => {
      const result = await client.query(
        `SELECT record_json
           FROM onetime.content_processing_commands
          WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, idempotencyKey],
      );
      return parseRecord<ContentProcessingCommandReceipt>(result.rows[0]?.record_json);
    },
    saveReceipt: async (receipt) => {
      await client.query(
        `INSERT INTO onetime.content_processing_commands
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

export type ContentProcessingSqlScope = ContentProcessingScope;
export type ContentProcessingSqlVersion = ContentProcessingVersion;
export type ContentProcessingSqlArtifact = ProcessingArtifact;
export type ContentProcessingSqlCaptureEvidence = ControlledCaptureEvidence;
