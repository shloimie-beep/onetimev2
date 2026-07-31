export const LEARNING_ENGAGEMENT_CONTRACT_VERSION = '2.1.2' as const;
export const LEARNING_ROLLING_WINDOW_DAYS = 30 as const;

export type LearningScope = {
  accountKey: string;
  productKey: string;
  runtimeTier: string;
  verificationEnvironmentId: string;
};

type LearningPrincipal = LearningScope & {
  principalId: string;
  classIds: readonly string[];
};

export type LearningActor =
  | (LearningPrincipal & { role: 'admin' })
  | (LearningPrincipal & { role: 'parent'; householdIds: readonly string[] })
  | (LearningPrincipal & {
      role: 'student';
      studentId: string;
      householdId: string;
    });

export type QuestionState =
  'submitted' | 'answered_private' | 'approved_for_class' | 'published' | 'closed' | 'declined';

export type LearningQuestion = LearningScope & {
  id: string;
  studentId: string;
  householdId: string;
  classId: string;
  body: string;
  answer: string | null;
  state: QuestionState;
  version: number;
  submittedAt: string;
  updatedAt: string;
};

export type QuestionTransitionLedgerEntry = LearningScope & {
  eventId: string;
  questionId: string;
  studentId: string;
  householdId: string;
  classId: string;
  idempotencyKey: string;
  requestHash: string;
  actorId: string;
  source: 'authenticated_student_submit' | 'admin_transition' | 'admin_correction';
  auditRef: string;
  from: QuestionState | null;
  to: QuestionState;
  reason: string | null;
  occurredAt: string;
};

export type QuestionRecognitionLedgerEntry = LearningScope & {
  eventId: string;
  questionId: string;
  studentId: string;
  householdId: string;
  classId: string;
  sequence: number;
  idempotencyKey: string;
  requestHash: string;
  actorId: string;
  source: 'admin_transition' | 'admin_correction';
  auditRef: string;
  action: 'qualified' | 'correction_enabled' | 'correction_disabled';
  eligible: boolean;
  reason: string | null;
  occurredAt: string;
};

export type QuestionHistory = {
  transitions: readonly QuestionTransitionLedgerEntry[];
  recognitions: readonly QuestionRecognitionLedgerEntry[];
};

export type QuestionMutation = {
  projection: LearningQuestion;
  expectedVersion: number;
  transition: QuestionTransitionLedgerEntry;
  recognition: QuestionRecognitionLedgerEntry | null;
};

export type QuestionMutationResult = {
  question: LearningQuestion;
  replay: boolean;
};

export type PublishedClassQuestion = {
  questionId: string;
  classId: string;
  question: string;
  answer: string | null;
  authorDisplayName: string;
  authorEntryKey: string;
  publishedAt: string;
};

export type PublishedQuestionRecord = LearningScope & {
  questionId: string;
  studentId: string;
  classId: string;
  question: string;
  answer: string | null;
  publishedAt: string;
};

export type QuestionRecognitionFact = LearningScope & {
  questionId: string;
  studentId: string;
  householdId: string;
  classId: string;
  state: QuestionState;
  eligible: boolean;
  qualifiedAt: string | null;
  latestSequence: number | null;
  latestSource: QuestionRecognitionLedgerEntry['source'] | null;
  latestAuditRef: string | null;
  latestReason: string | null;
  latestActorId: string | null;
};

export type SubmitQuestionCommand = {
  actor: LearningActor;
  id: string;
  classId: string;
  body: string;
  idempotencyKey: string;
  requestHash: string;
  auditRef: string;
  occurredAt: string;
};

export type TransitionQuestionCommand = {
  actor: LearningActor;
  questionId: string;
  to: Exclude<QuestionState, 'submitted'>;
  answer?: string;
  reason?: string;
  expectedVersion: number;
  idempotencyKey: string;
  requestHash: string;
  auditRef: string;
  occurredAt: string;
};

export type CorrectQuestionRecognitionCommand = {
  actor: LearningActor;
  questionId: string;
  eligible: boolean;
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
  requestHash: string;
  auditRef: string;
  occurredAt: string;
};

export type AnnouncementAudience =
  | { kind: 'program' }
  | { kind: 'class'; classId: string }
  | { kind: 'parent'; classId: string; householdId: string }
  | { kind: 'student'; classId: string; studentId: string };

export type LearningAnnouncement = LearningScope & {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  publishedBy: string;
  publishedAt: string;
  expiresAt: string | null;
};

export type AnnouncementRead = LearningScope & {
  announcementId: string;
  principalId: string;
  readAt: string;
};

/**
 * Read-only compatibility projection of P18 migration 2251. P22 owns no
 * attendance table, writer, correction command, or attendance event.
 */
export type AttendanceRecord = LearningScope & {
  occurrenceId: string;
  classId: string;
  studentId: string;
  householdId: string;
  enrollmentId: string;
  identityBindingVerified: true;
  segmentIds: readonly string[];
  minutes: number;
  present: boolean;
  occurredAt: string;
  correctedAt: string | null;
  correctionReason: string | null;
  correctedBy: string | null;
  correctionAuditRef: string | null;
  correctionSourceDigest: string | null;
};

export type ScheduledOccurrenceCoverage = LearningScope & {
  occurrenceId: string;
  classId: string;
  studentId: string;
  enrollmentId: string;
  identityBindingVerified: true;
  occurredAt: string;
};

export type ReviewCompletion = LearningScope & {
  eventId: string;
  reviewItemId: string;
  classId: string;
  studentId: string;
  householdId: string;
  adminPublished: boolean;
  action: 'completed' | 'revoked' | 'restored';
  sequence: number;
  idempotencyKey: string;
  requestHash: string;
  completedBy: string;
  source: 'authenticated_submit' | 'authenticated_mark_complete' | 'admin_correction';
  reason: string | null;
  auditRef: string;
  publicationAuditRef: string;
  completedAt: string;
};

export type RecordReviewCompletionCommand = {
  actor: LearningActor;
  reviewItemId: string;
  classId: string;
  source: 'authenticated_submit' | 'authenticated_mark_complete';
  auditRef: string;
  idempotencyKey: string;
  requestHash: string;
  completedAt: string;
};

export type ReviewCompletionMutationResult = {
  completion: ReviewCompletion;
  replay: boolean;
};

export type CorrectReviewCompletionCommand = {
  actor: LearningActor;
  reviewItemId: string;
  classId: string;
  studentId: string;
  householdId: string;
  action: 'revoked' | 'restored';
  reason: string;
  auditRef: string;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
};

export type BadgeFamily = 'consistency' | 'curious_learner' | 'review_ready';
export type BadgeLevel = 'I' | 'II' | 'III';

export type LearningBadgeAward = {
  key: `${BadgeFamily}:${1 | 2 | 3}`;
  family: BadgeFamily;
  level: BadgeLevel;
  threshold: number;
  qualifyingCount: number;
  sourceKeys: readonly string[];
};

export type LearningBadgeAwardProjection = LearningScope &
  LearningBadgeAward & {
    studentId: string;
    classId: string;
    sourceDigest: string;
    version: number;
    state: 'unawarded' | 'awarded' | 'revoked';
    ruleVersion: string;
    sourceAuditRefs: readonly string[];
    awardedAt: string | null;
    revokedAt: string | null;
    recalculatedAt: string;
    correctionAuditRef: string | null;
    correctionReason: string | null;
    correctedByAdminId: string | null;
  };

export type BadgeProjectionRecalculation = {
  scope: LearningScope;
  studentId: string;
  classId: string;
  sourceDigest: string;
  familySourceDigests: Readonly<Record<BadgeFamily, string>>;
  ruleVersion: string;
  sourceAuditRefs: readonly string[];
  familySourceAuditRefs: Readonly<Record<BadgeFamily, readonly string[]>>;
  progress: Readonly<
    Record<BadgeFamily, { qualifyingCount: number; sourceKeys: readonly string[] }>
  >;
  awards: readonly LearningBadgeAward[];
  recalculatedAt: string;
  correctionAuditRef: string | null;
  correctionReason: string | null;
  correctedByAdminId: string | null;
  correctionFamily: BadgeFamily | null;
  allowRevocation: boolean;
};

export type CanonicalRecognitionConsent = LearningScope & {
  consentEventId: string;
  studentId: string;
  choice: 'granted' | 'declined' | 'withdrawn';
  occurredAt: string;
};

export type CanonicalLearnerIdentity = LearningScope & {
  studentId: string;
  householdId: string;
  classId: string;
  enrollmentId: string;
  actualName: string;
  displayName: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  entryKey: string;
  /** Compatibility key for the existing client; this is never a canonical Student ID. */
  studentId: string;
  displayName: string;
  value: number;
};

export type LearningLeaderboard = LearningScope & {
  classId: string;
  windowStartsAt: string;
  windowEndsAt: string;
  categories: {
    attendanceCount: readonly LeaderboardEntry[];
    currentAttendanceStreak: readonly LeaderboardEntry[];
    approvedQuestionCount: readonly LeaderboardEntry[];
  };
  combinedScore: never | null;
  public: false;
};

export const NO_LEARNING_EXTERNAL_EFFECTS = {
  createStudentGhlContact: false,
  publishPublicLeaderboard: false,
  createRedeemableReward: false,
  sendPeerMessage: false,
  externalEffects: 0,
} as const;

export const LEARNING_ERROR_CODES = {
  accessDenied: 'learning_access_denied',
  conflict: 'learning_idempotency_conflict',
  invalidTransition: 'learning_invalid_transition',
  notFound: 'learning_not_found',
  parentQuestionDenied: 'learning_parent_question_denied',
  peerMessagingUnavailable: 'learning_peer_messaging_unavailable',
  staleVersion: 'learning_stale_version',
} as const;

export interface LearningEngagementRepository {
  getQuestion(
    scope: LearningScope,
    questionId: string,
    authorizedClassIds: readonly string[],
  ): Promise<LearningQuestion | null>;
  getQuestionHistory(scope: LearningScope, questionId: string): Promise<QuestionHistory>;
  applyQuestionMutation(mutation: QuestionMutation): Promise<QuestionMutationResult>;
  applyReviewCompletion(completion: ReviewCompletion): Promise<ReviewCompletionMutationResult>;
  applyBadgeRecalculation(
    recalculation: BadgeProjectionRecalculation,
  ): Promise<{ awards: readonly LearningBadgeAwardProjection[]; replay: boolean }>;
  listReviewCompletionEvents(
    scope: LearningScope,
    reviewItemId: string,
    studentId: string,
  ): Promise<readonly ReviewCompletion[]>;
  listQuestions(
    scope: LearningScope,
    authorizedClassIds: readonly string[],
    studentId?: string,
  ): Promise<readonly LearningQuestion[]>;
  listPublishedQuestionRecords(
    scope: LearningScope,
    classId: string,
  ): Promise<readonly PublishedQuestionRecord[]>;
  listQuestionRecognitionFacts(
    scope: LearningScope,
    classId: string,
    studentId?: string,
  ): Promise<readonly QuestionRecognitionFact[]>;
  listQuestionTransitions(scope: LearningScope): Promise<readonly QuestionTransitionLedgerEntry[]>;
  listQuestionRecognitions(
    scope: LearningScope,
  ): Promise<readonly QuestionRecognitionLedgerEntry[]>;
  saveAnnouncement(announcement: LearningAnnouncement): Promise<void>;
  listAnnouncements(scope: LearningScope): Promise<readonly LearningAnnouncement[]>;
  saveAnnouncementRead(read: AnnouncementRead): Promise<void>;
  listAnnouncementReads(
    scope: LearningScope,
    principalId: string,
  ): Promise<readonly AnnouncementRead[]>;
  listReviewCompletions(scope: LearningScope): Promise<readonly ReviewCompletion[]>;
}

export interface LearningAttendanceReadPort {
  listAttendance(scope: LearningScope): Promise<readonly AttendanceRecord[]>;
  listScheduledOccurrenceCoverage(
    scope: LearningScope,
    classId: string,
    windowStartsAt: string,
    windowEndsAt: string,
  ): Promise<readonly ScheduledOccurrenceCoverage[]>;
}

export interface LearningIdentityReadPort {
  listLearners(scope: LearningScope, classId: string): Promise<readonly CanonicalLearnerIdentity[]>;
}

export interface LearningRecognitionConsentReadPort {
  listRecognitionConsent(
    scope: LearningScope,
    classId: string,
  ): Promise<readonly CanonicalRecognitionConsent[]>;
}

export interface LearningReviewItemReadPort {
  getAdminPublishedReviewItem(
    scope: LearningScope,
    reviewItemId: string,
  ): Promise<
    | (LearningScope & {
        reviewItemId: string;
        classId: string;
        publicationAuditRef: string;
      })
    | null
  >;
}
