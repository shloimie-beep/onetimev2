import { describe, expect, it, vi } from 'vitest';
import type {
  AttendanceRecord,
  LearningActor,
  LearningEngagementRepository,
} from '../../../../../../packages/contracts/src/learning/index.ts';
import { submitQuestion } from '../../../../../../packages/domain/src/learning/engagement.ts';
import { createLearningEngagementService } from './service.ts';

const scope = { accountKey: 'account-1', productKey: 'one-time' };
const classAAdmin: LearningActor = {
  ...scope,
  principalId: 'admin-class-a',
  role: 'admin',
  classIds: ['class-a'],
};
const classBStudent: LearningActor = {
  ...scope,
  principalId: 'student-class-b',
  role: 'student',
  studentId: 'student-b',
  householdId: 'household-b',
  classIds: ['class-b'],
};

function repository(
  overrides: Partial<LearningEngagementRepository>,
): LearningEngagementRepository {
  return {
    getQuestion: async () => null,
    saveQuestion: async () => undefined,
    listQuestions: async () => [],
    saveAnnouncement: async () => undefined,
    listAnnouncements: async () => [],
    saveAnnouncementRead: async () => undefined,
    listAnnouncementReads: async () => [],
    getAttendance: async () => null,
    saveAttendance: async () => undefined,
    listAttendance: async () => [],
    listReviewCompletions: async () => [],
    listRecognitionConsents: async () => [],
    listLeaderboardLearners: async () => [],
    ...overrides,
  };
}

describe('P22 learning service class mutation fences', () => {
  it('does not persist a direct cross-class question transition', async () => {
    const question = submitQuestion({
      actor: classBStudent,
      id: 'question-b',
      classId: 'class-b',
      body: 'A class B question',
      occurredAt: '2026-07-01T10:00:00.000Z',
    }).question;
    const saveQuestion = vi.fn<LearningEngagementRepository['saveQuestion']>();
    const service = createLearningEngagementService({
      repository: repository({
        getQuestion: async () => question,
        saveQuestion,
      }),
      aliasSecret: 'test-only-secret',
    });

    await expect(
      service.transitionQuestion({
        actor: classAAdmin,
        questionId: question.id,
        to: 'answered_private',
        answer: 'This write must not happen.',
        expectedVersion: question.version,
        idempotencyKey: 'cross-class-question',
        requestHash: 'hash-cross-class-question',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).rejects.toThrow(/assignment to this class/);
    expect(saveQuestion).not.toHaveBeenCalled();
  });

  it('does not persist a direct cross-class attendance correction', async () => {
    const attendance: AttendanceRecord = {
      ...scope,
      occurrenceId: 'occurrence-b',
      classId: 'class-b',
      studentId: 'student-b',
      householdId: 'household-b',
      segmentIds: ['segment-b'],
      minutes: 45,
      present: true,
      occurredAt: '2026-07-01T10:00:00.000Z',
      correctedAt: null,
      correctionReason: null,
      correctedBy: null,
    };
    const saveAttendance = vi.fn<LearningEngagementRepository['saveAttendance']>();
    const service = createLearningEngagementService({
      repository: repository({
        getAttendance: async () => attendance,
        saveAttendance,
      }),
      aliasSecret: 'test-only-secret',
    });

    await expect(
      service.correctAttendance(
        classAAdmin,
        { occurrenceId: attendance.occurrenceId, studentId: attendance.studentId },
        {
          minutes: 30,
          present: true,
          reason: 'Attempted cross-class correction.',
          occurredAt: '2026-07-02T10:00:00.000Z',
        },
      ),
    ).rejects.toThrow(/assignment to this class/);
    expect(saveAttendance).not.toHaveBeenCalled();
  });
});
