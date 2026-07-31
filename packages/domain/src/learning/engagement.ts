import { createHmac } from 'node:crypto';
import type {
  AnnouncementAudience,
  AttendanceRecord,
  BadgeFamily,
  CanonicalLearnerIdentity,
  CanonicalRecognitionConsent,
  CorrectReviewCompletionCommand,
  CorrectQuestionRecognitionCommand,
  LeaderboardEntry,
  LearningActor,
  LearningAnnouncement,
  LearningBadgeAward,
  LearningLeaderboard,
  LearningQuestion,
  LearningScope,
  PublishedClassQuestion,
  PublishedQuestionRecord,
  QuestionHistory,
  QuestionMutation,
  QuestionRecognitionLedgerEntry,
  QuestionRecognitionFact,
  QuestionState,
  QuestionTransitionLedgerEntry,
  RecordReviewCompletionCommand,
  ReviewCompletion,
  ScheduledOccurrenceCoverage,
  SubmitQuestionCommand,
  TransitionQuestionCommand,
} from '../../../contracts/src/learning/index.ts';
import {
  LEARNING_ERROR_CODES,
  LEARNING_ROLLING_WINDOW_DAYS,
  NO_LEARNING_EXTERNAL_EFFECTS,
} from '../../../contracts/src/learning/index.ts';

export class LearningError extends Error {
  constructor(
    readonly code: (typeof LEARNING_ERROR_CODES)[keyof typeof LEARNING_ERROR_CODES],
    message: string,
  ) {
    super(message);
    this.name = 'LearningError';
  }
}

const QUESTION_TRANSITIONS: Record<QuestionState, readonly QuestionState[]> = {
  submitted: ['answered_private', 'approved_for_class', 'closed', 'declined'],
  answered_private: ['approved_for_class', 'closed', 'declined'],
  approved_for_class: ['answered_private', 'published', 'closed', 'declined'],
  published: ['approved_for_class', 'closed'],
  closed: [],
  declined: [],
};
const QUALIFYING_STATES = new Set<QuestionState>([
  'answered_private',
  'approved_for_class',
  'published',
]);

export type PlannedQuestionMutation = {
  mutation: QuestionMutation | null;
  replay: boolean;
  effects: typeof NO_LEARNING_EXTERNAL_EFFECTS;
};

export function submitQuestion(command: SubmitQuestionCommand): PlannedQuestionMutation {
  if (command.actor.role !== 'student' || !command.actor.classIds.includes(command.classId)) {
    denied('Only the enrolled Student may submit a private class question.');
  }
  const body = requiredText(command.body, 'Question text', 4_000);
  if (body.length < 2) invalid('Question text must contain 2 to 4,000 characters.');
  const projection: LearningQuestion = {
    ...scopeOf(command.actor),
    id: command.id,
    studentId: command.actor.studentId,
    householdId: command.actor.householdId,
    classId: command.classId,
    body,
    answer: null,
    state: 'submitted',
    version: 1,
    submittedAt: command.occurredAt,
    updatedAt: command.occurredAt,
  };
  return {
    mutation: {
      projection,
      expectedVersion: 0,
      transition: transitionEntry(
        projection,
        command,
        'authenticated_student_submit',
        null,
        'submitted',
        null,
      ),
      recognition: null,
    },
    replay: false,
    effects: NO_LEARNING_EXTERNAL_EFFECTS,
  };
}

export function transitionQuestion(
  current: LearningQuestion,
  history: QuestionHistory,
  command: TransitionQuestionCommand,
): PlannedQuestionMutation {
  requireAdmin(command.actor, current);
  if (isReplay(history.transitions, command.idempotencyKey, command.requestHash)) {
    return { mutation: null, replay: true, effects: NO_LEARNING_EXTERNAL_EFFECTS };
  }
  if (current.version !== command.expectedVersion) stale();
  if (!QUESTION_TRANSITIONS[current.state].includes(command.to)) {
    invalid(`Question cannot transition from ${current.state} to ${command.to}.`);
  }
  const answer = command.answer?.trim();
  if (command.to === 'answered_private' && !answer && !current.answer) {
    invalid('A private answer is required for answered_private.');
  }
  const projection: LearningQuestion = {
    ...current,
    state: command.to,
    answer: answer || current.answer,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  const firstQualification =
    QUALIFYING_STATES.has(command.to) &&
    !history.recognitions.some((entry) => entry.action === 'qualified');
  return {
    mutation: {
      projection,
      expectedVersion: command.expectedVersion,
      transition: transitionEntry(
        current,
        command,
        'admin_transition',
        current.state,
        command.to,
        command.reason?.trim() || null,
      ),
      recognition: firstQualification
        ? recognitionEntry(
            current,
            command,
            nextRecognitionSequence(history.recognitions),
            'admin_transition',
            'qualified',
            true,
            null,
          )
        : null,
    },
    replay: false,
    effects: NO_LEARNING_EXTERNAL_EFFECTS,
  };
}

export function correctQuestionRecognition(
  current: LearningQuestion,
  history: QuestionHistory,
  command: CorrectQuestionRecognitionCommand,
): PlannedQuestionMutation {
  requireAdmin(command.actor, current);
  if (isReplay(history.transitions, command.idempotencyKey, command.requestHash)) {
    return { mutation: null, replay: true, effects: NO_LEARNING_EXTERNAL_EFFECTS };
  }
  if (current.version !== command.expectedVersion) stale();
  const reason = command.reason.trim();
  if (reason.length < 3) invalid('An audited correction reason is required.');
  if (!history.recognitions.some((entry) => entry.action === 'qualified')) {
    invalid('Recognition cannot be corrected before the question first qualifies.');
  }
  const projection = {
    ...current,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  return {
    mutation: {
      projection,
      expectedVersion: command.expectedVersion,
      transition: transitionEntry(
        current,
        command,
        'admin_correction',
        current.state,
        current.state,
        `recognition_correction:${reason}`,
      ),
      recognition: recognitionEntry(
        current,
        command,
        nextRecognitionSequence(history.recognitions),
        'admin_correction',
        command.eligible ? 'correction_enabled' : 'correction_disabled',
        command.eligible,
        reason,
      ),
    },
    replay: false,
    effects: NO_LEARNING_EXTERNAL_EFFECTS,
  };
}

export function questionsVisibleTo(
  actor: LearningActor,
  questions: readonly LearningQuestion[],
): readonly LearningQuestion[] {
  const scoped = questions.filter((question) => sameScope(actor, question));
  if (actor.role === 'parent') {
    throw new LearningError(
      LEARNING_ERROR_CODES.parentQuestionDenied,
      'Private Student questions are not available in Parent views.',
    );
  }
  if (actor.role === 'student') {
    return scoped.filter(
      (question) =>
        question.studentId === actor.studentId && actor.classIds.includes(question.classId),
    );
  }
  return scoped.filter((question) => actor.classIds.includes(question.classId));
}

export function publishedQuestionsVisibleTo(
  actor: LearningActor,
  questions: readonly PublishedQuestionRecord[],
  learners: readonly CanonicalLearnerIdentity[],
  consents: readonly CanonicalRecognitionConsent[],
  classId: string,
  aliasHmacKey: string,
): readonly PublishedClassQuestion[] {
  if ((actor.role !== 'student' && actor.role !== 'admin') || !actor.classIds.includes(classId)) {
    denied('Published questions require assignment to the requested class.');
  }
  const cohort = learners.filter(
    (learner) => sameScope(actor, learner) && learner.classId === classId,
  );
  const identities = new Map(cohort.map((learner) => [learner.studentId, learner]));
  const labels = leaderboardLabels(
    actor as Extract<LearningActor, { role: 'admin' | 'student' }>,
    cohort,
    latestConsent(consents.filter((event) => sameScope(actor, event))),
    aliasHmacKey,
  );
  return questions
    .filter((question) => sameScope(actor, question) && question.classId === classId)
    .flatMap((question) => {
      const learner = identities.get(question.studentId);
      const authorDisplayName = labels.get(question.studentId);
      if (!learner || !authorDisplayName) return [];
      return [
        {
          questionId: question.questionId,
          classId: question.classId,
          question: question.question,
          answer: question.answer,
          authorDisplayName,
          authorEntryKey: opaqueKey('entry', aliasHmacKey, learner),
          publishedAt: question.publishedAt,
        },
      ];
    });
}

export function attendanceVisibleTo(
  actor: LearningActor,
  records: readonly AttendanceRecord[],
): readonly AttendanceRecord[] {
  const valid = records.filter((record) => canonicalAttendanceMatches(actor, record));
  if (actor.role === 'admin') {
    return valid.filter((record) => actor.classIds.includes(record.classId));
  }
  if (actor.role === 'student') {
    return valid.filter(
      (record) => record.studentId === actor.studentId && record.householdId === actor.householdId,
    );
  }
  return valid.filter((record) => actor.householdIds.includes(record.householdId));
}

type BadgeCalculationInput = {
  studentId: string;
  scheduledOccurrenceIds: readonly string[];
  attendance: readonly AttendanceRecord[];
  questionRecognitionFacts: readonly QuestionRecognitionFact[];
  reviews: readonly ReviewCompletion[];
};

export function calculateBadgeProgress(
  input: BadgeCalculationInput,
): Readonly<Record<BadgeFamily, { qualifyingCount: number; sourceKeys: readonly string[] }>> {
  const presentIds = new Set(
    input.attendance
      .filter((record) => record.studentId === input.studentId && record.present)
      .map((record) => record.occurrenceId),
  );
  let streak = 0;
  for (const occurrenceId of [...input.scheduledOccurrenceIds].reverse()) {
    if (!presentIds.has(occurrenceId)) break;
    streak += 1;
  }
  const questionIds = [
    ...new Set(
      input.questionRecognitionFacts
        .filter((fact) => fact.studentId === input.studentId && fact.eligible)
        .map((fact) => fact.questionId),
    ),
  ];
  const latestReviews = new Map<string, ReviewCompletion>();
  for (const review of input.reviews.filter(
    (event) => event.studentId === input.studentId && event.adminPublished,
  )) {
    const prior = latestReviews.get(review.reviewItemId);
    if (!prior || review.sequence > prior.sequence) latestReviews.set(review.reviewItemId, review);
  }
  const reviewIds = [...latestReviews.values()]
    .filter((review) => review.action === 'completed' || review.action === 'restored')
    .map((review) => review.reviewItemId);
  return {
    consistency: {
      qualifyingCount: streak,
      sourceKeys: input.scheduledOccurrenceIds.slice(-streak),
    },
    curious_learner: { qualifyingCount: questionIds.length, sourceKeys: questionIds },
    review_ready: { qualifyingCount: reviewIds.length, sourceKeys: reviewIds },
  };
}

export function calculateBadges(input: BadgeCalculationInput): readonly LearningBadgeAward[] {
  const progress = calculateBadgeProgress(input);
  return [
    ...awards(
      'consistency',
      progress.consistency.qualifyingCount,
      [5, 20, 60],
      progress.consistency.sourceKeys,
    ),
    ...awards(
      'curious_learner',
      progress.curious_learner.qualifyingCount,
      [1, 5, 15],
      progress.curious_learner.sourceKeys,
    ),
    ...awards(
      'review_ready',
      progress.review_ready.qualifyingCount,
      [1, 4, 12],
      progress.review_ready.sourceKeys,
    ),
  ];
}

export function createAnnouncement(input: {
  actor: LearningActor;
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  publishedAt: string;
  expiresAt?: string;
}): LearningAnnouncement {
  if (input.actor.role !== 'admin') denied('Only an Admin may publish an announcement.');
  if (!validAudience(input.audience)) invalid('Unknown announcement audience.');
  if (input.audience.kind !== 'program' && !input.actor.classIds.includes(input.audience.classId)) {
    denied('The Admin is not assigned to the announcement class.');
  }
  return {
    ...scopeOf(input.actor),
    id: input.id,
    title: requiredText(input.title, 'Announcement title', 160),
    body: requiredText(input.body, 'Announcement body', 4_000),
    audience: input.audience,
    publishedBy: input.actor.principalId,
    publishedAt: input.publishedAt,
    expiresAt: input.expiresAt ?? null,
  };
}

export function recordReviewCompletion(
  command: RecordReviewCompletionCommand,
  publishedItem: LearningScope & {
    reviewItemId: string;
    classId: string;
    publicationAuditRef: string;
  },
): ReviewCompletion {
  if (command.actor.role !== 'student' || !command.actor.classIds.includes(command.classId)) {
    denied('Only the authenticated enrolled Student may complete a review.');
  }
  if (
    publishedItem.reviewItemId !== command.reviewItemId ||
    publishedItem.classId !== command.classId ||
    !sameScope(command.actor, publishedItem)
  ) {
    denied('Review completion requires canonical Admin-published item evidence.');
  }
  return {
    ...scopeOf(command.actor),
    eventId: `${command.idempotencyKey}:review`,
    reviewItemId: requiredText(command.reviewItemId, 'Review item', 512),
    classId: requiredText(command.classId, 'Class', 512),
    studentId: command.actor.studentId,
    householdId: command.actor.householdId,
    adminPublished: true,
    action: 'completed',
    sequence: 1,
    idempotencyKey: requiredText(command.idempotencyKey, 'Idempotency key', 512),
    requestHash: requiredText(command.requestHash, 'Request hash', 512),
    completedBy: command.actor.principalId,
    source: command.source,
    reason: null,
    auditRef: requiredText(command.auditRef, 'Review completion audit reference', 512),
    publicationAuditRef: requiredText(
      publishedItem.publicationAuditRef,
      'Review publication audit reference',
      512,
    ),
    completedAt: command.completedAt,
  };
}

export function correctReviewCompletion(
  history: readonly ReviewCompletion[],
  command: CorrectReviewCompletionCommand,
  publishedItem: LearningScope & {
    reviewItemId: string;
    classId: string;
    publicationAuditRef: string;
  },
): ReviewCompletion {
  if (command.actor.role !== 'admin' || !command.actor.classIds.includes(command.classId)) {
    denied('Only an assigned Admin may correct review-completion evidence.');
  }
  if (
    publishedItem.reviewItemId !== command.reviewItemId ||
    publishedItem.classId !== command.classId ||
    !sameScope(command.actor, publishedItem)
  ) {
    denied('Review correction requires exact canonical published-item evidence.');
  }
  const scoped = history.filter(
    (event) =>
      sameScope(command.actor, event) &&
      event.reviewItemId === command.reviewItemId &&
      event.classId === command.classId &&
      event.studentId === command.studentId &&
      event.householdId === command.householdId,
  );
  const latest = [...scoped].sort((left, right) => right.sequence - left.sequence)[0];
  if (!latest || (command.action === 'revoked' && latest.action === 'revoked')) {
    invalid('Review correction requires active completion evidence.');
  }
  if (command.action === 'restored' && latest.action !== 'revoked') {
    invalid('Review restoration requires prior revocation evidence.');
  }
  const reason = requiredText(command.reason, 'Review correction reason', 1_000);
  if (reason.length < 3) invalid('Review correction requires an audited reason.');
  return {
    ...scopeOf(command.actor),
    eventId: `${command.idempotencyKey}:review`,
    reviewItemId: command.reviewItemId,
    classId: command.classId,
    studentId: command.studentId,
    householdId: command.householdId,
    adminPublished: true,
    action: command.action,
    sequence: latest.sequence + 1,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    completedBy: command.actor.principalId,
    source: 'admin_correction',
    reason,
    auditRef: requiredText(command.auditRef, 'Review correction audit reference', 512),
    publicationAuditRef: publishedItem.publicationAuditRef,
    completedAt: command.occurredAt,
  };
}

export function announcementsVisibleTo(
  actor: LearningActor,
  announcements: readonly LearningAnnouncement[],
  at: string,
): readonly LearningAnnouncement[] {
  const now = Date.parse(at);
  return announcements.filter(
    (announcement) =>
      sameScope(actor, announcement) &&
      validAudience(announcement.audience) &&
      (!announcement.expiresAt || Date.parse(announcement.expiresAt) > now) &&
      audienceMatches(actor, announcement.audience),
  );
}

export function buildLeaderboard(input: {
  actor: LearningActor;
  classId: string;
  learners: readonly CanonicalLearnerIdentity[];
  attendance: readonly AttendanceRecord[];
  questionRecognitionFacts: readonly QuestionRecognitionFact[];
  consents: readonly CanonicalRecognitionConsent[];
  scheduledOccurrenceCoverage?: readonly ScheduledOccurrenceCoverage[];
  asOf: string;
  aliasHmacKey: string;
}): LearningLeaderboard {
  if (
    (input.actor.role !== 'student' && input.actor.role !== 'admin') ||
    !input.actor.classIds.includes(input.classId)
  ) {
    denied('The class leaderboard requires an authenticated class member or Admin.');
  }
  const viewer = input.actor as Extract<LearningActor, { role: 'admin' | 'student' }>;
  const windowEnds = new Date(input.asOf);
  const windowStarts = new Date(windowEnds);
  windowStarts.setUTCDate(windowStarts.getUTCDate() - LEARNING_ROLLING_WINDOW_DAYS);
  const learners = input.learners.filter(
    (learner) => sameScope(input.actor, learner) && learner.classId === input.classId,
  );
  const consents = latestConsent(input.consents.filter((event) => sameScope(input.actor, event)));
  // Raw peer rows remain server-internal. Only privacy-safe aggregates derived
  // from exact-scope, identity-bound canonical rows are returned.
  const visibleWindowAttendance = input.attendance.filter(
    (record) =>
      canonicalAttendanceMatches(input.actor, record) &&
      record.classId === input.classId &&
      inWindow(record.occurredAt, windowStarts, windowEnds),
  );
  const attendanceCount = new Map<string, number>();
  for (const record of visibleWindowAttendance) {
    if (record.present) {
      attendanceCount.set(record.studentId, (attendanceCount.get(record.studentId) ?? 0) + 1);
    }
  }
  const approvedQuestionCount = new Map<string, number>();
  for (const fact of input.questionRecognitionFacts) {
    if (
      sameScope(input.actor, fact) &&
      fact.classId === input.classId &&
      (fact.state === 'approved_for_class' || fact.state === 'published') &&
      fact.eligible &&
      fact.qualifiedAt &&
      inWindow(fact.qualifiedAt, windowStarts, windowEnds)
    ) {
      approvedQuestionCount.set(
        fact.studentId,
        (approvedQuestionCount.get(fact.studentId) ?? 0) + 1,
      );
    }
  }
  const streak = new Map(
    learners.map((learner) => [
      learner.studentId,
      currentStreak(
        visibleWindowAttendance.filter((row) => row.studentId === learner.studentId),
        (input.scheduledOccurrenceCoverage ?? []).filter(
          (occurrence) =>
            occurrence.studentId === learner.studentId &&
            occurrence.classId === input.classId &&
            occurrence.identityBindingVerified === true &&
            occurrence.enrollmentId === learner.enrollmentId &&
            sameScope(input.actor, occurrence) &&
            inWindow(occurrence.occurredAt, windowStarts, windowEnds),
        ),
      ),
    ]),
  );
  const labels = leaderboardLabels(viewer, learners, consents, input.aliasHmacKey);
  const label = (learner: CanonicalLearnerIdentity) =>
    labels.get(learner.studentId) ?? 'Anonymous Student';
  const entry = (learner: CanonicalLearnerIdentity) =>
    opaqueKey('entry', input.aliasHmacKey, learner);
  return {
    ...scopeOf(input.actor),
    classId: input.classId,
    windowStartsAt: windowStarts.toISOString(),
    windowEndsAt: windowEnds.toISOString(),
    categories: {
      attendanceCount: rank(learners, attendanceCount, label, entry),
      currentAttendanceStreak: rank(learners, streak, label, entry),
      approvedQuestionCount: rank(learners, approvedQuestionCount, label, entry),
    },
    combinedScore: null,
    public: false,
  };
}

export function assertPeerMessagingUnavailable(): never {
  throw new LearningError(
    LEARNING_ERROR_CODES.peerMessagingUnavailable,
    'Student-to-student messaging is not a learning feature.',
  );
}

function transitionEntry(
  question: LearningQuestion,
  command: {
    actor: LearningActor;
    idempotencyKey: string;
    requestHash: string;
    auditRef: string;
    occurredAt: string;
  },
  source: QuestionTransitionLedgerEntry['source'],
  from: QuestionState | null,
  to: QuestionState,
  reason: string | null,
): QuestionTransitionLedgerEntry {
  return {
    ...scopeOf(question),
    eventId: `${command.idempotencyKey}:transition`,
    questionId: question.id,
    studentId: question.studentId,
    householdId: question.householdId,
    classId: question.classId,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    actorId: command.actor.principalId,
    source,
    auditRef: command.auditRef,
    from,
    to,
    reason,
    occurredAt: command.occurredAt,
  };
}

function recognitionEntry(
  question: LearningQuestion,
  command: CorrectQuestionRecognitionCommand | TransitionQuestionCommand,
  sequence: number,
  source: QuestionRecognitionLedgerEntry['source'],
  action: QuestionRecognitionLedgerEntry['action'],
  eligible: boolean,
  reason: string | null,
): QuestionRecognitionLedgerEntry {
  return {
    ...scopeOf(question),
    eventId: `${command.idempotencyKey}:recognition`,
    questionId: question.id,
    studentId: question.studentId,
    householdId: question.householdId,
    classId: question.classId,
    sequence,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    actorId: command.actor.principalId,
    source,
    auditRef: command.auditRef,
    action,
    eligible,
    reason,
    occurredAt: command.occurredAt,
  };
}

function isReplay(entries: readonly QuestionTransitionLedgerEntry[], key: string, hash: string) {
  const existing = entries.find((entry) => entry.idempotencyKey === key);
  if (!existing) return false;
  if (existing.requestHash !== hash) {
    throw new LearningError(
      LEARNING_ERROR_CODES.conflict,
      'This scoped idempotency key was used with a different request hash.',
    );
  }
  return true;
}

function nextRecognitionSequence(entries: readonly QuestionRecognitionLedgerEntry[]) {
  return Math.max(0, ...entries.map((entry) => entry.sequence)) + 1;
}

function latestConsent(events: readonly CanonicalRecognitionConsent[]) {
  const result = new Map<string, CanonicalRecognitionConsent>();
  for (const event of [...events].sort(compareOccurred).reverse()) {
    result.set(event.studentId, event);
  }
  return result;
}

function leaderboardLabels(
  actor: Extract<LearningActor, { role: 'admin' | 'student' }>,
  learners: readonly CanonicalLearnerIdentity[],
  consents: ReadonlyMap<string, CanonicalRecognitionConsent>,
  key: string,
) {
  const aliases = new Map(
    learners.map((learner) => [learner.studentId, opaqueKey('alias', key, learner)] as const),
  );
  return new Map(
    learners.map((learner) => {
      if (actor.role === 'admin') return [learner.studentId, learner.actualName] as const;
      if (actor.studentId === learner.studentId) return [learner.studentId, 'You'] as const;
      if (consents.get(learner.studentId)?.choice === 'granted' && learner.displayName !== null) {
        return [learner.studentId, learner.displayName] as const;
      }
      const hash = aliases.get(learner.studentId)!;
      let length = 8;
      while (
        length < hash.length &&
        [...aliases.entries()].some(
          ([studentId, other]) =>
            studentId !== learner.studentId && other.slice(0, length) === hash.slice(0, length),
        )
      ) {
        length += 1;
      }
      const exactCollisions = [...aliases.entries()]
        .filter(([, other]) => other === hash)
        .map(([studentId]) => studentId)
        .sort();
      const collisionIndex = exactCollisions.indexOf(learner.studentId);
      const disambiguator = exactCollisions.length > 1 ? `-${String(collisionIndex + 1)}` : '';
      return [
        learner.studentId,
        `Anonymous Student - ${hash.slice(0, length).toUpperCase()}${disambiguator}`,
      ] as const;
    }),
  );
  /*
  if (actor.role === 'admin') return learner.actualName;
  if (actor.studentId === learner.studentId) return 'You';
  if (consent?.choice === 'granted' && learner.displayName !== null) return learner.displayName;
  return `Anonymous Student • ${opaqueKey('alias', key, learner).slice(0, 8).toUpperCase()}`;
  */
}

function opaqueKey(domain: 'alias' | 'entry', key: string, learner: CanonicalLearnerIdentity) {
  const values = [
    learner.accountKey,
    learner.productKey,
    learner.runtimeTier,
    learner.verificationEnvironmentId,
    learner.classId,
    learner.studentId,
  ];
  const encoded = values.map((value) => `${Buffer.byteLength(value, 'utf8')}:${value}`).join('|');
  return createHmac('sha256', key).update(`${domain}|${encoded}`, 'utf8').digest('hex');
}

function rank(
  learners: readonly CanonicalLearnerIdentity[],
  values: ReadonlyMap<string, number>,
  label: (learner: CanonicalLearnerIdentity) => string,
  entryKey: (learner: CanonicalLearnerIdentity) => string,
): readonly LeaderboardEntry[] {
  const sorted = learners
    .map((learner) => ({ learner, value: values.get(learner.studentId) ?? 0 }))
    .sort(
      (left, right) =>
        right.value - left.value || left.learner.studentId.localeCompare(right.learner.studentId),
    );
  let previousValue: number | null = null;
  let previousRank = 0;
  return sorted.map(({ learner, value }, index) => {
    const rank = previousValue === value ? previousRank : index + 1;
    previousValue = value;
    previousRank = rank;
    const opaque = entryKey(learner);
    return { rank, entryKey: opaque, studentId: opaque, displayName: label(learner), value };
  });
}

function currentStreak(
  records: readonly AttendanceRecord[],
  scheduledOccurrences: readonly { occurrenceId: string; occurredAt: string }[],
) {
  if (scheduledOccurrences.length === 0) return 0;
  const attendanceByOccurrence = new Map(
    records.map((record) => [record.occurrenceId, record.present] as const),
  );
  let streak = 0;
  for (const occurrence of [...scheduledOccurrences].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  )) {
    if (attendanceByOccurrence.get(occurrence.occurrenceId) !== true) break;
    streak += 1;
  }
  return streak;
}

function awards(
  family: LearningBadgeAward['family'],
  count: number,
  thresholds: readonly [number, number, number],
  sourceKeys: readonly string[],
): readonly LearningBadgeAward[] {
  return thresholds.flatMap((threshold, index) =>
    count >= threshold
      ? [
          {
            key: `${family}:${(index + 1) as 1 | 2 | 3}` as const,
            family,
            level: (['I', 'II', 'III'] as const)[index] ?? 'I',
            threshold,
            qualifyingCount: count,
            sourceKeys,
          },
        ]
      : [],
  );
}

function validAudience(value: unknown): value is AnnouncementAudience {
  if (!value || typeof value !== 'object') return false;
  const audience = value as Record<string, unknown>;
  if (audience.kind === 'program') return Object.keys(audience).length === 1;
  if (audience.kind === 'class') return typeof audience.classId === 'string';
  if (audience.kind === 'parent')
    return typeof audience.classId === 'string' && typeof audience.householdId === 'string';
  if (audience.kind === 'student')
    return typeof audience.classId === 'string' && typeof audience.studentId === 'string';
  return false;
}

function audienceMatches(actor: LearningActor, audience: AnnouncementAudience) {
  if (actor.role === 'admin') {
    return audience.kind === 'program' || actor.classIds.includes(audience.classId);
  }
  switch (audience.kind) {
    case 'program':
      return true;
    case 'class':
      return actor.classIds.includes(audience.classId);
    case 'student':
      return (
        actor.role === 'student' &&
        actor.studentId === audience.studentId &&
        actor.classIds.includes(audience.classId)
      );
    case 'parent':
      return (
        actor.role === 'parent' &&
        actor.householdIds.includes(audience.householdId) &&
        actor.classIds.includes(audience.classId)
      );
    default:
      return false;
  }
}

function canonicalAttendanceMatches(scope: LearningScope, record: AttendanceRecord) {
  return (
    record.identityBindingVerified === true &&
    record.enrollmentId.length > 0 &&
    record.studentId.length > 0 &&
    record.classId.length > 0 &&
    sameScope(scope, record)
  );
}

function requireAdmin(actor: LearningActor, record: LearningScope & { classId: string }) {
  if (
    actor.role !== 'admin' ||
    !sameScope(actor, record) ||
    !actor.classIds.includes(record.classId)
  ) {
    denied('Admin learning authority requires assignment to this class.');
  }
}

function sameScope(left: LearningScope, right: LearningScope) {
  return (
    left.accountKey === right.accountKey &&
    left.productKey === right.productKey &&
    left.runtimeTier === right.runtimeTier &&
    left.verificationEnvironmentId === right.verificationEnvironmentId
  );
}

function scopeOf(value: LearningScope): LearningScope {
  return {
    accountKey: value.accountKey,
    productKey: value.productKey,
    runtimeTier: value.runtimeTier,
    verificationEnvironmentId: value.verificationEnvironmentId,
  };
}

function compareOccurred(
  left: { occurredAt: string; [key: string]: unknown },
  right: { occurredAt: string; [key: string]: unknown },
) {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    JSON.stringify(right).localeCompare(JSON.stringify(left))
  );
}

function inWindow(value: string, start: Date, end: Date) {
  const instant = Date.parse(value);
  return instant >= start.getTime() && instant <= end.getTime();
}

function requiredText(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    invalid(`${label} must contain 1 to ${maximum} characters.`);
  }
  return normalized;
}

function invalid(message: string): never {
  throw new LearningError(LEARNING_ERROR_CODES.invalidTransition, message);
}

function stale(): never {
  throw new LearningError(LEARNING_ERROR_CODES.staleVersion, 'Reload the question and retry.');
}

function denied(message: string): never {
  throw new LearningError(LEARNING_ERROR_CODES.accessDenied, message);
}
