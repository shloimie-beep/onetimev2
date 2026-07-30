import type {
  CanonicalGovernedOccurrence,
  ContentPublicationOutboxIntent,
  ContentPublicationMaterialization,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRecord,
  ContentPublicationRepository,
  ContentPublicationScope,
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
  operation: 'publish_private' | 'revoke_private';
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
  session_security_version?: number;
}

interface CompletedProviderOperationRow extends Record<string, unknown> {
  job_id: string;
  version: number;
  provider: 'vimeo';
  product: 'one_time_mishnayos';
  runtime_tier: 'isolated_staging' | 'production';
  verification_environment_id:
    | 'ci'
    | 'provider_sandbox'
    | 'persistent_staging'
    | 'production_read_only'
    | 'production_operator_canary'
    | 'production_broad';
  reconciliation_digest: string | null;
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

    async registerContent(record) {
      const inserted = await client.query<ContentRow>(
        `INSERT INTO onetime.content_publications (
           account_key, product_key, content_id, content_version_id,
           content_version_digest, version, state, publication_generation,
           playback_grant_generation, occurred_at, record_json, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz,
           $11::jsonb, $12::timestamptz
         )
         ON CONFLICT (account_key, product_key, content_id) DO NOTHING
         RETURNING record_json`,
        [
          record.accountKey,
          record.productKey,
          record.contentId,
          record.contentVersionId,
          record.contentVersionDigest,
          record.version,
          record.state,
          record.publicationGeneration,
          record.playbackGrantGeneration,
          record.occurredAt,
          JSON.stringify(record),
          record.updatedAt,
        ],
      );
      const created = inserted.rows[0]?.record_json;
      if (created) return { record: created, inserted: true };
      const existing = await client.query<ContentRow>(
        `SELECT record_json
           FROM onetime.content_publications
          WHERE account_key = $1
            AND product_key = $2
            AND content_id = $3
          LIMIT 1
          FOR UPDATE`,
        [record.accountKey, record.productKey, record.contentId],
      );
      const persisted = existing.rows[0]?.record_json;
      if (!persisted) throw new Error('content_publication_registration_conflict');
      return { record: persisted, inserted: false };
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

    async saveProviderOperation(operation) {
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
           WHERE job_outbox.job_id = EXCLUDED.job_id
             AND job_outbox.operation_type = EXCLUDED.operation_type
             AND job_outbox.aggregate_ref = EXCLUDED.aggregate_ref
             AND job_outbox.source_version = EXCLUDED.source_version
             AND job_outbox.provider = EXCLUDED.provider
             AND job_outbox.canonical_request_hash = EXCLUDED.canonical_request_hash
             AND job_outbox.payload_ref = EXCLUDED.payload_ref
             AND job_outbox.payload_digest = EXCLUDED.payload_digest
             AND job_outbox.compensation_for_job_id
               IS NOT DISTINCT FROM EXCLUDED.compensation_for_job_id
             AND job_outbox.state = 'not_started'
             AND job_outbox.version = 1
             AND job_outbox.unknown_effect = FALSE
             AND job_outbox.provider_acceptance_digest IS NULL
             AND job_outbox.reconciliation_digest IS NULL
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
        throw new Error('content_provider_job_outbox_conflict');
      }
      const binding = await client.query(
        `INSERT INTO onetime.provider_operation_binding
           (job_id, registry_binding_key, provider_account_ref_hash, effect_kind, household_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (job_id) DO UPDATE SET job_id = EXCLUDED.job_id
           WHERE provider_operation_binding.registry_binding_key =
                 EXCLUDED.registry_binding_key
             AND provider_operation_binding.provider_account_ref_hash =
                 EXCLUDED.provider_account_ref_hash
             AND provider_operation_binding.effect_kind = EXCLUDED.effect_kind
             AND provider_operation_binding.household_id
               IS NOT DISTINCT FROM EXCLUDED.household_id
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
        throw new Error('content_provider_operation_binding_conflict');
      }
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

    async getPendingProviderContext(scope, providerOperationId, operation) {
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
            AND o.operation = $4
            AND o.state = 'pending'
            AND j.provider = 'vimeo'
            AND j.product = o.product_key
            AND j.operation_type = $4
            AND j.state = 'accepted'
            AND j.unknown_effect = FALSE
          LIMIT 1
          FOR UPDATE OF o, j`,
        [scope.accountKey, scope.productKey, providerOperationId, operation],
      );
      return result.rows[0] ? mapPendingProviderContext(result.rows[0]) : null;
    },

    async completeProviderOperation(completion) {
      const providerResult = await client.query<CompletedProviderOperationRow>(
        `UPDATE onetime.job_outbox
            SET state = 'complete',
                version = version + 1,
                updated_at = $12::timestamptz
          WHERE job_id = $1
            AND version = $2
            AND provider = 'vimeo'
            AND operation_type = $16
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
                 AND o.operation = $16
                 AND o.state = 'pending'
            )
            AND EXISTS (
              SELECT 1
                FROM onetime.provider_operation_binding AS b
               WHERE b.job_id = $1
                 AND b.registry_binding_key = $10
                 AND b.provider_account_ref_hash = $11
            )
          RETURNING job_id, version, provider, product, runtime_tier,
                    verification_environment_id, reconciliation_digest`,
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
          completion.operation,
        ],
      );
      requireOne(providerResult.rowCount, 'content_provider_operation_completion_conflict');
      const completedProvider = providerResult.rows[0];
      if (
        !completedProvider ||
        completedProvider.reconciliation_digest !== completion.providerReconciliationDigest
      ) {
        throw new Error('content_provider_reconciliation_fence_conflict');
      }
      await client.query(
        `INSERT INTO onetime.provider_readback_ledger (
           operation_id, operation_version, provider, runtime_tier,
           verification_environment_id, provider_account_ref_hash, disposition,
           provider_resource_ref_hash, reconciliation_digest, observed_at, product_key
         ) VALUES ($1,$2,$3,$4,$5,$6,'effect_exists',$7,$8,$9::timestamptz,$10)
         ON CONFLICT (operation_id, operation_version, reconciliation_digest)
         DO NOTHING`,
        [
          completedProvider.job_id,
          completedProvider.version,
          completedProvider.provider,
          completedProvider.runtime_tier,
          completedProvider.verification_environment_id,
          completion.providerAccountRefHash,
          completion.providerResourceRefHash,
          completion.providerReadbackDigest,
          completion.providerObservedAt,
          completedProvider.product,
        ],
      );
      const persistedReadback = await client.query(
        `SELECT operation_id
           FROM onetime.provider_readback_ledger
          WHERE operation_id = $1
            AND operation_version = $2
            AND provider = $3
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND provider_account_ref_hash = $6
            AND disposition = 'effect_exists'
            AND provider_resource_ref_hash = $7
            AND reconciliation_digest = $8
            AND observed_at = $9::timestamptz
            AND product_key = $10`,
        [
          completedProvider.job_id,
          completedProvider.version,
          completedProvider.provider,
          completedProvider.runtime_tier,
          completedProvider.verification_environment_id,
          completion.providerAccountRefHash,
          completion.providerResourceRefHash,
          completion.providerReadbackDigest,
          completion.providerObservedAt,
          completedProvider.product,
        ],
      );
      requireOne(persistedReadback.rowCount, 'content_provider_readback_ledger_conflict');
      const outboxResult = await client.query(
        `UPDATE onetime.content_publication_outbox
            SET state = 'complete',
                provider_readback_digest = $7,
                provider_resource_ref_hash = $14,
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
            AND operation = $13
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
          completion.operation,
          completion.providerResourceRefHash,
        ],
      );
      requireOne(outboxResult.rowCount, 'content_publication_outbox_completion_conflict');
    },

    async getCanonicalGovernedOccurrence(scope, occurrenceId) {
      await client.query(
        `INSERT INTO onetime.governed_content_occurrences (
           account_key, product_key, occurrence_id, occurrence_version,
           canonical_series_id, governance_state, active, relation_json, attached_at
         )
         SELECT occurrence.account_key,
                occurrence.product_key,
                occurrence.occurrence_key,
                occurrence.version,
                series.class_series_key,
                'governed',
                series.series_state <> 'archived'
                  AND occurrence.occurrence_state <> 'canceled',
                jsonb_build_object(
                  'accountKey', occurrence.account_key,
                  'productKey', occurrence.product_key,
                  'occurrenceId', occurrence.occurrence_key,
                  'occurrenceVersion', occurrence.version,
                  'canonicalSeriesId', series.class_series_key,
                  'canonicalSeriesVersion', series.version,
                  'occurrenceState', occurrence.occurrence_state,
                  'seriesState', series.series_state,
                  'isCanonical', series.is_canonical
                ),
                GREATEST(occurrence.updated_at, series.updated_at)
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND occurrence.occurrence_key = $3
            AND series.is_canonical = TRUE
         ON CONFLICT (account_key, product_key, occurrence_id)
         DO UPDATE SET
           occurrence_version = EXCLUDED.occurrence_version,
           canonical_series_id = EXCLUDED.canonical_series_id,
           governance_state = EXCLUDED.governance_state,
           active = EXCLUDED.active,
           relation_json = EXCLUDED.relation_json,
           attached_at = EXCLUDED.attached_at
         WHERE governed_content_occurrences.occurrence_version <=
           EXCLUDED.occurrence_version`,
        [scope.accountKey, scope.productKey, occurrenceId],
      );
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

    async refreshPlaybackFacts(scope, principal, assignment) {
      const facts = await buildCurrentPlaybackFacts(client, scope, principal, assignment);
      if (!facts) return null;
      const result = await client.query<PlaybackFactsRow>(
        `INSERT INTO onetime.student_content_playback_facts (
           account_key, product_key, assignment_id, assignment_version, student_id,
           household_id, content_id, content_version_id, publication_generation,
           approval_projection_digest, facts_json, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now()
         )
         ON CONFLICT (account_key, product_key, student_id, content_id)
         DO UPDATE SET
           assignment_id = EXCLUDED.assignment_id,
           assignment_version = EXCLUDED.assignment_version,
           household_id = EXCLUDED.household_id,
           content_version_id = EXCLUDED.content_version_id,
           publication_generation = EXCLUDED.publication_generation,
           approval_projection_digest = EXCLUDED.approval_projection_digest,
           facts_json = EXCLUDED.facts_json,
           updated_at = EXCLUDED.updated_at
         RETURNING facts_json`,
        [
          scope.accountKey,
          scope.productKey,
          facts.assignmentId,
          facts.assignmentVersion,
          facts.studentId,
          facts.householdId,
          assignment.contentId,
          assignment.contentVersionId,
          assignment.publicationGeneration,
          facts.approvalProjectionDigest,
          JSON.stringify(facts),
        ],
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

async function buildCurrentPlaybackFacts(
  client: ContentPublicationSqlClient,
  scope: ContentPublicationScope,
  principal: ContentPublicationPrincipal,
  assignment: StudentContentAssignment,
): Promise<StudentPlaybackAuthorizationFacts | null> {
  if (
    principal.role !== 'student' ||
    !principal.studentId ||
    !principal.sessionId ||
    !Number.isSafeInteger(principal.sessionVersion) ||
    principal.sessionVersion! < 1 ||
    principal.accountKey !== scope.accountKey ||
    principal.productKey !== scope.productKey ||
    principal.studentId !== assignment.studentId ||
    principal.householdId !== assignment.householdId ||
    principal.accessState === 'inactive' ||
    principal.accessState === 'archived' ||
    assignment.accountKey !== scope.accountKey ||
    assignment.productKey !== scope.productKey ||
    !assignment.active ||
    assignment.revokedAt !== null
  ) {
    return null;
  }
  const result = await client.query<PublicationEligibilityRow>(
    `SELECT eligibility.eligibility_json,
            session.security_version AS session_security_version
       FROM onetime.student_content_publication_eligibility AS eligibility
       JOIN onetime.account_learner_identity_links AS identity_link
         ON identity_link.account_key = eligibility.account_key
        AND identity_link.product_key = eligibility.product_key
        AND identity_link.household_key = eligibility.household_id
        AND identity_link.learner_key = eligibility.student_id
        AND identity_link.link_state = 'active'
       JOIN onetime.account_users AS student_user
         ON student_user.user_key = identity_link.user_key
        AND student_user.account_key = identity_link.account_key
        AND student_user.product_key = identity_link.product_key
        AND student_user.role = 'student'
        AND student_user.status = 'active'
       JOIN onetime.user_sessions AS session
         ON session.user_key = student_user.user_key
        AND session.account_key = student_user.account_key
        AND session.product_key = student_user.product_key
        AND session.security_version = student_user.security_version
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND session.last_seen_at > now() - interval '7 days'
       JOIN onetime.portal_student_access_state AS student_access
         ON student_access.account_key = identity_link.account_key
        AND student_access.product_key = identity_link.product_key
        AND student_access.household_key = identity_link.household_key
        AND student_access.learner_key = identity_link.learner_key
        AND student_access.student_user_ref = identity_link.user_key
        AND student_access.status = 'active'
       JOIN onetime.portal_learners AS learner
         ON learner.account_key = identity_link.account_key
        AND learner.product_key = identity_link.product_key
        AND learner.household_key = identity_link.household_key
        AND learner.learner_key = identity_link.learner_key
        AND learner.learner_status = 'active'
       JOIN onetime.portal_households AS household
         ON household.account_key = identity_link.account_key
        AND household.product_key = identity_link.product_key
        AND household.household_key = identity_link.household_key
        AND household.status = 'active'
      WHERE eligibility.account_key = $1
        AND eligibility.product_key = $2
        AND eligibility.student_id = $3
        AND eligibility.household_id = $4
        AND eligibility.content_id = $5
        AND eligibility.content_version_id = $6
        AND eligibility.occurrence_id = $7
        AND eligibility.publication_generation = $8
        AND eligibility.approval_projection_digest = $9
        AND student_user.user_key = $10
        AND session.session_key = $11
        AND session.security_version = $12
      LIMIT 1
      FOR SHARE OF eligibility, identity_link, student_user, session,
        student_access, learner, household`,
    [
      scope.accountKey,
      scope.productKey,
      assignment.studentId,
      assignment.householdId,
      assignment.contentId,
      assignment.contentVersionId,
      assignment.occurrenceId,
      assignment.publicationGeneration,
      assignment.approvalEvidence.projectionDigest,
      principal.actorId,
      principal.sessionId,
      principal.sessionVersion,
    ],
  );
  const row = result.rows[0];
  const eligibility = row?.eligibility_json;
  const sessionSecurityVersion = Number(row?.session_security_version);
  if (
    !eligibility ||
    !Number.isSafeInteger(sessionSecurityVersion) ||
    sessionSecurityVersion < 1 ||
    sessionSecurityVersion !== principal.sessionVersion ||
    eligibility.accountKey !== scope.accountKey ||
    eligibility.productKey !== scope.productKey ||
    eligibility.studentId !== assignment.studentId ||
    eligibility.householdId !== assignment.householdId ||
    eligibility.contentId !== assignment.contentId ||
    eligibility.contentVersionId !== assignment.contentVersionId ||
    eligibility.occurrenceId !== assignment.occurrenceId ||
    eligibility.publicationGeneration !== assignment.publicationGeneration ||
    eligibility.approvalProjectionDigest !== assignment.approvalEvidence.projectionDigest ||
    eligibility.studentVersion !== assignment.studentVersion ||
    eligibility.enrollmentVersion !== assignment.enrollmentVersion ||
    eligibility.accessVersion !== assignment.accessVersion ||
    eligibility.serviceAccountConsentVersion !== assignment.serviceAccountConsentVersion ||
    eligibility.privacyVersion !== assignment.privacyVersion ||
    eligibility.revocationVersion !== assignment.revocationVersion ||
    !eligibility.studentActive ||
    !eligibility.enrollmentActive ||
    !['active', 'grace'].includes(eligibility.accessState) ||
    eligibility.accessState !== principal.accessState ||
    !eligibility.serviceAccountAccepted ||
    eligibility.privacyReviewState !== 'clear' ||
    eligibility.studentRevoked ||
    eligibility.accountRevoked ||
    eligibility.contentRevoked
  ) {
    return null;
  }
  return {
    accountKey: scope.accountKey,
    productKey: scope.productKey,
    assignmentId: assignment.assignmentId,
    assignmentVersion: assignment.assignmentVersion,
    studentId: assignment.studentId,
    householdId: assignment.householdId,
    sessionId: principal.sessionId,
    sessionVersion: sessionSecurityVersion,
    sessionActive: true,
    studentVersion: eligibility.studentVersion,
    studentActive: eligibility.studentActive,
    enrollmentVersion: eligibility.enrollmentVersion,
    enrollmentActive: eligibility.enrollmentActive,
    accessVersion: eligibility.accessVersion,
    accessState: eligibility.accessState,
    serviceAccountConsentVersion: eligibility.serviceAccountConsentVersion,
    serviceAccountAccepted: eligibility.serviceAccountAccepted,
    privacyVersion: eligibility.privacyVersion,
    revocationVersion: eligibility.revocationVersion,
    studentRevoked: eligibility.studentRevoked,
    accountRevoked: eligibility.accountRevoked,
    contentRevoked: eligibility.contentRevoked,
    privacyReviewState: eligibility.privacyReviewState,
    approvalProjectionDigest: eligibility.approvalProjectionDigest,
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
