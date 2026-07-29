import type {
  ContentPublicationOutboxIntent,
  ContentPublicationMaterialization,
  ContentPublicationReceipt,
  ContentPublicationRecord,
  ContentPublicationRepository,
  ContentPublicationUnitOfWork,
  StudentContentAssignment,
  StudentPlaybackAuthorizationFacts,
  StudentContentResume,
} from '../../../../contracts/src/content/publication/index.ts';

export interface ContentPublicationSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
}

export interface ContentPublicationSqlPool {
  connect(): Promise<ContentPublicationSqlClient>;
}

interface ContentRow extends Record<string, unknown> {
  record_json: ContentPublicationRecord;
}

interface ReceiptRow extends Record<string, unknown> {
  receipt_json: ContentPublicationReceipt;
}

interface AssignmentRow extends Record<string, unknown> {
  assignment_json: StudentContentAssignment;
}

interface PlaybackFactsRow extends Record<string, unknown> {
  facts_json: StudentPlaybackAuthorizationFacts;
}

interface ResumeRow extends Record<string, unknown> {
  resume_json: StudentContentResume;
}

export function createPostgresContentPublicationRepository(
  pool: ContentPublicationSqlPool,
): ContentPublicationRepository {
  return {
    async inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(createUnit(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function createUnit(client: ContentPublicationSqlClient): ContentPublicationUnitOfWork {
  return {
    async getContent(contentId) {
      const result = await client.query<ContentRow>(
        `SELECT record_json
           FROM onetime.content_publications
          WHERE content_id = $1
          LIMIT 1
          FOR UPDATE`,
        [contentId],
      );
      return result.rows[0]?.record_json ?? null;
    },

    async saveContent(record, expectedVersion) {
      const result = await client.query(
        `UPDATE onetime.content_publications
            SET version = $2,
                state = $3,
                record_json = $4::jsonb,
                updated_at = $5::timestamptz
          WHERE content_id = $1
            AND version = $6`,
        [
          record.contentId,
          record.version,
          record.state,
          JSON.stringify(record),
          record.updatedAt,
          expectedVersion,
        ],
      );
      requireOne(result.rowCount, 'content_publication_optimistic_conflict');
    },

    async findReceipt(operation, idempotencyKey) {
      const result = await client.query<ReceiptRow>(
        `SELECT receipt_json
           FROM onetime.content_publication_receipts
          WHERE operation = $1
            AND idempotency_key = $2
          LIMIT 1
          FOR UPDATE`,
        [operation, idempotencyKey],
      );
      return result.rows[0]?.receipt_json ?? null;
    },

    async saveReceipt(receipt) {
      const result = await client.query(
        `INSERT INTO onetime.content_publication_receipts (
           operation, idempotency_key, request_hash, content_id, receipt_json, committed_at
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
         ON CONFLICT (operation, idempotency_key) DO NOTHING`,
        [
          receipt.operation,
          receipt.idempotencyKey,
          receipt.requestHash,
          receipt.contentId,
          JSON.stringify(receipt),
          receipt.committedAt,
        ],
      );
      requireOne(result.rowCount, 'content_publication_receipt_conflict');
    },

    async saveOutboxIntent(intent: ContentPublicationOutboxIntent) {
      const result = await client.query(
        `INSERT INTO onetime.content_publication_outbox (
           intent_id, provider_operation_id, provider, content_id, content_version_id,
           publication_generation, operation, idempotency_key, request_hash, state,
           intent_json, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz)
         ON CONFLICT (intent_id) DO NOTHING`,
        [
          intent.intentId,
          intent.providerOperationId,
          intent.provider,
          intent.contentId,
          intent.contentVersionId,
          intent.publicationGeneration,
          intent.operation,
          intent.idempotencyKey,
          intent.requestHash,
          intent.state,
          JSON.stringify(intent),
          intent.createdAt,
        ],
      );
      requireOne(result.rowCount, 'content_publication_outbox_conflict');
    },

    async savePublicationMaterialization(materialization: ContentPublicationMaterialization) {
      for (const assignment of materialization.assignments) {
        const result = await client.query(
          `INSERT INTO onetime.student_content_assignments (
             assignment_id, student_id, household_id, content_id, content_version_id,
             publication_generation, assignment_version, active, assignment_json
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           ON CONFLICT (assignment_id) DO NOTHING`,
          [
            assignment.assignmentId,
            assignment.studentId,
            assignment.householdId,
            assignment.contentId,
            assignment.contentVersionId,
            assignment.publicationGeneration,
            assignment.assignmentVersion,
            assignment.active,
            JSON.stringify(assignment),
          ],
        );
        requireOne(result.rowCount, 'student_content_assignment_conflict');
      }
      for (const projection of materialization.libraryProjections) {
        const result = await client.query(
          `INSERT INTO onetime.student_library_projections (
             projection_id, assignment_id, student_id, household_id, content_id,
             content_version_id, publication_generation, active, projection_json, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
           ON CONFLICT (projection_id) DO NOTHING`,
          [
            projection.projectionId,
            projection.assignmentId,
            projection.studentId,
            projection.householdId,
            projection.contentId,
            projection.contentVersionId,
            projection.publicationGeneration,
            projection.active,
            JSON.stringify(projection),
            projection.createdAt,
          ],
        );
        requireOne(result.rowCount, 'student_library_projection_conflict');
      }
      for (const notice of materialization.notices) {
        const result = await client.query(
          `INSERT INTO onetime.protected_recording_notices (
             notice_id, recipient_kind, recipient_id, student_id, household_id,
             content_id, content_version_id, source_version, delivery_state,
             notice_json, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz)
           ON CONFLICT (notice_id) DO NOTHING`,
          [
            notice.noticeId,
            notice.recipientKind,
            notice.recipientId,
            notice.studentId,
            notice.householdId,
            notice.contentId,
            notice.contentVersionId,
            notice.sourceVersion,
            notice.deliveryState,
            JSON.stringify(notice),
            notice.createdAt,
          ],
        );
        requireOne(result.rowCount, 'protected_recording_notice_conflict');
      }
    },

    async listPublishedContent() {
      const result = await client.query<ContentRow>(
        `SELECT record_json
           FROM onetime.content_publications
          WHERE state = 'published'
          ORDER BY occurred_at DESC, content_id ASC`,
      );
      return result.rows.map((row) => row.record_json);
    },

    async getAssignment(studentId, contentId) {
      const result = await client.query<AssignmentRow>(
        `SELECT assignment_json
           FROM onetime.student_content_assignments
          WHERE student_id = $1
            AND content_id = $2
            AND active = TRUE
          LIMIT 1`,
        [studentId, contentId],
      );
      return result.rows[0]?.assignment_json ?? null;
    },

    async getPlaybackFacts(studentId, contentId) {
      const result = await client.query<PlaybackFactsRow>(
        `SELECT facts_json
           FROM onetime.student_content_playback_facts
          WHERE student_id = $1
            AND content_id = $2
          LIMIT 1`,
        [studentId, contentId],
      );
      return result.rows[0]?.facts_json ?? null;
    },

    async getResume(studentId, contentId) {
      const result = await client.query<ResumeRow>(
        `SELECT resume_json
           FROM onetime.student_content_resume
          WHERE student_id = $1
            AND content_id = $2
          LIMIT 1
          FOR UPDATE`,
        [studentId, contentId],
      );
      return result.rows[0]?.resume_json ?? null;
    },

    async saveResume(resume, expectedVersion) {
      const values = [
        resume.studentId,
        resume.householdId,
        resume.contentId,
        resume.publicationVersion,
        resume.positionMs,
        resume.version,
        JSON.stringify(resume),
        resume.updatedAt,
      ] as const;
      if (expectedVersion === null) {
        const result = await client.query(
          `INSERT INTO onetime.student_content_resume (
             student_id, household_id, content_id, publication_version,
             position_ms, version, resume_json, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)
           ON CONFLICT (student_id, content_id) DO NOTHING`,
          values,
        );
        requireOne(result.rowCount, 'student_content_resume_conflict');
        return;
      }
      const result = await client.query(
        `UPDATE onetime.student_content_resume
            SET household_id = $2,
                publication_version = $4,
                position_ms = $5,
                version = $6,
                resume_json = $7::jsonb,
                updated_at = $8::timestamptz
          WHERE student_id = $1
            AND content_id = $3
            AND version = $9`,
        [...values, expectedVersion],
      );
      requireOne(result.rowCount, 'student_content_resume_conflict');
    },
  };
}

function requireOne(rowCount: number | null | undefined, code: string) {
  if (rowCount !== 1) throw new Error(code);
}
