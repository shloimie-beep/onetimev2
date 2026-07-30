import { createHash } from 'node:crypto';
import {
  CONTENT_PLAYBACK_GRANT_TTL_MS,
  CONTENT_PUBLICATION_PRODUCT_KEY,
  type CanonicalGovernedOccurrence,
  type ContentApprovalEvidence,
  type ContentPublicationCommandBinding,
  type ContentPublicationMaterialization,
  type ContentPublicationOutboxIntent,
  type ContentPublicationProviderCompletion,
  type ContentPublicationPrincipal,
  type ContentPublicationReceipt,
  type ContentPublicationRecord,
  type GovernedContentOccurrenceRelation,
  type PendingContentPublicationProviderContext,
  type StudentContentAssignment,
  type StudentContentResume,
  type StudentLibraryItem,
  type StudentPlaybackGrant,
  type StudentPlaybackAuthorizationFacts,
  type StudentPublicationAudience,
  type StudentPublicationEligibility,
  type VimeoContentPublicationObservation,
  type VimeoProviderOperationReadback,
  type VimeoProviderRevocationReadback,
} from '../../../../contracts/src/content/publication/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../contracts/src/providers/v21-provider-core.ts';
import { assertProviderOperationBound } from '../../providers/shared/index.ts';
import { CONTENT_PUBLICATION_ERROR_CODES, ContentPublicationError } from './errors.ts';

const REQUIRED_APPROVED_ARTIFACT_KINDS = [
  'trim',
  'compressed_video',
  'transcript',
  'captions',
  'review_material',
  'worksheet',
  'knowledge_artifact',
] as const;

export function approveContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  approvalId: string;
  policyVersion: string;
  evidence: ContentApprovalEvidence;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal, input.record);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'needs_review') {
    throw failure('invalidState', 'Only review-ready content can be approved.');
  }
  assertSafeId(input.approvalId, 'approvalId');
  if (!input.policyVersion.trim()) throw failure('invalidInput', 'policyVersion is required.');
  const occurredAt = validInstant(input.binding.occurredAt);
  assertApprovalEvidence(input.principal, input.record, input.evidence, occurredAt);
  return {
    ...input.record,
    version: input.record.version + 1,
    state: 'approved' as const,
    approval: {
      approvalId: input.approvalId,
      approvedByAdminId: input.evidence.approvedByAdminId,
      approvedAt: input.evidence.approvedAt,
      policyVersion: input.policyVersion.trim(),
      evidence: input.evidence,
    },
    updatedAt: occurredAt,
  };
}

export function requestPrivatePublication(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal, input.record);
  assertBinding(input.binding, input.record);
  if (
    input.record.state !== 'approved' ||
    !input.record.approval ||
    input.record.pendingProviderOperationId ||
    input.record.pendingProviderRequestHash
  ) {
    throw failure('invalidState', 'Admin approval is required before publication.');
  }
  const generation = input.record.publicationGeneration + 1;
  const occurredAt = validInstant(input.binding.occurredAt);
  const providerOperationId = stableKey('provider_operation', [
    'vimeo',
    'publish_private',
    input.record.accountKey,
    input.record.productKey,
    input.record.contentId,
    input.record.contentVersionId,
    input.record.approval.evidence.projectionDigest,
    String(generation),
  ]);
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      state: 'publishing',
      publicationGeneration: generation,
      pendingProviderOperationId: providerOperationId,
      pendingProviderRequestHash: input.binding.requestHash,
      opaqueProviderAssetRef: null,
      providerReadbackDigest: null,
      publishedAt: null,
      archivedAt: null,
      updatedAt: occurredAt,
    },
    intent: {
      intentId: stableKey('publish', [
        input.record.accountKey,
        input.record.productKey,
        input.record.contentId,
        input.record.contentVersionId,
        input.record.approval.evidence.projectionDigest,
        String(generation),
        input.binding.idempotencyKey,
      ]),
      accountKey: input.record.accountKey,
      productKey: input.record.productKey,
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: generation,
      providerOperationId,
      provider: 'vimeo',
      operation: 'publish_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
      approvalEvidence: input.record.approval.evidence,
    },
  };
}

export function createContentPublicationProviderOperation(input: {
  intent: ContentPublicationOutboxIntent;
  binding: ProviderRegistryBinding;
}): ProviderOperation {
  const { intent, binding } = input;
  if (
    intent.provider !== 'vimeo' ||
    !['publish_private', 'revoke_private'].includes(intent.operation) ||
    binding.provider !== 'vimeo' ||
    binding.mutation_policy !== 'allowed' ||
    binding.scope.product !== intent.productKey
  ) {
    throw failure(
      'conflict',
      'Publication provider operation is not authorized by the exact Vimeo binding.',
    );
  }
  const operation: ProviderOperation = {
    job_id: intent.providerOperationId,
    operation_type: intent.operation,
    aggregate_ref: intent.contentId,
    source_version: intent.publicationGeneration,
    provider: intent.provider,
    scope: binding.scope,
    idempotency_key: intent.idempotencyKey,
    canonical_request_hash: intent.requestHash,
    payload_ref: intent.contentVersionId,
    payload_digest: intent.approvalEvidence.projectionDigest,
    compensation_for_job_id: null,
    state: 'not_started',
    version: 1,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: intent.createdAt,
    updated_at: intent.createdAt,
    registry_binding_key: binding.registry_binding_key,
    provider_account_ref_hash: binding.provider_account_ref_hash,
    effect_kind: 'mutation',
    household_id: null,
  };
  try {
    assertProviderOperationBound(operation, binding);
  } catch {
    throw failure(
      'conflict',
      'Publication provider operation is not authorized by the exact Vimeo binding.',
    );
  }
  return operation;
}

export function recordPrivatePublication(input: {
  record: ContentPublicationRecord;
  observation: Extract<VimeoContentPublicationObservation, { operation: 'publish_private' }>;
  audience: readonly StudentPublicationAudience[];
  eligibility: readonly StudentPublicationEligibility[];
  pendingProviderContext: PendingContentPublicationProviderContext;
  binding: ContentPublicationCommandBinding;
}): {
  record: ContentPublicationRecord;
  materialization: ContentPublicationMaterialization;
  providerCompletion: ContentPublicationProviderCompletion;
} {
  assertBinding(input.binding, input.record);
  const occurredAt = validInstant(input.binding.occurredAt);
  const readback = buildPublicationReadback(
    input.record,
    input.pendingProviderContext,
    input.observation,
  );
  assertPublicationReadback(input.record, input.pendingProviderContext, readback);
  assertReadbackChronology(
    input.pendingProviderContext.intent.createdAt,
    readback.observedAt,
    occurredAt,
  );
  const record = {
    ...input.record,
    version: input.record.version + 1,
    state: 'published' as const,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: readback.opaqueProviderAssetRef,
    providerReadbackDigest: readback.providerReadbackDigest,
    publishedAt: occurredAt,
    archivedAt: null,
    updatedAt: occurredAt,
  };
  return {
    record,
    materialization: materializePublication(record, input.audience, input.eligibility, occurredAt),
    providerCompletion: {
      providerOperationId: readback.providerOperationId,
      expectedProviderOperationVersion: readback.providerOperationVersion,
      outboxIntentId: input.pendingProviderContext.intent.intentId,
      operation: 'publish_private',
      accountKey: input.record.accountKey,
      productKey: input.record.productKey,
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      canonicalRequestHash: readback.canonicalRequestHash,
      providerAcceptanceDigest: readback.providerAcceptanceDigest,
      providerReconciliationDigest: readback.providerReconciliationDigest,
      registryBindingKey: input.pendingProviderContext.providerOperation.registryBindingKey,
      providerAccountRefHash: input.pendingProviderContext.providerOperation.providerAccountRefHash,
      providerReadbackDigest: readback.providerReadbackDigest,
      oneTimeReadbackDigest: readback.oneTimeReadbackDigest,
      providerResourceRefHash: readback.providerResourceRefHash,
      providerObservedAt: readback.observedAt,
      completedAt: occurredAt,
      approvalProjectionDigest: input.record.approval!.evidence.projectionDigest,
    },
  };
}

export function unpublishContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal, input.record);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'published' || !input.record.opaqueProviderAssetRef) {
    throw failure('invalidState', 'Only currently published content can be unpublished.');
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  const providerOperationId = stableKey('provider_operation', [
    'vimeo',
    'revoke_private',
    input.record.accountKey,
    input.record.productKey,
    input.record.contentId,
    input.record.contentVersionId,
    input.record.approval!.evidence.projectionDigest,
    String(input.record.publicationGeneration),
  ]);
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      state: 'approved',
      playbackGrantGeneration: input.record.playbackGrantGeneration + 1,
      pendingProviderOperationId: providerOperationId,
      pendingProviderRequestHash: input.binding.requestHash,
      publishedAt: null,
      archivedAt: null,
      updatedAt: occurredAt,
    },
    intent: {
      intentId: stableKey('revoke', [
        input.record.accountKey,
        input.record.productKey,
        input.record.contentId,
        input.record.contentVersionId,
        input.record.approval!.evidence.projectionDigest,
        String(input.record.publicationGeneration),
        input.binding.idempotencyKey,
      ]),
      accountKey: input.record.accountKey,
      productKey: input.record.productKey,
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      providerOperationId,
      provider: 'vimeo',
      operation: 'revoke_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
      approvalEvidence: input.record.approval!.evidence,
    },
  };
}

export function recordPrivateRevocation(input: {
  record: ContentPublicationRecord;
  observation: Extract<VimeoContentPublicationObservation, { operation: 'revoke_private' }>;
  pendingProviderContext: PendingContentPublicationProviderContext;
  binding: ContentPublicationCommandBinding;
}): {
  record: ContentPublicationRecord;
  providerCompletion: ContentPublicationProviderCompletion;
} {
  assertBinding(input.binding, input.record);
  const completedAt = validInstant(input.binding.occurredAt);
  const readback = buildRevocationReadback(
    input.record,
    input.pendingProviderContext,
    input.observation,
  );
  assertRevocationReadback(input.record, input.pendingProviderContext, readback);
  assertReadbackChronology(
    input.pendingProviderContext.intent.createdAt,
    readback.observedAt,
    completedAt,
  );
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      pendingProviderOperationId: null,
      pendingProviderRequestHash: null,
      opaqueProviderAssetRef: null,
      providerReadbackDigest: readback.providerReadbackDigest,
      updatedAt: completedAt,
    },
    providerCompletion: {
      providerOperationId: readback.providerOperationId,
      expectedProviderOperationVersion: readback.providerOperationVersion,
      outboxIntentId: input.pendingProviderContext.intent.intentId,
      operation: 'revoke_private',
      accountKey: input.record.accountKey,
      productKey: input.record.productKey,
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      canonicalRequestHash: readback.canonicalRequestHash,
      providerAcceptanceDigest: readback.providerAcceptanceDigest,
      providerReconciliationDigest: readback.providerReconciliationDigest,
      registryBindingKey: input.pendingProviderContext.providerOperation.registryBindingKey,
      providerAccountRefHash: input.pendingProviderContext.providerOperation.providerAccountRefHash,
      providerReadbackDigest: readback.providerReadbackDigest,
      oneTimeReadbackDigest: readback.oneTimeReadbackDigest,
      providerResourceRefHash: readback.providerResourceRefHash,
      providerObservedAt: readback.observedAt,
      completedAt,
      approvalProjectionDigest: input.record.approval!.evidence.projectionDigest,
    },
  };
}

export function archiveContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent?: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal, input.record);
  assertBinding(input.binding, input.record);
  if (
    input.record.state === 'archived' ||
    input.record.state === 'publishing' ||
    input.record.pendingProviderOperationId ||
    input.record.pendingProviderRequestHash
  ) {
    throw failure('invalidState', 'Content cannot be archived from its current state.');
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  const revokeRequired =
    input.record.state === 'published' && input.record.opaqueProviderAssetRef !== null;
  const providerOperationId = revokeRequired
    ? stableKey('provider_operation', [
        'vimeo',
        'archive_revoke_private',
        input.record.accountKey,
        input.record.productKey,
        input.record.contentId,
        input.record.contentVersionId,
        input.record.approval!.evidence.projectionDigest,
        String(input.record.publicationGeneration),
      ])
    : null;
  const record = {
    ...input.record,
    version: input.record.version + 1,
    state: 'archived' as const,
    playbackGrantGeneration: input.record.playbackGrantGeneration + 1,
    pendingProviderOperationId: providerOperationId,
    pendingProviderRequestHash: revokeRequired ? input.binding.requestHash : null,
    publishedAt: null,
    archivedAt: occurredAt,
    updatedAt: occurredAt,
  };
  if (!revokeRequired || !providerOperationId) return { record };
  return {
    record,
    intent: {
      intentId: stableKey('archive-revoke', [
        input.record.accountKey,
        input.record.productKey,
        input.record.contentId,
        input.record.contentVersionId,
        input.record.approval!.evidence.projectionDigest,
        String(input.record.publicationGeneration),
        input.binding.idempotencyKey,
      ]),
      providerOperationId,
      provider: 'vimeo',
      accountKey: input.record.accountKey,
      productKey: input.record.productKey,
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      operation: 'revoke_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
      approvalEvidence: input.record.approval!.evidence,
    },
  };
}

export function attachOccurrence(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  relation: Omit<GovernedContentOccurrenceRelation, 'governedByAdminId' | 'attachedAt'>;
  canonicalOccurrence: CanonicalGovernedOccurrence;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal, input.record);
  assertBinding(input.binding, input.record);
  assertOccurrenceRelation(input.principal, input.relation, input.canonicalOccurrence);
  if (input.record.state === 'archived' || input.record.state === 'failed') {
    throw failure('invalidState', 'Unavailable content cannot be attached.');
  }
  const existing = input.record.occurrenceRelations.find(
    (relation) => relation.occurrenceId === input.relation.occurrenceId,
  );
  if (existing) {
    if (
      existing.relationId !== input.relation.relationId ||
      existing.occurrenceVersion !== input.relation.occurrenceVersion ||
      existing.canonicalSeriesId !== input.relation.canonicalSeriesId ||
      existing.accountKey !== input.relation.accountKey ||
      existing.productKey !== input.relation.productKey
    ) {
      throw failure('conflict', 'Occurrence relation already exists with different governance.');
    }
    return input.record;
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    ...input.record,
    version: input.record.version + 1,
    occurrenceRelations: [
      ...input.record.occurrenceRelations,
      {
        ...input.relation,
        governedByAdminId: input.principal.actorId,
        attachedAt: occurredAt,
      },
    ],
    updatedAt: occurredAt,
  };
}

export function authorizeStudentPlayback(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  assignment: StudentContentAssignment | null;
  facts: StudentPlaybackAuthorizationFacts | null;
  now: Date;
  playbackSessionId: string;
}): StudentPlaybackGrant {
  assertStudentContentAccess(input);
  assertSafeId(input.playbackSessionId, 'playbackSessionId');
  const issuedAt = validDate(input.now);
  return {
    accountKey: input.record.accountKey,
    productKey: input.record.productKey,
    contentId: input.record.contentId,
    contentVersionId: input.record.contentVersionId,
    publicationGeneration: input.record.publicationGeneration,
    playbackGrantGeneration: input.record.playbackGrantGeneration,
    studentId: input.facts!.studentId,
    studentVersion: input.facts!.studentVersion,
    sessionId: input.facts!.sessionId,
    sessionVersion: input.facts!.sessionVersion,
    assignmentId: input.assignment!.assignmentId,
    assignmentVersion: input.assignment!.assignmentVersion,
    accessVersion: input.facts!.accessVersion,
    enrollmentVersion: input.facts!.enrollmentVersion,
    serviceAccountConsentVersion: input.facts!.serviceAccountConsentVersion,
    privacyVersion: input.facts!.privacyVersion,
    revocationVersion: input.facts!.revocationVersion,
    playbackSessionId: input.playbackSessionId,
    bootstrapPath: `/api/v1/student/library/${encodeURIComponent(input.record.contentId)}/playback`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + CONTENT_PLAYBACK_GRANT_TTL_MS).toISOString(),
    renewable: true,
    approvalProjectionDigest: input.record.approval!.evidence.projectionDigest,
  };
}

export function saveStudentResume(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  assignment: StudentContentAssignment | null;
  facts: StudentPlaybackAuthorizationFacts | null;
  existing: StudentContentResume | null;
  positionMs: number;
  occurredAt: string;
}): StudentContentResume {
  assertStudentContentAccess(input);
  if (
    !Number.isSafeInteger(input.positionMs) ||
    input.positionMs < 0 ||
    input.positionMs > input.record.durationMs
  ) {
    throw failure('invalidInput', 'Resume position is outside the published media duration.');
  }
  const studentId = input.principal.studentId;
  if (!studentId) throw failure('accessDenied', 'Student access is unavailable.');
  if (
    input.existing &&
    (input.existing.studentId !== studentId ||
      input.existing.accountKey !== input.record.accountKey ||
      input.existing.productKey !== input.record.productKey ||
      input.existing.householdId !== input.principal.householdId ||
      input.existing.contentId !== input.record.contentId ||
      input.existing.contentVersionId !== input.record.contentVersionId ||
      input.existing.approvalProjectionDigest !== input.record.approval?.evidence.projectionDigest)
  ) {
    throw failure('accessDenied', 'Resume state belongs to another Student scope.');
  }
  return {
    accountKey: input.record.accountKey,
    productKey: input.record.productKey,
    studentId,
    householdId: input.principal.householdId,
    contentId: input.record.contentId,
    contentVersionId: input.record.contentVersionId,
    publicationVersion: input.record.version,
    positionMs: input.positionMs,
    updatedAt: validInstant(input.occurredAt),
    version: (input.existing?.version ?? 0) + 1,
    approvalProjectionDigest: input.record.approval!.evidence.projectionDigest,
  };
}

export function searchStudentLibrary(input: {
  principal: ContentPublicationPrincipal;
  query: string;
  published: readonly ContentPublicationRecord[];
  assignments: ReadonlyMap<string, StudentContentAssignment | null>;
  facts: ReadonlyMap<string, StudentPlaybackAuthorizationFacts | null>;
  resumes: ReadonlyMap<string, StudentContentResume | null>;
}): StudentLibraryItem[] {
  if (
    input.principal.role !== 'student' ||
    !input.principal.studentId ||
    !['active', 'grace'].includes(input.principal.accessState)
  ) {
    throw failure('accessDenied', 'Student library access is unavailable.');
  }
  const query = normalizeSearch(input.query);
  return input.published
    .filter((record) => {
      try {
        assertStudentContentAccess({
          principal: input.principal,
          record,
          assignment: input.assignments.get(record.contentId) ?? null,
          facts: input.facts.get(record.contentId) ?? null,
        });
        return searchText(record).includes(query);
      } catch {
        return false;
      }
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map((record) => {
      const resume = input.resumes.get(record.contentId);
      return {
        contentId: record.contentId,
        title: record.title,
        classTopic: record.classTopic,
        mishnahReferences: [...record.mishnahReferences],
        occurredAt: record.occurredAt,
        durationMs: record.durationMs,
        resumePositionMs:
          resume?.studentId === input.principal.studentId &&
          resume.accountKey === record.accountKey &&
          resume.productKey === record.productKey &&
          resume.householdId === input.principal.householdId &&
          resume.contentVersionId === record.contentVersionId &&
          resume.publicationVersion === record.version &&
          resume.approvalProjectionDigest === record.approval?.evidence.projectionDigest
            ? resume.positionMs
            : 0,
        internalRoute: `/app/student/library/${encodeURIComponent(record.contentId)}`,
      };
    });
}

export function assertReceiptReplay(
  receipt: ContentPublicationReceipt,
  operation: ContentPublicationReceipt['operation'],
  requestHash: string,
  record: ContentPublicationRecord,
) {
  if (
    receipt.operation !== operation ||
    receipt.requestHash !== requestHash ||
    receipt.contentId !== record.contentId ||
    receipt.contentVersionId !== record.contentVersionId ||
    receipt.publicationGeneration !== record.publicationGeneration ||
    receipt.approvalProjectionDigest !==
      (record.approval?.evidence.projectionDigest ?? record.contentVersionDigest)
  ) {
    throw failure('conflict', 'Idempotency key was already used for a different request.');
  }
}

export function assertAdminPublicationPrincipal(principal: ContentPublicationPrincipal) {
  assertAdmin(principal);
}

export function assertStudentContentAccess(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  assignment: StudentContentAssignment | null;
  facts: StudentPlaybackAuthorizationFacts | null;
}) {
  assertStudentAccess(input.principal, input.record, input.assignment, input.facts);
}

export function stableKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}

function assertStudentAccess(
  principal: ContentPublicationPrincipal,
  record: ContentPublicationRecord,
  assignment: StudentContentAssignment | null,
  facts: StudentPlaybackAuthorizationFacts | null,
) {
  if (
    principal.role !== 'student' ||
    !principal.studentId ||
    !principal.sessionId ||
    !Number.isSafeInteger(principal.sessionVersion) ||
    principal.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    principal.accountKey !== record.accountKey ||
    principal.productKey !== record.productKey ||
    !['active', 'grace'].includes(principal.accessState) ||
    record.state !== 'published' ||
    !record.approval ||
    !record.opaqueProviderAssetRef ||
    !record.providerReadbackDigest ||
    !assignment ||
    !assignment.active ||
    assignment.accountKey !== record.accountKey ||
    assignment.productKey !== record.productKey ||
    assignment.revokedAt !== null ||
    assignment.contentId !== record.contentId ||
    assignment.contentVersionId !== record.contentVersionId ||
    assignment.publicationGeneration !== record.publicationGeneration ||
    assignment.studentId !== principal.studentId ||
    assignment.householdId !== principal.householdId ||
    JSON.stringify(assignment.approvalEvidence) !== JSON.stringify(record.approval.evidence) ||
    !record.occurrenceRelations.some(
      (relation) =>
        relation.occurrenceId === assignment.occurrenceId &&
        relation.productKey === CONTENT_PUBLICATION_PRODUCT_KEY,
    ) ||
    !facts ||
    facts.accountKey !== record.accountKey ||
    facts.productKey !== record.productKey ||
    facts.approvalProjectionDigest !== record.approval.evidence.projectionDigest ||
    facts.assignmentId !== assignment.assignmentId ||
    facts.assignmentVersion !== assignment.assignmentVersion ||
    facts.studentId !== principal.studentId ||
    facts.householdId !== principal.householdId ||
    facts.sessionId !== principal.sessionId ||
    facts.sessionVersion !== principal.sessionVersion ||
    !facts.sessionActive ||
    facts.studentVersion !== assignment.studentVersion ||
    !facts.studentActive ||
    facts.enrollmentVersion !== assignment.enrollmentVersion ||
    !facts.enrollmentActive ||
    facts.accessVersion !== assignment.accessVersion ||
    !['active', 'grace'].includes(facts.accessState) ||
    facts.accessState !== principal.accessState ||
    facts.serviceAccountConsentVersion !== assignment.serviceAccountConsentVersion ||
    !facts.serviceAccountAccepted ||
    facts.privacyVersion !== assignment.privacyVersion ||
    facts.revocationVersion !== assignment.revocationVersion ||
    facts.studentRevoked ||
    facts.accountRevoked ||
    facts.contentRevoked ||
    facts.privacyReviewState !== 'clear'
  ) {
    throw failure('accessDenied', 'Content is unavailable.');
  }
}

function assertAdmin(principal: ContentPublicationPrincipal, record?: ContentPublicationRecord) {
  if (
    principal.role !== 'admin' ||
    !principal.accountKey.trim() ||
    principal.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    principal.accessState !== 'active' ||
    (record &&
      (principal.accountKey !== record.accountKey || principal.productKey !== record.productKey))
  ) {
    throw failure('accessDenied', 'Admin publication access is unavailable.');
  }
}

function assertApprovalEvidence(
  principal: ContentPublicationPrincipal,
  record: ContentPublicationRecord,
  evidence: ContentApprovalEvidence,
  approvalInstant: string,
) {
  const artifactKinds = evidence.artifacts.map(({ kind }) => kind);
  const projectionCore = {
    accountKey: evidence.accountKey,
    productKey: evidence.productKey,
    contentVersionId: evidence.contentVersionId,
    sourceId: evidence.sourceId,
    sourceSha256: evidence.sourceSha256,
    sourceObjectVersionId: evidence.sourceObjectVersionId,
    participantSnapshotDigest: evidence.participantSnapshotDigest,
    approvedByAdminId: evidence.approvedByAdminId,
    approvedAt: evidence.approvedAt,
    artifacts: evidence.artifacts,
    approvedArtifactSetDigest: evidence.approvedArtifactSetDigest,
    sourceEvidenceDigest: evidence.sourceEvidenceDigest,
  };
  const expectedProjectionDigest = createHash('sha256')
    .update(JSON.stringify(projectionCore))
    .digest('hex');
  if (
    evidence.accountKey !== record.accountKey ||
    evidence.accountKey !== principal.accountKey ||
    evidence.productKey !== record.productKey ||
    evidence.productKey !== principal.productKey ||
    evidence.contentVersionId !== record.contentVersionId ||
    evidence.projectionDigest !== expectedProjectionDigest ||
    evidence.participantSnapshotDigest !== record.participantSnapshotSetDigest ||
    record.participantReviewState !== 'complete' ||
    record.unresolvedParticipantCount !== 0 ||
    record.completedRedactionCount !== record.requiredRedactionCount ||
    evidence.approvedByAdminId !== principal.actorId ||
    Date.parse(validInstant(evidence.approvedAt)) > Date.parse(approvalInstant) ||
    evidence.artifacts.length !== REQUIRED_APPROVED_ARTIFACT_KINDS.length ||
    new Set(artifactKinds).size !== REQUIRED_APPROVED_ARTIFACT_KINDS.length ||
    REQUIRED_APPROVED_ARTIFACT_KINDS.some((kind) => !artifactKinds.includes(kind)) ||
    evidence.artifacts.some(
      (artifact) =>
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,179}$/.test(artifact.artifactId) ||
        !Number.isSafeInteger(artifact.revision) ||
        artifact.revision < 1 ||
        !/^[a-f0-9]{64}$/.test(artifact.payloadDigest),
    )
  ) {
    throw failure(
      'invalidState',
      'The approved processing projection does not match the publication composite scope.',
    );
  }
  for (const [value, field] of [
    [evidence.sourceSha256, 'sourceSha256'],
    [evidence.participantSnapshotDigest, 'participantSnapshotDigest'],
    [evidence.approvedArtifactSetDigest, 'approvedArtifactSetDigest'],
    [evidence.sourceEvidenceDigest, 'sourceEvidenceDigest'],
    [evidence.projectionDigest, 'projectionDigest'],
  ] as const) {
    assertDigest(value, field);
  }
  assertSafeId(evidence.sourceId, 'sourceId');
  assertSafeId(evidence.sourceObjectVersionId, 'sourceObjectVersionId');
  assertSafeId(evidence.approvedByAdminId, 'approvedByAdminId');
}

function assertOccurrenceRelation(
  principal: ContentPublicationPrincipal,
  relation: Omit<GovernedContentOccurrenceRelation, 'governedByAdminId' | 'attachedAt'>,
  canonical: CanonicalGovernedOccurrence,
) {
  assertSafeId(relation.relationId, 'relationId');
  assertSafeId(relation.occurrenceId, 'occurrenceId');
  assertSafeId(relation.canonicalSeriesId, 'canonicalSeriesId');
  if (
    relation.accountKey !== principal.accountKey ||
    relation.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    relation.productKey !== principal.productKey ||
    canonical.governanceState !== 'governed' ||
    canonical.active !== true ||
    canonical.occurrenceId !== relation.occurrenceId ||
    canonical.occurrenceVersion !== relation.occurrenceVersion ||
    canonical.canonicalSeriesId !== relation.canonicalSeriesId ||
    canonical.accountKey !== relation.accountKey ||
    canonical.productKey !== relation.productKey ||
    !Number.isSafeInteger(relation.occurrenceVersion) ||
    relation.occurrenceVersion < 1
  ) {
    throw failure('invalidInput', 'Occurrence relation is not governed for this product.');
  }
}

function buildPublicationReadback(
  record: ContentPublicationRecord,
  pending: PendingContentPublicationProviderContext,
  observation: Extract<VimeoContentPublicationObservation, { operation: 'publish_private' }>,
): VimeoProviderOperationReadback {
  const operation = pending.providerOperation;
  const observedAt = validInstant(observation.observedAt);
  assertOpaqueReference(observation.opaqueProviderAssetRef);
  const providerResourceRefHash = sha256(observation.opaqueProviderAssetRef);
  if (
    observation.providerResourceRefHash !== providerResourceRefHash ||
    observation.providerAcceptanceDigest !== operation.providerAcceptanceDigest
  ) {
    throw failure('conflict', 'Canonical Vimeo publication readback does not match the provider.');
  }
  const providerReadbackDigest = canonicalProviderReadbackDigest({
    record,
    pending,
    observation,
    providerResourceRefHash,
  });
  const oneTimeReadbackDigest = canonicalOneTimeReadbackDigest({
    record,
    pending,
    providerReadbackDigest,
    readiness: 'ready_to_apply',
  });
  return {
    accountKey: record.accountKey,
    productKey: record.productKey,
    providerOperationId: operation.providerOperationId,
    providerOperationVersion: operation.providerOperationVersion,
    providerOperationState: 'accepted',
    operation: 'publish_private',
    contentId: record.contentId,
    contentVersionId: record.contentVersionId,
    publicationGeneration: record.publicationGeneration,
    canonicalRequestHash: operation.canonicalRequestHash,
    state: 'complete',
    observedAt,
    opaqueProviderAssetRef: observation.opaqueProviderAssetRef,
    providerResourceRefHash,
    vimeoPrivacy: observation.vimeoPrivacy,
    vimeoAvailability: observation.vimeoAvailability,
    matchingCanonicalAssetCount: observation.matchingCanonicalAssetCount,
    exactContentVersionCorrelation: observation.exactContentVersionCorrelation,
    providerAcceptanceDigest: observation.providerAcceptanceDigest,
    providerReconciliationDigest: operation.providerReconciliationDigest,
    providerReadbackDigest,
    oneTimePublicationReadback: 'ready_to_apply',
    oneTimeReadbackDigest,
    approvalProjectionDigest: operation.approvalProjectionDigest,
  };
}

function buildRevocationReadback(
  record: ContentPublicationRecord,
  pending: PendingContentPublicationProviderContext,
  observation: Extract<VimeoContentPublicationObservation, { operation: 'revoke_private' }>,
): VimeoProviderRevocationReadback {
  const operation = pending.providerOperation;
  const observedAt = validInstant(observation.observedAt);
  const providerResourceRefHash = sha256(record.opaqueProviderAssetRef ?? '');
  if (
    !record.opaqueProviderAssetRef ||
    observation.providerResourceRefHash !== providerResourceRefHash ||
    observation.providerAcceptanceDigest !== operation.providerAcceptanceDigest
  ) {
    throw failure('conflict', 'Canonical Vimeo revocation readback does not match the provider.');
  }
  const providerReadbackDigest = canonicalProviderReadbackDigest({
    record,
    pending,
    observation,
    providerResourceRefHash,
  });
  const oneTimeReadbackDigest = canonicalOneTimeReadbackDigest({
    record,
    pending,
    providerReadbackDigest,
    readiness: 'revocation_ready_to_apply',
  });
  return {
    accountKey: record.accountKey,
    productKey: record.productKey,
    providerOperationId: operation.providerOperationId,
    providerOperationVersion: operation.providerOperationVersion,
    providerOperationState: 'accepted',
    operation: 'revoke_private',
    contentId: record.contentId,
    contentVersionId: record.contentVersionId,
    publicationGeneration: record.publicationGeneration,
    canonicalRequestHash: operation.canonicalRequestHash,
    state: 'complete',
    observedAt,
    providerResourceRefHash,
    vimeoAvailability: observation.vimeoAvailability,
    matchingCanonicalAssetCount: observation.matchingCanonicalAssetCount,
    exactContentVersionCorrelation: observation.exactContentVersionCorrelation,
    providerAcceptanceDigest: observation.providerAcceptanceDigest,
    providerReconciliationDigest: operation.providerReconciliationDigest,
    providerReadbackDigest,
    oneTimePublicationReadback: 'revocation_ready_to_apply',
    oneTimeReadbackDigest,
    approvalProjectionDigest: operation.approvalProjectionDigest,
  };
}

function canonicalProviderReadbackDigest(input: {
  record: ContentPublicationRecord;
  pending: PendingContentPublicationProviderContext;
  observation: VimeoContentPublicationObservation;
  providerResourceRefHash: string;
}) {
  const operation = input.pending.providerOperation;
  const privacy =
    input.observation.operation === 'publish_private' ? input.observation.vimeoPrivacy : null;
  return sha256(
    JSON.stringify([
      'vimeo_content_publication_readback_v1',
      input.record.accountKey,
      input.record.productKey,
      operation.providerOperationId,
      operation.providerOperationVersion,
      input.observation.operation,
      input.record.contentId,
      input.record.contentVersionId,
      input.record.publicationGeneration,
      operation.canonicalRequestHash,
      operation.registryBindingKey,
      operation.providerAccountRefHash,
      input.providerResourceRefHash,
      input.observation.providerAcceptanceDigest,
      input.observation.vimeoAvailability,
      privacy,
      input.observation.matchingCanonicalAssetCount,
      input.observation.exactContentVersionCorrelation,
      operation.approvalProjectionDigest,
    ]),
  );
}

function canonicalOneTimeReadbackDigest(input: {
  record: ContentPublicationRecord;
  pending: PendingContentPublicationProviderContext;
  providerReadbackDigest: string;
  readiness: 'ready_to_apply' | 'revocation_ready_to_apply';
}) {
  return sha256(
    JSON.stringify([
      'one_time_content_publication_readback_v1',
      input.record.accountKey,
      input.record.productKey,
      input.record.contentId,
      input.record.contentVersionId,
      input.record.version,
      input.record.state,
      input.record.publicationGeneration,
      input.record.pendingProviderOperationId,
      input.record.pendingProviderRequestHash,
      input.pending.intent.intentId,
      input.pending.providerOperation.providerOperationVersion,
      input.record.approval?.evidence.projectionDigest ?? null,
      input.providerReadbackDigest,
      input.readiness,
    ]),
  );
}

function assertReadbackChronology(
  intentCreatedAt: string,
  observedAt: string,
  completedAt: string,
) {
  const intentTime = Date.parse(validInstant(intentCreatedAt));
  const observedTime = Date.parse(validInstant(observedAt));
  const completedTime = Date.parse(validInstant(completedAt));
  if (observedTime < intentTime || observedTime > completedTime) {
    throw failure('conflict', 'Canonical provider readback chronology is invalid.');
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function assertPublicationReadback(
  record: ContentPublicationRecord,
  pending: PendingContentPublicationProviderContext,
  readback: VimeoProviderOperationReadback,
) {
  const intent = pending.intent;
  const operation = pending.providerOperation;
  if (
    record.state !== 'publishing' ||
    !record.approval ||
    !record.pendingProviderOperationId ||
    readback.providerOperationId !== record.pendingProviderOperationId ||
    intent.providerOperationId !== record.pendingProviderOperationId ||
    intent.provider !== 'vimeo' ||
    intent.operation !== 'publish_private' ||
    intent.accountKey !== record.accountKey ||
    intent.productKey !== record.productKey ||
    intent.contentId !== record.contentId ||
    intent.contentVersionId !== record.contentVersionId ||
    intent.publicationGeneration !== record.publicationGeneration ||
    intent.requestHash !== record.pendingProviderRequestHash ||
    JSON.stringify(intent.approvalEvidence) !== JSON.stringify(record.approval.evidence) ||
    intent.state !== 'pending' ||
    operation.providerOperationId !== intent.providerOperationId ||
    operation.providerOperationVersion !== readback.providerOperationVersion ||
    operation.provider !== intent.provider ||
    operation.operation !== intent.operation ||
    operation.accountKey !== record.accountKey ||
    operation.productKey !== record.productKey ||
    operation.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    operation.contentId !== intent.contentId ||
    operation.contentVersionId !== intent.contentVersionId ||
    operation.publicationGeneration !== intent.publicationGeneration ||
    operation.idempotencyKey !== intent.idempotencyKey ||
    operation.canonicalRequestHash !== intent.requestHash ||
    operation.state !== 'accepted' ||
    operation.unknownEffect !== false ||
    operation.providerAcceptanceDigest !== readback.providerAcceptanceDigest ||
    operation.providerReconciliationDigest !== readback.providerReconciliationDigest ||
    operation.approvalProjectionDigest !== record.approval.evidence.projectionDigest ||
    readback.accountKey !== record.accountKey ||
    readback.productKey !== record.productKey ||
    readback.approvalProjectionDigest !== record.approval.evidence.projectionDigest ||
    readback.providerOperationState !== operation.state ||
    readback.operation !== 'publish_private' ||
    readback.contentId !== record.contentId ||
    readback.contentVersionId !== record.contentVersionId ||
    readback.publicationGeneration !== record.publicationGeneration ||
    !record.pendingProviderRequestHash ||
    readback.canonicalRequestHash !== record.pendingProviderRequestHash ||
    readback.state !== 'complete' ||
    readback.vimeoPrivacy !== 'private' ||
    readback.vimeoAvailability !== 'available' ||
    readback.matchingCanonicalAssetCount !== 1 ||
    readback.exactContentVersionCorrelation !== true ||
    readback.oneTimePublicationReadback !== 'ready_to_apply'
  ) {
    throw failure(
      'conflict',
      'Canonical Vimeo and One Time publication readback is incomplete or ambiguous.',
    );
  }
  assertSafeId(operation.registryBindingKey, 'registryBindingKey');
  assertDigest(operation.providerAccountRefHash, 'providerAccountRefHash');
  validInstant(readback.observedAt);
  assertOpaqueReference(readback.opaqueProviderAssetRef);
  assertDigest(readback.providerResourceRefHash, 'providerResourceRefHash');
  assertDigest(readback.providerAcceptanceDigest, 'providerAcceptanceDigest');
  if (readback.providerReconciliationDigest !== null) {
    assertDigest(readback.providerReconciliationDigest, 'providerReconciliationDigest');
  }
  assertDigest(readback.providerReadbackDigest, 'providerReadbackDigest');
  assertDigest(readback.oneTimeReadbackDigest, 'oneTimeReadbackDigest');
}

function assertRevocationReadback(
  record: ContentPublicationRecord,
  pending: PendingContentPublicationProviderContext,
  readback: VimeoProviderRevocationReadback,
) {
  const intent = pending.intent;
  const operation = pending.providerOperation;
  if (
    !['approved', 'archived'].includes(record.state) ||
    !record.approval ||
    !record.opaqueProviderAssetRef ||
    !record.pendingProviderOperationId ||
    !record.pendingProviderRequestHash ||
    intent.providerOperationId !== record.pendingProviderOperationId ||
    intent.provider !== 'vimeo' ||
    intent.operation !== 'revoke_private' ||
    intent.accountKey !== record.accountKey ||
    intent.productKey !== record.productKey ||
    intent.contentId !== record.contentId ||
    intent.contentVersionId !== record.contentVersionId ||
    intent.publicationGeneration !== record.publicationGeneration ||
    intent.requestHash !== record.pendingProviderRequestHash ||
    JSON.stringify(intent.approvalEvidence) !== JSON.stringify(record.approval.evidence) ||
    intent.state !== 'pending' ||
    operation.providerOperationId !== intent.providerOperationId ||
    operation.providerOperationVersion !== readback.providerOperationVersion ||
    operation.provider !== intent.provider ||
    operation.operation !== intent.operation ||
    operation.accountKey !== record.accountKey ||
    operation.productKey !== record.productKey ||
    operation.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    operation.contentId !== intent.contentId ||
    operation.contentVersionId !== intent.contentVersionId ||
    operation.publicationGeneration !== intent.publicationGeneration ||
    operation.idempotencyKey !== intent.idempotencyKey ||
    operation.canonicalRequestHash !== intent.requestHash ||
    operation.state !== 'accepted' ||
    operation.unknownEffect !== false ||
    operation.providerAcceptanceDigest !== readback.providerAcceptanceDigest ||
    operation.providerReconciliationDigest !== readback.providerReconciliationDigest ||
    operation.approvalProjectionDigest !== record.approval.evidence.projectionDigest ||
    readback.providerOperationId !== record.pendingProviderOperationId ||
    readback.accountKey !== record.accountKey ||
    readback.productKey !== record.productKey ||
    readback.approvalProjectionDigest !== record.approval.evidence.projectionDigest ||
    readback.providerOperationState !== operation.state ||
    readback.operation !== 'revoke_private' ||
    readback.contentId !== record.contentId ||
    readback.contentVersionId !== record.contentVersionId ||
    readback.publicationGeneration !== record.publicationGeneration ||
    readback.canonicalRequestHash !== record.pendingProviderRequestHash ||
    readback.state !== 'complete' ||
    readback.vimeoAvailability !== 'revoked' ||
    ![0, 1].includes(readback.matchingCanonicalAssetCount) ||
    readback.exactContentVersionCorrelation !== true ||
    readback.oneTimePublicationReadback !== 'revocation_ready_to_apply'
  ) {
    throw failure(
      'conflict',
      'Canonical Vimeo and One Time revocation readback is incomplete or ambiguous.',
    );
  }
  assertSafeId(operation.registryBindingKey, 'registryBindingKey');
  assertDigest(operation.providerAccountRefHash, 'providerAccountRefHash');
  validInstant(readback.observedAt);
  assertDigest(readback.providerResourceRefHash, 'providerResourceRefHash');
  assertDigest(readback.providerAcceptanceDigest, 'providerAcceptanceDigest');
  if (readback.providerReconciliationDigest !== null) {
    assertDigest(readback.providerReconciliationDigest, 'providerReconciliationDigest');
  }
  assertDigest(readback.providerReadbackDigest, 'providerReadbackDigest');
  assertDigest(readback.oneTimeReadbackDigest, 'oneTimeReadbackDigest');
}

function materializePublication(
  record: ContentPublicationRecord,
  audience: readonly StudentPublicationAudience[],
  eligibility: readonly StudentPublicationEligibility[],
  createdAt: string,
): ContentPublicationMaterialization {
  if (eligibility.length !== audience.length) {
    throw failure('accessDenied', 'Publication audience eligibility is unavailable.');
  }
  const eligibilityByStudent = new Map(
    eligibility.map((entry) => [`${entry.studentId}:${entry.occurrenceId}`, entry]),
  );
  const seenStudents = new Set<string>();
  const assignments = audience.map((member) => {
    const current = eligibilityByStudent.get(`${member.studentId}:${member.occurrenceId}`);
    assertSafeId(member.studentId, 'studentId');
    assertSafeId(member.householdId, 'householdId');
    assertSafeId(member.adultRecipientId, 'adultRecipientId');
    assertSafeId(member.occurrenceId, 'occurrenceId');
    if (
      seenStudents.has(member.studentId) ||
      !current ||
      member.accountKey !== record.accountKey ||
      member.productKey !== record.productKey ||
      current.accountKey !== record.accountKey ||
      current.productKey !== record.productKey ||
      current.contentId !== record.contentId ||
      current.contentVersionId !== record.contentVersionId ||
      current.publicationGeneration !== record.publicationGeneration ||
      current.studentId !== member.studentId ||
      current.householdId !== member.householdId ||
      current.adultRecipientId !== member.adultRecipientId ||
      current.occurrenceId !== member.occurrenceId ||
      current.studentVersion !== member.studentVersion ||
      current.enrollmentVersion !== member.enrollmentVersion ||
      current.accessVersion !== member.accessVersion ||
      current.serviceAccountConsentVersion !== member.serviceAccountConsentVersion ||
      current.privacyVersion !== member.privacyVersion ||
      current.revocationVersion !== member.revocationVersion ||
      !current.studentActive ||
      !current.enrollmentActive ||
      !['active', 'grace'].includes(current.accessState) ||
      !current.serviceAccountAccepted ||
      current.privacyReviewState !== 'clear' ||
      current.studentRevoked ||
      current.accountRevoked ||
      current.contentRevoked ||
      !current.adultRecipientActive ||
      current.approvalProjectionDigest !== record.approval?.evidence.projectionDigest ||
      !record.occurrenceRelations.some((relation) => relation.occurrenceId === member.occurrenceId)
    ) {
      throw failure(
        'accessDenied',
        'Publication audience is not currently eligible for protected materialization.',
      );
    }
    for (const version of [
      member.studentVersion,
      member.enrollmentVersion,
      member.accessVersion,
      member.serviceAccountConsentVersion,
      member.privacyVersion,
      member.revocationVersion,
    ]) {
      if (!Number.isSafeInteger(version) || version < 1) {
        throw failure('invalidInput', 'Publication audience versions must be positive integers.');
      }
    }
    seenStudents.add(member.studentId);
    return {
      accountKey: record.accountKey,
      productKey: record.productKey,
      assignmentId: stableKey('assignment', [
        record.accountKey,
        record.productKey,
        record.contentVersionId,
        record.approval!.evidence.projectionDigest,
        String(record.publicationGeneration),
        member.studentId,
      ]),
      assignmentVersion: 1,
      contentId: record.contentId,
      contentVersionId: record.contentVersionId,
      publicationGeneration: record.publicationGeneration,
      studentId: member.studentId,
      householdId: member.householdId,
      occurrenceId: member.occurrenceId,
      studentVersion: member.studentVersion,
      enrollmentVersion: member.enrollmentVersion,
      accessVersion: member.accessVersion,
      serviceAccountConsentVersion: member.serviceAccountConsentVersion,
      privacyVersion: member.privacyVersion,
      revocationVersion: member.revocationVersion,
      active: true,
      revokedAt: null,
      approvalEvidence: record.approval!.evidence,
    } satisfies StudentContentAssignment;
  });
  const libraryProjections = assignments.map((assignment) => ({
    accountKey: assignment.accountKey,
    productKey: assignment.productKey,
    projectionId: stableKey('library', [assignment.assignmentId]),
    assignmentId: assignment.assignmentId,
    assignmentVersion: assignment.assignmentVersion,
    contentId: assignment.contentId,
    contentVersionId: assignment.contentVersionId,
    publicationGeneration: assignment.publicationGeneration,
    studentId: assignment.studentId,
    householdId: assignment.householdId,
    internalRoute: `/app/student/library/${encodeURIComponent(record.contentId)}`,
    active: true as const,
    createdAt,
    approvalEvidence: assignment.approvalEvidence,
  }));
  const notices = audience.flatMap((member, index) => {
    const assignment = assignments[index]!;
    const actionPath = `/app/student/library/${encodeURIComponent(record.contentId)}`;
    const base = {
      accountKey: record.accountKey,
      productKey: record.productKey,
      studentId: member.studentId,
      householdId: member.householdId,
      category: 'recording_available' as const,
      contentId: record.contentId,
      contentVersionId: record.contentVersionId,
      sourceVersion: record.version,
      title: 'New recording available' as const,
      body: `${record.title} is ready in your library.`,
      actionLabel: 'Watch recording' as const,
      actionPath,
      deliveryState: 'pending' as const,
      createdAt,
      approvalProjectionDigest: record.approval!.evidence.projectionDigest,
    };
    return [
      {
        ...base,
        noticeId: stableKey('notice', [assignment.assignmentId, 'student']),
        recipientKind: 'student' as const,
        recipientId: member.studentId,
      },
      {
        ...base,
        noticeId: stableKey('notice', [assignment.assignmentId, 'adult']),
        recipientKind: 'adult' as const,
        recipientId: member.adultRecipientId,
        body: 'A recording is available for the household.',
        actionLabel: 'Open household' as const,
        actionPath: '/app/parent',
      },
    ];
  });
  return {
    accountKey: record.accountKey,
    productKey: record.productKey,
    contentId: record.contentId,
    contentVersionId: record.contentVersionId,
    publicationGeneration: record.publicationGeneration,
    assignments,
    libraryProjections,
    notices,
    approvalEvidence: record.approval!.evidence,
  };
}

function assertBinding(
  binding: ContentPublicationCommandBinding,
  record: ContentPublicationRecord,
) {
  assertSafeId(binding.idempotencyKey, 'idempotencyKey');
  if (!/^[a-f0-9]{64}$/.test(binding.requestHash)) {
    throw failure('invalidInput', 'requestHash must be an exact SHA-256 digest.');
  }
  if (binding.expectedVersion !== record.version) {
    throw failure('conflict', 'Content version changed before this command.');
  }
  validInstant(binding.occurredAt);
}

function assertDigest(value: string, field: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw failure('invalidInput', `${field} must be an exact SHA-256 digest.`);
  }
}

function assertOpaqueReference(value: string) {
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /(?:https?|vimeo):/i.test(value)
  ) {
    throw failure('invalidInput', 'Provider asset reference must be opaque and non-routable.');
  }
  assertSafeId(value, 'opaqueProviderAssetRef');
}

function assertSafeId(value: string, field: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,179}$/.test(value)) {
    throw failure('invalidInput', `${field} is invalid.`);
  }
}

function normalizeSearch(value: string) {
  const normalized = value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  if (normalized.length > 160 || containsControlCharacter(normalized)) {
    throw failure('invalidInput', 'Library query is invalid.');
  }
  return normalized;
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function searchText(record: ContentPublicationRecord) {
  return [
    record.title,
    record.englishTranscriptText,
    record.occurredAt.slice(0, 10),
    record.classTopic,
    ...record.mishnahReferences,
  ]
    .join(' ')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

function validDate(value: Date) {
  if (!Number.isFinite(value.getTime())) throw failure('invalidInput', 'Time is invalid.');
  return value;
}

function validInstant(value: string) {
  const instant = validDate(new Date(value));
  return instant.toISOString();
}

function failure(code: keyof typeof CONTENT_PUBLICATION_ERROR_CODES, message: string) {
  return new ContentPublicationError(CONTENT_PUBLICATION_ERROR_CODES[code], message);
}
