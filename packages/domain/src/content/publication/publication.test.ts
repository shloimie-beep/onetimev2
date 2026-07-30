import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  ContentApprovalEvidence,
  ContentPublicationOutboxIntent,
  ContentPublicationPrincipal,
  ContentPublicationRecord,
  StudentContentAssignment,
  StudentPlaybackAuthorizationFacts,
  StudentPublicationEligibility,
  VimeoContentPublicationObservation,
} from '../../../../contracts/src/content/publication/index.ts';
import type { ProviderRegistryBinding } from '../../../../contracts/src/providers/v21-provider-core.ts';
import { ContentPublicationError } from './errors.ts';
import {
  approveContent,
  archiveContent,
  attachOccurrence,
  authorizeStudentPlayback,
  createContentPublicationProviderOperation,
  recordPrivatePublication,
  recordPrivateRevocation,
  requestPrivatePublication,
  saveStudentResume,
  searchStudentLibrary,
  unpublishContent,
} from './lifecycle.ts';

const hash = (digit: string) => digit.repeat(64);
const scope = {
  accountKey: 'account_one',
  productKey: 'one_time_mishnayos' as const,
};
const admin: ContentPublicationPrincipal = {
  actorId: 'admin_one',
  role: 'admin',
  ...scope,
  householdId: 'admin_scope',
  studentId: null,
  sessionId: null,
  sessionVersion: null,
  accessState: 'active',
};
const student: ContentPublicationPrincipal = {
  actorId: 'account_student_one',
  role: 'student',
  ...scope,
  householdId: 'household_one',
  studentId: 'student_one',
  sessionId: 'student_session_one',
  sessionVersion: 7,
  accessState: 'active',
};
const parent: ContentPublicationPrincipal = {
  actorId: 'parent_one',
  role: 'parent',
  ...scope,
  householdId: 'household_one',
  studentId: null,
  sessionId: 'parent_session_one',
  sessionVersion: 3,
  accessState: 'active',
};

describe('P21 publication lifecycle', () => {
  it('fails closed until immutable version, participant, redaction, and Admin evidence agree', () => {
    const draft = content();
    const attached = attachOccurrence({
      principal: admin,
      record: draft,
      relation: relation('occurrence_two', 2),
      canonicalOccurrence: canonicalOccurrence('occurrence_two', 2),
      binding: binding(4),
    });
    expect(attached.occurrenceRelations).toHaveLength(2);
    expect(
      attachOccurrence({
        principal: admin,
        record: attached,
        relation: relation('occurrence_two', 2),
        canonicalOccurrence: canonicalOccurrence('occurrence_two', 2),
        binding: binding(5),
      }),
    ).toBe(attached);
    expect(() =>
      attachOccurrence({
        principal: admin,
        record: attached,
        relation: relation('occurrence_two', 3),
        canonicalOccurrence: canonicalOccurrence('occurrence_two', 3),
        binding: binding(5),
      }),
    ).toThrow(/different governance/i);

    for (const invalid of [
      approvalEvidence({ accountKey: 'account_other' }),
      approvalEvidence({ productKey: 'one_time_mishnayos', contentVersionId: 'version_other' }),
      approvalEvidence({ participantSnapshotDigest: hash('f') }),
      approvalEvidence({ approvedByAdminId: 'admin_other' }),
      approvalEvidence({ artifacts: approvalEvidence().artifacts.slice(0, 6) }),
      approvalEvidence({
        artifacts: approvalEvidence().artifacts.map((artifact, index) =>
          index === 0 ? { ...artifact, payloadDigest: hash('f') } : artifact,
        ),
        projectionDigest: approvalEvidence().projectionDigest,
      }),
    ]) {
      expect(() =>
        approveContent({
          principal: admin,
          record: draft,
          approvalId: 'approval_one',
          policyVersion: 'content-publication-v1',
          evidence: invalid as ContentApprovalEvidence,
          binding: binding(4),
        }),
      ).toThrow(ContentPublicationError);
    }
    expect(
      approveContent({
        principal: admin,
        record: draft,
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v1',
        evidence: approvalEvidence(),
        binding: binding(4),
      }).approval,
    ).toMatchObject({
      approvedByAdminId: 'admin_one',
      evidence: {
        accountKey: 'account_one',
        productKey: 'one_time_mishnayos',
        contentVersionId: 'content_version_one',
        projectionDigest: approvalEvidence().projectionDigest,
      },
    });
  });

  it('publishes only from one fenced canonical readback and atomically plans assignments and notices', () => {
    const approved = approvedContent();
    const requested = requestPrivatePublication({
      principal: admin,
      record: approved,
      binding: binding(5, 'b'),
    });
    expect(requested.intent).toMatchObject({
      provider: 'vimeo',
      providerOperationId: requested.record.pendingProviderOperationId,
      contentVersionId: 'content_version_one',
      operation: 'publish_private',
    });
    const providerOperation = createContentPublicationProviderOperation({
      intent: requested.intent,
      binding: vimeoBinding(),
    });
    expect(providerOperation).toMatchObject({
      job_id: requested.intent.providerOperationId,
      operation_type: 'publish_private',
      aggregate_ref: 'content_one',
      source_version: 1,
      provider: 'vimeo',
      payload_ref: 'content_version_one',
      payload_digest: approvalEvidence().projectionDigest,
      state: 'not_started',
      effect_kind: 'mutation',
    });
    expect(() =>
      createContentPublicationProviderOperation({
        intent: requested.intent,
        binding: { ...vimeoBinding(), active: false },
      }),
    ).toThrow(ContentPublicationError);
    expect(() =>
      createContentPublicationProviderOperation({
        intent: requested.intent,
        binding: { ...vimeoBinding(), mutation_policy: 'prohibited' },
      }),
    ).toThrow(ContentPublicationError);
    const observation = providerObservation('publish_private');
    const pendingProviderContext = providerContext(requested.intent);
    const published = recordPrivatePublication({
      record: requested.record,
      observation,
      audience: [audience()],
      eligibility: [eligibility()],
      pendingProviderContext,
      binding: binding(6, 'c'),
    });
    expect(published.record).toMatchObject({
      state: 'published',
      opaqueProviderAssetRef: 'asset_private_01',
      providerReadbackDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      pendingProviderOperationId: null,
    });
    expect(published.providerCompletion).toMatchObject({
      providerOperationId: requested.intent.providerOperationId,
      expectedProviderOperationVersion: 3,
      outboxIntentId: requested.intent.intentId,
      canonicalRequestHash: hash('b'),
    });
    expect(published.materialization.assignments).toEqual([
      expect.objectContaining({
        contentVersionId: 'content_version_one',
        studentVersion: 5,
        enrollmentVersion: 6,
        accessVersion: 7,
        serviceAccountConsentVersion: 8,
        privacyVersion: 9,
        revocationVersion: 10,
      }),
    ]);
    expect(published.materialization.libraryProjections[0]?.internalRoute).toBe(
      '/app/student/library/content_one',
    );
    expect(published.materialization.notices).toEqual([
      expect.objectContaining({
        recipientKind: 'student',
        actionPath: '/app/student/library/content_one',
      }),
      expect.objectContaining({
        recipientKind: 'adult',
        actionLabel: 'Open household',
        actionPath: '/app/parent',
      }),
    ]);
    expect(JSON.stringify(published.materialization)).not.toMatch(/vimeo|asset_private|https?:/i);

    for (const invalid of [
      { ...observation, matchingCanonicalAssetCount: 2 },
      { ...observation, vimeoPrivacy: 'unlisted' },
      { ...observation, vimeoAvailability: 'processing' },
      { ...observation, providerResourceRefHash: hash('0') },
      { ...observation, observedAt: 'not-an-instant' },
      { ...observation, observedAt: '2026-07-29T10:43:59.999Z' },
      { ...observation, observedAt: '2026-07-29T10:44:00.001Z' },
    ]) {
      expect(() =>
        recordPrivatePublication({
          record: requested.record,
          observation: invalid as Extract<
            VimeoContentPublicationObservation,
            { operation: 'publish_private' }
          >,
          audience: [audience()],
          eligibility: [eligibility()],
          pendingProviderContext,
          binding: binding(6, 'c'),
        }),
      ).toThrow(ContentPublicationError);
    }
    expect(() =>
      recordPrivatePublication({
        record: requested.record,
        observation,
        audience: [audience()],
        eligibility: [eligibility()],
        pendingProviderContext: {
          ...pendingProviderContext,
          intent: { ...pendingProviderContext.intent, requestHash: hash('9') },
        },
        binding: binding(6, 'c'),
      }),
    ).toThrow(/incomplete or ambiguous/i);
    for (const ineligible of [
      eligibility({ studentActive: false }),
      eligibility({ enrollmentActive: false }),
      eligibility({ accessState: 'inactive' }),
      eligibility({ serviceAccountAccepted: false }),
      eligibility({ privacyReviewState: 'hold' }),
      eligibility({ contentRevoked: true }),
    ]) {
      expect(() =>
        recordPrivatePublication({
          record: requested.record,
          observation,
          audience: [audience()],
          eligibility: [ineligible],
          pendingProviderContext,
          binding: binding(6, 'c'),
        }),
      ).toThrow(/not currently eligible/i);
    }

    const unpublished = unpublishContent({
      principal: admin,
      record: published.record,
      binding: binding(7, 'd'),
    });
    expect(unpublished.record).toMatchObject({
      state: 'approved',
      playbackGrantGeneration: 2,
      publishedAt: null,
      archivedAt: null,
      pendingProviderOperationId: unpublished.intent.providerOperationId,
    });
    expect(unpublished.intent.operation).toBe('revoke_private');
    const revoked = recordPrivateRevocation({
      record: unpublished.record,
      observation: providerObservation('revoke_private'),
      pendingProviderContext: providerContext(unpublished.intent),
      binding: binding(8, 'e'),
    });
    expect(revoked).toMatchObject({
      record: {
        state: 'approved',
        pendingProviderOperationId: null,
        opaqueProviderAssetRef: null,
      },
      providerCompletion: { operation: 'revoke_private' },
    });
    const archived = archiveContent({
      principal: admin,
      record: revoked.record,
      binding: binding(9, 'f'),
    });
    expect(archived.record).toMatchObject({ state: 'archived', archivedAt: expect.any(String) });
  });

  it('binds a five-minute grant to exact current session, Student, assignment, and access facts', () => {
    const published = publishedContent();
    const exactAssignment = assignment();
    const exactFacts = facts();
    const grant = authorizeStudentPlayback({
      principal: student,
      record: published,
      assignment: exactAssignment,
      facts: exactFacts,
      now: new Date('2026-07-29T10:45:00.000Z'),
      playbackSessionId: 'playback_session_one',
    });
    expect(grant).toMatchObject({
      contentVersionId: 'content_version_one',
      playbackGrantGeneration: 1,
      studentId: 'student_one',
      studentVersion: 5,
      sessionId: 'student_session_one',
      sessionVersion: 7,
      assignmentVersion: 1,
      accessVersion: 7,
      expiresAt: '2026-07-29T10:50:00.000Z',
    });
    expect(JSON.stringify(grant)).not.toMatch(/vimeo|asset_private|https?:/i);
    for (const denial of [
      { principal: parent, assignment: exactAssignment, facts: exactFacts },
      {
        principal: student,
        assignment: { ...exactAssignment, assignmentVersion: 2 },
        facts: exactFacts,
      },
      {
        principal: { ...student, sessionVersion: 8 },
        assignment: exactAssignment,
        facts: exactFacts,
      },
      {
        principal: student,
        assignment: exactAssignment,
        facts: { ...exactFacts, enrollmentActive: false },
      },
      {
        principal: student,
        assignment: exactAssignment,
        facts: { ...exactFacts, serviceAccountAccepted: false },
      },
      {
        principal: student,
        assignment: exactAssignment,
        facts: { ...exactFacts, privacyReviewState: 'hold' as const },
      },
      {
        principal: student,
        assignment: exactAssignment,
        facts: { ...exactFacts, studentRevoked: true },
      },
    ]) {
      expect(() =>
        authorizeStudentPlayback({
          principal: denial.principal,
          record: published,
          assignment: denial.assignment,
          facts: denial.facts,
          now: new Date('2026-07-29T10:45:00.000Z'),
          playbackSessionId: 'playback_session_one',
        }),
      ).toThrow(ContentPublicationError);
    }
    // Recording-participation and member-recognition choices are deliberately not playback facts.
    expect(Object.keys(exactFacts)).not.toContain('recordingParticipationAccepted');
    expect(Object.keys(exactFacts)).not.toContain('memberRecognitionAccepted');
  });

  it('preserves authorized search and Student/version-isolated resume behavior', () => {
    const published = publishedContent();
    const saved = saveStudentResume({
      principal: student,
      record: published,
      assignment: assignment(),
      facts: facts(),
      existing: null,
      positionMs: 125_000,
      occurredAt: '2026-07-29T10:46:00.000Z',
    });
    for (const query of [
      'Berachos Review',
      'evening shema',
      '2026-07-27',
      'Berachos',
      'Berachos 1:1',
    ]) {
      expect(
        searchStudentLibrary({
          principal: student,
          query,
          published: [published],
          assignments: new Map([['content_one', assignment()]]),
          facts: new Map([['content_one', facts()]]),
          resumes: new Map([['content_one', saved]]),
        }),
      ).toEqual([
        expect.objectContaining({
          contentId: 'content_one',
          resumePositionMs: 125_000,
          internalRoute: '/app/student/library/content_one',
        }),
      ]);
    }
    expect(() =>
      saveStudentResume({
        principal: student,
        record: published,
        assignment: assignment(),
        facts: facts(),
        existing: { ...saved, studentId: 'student_sibling' },
        positionMs: 1,
        occurredAt: '2026-07-29T10:47:00.000Z',
      }),
    ).toThrow(/another Student scope/i);
  });
});

function content(overrides: Partial<ContentPublicationRecord> = {}): ContentPublicationRecord {
  return {
    ...scope,
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    contentVersionDigest: hash('1'),
    participantSetVersion: 'participant_set_v1',
    participantSnapshotSetDigest: hash('2'),
    participantReviewState: 'complete',
    unresolvedParticipantCount: 0,
    requiredRedactionCount: 2,
    completedRedactionCount: 2,
    redactionReviewDigest: hash('3'),
    version: 4,
    state: 'needs_review',
    title: 'Berachos Review',
    englishTranscriptText: 'The class discusses the first Mishnah and evening Shema.',
    classTopic: 'Berachos',
    mishnahReferences: ['Berachos 1:1'],
    occurredAt: '2026-07-27T16:00:00.000Z',
    updatedAt: '2026-07-27T16:00:00.000Z',
    durationMs: 3_600_000,
    approval: null,
    publicationGeneration: 0,
    playbackGrantGeneration: 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: null,
    providerReadbackDigest: null,
    publishedAt: null,
    archivedAt: null,
    occurrenceRelations: [
      {
        ...relation('occurrence_one', 1),
        governedByAdminId: 'admin_one',
        attachedAt: '2026-07-27T16:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function approvalEvidence(
  overrides: Partial<ContentApprovalEvidence> = {},
): ContentApprovalEvidence {
  const { projectionDigest: overriddenDigest, ...coreOverrides } = overrides;
  const core = {
    ...scope,
    contentVersionId: 'content_version_one',
    sourceId: 'source_one',
    sourceSha256: hash('1'),
    sourceObjectVersionId: 'source_object_version_one',
    participantSnapshotDigest: hash('2'),
    approvedByAdminId: 'admin_one',
    approvedAt: '2026-07-29T10:39:00.000Z',
    artifacts: [
      {
        artifactId: 'captions_one',
        kind: 'captions' as const,
        revision: 1,
        payloadDigest: hash('3'),
      },
      {
        artifactId: 'compressed_video_one',
        kind: 'compressed_video' as const,
        revision: 1,
        payloadDigest: hash('4'),
      },
      {
        artifactId: 'knowledge_artifact_one',
        kind: 'knowledge_artifact' as const,
        revision: 1,
        payloadDigest: hash('5'),
      },
      {
        artifactId: 'review_material_one',
        kind: 'review_material' as const,
        revision: 1,
        payloadDigest: hash('6'),
      },
      {
        artifactId: 'transcript_one',
        kind: 'transcript' as const,
        revision: 1,
        payloadDigest: hash('7'),
      },
      { artifactId: 'trim_one', kind: 'trim' as const, revision: 1, payloadDigest: hash('8') },
      {
        artifactId: 'worksheet_one',
        kind: 'worksheet' as const,
        revision: 1,
        payloadDigest: hash('9'),
      },
    ],
    approvedArtifactSetDigest: hash('a'),
    sourceEvidenceDigest: hash('b'),
    ...coreOverrides,
  };
  return {
    ...core,
    projectionDigest:
      overriddenDigest ?? createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };
}

function approvedContent() {
  return content({
    version: 5,
    state: 'approved',
    approval: {
      approvalId: 'approval_one',
      approvedByAdminId: 'admin_one',
      approvedAt: '2026-07-29T10:40:00.000Z',
      policyVersion: 'content-publication-v1',
      evidence: approvalEvidence(),
    },
  });
}

function publishedContent() {
  return content({
    version: 7,
    state: 'published',
    approval: approvedContent().approval,
    publicationGeneration: 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: 'asset_private_01',
    providerReadbackDigest: hash('e'),
    publishedAt: '2026-07-29T10:42:00.000Z',
  });
}

function relation(occurrenceId: string, occurrenceVersion: number) {
  return {
    ...scope,
    relationId: `relation_${occurrenceId}`,
    occurrenceId,
    occurrenceVersion,
    canonicalSeriesId: 'canonical_series_one',
    productKey: 'one_time_mishnayos' as const,
  };
}

function canonicalOccurrence(occurrenceId: string, occurrenceVersion: number) {
  return {
    ...scope,
    occurrenceId,
    occurrenceVersion,
    canonicalSeriesId: 'canonical_series_one',
    productKey: 'one_time_mishnayos' as const,
    governanceState: 'governed' as const,
    active: true as const,
  };
}

function binding(expectedVersion: number, digit = 'a') {
  return {
    idempotencyKey: `p21.operation.${expectedVersion}.${digit}`,
    requestHash: hash(digit),
    expectedVersion,
    occurredAt: '2026-07-29T10:44:00.000Z',
  };
}

function providerObservation(
  operation: 'publish_private',
): Extract<VimeoContentPublicationObservation, { operation: 'publish_private' }>;
function providerObservation(
  operation: 'revoke_private',
): Extract<VimeoContentPublicationObservation, { operation: 'revoke_private' }>;
function providerObservation(
  operation: 'publish_private' | 'revoke_private',
): VimeoContentPublicationObservation;
function providerObservation(
  operation: 'publish_private' | 'revoke_private',
): VimeoContentPublicationObservation {
  const providerResourceRefHash = createHash('sha256').update('asset_private_01').digest('hex');
  return operation === 'publish_private'
    ? {
        operation,
        observedAt: '2026-07-29T10:44:00.000Z',
        opaqueProviderAssetRef: 'asset_private_01',
        providerResourceRefHash,
        vimeoPrivacy: 'private',
        vimeoAvailability: 'available',
        matchingCanonicalAssetCount: 1,
        exactContentVersionCorrelation: true,
        providerAcceptanceDigest: hash('d'),
      }
    : {
        operation,
        observedAt: '2026-07-29T10:44:00.000Z',
        providerResourceRefHash,
        vimeoAvailability: 'revoked',
        matchingCanonicalAssetCount: 1,
        exactContentVersionCorrelation: true,
        providerAcceptanceDigest: hash('d'),
      };
}

function providerContext(intent: ContentPublicationOutboxIntent) {
  return {
    intent,
    providerOperation: {
      providerOperationId: intent.providerOperationId,
      providerOperationVersion: 3,
      provider: 'vimeo' as const,
      operation: intent.operation,
      ...scope,
      contentId: intent.contentId,
      contentVersionId: intent.contentVersionId,
      publicationGeneration: intent.publicationGeneration,
      idempotencyKey: intent.idempotencyKey,
      canonicalRequestHash: intent.requestHash,
      state: 'accepted' as const,
      unknownEffect: false as const,
      registryBindingKey: 'vimeo_publication_primary',
      providerAccountRefHash: hash('9'),
      providerAcceptanceDigest: hash('d'),
      providerReconciliationDigest: hash('c'),
      approvalProjectionDigest: approvalEvidence().projectionDigest,
    },
  };
}

function audience() {
  return {
    ...scope,
    studentId: 'student_one',
    householdId: 'household_one',
    adultRecipientId: 'adult_one',
    occurrenceId: 'occurrence_one',
    studentVersion: 5,
    enrollmentVersion: 6,
    accessVersion: 7,
    serviceAccountConsentVersion: 8,
    privacyVersion: 9,
    revocationVersion: 10,
  };
}

function eligibility(
  overrides: Partial<StudentPublicationEligibility> = {},
): StudentPublicationEligibility {
  return {
    ...audience(),
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    publicationGeneration: 1,
    studentActive: true,
    enrollmentActive: true,
    accessState: 'active',
    serviceAccountAccepted: true,
    privacyReviewState: 'clear',
    studentRevoked: false,
    accountRevoked: false,
    contentRevoked: false,
    adultRecipientActive: true,
    approvalProjectionDigest: approvalEvidence().projectionDigest,
    ...overrides,
  };
}

function assignment(): StudentContentAssignment {
  return {
    ...scope,
    assignmentId: 'assignment_one',
    assignmentVersion: 1,
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    publicationGeneration: 1,
    studentId: 'student_one',
    householdId: 'household_one',
    occurrenceId: 'occurrence_one',
    studentVersion: 5,
    enrollmentVersion: 6,
    accessVersion: 7,
    serviceAccountConsentVersion: 8,
    privacyVersion: 9,
    revocationVersion: 10,
    active: true,
    revokedAt: null,
    approvalEvidence: approvalEvidence(),
  };
}

function facts(): StudentPlaybackAuthorizationFacts {
  return {
    ...scope,
    assignmentId: 'assignment_one',
    assignmentVersion: 1,
    studentId: 'student_one',
    householdId: 'household_one',
    sessionId: 'student_session_one',
    sessionVersion: 7,
    sessionActive: true,
    studentVersion: 5,
    studentActive: true,
    enrollmentVersion: 6,
    enrollmentActive: true,
    accessVersion: 7,
    accessState: 'active',
    serviceAccountConsentVersion: 8,
    serviceAccountAccepted: true,
    privacyVersion: 9,
    revocationVersion: 10,
    studentRevoked: false,
    accountRevoked: false,
    contentRevoked: false,
    privacyReviewState: 'clear',
    approvalProjectionDigest: approvalEvidence().projectionDigest,
  };
}

function vimeoBinding(): ProviderRegistryBinding {
  return {
    registry_binding_key: 'vimeo_publication_primary',
    provider: 'vimeo',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    provider_account_ref_hash: hash('9'),
    allowed_operation_types: ['publish_private', 'revoke_private'],
    mutation_policy: 'allowed',
    active: true,
  };
}
