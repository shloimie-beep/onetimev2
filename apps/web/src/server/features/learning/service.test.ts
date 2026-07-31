import { describe, expect, it, vi } from 'vitest';
import type {
  LearningActor,
  LearningEngagementRepository,
  LearningQuestion,
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
    listReviewCompletionEvents: async () => [],
    listQuestions: async () => [],
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
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).rejects.toThrow(/assignment to this class/);
    expect(apply).not.toHaveBeenCalled();
  });

  it('has read-only attendance and consent seams with no mutation methods', () => {
    const instance = service(repository()) as unknown as Record<string, unknown>;
    expect(instance.attendance).toBeTypeOf('function');
    expect(instance.recordAttendance).toBeUndefined();
    expect(instance.correctAttendance).toBeUndefined();
    expect(instance.setRecognitionConsent).toBeUndefined();
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

    const deniedInstance = createLearningEngagementService({
      repository: repository({ applyReviewCompletion: apply }),
      attendance: {
        listAttendance: async () => [],
        listScheduledOccurrenceCoverage: async () => [],
      },
      identity: { listLearners: async () => [] },
      recognitionConsent: { listRecognitionConsent: async () => [] },
      reviewItems: { getAdminPublishedReviewItem: async () => null },
      aliasHmacKey: 'test-only-hmac-key',
    });
    await expect(deniedInstance.recordReviewCompletion(command)).rejects.toThrow(
      /Admin-published review item/,
    );
  });
});
