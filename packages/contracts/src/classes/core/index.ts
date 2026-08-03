export const CLASSROOM_CORE_CONTRACT_VERSION = '2.1.0' as const;
export const CANONICAL_CLASS_SERIES_ID = 'canonical-class' as const;
export const CANONICAL_CLASS_TIME_ZONE = 'Asia/Jerusalem' as const;
export const CANONICAL_CLASS_LOCAL_START_TIME = '19:00' as const;
export const CANONICAL_CLASS_DURATION_MINUTES = 60 as const;
export const CANONICAL_CLASS_WEEKDAYS = [0, 1, 2, 3, 4] as const;
export const CLASSROOM_ROLLING_HORIZON_DAYS = 90 as const;

export type ClassSeriesState = 'draft' | 'active' | 'paused' | 'archived';
export type ClassOccurrenceState =
  'scheduled' | 'preparing' | 'ready' | 'live' | 'completed' | 'canceled';
export type SeriesEnrollmentState = 'active' | 'revoked';
export type SeriesEnrollmentSource =
  'student_activation' | 'student_restore' | 'student_archive' | 'admin_correction';
export type StudentLifecycleState = 'active' | 'archived';
export type StudentLifecycleAction = 'activate' | 'restore' | 'archive';

export type ClassroomScope = {
  accountKey: string;
  productKey: string;
};

export type ClassroomAdminActor = ClassroomScope & {
  principalId: string;
  role: 'admin';
};

export type ClassSeriesRecord = ClassroomScope & {
  id: string;
  title: string;
  state: ClassSeriesState;
  canonical: boolean;
  timeZone: string;
  localStartTime: string;
  durationMinutes: number;
  weekdays: readonly number[];
  startsOn: string;
  endsOn?: string;
  teacherProfileId: string;
  embeddedClassroomRequired: boolean;
  recordingEnabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ClassOccurrenceRecord = ClassroomScope & {
  id: string;
  seriesId: string;
  localClassDate: string;
  startsAt: string;
  scheduledEndsAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
  state: ClassOccurrenceState;
  scheduleVersion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SeriesEnrollmentRecord = ClassroomScope & {
  id: string;
  seriesId: string;
  studentId: string;
  householdId: string;
  state: SeriesEnrollmentState;
  source: SeriesEnrollmentSource;
  effectiveAt: string;
  revokedAt?: string;
  idempotencyKey: string;
  auditRef: string;
  version: number;
};

export type StudentEligibilityRecord = ClassroomScope & {
  studentId: string;
  householdId: string;
  state: StudentLifecycleState;
  version: number;
};

export type ClassroomCommandIdentity = {
  idempotencyKey: string;
  requestHash: string;
  expectedVersion: number;
};

export type SeriesTransitionCommand = ClassroomCommandIdentity & {
  actor: ClassroomAdminActor;
  seriesId: string;
  to: ClassSeriesState;
  occurredAt: string;
};

export type SeriesEditCommand = ClassroomCommandIdentity & {
  actor: ClassroomAdminActor;
  seriesId: string;
  patch: Partial<
    Pick<
      ClassSeriesRecord,
      | 'title'
      | 'timeZone'
      | 'localStartTime'
      | 'durationMinutes'
      | 'weekdays'
      | 'startsOn'
      | 'endsOn'
      | 'teacherProfileId'
      | 'embeddedClassroomRequired'
      | 'recordingEnabled'
    >
  >;
  occurredAt: string;
};

export type OccurrenceCreateCommand = ClassroomCommandIdentity & {
  actor: ClassroomAdminActor;
  seriesId: string;
  localClassDate: string;
  startsAt: string;
  scheduledEndsAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
  occurredAt: string;
};

export type OccurrenceTransitionCommand = ClassroomCommandIdentity & {
  actor: ClassroomAdminActor;
  occurrenceId: string;
  to: ClassOccurrenceState;
  occurredAt: string;
};

export type OccurrenceRescheduleCommand = ClassroomCommandIdentity & {
  actor: ClassroomAdminActor;
  occurrenceId: string;
  localClassDate: string;
  startsAt: string;
  scheduledEndsAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
  occurredAt: string;
};

export type StudentLifecycleEnrollmentCommand = {
  scope: ClassroomScope;
  studentId: string;
  householdId: string;
  action: StudentLifecycleAction;
  idempotencyKey: string;
  requestHash: string;
  auditRef: string;
  occurredAt: string;
};

export type ClassroomEffectPlan = {
  generateOccurrences: boolean;
  reconcileEnrollments: boolean;
  visibleToFamilies: boolean;
  enqueueProviderWork: boolean;
  enqueueCommunicationWork: boolean;
  stopFutureWork: boolean;
};

export type ClassroomCommandReceipt = ClassroomScope & {
  idempotencyKey: string;
  requestHash: string;
  operation: string;
  resultVersion: number;
  committedAt: string;
};

export interface ClassroomCoreUnitOfWork {
  getSeries(scope: ClassroomScope, seriesId: string): Promise<ClassSeriesRecord | null>;
  saveSeries(record: ClassSeriesRecord): Promise<void>;
  getOccurrence(scope: ClassroomScope, occurrenceId: string): Promise<ClassOccurrenceRecord | null>;
  saveOccurrence(record: ClassOccurrenceRecord): Promise<void>;
  getStudent(scope: ClassroomScope, studentId: string): Promise<StudentEligibilityRecord | null>;
  saveStudent(record: StudentEligibilityRecord): Promise<void>;
  getEnrollment(
    scope: ClassroomScope,
    seriesId: string,
    studentId: string,
  ): Promise<SeriesEnrollmentRecord | null>;
  saveEnrollment(record: SeriesEnrollmentRecord): Promise<void>;
  getReceipt(
    scope: ClassroomScope,
    idempotencyKey: string,
  ): Promise<ClassroomCommandReceipt | null>;
  saveReceipt(receipt: ClassroomCommandReceipt): Promise<void>;
}

export interface ClassroomCoreRepository {
  inTransaction<T>(run: (unit: ClassroomCoreUnitOfWork) => Promise<T>): Promise<T>;
}

export const CLASSROOM_CORE_ERROR_CODES = {
  accessDenied: 'classroom_core_access_denied',
  canonicalMutationDenied: 'classroom_core_canonical_mutation_denied',
  canonicalUnenrollDenied: 'classroom_core_canonical_unenroll_denied',
  conflict: 'classroom_core_idempotency_conflict',
  duplicateCanonicalSeries: 'classroom_core_duplicate_canonical_series',
  invalidSchedule: 'classroom_core_invalid_schedule',
  invalidTransition: 'classroom_core_invalid_transition',
  notFound: 'classroom_core_not_found',
  occurrenceInPast: 'classroom_core_occurrence_in_past',
  staleVersion: 'classroom_core_stale_version',
} as const;
