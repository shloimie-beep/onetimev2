import { createHash } from 'node:crypto';
import type {
  AnnouncementRead,
  BadgeFamily,
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
  calculateBadgeProgress,
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
  const service = {
    async submitQuestion(command: SubmitQuestionCommand) {
      const trustedCommand = withCanonicalRequestHash(command);
      const planned = submitQuestion(trustedCommand);
      if (!planned.mutation) throw new Error('learning_submit_plan_missing');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      return { ...persisted, effects: planned.effects };
    },
    async transitionQuestion(command: TransitionQuestionCommand) {
      const trustedCommand = withCanonicalRequestHash(command);
      if (trustedCommand.actor.role !== 'admin') denied('Only an Admin may change question state.');
      const current = await requireQuestion(
        input.repository,
        trustedCommand.actor,
        trustedCommand.questionId,
      );
      const history = await input.repository.getQuestionHistory(
        trustedCommand.actor,
        trustedCommand.questionId,
      );
      const planned = transitionQuestion(current, history, trustedCommand);
      if (planned.replay) {
        await service.recalculateBadgeProjection(
          trustedCommand.actor,
          current.studentId,
          current.classId,
        );
        return { question: current, replay: true, effects: planned.effects };
      }
      if (!planned.mutation) throw new Error('learning_transition_plan_missing');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      await service.recalculateBadgeProjection(
        trustedCommand.actor,
        current.studentId,
        current.classId,
      );
      return {
        ...persisted,
        effects: planned.effects,
      };
    },
    async correctQuestionRecognition(command: CorrectQuestionRecognitionCommand) {
      const trustedCommand = withCanonicalRequestHash(command);
      if (trustedCommand.actor.role !== 'admin') denied('Only an Admin may correct recognition.');
      const current = await requireQuestion(
        input.repository,
        trustedCommand.actor,
        trustedCommand.questionId,
      );
      const history = await input.repository.getQuestionHistory(
        trustedCommand.actor,
        trustedCommand.questionId,
      );
      const planned = correctQuestionRecognition(current, history, trustedCommand);
      if (planned.replay) {
        await service.recalculateBadgeProjection(
          trustedCommand.actor,
          current.studentId,
          current.classId,
          {
            family: 'curious_learner',
            auditRef: trustedCommand.auditRef,
            reason: trustedCommand.reason,
          },
        );
        return { question: current, replay: true, effects: planned.effects };
      }
      if (!planned.mutation) throw new Error('learning_recognition_plan_missing');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      await service.recalculateBadgeProjection(
        trustedCommand.actor,
        current.studentId,
        current.classId,
        {
          family: 'curious_learner',
          auditRef: trustedCommand.auditRef,
          reason: trustedCommand.reason,
        },
      );
      return {
        ...persisted,
        effects: planned.effects,
      };
    },
    async questions(actor: LearningActor) {
      if (actor.role === 'parent') return questionsVisibleTo(actor, []);
      return questionsVisibleTo(
        actor,
        await input.repository.listQuestions(
          actor,
          actor.classIds,
          actor.role === 'student' ? actor.studentId : undefined,
        ),
      );
    },
    async publishedClassQuestions(actor: LearningActor, classId: string) {
      if (
        (actor.role !== 'student' && actor.role !== 'admin') ||
        !actor.classIds.includes(classId)
      ) {
        denied('Published questions require assignment to the requested class.');
      }
      const [questions, learners, consents] = await Promise.all([
        input.repository.listPublishedQuestionRecords(actor, classId),
        input.identity.listLearners(actor, classId),
        input.recognitionConsent.listRecognitionConsent(actor, classId),
      ]);
      return publishedQuestionsVisibleTo(
        actor,
        questions,
        learners,
        consents,
        classId,
        input.aliasHmacKey,
      );
    },
    async attendance(actor: LearningActor) {
      return attendanceVisibleTo(actor, await input.attendance.listAttendance(actor));
    },
    async badges(actor: LearningActor, studentId: string, classId: string) {
      if (!actor.classIds.includes(classId)) {
        denied('Badge reads require assignment to the requested class.');
      }
      const learners = await input.identity.listLearners(actor, classId);
      const learner = learners.find(
        (candidate) => candidate.studentId === studentId && candidate.classId === classId,
      );
      if (
        !learner ||
        (actor.role === 'student' &&
          (actor.studentId !== studentId || actor.householdId !== learner.householdId)) ||
        (actor.role === 'parent' && !actor.householdIds.includes(learner.householdId))
      ) {
        denied('The Student is outside the canonical class enrollment.');
      }
      return (await input.repository.listBadgeAwardProjections(actor, classId, studentId))
        .filter((award) => award.state === 'awarded')
        .map(({ studentId: _studentId, classId: _classId, ...award }) => award);
    },
    async recalculateBadgeProjection(
      actor: LearningActor,
      studentId: string,
      classId: string,
      correction?: { family: BadgeFamily; auditRef: string; reason: string },
    ) {
      if (!actor.classIds.includes(classId)) {
        denied('Badge reads require assignment to the requested class.');
      }
      if (correction && actor.role !== 'admin') {
        denied('Only an assigned Admin may apply a badge correction.');
      }
      if (
        correction &&
        (correction.auditRef.trim().length === 0 || correction.reason.trim().length < 3)
      ) {
        denied('Badge correction requires a reason and canonical audit reference.');
      }
      const asOf = now().toISOString();
      const learners = await input.identity.listLearners(actor, classId);
      const learner = learners.find(
        (candidate) => candidate.studentId === studentId && candidate.classId === classId,
      );
      if (
        !learner ||
        (actor.role === 'student' &&
          (actor.studentId !== studentId || actor.householdId !== learner.householdId)) ||
        (actor.role === 'parent' && !actor.householdIds.includes(learner.householdId))
      ) {
        denied('The Student is outside the canonical class enrollment.');
      }
      const [attendance, schedule, questionRecognitionFacts, reviews] = await Promise.all([
        input.attendance.listAttendance(actor),
        input.attendance.listScheduledOccurrenceCoverage(
          actor,
          classId,
          new Date(0).toISOString(),
          asOf,
        ),
        input.repository.listQuestionRecognitionFacts(actor, classId, studentId),
        input.repository.listReviewCompletions(actor),
      ]);
      const visibleAttendance = attendanceVisibleTo(actor, attendance);
      const scheduledOccurrenceIds = schedule
        .filter(
          (occurrence) =>
            occurrence.studentId === studentId &&
            occurrence.classId === classId &&
            occurrence.enrollmentId === learner.enrollmentId,
        )
        .map((occurrence) => occurrence.occurrenceId);
      const badgeInput = {
        studentId,
        scheduledOccurrenceIds,
        attendance: visibleAttendance.filter(
          (record) => record.studentId === studentId && record.classId === classId,
        ),
        questionRecognitionFacts,
        reviews: reviews.filter(
          (review) => review.studentId === studentId && review.classId === classId,
        ),
      };
      const awards = calculateBadges(badgeInput);
      const progress = calculateBadgeProgress(badgeInput);
      const canonicalSources = {
        schedule: schedule
          .filter(
            (event) =>
              event.studentId === studentId &&
              event.classId === classId &&
              event.enrollmentId === learner.enrollmentId,
          )
          .map((event) => ({
            occurrenceId: event.occurrenceId,
            enrollmentId: event.enrollmentId,
            occurredAt: event.occurredAt,
          }))
          .sort(
            (left, right) =>
              left.occurredAt.localeCompare(right.occurredAt) ||
              left.occurrenceId.localeCompare(right.occurrenceId),
          ),
        attendance: badgeInput.attendance
          .map((event) => ({
            occurrenceId: event.occurrenceId,
            present: event.present,
            correctionAuditRef: event.correctionAuditRef,
            correctionSourceDigest: event.correctionSourceDigest,
          }))
          .sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId)),
        questions: questionRecognitionFacts
          .map((fact) => ({
            questionId: fact.questionId,
            eligible: fact.eligible,
            latestSequence: fact.latestSequence,
            latestAuditRef: fact.latestAuditRef,
          }))
          .sort((left, right) => left.questionId.localeCompare(right.questionId)),
        reviews: badgeInput.reviews
          .map((event) => ({
            reviewItemId: event.reviewItemId,
            sequence: event.sequence,
            action: event.action,
            auditRef: event.auditRef,
            publicationAuditRef: event.publicationAuditRef,
          }))
          .sort(
            (left, right) =>
              left.reviewItemId.localeCompare(right.reviewItemId) || left.sequence - right.sequence,
          ),
      };
      const familySourceDigests = {
        consistency: digest({
          schedule: canonicalSources.schedule,
          attendance: canonicalSources.attendance,
        }),
        curious_learner: digest(canonicalSources.questions),
        review_ready: digest(canonicalSources.reviews),
      } as const;
      const familySourceAuditRefs = {
        consistency: sortedUnique(
          badgeInput.attendance.flatMap((event) =>
            event.correctionAuditRef ? [event.correctionAuditRef] : [],
          ),
        ),
        curious_learner: sortedUnique(
          questionRecognitionFacts.flatMap((fact) =>
            fact.latestAuditRef ? [fact.latestAuditRef] : [],
          ),
        ),
        review_ready: sortedUnique(
          badgeInput.reviews.flatMap((event) => [event.auditRef, event.publicationAuditRef]),
        ),
      } as const;
      if (correction && !familySourceAuditRefs[correction.family].includes(correction.auditRef)) {
        denied('Badge correction requires matching canonical source audit evidence.');
      }
      const persisted = await input.repository.applyBadgeRecalculation({
        scope: scopeOf(actor),
        studentId,
        classId,
        familySourceDigests,
        ruleVersion: 'P22-BADGES-1',
        familySourceAuditRefs,
        progress,
        awards,
        recalculatedAt: asOf,
        correctionAuditRef: correction?.auditRef ?? null,
        correctionReason: correction?.reason ?? null,
        correctedByAdminId: correction && actor.role === 'admin' ? actor.principalId : null,
        correctionFamily: correction?.family ?? null,
        allowRevocation: correction !== undefined,
      });
      return persisted.awards
        .filter((award) => award.state === 'awarded')
        .map(({ studentId: _studentId, classId: _classId, ...award }) => award);
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
      const trustedCommand = withCanonicalRequestHash(command);
      if (
        trustedCommand.actor.role !== 'student' ||
        !trustedCommand.actor.classIds.includes(trustedCommand.classId)
      ) {
        denied('Only the authenticated enrolled Student may complete a review.');
      }
      const [learners, publishedItem] = await Promise.all([
        input.identity.listLearners(trustedCommand.actor, trustedCommand.classId),
        input.reviewItems.getAdminPublishedReviewItem(
          trustedCommand.actor,
          trustedCommand.reviewItemId,
        ),
      ]);
      if (
        !publishedItem ||
        !learners.some(
          (learner) =>
            learner.classId === trustedCommand.classId &&
            trustedCommand.actor.role === 'student' &&
            learner.studentId === trustedCommand.actor.studentId &&
            learner.householdId === trustedCommand.actor.householdId,
        )
      ) {
        denied('Review completion requires an enrolled Student and Admin-published review item.');
      }
      const completion = recordReviewCompletion(trustedCommand, publishedItem);
      const persisted = await input.repository.applyReviewCompletion(completion);
      await service.recalculateBadgeProjection(
        trustedCommand.actor,
        trustedCommand.actor.studentId,
        trustedCommand.classId,
      );
      return persisted;
    },
    async correctReviewCompletion(command: CorrectReviewCompletionCommand) {
      const trustedCommand = withCanonicalRequestHash(command);
      if (
        trustedCommand.actor.role !== 'admin' ||
        !trustedCommand.actor.classIds.includes(trustedCommand.classId)
      ) {
        denied('Only an assigned Admin may correct review-completion evidence.');
      }
      const learners = await input.identity.listLearners(
        trustedCommand.actor,
        trustedCommand.classId,
      );
      const rosterBound = learners.some(
        (learner) =>
          learner.classId === trustedCommand.classId &&
          learner.studentId === trustedCommand.studentId &&
          learner.householdId === trustedCommand.householdId,
      );
      if (!rosterBound) {
        denied('Review correction requires exact roster evidence.');
      }
      const [publishedItem, history] = await Promise.all([
        input.reviewItems.getAdminPublishedReviewItem(
          trustedCommand.actor,
          trustedCommand.reviewItemId,
        ),
        input.repository.listReviewCompletionEvents(
          trustedCommand.actor,
          trustedCommand.reviewItemId,
          trustedCommand.studentId,
          trustedCommand.classId,
          trustedCommand.householdId,
        ),
      ]);
      const replay = history.find(
        (event) => event.idempotencyKey === trustedCommand.idempotencyKey,
      );
      if (replay) {
        if (replay.requestHash !== trustedCommand.requestHash) {
          throw new LearningError(
            LEARNING_ERROR_CODES.conflict,
            'This scoped idempotency key was used with a different request hash.',
          );
        }
        await service.recalculateBadgeProjection(
          trustedCommand.actor,
          trustedCommand.studentId,
          trustedCommand.classId,
          {
            family: 'review_ready',
            auditRef: trustedCommand.auditRef,
            reason: trustedCommand.reason,
          },
        );
        return { completion: replay, replay: true };
      }
      const latest = [...history].sort((left, right) => right.sequence - left.sequence)[0];
      const correctionEvidence =
        publishedItem ??
        (trustedCommand.action === 'revoked' && latest
          ? {
              accountKey: latest.accountKey,
              productKey: latest.productKey,
              runtimeTier: latest.runtimeTier,
              verificationEnvironmentId: latest.verificationEnvironmentId,
              reviewItemId: latest.reviewItemId,
              classId: latest.classId,
              publicationAuditRef: latest.publicationAuditRef,
            }
          : null);
      if (!correctionEvidence || !rosterBound) {
        denied('Review correction requires exact roster and publication evidence.');
      }
      const persisted = await input.repository.applyReviewCompletion(
        correctReviewCompletion(history, trustedCommand, correctionEvidence),
      );
      await service.recalculateBadgeProjection(
        trustedCommand.actor,
        trustedCommand.studentId,
        trustedCommand.classId,
        {
          family: 'review_ready',
          auditRef: trustedCommand.auditRef,
          reason: trustedCommand.reason,
        },
      );
      return persisted;
    },
    async recalculateBadgesAfterAttendanceProjectionChange(
      actor: LearningActor,
      studentId: string,
      classId: string,
      correction?: { auditRef: string; reason: string },
    ) {
      if (actor.role !== 'admin' || !actor.classIds.includes(classId)) {
        denied('Only an assigned Admin service context may project attendance-driven badges.');
      }
      return service.recalculateBadgeProjection(
        actor,
        studentId,
        classId,
        correction
          ? {
              family: 'consistency',
              auditRef: correction.auditRef,
              reason: correction.reason,
            }
          : undefined,
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
      if (
        (actor.role !== 'student' && actor.role !== 'admin') ||
        !actor.classIds.includes(classId)
      ) {
        denied('The class leaderboard requires an authenticated class member or Admin.');
      }
      const asOf = now();
      const windowStarts = new Date(asOf);
      windowStarts.setUTCDate(windowStarts.getUTCDate() - 30);
      const [
        learners,
        attendance,
        scheduledOccurrenceCoverage,
        questionRecognitionFacts,
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
        input.repository.listQuestionRecognitionFacts(actor, classId),
        input.recognitionConsent.listRecognitionConsent(actor, classId),
      ]);
      return buildLeaderboard({
        actor,
        classId,
        learners,
        attendance,
        questionRecognitionFacts,
        consents,
        scheduledOccurrenceCoverage,
        asOf: asOf.toISOString(),
        aliasHmacKey: input.aliasHmacKey,
      });
    },
  };
  return service;
}

async function requireQuestion(
  repository: LearningEngagementRepository,
  scope: LearningActor,
  questionId: string,
) {
  const question = await repository.getQuestion(scope, questionId, scope.classIds);
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

function withCanonicalRequestHash<T extends { requestHash: string }>(command: T): T {
  const semantic = { ...command } as Record<string, unknown>;
  delete semantic.requestHash;
  return {
    ...command,
    requestHash: createHash('sha256').update(canonicalJson(semantic), 'utf8').digest('hex'),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).sort().join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
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
