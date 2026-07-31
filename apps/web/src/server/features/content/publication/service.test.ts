import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  CanonicalContentStateTransitionCommand,
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
  StudentPublicationAudience,
  StudentPublicationEligibility,
  VimeoContentPublicationObservation,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
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
    expect(memory.canonicalEvents).toHaveLength(0);
  });

  it('atomically applies a fenced worker readback and materializes protected Student access', async () => {
    const memory = new MemoryPublicationRepository();
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:content_one',
      canonicalOccurrence('content_one', 1),
    );
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });

    await expect(
      service.registerApprovedProjection({
        principal: admin,
        contentVersionId: 'content_version_one',
      }),
    ).resolves.toMatchObject({
      replay: false,
      record: {
        contentId: 'content_one',
        contentVersionId: 'content_version_one',
        contentVersionDigest: hash('1'),
        participantSetVersion: 'participant_set_v1',
        state: 'needs_review',
        version: 1,
      },
    });
    await expect(
      service.registerApprovedProjection({
        principal: admin,
        contentVersionId: 'content_version_one',
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'needs_review', version: 1 } });
    expect(
      memory.canonicalEvents.map(({ previousState, nextState }) => [previousState, nextState]),
    ).toEqual([
      [null, 'received'],
      ['received', 'validating'],
      ['validating', 'processing'],
      ['processing', 'needs_review'],
    ]);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'needs_review',
      version: 4,
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
    memory.eligibilities.set(
      'student_one:content_one:content_one',
      eligibility({ occurrenceId: 'content_one' }),
    );
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
      audience: [audience({ occurrenceId: 'content_one' })],
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
        audience: [audience({ occurrenceId: 'content_one' })],
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
      binding: command(4, 'publish.key', 'e'),
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
    expect(memory.canonicalEvents).toHaveLength(8);
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
    expect(memory.canonicalEvents).toHaveLength(8);
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
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'archived',
      version: 9,
    });
    expect(memory.canonicalEvents).toHaveLength(9);
    expect(memory.canonicalEvents.map(({ idempotencyKey }) => idempotencyKey)).toEqual(
      expect.arrayContaining([
        'content:request_publish:publish.key',
        'content:unpublish:publish.key',
      ]),
    );
    expect(
      memory.canonicalEvents
        .filter(({ operation }) => operation !== 'bootstrap')
        .map(({ operation, actorKind }) => [operation, actorKind]),
    ).toEqual([
      ['approve', 'admin'],
      ['request_publish', 'admin'],
      ['record_published', 'reconciler'],
      ['unpublish', 'admin'],
      ['archive', 'admin'],
    ]);
  });

  it('archives before approval and replays exact registration after canonical successors', async () => {
    const createHarness = () => {
      const memory = new MemoryPublicationRepository();
      memory.canonicalOccurrences.set(
        'one_time_mishnayos:content_one',
        canonicalOccurrence('content_one', 1),
      );
      memory.canonicalOccurrences.set(
        'one_time_mishnayos:occurrence_two',
        canonicalOccurrence('occurrence_two', 2),
      );
      return {
        memory,
        service: createContentPublicationService({
          repository: memory,
          approvedProjectionRepository: memory,
          vimeoProviderBinding,
          vimeoReadbackAdapter: memory,
          createId: () => 'playback_session_001',
        }),
      };
    };

    const preApproval = createHarness();
    await preApproval.service.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await expect(
      preApproval.service.archive({
        principal: admin,
        contentId: 'content_one',
        binding: command(1, 'archive.before.approval', '1'),
      }),
    ).resolves.toMatchObject({ replay: false, record: { state: 'archived', version: 2 } });
    expect(preApproval.memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'archived',
      version: 5,
    });
    expect(preApproval.memory.providerOperations.size).toBe(0);
    expect(preApproval.memory.intents).toHaveLength(0);

    const approved = createHarness();
    await approved.service.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await approved.service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'approve.before.registration.replay', '2'),
    });
    const approvedCanonicalWrites = approved.memory.canonicalEvents.length;
    await expect(
      approved.service.registerApprovedProjection({
        principal: admin,
        contentVersionId: 'content_version_one',
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'approved', version: 2 } });
    expect(approved.memory.canonicalEvents).toHaveLength(approvedCanonicalWrites);
    expect(approved.memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'approved',
      version: 5,
    });

    const publicationOnly = createHarness();
    await publicationOnly.service.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await publicationOnly.service.attachOccurrence({
      principal: admin,
      contentId: 'content_one',
      relation: {
        relationId: 'relation_occurrence_two',
        occurrenceId: 'occurrence_two',
        occurrenceVersion: 2,
        canonicalSeriesId: 'canonical_series_one',
      },
      binding: command(1, 'attach.before.registration.replay', '3'),
    });
    const publicationOnlyCanonicalWrites = publicationOnly.memory.canonicalEvents.length;
    await expect(
      publicationOnly.service.registerApprovedProjection({
        principal: admin,
        contentVersionId: 'content_version_one',
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'needs_review', version: 2 } });
    expect(publicationOnly.memory.canonicalEvents).toHaveLength(publicationOnlyCanonicalWrites);
    expect(publicationOnly.memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'needs_review',
      version: 4,
    });
  });

  it('keeps canonical versions independent when occurrence attachment advances publication only', async () => {
    const memory = new MemoryPublicationRepository();
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:content_one',
      canonicalOccurrence('content_one', 1),
    );
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:occurrence_two',
      canonicalOccurrence('occurrence_two', 2),
    );
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:occurrence_three',
      canonicalOccurrence('occurrence_three', 3),
    );
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });
    await service.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await service.attachOccurrence({
      principal: admin,
      contentId: 'content_one',
      relation: {
        relationId: 'relation_occurrence_two',
        occurrenceId: 'occurrence_two',
        occurrenceVersion: 2,
        canonicalSeriesId: 'canonical_series_one',
      },
      binding: command(1, 'attach.before.approve', '1'),
    });
    expect(memory.records.get('content_one')).toMatchObject({ version: 2, state: 'needs_review' });
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      version: 4,
      state: 'needs_review',
    });
    expect(memory.canonicalEvents).toHaveLength(4);

    await service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(2, 'approve.after.attach', '2'),
    });
    expect(memory.records.get('content_one')).toMatchObject({ version: 3, state: 'approved' });
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      version: 5,
      state: 'approved',
    });
    await service.attachOccurrence({
      principal: admin,
      contentId: 'content_one',
      relation: {
        relationId: 'relation_occurrence_three',
        occurrenceId: 'occurrence_three',
        occurrenceVersion: 3,
        canonicalSeriesId: 'canonical_series_one',
      },
      binding: command(3, 'attach.after.approve', '3'),
    });
    expect(memory.records.get('content_one')).toMatchObject({ version: 4, state: 'approved' });
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      version: 5,
      state: 'approved',
    });
    expect(memory.canonicalEvents).toHaveLength(5);
  });

  it('rolls back every publication-side effect when a canonical append fails', async () => {
    const memory = new MemoryPublicationRepository();
    memory.canonicalOccurrences.set(
      'one_time_mishnayos:content_one',
      canonicalOccurrence('content_one', 1),
    );
    const service = createContentPublicationService({
      repository: memory,
      approvedProjectionRepository: memory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: memory,
      createId: () => 'playback_session_001',
    });
    await service.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });

    memory.failCanonicalOperation = 'approve';
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v2',
        binding: command(1, 'rollback.approve', '1'),
      }),
    ).rejects.toThrowError(/forced_canonical_approve_failure/);
    expect(memory.records.get('content_one')).toMatchObject({ state: 'needs_review', version: 1 });
    expect(memory.receipts.has('approve:rollback.approve')).toBe(false);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 4 });

    memory.failCanonicalOperation = null;
    await service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'approve.ok', '2'),
    });
    memory.failCanonicalOperation = 'request_publish';
    await expect(
      service.requestPublish({
        principal: admin,
        contentId: 'content_one',
        binding: command(2, 'rollback.request', '3'),
      }),
    ).rejects.toThrowError(/forced_canonical_request_publish_failure/);
    expect(memory.records.get('content_one')).toMatchObject({ state: 'approved', version: 2 });
    expect(memory.providerOperations.size).toBe(0);
    expect(memory.intents).toHaveLength(0);
    expect(memory.receipts.has('request_publish:rollback.request')).toBe(false);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 5 });

    memory.failCanonicalOperation = null;
    await service.requestPublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(2, 'request.ok', '4'),
    });
    const publishing = memory.records.get('content_one')!;
    memory.acceptProviderOperation(publishing.pendingProviderOperationId!);
    memory.eligibilities.set(
      'student_one:content_one:content_one',
      eligibility({ occurrenceId: 'content_one' }),
    );
    const publicationReadback = command(3, 'rollback.readback', '5');
    memory.failCanonicalOperation = 'record_published';
    await expect(
      service.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience({ occurrenceId: 'content_one' })],
        binding: publicationReadback,
      }),
    ).rejects.toThrowError(/forced_canonical_record_published_failure/);
    expect(memory.records.get('content_one')).toMatchObject({ state: 'publishing', version: 3 });
    expect(memory.materializations).toHaveLength(0);
    expect(memory.completedProviderOperations.size).toBe(0);
    expect(memory.intentStates.get(memory.intents[0]!.intentId)).toBe('pending');
    expect(memory.receipts.has('record_published:rollback.readback')).toBe(false);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 6 });

    memory.failCanonicalOperation = null;
    await service.applyPrivatePublicationReadback({
      scope,
      contentId: 'content_one',
      providerOperationId: publishing.pendingProviderOperationId!,
      audience: [audience({ occurrenceId: 'content_one' })],
      binding: publicationReadback,
    });
    memory.failCanonicalOperation = 'unpublish';
    await expect(
      service.unpublish({
        principal: admin,
        contentId: 'content_one',
        binding: command(4, 'rollback.unpublish', '6'),
      }),
    ).rejects.toThrowError(/forced_canonical_unpublish_failure/);
    expect(memory.records.get('content_one')).toMatchObject({ state: 'published', version: 4 });
    expect(memory.intents).toHaveLength(1);
    expect(memory.receipts.has('unpublish:rollback.unpublish')).toBe(false);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 7 });

    memory.failCanonicalOperation = null;
    await service.unpublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(4, 'unpublish.ok', '7'),
    });
    const revoking = memory.records.get('content_one')!;
    memory.acceptProviderOperation(revoking.pendingProviderOperationId!);
    await service.applyPrivateRevocationReadback({
      scope,
      contentId: 'content_one',
      providerOperationId: revoking.pendingProviderOperationId!,
      binding: command(5, 'revoke.ok', '8'),
    });
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 8 });

    memory.failCanonicalOperation = 'archive';
    await expect(
      service.archive({
        principal: admin,
        contentId: 'content_one',
        binding: command(6, 'rollback.archive', '9'),
      }),
    ).rejects.toThrowError(/forced_canonical_archive_failure/);
    expect(memory.records.get('content_one')).toMatchObject({ state: 'approved', version: 6 });
    expect(memory.receipts.has('archive:rollback.archive')).toBe(false);
    expect(memory.canonicalStates.get('content_one')).toMatchObject({ version: 8 });

    memory.failCanonicalOperation = null;
    await service.archive({
      principal: admin,
      contentId: 'content_one',
      binding: command(6, 'archive.ok', 'a'),
    });
    expect(memory.canonicalStates.get('content_one')).toMatchObject({
      state: 'archived',
      version: 9,
    });
  });

  it('rejects source-derived Vimeo binding and locked pending-job scope mismatches before writes', async () => {
    const bindingMemory = new MemoryPublicationRepository();
    bindingMemory.canonicalOccurrences.set(
      'one_time_mishnayos:content_one',
      canonicalOccurrence('content_one', 1),
    );
    const bindingService = createContentPublicationService({
      repository: bindingMemory,
      approvedProjectionRepository: bindingMemory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: bindingMemory,
      createId: () => 'playback_session_001',
    });
    await bindingService.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await bindingService.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'scope.approve', '1'),
    });
    bindingMemory.executionScope = {
      product: 'one_time_mishnayos',
      runtime_tier: 'production',
      verification_environment_id: 'production_operator_canary',
    };
    await expect(
      bindingService.requestPublish({
        principal: admin,
        contentId: 'content_one',
        binding: command(2, 'scope.request', '2'),
      }),
    ).rejects.toThrowError(ContentPublicationError);
    expect(bindingMemory.records.get('content_one')).toMatchObject({
      state: 'approved',
      version: 2,
    });
    expect(bindingMemory.providerOperations.size).toBe(0);
    expect(bindingMemory.intents).toHaveLength(0);
    expect(bindingMemory.receipts.has('request_publish:scope.request')).toBe(false);

    const readbackMemory = new MemoryPublicationRepository();
    readbackMemory.canonicalOccurrences.set(
      'one_time_mishnayos:content_one',
      canonicalOccurrence('content_one', 1),
    );
    const readbackService = createContentPublicationService({
      repository: readbackMemory,
      approvedProjectionRepository: readbackMemory,
      vimeoProviderBinding,
      vimeoReadbackAdapter: readbackMemory,
      createId: () => 'playback_session_001',
    });
    await readbackService.registerApprovedProjection({
      principal: admin,
      contentVersionId: 'content_version_one',
    });
    await readbackService.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v2',
      binding: command(1, 'readback.approve', '3'),
    });
    await readbackService.requestPublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(2, 'readback.request', '4'),
    });
    const publishing = readbackMemory.records.get('content_one')!;
    readbackMemory.acceptProviderOperation(publishing.pendingProviderOperationId!);
    readbackMemory.providerContexts.get(publishing.pendingProviderOperationId!)!.executionScope = {
      product: 'one_time_mishnayos',
      runtime_tier: 'production',
      verification_environment_id: 'production_operator_canary',
    };
    await expect(
      readbackService.applyPrivatePublicationReadback({
        scope,
        contentId: 'content_one',
        providerOperationId: publishing.pendingProviderOperationId!,
        audience: [audience({ occurrenceId: 'content_one' })],
        binding: command(3, 'readback.complete', '5'),
      }),
    ).rejects.toThrowError(ContentPublicationError);
    expect(readbackMemory.readbackCalls).toHaveLength(0);
    expect(readbackMemory.records.get('content_one')).toMatchObject({
      state: 'publishing',
      version: 3,
    });
    expect(readbackMemory.materializations).toHaveLength(0);
  });

  it('fails closed for stale approval evidence, ambiguous readback, and assignment versions', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', draft());
    await memory.bootstrapCanonicalContentState(draft(), approvalEvidence());
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
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    contentVersionDigest: hash('1'),
    sourceId: 'source_one',
    sourceSha256: hash('1'),
    sourceObjectVersionId: 'source_object_version_one',
    participantSetVersion: 'participant_set_v1',
    participantSnapshotDigest: hash('2'),
    participantReviewState: 'complete' as const,
    unresolvedParticipantCount: 0,
    requiredRedactionCount: 2,
    completedRedactionCount: 2,
    redactionReviewDigest: hash('3'),
    title: 'Berachos Review',
    englishTranscriptText: 'The class discusses the first Mishnah and evening Shema.',
    classTopic: 'Berachos',
    mishnahReferences: ['Berachos 1:1'],
    occurredAt: '2026-07-27T16:00:00.000Z',
    durationMs: 3_600_000,
    approvedByAdminId: 'admin_one',
    approvedAt: '2026-07-29T10:39:00.000Z',
    artifacts: [
      approvedArtifact('captions_one', 'captions', '3'),
      approvedArtifact('compressed_video_one', 'compressed_video', '4'),
      approvedArtifact('knowledge_artifact_one', 'knowledge_artifact', '5'),
      approvedArtifact('review_material_one', 'review_material', '6'),
      approvedArtifact('transcript_one', 'transcript', '7'),
      approvedArtifact('trim_one', 'trim', '8'),
      approvedArtifact('worksheet_one', 'worksheet', '9'),
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

function approvedArtifact(
  artifactId: string,
  kind: ContentApprovalEvidence['artifacts'][number]['kind'],
  digit: string,
) {
  return {
    artifactId,
    kind,
    revision: 1,
    payloadDigest: hash(digit),
    model: null,
    operationVersion: null,
    promptVersion: null,
    schemaVersion: null,
  };
}

function audience(overrides: Partial<StudentPublicationAudience> = {}) {
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
    ...overrides,
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
  failCanonicalOperation: CanonicalContentStateTransitionCommand['operation'] | null = null;
  executionScope: JobScope = { ...vimeoProviderBinding.scope };
  readonly records = new Map<string, ContentPublicationRecord>();
  readonly canonicalStates = new Map<
    string,
    { state: ContentPublicationRecord['state']; version: number; scope: JobScope }
  >();
  readonly canonicalEvents: Array<{
    operation: CanonicalContentStateTransitionCommand['operation'] | 'bootstrap';
    previousState: ContentPublicationRecord['state'] | null;
    nextState: ContentPublicationRecord['state'];
    expectedVersion: number;
    actorKind: string;
    actorKey: string;
    idempotencyKey: string;
    requestHash: string;
  }> = [];
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
      executionScope: JobScope;
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
      canonicalStates: new Map(this.canonicalStates),
      canonicalEvents: [...this.canonicalEvents],
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
      restoreMap(this.canonicalStates, snapshot.canonicalStates);
      this.canonicalEvents.splice(0, this.canonicalEvents.length, ...snapshot.canonicalEvents);
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

  async registerContent(record: ContentPublicationRecord) {
    const existing = await this.getContent(record, record.contentId);
    if (existing) return { record: existing, inserted: false };
    this.records.set(record.contentId, record);
    return { record, inserted: true };
  }

  async bootstrapCanonicalContentState(
    record: ContentPublicationRecord,
    evidence: ContentApprovalEvidence,
  ) {
    if (
      evidence.accountKey !== record.accountKey ||
      evidence.productKey !== record.productKey ||
      evidence.contentId !== record.contentId ||
      evidence.contentVersionId !== record.contentVersionId ||
      evidence.contentVersionDigest !== record.contentVersionDigest
    ) {
      throw new Error('canonical_bootstrap_binding_conflict');
    }
    const current = this.canonicalStates.get(record.contentId);
    if (current) {
      const bootstrap = this.canonicalEvents.slice(0, 4);
      if (
        current.state !== record.state ||
        (record.state === 'needs_review' ? current.version !== 4 : current.version <= 4) ||
        !['needs_review', 'approved', 'publishing', 'published', 'failed', 'archived'].includes(
          record.state,
        ) ||
        JSON.stringify(current.scope) !== JSON.stringify(this.executionScope) ||
        bootstrap.length !== 4 ||
        bootstrap.some(
          (event, index) =>
            event.operation !== 'bootstrap' ||
            event.expectedVersion !== index ||
            event.requestHash !== evidence.projectionDigest,
        )
      ) {
        throw new Error('canonical_bootstrap_replay_conflict');
      }
      return { replay: true, resultingVersion: current.version };
    }
    if (record.state !== 'needs_review' || record.version !== 1) {
      throw new Error('canonical_bootstrap_fresh_record_required');
    }
    const states = ['received', 'validating', 'processing', 'needs_review'] as const;
    states.forEach((nextState, index) => {
      this.canonicalEvents.push({
        operation: 'bootstrap',
        previousState: index === 0 ? null : states[index - 1]!,
        nextState,
        expectedVersion: index,
        actorKind: 'reconciler',
        actorKey: 'content-publication-bootstrap',
        idempotencyKey: `content:bootstrap:${index + 1}:${nextState}`,
        requestHash: evidence.projectionDigest,
      });
    });
    this.canonicalStates.set(record.contentId, {
      state: 'needs_review',
      version: 4,
      scope: { ...this.executionScope },
    });
    return { replay: false, resultingVersion: 4 };
  }

  async resolveCanonicalContentExecutionScope(record: ContentPublicationRecord) {
    const evidence = record.approval?.evidence;
    if (
      !evidence ||
      evidence.accountKey !== record.accountKey ||
      evidence.productKey !== record.productKey ||
      evidence.contentId !== record.contentId ||
      evidence.contentVersionId !== record.contentVersionId ||
      evidence.contentVersionDigest !== record.contentVersionDigest
    ) {
      throw new Error('canonical_source_scope_unavailable');
    }
    return { ...this.executionScope };
  }

  async appendCanonicalContentStateTransition(command: CanonicalContentStateTransitionCommand) {
    if (this.failCanonicalOperation === command.operation) {
      throw new Error(`forced_canonical_${command.operation}_failure`);
    }
    const current = this.canonicalStates.get(command.record.contentId);
    if (!current || JSON.stringify(current.scope) !== JSON.stringify(this.executionScope)) {
      throw new Error('canonical_state_scope_conflict');
    }
    const preApprovalArchive =
      command.operation === 'archive' &&
      command.previousState === 'needs_review' &&
      command.nextState === 'archived' &&
      command.record.state === 'archived' &&
      command.record.approval === null;
    if (
      (command.scopeDerivation === 'approved_processing_source' && !preApprovalArchive) ||
      (command.scopeDerivation === 'approved_projection' && !command.record.approval)
    ) {
      throw new Error('canonical_scope_derivation_conflict');
    }
    const idempotencyKey = `content:${command.operation}:${command.idempotencyKey}`;
    const prior = this.canonicalEvents.find((event) => event.idempotencyKey === idempotencyKey);
    if (prior) {
      if (
        prior.operation !== command.operation ||
        prior.previousState !== command.previousState ||
        prior.nextState !== command.nextState ||
        prior.actorKind !== command.actorKind ||
        prior.actorKey !== command.actorKey ||
        prior.requestHash !== command.requestHash
      ) {
        throw new Error('canonical_state_idempotency_conflict');
      }
      return { replay: true, resultingVersion: prior.expectedVersion + 1 };
    }
    if (current.state !== command.previousState) {
      throw new Error('canonical_state_transition_conflict');
    }
    this.canonicalEvents.push({
      operation: command.operation,
      previousState: command.previousState,
      nextState: command.nextState,
      expectedVersion: current.version,
      actorKind: command.actorKind,
      actorKey: command.actorKey,
      idempotencyKey,
      requestHash: command.requestHash,
    });
    this.canonicalStates.set(command.record.contentId, {
      ...current,
      state: command.nextState,
      version: current.version + 1,
    });
    return { replay: false, resultingVersion: current.version + 1 };
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
      executionScope: { ...operation.scope },
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
