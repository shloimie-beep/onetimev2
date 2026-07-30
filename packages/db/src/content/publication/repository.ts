import type {
  CanonicalGovernedOccurrence,
  ContentPublicationOutboxIntent,
  ContentPublicationMaterialization,
  ContentPublicationReceipt,
  ContentPublicationRecord,
  ContentPublicationRepository,
  ContentPublicationUnitOfWork,
  PendingContentPublicationProviderContext,
  StudentContentAssignment,
  StudentPlaybackAuthorizationFacts,
  StudentPublicationEligibility,
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

interface PendingProviderContextRow extends Record<string, unknown> {
  intent_json: ContentPublicationOutboxIntent;
  account_key: string;
  provider_operation_id: string;
  provider_operation_version: number;
  provider: 'vimeo';
  operation: 'publish_private';
  product_key: 'one_time_mishnayos';
  content_id: string;
  content_version_id: string;
  publication_generation: number;
  idempotency_key: string;
  canonical_request_hash: string;
  state: 'accepted';
  unknown_effect: false;
  registry_binding_key: string;
  provider_account_ref_hash: string;
  provider_acceptance_digest: string;
  provider_reconciliation_digest: string | null;
  approval_projection_digest: string;
}

interface CanonicalOccurrenceRow extends Record<string, unknown> {
  account_key: string;
  occurrence_id: string;
  occurrence_version: number;
  canonical_series_id: string;
  product_key: 'one_time_mishnayos';
}

interface PublicationEligibilityRow extends Record<string, unknown> {
  eligibility_json: StudentPublicationEligibility;
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
    async getContent(scope, contentId) {
      const result = await client.query<ContentRow>(
        `SELECT record_json
           FROM onetime.content_publications
          WHERE account_key = $1
            AND product_key = $2
            AND content_id = $3
          LIMIT 1
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, contentId],
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
            AND account_key = $6
            AND product_key = $7
            AND version = $8`,
        [
          record.contentId,
          record.version,
          record.state,
          JSON.stringify(record),
          record.updatedAt,
          record.accountKey,
          record.productKey,
          expectedVersion,
        ],
      );
      requireOne(result.rowCount, 'content_publication_optimistic_conflict');
    },

    async findReceipt(scope, operation, idempotencyKey) {
      const result = await client.query<ReceiptRow>(
        `SELECT receipt_json
           FROM onetime.content_publication_receipts
          WHERE account_key = $1
            AND product_key = $2
            AND operation = $3
            AND idempotency_key = $4
          LIMIT 1
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, operation, idempotencyKey],
      );
      return result.rows[0]?.receipt_json ?? null;
    },

    async saveReceipt(receipt) {
      const result = await client.query(
        `INSERT INTO onetime.content_publication_receipts (
           account_key, product_key, operation, idempotency_key, request_hash,
           content_id, content_version_id, publication_generation,
           approval_projection_digest, receipt_json, committed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz)
         ON CONFLICT (account_key, product_key, operation, idempotency_key) DO NOTHING`,
        [
          receipt.accountKey,
          receipt.productKey,
          receipt.operation,
          receipt.idempotencyKey,
          receipt.requestHash,
          receipt.contentId,
          receipt.contentVersionId,
          receipt.publicationGeneration,
          receipt.approvalProjectionDigest,
          JSON.stringify(receipt),
          receipt.committedAt,
        ],
      );
      requireOne(result.rowCount, 'content_publication_receipt_conflict');
    },

    async saveOutboxIntent(intent: ContentPublicationOutboxIntent) {
      const result = await client.query(
        `INSERT INTO onetime.content_publication_outbox (
           intent_id, account_key, product_key, provider_operation_id, provider, content_id,
           content_version_id, publication_generation, approval_projection_digest,
           operation, idempotency_key, request_hash, state, intent_json, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   $14::jsonb, $15::timestamptz)
         ON CONFLICT (account_key, product_key, intent_id) DO NOTHING`,
        [
          intent.intentId,
          intent.accountKey,
          intent.productKey,
          intent.providerOperationId,
          intent.provider,
          intent.contentId,
          intent.contentVersionId,
          intent.publicationGeneration,
          intent.approvalEvidence.projectionDigest,
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

    async getPendingPublishProviderContext(scope, providerOperationId) {
      const result = await client.query<PendingProviderContextRow>(
        `SELECT o.intent_json,
                o.account_key,
                o.approval_projection_digest,
                j.job_id AS provider_operation_id,
                j.version AS provider_operation_version,
                j.provider,
                j.operation_type AS operation,
                j.product AS product_key,
                j.aggregate_ref AS content_id,
                j.payload_ref AS content_version_id,
                j.source_version AS publication_generation,
                j.idempotency_key,
                j.canonical_request_hash,
                j.state,
                j.unknown_effect,
                b.registry_binding_key,
                b.provider_account_ref_hash,
                j.provider_acceptance_digest,
                j.reconciliation_digest AS provider_reconciliation_digest
           FROM onetime.content_publication_outbox AS o
           JOIN onetime.job_outbox AS j
             ON j.job_id = o.provider_operation_id
           JOIN onetime.provider_operation_binding AS b
             ON b.job_id = j.job_id
          WHERE o.account_key = $1
            AND o.product_key = $2
            AND o.provider_operation_id = $3
            AND o.operation = 'publish_private'
            AND o.state = 'pending'
            AND j.provider = 'vimeo'
            AND j.product = o.product_key
            AND j.operation_type = 'publish_private'
            AND j.state = 'accepted'
            AND j.unknown_effect = FALSE
          LIMIT 1
          FOR UPDATE OF o, j`,
        [scope.accountKey, scope.productKey, providerOperationId],
      );
      return result.rows[0] ? mapPendingProviderContext(result.rows[0]) : null;
    },

    async completePublishProviderOperation(completion) {
      const providerResult = await client.query(
        `UPDATE onetime.job_outbox
            SET state = 'complete',
                version = version + 1,
                updated_at = $12::timestamptz
          WHERE job_id = $1
            AND version = $2
            AND provider = 'vimeo'
            AND operation_type = 'publish_private'
            AND product = $14
            AND aggregate_ref = $3
            AND payload_ref = $4
            AND source_version = $5
            AND canonical_request_hash = $6
            AND state = 'accepted'
            AND unknown_effect = FALSE
            AND provider_acceptance_digest = $7
            AND reconciliation_digest IS NOT DISTINCT FROM $8
            AND EXISTS (
              SELECT 1
                FROM onetime.content_publication_outbox AS o
               WHERE o.intent_id = $9
                 AND o.account_key = $13
                 AND o.product_key = $14
                 AND o.provider_operation_id = $1
                 AND o.content_id = $3
                 AND o.content_version_id = $4
                 AND o.publication_generation = $5
                 AND o.request_hash = $6
                 AND o.approval_projection_digest = $15
                 AND o.state = 'pending'
            )
            AND EXISTS (
              SELECT 1
                FROM onetime.provider_operation_binding AS b
               WHERE b.job_id = $1
                 AND b.registry_binding_key = $10
                 AND b.provider_account_ref_hash = $11
            )`,
        [
          completion.providerOperationId,
          completion.expectedProviderOperationVersion,
          completion.contentId,
          completion.contentVersionId,
          completion.publicationGeneration,
          completion.canonicalRequestHash,
          completion.providerAcceptanceDigest,
          completion.providerReconciliationDigest,
          completion.outboxIntentId,
          completion.registryBindingKey,
          completion.providerAccountRefHash,
          completion.completedAt,
          completion.accountKey,
          completion.productKey,
          completion.approvalProjectionDigest,
        ],
      );
      requireOne(providerResult.rowCount, 'content_provider_operation_completion_conflict');
      const outboxResult = await client.query(
        `UPDATE onetime.content_publication_outbox
            SET state = 'complete',
                provider_readback_digest = $7,
                one_time_readback_digest = $8,
                completed_at = $9::timestamptz
          WHERE intent_id = $1
            AND provider_operation_id = $2
            AND content_id = $3
            AND content_version_id = $4
            AND publication_generation = $5
            AND request_hash = $6
            AND account_key = $10
            AND product_key = $11
            AND approval_projection_digest = $12
            AND operation = 'publish_private'
            AND state = 'pending'`,
        [
          completion.outboxIntentId,
          completion.providerOperationId,
          completion.contentId,
          completion.contentVersionId,
          completion.publicationGeneration,
          completion.canonicalRequestHash,
          completion.providerReadbackDigest,
          completion.oneTimeReadbackDigest,
          completion.completedAt,
          completion.accountKey,
          completion.productKey,
          completion.approvalProjectionDigest,
        ],
      );
      requireOne(outboxResult.rowCount, 'content_publication_outbox_completion_conflict');
    },

    async getCanonicalGovernedOccurrence(scope, occurrenceId) {
      const result = await client.query<CanonicalOccurrenceRow>(
        `SELECT account_key, occurrence_id, occurrence_version, canonical_series_id, product_key
           FROM onetime.governed_content_occurrences
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_id = $3
            AND governance_state = 'governed'
            AND active = TRUE
          LIMIT 1
          FOR SHARE`,
        [scope.accountKey, scope.productKey, occurrenceId],
      );
      const row = result.rows[0];
      return row
        ? ({
            accountKey: row.account_key,
            occurrenceId: row.occurrence_id,
            occurrenceVersion: Number(row.occurrence_version),
            canonicalSeriesId: row.canonical_series_id,
            productKey: row.product_key,
            governanceState: 'governed',
            active: true,
          } satisfies CanonicalGovernedOccurrence)
        : null;
    },

    async getCurrentPublicationEligibility(scope, studentId, contentId, occurrenceId) {
      const result = await client.query<PublicationEligibilityRow>(
        `SELECT eligibility_json
           FROM onetime.student_content_publication_eligibility
          WHERE account_key = $1
            AND product_key = $2
            AND student_id = $3
            AND content_id = $4
            AND occurrence_id = $5
          LIMIT 1
          FOR SHARE`,
        [scope.accountKey, scope.productKey, studentId, contentId, occurrenceId],
      );
      return result.rows[0]?.eligibility_json ?? null;
    },

    async savePublicationMaterialization(materialization: ContentPublicationMaterialization) {
      for (const assignment of materialization.assignments) {
        const result = await client.query(
          `INSERT INTO onetime.student_content_assignments (
             assignment_id, account_key, product_key, student_id, household_id, content_id,
             content_version_id, publication_generation, approval_projection_digest,
             assignment_version, active, assignment_json
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
           ON CONFLICT (account_key, product_key, assignment_id) DO NOTHING`,
          [
            assignment.assignmentId,
            assignment.accountKey,
            assignment.productKey,
            assignment.studentId,
            assignment.householdId,
            assignment.contentId,
            assignment.contentVersionId,
            assignment.publicationGeneration,
            assignment.approvalEvidence.projectionDigest,
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
             projection_id, account_key, product_key, assignment_id, student_id, household_id,
             content_id, content_version_id, publication_generation, approval_projection_digest,
             active, projection_json, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                     $12::jsonb, $13::timestamptz)
           ON CONFLICT (account_key, product_key, projection_id) DO NOTHING`,
          [
            projection.projectionId,
            projection.accountKey,
            projection.productKey,
            projection.assignmentId,
            projection.studentId,
            projection.householdId,
            projection.contentId,
            projection.contentVersionId,
            projection.publicationGeneration,
            projection.approvalEvidence.projectionDigest,
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
             notice_id, account_key, product_key, recipient_kind, recipient_id, student_id,
             household_id, content_id, content_version_id, source_version,
             approval_projection_digest, delivery_state, notice_json, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                     $13::jsonb, $14::timestamptz)
           ON CONFLICT (account_key, product_key, notice_id) DO NOTHING`,
          [
            notice.noticeId,
            notice.accountKey,
            notice.productKey,
            notice.recipientKind,
            notice.recipientId,
            notice.studentId,
            notice.householdId,
            notice.contentId,
            notice.contentVersionId,
            notice.sourceVersion,
            notice.approvalProjectionDigest,
            notice.deliveryState,
            JSON.stringify(notice),
            notice.createdAt,
          ],
        );
        requireOne(result.rowCount, 'protected_recording_notice_conflict');
      }
    },

    async listPublishedContent(scope) {
      const result = await client.query<ContentRow>(
        `SELECT record_json
           FROM onetime.content_publications
          WHERE account_key = $1
            AND product_key = $2
            AND state = 'published'
          ORDER BY occurred_at DESC, content_id ASC`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => row.record_json);
    },

    async getAssignment(scope, studentId, contentId) {
      const result = await client.query<AssignmentRow>(
        `SELECT assignment_json
           FROM onetime.student_content_assignments
          WHERE account_key = $1
            AND product_key = $2
            AND student_id = $3
            AND content_id = $4
            AND active = TRUE
          LIMIT 1`,
        [scope.accountKey, scope.productKey, studentId, contentId],
      );
      return result.rows[0]?.assignment_json ?? null;
    },

    async getPlaybackFacts(scope, studentId, contentId) {
      const result = await client.query<PlaybackFactsRow>(
        `SELECT facts_json
           FROM onetime.student_content_playback_facts
          WHERE account_key = $1
            AND product_key = $2
            AND student_id = $3
            AND content_id = $4
          LIMIT 1`,
        [scope.accountKey, scope.productKey, studentId, contentId],
      );
      return result.rows[0]?.facts_json ?? null;
    },

    async getResume(scope, studentId, contentId) {
      const result = await client.query<ResumeRow>(
        `SELECT resume_json
           FROM onetime.student_content_resume
          WHERE account_key = $1
            AND product_key = $2
            AND student_id = $3
            AND content_id = $4
          LIMIT 1
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, studentId, contentId],
      );
      return result.rows[0]?.resume_json ?? null;
    },

    async saveResume(resume, expectedVersion) {
      const values = [
        resume.accountKey,
        resume.productKey,
        resume.studentId,
        resume.householdId,
        resume.contentId,
        resume.contentVersionId,
        resume.publicationVersion,
        resume.positionMs,
        resume.version,
        resume.approvalProjectionDigest,
        JSON.stringify(resume),
        resume.updatedAt,
      ] as const;
      if (expectedVersion === null) {
        const result = await client.query(
          `INSERT INTO onetime.student_content_resume (
             account_key, product_key, student_id, household_id, content_id,
             content_version_id, publication_version, position_ms, version,
             approval_projection_digest,
             resume_json, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz)
           ON CONFLICT (account_key, product_key, student_id, content_id) DO NOTHING`,
          values,
        );
        requireOne(result.rowCount, 'student_content_resume_conflict');
        return;
      }
      const result = await client.query(
        `UPDATE onetime.student_content_resume
            SET household_id = $4,
                content_version_id = $6,
                publication_version = $7,
                position_ms = $8,
                version = $9,
                approval_projection_digest = $10,
                resume_json = $11::jsonb,
                updated_at = $12::timestamptz
          WHERE account_key = $1
            AND product_key = $2
            AND student_id = $3
            AND content_id = $5
            AND version = $13`,
        [...values, expectedVersion],
      );
      requireOne(result.rowCount, 'student_content_resume_conflict');
    },
  };
}

function requireOne(rowCount: number | null | undefined, code: string) {
  if (rowCount !== 1) throw new Error(code);
}

function mapPendingProviderContext(
  row: PendingProviderContextRow,
): PendingContentPublicationProviderContext {
  return {
    intent: row.intent_json,
    providerOperation: {
      accountKey: row.account_key,
      providerOperationId: row.provider_operation_id,
      providerOperationVersion: Number(row.provider_operation_version),
      provider: row.provider,
      operation: row.operation,
      productKey: row.product_key,
      contentId: row.content_id,
      contentVersionId: row.content_version_id,
      publicationGeneration: Number(row.publication_generation),
      idempotencyKey: row.idempotency_key,
      canonicalRequestHash: row.canonical_request_hash,
      state: row.state,
      unknownEffect: row.unknown_effect,
      registryBindingKey: row.registry_binding_key,
      providerAccountRefHash: row.provider_account_ref_hash,
      providerAcceptanceDigest: row.provider_acceptance_digest,
      providerReconciliationDigest: row.provider_reconciliation_digest,
      approvalProjectionDigest: row.approval_projection_digest,
    },
  };
}
