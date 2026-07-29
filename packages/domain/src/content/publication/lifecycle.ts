import { createHash } from 'node:crypto';
import {
  CONTENT_PLAYBACK_GRANT_TTL_MS,
  CONTENT_PUBLICATION_PRODUCT_KEY,
  type ContentApprovalEvidence,
  type ContentPublicationCommandBinding,
  type ContentPublicationMaterialization,
  type ContentPublicationOutboxIntent,
  type ContentPublicationPrincipal,
  type ContentPublicationReceipt,
  type ContentPublicationRecord,
  type GovernedContentOccurrenceRelation,
  type StudentContentAssignment,
  type StudentContentResume,
  type StudentLibraryItem,
  type StudentPlaybackGrant,
  type StudentPlaybackAuthorizationFacts,
  type StudentPublicationAudience,
  type VimeoProviderOperationReadback,
} from '../../../../contracts/src/content/publication/index.ts';
import { CONTENT_PUBLICATION_ERROR_CODES, ContentPublicationError } from './errors.ts';

export function approveContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  approvalId: string;
  policyVersion: string;
  evidence: ContentApprovalEvidence;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
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
      approvedByAdminId: input.principal.actorId,
      approvedAt: occurredAt,
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
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'approved' || !input.record.approval) {
    throw failure('invalidState', 'Admin approval is required before publication.');
  }
  const generation = input.record.publicationGeneration + 1;
  const occurredAt = validInstant(input.binding.occurredAt);
  const providerOperationId = stableKey('provider_operation', [
    'vimeo',
    'publish_private',
    input.record.contentId,
    input.record.contentVersionId,
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
        input.record.contentId,
        String(generation),
        input.binding.idempotencyKey,
      ]),
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
    },
  };
}

export function recordPrivatePublication(input: {
  record: ContentPublicationRecord;
  readback: VimeoProviderOperationReadback;
  audience: readonly StudentPublicationAudience[];
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; materialization: ContentPublicationMaterialization } {
  assertBinding(input.binding, input.record);
  assertPublicationReadback(input.record, input.readback);
  const occurredAt = validInstant(input.binding.occurredAt);
  const record = {
    ...input.record,
    version: input.record.version + 1,
    state: 'published' as const,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: input.readback.opaqueProviderAssetRef,
    providerReadbackDigest: input.readback.providerReadbackDigest,
    publishedAt: occurredAt,
    archivedAt: null,
    updatedAt: occurredAt,
  };
  return {
    record,
    materialization: materializePublication(record, input.audience, occurredAt),
  };
}

export function unpublishContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'published' || !input.record.opaqueProviderAssetRef) {
    throw failure('invalidState', 'Only currently published content can be unpublished.');
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      state: 'approved',
      playbackGrantGeneration: input.record.playbackGrantGeneration + 1,
      publishedAt: null,
      archivedAt: null,
      updatedAt: occurredAt,
    },
    intent: {
      intentId: stableKey('revoke', [
        input.record.contentId,
        String(input.record.publicationGeneration),
        input.binding.idempotencyKey,
      ]),
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      providerOperationId: stableKey('provider_operation', [
        'vimeo',
        'revoke_private',
        input.record.contentId,
        input.record.contentVersionId,
        String(input.record.publicationGeneration),
      ]),
      provider: 'vimeo',
      operation: 'revoke_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
    },
  };
}

export function archiveContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent?: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state === 'archived' || input.record.state === 'publishing') {
    throw failure('invalidState', 'Content cannot be archived from its current state.');
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  const record = {
    ...input.record,
    version: input.record.version + 1,
    state: 'archived' as const,
    playbackGrantGeneration: input.record.playbackGrantGeneration + 1,
    publishedAt: null,
    archivedAt: occurredAt,
    updatedAt: occurredAt,
  };
  if (!input.record.opaqueProviderAssetRef || input.record.state !== 'published') return { record };
  return {
    record,
    intent: {
      intentId: stableKey('archive-revoke', [
        input.record.contentId,
        String(input.record.publicationGeneration),
        input.binding.idempotencyKey,
      ]),
      providerOperationId: stableKey('provider_operation', [
        'vimeo',
        'archive_revoke_private',
        input.record.contentId,
        input.record.contentVersionId,
        String(input.record.publicationGeneration),
      ]),
      provider: 'vimeo',
      contentId: input.record.contentId,
      contentVersionId: input.record.contentVersionId,
      publicationGeneration: input.record.publicationGeneration,
      operation: 'revoke_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
    },
  };
}

export function attachOccurrence(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  relation: Omit<GovernedContentOccurrenceRelation, 'governedByAdminId' | 'attachedAt'>;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  assertOccurrenceRelation(input.principal, input.relation);
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
      input.existing.householdId !== input.principal.householdId ||
      input.existing.contentId !== input.record.contentId)
  ) {
    throw failure('accessDenied', 'Resume state belongs to another Student scope.');
  }
  return {
    studentId,
    householdId: input.principal.householdId,
    contentId: input.record.contentId,
    publicationVersion: input.record.version,
    positionMs: input.positionMs,
    updatedAt: validInstant(input.occurredAt),
    version: (input.existing?.version ?? 0) + 1,
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
          resume.householdId === input.principal.householdId &&
          resume.publicationVersion === record.version
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
  contentId: string,
) {
  if (
    receipt.operation !== operation ||
    receipt.requestHash !== requestHash ||
    receipt.contentId !== contentId
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
    !['active', 'grace'].includes(principal.accessState) ||
    record.state !== 'published' ||
    !record.opaqueProviderAssetRef ||
    !record.providerReadbackDigest ||
    !assignment ||
    !assignment.active ||
    assignment.revokedAt !== null ||
    assignment.contentId !== record.contentId ||
    assignment.contentVersionId !== record.contentVersionId ||
    assignment.publicationGeneration !== record.publicationGeneration ||
    assignment.studentId !== principal.studentId ||
    assignment.householdId !== principal.householdId ||
    !record.occurrenceRelations.some(
      (relation) =>
        relation.occurrenceId === assignment.occurrenceId &&
        relation.productKey === CONTENT_PUBLICATION_PRODUCT_KEY,
    ) ||
    !facts ||
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

function assertAdmin(principal: ContentPublicationPrincipal) {
  if (
    principal.role !== 'admin' ||
    principal.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    principal.accessState !== 'active'
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
  if (
    evidence.contentVersionId !== record.contentVersionId ||
    evidence.contentVersionDigest !== record.contentVersionDigest ||
    evidence.participantSetVersion !== record.participantSetVersion ||
    evidence.participantSnapshotSetDigest !== record.participantSnapshotSetDigest ||
    evidence.participantReviewState !== record.participantReviewState ||
    evidence.unresolvedParticipantCount !== record.unresolvedParticipantCount ||
    evidence.requiredRedactionCount !== record.requiredRedactionCount ||
    evidence.completedRedactionCount !== record.completedRedactionCount ||
    evidence.redactionReviewDigest !== record.redactionReviewDigest ||
    record.participantReviewState !== 'complete' ||
    record.unresolvedParticipantCount !== 0 ||
    evidence.participantReviewState !== 'complete' ||
    evidence.unresolvedParticipantCount !== 0 ||
    !Number.isSafeInteger(evidence.requiredRedactionCount) ||
    evidence.requiredRedactionCount < 0 ||
    evidence.completedRedactionCount !== evidence.requiredRedactionCount ||
    record.completedRedactionCount !== record.requiredRedactionCount ||
    evidence.adminAttestation.attestedByAdminId !== principal.actorId ||
    evidence.adminAttestation.inspectedMediaAndMemberVisibleArtifacts !== true ||
    evidence.adminAttestation.requiredRedactionsComplete !== true ||
    validInstant(evidence.adminAttestation.attestedAt) > approvalInstant
  ) {
    throw failure(
      'invalidState',
      'Immutable participant, redaction, and Admin evidence is incomplete.',
    );
  }
  for (const [value, field] of [
    [evidence.contentVersionDigest, 'contentVersionDigest'],
    [evidence.participantSnapshotSetDigest, 'participantSnapshotSetDigest'],
    [evidence.redactionReviewDigest, 'redactionReviewDigest'],
  ] as const) {
    assertDigest(value, field);
  }
  assertSafeId(evidence.participantSetVersion, 'participantSetVersion');
  assertSafeId(evidence.adminAttestation.attestationId, 'attestationId');
}

function assertOccurrenceRelation(
  principal: ContentPublicationPrincipal,
  relation: Omit<GovernedContentOccurrenceRelation, 'governedByAdminId' | 'attachedAt'>,
) {
  assertSafeId(relation.relationId, 'relationId');
  assertSafeId(relation.occurrenceId, 'occurrenceId');
  assertSafeId(relation.canonicalSeriesId, 'canonicalSeriesId');
  if (
    relation.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    relation.productKey !== principal.productKey ||
    !Number.isSafeInteger(relation.occurrenceVersion) ||
    relation.occurrenceVersion < 1
  ) {
    throw failure('invalidInput', 'Occurrence relation is not governed for this product.');
  }
}

function assertPublicationReadback(
  record: ContentPublicationRecord,
  readback: VimeoProviderOperationReadback,
) {
  if (
    record.state !== 'publishing' ||
    !record.approval ||
    !record.pendingProviderOperationId ||
    readback.providerOperationId !== record.pendingProviderOperationId ||
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
    readback.oneTimePublicationReadback !== 'applied'
  ) {
    throw failure(
      'conflict',
      'Canonical Vimeo and One Time publication readback is incomplete or ambiguous.',
    );
  }
  assertSafeId(readback.fence.workerId, 'workerId');
  if (
    !Number.isSafeInteger(readback.fence.leaseGeneration) ||
    readback.fence.leaseGeneration < 1 ||
    Date.parse(validInstant(readback.fence.leaseExpiresAt)) <=
      Date.parse(validInstant(readback.fence.observedAt))
  ) {
    throw failure('conflict', 'ProviderOperation fence is stale.');
  }
  assertOpaqueReference(readback.opaqueProviderAssetRef);
  assertDigest(readback.providerAcceptanceDigest, 'providerAcceptanceDigest');
  assertDigest(readback.providerReadbackDigest, 'providerReadbackDigest');
  assertDigest(readback.oneTimeReadbackDigest, 'oneTimeReadbackDigest');
}

function materializePublication(
  record: ContentPublicationRecord,
  audience: readonly StudentPublicationAudience[],
  createdAt: string,
): ContentPublicationMaterialization {
  const seenStudents = new Set<string>();
  const assignments = audience.map((member) => {
    assertSafeId(member.studentId, 'studentId');
    assertSafeId(member.householdId, 'householdId');
    assertSafeId(member.adultRecipientId, 'adultRecipientId');
    assertSafeId(member.occurrenceId, 'occurrenceId');
    if (
      seenStudents.has(member.studentId) ||
      !record.occurrenceRelations.some((relation) => relation.occurrenceId === member.occurrenceId)
    ) {
      throw failure(
        'conflict',
        'Publication audience is duplicated or outside the governed occurrence.',
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
      assignmentId: stableKey('assignment', [
        record.contentVersionId,
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
    } satisfies StudentContentAssignment;
  });
  const libraryProjections = assignments.map((assignment) => ({
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
  }));
  const notices = audience.flatMap((member, index) => {
    const assignment = assignments[index]!;
    const actionPath = `/app/student/library/${encodeURIComponent(record.contentId)}`;
    const base = {
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
    contentId: record.contentId,
    contentVersionId: record.contentVersionId,
    publicationGeneration: record.publicationGeneration,
    assignments,
    libraryProjections,
    notices,
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
