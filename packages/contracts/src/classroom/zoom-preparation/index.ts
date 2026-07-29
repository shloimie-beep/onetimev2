import type {
  ClassOccurrenceRecord,
  ClassroomAdminActor,
  ClassroomScope,
  SeriesEnrollmentRecord,
  StudentEligibilityRecord,
} from '../../classes/core/index.ts';
import type { JobScope, ProviderDispatchOutcome } from '../../jobs/index.ts';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../providers/v21-provider-core.ts';

export const ZOOM_PREPARATION_CONTRACT_VERSION = '2.1.0' as const;
export const ZOOM_PREPARATION_OPERATION_VERSION = 'OT-ZOOM-PREPARE-1' as const;
export const ZOOM_PREPARATION_AUTOMATIC_LEAD_MS = 24 * 60 * 60 * 1000;
export const ZOOM_REMINDER_LEAD_MS = 30 * 60 * 1000;
export const ZOOM_BOOTSTRAP_TTL_MS = 60 * 1000;
export const ZOOM_DEVICE_HEARTBEAT_INTERVAL_MS = 30 * 1000;
export const ZOOM_DEVICE_LEASE_TTL_MS = 90 * 1000;
export const ZOOM_CONSTANT_STUDENT_ROUTE = '/app/student/classroom' as const;
export const ZOOM_CONSTANT_PARENT_ROUTE = '/app/parent/classes' as const;

export const CANONICAL_ZOOM_MEETING_SETTINGS = {
  settingsVersion: 'OT-ZOOM-SETTINGS-1',
  durationMinutes: 60,
  timeZone: 'Asia/Jerusalem',
  waitingRoom: false,
  joinBeforeHost: false,
  muteUponEntry: true,
  participantRename: false,
  participantChat: false,
  participantScreenSharing: false,
  participantFileTransfer: false,
  participantInvite: false,
  autoRecording: 'none',
  cloudRecording: false,
  localRecording: false,
  registrationRequired: true,
  embeddedMeetingSdk: true,
} as const;

export type ZoomPreparationScope = ClassroomScope;
export type ZoomPreparationAdminActor = ClassroomAdminActor;
export type ZoomPreparationState =
  | 'draft'
  | 'validating'
  | 'preview_ready'
  | 'confirmed'
  | 'provisioning'
  | 'ready_to_notify'
  | 'notifying'
  | 'partial_failure'
  | 'failed'
  | 'acceptance_unknown'
  | 'invalidated'
  | 'canceled'
  | 'complete';
export type ZoomPreparationTrigger = 'automatic_24h' | 'admin_manual';
export type ZoomRosterDecision = 'included' | 'excluded';
export type ZoomConsentState = 'accepted' | 'missing' | 'withdrawn' | 'expired';
export type ClassroomResourceState =
  | 'not_provisioned'
  | 'provisioning'
  | 'active'
  | 'failed'
  | 'acceptance_unknown'
  | 'closed'
  | 'deleted';
export type StudentRegistrantState =
  'pending' | 'provisioning' | 'active' | 'failed' | 'acceptance_unknown' | 'revoked';

export type ZoomStudentPreparationInput = {
  student: StudentEligibilityRecord;
  enrollment: SeriesEnrollmentRecord;
  householdAccess: 'free' | 'active' | 'grace' | 'inactive';
  serviceAccountConsent: ZoomConsentState;
  serviceAccountConsentVersion: number;
  recordingParticipationConsent: ZoomConsentState;
  recordingParticipationConsentVersion: number;
  memberRecognitionConsent: ZoomConsentState;
  memberRecognitionConsentVersion: number;
  approvedClassroomName: string;
};

export type ZoomRosterEntry = ZoomPreparationScope & {
  studentId: string;
  householdId: string;
  decision: ZoomRosterDecision;
  safeReason:
    | 'eligible'
    | 'student_inactive'
    | 'enrollment_inactive'
    | 'series_mismatch'
    | 'household_access_inactive'
    | 'service_account_consent_missing'
    | 'recording_participation_consent_missing';
  approvedClassroomName: string;
  studentVersion: number;
  enrollmentVersion: number;
  serviceAccountConsentVersion: number;
  recordingParticipationConsentVersion: number;
  memberRecognitionConsentVersion: number;
};

export type OccurrenceRosterSnapshot = ZoomPreparationScope & {
  id: string;
  occurrenceId: string;
  scheduleVersion: number;
  rosterVersion: number;
  entries: readonly ZoomRosterEntry[];
  digest: string;
  generatedAt: string;
};

export type ZoomHouseholdReminderPreview = {
  householdId: string;
  studentLabels: readonly string[];
  appPath: typeof ZOOM_CONSTANT_PARENT_ROUTE;
  scheduledFor: string;
};

export type ZoomPreparationPreview = {
  occurrenceId: string;
  occurrenceVersion: number;
  scheduleVersion: number;
  rosterSnapshotId: string;
  rosterDigest: string;
  meetingSettings: typeof CANONICAL_ZOOM_MEETING_SETTINGS;
  householdReminders: readonly ZoomHouseholdReminderPreview[];
  digest: string;
  createdAt: string;
};

export type ZoomPreparationSaga = ZoomPreparationScope & {
  id: string;
  occurrenceId: string;
  trigger: ZoomPreparationTrigger;
  scheduleVersion: number;
  rosterVersion: number;
  state: ZoomPreparationState;
  preview?: ZoomPreparationPreview;
  confirmedPreviewDigest?: string;
  confirmedByAdminId?: string;
  failedStage?: 'validating' | 'provisioning' | 'notifying';
  safeErrorCode?: string;
  providerOperationIds: readonly string[];
  completedOperationIds: readonly string[];
  unknownOperationIds: readonly string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomResource = ZoomPreparationScope & {
  id: string;
  occurrenceId: string;
  purpose: 'normal_class';
  provider: 'zoom';
  scope: JobScope;
  state: ClassroomResourceState;
  providerMeetingRefDigest?: string;
  providerAccountRefHash: string;
  registryBindingKey: string;
  provisioningIdempotencyKey: string;
  sourceScheduleVersion: number;
  sourceRosterVersion: number;
  settings: typeof CANONICAL_ZOOM_MEETING_SETTINGS;
  safeErrorCode?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type StudentRegistrant = ZoomPreparationScope & {
  id: string;
  occurrenceId: string;
  classroomResourceId: string;
  studentId: string;
  householdId: string;
  state: StudentRegistrantState;
  providerRegistrantRefDigest?: string;
  technicalAliasDigest: string;
  approvedClassroomName: string;
  provisioningIdempotencyKey: string;
  sourceStudentVersion: number;
  sourceEnrollmentVersion: number;
  sourceRosterVersion: number;
  safeErrorCode?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ZoomMeetingReadback = {
  operationId: string;
  providerMeetingRefDigest: string;
  occurrenceId: string;
  startTime: string;
  durationMinutes: 60;
  timeZone: 'Asia/Jerusalem';
  settings: typeof CANONICAL_ZOOM_MEETING_SETTINGS;
  observedAt: string;
  reconciliationDigest: string;
};

export type ZoomRegistrantReadback = {
  operationId: string;
  providerMeetingRefDigest: string;
  providerRegistrantRefDigest: string;
  occurrenceId: string;
  studentId: string;
  active: true;
  observedAt: string;
  reconciliationDigest: string;
};

export type StudentJoinState = {
  route: typeof ZOOM_CONSTANT_STUDENT_ROUTE;
  available: boolean;
  safeCode:
    | 'join_available'
    | 'preparation_pending'
    | 'outside_join_window'
    | 'student_not_authorized'
    | 'registrant_not_ready'
    | 'zoom_unavailable';
  occurrenceId: string;
  exposesRawZoomUrl: false;
};

export type LaunchGrantRecord = ZoomPreparationScope & {
  id: string;
  studentId: string;
  householdId: string;
  studentSessionId: string;
  deviceLineageId: string;
  occurrenceId: string;
  registrantId: string;
  grantDigest: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
  revokedAt?: string;
  studentVersion: number;
  enrollmentVersion: number;
  serviceAccountConsentVersion: number;
  recordingParticipationConsentVersion: number;
  version: number;
};

export type LiveStudentSession = ZoomPreparationScope & {
  id: string;
  studentId: string;
  occurrenceId: string;
  studentSessionId: string;
  deviceLineageId: string;
  state: 'active' | 'revoked' | 'expired';
  leaseExpiresAt: string;
  lastHeartbeatAt: string;
  version: number;
};

export type MeetingSdkBootstrap = {
  meetingRef: string;
  registrantRef: string;
  sdkSignature: string;
  displayName: string;
  expiresAt: string;
  cacheControl: 'private, no-store';
  referrerPolicy: 'no-referrer';
  durable: false;
};

export type PrepareZoomPreviewCommand = {
  actor: ZoomPreparationAdminActor | { role: 'scheduler'; principalId: string };
  scope: ZoomPreparationScope;
  occurrence: ClassOccurrenceRecord;
  students: readonly ZoomStudentPreparationInput[];
  trigger: ZoomPreparationTrigger;
  rosterVersion: number;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
};

export type ConfirmZoomPreparationCommand = {
  actor: ZoomPreparationAdminActor;
  sagaId: string;
  expectedVersion: number;
  previewDigest: string;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
  providerBinding: ProviderRegistryBinding;
};

export type ZoomPreparationCommandReceipt = ZoomPreparationScope & {
  idempotencyKey: string;
  requestHash: string;
  operation: 'prepare_preview' | 'confirm_preparation';
  resultRef: string;
  resultVersion: number;
  committedAt: string;
};

export type ZoomProviderExecutionResult = {
  operation: ProviderOperation;
  outcome: ProviderDispatchOutcome;
  canonicalReadback?: ProviderCanonicalReadback;
  meetingReadback?: ZoomMeetingReadback;
  registrantReadback?: ZoomRegistrantReadback;
};

export interface ZoomPreparationUnitOfWork {
  getSaga(scope: ZoomPreparationScope, sagaId: string): Promise<ZoomPreparationSaga | null>;
  saveSaga(saga: ZoomPreparationSaga): Promise<void>;
  getRoster(
    scope: ZoomPreparationScope,
    rosterSnapshotId: string,
  ): Promise<OccurrenceRosterSnapshot | null>;
  saveRoster(snapshot: OccurrenceRosterSnapshot): Promise<void>;
  getClassroomResource(
    scope: ZoomPreparationScope,
    occurrenceId: string,
  ): Promise<ClassroomResource | null>;
  saveClassroomResource(resource: ClassroomResource): Promise<void>;
  listRegistrants(
    scope: ZoomPreparationScope,
    occurrenceId: string,
  ): Promise<readonly StudentRegistrant[]>;
  saveRegistrant(registrant: StudentRegistrant): Promise<void>;
  saveProviderOperation(operation: ProviderOperation): Promise<void>;
  saveLaunchGrant(grant: LaunchGrantRecord): Promise<void>;
  getLiveSession(
    scope: ZoomPreparationScope,
    studentId: string,
    occurrenceId: string,
  ): Promise<LiveStudentSession | null>;
  saveLiveSession(session: LiveStudentSession): Promise<void>;
  getReceipt(
    scope: ZoomPreparationScope,
    idempotencyKey: string,
  ): Promise<ZoomPreparationCommandReceipt | null>;
  saveReceipt(receipt: ZoomPreparationCommandReceipt): Promise<void>;
}

export interface ZoomPreparationRepository {
  inTransaction<T>(run: (unit: ZoomPreparationUnitOfWork) => Promise<T>): Promise<T>;
}

export const ZOOM_PREPARATION_ERROR_CODES = {
  accessDenied: 'zoom_preparation_access_denied',
  conflict: 'zoom_preparation_idempotency_conflict',
  invalidOccurrence: 'zoom_preparation_invalid_occurrence',
  invalidProviderBinding: 'zoom_preparation_invalid_provider_binding',
  invalidReadback: 'zoom_preparation_invalid_readback',
  invalidRoster: 'zoom_preparation_invalid_roster',
  invalidSettings: 'zoom_preparation_invalid_settings',
  invalidState: 'zoom_preparation_invalid_state',
  invalidTransition: 'zoom_preparation_invalid_transition',
  staleVersion: 'zoom_preparation_stale_version',
  bootstrapExpired: 'zoom_preparation_bootstrap_expired',
  bootstrapReplay: 'zoom_preparation_bootstrap_replay',
  concurrentDeviceDenied: 'zoom_preparation_concurrent_device_denied',
  joinDenied: 'zoom_preparation_join_denied',
  providerAcceptanceUnknown: 'zoom_preparation_provider_acceptance_unknown',
} as const;
