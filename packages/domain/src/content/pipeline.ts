import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ot86ApprovedForSocialEventSchema,
  ot86ContentLifecycleStateSchema,
  ot86ContentPublishManifestSchema,
  ot86ProviderReadinessStateSchema,
  ot86PublishHeadersSchema,
  ot86RetrievalResponseSchema,
  type Ot86ApprovedForSocialEvent,
  type Ot86ContentLifecycleState,
  type Ot86ContentPublishManifest,
  type Ot86ProviderReadinessState,
  type Ot86RetrievalResponse,
} from '../../../contracts/src/content/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
  containsProtectedScopedKnowledgeMaterial,
  sanitizeScopedKnowledgeProjection,
} from './scoped-knowledge-redaction.ts';

export class Ot86ContentPipelineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
  }
}

type TransitionInput = {
  pool: DbPool;
  tenantId: string;
  contentId: string;
  nextState: Ot86ContentLifecycleState;
  actorId: string;
  actorType: 'operator' | 'service' | 'system';
  reasonCode: string;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey?: string | null;
  resultSha256?: string | null;
  sanitizedErrorCode?: string | null;
  authorizationDecisionId?: string | null;
  retryTargetState?: Ot86ContentLifecycleState | null;
  now?: Date;
};

type ContentSourceInput = {
  pool: DbPool;
  tenantId: string;
  contentId: string;
  sourceRecordId: string;
  sourceKind: 'rabbi_class';
  originalName?: string | null;
  sourceSha256: string;
  byteLength?: number | null;
  originService: string;
  submittingActorId: string;
  correlationId: string;
  now?: Date;
};

type CandidateVersionInput = {
  pool: DbPool;
  tenantId: string;
  contentId: string;
  versionId: string;
  revisionNumber: number;
  supersedesVersionId?: string | null;
  metadata: Record<string, unknown>;
  sections: unknown[];
  artifacts: unknown[];
  searchDocuments: unknown[];
  privacy: {
    containsLearnerName?: boolean;
    containsLearnerVoice?: boolean;
    containsLearnerFace?: boolean;
    containsLearnerQuestion?: boolean;
    containsPrivateData?: boolean;
    approvedForStudentKb?: boolean;
    approvedForSocial?: boolean;
  };
  now?: Date;
};

type ApprovalInput = {
  pool: DbPool;
  tenantId: string;
  contentId: string;
  versionId: string;
  approvalId: string;
  approvedByActorId: string;
  policyVersion: string;
  approvedForSocial?: boolean;
  correlationId: string;
  now?: Date;
};

export type Ot86PublishReceiptResult = {
  status: 200 | 202 | 400 | 401 | 409 | 422 | 503;
  code:
    | 'accepted'
    | 'duplicate'
    | 'bad_request'
    | 'unauthorized'
    | 'conflict'
    | 'unprocessable'
    | 'storage_unavailable';
  message: string;
  receipt_state?: 'queued' | 'duplicate' | 'conflict';
};

export type Ot86SigningSecret = {
  keyId: string;
  secret: string;
};

type ReceivePublicationInput = {
  pool: DbPool;
  rawBody: Buffer | string;
  headers: {
    contentType?: string | null;
    keyId?: string | null;
    timestamp?: string | null;
    deliveryId?: string | null;
    signature?: string | null;
  };
  secrets: Ot86SigningSecret[];
  now?: Date;
};

type RetrievalInput = {
  pool: DbPool;
  tenantId: string;
  principalId: string;
  entitlementContentIds: string[];
  question: string;
  correlationId: string;
  minScore?: number;
  now?: Date;
};

export const OT86_ALLOWED_TRANSITIONS: Record<
  Ot86ContentLifecycleState,
  Ot86ContentLifecycleState[]
> = {
  received: ['uploading', 'transcribing', 'failed'],
  uploading: ['transcribing', 'failed'],
  transcribing: ['processing', 'failed'],
  processing: ['review_needed', 'failed'],
  review_needed: ['processing', 'approved', 'retired', 'failed'],
  approved: ['published', 'corrected', 'retired', 'failed'],
  published: ['corrected', 'retired'],
  failed: ['received', 'uploading', 'transcribing', 'processing', 'retired'],
  corrected: ['retired'],
  retired: [],
};

const RETRYABLE_FAILED_TARGETS = new Set<Ot86ContentLifecycleState>([
  'received',
  'uploading',
  'transcribing',
  'processing',
  'retired',
]);

export async function createOt86ContentItem(input: ContentSourceInput) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const existing = await client.query(
      `SELECT tenant_id, content_id, aggregate_state, source_sha256
         FROM onetime.ot86_content_items
        WHERE tenant_id = $1
          AND source_kind = $2
          AND source_record_id = $3
          AND source_sha256 = $4
        LIMIT 1`,
      [input.tenantId, input.sourceKind, input.sourceRecordId, input.sourceSha256],
    );
    if (existing.rowCount) {
      return {
        tenant_id: String(existing.rows[0]?.tenant_id),
        content_id: String(existing.rows[0]?.content_id),
        aggregate_state: ot86ContentLifecycleStateSchema.parse(existing.rows[0]?.aggregate_state),
        duplicate: true,
      };
    }

    await client.query(
      `INSERT INTO onetime.ot86_content_items
         (tenant_id, content_id, source_record_id, source_kind, original_name, source_sha256,
          byte_length, origin_service, submitting_actor_id, aggregate_state, received_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'received',$10,$10)`,
      [
        input.tenantId,
        input.contentId,
        input.sourceRecordId,
        input.sourceKind,
        input.originalName ?? null,
        input.sourceSha256,
        input.byteLength ?? null,
        input.originService,
        input.submittingActorId,
        now,
      ],
    );
    await recordStateEvent(client, {
      tenantId: input.tenantId,
      contentId: input.contentId,
      versionId: null,
      actorId: input.submittingActorId,
      actorType: 'operator',
      action: 'content_received',
      previousState: null,
      nextState: 'received',
      reasonCode: 'source_registered',
      correlationId: input.correlationId,
      causationId: null,
      idempotencyKey: stableOt86Key('source', [
        input.tenantId,
        input.sourceKind,
        input.sourceRecordId,
        input.sourceSha256,
      ]),
      attemptNumber: 0,
      sourceSha256: input.sourceSha256,
      resultSha256: null,
      sanitizedErrorCode: null,
      authorizationDecisionId: null,
      now,
    });
    return {
      tenant_id: input.tenantId,
      content_id: input.contentId,
      aggregate_state: 'received' as const,
      duplicate: false,
    };
  });
}

export async function transitionOt86ContentState(input: TransitionInput) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const current = await client.query(
      `SELECT aggregate_state, retry_target_state, attempt_number, source_sha256, current_version_id
         FROM onetime.ot86_content_items
        WHERE tenant_id = $1 AND content_id = $2
        LIMIT 1`,
      [input.tenantId, input.contentId],
    );
    if (!current.rowCount) {
      throw new Ot86ContentPipelineError('CONTENT_NOT_FOUND', 'Content item was not found.', 404);
    }
    const previousState = ot86ContentLifecycleStateSchema.parse(current.rows[0]?.aggregate_state);
    const retryTarget =
      current.rows[0]?.retry_target_state === null ||
      current.rows[0]?.retry_target_state === undefined
        ? null
        : ot86ContentLifecycleStateSchema.parse(current.rows[0]?.retry_target_state);
    assertAllowedTransition(previousState, input.nextState, retryTarget);
    const nextAttempt =
      input.nextState === 'failed' || previousState === 'failed'
        ? Number(current.rows[0]?.attempt_number ?? 0) + 1
        : Number(current.rows[0]?.attempt_number ?? 0);
    const nextRetryTarget =
      input.nextState === 'failed'
        ? normalizeRetryTarget(input.retryTargetState)
        : previousState === 'failed'
          ? null
          : (input.retryTargetState ?? retryTarget);
    await client.query(
      `UPDATE onetime.ot86_content_items
          SET aggregate_state = $3,
              retry_target_state = $4,
              attempt_number = $5,
              last_reason = $6,
              updated_at = $7
        WHERE tenant_id = $1 AND content_id = $2`,
      [
        input.tenantId,
        input.contentId,
        input.nextState,
        nextRetryTarget,
        nextAttempt,
        input.reasonCode,
        now,
      ],
    );
    await recordStateEvent(client, {
      tenantId: input.tenantId,
      contentId: input.contentId,
      versionId: asNullableString(current.rows[0]?.current_version_id),
      actorId: input.actorId,
      actorType: input.actorType,
      action: `state_${previousState}_to_${input.nextState}`,
      previousState,
      nextState: input.nextState,
      reasonCode: input.reasonCode,
      correlationId: input.correlationId,
      causationId: input.causationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      attemptNumber: nextAttempt,
      sourceSha256: String(current.rows[0]?.source_sha256),
      resultSha256: input.resultSha256 ?? null,
      sanitizedErrorCode: input.sanitizedErrorCode ?? null,
      authorizationDecisionId: input.authorizationDecisionId ?? null,
      now,
    });
    return {
      previous_state: previousState,
      next_state: input.nextState,
      attempt_number: nextAttempt,
    };
  });
}

export async function createOt86CandidateVersion(input: CandidateVersionInput) {
  const now = input.now ?? new Date();
  const normalizedVersionSha256 = sha256(
    canonicalJson({
      metadata: input.metadata,
      sections: input.sections,
      artifacts: input.artifacts,
      search_documents: input.searchDocuments,
      privacy: input.privacy,
    }),
  );
  await input.pool.query(
    `INSERT INTO onetime.ot86_content_versions
       (tenant_id, content_id, version_id, supersedes_version_id, revision_number,
        version_state, normalized_version_sha256, metadata_json, sections_json, artifacts_json,
        search_documents_json, contains_learner_name, contains_learner_voice,
        contains_learner_face, contains_learner_question, contains_private_data,
        approved_for_student_kb, approved_for_social, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'review_needed',$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
        $11,$12,$13,$14,$15,$16,$17,$18,$18)`,
    [
      input.tenantId,
      input.contentId,
      input.versionId,
      input.supersedesVersionId ?? null,
      input.revisionNumber,
      normalizedVersionSha256,
      JSON.stringify(input.metadata),
      JSON.stringify(input.sections),
      JSON.stringify(input.artifacts),
      JSON.stringify(input.searchDocuments),
      Boolean(input.privacy.containsLearnerName),
      Boolean(input.privacy.containsLearnerVoice),
      Boolean(input.privacy.containsLearnerFace),
      Boolean(input.privacy.containsLearnerQuestion),
      Boolean(input.privacy.containsPrivateData),
      Boolean(input.privacy.approvedForStudentKb),
      Boolean(input.privacy.approvedForSocial),
      now,
    ],
  );
  await input.pool.query(
    `UPDATE onetime.ot86_content_items
        SET current_version_id = $3,
            updated_at = $4
      WHERE tenant_id = $1 AND content_id = $2`,
    [input.tenantId, input.contentId, input.versionId, now],
  );
  return { version_id: input.versionId, normalized_version_sha256: normalizedVersionSha256 };
}

export async function approveOt86ContentVersion(input: ApprovalInput) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const result = await client.query(
      `SELECT *
         FROM onetime.ot86_content_versions
        WHERE tenant_id = $1 AND content_id = $2 AND version_id = $3
        LIMIT 1`,
      [input.tenantId, input.contentId, input.versionId],
    );
    if (!result.rowCount) {
      throw new Ot86ContentPipelineError(
        'VERSION_NOT_FOUND',
        'Content version was not found.',
        404,
      );
    }
    const row = result.rows[0] as Record<string, unknown>;
    if (row.immutable_after_approval === true || row.version_state === 'approved') {
      throw new Ot86ContentPipelineError(
        'VERSION_IMMUTABLE',
        'Approved content versions cannot be updated in place.',
        409,
      );
    }
    assertNoLearnerOrPrivateFlags(row);
    await client.query(
      `UPDATE onetime.ot86_content_versions
          SET version_state = 'approved',
              approved_for_student_kb = true,
              approved_for_social = $4,
              approval_id = $5,
              approved_by_actor_id = $6,
              approved_at = $7,
              policy_version = $8,
              immutable_after_approval = true,
              updated_at = $7
        WHERE tenant_id = $1 AND content_id = $2 AND version_id = $3`,
      [
        input.tenantId,
        input.contentId,
        input.versionId,
        Boolean(input.approvedForSocial),
        input.approvalId,
        input.approvedByActorId,
        now,
        input.policyVersion,
      ],
    );
    await client.query(
      `UPDATE onetime.ot86_content_items
          SET current_version_id = $3,
              aggregate_state = 'approved',
              updated_at = $4
        WHERE tenant_id = $1 AND content_id = $2`,
      [input.tenantId, input.contentId, input.versionId, now],
    );
    await recordStateEvent(client, {
      tenantId: input.tenantId,
      contentId: input.contentId,
      versionId: input.versionId,
      actorId: input.approvedByActorId,
      actorType: 'operator',
      action: 'version_approved',
      previousState: 'review_needed',
      nextState: 'approved',
      reasonCode: 'privacy_attested_approved_rabbi_content',
      correlationId: input.correlationId,
      causationId: null,
      idempotencyKey: input.approvalId,
      attemptNumber: 0,
      sourceSha256: await sourceShaForContent(client, input.tenantId, input.contentId),
      resultSha256: String(row.normalized_version_sha256),
      sanitizedErrorCode: null,
      authorizationDecisionId: stableOt86Key('approval_authz', [
        input.tenantId,
        input.contentId,
        input.versionId,
        input.approvedByActorId,
      ]),
      now,
    });
    return { version_id: input.versionId, approved_at: now.toISOString() };
  });
}

export async function receiveOt86PublicationManifest(
  input: ReceivePublicationInput,
): Promise<Ot86PublishReceiptResult> {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const now = input.now ?? new Date();
  const parsedHeaders = ot86PublishHeadersSchema.safeParse({
    contentType: normalizeContentType(input.headers.contentType),
    keyId: input.headers.keyId ?? '',
    timestamp: input.headers.timestamp ?? '',
    deliveryId: input.headers.deliveryId ?? '',
    signature: input.headers.signature ?? '',
  });
  if (!parsedHeaders.success) {
    return {
      status: 400,
      code: 'bad_request',
      message: 'Required OT86 publish headers are missing or malformed.',
    };
  }
  const headers = parsedHeaders.data;
  const secret = input.secrets.find((candidate) => candidate.keyId === headers.keyId);
  if (!secret || !isFreshTimestamp(headers.timestamp, now)) {
    return { status: 401, code: 'unauthorized', message: 'Publish signature rejected.' };
  }
  if (!verifyOt86Signature(secret.secret, headers.timestamp, rawBody, headers.signature)) {
    return { status: 401, code: 'unauthorized', message: 'Publish signature rejected.' };
  }

  let manifest: Ot86ContentPublishManifest;
  try {
    manifest = ot86ContentPublishManifestSchema.parse(JSON.parse(rawBody.toString('utf8')));
    if (manifest.message_id.toLowerCase() !== headers.deliveryId.toLowerCase()) {
      return {
        status: 400,
        code: 'bad_request',
        message: 'Delivery id does not match manifest message id.',
      };
    }
    if (!validateOt86ManifestChecksum(manifest)) {
      return {
        status: 422,
        code: 'unprocessable',
        message: 'Manifest checksum mismatch.',
      };
    }
  } catch {
    return {
      status: 422,
      code: 'unprocessable',
      message: 'Publication manifest failed schema validation.',
    };
  }

  const rawBodySha = sha256(rawBody);
  try {
    return await inTransaction(input.pool, async (client) => {
      const existing = await client.query(
        `SELECT raw_body_sha256, processing_state
           FROM onetime.ot86_publication_inbox_receipts
          WHERE message_id = $1 OR idempotency_key = $2
             OR (tenant_id = $3 AND content_id = $4 AND sequence = $5)
          LIMIT 1`,
        [
          manifest.message_id,
          manifest.idempotency_key,
          manifest.tenant_id,
          manifest.content_id,
          manifest.sequence,
        ],
      );
      if (existing.rowCount) {
        if (String(existing.rows[0]?.raw_body_sha256) === rawBodySha) {
          return {
            status: 200,
            code: 'duplicate',
            message: 'Identical publication delivery already recorded.',
            receipt_state: 'duplicate',
          } satisfies Ot86PublishReceiptResult;
        }
        await recordSecurityAudit(client, manifest, 'publication_replay_conflict', now);
        return {
          status: 409,
          code: 'conflict',
          message: 'Publication delivery identifier was reused with different bytes.',
          receipt_state: 'conflict',
        } satisfies Ot86PublishReceiptResult;
      }
      await client.query(
        `INSERT INTO onetime.ot86_publication_inbox_receipts
           (message_id, idempotency_key, tenant_id, content_id, version_id, sequence, action,
            key_id, raw_body_sha256, manifest_sha256, raw_manifest, validation_status,
            processing_state, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'accepted','queued',$12)`,
        [
          manifest.message_id,
          manifest.idempotency_key,
          manifest.tenant_id,
          manifest.content_id,
          manifest.version_id,
          manifest.sequence,
          manifest.action,
          headers.keyId,
          rawBodySha,
          manifest.manifest_sha256,
          rawBody.toString('utf8'),
          now,
        ],
      );
      return {
        status: 202,
        code: 'accepted',
        message: 'Publication delivery recorded for asynchronous projection.',
        receipt_state: 'queued',
      } satisfies Ot86PublishReceiptResult;
    });
  } catch {
    return {
      status: 503,
      code: 'storage_unavailable',
      message: 'Publication inbox storage is unavailable.',
    };
  }
}

export async function applyNextOt86Publication(input: { pool: DbPool; now?: Date }) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const receipt = await client.query(
      `SELECT *
         FROM onetime.ot86_publication_inbox_receipts
        WHERE processing_state IN ('queued', 'waiting_sequence')
        ORDER BY received_at ASC, id ASC
        LIMIT 1`,
    );
    if (!receipt.rowCount) return { applied: false as const, reason: 'empty_queue' as const };
    const row = receipt.rows[0] as Record<string, unknown>;
    const manifest = ot86ContentPublishManifestSchema.parse(parseJsonValue(row.raw_manifest));
    const last = await client.query(
      `SELECT max(sequence) AS last_sequence
         FROM onetime.ot86_published_content_versions
        WHERE tenant_id = $1 AND content_id = $2`,
      [manifest.tenant_id, manifest.content_id],
    );
    const lastSequence = Number(last.rows[0]?.last_sequence ?? 0);
    if (manifest.sequence > lastSequence + 1) {
      await client.query(
        `UPDATE onetime.ot86_publication_inbox_receipts
            SET processing_state = 'waiting_sequence'
          WHERE message_id = $1`,
        [manifest.message_id],
      );
      return { applied: false as const, reason: 'waiting_sequence' as const };
    }
    if (manifest.sequence <= lastSequence) {
      await client.query(
        `UPDATE onetime.ot86_publication_inbox_receipts
            SET processing_state = 'applied',
                applied_at = COALESCE(applied_at, $2)
          WHERE message_id = $1`,
        [manifest.message_id, now],
      );
      return { applied: true as const, action: manifest.action, duplicate: true };
    }
    await applyManifestProjection(client, manifest, now);
    await client.query(
      `UPDATE onetime.ot86_publication_inbox_receipts
          SET processing_state = 'applied',
              applied_at = $2
        WHERE message_id = $1`,
      [manifest.message_id, now],
    );
    return { applied: true as const, action: manifest.action, duplicate: false };
  });
}

export async function retrieveOt86ApprovedContent(
  input: RetrievalInput,
): Promise<Ot86RetrievalResponse> {
  const started = Date.now();
  const now = input.now ?? new Date();
  const authorizationDecisionId = stableOt86Key('retrieval_authz', [
    input.tenantId,
    input.principalId,
    input.correlationId,
  ]);
  if (input.entitlementContentIds.length < 1) {
    return recordRetrievalAndReturn(input.pool, {
      tenantId: input.tenantId,
      principalId: input.principalId,
      entitlementScope: 'none',
      authorizationDecisionId,
      outcome: 'denied',
      safeReasonCode: 'not_entitled',
      latencyMs: Date.now() - started,
      response: abstention('not_entitled', authorizationDecisionId, input.correlationId),
      now,
    });
  }
  const terms = tokenizeQuestion(input.question);
  if (terms.length < 1) {
    return recordRetrievalAndReturn(input.pool, {
      tenantId: input.tenantId,
      principalId: input.principalId,
      entitlementScope: 'content_list',
      authorizationDecisionId,
      outcome: 'abstained',
      safeReasonCode: 'unsupported',
      latencyMs: Date.now() - started,
      response: abstention('unsupported', authorizationDecisionId, input.correlationId),
      now,
    });
  }
  const docs = await input.pool.query(
    `SELECT docs.content_id, docs.version_id, docs.section_id, docs.title, docs.body,
            docs.document_sha256, sections.deep_link, sections.text_sha256,
            versions.active_state, versions.privacy_json
       FROM onetime.ot86_search_documents AS docs
       JOIN onetime.ot86_published_content_versions AS versions
         ON versions.tenant_id = docs.tenant_id
        AND versions.content_id = docs.content_id
        AND versions.version_id = docs.version_id
       JOIN onetime.ot86_published_sections AS sections
         ON sections.tenant_id = docs.tenant_id
        AND sections.version_id = docs.version_id
        AND sections.section_id = docs.section_id
      WHERE docs.tenant_id = $1
        AND docs.active = true
        AND sections.active = true
        AND versions.active_state = 'active'
        AND versions.privacy_json->>'source_scope' = 'approved_rabbi_content'
        AND versions.privacy_json->>'approved_for_student_kb' = 'true'
        AND versions.privacy_json->>'contains_learner_name' = 'false'
        AND versions.privacy_json->>'contains_learner_voice' = 'false'
        AND versions.privacy_json->>'contains_learner_face' = 'false'
        AND versions.privacy_json->>'contains_learner_question' = 'false'
        AND versions.privacy_json->>'contains_private_data' = 'false'
        AND docs.content_id = ANY($2::text[])
      LIMIT 200`,
    [input.tenantId, input.entitlementContentIds],
  );
  const ranked = docs.rows
    .map((row) => ({ row, score: scoreDocument(String(row.body), terms) }))
    .filter((entry) => entry.score >= (input.minScore ?? 1))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  if (ranked.length < 1) {
    return recordRetrievalAndReturn(input.pool, {
      tenantId: input.tenantId,
      principalId: input.principalId,
      entitlementScope: 'content_list',
      authorizationDecisionId,
      outcome: 'abstained',
      safeReasonCode: 'unsupported',
      latencyMs: Date.now() - started,
      response: abstention('unsupported', authorizationDecisionId, input.correlationId),
      now,
    });
  }
  const citations = ranked.map(({ row }) => ({
    content_id: String(row.content_id),
    version_id: String(row.version_id),
    section_id: String(row.section_id),
    section_title: String(row.title),
    deep_link: String(row.deep_link),
    section_sha256: String(row.text_sha256),
  }));
  const selectedSourceContainsProtectedMaterial = ranked.some(({ row }) =>
    [row.body, row.title, row.deep_link].some((value) =>
      containsProtectedScopedKnowledgeMaterial(String(value ?? '')),
    ),
  );
  const safeProjection = sanitizeScopedKnowledgeProjection({
    answer: safeAnswerFromSource(String(ranked[0]?.row.body ?? '')),
    citations,
  });
  if (selectedSourceContainsProtectedMaterial || !safeProjection.safe) {
    return recordRetrievalAndReturn(input.pool, {
      tenantId: input.tenantId,
      principalId: input.principalId,
      entitlementScope: 'content_list',
      authorizationDecisionId,
      outcome: 'abstained',
      safeReasonCode: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
      latencyMs: Date.now() - started,
      response: abstention(
        SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
        authorizationDecisionId,
        input.correlationId,
      ),
      now,
    });
  }
  const response = ot86RetrievalResponseSchema.parse({
    answer: safeProjection.answer,
    abstained: false,
    safe_reason_code: 'supported_by_approved_section',
    citations: safeProjection.citations,
    authorization_decision_id: authorizationDecisionId,
    correlation_id: input.correlationId,
  });
  return recordRetrievalAndReturn(input.pool, {
    tenantId: input.tenantId,
    principalId: input.principalId,
    entitlementScope: 'content_list',
    authorizationDecisionId,
    outcome: 'answered',
    safeReasonCode: 'supported_by_approved_section',
    latencyMs: Date.now() - started,
    response,
    now,
  });
}

export async function emitOt86ApprovedForSocialEvent(input: {
  pool: DbPool;
  tenantId: string;
  contentId: string;
  versionId: string;
  canonicalUrl: string;
  eventId: string;
  sequence: number;
  now?: Date;
}): Promise<Ot86ApprovedForSocialEvent> {
  const now = input.now ?? new Date();
  const version = await input.pool.query(
    `SELECT *
       FROM onetime.ot86_content_versions
      WHERE tenant_id = $1 AND content_id = $2 AND version_id = $3
      LIMIT 1`,
    [input.tenantId, input.contentId, input.versionId],
  );
  if (!version.rowCount) {
    throw new Ot86ContentPipelineError('VERSION_NOT_FOUND', 'Content version was not found.', 404);
  }
  const row = version.rows[0] as Record<string, unknown>;
  if (row.version_state !== 'approved' || row.immutable_after_approval !== true) {
    throw new Ot86ContentPipelineError(
      'VERSION_NOT_APPROVED',
      'Social event requires immutable approved content.',
      409,
    );
  }
  assertNoLearnerOrPrivateFlags(row);
  if (row.approved_for_social !== true) {
    throw new Ot86ContentPipelineError(
      'SOCIAL_NOT_APPROVED',
      'Version is not approved for social handoff.',
      409,
    );
  }
  const metadata = asRecord(row.metadata_json);
  const sections = asArray(row.sections_json) as Array<Record<string, unknown>>;
  const firstSection = sections[0] ?? {};
  const eventWithoutHash = {
    schema_version: 1,
    event_type: 'content.approved_for_social',
    origin: 'ot86a-content-pipeline',
    event_id: input.eventId,
    idempotency_key: stableOt86Key('social', [
      input.tenantId,
      input.contentId,
      input.versionId,
      String(input.sequence),
    ]),
    tenant_id: input.tenantId,
    content_id: input.contentId,
    version_id: input.versionId,
    sequence: input.sequence,
    occurred_at: now.toISOString(),
    approval: {
      approval_id: String(row.approval_id),
      approved_for_social: true,
      approved_by_actor_id: String(row.approved_by_actor_id),
      approved_at: asDate(row.approved_at).toISOString(),
      policy_version: String(row.policy_version),
    },
    content: {
      canonical_title: String(metadata.title ?? firstSection.title ?? input.contentId),
      canonical_url: input.canonicalUrl,
      summary: String(metadata.summary ?? 'Approved Rabbi class content.'),
      approved_excerpts: [
        {
          excerpt_id: stableOt86Key('excerpt', [
            input.versionId,
            String(firstSection.section_id ?? 'section'),
          ]),
          section_id: String(firstSection.section_id ?? 'section_001'),
          text: String(metadata.summary ?? firstSection.title ?? 'Approved Rabbi class excerpt.'),
          deep_link: `${input.canonicalUrl}#section-${String(firstSection.section_id ?? 'section_001')}`,
          text_sha256: sha256(
            String(metadata.summary ?? firstSection.title ?? 'Approved Rabbi class excerpt.'),
          ),
        },
      ],
      media: [],
    },
    privacy: {
      contains_learner_name: false,
      contains_learner_voice: false,
      contains_learner_face: false,
      contains_learner_question: false,
      contains_private_data: false,
    },
  } satisfies Omit<Ot86ApprovedForSocialEvent, 'payload_sha256'>;
  const event = ot86ApprovedForSocialEventSchema.parse({
    ...eventWithoutHash,
    payload_sha256: sha256(canonicalJson(eventWithoutHash)),
  });
  await input.pool.query(
    `INSERT INTO onetime.ot86_publication_outbox
       (event_id, event_type, tenant_id, content_id, version_id, sequence, idempotency_key,
        payload_sha256, payload_json, status, created_at)
     VALUES ($1,'content.approved_for_social',$2,$3,$4,$5,$6,$7,$8::jsonb,'pending',$9)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.event_id,
      event.tenant_id,
      event.content_id,
      event.version_id,
      event.sequence,
      event.idempotency_key,
      event.payload_sha256,
      JSON.stringify(event),
      now,
    ],
  );
  return event;
}

export async function recordOt86ProviderEventReceipt(input: {
  pool: DbPool;
  providerEventId: string;
  rawBody: Buffer | string;
  normalizedEventType: string;
  normalizedEventKey: string;
  accountIdDigest?: string | null;
  now?: Date;
}) {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const rawBodySha = sha256(rawBody);
  return inTransaction(input.pool, async (client) => {
    const existing = await client.query(
      `SELECT raw_body_sha256
         FROM onetime.ot86_provider_event_receipts
        WHERE provider = 'vimeo' AND provider_event_id = $1
        LIMIT 1`,
      [input.providerEventId],
    );
    if (existing.rowCount) {
      if (String(existing.rows[0]?.raw_body_sha256) !== rawBodySha) {
        await client.query(
          `UPDATE onetime.ot86_provider_event_receipts
              SET processing_state = 'conflict',
                  sanitized_error_code = 'provider_event_replay_changed_bytes'
            WHERE provider = 'vimeo' AND provider_event_id = $1`,
          [input.providerEventId],
        );
        return { recorded: false as const, conflict: true as const };
      }
      return { recorded: false as const, conflict: false as const, duplicate: true as const };
    }
    await client.query(
      `INSERT INTO onetime.ot86_provider_event_receipts
         (provider_event_id, raw_body_sha256, normalized_event_type, normalized_event_key,
          account_id_digest, processing_state, received_at)
       VALUES ($1,$2,$3,$4,$5,'recorded',$6)`,
      [
        input.providerEventId,
        rawBodySha,
        input.normalizedEventType,
        input.normalizedEventKey,
        input.accountIdDigest ?? null,
        input.now ?? new Date(),
      ],
    );
    return { recorded: true as const, conflict: false as const };
  });
}

export function inspectOt86VimeoReadinessFromEnv(env: NodeJS.ProcessEnv = process.env): {
  state: Ot86ProviderReadinessState;
  capability_names: string[];
  missing_capability_classes: string[];
} {
  const requiredConfig: Array<[string, string]> = [
    ['VIMEO_ACCESS_TOKEN', 'access_token'],
    ['VIMEO_CLIENT_ID', 'client_id'],
    ['VIMEO_CLIENT_SECRET', 'client_secret'],
    ['VIMEO_WEBHOOK_SECRET', 'webhook_secret'],
    ['VIMEO_ACCOUNT_ID', 'account_id'],
  ];
  const missing = requiredConfig.filter(([key]) => !env[key]);
  if (missing.length > 0) {
    return {
      state: ot86ProviderReadinessStateSchema.parse('unconfigured'),
      capability_names: ['manual_approved_reference'],
      missing_capability_classes: missing.map(([, label]) => label),
    };
  }
  return {
    state: ot86ProviderReadinessStateSchema.parse('degraded'),
    capability_names: ['configuration_present', 'manual_approved_reference'],
    missing_capability_classes: ['live_account_permission_readback'],
  };
}

export function sanitizeOt86ProviderError(error: unknown) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(/[A-Za-z0-9_-]{24,}/g, '[redacted-token]')
    .replaceAll(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted-token]')
    .replaceAll(/(client_secret|access_token|webhook_secret)=([^&\s]+)/gi, '$1=[redacted-token]');
}

export function signOt86Manifest(input: {
  keyId: string;
  secret: string;
  timestamp: string;
  rawBody: Buffer | string;
}) {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const digest = createHmac('sha256', input.secret)
    .update(Buffer.from(`${input.timestamp}.`, 'ascii'))
    .update(rawBody)
    .digest('hex');
  return `v1=${digest}`;
}

export function validateOt86ManifestChecksum(manifest: Ot86ContentPublishManifest) {
  const withoutHash: Omit<Ot86ContentPublishManifest, 'manifest_sha256'> = {
    ...manifest,
  };
  delete (withoutHash as Partial<Ot86ContentPublishManifest>).manifest_sha256;
  return sha256(canonicalJson(withoutHash)) === manifest.manifest_sha256;
}

export function withOt86ManifestChecksum(
  manifest: Omit<Ot86ContentPublishManifest, 'manifest_sha256'>,
): Ot86ContentPublishManifest {
  return ot86ContentPublishManifestSchema.parse({
    ...manifest,
    manifest_sha256: sha256(canonicalJson(manifest)),
  });
}

async function applyManifestProjection(
  client: Queryable,
  manifest: Ot86ContentPublishManifest,
  now: Date,
) {
  if (manifest.action === 'correct' && manifest.supersedes_version_id) {
    await deactivateVersion(
      client,
      manifest.tenant_id,
      manifest.supersedes_version_id,
      'corrected',
      now,
    );
  }
  if (manifest.action === 'revoke') {
    await deactivateVersion(client, manifest.tenant_id, manifest.version_id, 'revoked', now);
    return;
  }
  if (manifest.action === 'retire') {
    await client.query(
      `UPDATE onetime.ot86_published_content_versions
          SET active_state = 'retired',
              updated_at = $3
        WHERE tenant_id = $1 AND content_id = $2`,
      [manifest.tenant_id, manifest.content_id, now],
    );
    await client.query(
      `UPDATE onetime.ot86_search_documents SET active = false, updated_at = $3
        WHERE tenant_id = $1 AND content_id = $2`,
      [manifest.tenant_id, manifest.content_id, now],
    );
    await client.query(
      `UPDATE onetime.ot86_published_sections SET active = false
        WHERE tenant_id = $1 AND content_id = $2`,
      [manifest.tenant_id, manifest.content_id],
    );
    return;
  }
  await client.query(
    `INSERT INTO onetime.ot86_published_content_versions
       (tenant_id, content_id, version_id, supersedes_version_id, sequence, action,
        canonical_path, source_sha256, manifest_sha256, approval_json, privacy_json,
        active_state, published_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'active',$12,$12)
     ON CONFLICT (tenant_id, content_id, version_id) DO UPDATE SET
       active_state = 'active',
       updated_at = EXCLUDED.updated_at`,
    [
      manifest.tenant_id,
      manifest.content_id,
      manifest.version_id,
      manifest.supersedes_version_id ?? null,
      manifest.sequence,
      manifest.action,
      manifest.canonical_path ?? null,
      manifest.source.source_sha256,
      manifest.manifest_sha256,
      JSON.stringify(manifest.approval),
      JSON.stringify(manifest.privacy),
      now,
    ],
  );
  for (const section of manifest.sections) {
    await client.query(
      `INSERT INTO onetime.ot86_published_sections
         (tenant_id, content_id, version_id, section_id, title, ordinal, start_ms, end_ms,
          canonical_path, deep_link, text_sha256, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       ON CONFLICT (tenant_id, version_id, section_id) DO UPDATE SET
         title = EXCLUDED.title,
         ordinal = EXCLUDED.ordinal,
         start_ms = EXCLUDED.start_ms,
         end_ms = EXCLUDED.end_ms,
         canonical_path = EXCLUDED.canonical_path,
         deep_link = EXCLUDED.deep_link,
         text_sha256 = EXCLUDED.text_sha256,
         active = true`,
      [
        manifest.tenant_id,
        manifest.content_id,
        manifest.version_id,
        section.section_id,
        section.title,
        section.ordinal,
        section.start_ms,
        section.end_ms,
        section.canonical_path,
        section.deep_link,
        section.text_sha256,
      ],
    );
  }
  for (const artifact of manifest.artifacts) {
    await client.query(
      `INSERT INTO onetime.ot86_published_artifacts
         (tenant_id, content_id, version_id, artifact_id, kind, uri, mime_type, sha256, byte_length, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       ON CONFLICT (tenant_id, version_id, artifact_id) DO UPDATE SET active = true`,
      [
        manifest.tenant_id,
        manifest.content_id,
        manifest.version_id,
        artifact.artifact_id,
        artifact.kind,
        artifact.uri,
        artifact.mime_type,
        artifact.sha256,
        artifact.byte_length,
      ],
    );
  }
  for (const document of manifest.search_documents) {
    await client.query(
      `INSERT INTO onetime.ot86_search_documents
         (tenant_id, content_id, version_id, section_id, document_id, title, body,
          token_count, document_sha256, active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
       ON CONFLICT (tenant_id, version_id, document_id) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         token_count = EXCLUDED.token_count,
         document_sha256 = EXCLUDED.document_sha256,
         active = true,
         updated_at = EXCLUDED.updated_at`,
      [
        manifest.tenant_id,
        manifest.content_id,
        manifest.version_id,
        document.section_id,
        document.document_id,
        document.title,
        sanitizeRetrievedText(document.body),
        document.token_count,
        document.sha256,
        now,
      ],
    );
  }
}

async function deactivateVersion(
  client: Queryable,
  tenantId: string,
  versionId: string,
  state: 'corrected' | 'revoked' | 'retired',
  now: Date,
) {
  await client.query(
    `UPDATE onetime.ot86_published_content_versions
        SET active_state = $3,
            updated_at = $4
      WHERE tenant_id = $1 AND version_id = $2`,
    [tenantId, versionId, state, now],
  );
  await client.query(
    `UPDATE onetime.ot86_search_documents
        SET active = false,
            updated_at = $3
      WHERE tenant_id = $1 AND version_id = $2`,
    [tenantId, versionId, now],
  );
  await client.query(
    `UPDATE onetime.ot86_published_sections
        SET active = false
      WHERE tenant_id = $1 AND version_id = $2`,
    [tenantId, versionId],
  );
}

function assertAllowedTransition(
  previousState: Ot86ContentLifecycleState,
  nextState: Ot86ContentLifecycleState,
  retryTargetState: Ot86ContentLifecycleState | null,
) {
  if (previousState === 'failed') {
    if (nextState !== retryTargetState || !RETRYABLE_FAILED_TARGETS.has(nextState)) {
      throw new Ot86ContentPipelineError(
        'INVALID_RETRY_TARGET',
        'Failed content can resume only through its recorded retry target.',
        409,
      );
    }
    return;
  }
  if (!OT86_ALLOWED_TRANSITIONS[previousState].includes(nextState)) {
    throw new Ot86ContentPipelineError(
      'INVALID_STATE_TRANSITION',
      `Cannot transition content from ${previousState} to ${nextState}.`,
      409,
    );
  }
}

function normalizeRetryTarget(value: Ot86ContentLifecycleState | null | undefined) {
  if (!value) return null;
  if (!RETRYABLE_FAILED_TARGETS.has(value)) {
    throw new Ot86ContentPipelineError(
      'INVALID_RETRY_TARGET',
      'Retry target is not supported for failed content.',
      409,
    );
  }
  return value;
}

function assertNoLearnerOrPrivateFlags(row: Record<string, unknown>) {
  const blocked =
    row.contains_learner_name === true ||
    row.contains_learner_voice === true ||
    row.contains_learner_face === true ||
    row.contains_learner_question === true ||
    row.contains_private_data === true;
  if (blocked) {
    throw new Ot86ContentPipelineError(
      'PRIVACY_ATTESTATION_FAILED',
      'Learner/private-data flags block approval, publication, social handoff, and KB insertion.',
      422,
    );
  }
}

async function recordStateEvent(
  client: Queryable,
  input: {
    tenantId: string;
    contentId: string;
    versionId: string | null;
    actorId: string;
    actorType: string;
    action: string;
    previousState: string | null;
    nextState: string;
    reasonCode: string;
    correlationId: string;
    causationId: string | null;
    idempotencyKey: string | null;
    attemptNumber: number;
    sourceSha256: string;
    resultSha256: string | null;
    sanitizedErrorCode: string | null;
    authorizationDecisionId: string | null;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.ot86_content_state_events
       (audit_id, tenant_id, content_id, version_id, actor_id, actor_type, action,
        previous_state, next_state, reason_code, correlation_id, causation_id,
        idempotency_key, attempt_number, source_sha256, result_sha256,
        sanitized_error_code, authorization_decision_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('audit', [
        input.tenantId,
        input.contentId,
        input.action,
        input.correlationId,
        input.now.toISOString(),
      ]),
      input.tenantId,
      input.contentId,
      input.versionId,
      input.actorId,
      input.actorType,
      input.action,
      input.previousState,
      input.nextState,
      input.reasonCode,
      input.correlationId,
      input.causationId,
      input.idempotencyKey,
      input.attemptNumber,
      input.sourceSha256,
      input.resultSha256,
      input.sanitizedErrorCode,
      input.authorizationDecisionId,
      input.now,
    ],
  );
}

async function sourceShaForContent(client: Queryable, tenantId: string, contentId: string) {
  const result = await client.query(
    `SELECT source_sha256
       FROM onetime.ot86_content_items
      WHERE tenant_id = $1 AND content_id = $2
      LIMIT 1`,
    [tenantId, contentId],
  );
  return String(result.rows[0]?.source_sha256 ?? sha256(`${tenantId}:${contentId}`));
}

function normalizeContentType(value: string | null | undefined) {
  return (
    String(value ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase() ?? ''
  );
}

function isFreshTimestamp(value: string, now: Date) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now.getTime() / 1000 - seconds) <= 300;
}

function verifyOt86Signature(
  secret: string,
  timestamp: string,
  rawBody: Buffer,
  signature: string,
) {
  const expected = signOt86Manifest({ keyId: 'unused', secret, timestamp, rawBody });
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

async function recordSecurityAudit(
  client: Queryable,
  manifest: Ot86ContentPublishManifest,
  action: string,
  now: Date,
) {
  await client.query(
    `INSERT INTO onetime.ot86_content_state_events
       (audit_id, tenant_id, content_id, version_id, actor_id, actor_type, action,
        previous_state, next_state, reason_code, correlation_id, attempt_number,
        source_sha256, result_sha256, created_at)
     VALUES ($1,$2,$3,$4,'ot86-publish-endpoint','service',$5,NULL,'failed',$6,$7,0,$8,$9,$10)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('security_audit', [
        manifest.tenant_id,
        manifest.content_id,
        manifest.message_id,
        action,
      ]),
      manifest.tenant_id,
      manifest.content_id,
      manifest.version_id,
      action,
      action,
      manifest.message_id,
      manifest.source.source_sha256,
      manifest.manifest_sha256,
      now,
    ],
  );
}

function abstention(
  safeReasonCode: string,
  authorizationDecisionId: string,
  correlationId: string,
): Ot86RetrievalResponse {
  return ot86RetrievalResponseSchema.parse({
    answer: "I don't have enough approved class material to answer that.",
    abstained: true,
    safe_reason_code: safeReasonCode,
    citations: [],
    authorization_decision_id: authorizationDecisionId,
    correlation_id: correlationId,
  });
}

async function recordRetrievalAndReturn(
  pool: DbPool,
  input: {
    tenantId: string;
    principalId: string;
    entitlementScope: string;
    authorizationDecisionId: string;
    outcome: 'answered' | 'abstained' | 'denied';
    safeReasonCode: string;
    latencyMs: number;
    response: Ot86RetrievalResponse;
    now: Date;
  },
) {
  await pool.query(
    `INSERT INTO onetime.ot86_retrieval_audit_events
       (audit_id, tenant_id, principal_id, entitlement_scope, authorization_decision_id,
        outcome, safe_reason_code, selected_citation_count, latency_ms, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('retrieval_audit', [
        input.tenantId,
        input.principalId,
        input.authorizationDecisionId,
      ]),
      input.tenantId,
      input.principalId,
      input.entitlementScope,
      input.authorizationDecisionId,
      input.outcome,
      input.safeReasonCode,
      input.response.citations.length,
      input.latencyMs,
      input.now,
    ],
  );
  return input.response;
}

function tokenizeQuestion(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replaceAll(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length >= 3)
        .slice(0, 24),
    ),
  ];
}

function scoreDocument(body: string, terms: string[]) {
  const normalized = ` ${body.toLowerCase().replaceAll(/[^a-z0-9\s]/g, ' ')} `;
  return terms.reduce((score, term) => score + (normalized.includes(` ${term} `) ? 1 : 0), 0);
}

function safeAnswerFromSource(body: string) {
  const source = sanitizeRetrievedText(body).replaceAll(/\s+/g, ' ').trim();
  const sentence = source.split(/(?<=[.!?])\s+/)[0] ?? source;
  return sentence.slice(0, 700) || "I don't have enough approved class material to answer that.";
}

function sanitizeRetrievedText(body: string) {
  return body
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '[removed script]')
    .replaceAll(
      /\b(ignore|disregard)\s+(all\s+)?(prior|previous)\s+(rules|instructions)\b/gi,
      '[quoted source instruction removed]',
    )
    .replaceAll(
      /\b(disclose|reveal|print)\s+(secrets?|tokens?|passwords?)\b/gi,
      '[quoted secret request removed]',
    );
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot canonicalize non-finite number.');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}.`);
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableOt86Key(prefix: string, parts: string[]) {
  return `${prefix}_${sha256(parts.join('\0')).slice(0, 32)}`;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date value.');
  return parsed;
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return JSON.parse(value) as unknown;
}
