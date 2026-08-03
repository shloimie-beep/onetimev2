import { createHash } from 'node:crypto';
import type {
  AnnouncementRead,
  AttendanceCorrectionSource,
  AttendanceRecord,
  BadgeCorrection,
  CorrectReviewCompletionCommand,
  CorrectQuestionRecognitionCommand,
  LearningActor,
  LearningAttendanceReadPort,
  LearningBadgeAwardProjection,
  LearningEngagementRepository,
  LearningIdentityReadPort,
  LearningProjectionChangeContext,
  LearningRecognitionConsentReadPort,
  LearningReviewItemReadPort,
  LearningScope,
  PublicLearningBadge,
  QuestionRecognitionFact,
  RecordReviewCompletionCommand,
  ReviewCompletion,
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
      assertCanonicalMutationEnvelope(command, command.occurredAt);
      const trustedCommand = withCanonicalRequestHash(command);
      const planned = submitQuestion(trustedCommand);
      if (!planned.mutation) throw new Error('learning_submit_plan_missing');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      return { ...persisted, effects: planned.effects };
    },
    async transitionQuestion(command: TransitionQuestionCommand) {
      assertCanonicalMutationEnvelope(command, command.occurredAt);
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
      assertCanonicalMutationEnvelope(command, command.occurredAt);
      assertCanonicalCorrectionReason(command.reason);
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
        const latestRecognition = [...history.recognitions].sort(
          (left, right) => right.sequence - left.sequence,
        )[0];
        if (latestRecognition?.idempotencyKey === trustedCommand.idempotencyKey) {
          await service.recalculateBadgeProjection(
            trustedCommand.actor,
            current.studentId,
            current.classId,
            {
              family: 'curious_learner',
              auditRef: trustedCommand.auditRef,
              reason: trustedCommand.reason,
              sourceIdentity: {
                kind: 'question_recognition',
                eventId: latestRecognition.eventId,
              },
            },
          );
        }
        return { question: current, replay: true, effects: planned.effects };
      }
      if (!planned.mutation) throw new Error('learning_recognition_plan_missing');
      if (!planned.mutation.recognition) throw new Error('learning_recognition_plan_missing_event');
      const persisted = await input.repository.applyQuestionMutation(planned.mutation);
      await service.recalculateBadgeProjection(
        trustedCommand.actor,
        current.studentId,
        current.classId,
        {
          family: 'curious_learner',
          auditRef: trustedCommand.auditRef,
          reason: trustedCommand.reason,
          sourceIdentity: {
            kind: 'question_recognition',
            eventId: planned.mutation.recognition.eventId,
          },
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
        .map(publicBadge);
    },
    async recalculateBadgeProjection(
      context: LearningActor | LearningProjectionChangeContext,
      studentId: string,
      classId: string,
      correction?: BadgeCorrection,
    ) {
      const actor = isLearningActor(context) ? context : null;
      if (actor && !actor.classIds.includes(classId)) {
        denied('Badge reads require assignment to the requested class.');
      }
      if (!actor) {
        const projectionContext = context as LearningProjectionChangeContext;
        if (
          projectionContext.kind !== 'canonical_attendance_projection_change' ||
          projectionContext.classId !== classId
        ) {
          denied('Badge reads require an exact canonical projection-change context.');
        }
      }
      if (correction && actor?.role !== 'admin') {
        denied('Only an assigned Admin may apply a badge correction.');
      }
      if (
        correction &&
        (correction.auditRef.trim().length === 0 || correction.reason.trim().length < 3)
      ) {
        denied('Badge correction requires a reason and canonical audit reference.');
      }
      const asOf = now().toISOString();
      const learners = await input.identity.listLearners(context, classId);
      const learner = learners.find(
        (candidate) => candidate.studentId === studentId && candidate.classId === classId,
      );
      if (
        !learner ||
        (actor?.role === 'student' &&
          (actor.studentId !== studentId || actor.householdId !== learner.householdId)) ||
        (actor?.role === 'parent' && !actor.householdIds.includes(learner.householdId))
      ) {
        denied('The Student is outside the canonical class enrollment.');
      }
      const [attendance, schedule, questionRecognitionFacts, reviews, attendanceCorrectionSource] =
        await Promise.all([
          input.attendance.listAttendance(context),
          input.attendance.listScheduledOccurrenceCoverage(
            context,
            classId,
            new Date(0).toISOString(),
            asOf,
          ),
          input.repository.listQuestionRecognitionFacts(context, classId, studentId),
          input.repository.listReviewCompletions(context),
          correction?.sourceIdentity.kind === 'attendance'
            ? input.attendance.getAttendanceCorrectionSource(
                context,
                correction.sourceIdentity.eventId,
              )
            : Promise.resolve(null),
        ]);
      const visibleAttendance = actor ? attendanceVisibleTo(actor, attendance) : attendance;
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
            correctionEventId: event.correctionEventId ?? null,
            correctionSourceDigest: event.correctionSourceDigest,
            correctionReason: event.correctionReason,
            correctedBy: event.correctedBy,
          }))
          .sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId)),
        questions: questionRecognitionFacts
          .map((fact) => ({
            questionId: fact.questionId,
            latestEventId: fact.latestEventId ?? null,
            eligible: fact.eligible,
            latestSequence: fact.latestSequence,
            latestAuditRef: fact.latestAuditRef,
            latestReason: fact.latestReason,
            latestActorId: fact.latestActorId,
            latestSource: fact.latestSource,
          }))
          .sort((left, right) => left.questionId.localeCompare(right.questionId)),
        reviews: badgeInput.reviews
          .map((event) => ({
            reviewItemId: event.reviewItemId,
            eventId: event.eventId,
            aggregateKey: reviewAggregateKey(event),
            sequence: event.sequence,
            action: event.action,
            auditRef: event.auditRef,
            publicationAuditRef: event.publicationAuditRef,
            reason: event.reason,
            completedBy: event.completedBy,
            source: event.source,
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
      if (correction) {
        const correctionStatus = actor
          ? canonicalCorrectionStatus(
              correction,
              actor,
              studentId,
              classId,
              learner.householdId,
              attendanceCorrectionSource,
              badgeInput.attendance,
              questionRecognitionFacts,
              badgeInput.reviews,
            )
          : 'invalid';
        if (correctionStatus === 'invalid') {
          denied('Badge correction requires exact canonical source identity and metadata.');
        }
        if (correctionStatus === 'older') {
          return (await input.repository.listBadgeAwardProjections(context, classId, studentId))
            .filter((award) => award.state === 'awarded')
            .map(publicBadge);
        }
      }
      const persisted = await input.repository.applyBadgeRecalculation({
        scope: scopeOf(context),
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
        correctedByAdminId: correction && actor?.role === 'admin' ? actor.principalId : null,
        correctionFamily: correction?.family ?? null,
        allowRevocation: correction !== undefined,
      });
      return persisted.awards.filter((award) => award.state === 'awarded').map(publicBadge);
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
      assertCanonicalMutationEnvelope(command, command.completedAt);
      const trustedCommand = withCanonicalRequestHash(command);
      if (
        trustedCommand.actor.role !== 'student' ||
        !trustedCommand.actor.classIds.includes(trustedCommand.classId)
      ) {
        denied('Only the authenticated enrolled Student may complete a review.');
      }
      const learners = await input.identity.listLearners(
        trustedCommand.actor,
        trustedCommand.classId,
      );
      if (
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
      const publishedItem = await input.reviewItems.getAdminPublishedReviewItem(
        trustedCommand.actor,
        trustedCommand.reviewItemId,
        trustedCommand.classId,
      );
      if (!publishedItem) {
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
      assertCanonicalMutationEnvelope(command, command.occurredAt);
      assertCanonicalCorrectionReason(command.reason);
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
          trustedCommand.classId,
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
        const latest = [...history].sort((left, right) => right.sequence - left.sequence)[0];
        if (latest?.eventId === replay.eventId) {
          await service.recalculateBadgeProjection(
            trustedCommand.actor,
            trustedCommand.studentId,
            trustedCommand.classId,
            {
              family: 'review_ready',
              auditRef: trustedCommand.auditRef,
              reason: trustedCommand.reason,
              sourceIdentity: {
                kind: 'review_completion',
                eventId: replay.eventId,
                aggregateKey: reviewAggregateKey(replay),
              },
            },
          );
        }
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
          sourceIdentity: {
            kind: 'review_completion',
            eventId: persisted.completion.eventId,
            aggregateKey: reviewAggregateKey(persisted.completion),
          },
        },
      );
      return persisted;
    },
    async recalculateBadgesAfterAttendanceProjectionChange(
      context: LearningActor | LearningProjectionChangeContext,
      studentId: string,
      classId: string,
      correction?: {
        auditRef: string;
        reason: string;
        sourceIdentity: { kind: 'attendance'; eventId: string };
      },
    ) {
      if (correction) {
        assertCanonicalCorrectionReason(correction.reason);
        if (
          !isLearningActor(context) ||
          context.role !== 'admin' ||
          !context.classIds.includes(classId)
        ) {
          denied('Only an assigned Admin may project an attendance correction.');
        }
      } else if (
        isLearningActor(context) ||
        context.kind !== 'canonical_attendance_projection_change' ||
        context.classId !== classId
      ) {
        denied('Ordinary attendance projection requires canonical internal change context.');
      }
      return service.recalculateBadgeProjection(
        context,
        studentId,
        classId,
        correction
          ? {
              family: 'consistency',
              auditRef: correction.auditRef,
              reason: correction.reason,
              sourceIdentity: correction.sourceIdentity,
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

function publicBadge(award: LearningBadgeAwardProjection): PublicLearningBadge {
  return {
    key: award.key,
    family: award.family,
    level: award.level,
  };
}

function isLearningActor(
  value: LearningActor | LearningProjectionChangeContext,
): value is LearningActor {
  return 'role' in value;
}

function canonicalCorrectionStatus(
  correction: BadgeCorrection,
  actor: LearningActor,
  studentId: string,
  classId: string,
  householdId: string,
  attendanceSource: AttendanceCorrectionSource | null,
  attendance: readonly AttendanceRecord[],
  questions: readonly QuestionRecognitionFact[],
  reviews: readonly ReviewCompletion[],
): 'latest' | 'older' | 'invalid' {
  if (actor.role !== 'admin') return 'invalid';
  if (correction.family === 'consistency') {
    if (
      correction.sourceIdentity.kind !== 'attendance' ||
      !attendanceSource ||
      attendanceSource.eventId !== correction.sourceIdentity.eventId ||
      !sameScope(actor, attendanceSource) ||
      attendanceSource.studentId !== studentId ||
      attendanceSource.classId !== classId ||
      attendanceSource.householdId !== householdId ||
      attendanceSource.auditRef !== correction.auditRef ||
      attendanceSource.reason !== correction.reason ||
      attendanceSource.correctedByAdminId !== actor.principalId
    ) {
      return 'invalid';
    }
    if (!attendanceSource.isLatestForAggregate) return 'older';
    return attendance.some(
      (event) =>
        event.occurrenceId === attendanceSource.occurrenceId &&
        event.studentId === studentId &&
        event.classId === classId &&
        event.householdId === householdId &&
        event.correctionEventId === attendanceSource.eventId &&
        event.correctionSourceDigest === attendanceSource.sourceDigest &&
        event.correctionAuditRef === attendanceSource.auditRef &&
        event.correctionReason === attendanceSource.reason &&
        event.correctedBy === actor.principalId,
    )
      ? 'latest'
      : 'invalid';
  }
  if (correction.family === 'curious_learner') {
    return questions.some(
      (fact) =>
        correction.sourceIdentity.kind === 'question_recognition' &&
        sameScope(actor, fact) &&
        fact.latestEventId === correction.sourceIdentity.eventId &&
        fact.studentId === studentId &&
        fact.classId === classId &&
        fact.householdId === householdId &&
        fact.latestSource === 'admin_correction' &&
        fact.latestAuditRef === correction.auditRef &&
        fact.latestReason === correction.reason &&
        fact.latestActorId === actor.principalId,
    )
      ? 'latest'
      : 'invalid';
  }
  return reviews.some(
    (event) =>
      correction.sourceIdentity.kind === 'review_completion' &&
      sameScope(actor, event) &&
      event.eventId === correction.sourceIdentity.eventId &&
      reviewAggregateKey(event) === correction.sourceIdentity.aggregateKey &&
      event.studentId === studentId &&
      event.classId === classId &&
      event.householdId === householdId &&
      event.source === 'admin_correction' &&
      event.auditRef === correction.auditRef &&
      event.reason === correction.reason &&
      event.completedBy === actor.principalId,
  )
    ? 'latest'
    : 'invalid';
}

function reviewAggregateKey(
  event: Pick<
    ReviewCompletion,
    | 'accountKey'
    | 'productKey'
    | 'runtimeTier'
    | 'verificationEnvironmentId'
    | 'reviewItemId'
    | 'studentId'
    | 'classId'
    | 'householdId'
  >,
) {
  return digest({
    accountKey: event.accountKey,
    productKey: event.productKey,
    runtimeTier: event.runtimeTier,
    verificationEnvironmentId: event.verificationEnvironmentId,
    reviewItemId: event.reviewItemId,
    studentId: event.studentId,
    classId: event.classId,
    householdId: event.householdId,
  });
}

function sameScope(left: LearningScope, right: LearningScope) {
  return (
    left.accountKey === right.accountKey &&
    left.productKey === right.productKey &&
    left.runtimeTier === right.runtimeTier &&
    left.verificationEnvironmentId === right.verificationEnvironmentId
  );
}

function assertCanonicalMutationEnvelope(
  command: { idempotencyKey: string; auditRef: string },
  occurredAt: string,
) {
  if (
    !command.idempotencyKey ||
    command.idempotencyKey.trim() !== command.idempotencyKey ||
    command.idempotencyKey.length > 512
  ) {
    invalid('Idempotency key must be non-empty and contain no surrounding whitespace.');
  }
  if (!command.auditRef?.trim() || command.auditRef.length > 512) {
    invalid('Mutation audit reference is required.');
  }
  if (!Number.isFinite(Date.parse(occurredAt))) {
    invalid('Mutation timestamp must be a valid instant.');
  }
}

function assertCanonicalCorrectionReason(reason: string) {
  if (!reason || reason.trim() !== reason || reason.length < 3 || reason.length > 1_000) {
    invalid('Correction reason must be canonical, audited, and at least three characters.');
  }
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

function invalid(message: string): never {
  throw new LearningError(LEARNING_ERROR_CODES.invalidTransition, message);
}

function notFound() {
  return new LearningError(
    LEARNING_ERROR_CODES.notFound,
    'The requested learning record was not found.',
  );
}
