import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  ContentApprovalEvidence,
  ContentPublicationMaterialization,
  ContentPublicationOutboxIntent,
  ContentPublicationProviderCompletion,
  ContentPublicationProviderOperation,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRecord,
  ContentPublicationRepository,
  ContentPublicationScope,
  ContentPublicationUnitOfWork,
  CanonicalGovernedOccurrence,
  StudentContentAssignment,
  StudentContentResume,
  StudentPlaybackAuthorizationFacts,
  StudentPublicationEligibility,
  VimeoContentPublicationObservation,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import { ContentPublicationError } from '../../../../../../../packages/domain/src/content/publication/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { createContentPublicationService, publicationRequestHash } from './service.ts';

const hash = (digit: string) => digit.repeat(64);
const scope = {
  accountKey: 'account_one',
  productKey: 'one_time_mishnayos' as const,
};
const vimeoProviderBinding: ProviderRegistryBinding = {
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
const admin: ContentPublicationPrincipal = {
  actorId: 'admin_one',
  role: 'admin',
  ...scope,
  householdId: 'admin_scope',
  studentId: null,
  sessionId: 'admin_session_one',
  sessionVersion: 1,
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
  sessionVersion: 2,
  accessState: 'active',
};

describe('P21 content publication service', () => {
  it('hashes semantic request objects canonically', () => {
    expect(publicationRequestHash({ contentId: 'content_one', positionMs: 125_000 })).toBe(
      publicationRequestHash({ positionMs: 125_000, contentId: 'content_one' }),
    );
    expect(publicationRequestHash({ positionMs: 125_001, contentId: 'content_one' })).not.toBe(
      publicationRequestHash({ positionMs: 125_000, contentId: 'content_one' }),
    );
  });

  it('attaches only an exact repository-backed governed occurrence and replays idempotently', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', draft());
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:occurrence_two',
      canonicalOccurrence('occurrence_two', 2),
    );
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });
    const input = {
      principal: admin,
      contentId: 'content_one',
      relation: {
        relationId: 'relation_occurrence_two',
        occurrenceId: 'occurrence_two',
        occurrenceVersion: 2,
        canonicalSeriesId: 'canonical_series_one',
      },
      binding: command(1, 'attach.occurrence.key', '7'),
    };

    await expect(service.attachOccurrence(input)).resolves.toMatchObject({
      replay: false,
      record: {
        version: 2,
        occurrenceRelations: expect.arrayContaining([expect.objectContaining(input.relation)]),
      },
    });
    await expect(service.attachOccurrence(input)).resolves.toMatchObject({
      replay: true,
      record: { version: 2 },
    });
    await expect(
      service.attachOccurrence({
        ...input,
        relation: {
          ...input.relation,
          relationId: 'relation_invented',
          occurrenceId: 'occurrence_invented',
        },
        binding: command(2, 'attach.invented.key', '8'),
      }),
    ).rejects.toThrowError(/governed occurrence is unavailable/i);
  });

  it('atomically applies a fenced worker readback and materializes protected Student access', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', draft());
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });

    const approved = await service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'approval.key', 'a'),
    });
    expect(approved).toMatchObject({ replay: false, record: { state: 'approved', version: 2 } });
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'approval.key', 'a'),
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'approved', version: 2 } });
    const approvalReceiptKey = 'approve:approval.key';
    const exactApprovalReceipt = memory.receipts.get(approvalReceiptKey)!;
    expect(exactApprovalReceipt).toMatchObject({
      contentVersionId: 'content_version_one',
      publicationGeneration: 0,
      approvalProjectionDigest: approvalEvidence().projectionDigest,
    });
    for (const mismatch of [
      { contentVersionId: 'content_version_other' },
      { publicationGeneration: 1 },
      { approvalProjectionDigest: hash('9') },
    ]) {
      memory.receipts.set(approvalReceiptKey, { ...exactApprovalReceipt, ...mismatch });
      await expect(
        service.approve({
          principal: admin,
          contentId: 'content_one',
          approvalId: 'approval_one',
          policyVersion: 'content-publication-v2',
          binding: command(1, 'approval.key', 'a'),
        }),
      ).rejects.toThrowError(/different request/i);
    }
    memory.receipts.set(approvalReceiptKey, exactApprovalReceipt);
    memory.approvedProjection = approvalEvidence({ sourceEvidenceDigest: hash('c') });
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'approval.key', 'a'),
      }),
    ).rejects.toThrowError(/different request/i);
    memory.approvedProjection = approvalEvidence();

    await service.requestPublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(2, 'publish.key', 'b'),
    });
    const publishing = memory.records.get('content_one')!;
    memory.acceptProviderOperation(publishing.pendingProviderOperationId!);
    memory.eligibilities.set('student_one:content_one:occurrence_one', eligibility());
    expect(memory.intents).toEqual([
      expect.objectContaining({
        accountKey: scope.accountKey,
        productKey: scope.productKey,
        provider: 'vimeo',
        providerOperationId: publishing.pendingProviderOperationId,
        contentVersionId: 'content_version_one',
        operation: 'publish_private',
        approvalEvidence: expect.objectContaining({
          projectionDigest: approvalEvidence().projectionDigest,
        }),
      }),
    ]);
    expect(memory.intents[0]?.requestHash).not.toBe(hash('b'));

    const completion = command(3, 'publish.complete.key', 'c');
    const result = await service.applyPrivatePublicationReadback({
      scope,
      contentId: 'content_one',
      providerOperationId: publishing.pendingProviderOperationId!,
      audience: [audience()],
      binding: completion,
    });
    expect(result).toMatchObject({ replay: false, record: { state: 'published', version: 4 } });
    expect(memory.intentStates.get(memory.intents[0]!.intentId)).toBe('complete');
    expect(memory.completedProviderOperations).toContain(publishing.pendingProviderOperationId);
    expect(memory.materializations).toHaveLength(1);
    expect(memory.materializations[0]).toMatchObject({
      accountKey: scope.accountKey,
      productKey: scope.productKey,
      contentVersionId: 'content_version_one',
      publicationGeneration: 1,
      assignments: [
        expect.objectContaining({
          assignmentVersion: 1,
          contentVersionId: 'content_version_one',
          studentVersion: 5,
          enrollmentVersion: 6,
          accessVersion: 7,
          serviceAccountConsentVersion: 8,
          privacyVersion: 9,
          revocationVersion: 10,
          approvalEvidence: expect.objectContaining({
            projectionDigest: approvalEvidence().projectionDigest,
          }),
        }),
      ],
      libraryProjections: [
        expect.objectContaining({
          internalRoute: '/app/student/library/content_one',
          active: true,
        }),
      ],
      notices: [
        expect.objectContaining({
          recipientKind: 'student',
          actionLabel: 'Watch recording',
          actionPath: '/app/student/library/content_one',
        }),
        expect.objectContaining({
          recipientKind: 'adult',
          actionLabel: 'Open household',
          actionPath: '/app/parent',
        }),
      ],
    });
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience()],
        binding: completion,
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'published', version: 4 } });
    expect(memory.materializations).toHaveLength(1);
    expect(memory.readbackCalls).toEqual([publishing.pendingProviderOperationId]);

    const grant = await service.playback({
      principal: student,
      contentId: 'content_one',
      now: new Date('2026-07-29T10:45:00.000Z'),
    });
    expect(grant).toMatchObject({
      contentVersionId: 'content_version_one',
      publicationGeneration: 1,
      playbackGrantGeneration: 1,
      sessionId: 'student_session_one',
      sessionVersion: 7,
      assignmentVersion: 1,
      accessVersion: 7,
      enrollmentVersion: 6,
      serviceAccountConsentVersion: 8,
      privacyVersion: 9,
      revocationVersion: 10,
      approvalProjectionDigest: approvalEvidence().projectionDigest,
      expiresAt: '2026-07-29T10:50:00.000Z',
    });
    expect(JSON.stringify(grant)).not.toMatch(/vimeo|asset_private|https?:/i);
    await expect(
      service.playback({
        principal: parent,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:45:00.000Z'),
      }),
    ).rejects.toThrowError(ContentPublicationError);

    await service.saveResume({
      principal: student,
      contentId: 'content_one',
      positionMs: 125_000,
      binding: command(4, 'resume.key', 'd'),
    });
    expect(memory.resumes.get('student_one:content_one')).toMatchObject({
      ...scope,
      approvalProjectionDigest: approvalEvidence().projectionDigest,
    });
    await expect(service.library({ principal: student, query: 'Berachos 1:1' })).resolves.toEqual([
      expect.objectContaining({ contentId: 'content_one', resumePositionMs: 125_000 }),
    ]);

    await service.unpublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(4, 'unpublish.key', 'e'),
    });
    expect(memory.records.get('content_one')).toMatchObject({
      state: 'approved',
      version: 5,
      playbackGrantGeneration: 2,
      archivedAt: null,
      pendingProviderOperationId: expect.any(String),
    });
    await expect(
      service.playback({
        principal: student,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:50:00.000Z'),
      }),
    ).rejects.toThrowError(/unavailable/i);

    const revoking = memory.records.get('content_one')!;
    memory.acceptProviderOperation(revoking.pendingProviderOperationId!);
    await service.applyPrivateRevocationReadback({
      scope,
      contentId: 'content_one',
      providerOperationId: revoking.pendingProviderOperationId!,
      binding: command(5, 'revoke.complete.key', 'f'),
    });
    expect(memory.records.get('content_one')).toMatchObject({
      state: 'approved',
      version: 6,
      pendingProviderOperationId: null,
      opaqueProviderAssetRef: null,
    });
    expect(memory.intentStates.get(memory.intents[1]!.intentId)).toBe('complete');
    expect(memory.readbackCalls).toEqual([
      publishing.pendingProviderOperationId,
      revoking.pendingProviderOperationId,
    ]);

    await service.archive({
      principal: admin,
      contentId: 'content_one',
      binding: command(6, 'archive.key', '7'),
    });
    expect(memory.records.get('content_one')).toMatchObject({
      state: 'archived',
      version: 7,
      playbackGrantGeneration: 3,
    });
    expect(memory.intents.map((intent) => intent.operation)).toEqual([
      'publish_private',
      'revoke_private',
    ]);
  });

  it('fails closed for stale approval evidence, ambiguous readback, and assignment versions', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', draft());
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });

    memory.approvedProjection = null;
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'missing.approval.key', '8'),
      }),
    ).rejects.toThrowError(/approved processing evidence is unavailable/i);
    memory.approvedProjection = approvalEvidence({
      participantSnapshotDigest: hash('9'),
    });
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'bad.approval.key', '9'),
      }),
    ).rejects.toThrowError(ContentPublicationError);
    memory.approvedProjection = approvalEvidence();
    await expect(
      service.approve({
        principal: { ...admin, accountKey: 'account_other' },
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'cross.scope.key', '7'),
      }),
    ).rejects.toThrowError(/unavailable/i);
    await service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'approval.key', 'a'),
    });
    await service.requestPublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(2, 'publish.key', 'b'),
    });
    const publishing = memory.records.get('content_one')!;
    memory.acceptProviderOperation(publishing.pendingProviderOperationId!);
    memory.eligibilities.set('student_one:content_one:occurrence_one', eligibility());
    const completion = command(3, 'publish.complete.key', 'c');
    memory.readbackMutation = (observation) => ({
      ...observation,
      providerResourceRefHash: hash('0'),
    });
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience()],
        binding: completion,
      }),
    ).rejects.toThrowError(/does not match the provider/i);
    memory.readbackMutation = null;
    memory.failProviderCompletion = true;
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience()],
        binding: completion,
      }),
    ).rejects.toThrowError(/forced_provider_completion_failure/i);
    memory.failProviderCompletion = false;
    expect(memory.records.get('content_one')).toMatchObject({ state: 'publishing', version: 3 });
    expect(memory.materializations).toHaveLength(0);
    expect(memory.intentStates.get(memory.intents[0]!.intentId)).toBe('pending');
    memory.readbackMutation = (observation) =>
      ({
        ...observation,
        matchingCanonicalAssetCount: 2,
      }) as unknown as VimeoContentPublicationObservation;
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience()],
        binding: completion,
      }),
    ).rejects.toThrowError(/incomplete or ambiguous/i);
    memory.readbackMutation = null;
    expect(memory.records.get('content_one')).toMatchObject({ state: 'publishing', version: 3 });
    expect(memory.materializations).toHaveLength(0);

    const providerContext = memory.providerContexts.get(publishing.pendingProviderOperationId!)!;
    memory.providerContexts.delete(publishing.pendingProviderOperationId!);
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience()],
        binding: completion,
      }),
    ).rejects.toThrowError(/pending publication operation is unavailable/i);
    memory.providerContexts.set(publishing.pendingProviderOperationId!, providerContext);

    for (const ineligible of [
      eligibility({ studentActive: false }),
      eligibility({ contentRevoked: true }),
    ]) {
      memory.eligibilities.set('student_one:content_one:occurrence_one', ineligible);
      await expect(
        service.applyPrivatePublicationReadback({
          scope,
          contentId: 'content_one',
          providerOperationId: publishing.pendingProviderOperationId!,
          audience: [audience()],
          binding: completion,
        }),
      ).rejects.toThrowError(/not currently eligible/i);
    }
    expect(memory.materializations).toHaveLength(0);
    expect(memory.intentStates.get(memory.intents[0]!.intentId)).toBe('pending');
    memory.eligibilities.set('student_one:content_one:occurrence_one', eligibility());

    await expect(
      service.attachOccurrence({
        principal: admin,
        contentId: 'content_one',
        relation: {
          relationId: 'relation_invented',
          occurrenceId: 'occurrence_invented',
          occurrenceVersion: 1,
          canonicalSeriesId: 'canonical_series_one',
        },
        binding: command(3, 'attach.invented.key', '8'),
      }),
    ).rejects.toThrowError(/governed occurrence is unavailable/i);

    await service.applyPrivatePublicationReadback({
      scope,
      contentId: 'content_one',
      providerOperationId: publishing.pendingProviderOperationId!,
      audience: [audience()],
      binding: completion,
    });
    memory.eligibilities.set('student_one:content_one:occurrence_one', {
      ...eligibility(),
      enrollmentVersion: 99,
    });
    await expect(
      service.playback({
        principal: student,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:45:00.000Z'),
      }),
    ).rejects.toThrowError(/unavailable/i);
  });
});

function command(expectedVersion: number, idempotencyKey: string, digit: string) {
  return {
    expectedVersion,
    idempotencyKey,
    requestHash: hash(digit),
    occurredAt: '2026-07-29T10:44:00.000Z',
  };
}

function draft(): ContentPublicationRecord {
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
    version: 1,
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
        ...scope,
        relationId: 'relation_occurrence_one',
        occurrenceId: 'occurrence_one',
        occurrenceVersion: 1,
        canonicalSeriesId: 'canonical_series_one',
        productKey: 'one_time_mishnayos',
        governedByAdminId: 'admin_one',
        attachedAt: '2026-07-27T16:00:00.000Z',
      },
    ],
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

function audience() {
  return {
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
    ...scope,
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

function canonicalOccurrence(
  occurrenceId: string,
  occurrenceVersion: number,
): CanonicalGovernedOccurrence {
  return {
    ...scope,
    occurrenceId,
    occurrenceVersion,
    canonicalSeriesId: 'canonical_series_one',
    productKey: 'one_time_mishnayos',
    governanceState: 'governed',
    active: true,
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

class MemoryPublicationRepository
  implements
    ContentPublicationRepository,
    ContentPublicationUnitOfWork,
    VimeoContentPublicationReadbackAdapter
{
  approvedProjection: ContentApprovalEvidence | null = approvalEvidence();
  failProviderCompletion = false;
  readonly records = new Map<string, ContentPublicationRecord>();
  readonly assignments = new Map<string, StudentContentAssignment>();
  readonly playbackFacts = new Map<string, StudentPlaybackAuthorizationFacts>();
  readonly materializations: ContentPublicationMaterialization[] = [];
  readonly resumes = new Map<string, StudentContentResume>();
  readonly receipts = new Map<string, ContentPublicationReceipt>();
  readonly providerOperations = new Map<string, ProviderOperation>();
  readonly intents: ContentPublicationOutboxIntent[] = [];
  readonly intentStates = new Map<string, 'pending' | 'complete'>();
  readonly providerContexts = new Map<
    string,
    {
      intent: ContentPublicationOutboxIntent;
      providerOperation: ContentPublicationProviderOperation;
    }
  >();
  readonly completedProviderOperations = new Set<string>();
  readonly canonicalOccurrences = new Map<string, CanonicalGovernedOccurrence>();
  readonly eligibilities = new Map<string, StudentPublicationEligibility>();
  readonly readbackCalls: string[] = [];
  readbackMutation:
    | ((observation: VimeoContentPublicationObservation) => VimeoContentPublicationObservation)
    | null = null;

  async readCanonical(
    context: Parameters<VimeoContentPublicationReadbackAdapter['readCanonical']>[0],
  ) {
    this.readbackCalls.push(context.providerOperation.providerOperationId);
    const observation = providerObservation(context.intent.operation);
    return this.readbackMutation?.(observation) ?? observation;
  }

  async inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>) {
    const snapshot = {
      records: new Map(this.records),
      assignments: new Map(this.assignments),
      playbackFacts: new Map(this.playbackFacts),
      materializations: [...this.materializations],
      resumes: new Map(this.resumes),
      receipts: new Map(this.receipts),
      providerOperations: new Map(this.providerOperations),
      intents: [...this.intents],
      intentStates: new Map(this.intentStates),
      providerContexts: new Map(this.providerContexts),
      completedProviderOperations: new Set(this.completedProviderOperations),
    };
    try {
      return await work(this);
    } catch (error) {
      restoreMap(this.records, snapshot.records);
      restoreMap(this.assignments, snapshot.assignments);
      restoreMap(this.playbackFacts, snapshot.playbackFacts);
      this.materializations.splice(0, this.materializations.length, ...snapshot.materializations);
      restoreMap(this.resumes, snapshot.resumes);
      restoreMap(this.receipts, snapshot.receipts);
      restoreMap(this.providerOperations, snapshot.providerOperations);
      this.intents.splice(0, this.intents.length, ...snapshot.intents);
      restoreMap(this.intentStates, snapshot.intentStates);
      restoreMap(this.providerContexts, snapshot.providerContexts);
      this.completedProviderOperations.clear();
      for (const id of snapshot.completedProviderOperations) {
        this.completedProviderOperations.add(id);
      }
      throw error;
    }
  }

  async getApprovedForPublicationProjection(
    params: ContentPublicationScope & {
      contentVersionId: string;
    },
  ) {
    const projection = this.approvedProjection;
    return projection &&
      projection.accountKey === params.accountKey &&
      projection.productKey === params.productKey &&
      projection.contentVersionId === params.contentVersionId
      ? projection
      : null;
  }

  async getContent(requestScope: ContentPublicationScope, contentId: string) {
    const record = this.records.get(contentId) ?? null;
    return record && matchesScope(record, requestScope) ? record : null;
  }

  async saveContent(record: ContentPublicationRecord, expectedVersion: number) {
    if (this.records.get(record.contentId)?.version !== expectedVersion) {
      throw new Error('optimistic_conflict');
    }
    this.records.set(record.contentId, record);
  }

  async findReceipt(
    requestScope: ContentPublicationScope,
    operation: ContentPublicationReceipt['operation'],
    idempotencyKey: string,
  ) {
    const found = this.receipts.get(`${operation}:${idempotencyKey}`) ?? null;
    return found && matchesScope(found, requestScope) ? found : null;
  }

  async saveReceipt(receipt: ContentPublicationReceipt) {
    this.receipts.set(`${receipt.operation}:${receipt.idempotencyKey}`, receipt);
  }

  async saveProviderOperation(operation: ProviderOperation) {
    const prior = this.providerOperations.get(operation.job_id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(operation)) {
      throw new Error('provider_operation_conflict');
    }
    this.providerOperations.set(operation.job_id, operation);
  }

  async saveOutboxIntent(intent: ContentPublicationOutboxIntent) {
    this.intents.push(intent);
    this.intentStates.set(intent.intentId, 'pending');
  }

  acceptProviderOperation(providerOperationId: string) {
    const operation = this.providerOperations.get(providerOperationId);
    const intent = this.intents.find(
      (candidate) => candidate.providerOperationId === providerOperationId,
    );
    if (!operation || !intent) {
      throw new Error('provider_operation_not_pending');
    }
    this.providerOperations.set(providerOperationId, {
      ...operation,
      state: 'accepted',
      version: 3,
      provider_acceptance_digest: hash('d'),
      reconciliation_digest: hash('c'),
    });
    this.providerContexts.set(providerOperationId, {
      intent,
      providerOperation: {
        accountKey: intent.accountKey,
        providerOperationId,
        providerOperationVersion: 3,
        provider: 'vimeo',
        operation: intent.operation,
        productKey: 'one_time_mishnayos',
        contentId: intent.contentId,
        contentVersionId: intent.contentVersionId,
        publicationGeneration: intent.publicationGeneration,
        idempotencyKey: intent.idempotencyKey,
        canonicalRequestHash: intent.requestHash,
        state: 'accepted',
        unknownEffect: false,
        registryBindingKey: operation.registry_binding_key,
        providerAccountRefHash: operation.provider_account_ref_hash,
        providerAcceptanceDigest: hash('d'),
        providerReconciliationDigest: hash('c'),
        approvalProjectionDigest: intent.approvalEvidence.projectionDigest,
      },
    });
  }

  async getPendingProviderContext(
    requestScope: ContentPublicationScope,
    providerOperationId: string,
    operation: 'publish_private' | 'revoke_private',
  ) {
    const context = this.providerContexts.get(providerOperationId);
    return context &&
      matchesScope(context.intent, requestScope) &&
      context.intent.operation === operation &&
      this.intentStates.get(context.intent.intentId) === 'pending'
      ? context
      : null;
  }

  async completeProviderOperation(completion: ContentPublicationProviderCompletion) {
    if (this.failProviderCompletion) throw new Error('forced_provider_completion_failure');
    const context = this.providerContexts.get(completion.providerOperationId);
    if (
      !context ||
      this.intentStates.get(context.intent.intentId) !== 'pending' ||
      context.intent.intentId !== completion.outboxIntentId ||
      context.intent.operation !== completion.operation ||
      !matchesScope(context.intent, completion) ||
      context.intent.contentId !== completion.contentId ||
      context.intent.contentVersionId !== completion.contentVersionId ||
      context.intent.publicationGeneration !== completion.publicationGeneration ||
      context.providerOperation.providerOperationVersion !==
        completion.expectedProviderOperationVersion ||
      context.providerOperation.canonicalRequestHash !== completion.canonicalRequestHash ||
      context.providerOperation.providerAcceptanceDigest !== completion.providerAcceptanceDigest ||
      context.providerOperation.providerReconciliationDigest !==
        completion.providerReconciliationDigest ||
      context.providerOperation.registryBindingKey !== completion.registryBindingKey ||
      context.providerOperation.providerAccountRefHash !== completion.providerAccountRefHash ||
      context.providerOperation.approvalProjectionDigest !== completion.approvalProjectionDigest
    ) {
      throw new Error('provider_completion_conflict');
    }
    this.completedProviderOperations.add(completion.providerOperationId);
    this.intentStates.set(completion.outboxIntentId, 'complete');
  }

  async getCanonicalGovernedOccurrence(
    requestScope: ContentPublicationScope,
    occurrenceId: string,
  ) {
    const occurrence = this.canonicalOccurrences.get(`${requestScope.productKey}:${occurrenceId}`);
    return occurrence && matchesScope(occurrence, requestScope) ? occurrence : null;
  }

  async getCurrentPublicationEligibility(
    requestScope: ContentPublicationScope,
    studentId: string,
    contentId: string,
    occurrenceId: string,
  ) {
    const found = this.eligibilities.get(`${studentId}:${contentId}:${occurrenceId}`) ?? null;
    return found && matchesScope(found, requestScope) ? found : null;
  }

  async savePublicationMaterialization(materialization: ContentPublicationMaterialization) {
    this.materializations.push(materialization);
    for (const assignment of materialization.assignments) {
      const key = `${assignment.studentId}:${assignment.contentId}`;
      this.assignments.set(key, assignment);
    }
  }

  async listPublishedContent(requestScope: ContentPublicationScope) {
    return [...this.records.values()].filter(
      (record) => record.state === 'published' && matchesScope(record, requestScope),
    );
  }

  async getAssignment(requestScope: ContentPublicationScope, studentId: string, contentId: string) {
    const found = this.assignments.get(`${studentId}:${contentId}`) ?? null;
    return found && matchesScope(found, requestScope) ? found : null;
  }

  async refreshPlaybackFacts(
    requestScope: ContentPublicationScope,
    principal: ContentPublicationPrincipal,
    assignment: StudentContentAssignment,
  ) {
    const eligibilityValue =
      this.eligibilities.get(
        `${assignment.studentId}:${assignment.contentId}:${assignment.occurrenceId}`,
      ) ?? null;
    if (
      principal.role !== 'student' ||
      !principal.studentId ||
      !principal.sessionId ||
      !principal.sessionVersion ||
      principal.studentId !== assignment.studentId ||
      principal.householdId !== assignment.householdId ||
      !eligibilityValue ||
      !matchesScope(eligibilityValue, requestScope) ||
      eligibilityValue.enrollmentVersion !== assignment.enrollmentVersion ||
      eligibilityValue.accessVersion !== assignment.accessVersion ||
      eligibilityValue.serviceAccountConsentVersion !== assignment.serviceAccountConsentVersion ||
      eligibilityValue.privacyVersion !== assignment.privacyVersion ||
      eligibilityValue.revocationVersion !== assignment.revocationVersion ||
      !eligibilityValue.studentActive ||
      !eligibilityValue.enrollmentActive ||
      !['active', 'grace'].includes(eligibilityValue.accessState) ||
      eligibilityValue.accessState !== principal.accessState ||
      !eligibilityValue.serviceAccountAccepted ||
      eligibilityValue.privacyReviewState !== 'clear' ||
      eligibilityValue.studentRevoked ||
      eligibilityValue.accountRevoked ||
      eligibilityValue.contentRevoked
    ) {
      return null;
    }
    const facts: StudentPlaybackAuthorizationFacts = {
      accountKey: assignment.accountKey,
      productKey: assignment.productKey,
      assignmentId: assignment.assignmentId,
      assignmentVersion: assignment.assignmentVersion,
      studentId: assignment.studentId,
      householdId: assignment.householdId,
      sessionId: principal.sessionId,
      sessionVersion: principal.sessionVersion,
      sessionActive: true,
      studentVersion: eligibilityValue.studentVersion,
      studentActive: eligibilityValue.studentActive,
      enrollmentVersion: eligibilityValue.enrollmentVersion,
      enrollmentActive: eligibilityValue.enrollmentActive,
      accessVersion: eligibilityValue.accessVersion,
      accessState: eligibilityValue.accessState,
      serviceAccountConsentVersion: eligibilityValue.serviceAccountConsentVersion,
      serviceAccountAccepted: eligibilityValue.serviceAccountAccepted,
      privacyVersion: eligibilityValue.privacyVersion,
      revocationVersion: eligibilityValue.revocationVersion,
      studentRevoked: eligibilityValue.studentRevoked,
      accountRevoked: eligibilityValue.accountRevoked,
      contentRevoked: eligibilityValue.contentRevoked,
      privacyReviewState: eligibilityValue.privacyReviewState,
      approvalProjectionDigest: eligibilityValue.approvalProjectionDigest,
    };
    this.playbackFacts.set(`${assignment.studentId}:${assignment.contentId}`, facts);
    return facts;
  }

  async getResume(requestScope: ContentPublicationScope, studentId: string, contentId: string) {
    const found = this.resumes.get(`${studentId}:${contentId}`) ?? null;
    return found && matchesScope(found, requestScope) ? found : null;
  }

  async saveResume(resume: StudentContentResume, expectedVersion: number | null) {
    const current = this.resumes.get(`${resume.studentId}:${resume.contentId}`);
    if ((current?.version ?? null) !== expectedVersion) throw new Error('resume_conflict');
    this.resumes.set(`${resume.studentId}:${resume.contentId}`, resume);
  }
}

function matchesScope(value: ContentPublicationScope, requestScope: ContentPublicationScope) {
  return (
    value.accountKey === requestScope.accountKey && value.productKey === requestScope.productKey
  );
}

function restoreMap<K, V>(target: Map<K, V>, snapshot: Map<K, V>) {
  target.clear();
  for (const [key, value] of snapshot) target.set(key, value);
}
