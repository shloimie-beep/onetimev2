import type {
  AnnouncementRead,
  CorrectQuestionRecognitionCommand,
  LearningActor,
  LearningAttendanceReadPort,
  LearningEngagementRepository,
  LearningIdentityReadPort,
  LearningRecognitionConsentReadPort,
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
  correctQuestionRecognition,
  createAnnouncement,
  publishedQuestionsVisibleTo,
  questionsVisibleTo,
  submitQuestion,
  transitionQuestion,
} from '../../../../../../packages/domain/src/learning/engagement.ts';

export function createLearningEngagementService(input: {
  repository: LearningEngagementRepository;
  attendance: LearningAttendanceReadPort;
  identity: LearningIdentityReadPort;
  recognitionConsent: LearningRecognitionConsentReadPort;
  aliasHmacKey: string;
  clock?: () => Date;
}) {
  const now = input.clock ?? (() => new Date());
  return {
    async submitQuestion(command: SubmitQuestionCommand) {
      const planned = submitQuestion(command);
      if (!planned.mutation) throw new Error('learning_submit_plan_missing');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      return { ...persisted, effects: planned.effects };
    },
    async transitionQuestion(command: TransitionQuestionCommand) {
      const current = await requireQuestion(input.repository, command.actor, command.questionId);
      const history = await input.repository.getQuestionHistory(command.actor, command.questionId);
      const planned = transitionQuestion(current, history, command);
      if (planned.replay) return { question: current, replay: true, effects: planned.effects };
      if (!planned.mutation) throw new Error('learning_transition_plan_missing');
      return {
        ...(await input.repository.applyQuestionMutation(planned.mutation)),
        effects: planned.effects,
      };
    },
    async correctQuestionRecognition(command: CorrectQuestionRecognitionCommand) {
      const current = await requireQuestion(input.repository, command.actor, command.questionId);
      const history = await input.repository.getQuestionHistory(command.actor, command.questionId);
      const planned = correctQuestionRecognition(current, history, command);
      if (planned.replay) return { question: current, replay: true, effects: planned.effects };
      if (!planned.mutation) throw new Error('learning_recognition_plan_missing');
      return {
        ...(await input.repository.applyQuestionMutation(planned.mutation)),
        effects: planned.effects,
      };
    },
    async questions(actor: LearningActor) {
      return questionsVisibleTo(actor, await input.repository.listQuestions(actor));
    },
    async publishedClassQuestions(actor: LearningActor, classId: string) {
      const [questions, transitions] = await Promise.all([
        input.repository.listQuestions(actor),
        input.repository.listQuestionTransitions(actor),
      ]);
      return publishedQuestionsVisibleTo(actor, questions, transitions, classId);
    },
    async attendance(actor: LearningActor) {
      return attendanceVisibleTo(actor, await input.attendance.listAttendance(actor));
    },
    async badges(
      actor: LearningActor,
      studentId: string,
      scheduledOccurrenceIds: readonly string[],
    ) {
      const [attendance, questions, recognitions, reviews] = await Promise.all([
        input.attendance.listAttendance(actor),
        input.repository.listQuestions(actor),
        input.repository.listQuestionRecognitions(actor),
        input.repository.listReviewCompletions(actor),
      ]);
      const visibleAttendance = attendanceVisibleTo(actor, attendance);
      if (actor.role === 'student' && actor.studentId !== studentId)
        denied('Student badge scope mismatch.');
      if (
        actor.role === 'parent' &&
        !visibleAttendance.some(
          (record) =>
            record.studentId === studentId && actor.householdIds.includes(record.householdId),
        )
      ) {
        denied('The Student is outside this household.');
      }
      return calculateBadges({
        studentId,
        scheduledOccurrenceIds,
        attendance: visibleAttendance,
        questions,
        recognitions,
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
        ...scopeOf(actor),
        announcementId,
        principalId: actor.principalId,
        readAt: now().toISOString(),
      };
      await input.repository.saveAnnouncementRead(read);
      return read;
    },
    async leaderboard(actor: LearningActor, classId: string) {
      const [learners, attendance, questions, transitions, recognitions, consents] =
        await Promise.all([
          input.identity.listLearners(actor, classId),
          input.attendance.listAttendance(actor),
          input.repository.listQuestions(actor),
          input.repository.listQuestionTransitions(actor),
          input.repository.listQuestionRecognitions(actor),
          input.recognitionConsent.listRecognitionConsent(actor, classId),
        ]);
      return buildLeaderboard({
        actor,
        classId,
        learners,
        attendance,
        questions,
        transitions,
        recognitions,
        consents,
        asOf: now().toISOString(),
        aliasHmacKey: input.aliasHmacKey,
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

function scopeOf(scope: LearningScope): LearningScope {
  return {
    accountKey: scope.accountKey,
    productKey: scope.productKey,
    runtimeTier: scope.runtimeTier,
    verificationEnvironmentId: scope.verificationEnvironmentId,
  };
}

function denied(message: string): never {
  throw new LearningError(LEARNING_ERROR_CODES.accessDenied, message);
}

function notFound() {
  return new LearningError(
    LEARNING_ERROR_CODES.notFound,
    'The requested learning record was not found.',
  );
}
