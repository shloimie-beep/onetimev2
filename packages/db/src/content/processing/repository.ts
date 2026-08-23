import type {
  ApprovedForPublicationProjectionParams,
  ContentProcessingCommandReceipt,
  ContentProcessingRepository,
  ContentProcessingScope,
  ContentProcessingSource,
  ContentProcessingUnitOfWork,
  ContentProcessingVersion,
  ContentSourceEvidence,
  ProcessingArtifact,
  SourceCompleteApprovedForPublicationProjection,
} from '../../../../contracts/src/content/processing/index.ts';
import type { RecordingParticipantSnapshot } from '../../../../contracts/src/privacy/index.ts';
import {
  buildApprovedForPublicationProjection,
  ContentProcessingError,
} from '../../../../domain/src/content/processing/index.ts';

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
): ContentProcessingRepository & {
  getApprovedForPublicationProjection(
    params: ApprovedForPublicationProjectionParams,
  ): Promise<SourceCompleteApprovedForPublicationProjection | null>;
} {
  return {
    getApprovedForPublicationProjection: async (params) => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `WITH ranked_artifacts AS (
             SELECT artifact_kind, artifact_revision, artifact_key, record_json,
                    ROW_NUMBER() OVER (
                      PARTITION BY account_key, product_key, content_version_key, artifact_kind
                      ORDER BY artifact_revision DESC, artifact_key ASC
                    ) AS latest_rank
               FROM onetime.content_processing_artifacts
              WHERE account_key = $1
                AND product_key = $2
                AND content_version_key = $3
           ),
           participant_snapshots AS (
             SELECT occurrence_id,
                    jsonb_agg(snapshot_json ORDER BY student_id, snapshot_id) AS snapshots_json
               FROM onetime.recording_participant_snapshot
              GROUP BY occurrence_id
           )
           SELECT version_row.record_json AS version_json,
                  source_row.record_json AS source_json,
                  evidence_row.record_json AS evidence_json,
                  snapshot_row.snapshots_json AS snapshots_json,
                  COALESCE(
                    jsonb_agg(artifact_row.record_json ORDER BY artifact_row.artifact_kind)
                      FILTER (WHERE artifact_row.latest_rank = 1),
                    '[]'::jsonb
                  ) AS artifacts_json
             FROM onetime.content_processing_versions AS version_row
             JOIN onetime.content_sources_v21 AS source_row
               ON source_row.account_key = version_row.account_key
              AND source_row.product_key = version_row.product_key
              AND source_row.source_key = version_row.source_key
              AND source_row.source_sha256 = version_row.source_sha256
              AND source_row.object_version_id = version_row.source_object_version_id
             JOIN onetime.content_processing_capture_evidence AS evidence_row
               ON evidence_row.account_key = version_row.account_key
              AND evidence_row.product_key = version_row.product_key
              AND evidence_row.source_key = version_row.source_key
              AND evidence_row.linked_ingest_source_key = version_row.source_key
             LEFT JOIN participant_snapshots AS snapshot_row
               ON snapshot_row.occurrence_id = version_row.record_json->>'contentId'
             LEFT JOIN ranked_artifacts AS artifact_row
               ON artifact_row.latest_rank = 1
            WHERE version_row.account_key = $1
              AND version_row.product_key = $2
              AND version_row.content_version_key = $3
              AND version_row.processing_state = 'approved'
            GROUP BY version_row.record_json, source_row.record_json, evidence_row.record_json,
                     snapshot_row.snapshots_json`,
          [params.accountKey, params.productKey, params.contentVersionId],
        );
        const row = result.rows[0];
        if (!row) return null;
        const version = parseRecord<ContentProcessingVersion>(row.version_json);
        const source = parseRecord<ContentProcessingSource>(row.source_json);
        const captureEvidence = parseRecord<ContentSourceEvidence>(row.evidence_json);
        const artifacts = parseRecord<ProcessingArtifact[]>(row.artifacts_json);
        const recordingParticipantSnapshots =
          parseRecord<RecordingParticipantSnapshot[]>(row.snapshots_json) ?? [];
        if (!version || !source || !captureEvidence || !artifacts) {
          return null;
        }
        try {
          return buildApprovedForPublicationProjection({
            params,
            version: { ...version, artifacts },
            source,
            captureEvidence,
            recordingParticipantSnapshots,
          });
        } catch (error) {
          if (error instanceof ContentProcessingError) return null;
          throw error;
        }
      } finally {
        client.release?.();
      }
    },
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
      if (version.state === 'approved') {
        for (const artifact of version.artifacts) {
          await saveArtifactRecord(client, artifact);
        }
      }
      const recordJson = JSON.stringify(version);
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
          recordJson,
          version.updatedAt,
        ],
      );
      const readback = await client.query(
        `SELECT record_json
           FROM onetime.content_processing_versions
          WHERE account_key = $1
            AND product_key = $2
            AND content_version_key = $3
            AND version = $4
            AND record_json = $5::jsonb`,
        [version.accountKey, version.productKey, version.id, version.version, recordJson],
      );
      if (!readback.rows[0]) {
        throw new ContentProcessingError(
          'content_processing_stale_version',
          'The processing-version write did not survive exact optimistic readback.',
        );
      }
    },
    saveArtifact: async (artifact) => {
      await saveArtifactRecord(client, artifact);
    },
    saveCaptureEvidence: async (scope, evidence) => {
      await client.query(
        `INSERT INTO onetime.content_processing_capture_evidence
           (account_key, product_key, source_key, evidence_version,
            participant_snapshot_digest, source_review_digest, checksum_readback_receipt_key,
            linked_ingest_source_key, record_json, captured_at, upload_confirmed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         ON CONFLICT (account_key, product_key, source_key)
         DO UPDATE SET
           record_json = EXCLUDED.record_json,
           upload_confirmed_at = EXCLUDED.upload_confirmed_at`,
        [
          scope.accountKey,
          scope.productKey,
          evidence.sourceId,
          evidence.evidenceVersion,
          evidence.evidenceVersion === 'OT-OBS-CAPTURE-1'
            ? evidence.consentedParticipantSnapshotDigest
            : null,
          evidence.evidenceVersion === 'OT-EXISTING-REVIEWED-RECORDING-1'
            ? evidence.reviewedSourceDigest
            : null,
          evidence.durableChecksumReadbackReceiptId,
          evidence.linkedIngestSourceId,
          JSON.stringify(evidence),
          evidence.evidenceVersion === 'OT-OBS-CAPTURE-1'
            ? evidence.capturedAt
            : evidence.attestation.humanReviewedAt,
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

async function saveArtifactRecord(
  client: ContentProcessingSqlClient,
  artifact: ProcessingArtifact,
) {
  const recordJson = JSON.stringify(artifact);
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
      recordJson,
      artifact.createdAt,
      artifact.updatedAt,
    ],
  );
  const readback = await client.query(
    `SELECT record_json
       FROM onetime.content_processing_artifacts
      WHERE account_key = $1
        AND product_key = $2
        AND artifact_key = $3
        AND content_version_key = $4
        AND artifact_kind = $5
        AND artifact_revision = $6
        AND source_key = $7
        AND source_sha256 = $8
        AND source_object_version_id = $9
        AND artifact_status = $10
        AND payload_digest = $11
        AND record_json = $12::jsonb`,
    [
      artifact.accountKey,
      artifact.productKey,
      artifact.id,
      artifact.contentVersionId,
      artifact.kind,
      artifact.revision,
      artifact.sourceId,
      artifact.sourceSha256,
      artifact.sourceObjectVersionId,
      artifact.status,
      artifact.payloadDigest,
      recordJson,
    ],
  );
  if (!readback.rows[0]) {
    throw new ContentProcessingError(
      'content_processing_idempotency_conflict',
      'The immutable processing artifact readback did not match the requested revision.',
    );
  }
}

function parseRecord<T>(value: unknown): T | null {
  if (!value) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export type ContentProcessingSqlScope = ContentProcessingScope;
export type ContentProcessingSqlVersion = ContentProcessingVersion;
export type ContentProcessingSqlArtifact = ProcessingArtifact;
export type ContentProcessingSqlCaptureEvidence = ContentSourceEvidence;
