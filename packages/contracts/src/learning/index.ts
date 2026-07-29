export const LEARNING_ENGAGEMENT_CONTRACT_VERSION = '2.1.0' as const;
export const LEARNING_ROLLING_WINDOW_DAYS = 30 as const;

export type LearningScope = {
  accountKey: string;
  productKey: string;
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

export type QuestionTransitionAudit = {
  idempotencyKey: string;
  requestHash: string;
  actorId: string;
  from: QuestionState;
  to: QuestionState;
  reason: string | null;
  occurredAt: string;
};

export type LearningQuestion = LearningScope & {
  id: string;
  studentId: string;
  householdId: string;
  classId: string;
  body: string;
  answer: string | null;
  state: QuestionState;
  recognitionEligible: boolean;
  recognitionOccurredAt: string | null;
  recognitionCorrectionReason: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
  transitions: readonly QuestionTransitionAudit[];
};

export type SubmitQuestionCommand = {
  actor: LearningActor;
  id: string;
  classId: string;
  body: string;
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
  occurredAt: string;
};

export type AnnouncementAudience =
  | { kind: 'program' }
  | { kind: 'class'; classId: string }
  | { kind: 'parent'; householdId: string }
  | { kind: 'student'; studentId: string };

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

export type AttendanceSegment = LearningScope & {
  occurrenceId: string;
  classId: string;
  studentId: string;
  householdId: string;
  segmentId: string;
  minutes: number;
  occurredAt: string;
};

export type AttendanceRecord = LearningScope & {
  occurrenceId: string;
  classId: string;
  studentId: string;
  householdId: string;
  segmentIds: readonly string[];
  minutes: number;
  present: boolean;
  occurredAt: string;
  correctedAt: string | null;
  correctionReason: string | null;
  correctedBy: string | null;
};

export type ReviewCompletion = LearningScope & {
  reviewItemId: string;
  classId: string;
  studentId: string;
  householdId: string;
  adminPublished: boolean;
  completedAt: string;
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

export type RecognitionConsent = LearningScope & {
  studentId: string;
  optedIn: boolean;
  version: number;
  changedAt: string;
  changedBy: string;
};

export type LeaderboardLearner = LearningScope & {
  studentId: string;
  householdId: string;
  classId: string;
  firstName: string;
  lastName: string;
  currentAttendanceStreak: number;
};

export type LeaderboardEntry = {
  rank: number;
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

export type LearningEffectPlan = {
  createStudentGhlContact: false;
  publishPublicLeaderboard: false;
  createRedeemableReward: false;
  sendPeerMessage: false;
  externalEffects: 0;
};

export const NO_LEARNING_EXTERNAL_EFFECTS: LearningEffectPlan = {
  createStudentGhlContact: false,
  publishPublicLeaderboard: false,
  createRedeemableReward: false,
  sendPeerMessage: false,
  externalEffects: 0,
};

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
  getQuestion(scope: LearningScope, questionId: string): Promise<LearningQuestion | null>;
  saveQuestion(question: LearningQuestion): Promise<void>;
  listQuestions(scope: LearningScope): Promise<readonly LearningQuestion[]>;
  saveAnnouncement(announcement: LearningAnnouncement): Promise<void>;
  listAnnouncements(scope: LearningScope): Promise<readonly LearningAnnouncement[]>;
  saveAnnouncementRead(read: AnnouncementRead): Promise<void>;
  listAnnouncementReads(
    scope: LearningScope,
    principalId: string,
  ): Promise<readonly AnnouncementRead[]>;
  getAttendance(
    scope: LearningScope,
    occurrenceId: string,
    studentId: string,
  ): Promise<AttendanceRecord | null>;
  saveAttendance(record: AttendanceRecord): Promise<void>;
  listAttendance(scope: LearningScope): Promise<readonly AttendanceRecord[]>;
  listReviewCompletions(scope: LearningScope): Promise<readonly ReviewCompletion[]>;
  listRecognitionConsents(scope: LearningScope): Promise<readonly RecognitionConsent[]>;
  listLeaderboardLearners(
    scope: LearningScope,
    classId: string,
  ): Promise<readonly LeaderboardLearner[]>;
}
