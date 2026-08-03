import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  AttendanceCorrectionSource,
  AttendanceRecord,
  LearningActor,
  LearningAttendanceReadPort,
  LearningEngagementRepository,
  LearningQuestion,
  QuestionMutation,
  ReviewCompletion,
} from '../../../../../../packages/contracts/src/learning/index.ts';
import { createLearningEngagementService } from './service.ts';

const scope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};
const admin: LearningActor = {
  ...scope,
  role: 'admin',
  principalId: 'admin-a',
  classIds: ['class-a'],
};
const classBQuestion: LearningQuestion = {
  ...scope,
  id: 'question-b',
  studentId: 'student-b',
  householdId: 'household-b',
  classId: 'class-b',
  body: 'Class B question',
  answer: null,
  state: 'submitted',
  version: 1,
  submittedAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const learner = {
  ...scope,
  studentId: 'student-1',
  householdId: 'household-1',
  classId: 'class-a',
  enrollmentId: 'enrollment-1',
  actualName: 'Student One',
  displayName: null,
};

function correctedAttendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    ...scope,
    occurrenceId: 'occurrence-1',
    classId: 'class-a',
    studentId: 'student-1',
    householdId: 'household-1',
    enrollmentId: 'enrollment-1',
    identityBindingVerified: true,
    segmentIds: [],
    minutes: 45,
    present: true,
    occurredAt: '2026-07-01T10:00:00.000Z',
    correctedAt: '2026-07-03T10:00:00.000Z',
    correctionReason: 'Canonical attendance correction',
    correctedBy: 'admin-a',
    correctionAuditRef: 'audit-attendance-1',
    correctionEventId: 'attendance-correction-1',
    correctionSourceDigest: 'a'.repeat(64),
    ...overrides,
  };
}

function attendanceCorrectionSource(
  overrides: Partial<AttendanceCorrectionSource> = {},
): AttendanceCorrectionSource {
  return {
    ...scope,
    eventId: 'attendance-correction-1',
    sourceDigest: 'a'.repeat(64),
    occurrenceId: 'occurrence-1',
    classId: 'class-a',
    studentId: 'student-1',
    householdId: 'household-1',
    auditRef: 'audit-attendance-1',
    reason: 'Canonical attendance correction',
    correctedByAdminId: 'admin-a',
    isLatestForAggregate: true,
    ...overrides,
  };
}

function reviewAggregateIdentity(event: ReviewCompletion) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        accountKey: event.accountKey,
        classId: event.classId,
        householdId: event.householdId,
        productKey: event.productKey,
        reviewItemId: event.reviewItemId,
        runtimeTier: event.runtimeTier,
        studentId: event.studentId,
        verificationEnvironmentId: event.verificationEnvironmentId,
      }),
    )
    .digest('hex');
}

function correctionService(
  repo: LearningEngagementRepository,
  attendance: LearningAttendanceReadPort,
) {
  return createLearningEngagementService({
    repository: repo,
    attendance,
    identity: { listLearners: async () => [learner] },
    recognitionConsent: { listRecognitionConsent: async () => [] },
    reviewItems: { getAdminPublishedReviewItem: async () => null },
    aliasHmacKey: 'test-only-hmac-key',
  });
}

function repository(
  overrides: Partial<LearningEngagementRepository> = {},
): LearningEngagementRepository {
  return {
    getQuestion: async () => null,
    getQuestionHistory: async () => ({ transitions: [], recognitions: [] }),
    applyQuestionMutation: async (mutation) => ({
      question: mutation.projection,
      replay: false,
    }),
    applyReviewCompletion: async (completion) => ({ completion, replay: false }),
    applyBadgeRecalculation: async (recalculation) => ({
      awards: recalculation.awards.map((award) => ({
        ...scope,
        ...award,
        studentId: recalculation.studentId,
        classId: recalculation.classId,
        sourceDigest: recalculation.familySourceDigests[award.family],
        version: 1,
        state: 'awarded' as const,
        ruleVersion: recalculation.ruleVersion,
        sourceAuditRefs: recalculation.familySourceAuditRefs[award.family],
        awardedAt: recalculation.recalculatedAt,
        revokedAt: null,
        recalculatedAt: recalculation.recalculatedAt,
        correctionAuditRef: recalculation.correctionAuditRef,
        correctionReason: recalculation.correctionReason,
        correctedByAdminId: recalculation.correctedByAdminId,
      })),
      replay: false,
    }),
    listBadgeAwardProjections: async () => [],
    listReviewCompletionEvents: async () => [],
    listQuestions: async () => [],
    listPublishedQuestionRecords: async () => [],
    listQuestionRecognitionFacts: async () => [],
    listQuestionTransitions: async () => [],
    listQuestionRecognitions: async () => [],
    saveAnnouncement: async () => undefined,
    listAnnouncements: async () => [],
    saveAnnouncementRead: async () => undefined,
    listAnnouncementReads: async () => [],
    listReviewCompletions: async () => [],
    ...overrides,
  };
}

function service(repo: LearningEngagementRepository) {
  return createLearningEngagementService({
    repository: repo,
    attendance: {
      listAttendance: async () => [],
      getAttendanceCorrectionSource: async () => null,
      listScheduledOccurrenceCoverage: async () => [],
    },
    identity: { listLearners: async () => [] },
    recognitionConsent: { listRecognitionConsent: async () => [] },
    reviewItems: { getAdminPublishedReviewItem: async () => null },
    aliasHmacKey: 'test-only-hmac-key',
  });
}

describe('P22 learning service', () => {
  it('performs question changes only through the atomic mutation port', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyQuestionMutation']>(
      async (mutation) => ({ question: mutation.projection, replay: false }),
    );
    const result = await service(repository({ applyQuestionMutation: apply })).submitQuestion({
      actor: {
        ...scope,
        role: 'student',
        principalId: 'login-1',
        studentId: 'student-1',
        householdId: 'household-1',
        classIds: ['class-a'],
      },
      id: 'question-1',
      classId: 'class-a',
      body: 'Why?',
      idempotencyKey: 'submit-1',
      requestHash: 'hash-submit-1',
      auditRef: 'audit-submit-1',
      occurredAt: '2026-07-01T10:00:00.000Z',
    });
    expect(result.replay).toBe(false);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('denies cross-class mutation before any repository write', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyQuestionMutation']>();
    const instance = service(
      repository({
        getQuestion: async () => classBQuestion,
        applyQuestionMutation: apply,
      }),
    );
    await expect(
      instance.transitionQuestion({
        actor: admin,
        questionId: classBQuestion.id,
        to: 'answered_private',
        answer: 'No write',
        expectedVersion: 1,
        idempotencyKey: 'cross-class',
        requestHash: 'hash-cross-class',
        auditRef: 'audit-cross-class',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).rejects.toThrow(/assignment to this class/);
    expect(apply).not.toHaveBeenCalled();
  });

  it('derives request hashes server-side so a spoofed repeated hash cannot hide changed input', async () => {
    const hashes: string[] = [];
    const apply = vi.fn<LearningEngagementRepository['applyQuestionMutation']>(async (mutation) => {
      hashes.push(mutation.transition.requestHash);
      return { question: mutation.projection, replay: false };
    });
    const instance = service(repository({ applyQuestionMutation: apply }));
    const actor: LearningActor = {
      ...scope,
      role: 'student',
      principalId: 'login-1',
      studentId: 'student-1',
      householdId: 'household-1',
      classIds: ['class-a'],
    };
    const base = {
      actor,
      id: 'question-1',
      classId: 'class-a',
      idempotencyKey: 'submit-1',
      requestHash: 'caller-spoofed-same-hash',
      auditRef: 'audit-submit-1',
      occurredAt: '2026-07-01T10:00:00.000Z',
    };
    await instance.submitQuestion({ ...base, body: 'Why one?' });
    await instance.submitQuestion({ ...base, body: 'Why two?' });
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(hashes).not.toContain(base.requestHash);
  });

  it('rejects padded idempotency keys before hashing or writing', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyQuestionMutation']>();
    await expect(
      service(repository({ applyQuestionMutation: apply })).submitQuestion({
        actor: {
          ...scope,
          role: 'student',
          principalId: 'login-1',
          studentId: 'student-1',
          householdId: 'household-1',
          classIds: ['class-a'],
        },
        id: 'question-1',
        classId: 'class-a',
        body: 'Why?',
        idempotencyKey: ' submit-1 ',
        requestHash: 'caller-hash',
        auditRef: 'audit-submit-1',
        occurredAt: '2026-07-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(/surrounding whitespace/);
    expect(apply).not.toHaveBeenCalled();
  });

  it('has read-only attendance and consent seams with no mutation methods', () => {
    const instance = service(repository()) as unknown as Record<string, unknown>;
    expect(instance.attendance).toBeTypeOf('function');
    expect(instance.recordAttendance).toBeUndefined();
    expect(instance.correctAttendance).toBeUndefined();
    expect(instance.setRecognitionConsent).toBeUndefined();
  });

  it('reads only persisted active badges and performs no evidence scan or recalculation', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyBadgeRecalculation']>();
    const facts = vi.fn<LearningEngagementRepository['listQuestionRecognitionFacts']>();
    const awards = vi.fn<LearningEngagementRepository['listBadgeAwardProjections']>(async () => [
      {
        ...scope,
        key: 'consistency:1',
        family: 'consistency',
        level: 'I',
        threshold: 5,
        qualifyingCount: 5,
        sourceKeys: ['occurrence-private'],
        studentId: 'student-1',
        classId: 'class-a',
        sourceDigest: 'private-digest',
        version: 7,
        state: 'awarded',
        ruleVersion: 'private-rule',
        sourceAuditRefs: ['private-audit'],
        awardedAt: '2026-07-01T10:00:00.000Z',
        revokedAt: null,
        recalculatedAt: '2026-07-01T10:00:00.000Z',
        correctionAuditRef: null,
        correctionReason: null,
        correctedByAdminId: null,
      },
    ]);
    const instance = createLearningEngagementService({
      repository: repository({
        applyBadgeRecalculation: apply,
        listQuestionRecognitionFacts: facts,
        listBadgeAwardProjections: awards,
      }),
      attendance: {
        listAttendance: vi.fn(),
        getAttendanceCorrectionSource: vi.fn(),
        listScheduledOccurrenceCoverage: vi.fn(),
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student One',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: async () => null },
      aliasHmacKey: 'test-only-hmac-key',
    });
    const student: LearningActor = {
      ...scope,
      role: 'student',
      principalId: 'login-1',
      studentId: 'student-1',
      householdId: 'household-1',
      classIds: ['class-a'],
    };
    const parent: LearningActor = {
      ...scope,
      role: 'parent',
      principalId: 'adult-1',
      householdIds: ['household-1'],
      classIds: ['class-a'],
    };
    await expect(instance.badges(student, 'student-1', 'class-a')).resolves.toEqual([
      { key: 'consistency:1', family: 'consistency', level: 'I' },
    ]);
    await expect(instance.badges(parent, 'student-1', 'class-a')).resolves.toEqual([
      { key: 'consistency:1', family: 'consistency', level: 'I' },
    ]);
    expect(awards).toHaveBeenCalledTimes(2);
    expect(facts).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('binds an Admin badge correction to the matching family source audit evidence', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyBadgeRecalculation']>(async () => ({
      awards: [],
      replay: false,
    }));
    const instance = createLearningEngagementService({
      repository: repository({
        applyBadgeRecalculation: apply,
        listQuestionRecognitionFacts: async () => [
          {
            ...scope,
            questionId: 'question-1',
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            state: 'answered_private',
            eligible: false,
            qualifiedAt: '2026-07-01T10:00:00.000Z',
            approvedAt: null,
            latestEventId: 'disable-1:recognition',
            latestSequence: 2,
            latestSource: 'admin_correction',
            latestAuditRef: 'audit-disable-1',
            latestReason: 'Question was duplicated',
            latestActorId: 'admin-a',
          },
        ],
      }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student One',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: async () => null },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await instance.recalculateBadgeProjection(admin, 'student-1', 'class-a', {
      family: 'curious_learner',
      auditRef: 'audit-disable-1',
      reason: 'Question was duplicated',
      sourceIdentity: {
        kind: 'question_recognition',
        eventId: 'disable-1:recognition',
      },
    });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        allowRevocation: true,
        correctionFamily: 'curious_learner',
        correctionAuditRef: 'audit-disable-1',
        correctionReason: 'Question was duplicated',
        correctedByAdminId: 'admin-a',
        familySourceAuditRefs: expect.objectContaining({
          curious_learner: ['audit-disable-1'],
        }),
      }),
    );
    await expect(
      instance.recalculateBadgeProjection(admin, 'student-1', 'class-a', {
        family: 'curious_learner',
        auditRef: 'audit-disable-1',
        reason: 'A different reason',
        sourceIdentity: {
          kind: 'question_recognition',
          eventId: 'disable-1:recognition',
        },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    await expect(
      instance.recalculateBadgeProjection(admin, 'student-1', 'class-a', {
        family: 'curious_learner',
        auditRef: 'audit-disable-1',
        reason: 'Question was duplicated',
        sourceIdentity: {
          kind: 'question_recognition',
          eventId: 'forged-recognition-event',
        },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('projects an ordinary P18 attendance change in non-revoking award mode', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyBadgeRecalculation']>(async () => ({
      awards: [],
      replay: false,
    }));
    const occurrenceIds = Array.from({ length: 5 }, (_, index) => `occurrence-${index + 1}`);
    const instance = createLearningEngagementService({
      repository: repository({ applyBadgeRecalculation: apply }),
      attendance: {
        listAttendance: async () =>
          occurrenceIds.map((occurrenceId, index) => ({
            ...scope,
            occurrenceId,
            classId: 'class-a',
            studentId: 'student-1',
            householdId: 'household-1',
            enrollmentId: 'enrollment-1',
            identityBindingVerified: true as const,
            segmentIds: [],
            minutes: 45,
            present: true,
            occurredAt: `2026-07-0${index + 1}T10:00:00.000Z`,
            correctedAt: null,
            correctionReason: null,
            correctedBy: null,
            correctionAuditRef: null,
            correctionSourceDigest: null,
          })),
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () =>
          occurrenceIds.map((occurrenceId, index) => ({
            ...scope,
            occurrenceId,
            classId: 'class-a',
            studentId: 'student-1',
            enrollmentId: 'enrollment-1',
            identityBindingVerified: true as const,
            occurredAt: `2026-07-0${index + 1}T10:00:00.000Z`,
          })),
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student One',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: async () => null },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a'),
    ).rejects.toThrow(/canonical internal change context/);
    await instance.recalculateBadgesAfterAttendanceProjectionChange(
      {
        ...scope,
        kind: 'canonical_attendance_projection_change',
        classId: 'class-a',
      },
      'student-1',
      'class-a',
    );
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        allowRevocation: false,
        correctionFamily: null,
        awards: expect.arrayContaining([
          expect.objectContaining({ key: 'consistency:1', qualifyingCount: 5 }),
        ]),
      }),
    );
  });

  it('repairs a failed latest attendance-correction projection from its immutable source event', async () => {
    const apply = vi
      .fn<LearningEngagementRepository['applyBadgeRecalculation']>()
      .mockRejectedValueOnce(new Error('badge_projection_temporarily_unavailable'))
      .mockResolvedValue({ awards: [], replay: false });
    const source = attendanceCorrectionSource();
    const getSource = vi.fn(async () => source);
    const instance = correctionService(repository({ applyBadgeRecalculation: apply }), {
      listAttendance: async () => [correctedAttendance()],
      getAttendanceCorrectionSource: getSource,
      listScheduledOccurrenceCoverage: async () => [
        {
          ...scope,
          occurrenceId: 'occurrence-1',
          classId: 'class-a',
          studentId: 'student-1',
          enrollmentId: 'enrollment-1',
          identityBindingVerified: true,
          occurredAt: '2026-07-01T10:00:00.000Z',
        },
      ],
    });
    const correction = {
      auditRef: source.auditRef,
      reason: source.reason,
      sourceIdentity: { kind: 'attendance' as const, eventId: source.eventId },
    };
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(
        admin,
        'student-1',
        'class-a',
        correction,
      ),
    ).rejects.toThrow(/badge_projection_temporarily_unavailable/);
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(
        admin,
        'student-1',
        'class-a',
        correction,
      ),
    ).resolves.toEqual([]);
    expect(getSource).toHaveBeenCalledWith(
      expect.objectContaining(scope),
      'attendance-correction-1',
    );
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('no-write succeeds for a verified older attendance correction when a same-metadata successor exists', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyBadgeRecalculation']>(async () => ({
      awards: [],
      replay: false,
    }));
    const listAwards = vi.fn<LearningEngagementRepository['listBadgeAwardProjections']>(
      async () => [],
    );
    const oldSource = attendanceCorrectionSource({
      eventId: 'attendance-correction-old',
      sourceDigest: 'a'.repeat(64),
      isLatestForAggregate: false,
    });
    const successorSource = attendanceCorrectionSource({
      eventId: 'attendance-correction-successor',
      sourceDigest: 'b'.repeat(64),
      isLatestForAggregate: true,
    });
    const getSource = vi.fn(async (_scope, eventId: string) =>
      eventId === oldSource.eventId
        ? oldSource
        : eventId === successorSource.eventId
          ? successorSource
          : null,
    );
    const instance = correctionService(
      repository({
        applyBadgeRecalculation: apply,
        listBadgeAwardProjections: listAwards,
      }),
      {
        listAttendance: async () => [
          correctedAttendance({
            correctionEventId: successorSource.eventId,
            correctionSourceDigest: successorSource.sourceDigest,
          }),
        ],
        getAttendanceCorrectionSource: getSource,
        listScheduledOccurrenceCoverage: async () => [],
      },
    );
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: oldSource.auditRef,
        reason: oldSource.reason,
        sourceIdentity: { kind: 'attendance', eventId: oldSource.eventId },
      }),
    ).resolves.toEqual([]);
    expect(listAwards).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();

    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: successorSource.auditRef,
        reason: successorSource.reason,
        sourceIdentity: { kind: 'attendance', eventId: successorSource.eventId },
      }),
    ).resolves.toEqual([]);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('denies unknown, metadata-mismatched, and cross-aggregate attendance identities without writes', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyBadgeRecalculation']>();
    const canonical = attendanceCorrectionSource();
    const crossAggregate = attendanceCorrectionSource({
      eventId: 'attendance-correction-cross-student',
      studentId: 'student-2',
      householdId: 'household-2',
    });
    const digestMismatch = attendanceCorrectionSource({
      eventId: 'attendance-correction-digest-mismatch',
      sourceDigest: 'c'.repeat(64),
    });
    const getSource = vi.fn(async (_scope, eventId: string) => {
      if (eventId === canonical.eventId) return canonical;
      if (eventId === crossAggregate.eventId) return crossAggregate;
      if (eventId === digestMismatch.eventId) return digestMismatch;
      return null;
    });
    const instance = correctionService(repository({ applyBadgeRecalculation: apply }), {
      listAttendance: async () => [
        correctedAttendance({
          correctionEventId: digestMismatch.eventId,
          correctionSourceDigest: 'd'.repeat(64),
        }),
      ],
      getAttendanceCorrectionSource: getSource,
      listScheduledOccurrenceCoverage: async () => [],
    });
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: canonical.auditRef,
        reason: canonical.reason,
        sourceIdentity: { kind: 'attendance', eventId: 'forged-event' },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: canonical.auditRef,
        reason: 'Different canonical reason',
        sourceIdentity: { kind: 'attendance', eventId: canonical.eventId },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: crossAggregate.auditRef,
        reason: crossAggregate.reason,
        sourceIdentity: { kind: 'attendance', eventId: crossAggregate.eventId },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    await expect(
      instance.recalculateBadgesAfterAttendanceProjectionChange(admin, 'student-1', 'class-a', {
        auditRef: digestMismatch.auditRef,
        reason: digestMismatch.reason,
        sourceIdentity: { kind: 'attendance', eventId: digestMismatch.eventId },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    expect(apply).not.toHaveBeenCalled();
  });

  it('repairs a failed post-commit badge recalculation on exact source-event replay', async () => {
    let committedTransition: QuestionMutation['transition'] | undefined;
    const applyQuestion = vi.fn<LearningEngagementRepository['applyQuestionMutation']>(
      async (mutation) => {
        committedTransition = mutation.transition;
        return { question: mutation.projection, replay: false };
      },
    );
    const applyBadge = vi
      .fn<LearningEngagementRepository['applyBadgeRecalculation']>()
      .mockRejectedValueOnce(new Error('badge_projection_temporarily_unavailable'))
      .mockResolvedValue({ awards: [], replay: false });
    const instance = createLearningEngagementService({
      repository: repository({
        getQuestion: async () => ({ ...classBQuestion, classId: 'class-a' }),
        getQuestionHistory: async () => ({
          transitions: committedTransition ? [committedTransition] : [],
          recognitions: [],
        }),
        applyQuestionMutation: applyQuestion,
        applyBadgeRecalculation: applyBadge,
      }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-b',
            householdId: 'household-b',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student B',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: async () => null },
      aliasHmacKey: 'test-only-hmac-key',
    });
    const command = {
      actor: admin,
      questionId: classBQuestion.id,
      to: 'answered_private',
      answer: 'Answer',
      expectedVersion: 1,
      idempotencyKey: 'answer-1',
      requestHash: 'caller-hash',
      auditRef: 'audit-answer-1',
      occurredAt: '2026-07-02T10:00:00.000Z',
    } as const;
    await expect(instance.transitionQuestion(command)).rejects.toThrow(
      /badge_projection_temporarily_unavailable/,
    );
    await expect(instance.transitionQuestion(command)).resolves.toMatchObject({ replay: true });
    expect(applyQuestion).toHaveBeenCalledOnce();
    expect(applyBadge).toHaveBeenCalledTimes(2);
  });

  it('keeps the latest revoked review event canonical and repairs its badge projection on replay', async () => {
    const original = {
      ...scope,
      eventId: 'complete-1:review',
      reviewItemId: 'review-1',
      classId: 'class-a',
      studentId: 'student-1',
      householdId: 'household-1',
      adminPublished: true,
      action: 'completed' as const,
      sequence: 1,
      idempotencyKey: 'complete-1',
      requestHash: 'hash-complete-1',
      completedBy: 'login-1',
      source: 'authenticated_submit' as const,
      reason: null,
      auditRef: 'audit-complete-1',
      publicationAuditRef: 'revision-1',
      completedAt: '2026-07-01T10:00:00.000Z',
    };
    let correction: ReviewCompletion | undefined;
    const successor: { current: ReviewCompletion | undefined } = { current: undefined };
    const otherAggregate: { current: ReviewCompletion | undefined } = { current: undefined };
    const applyReview = vi.fn<LearningEngagementRepository['applyReviewCompletion']>(
      async (completion) => {
        correction = completion;
        return { completion, replay: false };
      },
    );
    const applyBadge = vi
      .fn<LearningEngagementRepository['applyBadgeRecalculation']>()
      .mockRejectedValueOnce(new Error('badge_projection_temporarily_unavailable'))
      .mockResolvedValue({ awards: [], replay: false });
    const instance = createLearningEngagementService({
      repository: repository({
        applyReviewCompletion: applyReview,
        applyBadgeRecalculation: applyBadge,
        listReviewCompletionEvents: async () =>
          correction
            ? [original, correction, ...(successor.current ? [successor.current] : [])]
            : [original],
        listReviewCompletions: async () =>
          correction
            ? [correction, ...(otherAggregate.current ? [otherAggregate.current] : [])]
            : [original],
      }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student One',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: {
        getAdminPublishedReviewItem: async () => ({
          ...scope,
          reviewItemId: 'review-1',
          classId: 'class-a',
          publicationAuditRef: 'revision-1',
        }),
      },
      aliasHmacKey: 'test-only-hmac-key',
    });
    const command = {
      actor: admin,
      reviewItemId: 'review-1',
      classId: 'class-a',
      studentId: 'student-1',
      householdId: 'household-1',
      action: 'revoked' as const,
      reason: 'Completion was recorded in error',
      auditRef: 'audit-revoke-1',
      idempotencyKey: 'revoke-1',
      requestHash: 'caller-hash',
      occurredAt: '2026-07-03T10:00:00.000Z',
    };
    await expect(instance.correctReviewCompletion(command)).rejects.toThrow(
      /badge_projection_temporarily_unavailable/,
    );
    await expect(instance.correctReviewCompletion(command)).resolves.toMatchObject({
      replay: true,
      completion: { action: 'revoked' },
    });
    expect(applyReview).toHaveBeenCalledOnce();
    expect(applyBadge).toHaveBeenCalledTimes(2);
    otherAggregate.current = {
      ...correction!,
      eventId: 'revoke-other-aggregate:review',
      reviewItemId: 'review-2',
      idempotencyKey: 'revoke-other-aggregate',
      requestHash: 'other-aggregate-hash',
    };
    await expect(
      instance.recalculateBadgeProjection(admin, 'student-1', 'class-a', {
        family: 'review_ready',
        auditRef: 'audit-revoke-1',
        reason: 'Completion was recorded in error',
        sourceIdentity: {
          kind: 'review_completion',
          eventId: 'revoke-1:review',
          aggregateKey: reviewAggregateIdentity(otherAggregate.current),
        },
      }),
    ).rejects.toThrow(/exact canonical source identity and metadata/);
    expect(applyBadge).toHaveBeenCalledTimes(2);

    successor.current = {
      ...correction!,
      eventId: 'restore-2:review',
      action: 'restored',
      sequence: 3,
      idempotencyKey: 'restore-2',
      requestHash: 'successor-hash',
      auditRef: 'audit-restore-2',
      reason: 'Successor evidence restores completion',
      completedAt: '2026-07-04T10:00:00.000Z',
    };
    await expect(instance.correctReviewCompletion(command)).resolves.toMatchObject({
      replay: true,
      completion: { eventId: 'revoke-1:review' },
    });
    expect(applyReview).toHaveBeenCalledOnce();
    expect(applyBadge).toHaveBeenCalledTimes(2);
  });

  it('verifies the correction roster before reading review history or publication proof', async () => {
    const history = vi.fn<LearningEngagementRepository['listReviewCompletionEvents']>();
    const publication = vi.fn(async () => null);
    const instance = createLearningEngagementService({
      repository: repository({ listReviewCompletionEvents: history }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: { listLearners: async () => [] },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: publication },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await expect(
      instance.correctReviewCompletion({
        actor: admin,
        reviewItemId: 'review-1',
        classId: 'class-a',
        studentId: 'student-1',
        householdId: 'household-1',
        action: 'revoked',
        reason: 'Invalid completion evidence',
        auditRef: 'audit-revoke-1',
        idempotencyKey: 'revoke-1',
        requestHash: 'caller-hash',
        occurredAt: '2026-07-03T10:00:00.000Z',
      }),
    ).rejects.toThrow(/exact roster evidence/);
    expect(history).not.toHaveBeenCalled();
    expect(publication).not.toHaveBeenCalled();
  });

  it('fails closed unless review completion has roster and canonical publication proof', async () => {
    const apply = vi.fn<LearningEngagementRepository['applyReviewCompletion']>(
      async (completion) => ({ completion, replay: false }),
    );
    const actor: LearningActor = {
      ...scope,
      role: 'student',
      principalId: 'login-1',
      studentId: 'student-1',
      householdId: 'household-1',
      classIds: ['class-a'],
    };
    const command = {
      actor,
      reviewItemId: 'review-1',
      classId: 'class-a',
      source: 'authenticated_submit' as const,
      auditRef: 'audit-1',
      idempotencyKey: 'complete-1',
      requestHash: 'hash-complete-1',
      completedAt: '2026-07-02T10:00:00.000Z',
    };
    const instance = createLearningEngagementService({
      repository: repository({ applyReviewCompletion: apply }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: {
        listLearners: async () => [
          {
            ...scope,
            studentId: 'student-1',
            householdId: 'household-1',
            classId: 'class-a',
            enrollmentId: 'enrollment-1',
            actualName: 'Student One',
            displayName: null,
          },
        ],
      },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: {
        getAdminPublishedReviewItem: async () => ({
          ...scope,
          reviewItemId: 'review-1',
          classId: 'class-a',
          publicationAuditRef: 'revision-1',
        }),
      },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await expect(instance.recordReviewCompletion(command)).resolves.toMatchObject({
      replay: false,
    });
    expect(apply).toHaveBeenCalledOnce();

    const deniedPublication = vi.fn(async () => null);
    const deniedInstance = createLearningEngagementService({
      repository: repository({ applyReviewCompletion: apply }),
      attendance: {
        listAttendance: async () => [],
        getAttendanceCorrectionSource: async () => null,
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: { listLearners: async () => [] },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: deniedPublication },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await expect(deniedInstance.recordReviewCompletion(command)).rejects.toThrow(
      /Admin-published review item/,
    );
    expect(deniedPublication).not.toHaveBeenCalled();
  });
});
