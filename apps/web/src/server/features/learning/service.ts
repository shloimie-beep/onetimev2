import type {
  AnnouncementRead,
  AttendanceSegment,
  CorrectQuestionRecognitionCommand,
  LearningActor,
  LearningEngagementRepository,
  LearningScope,
  SubmitQuestionCommand,
  TransitionQuestionCommand,
} from '../../../../../../packages/contracts/src/learning/index.ts';
import { LEARNING_ERROR_CODES } from '../../../../../../packages/contracts/src/learning/index.ts';
import {
  LearningError,
  announcementsVisibleTo,
  attendanceVisibleTo,
  buildLeaderboard,
  calculateBadges,
  correctAttendance,
  correctQuestionRecognition,
  createAnnouncement,
  mergeAttendance,
  publishedQuestionsVisibleTo,
  questionsVisibleTo,
  submitQuestion,
  transitionQuestion,
} from '../../../../../../packages/domain/src/learning/engagement.ts';

export function createLearningEngagementService(input: {
  repository: LearningEngagementRepository;
  aliasSecret: string;
  clock?: () => Date;
}) {
  const now = input.clock ?? (() => new Date());
  return {
    async submitQuestion(command: SubmitQuestionCommand) {
      const result = submitQuestion(command);
      await input.repository.saveQuestion(result.question);
      return result;
    },
    async transitionQuestion(command: TransitionQuestionCommand) {
      const current = await requireQuestion(input.repository, command.actor, command.questionId);
      const result = transitionQuestion(current, command);
      if (!result.replay) await input.repository.saveQuestion(result.question);
      return result;
    },
    async correctQuestionRecognition(command: CorrectQuestionRecognitionCommand) {
      const current = await requireQuestion(input.repository, command.actor, command.questionId);
      const result = correctQuestionRecognition(current, command);
      if (!result.replay) await input.repository.saveQuestion(result.question);
      return result;
    },
    async questions(actor: LearningActor) {
      return questionsVisibleTo(actor, await input.repository.listQuestions(actor));
    },
    async publishedClassQuestions(actor: LearningActor, classId: string) {
      return publishedQuestionsVisibleTo(
        actor,
        await input.repository.listQuestions(actor),
        classId,
      );
    },
    async recordAttendance(actor: LearningActor, segment: AttendanceSegment) {
      requireAdminScope(actor, segment);
      const current = await input.repository.getAttendance(
        actor,
        segment.occurrenceId,
        segment.studentId,
      );
      const merged = mergeAttendance(current, segment);
      if (merged !== current) await input.repository.saveAttendance(merged);
      return merged;
    },
    async correctAttendance(
      actor: LearningActor,
      key: { occurrenceId: string; studentId: string },
      correction: { minutes: number; present: boolean; reason: string; occurredAt: string },
    ) {
      const current = await input.repository.getAttendance(actor, key.occurrenceId, key.studentId);
      if (!current) throw notFound();
      const corrected = correctAttendance(actor, current, correction);
      await input.repository.saveAttendance(corrected);
      return corrected;
    },
    async attendance(actor: LearningActor) {
      return attendanceVisibleTo(actor, await input.repository.listAttendance(actor));
    },
    async badges(
      actor: LearningActor,
      studentId: string,
      scheduledOccurrenceIds: readonly string[],
    ) {
      const [attendance, questions, reviews] = await Promise.all([
        input.repository.listAttendance(actor),
        input.repository.listQuestions(actor),
        input.repository.listReviewCompletions(actor),
      ]);
      const visibleAttendance = attendanceVisibleTo(actor, attendance);
      if (actor.role === 'student' && actor.studentId !== studentId) {
        throw new LearningError(LEARNING_ERROR_CODES.accessDenied, 'Student badge scope mismatch.');
      }
      if (
        actor.role === 'parent' &&
        !visibleAttendance.some(
          (record) =>
            record.studentId === studentId && actor.householdIds.includes(record.householdId),
        )
      ) {
        throw new LearningError(
          LEARNING_ERROR_CODES.accessDenied,
          'The Student is outside this household.',
        );
      }
      return calculateBadges({
        studentId,
        scheduledOccurrenceIds,
        attendance: visibleAttendance,
        questions,
        reviews,
      });
    },
    async publishAnnouncement(args: Parameters<typeof createAnnouncement>[0]) {
      const announcement = createAnnouncement(args);
      await input.repository.saveAnnouncement(announcement);
      return announcement;
    },
    async announcements(actor: LearningActor) {
      const [announcements, reads] = await Promise.all([
        input.repository.listAnnouncements(actor),
        input.repository.listAnnouncementReads(actor, actor.principalId),
      ]);
      const readIds = new Set(reads.map((read) => read.announcementId));
      return announcementsVisibleTo(actor, announcements, now().toISOString()).map(
        (announcement) => ({ announcement, read: readIds.has(announcement.id) }),
      );
    },
    async markAnnouncementRead(
      actor: LearningActor,
      announcementId: string,
    ): Promise<AnnouncementRead> {
      const visible = announcementsVisibleTo(
        actor,
        await input.repository.listAnnouncements(actor),
        now().toISOString(),
      );
      if (!visible.some((announcement) => announcement.id === announcementId)) throw notFound();
      const read = {
        accountKey: actor.accountKey,
        productKey: actor.productKey,
        announcementId,
        principalId: actor.principalId,
        readAt: now().toISOString(),
      };
      await input.repository.saveAnnouncementRead(read);
      return read;
    },
    async leaderboard(actor: LearningActor, classId: string) {
      const [learners, attendance, questions, consents] = await Promise.all([
        input.repository.listLeaderboardLearners(actor, classId),
        input.repository.listAttendance(actor),
        input.repository.listQuestions(actor),
        input.repository.listRecognitionConsents(actor),
      ]);
      return buildLeaderboard({
        actor,
        classId,
        learners,
        attendance,
        questions,
        consents,
        asOf: now().toISOString(),
        aliasSecret: input.aliasSecret,
      });
    },
  };
}

async function requireQuestion(
  repository: LearningEngagementRepository,
  scope: LearningScope,
  questionId: string,
) {
  const question = await repository.getQuestion(scope, questionId);
  if (!question) throw notFound();
  return question;
}

function requireAdminScope(actor: LearningActor, target: LearningScope & { classId: string }) {
  if (
    actor.role !== 'admin' ||
    actor.accountKey !== target.accountKey ||
    actor.productKey !== target.productKey ||
    !actor.classIds.includes(target.classId)
  ) {
    throw new LearningError(
      LEARNING_ERROR_CODES.accessDenied,
      'Admin learning scope and class assignment are required.',
    );
  }
}

function notFound() {
  return new LearningError(
    LEARNING_ERROR_CODES.notFound,
    'The requested learning record was not found.',
  );
}
