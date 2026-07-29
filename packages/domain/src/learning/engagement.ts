import { createHmac } from 'node:crypto';
import type {
  AnnouncementAudience,
  AttendanceRecord,
  AttendanceSegment,
  CorrectQuestionRecognitionCommand,
  LeaderboardEntry,
  LeaderboardLearner,
  LearningActor,
  LearningAnnouncement,
  LearningBadgeAward,
  LearningLeaderboard,
  LearningQuestion,
  LearningScope,
  PublishedClassQuestion,
  QuestionState,
  RecognitionConsent,
  ReviewCompletion,
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

const QUALIFYING_QUESTION_STATES = new Set<QuestionState>([
  'answered_private',
  'approved_for_class',
  'published',
]);

export function submitQuestion(command: SubmitQuestionCommand): {
  question: LearningQuestion;
  effects: typeof NO_LEARNING_EXTERNAL_EFFECTS;
} {
  if (command.actor.role !== 'student' || !command.actor.classIds.includes(command.classId)) {
    denied('Only the enrolled Student may submit a private class question.');
  }
  const body = command.body.trim();
  if (body.length < 2 || body.length > 4_000) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'Question text must contain 2 to 4,000 characters.',
    );
  }
  return {
    question: {
      accountKey: command.actor.accountKey,
      productKey: command.actor.productKey,
      id: command.id,
      studentId: command.actor.studentId,
      householdId: command.actor.householdId,
      classId: command.classId,
      body,
      answer: null,
      state: 'submitted',
      recognitionEligible: false,
      recognitionOccurredAt: null,
      recognitionCorrectionReason: null,
      version: 1,
      submittedAt: command.occurredAt,
      updatedAt: command.occurredAt,
      transitions: [],
    },
    effects: NO_LEARNING_EXTERNAL_EFFECTS,
  };
}

export function transitionQuestion(
  current: LearningQuestion,
  command: TransitionQuestionCommand,
): { question: LearningQuestion; replay: boolean; effects: typeof NO_LEARNING_EXTERNAL_EFFECTS } {
  requireAdmin(command.actor, current);
  const replay = findReplay(current, command.idempotencyKey, command.requestHash);
  if (replay) return { question: current, replay: true, effects: NO_LEARNING_EXTERNAL_EFFECTS };
  if (current.version !== command.expectedVersion) {
    throw new LearningError(LEARNING_ERROR_CODES.staleVersion, 'Reload the question and retry.');
  }
  if (!QUESTION_TRANSITIONS[current.state].includes(command.to)) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      `Question cannot transition from ${current.state} to ${command.to}.`,
    );
  }
  const answer = command.answer?.trim();
  if (command.to === 'answered_private' && !answer && !current.answer) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'A private answer is required for answered_private.',
    );
  }
  const firstQualification =
    !current.recognitionEligible && QUALIFYING_QUESTION_STATES.has(command.to);
  return {
    question: {
      ...current,
      state: command.to,
      answer: answer || current.answer,
      recognitionEligible: firstQualification || current.recognitionEligible,
      recognitionOccurredAt: firstQualification
        ? command.occurredAt
        : current.recognitionOccurredAt,
      recognitionCorrectionReason: firstQualification ? null : current.recognitionCorrectionReason,
      version: current.version + 1,
      updatedAt: command.occurredAt,
      transitions: [
        ...current.transitions,
        {
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          actorId: command.actor.principalId,
          from: current.state,
          to: command.to,
          reason: command.reason?.trim() || null,
          occurredAt: command.occurredAt,
        },
      ],
    },
    replay: false,
    effects: NO_LEARNING_EXTERNAL_EFFECTS,
  };
}

export function correctQuestionRecognition(
  current: LearningQuestion,
  command: CorrectQuestionRecognitionCommand,
): { question: LearningQuestion; replay: boolean } {
  requireAdmin(command.actor, current);
  const replay = findReplay(current, command.idempotencyKey, command.requestHash);
  if (replay) return { question: current, replay: true };
  if (current.version !== command.expectedVersion) {
    throw new LearningError(LEARNING_ERROR_CODES.staleVersion, 'Reload the question and retry.');
  }
  if (command.reason.trim().length < 3) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'An audited correction reason is required.',
    );
  }
  return {
    question: {
      ...current,
      recognitionEligible: command.eligible,
      recognitionOccurredAt: command.eligible
        ? (current.recognitionOccurredAt ?? command.occurredAt)
        : null,
      recognitionCorrectionReason: command.reason.trim(),
      version: current.version + 1,
      updatedAt: command.occurredAt,
      transitions: [
        ...current.transitions,
        {
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          actorId: command.actor.principalId,
          from: current.state,
          to: current.state,
          reason: `recognition:${command.eligible ? 'restore' : 'remove'}:${command.reason.trim()}`,
          occurredAt: command.occurredAt,
        },
      ],
    },
    replay: false,
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
  questions: readonly LearningQuestion[],
  classId: string,
): readonly PublishedClassQuestion[] {
  if ((actor.role !== 'student' && actor.role !== 'admin') || !actor.classIds.includes(classId)) {
    denied('Published questions require assignment to the requested class.');
  }
  return questions
    .filter(
      (question) =>
        sameScope(actor, question) &&
        question.classId === classId &&
        question.state === 'published',
    )
    .map((question) => ({
      questionId: question.id,
      classId: question.classId,
      question: question.body,
      answer: question.answer,
      publishedAt:
        [...question.transitions].reverse().find((transition) => transition.to === 'published')
          ?.occurredAt ?? question.updatedAt,
    }));
}

export function mergeAttendance(
  current: AttendanceRecord | null,
  segment: AttendanceSegment,
): AttendanceRecord {
  if (segment.minutes < 0 || !Number.isInteger(segment.minutes)) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'Attendance minutes must be a nonnegative integer.',
    );
  }
  if (!current) {
    return {
      ...scopeOf(segment),
      occurrenceId: segment.occurrenceId,
      classId: segment.classId,
      studentId: segment.studentId,
      householdId: segment.householdId,
      segmentIds: [segment.segmentId],
      minutes: segment.minutes,
      present: segment.minutes > 0,
      occurredAt: segment.occurredAt,
      correctedAt: null,
      correctionReason: null,
      correctedBy: null,
    };
  }
  assertSameStudent(current, segment);
  if (current.segmentIds.includes(segment.segmentId)) return current;
  return {
    ...current,
    segmentIds: [...current.segmentIds, segment.segmentId],
    minutes: current.minutes + segment.minutes,
    present: current.present || segment.minutes > 0,
  };
}

export function correctAttendance(
  actor: LearningActor,
  current: AttendanceRecord,
  correction: { minutes: number; present: boolean; reason: string; occurredAt: string },
): AttendanceRecord {
  requireAdmin(actor, current);
  if (!Number.isInteger(correction.minutes) || correction.minutes < 0) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'Corrected minutes must be a nonnegative integer.',
    );
  }
  if (correction.reason.trim().length < 3) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      'Manual attendance corrections require an audit reason.',
    );
  }
  return {
    ...current,
    minutes: correction.minutes,
    present: correction.present,
    correctedAt: correction.occurredAt,
    correctionReason: correction.reason.trim(),
    correctedBy: actor.principalId,
  };
}

export function attendanceVisibleTo(
  actor: LearningActor,
  records: readonly AttendanceRecord[],
): readonly AttendanceRecord[] {
  const scoped = records.filter((record) => sameScope(actor, record));
  if (actor.role === 'admin') {
    return scoped.filter((record) => actor.classIds.includes(record.classId));
  }
  if (actor.role === 'student') {
    return scoped.filter((record) => record.studentId === actor.studentId);
  }
  return scoped.filter((record) => actor.householdIds.includes(record.householdId));
}

export function calculateBadges(input: {
  studentId: string;
  scheduledOccurrenceIds: readonly string[];
  attendance: readonly AttendanceRecord[];
  questions: readonly LearningQuestion[];
  reviews: readonly ReviewCompletion[];
}): readonly LearningBadgeAward[] {
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
      input.questions
        .filter(
          (question) => question.studentId === input.studentId && question.recognitionEligible,
        )
        .map((question) => question.id),
    ),
  ];
  const reviewIds = [
    ...new Set(
      input.reviews
        .filter((review) => review.studentId === input.studentId && review.adminPublished)
        .map((review) => review.reviewItemId),
    ),
  ];
  return [
    ...awards('consistency', streak, [5, 20, 60], input.scheduledOccurrenceIds.slice(-streak)),
    ...awards('curious_learner', questionIds.length, [1, 5, 15], questionIds),
    ...awards('review_ready', reviewIds.length, [1, 4, 12], reviewIds),
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
  validateAudience(input.actor, input.audience);
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

export function announcementsVisibleTo(
  actor: LearningActor,
  announcements: readonly LearningAnnouncement[],
  at: string,
): readonly LearningAnnouncement[] {
  const now = Date.parse(at);
  return announcements.filter(
    (announcement) =>
      sameScope(actor, announcement) &&
      (!announcement.expiresAt || Date.parse(announcement.expiresAt) > now) &&
      audienceMatches(actor, announcement.audience),
  );
}

export function buildLeaderboard(input: {
  actor: LearningActor;
  classId: string;
  learners: readonly LeaderboardLearner[];
  attendance: readonly AttendanceRecord[];
  questions: readonly LearningQuestion[];
  consents: readonly RecognitionConsent[];
  asOf: string;
  aliasSecret: string;
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
    (learner) =>
      sameScope(input.actor, learner) &&
      learner.classId === input.classId &&
      learner.classId === input.classId,
  );
  const consentByStudent = new Map(
    input.consents
      .filter((consent) => sameScope(input.actor, consent))
      .map((consent) => [consent.studentId, consent.optedIn]),
  );
  const attendanceCount = new Map<string, number>();
  for (const record of input.attendance) {
    if (
      sameScope(input.actor, record) &&
      record.classId === input.classId &&
      record.present &&
      inWindow(record.occurredAt, windowStarts, windowEnds)
    ) {
      attendanceCount.set(record.studentId, (attendanceCount.get(record.studentId) ?? 0) + 1);
    }
  }
  const approvedQuestionCount = new Map<string, number>();
  for (const question of input.questions) {
    if (
      sameScope(input.actor, question) &&
      question.classId === input.classId &&
      question.recognitionEligible &&
      (question.state === 'approved_for_class' || question.state === 'published') &&
      question.recognitionOccurredAt &&
      inWindow(question.recognitionOccurredAt, windowStarts, windowEnds)
    ) {
      approvedQuestionCount.set(
        question.studentId,
        (approvedQuestionCount.get(question.studentId) ?? 0) + 1,
      );
    }
  }
  const name = (learner: LeaderboardLearner) =>
    leaderboardName({
      actor: viewer,
      learner,
      recognitionOptedIn: consentByStudent.get(learner.studentId) ?? false,
      aliasSecret: input.aliasSecret,
    });
  return {
    ...scopeOf(input.actor),
    classId: input.classId,
    windowStartsAt: windowStarts.toISOString(),
    windowEndsAt: windowEnds.toISOString(),
    categories: {
      attendanceCount: rank(learners, attendanceCount, name),
      currentAttendanceStreak: rank(
        learners,
        new Map(learners.map((learner) => [learner.studentId, learner.currentAttendanceStreak])),
        name,
      ),
      approvedQuestionCount: rank(learners, approvedQuestionCount, name),
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

function leaderboardName(input: {
  actor: Extract<LearningActor, { role: 'admin' | 'student' }>;
  learner: LeaderboardLearner;
  recognitionOptedIn: boolean;
  aliasSecret: string;
}) {
  if (input.actor.role === 'admin') {
    return `${input.learner.firstName} ${input.learner.lastName}`.trim();
  }
  if (input.actor.studentId === input.learner.studentId) return 'You';
  if (input.recognitionOptedIn) {
    const initial = [...input.learner.lastName.trim()][0];
    return `${input.learner.firstName.trim()}${initial ? ` ${initial}.` : ''}`;
  }
  const token = createHmac('sha256', input.aliasSecret)
    .update(
      `${input.learner.accountKey}:${input.learner.productKey}:${input.learner.classId}:${input.learner.studentId}`,
    )
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  return `Anonymous Student • ${token}`;
}

function rank(
  learners: readonly LeaderboardLearner[],
  values: ReadonlyMap<string, number>,
  name: (learner: LeaderboardLearner) => string,
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
    const entryRank = previousValue === value ? previousRank : index + 1;
    previousValue = value;
    previousRank = entryRank;
    return { rank: entryRank, studentId: learner.studentId, displayName: name(learner), value };
  });
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

function findReplay(current: LearningQuestion, key: string, hash: string) {
  const existing = current.transitions.find((transition) => transition.idempotencyKey === key);
  if (!existing) return false;
  if (existing.requestHash !== hash) {
    throw new LearningError(
      LEARNING_ERROR_CODES.conflict,
      'This idempotency key was already used for a different question change.',
    );
  }
  return true;
}

function validateAudience(
  actor: Extract<LearningActor, { role: 'admin' }>,
  audience: AnnouncementAudience,
) {
  if (audience.kind === 'class' && !actor.classIds.includes(audience.classId)) {
    denied('The Admin is not assigned to the announcement class.');
  }
}

function audienceMatches(actor: LearningActor, audience: AnnouncementAudience) {
  if (actor.role === 'admin') return true;
  if (audience.kind === 'program') return true;
  if (audience.kind === 'class') return actor.classIds.includes(audience.classId);
  if (audience.kind === 'student')
    return actor.role === 'student' && actor.studentId === audience.studentId;
  return actor.role === 'parent' && actor.householdIds.includes(audience.householdId);
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

function assertSameStudent(current: AttendanceRecord, segment: AttendanceSegment) {
  if (
    !sameScope(current, segment) ||
    current.occurrenceId !== segment.occurrenceId ||
    current.studentId !== segment.studentId ||
    current.householdId !== segment.householdId ||
    current.classId !== segment.classId
  ) {
    denied('Attendance reconnect segments must remain within one Student occurrence.');
  }
}

function sameScope(left: LearningScope, right: LearningScope) {
  return left.accountKey === right.accountKey && left.productKey === right.productKey;
}

function scopeOf(value: LearningScope): LearningScope {
  return { accountKey: value.accountKey, productKey: value.productKey };
}

function inWindow(value: string, start: Date, end: Date) {
  const instant = Date.parse(value);
  return instant >= start.getTime() && instant <= end.getTime();
}

function requiredText(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new LearningError(
      LEARNING_ERROR_CODES.invalidTransition,
      `${label} must contain 1 to ${maximum} characters.`,
    );
  }
  return normalized;
}

function denied(message: string): never {
  throw new LearningError(LEARNING_ERROR_CODES.accessDenied, message);
}
