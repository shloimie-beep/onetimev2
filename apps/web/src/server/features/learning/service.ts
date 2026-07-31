import type {
  AnnouncementRead,
  CorrectReviewCompletionCommand,
  CorrectQuestionRecognitionCommand,
  LearningActor,
  LearningAttendanceReadPort,
  LearningEngagementRepository,
  LearningIdentityReadPort,
  LearningRecognitionConsentReadPort,
  LearningReviewItemReadPort,
  LearningScope,
  RecordReviewCompletionCommand,
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
  correctReviewCompletion,
  correctQuestionRecognition,
  createAnnouncement,
  publishedQuestionsVisibleTo,
  questionsVisibleTo,
  recordReviewCompletion,
  submitQuestion,
  transitionQuestion,
} from '../../../../../../packages/domain/src/learning/engagement.ts';

export function createLearningEngagementService(input: {
  repository: LearningEngagementRepository;
  attendance: LearningAttendanceReadPort;
  identity: LearningIdentityReadPort;
  recognitionConsent: LearningRecognitionConsentReadPort;
  reviewItems: LearningReviewItemReadPort;
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
    async badges(actor: LearningActor, studentId: string, classId: string) {
      const asOf = now().toISOString();
      const [attendance, schedule, learners, questions, recognitions, reviews] = await Promise.all([
        input.attendance.listAttendance(actor),
        input.attendance.listScheduledOccurrenceCoverage(
          actor,
          classId,
          new Date(0).toISOString(),
          asOf,
        ),
        input.identity.listLearners(actor, classId),
        input.repository.listQuestions(actor),
        input.repository.listQuestionRecognitions(actor),
        input.repository.listReviewCompletions(actor),
      ]);
      const visibleAttendance = attendanceVisibleTo(actor, attendance);
      const learner = learners.find(
        (candidate) => candidate.studentId === studentId && candidate.classId === classId,
      );
      if (
        !actor.classIds.includes(classId) ||
        !learner ||
        (actor.role === 'student' &&
          (actor.studentId !== studentId || actor.householdId !== learner.householdId)) ||
        (actor.role === 'parent' && !actor.householdIds.includes(learner.householdId))
      ) {
        denied('The Student is outside the canonical class enrollment.');
      }
      const scheduledOccurrenceIds = schedule
        .filter(
          (occurrence) =>
            occurrence.studentId === studentId &&
            occurrence.classId === classId &&
            occurrence.enrollmentId === learner.enrollmentId,
        )
        .map((occurrence) => occurrence.occurrenceId);
      const classQuestions = questions.filter(
        (question) => question.studentId === studentId && question.classId === classId,
      );
      const questionIds = new Set(classQuestions.map((question) => question.id));
      return calculateBadges({
        studentId,
        scheduledOccurrenceIds,
        attendance: visibleAttendance.filter(
          (record) => record.studentId === studentId && record.classId === classId,
        ),
        questions: classQuestions,
        recognitions: recognitions.filter((entry) => questionIds.has(entry.questionId)),
        reviews: reviews.filter(
          (review) => review.studentId === studentId && review.classId === classId,
        ),
      });
    },
    async publishAnnouncement(args: Parameters<typeof createAnnouncement>[0]) {
      const announcement = createAnnouncement(args);
      const audience = announcement.audience;
      if (audience.kind === 'student' || audience.kind === 'parent') {
        const learners = await input.identity.listLearners(args.actor, audience.classId);
        const targetExists =
          audience.kind === 'student'
            ? learners.some(
                (learner) =>
                  learner.studentId === audience.studentId && learner.classId === audience.classId,
              )
            : learners.some(
                (learner) =>
                  learner.householdId === audience.householdId &&
                  learner.classId === audience.classId,
              );
        if (!targetExists) denied('Announcement target is not enrolled in the assigned class.');
      }
      await input.repository.saveAnnouncement(announcement);
      return announcement;
    },
    async recordReviewCompletion(command: RecordReviewCompletionCommand) {
      const [learners, publishedItem] = await Promise.all([
        input.identity.listLearners(command.actor, command.classId),
        input.reviewItems.getAdminPublishedReviewItem(command.actor, command.reviewItemId),
      ]);
      if (
        !publishedItem ||
        !learners.some(
          (learner) =>
            learner.classId === command.classId &&
            command.actor.role === 'student' &&
            learner.studentId === command.actor.studentId &&
            learner.householdId === command.actor.householdId,
        )
      ) {
        denied('Review completion requires an enrolled Student and Admin-published review item.');
      }
      const completion = recordReviewCompletion(command, publishedItem);
      return input.repository.applyReviewCompletion(completion);
    },
    async correctReviewCompletion(command: CorrectReviewCompletionCommand) {
      const [learners, publishedItem, history] = await Promise.all([
        input.identity.listLearners(command.actor, command.classId),
        input.reviewItems.getAdminPublishedReviewItem(command.actor, command.reviewItemId),
        input.repository.listReviewCompletionEvents(
          command.actor,
          command.reviewItemId,
          command.studentId,
        ),
      ]);
      if (
        !publishedItem ||
        !learners.some(
          (learner) =>
            learner.classId === command.classId &&
            learner.studentId === command.studentId &&
            learner.householdId === command.householdId,
        )
      ) {
        denied('Review correction requires exact roster and publication evidence.');
      }
      return input.repository.applyReviewCompletion(
        correctReviewCompletion(history, command, publishedItem),
      );
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
      const asOf = now();
      const windowStarts = new Date(asOf);
      windowStarts.setUTCDate(windowStarts.getUTCDate() - 30);
      const [
        learners,
        attendance,
        scheduledOccurrenceCoverage,
        questions,
        transitions,
        recognitions,
        consents,
      ] = await Promise.all([
        input.identity.listLearners(actor, classId),
        input.attendance.listAttendance(actor),
        input.attendance.listScheduledOccurrenceCoverage(
          actor,
          classId,
          windowStarts.toISOString(),
          asOf.toISOString(),
        ),
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
        scheduledOccurrenceCoverage,
        asOf: asOf.toISOString(),
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
