import type { ClassOccurrenceRecord } from '../../classes/core/index.ts';
import type { JobScope } from '../../jobs/index.ts';
import type {
  ConsentEvent,
  PrivacyPolicyVersions,
  StudentConsentSubject,
} from '../../privacy/index.ts';

export const EMBEDDED_CLASSROOM_CONTRACT_VERSION = '1.0.0' as const;
export const CLASSROOM_BOOTSTRAP_TTL_MS = 60_000 as const;
export const CLASSROOM_HEARTBEAT_INTERVAL_MS = 30_000 as const;
export const CLASSROOM_LEASE_TTL_MS = 90_000 as const;
export const CLASSROOM_PREPARATION_LEAD_MS = 24 * 60 * 60 * 1_000;
export const CLASSROOM_REMINDER_LEAD_MS = 30 * 60 * 1_000;
export const CLASSROOM_JOIN_OPEN_LEAD_MS = 10 * 60 * 1_000;
export const CLASSROOM_CANONICAL_DURATION_MS = 60 * 60 * 1_000;
export const CLASSROOM_AUTO_CLOSE_LAG_MS = 15 * 60 * 1_000;
export const CLASSROOM_ROLLING_HORIZON_DAYS = 90 as const;

export type EffectiveClassroomAccess = 'free' | 'active' | 'grace' | 'inactive';
export type EmbeddedRegistrantState =
  'pending' | 'active' | 'failed' | 'acceptance_unknown' | 'revoked';

export interface EmbeddedStudentActor {
  role: 'student';
  student_id: string;
  household_id: string;
  authenticated_session_id: string;
  device_lineage_id: string;
  csrf_verified: boolean;
}

export interface EmbeddedAdminActor {
  role: 'admin';
  admin_id: string;
  audit_ref: string;
}

export interface EmbeddedJoinContext {
  scope: JobScope;
  actor: EmbeddedStudentActor;
  occurrence: ClassOccurrenceRecord;
  student_state: 'active' | 'archived';
  student_version: number;
  enrollment_state: 'active' | 'revoked';
  enrollment_version: number;
  access_state: EffectiveClassroomAccess;
  access_version: number;
  registrant_state: EmbeddedRegistrantState;
  registrant_id: string;
  registrant_ref_digest: string;
  registrant_version: number;
  consent_subject: StudentConsentSubject;
  consent_events: readonly ConsentEvent[];
  current_policy_versions: PrivacyPolicyVersions;
  current_consent_version_digest: string;
  launch_revoked: boolean;
  provider_meeting_ended: boolean;
}

export type EmbeddedJoinDenialCode =
  | 'csrf_required'
  | 'student_inactive'
  | 'enrollment_inactive'
  | 'access_inactive'
  | 'service_consent_required'
  | 'recording_consent_required'
  | 'registration_unavailable'
  | 'join_not_open'
  | 'occurrence_closed'
  | 'launch_revoked'
  | 'second_device_active'
  | 'grant_invalid'
  | 'grant_expired'
  | 'grant_consumed'
  | 'authorization_changed'
  | 'bootstrap_unavailable';

export type EmbeddedJoinDecision =
  | { allowed: true; safe_code: 'join_allowed' }
  | { allowed: false; safe_code: EmbeddedJoinDenialCode };

export interface LaunchGrantRecord {
  grant_id: string;
  grant_key_digest: string;
  scope: JobScope;
  student_id: string;
  household_id: string;
  authenticated_session_id: string;
  occurrence_id: string;
  registrant_id: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  student_version: number;
  enrollment_version: number;
  access_version: number;
  consent_version_digest: string;
  registrant_version: number;
  occurrence_version: number;
  version: number;
}

export type LiveStudentSessionState = 'active' | 'revoked' | 'expired';

export interface LiveStudentSession {
  live_session_id: string;
  scope: JobScope;
  student_id: string;
  household_id: string;
  occurrence_id: string;
  authenticated_session_id: string;
  device_lineage_id: string;
  state: LiveStudentSessionState;
  lease_generation: number;
  last_heartbeat_at: string;
  lease_expires_at: string;
  revoked_at: string | null;
  revoked_by_admin_id: string | null;
  revoke_audit_ref: string | null;
  version: number;
}

export type LiveSessionDecision =
  | {
      allowed: true;
      disposition:
        'acquired' | 'reconnected' | 'reacquired_after_expiry' | 'reacquired_after_reset';
      session: LiveStudentSession;
    }
  | {
      allowed: false;
      disposition: 'second_device_denied';
      safe_code: 'second_device_active';
    };

export interface EphemeralMeetingSdkBootstrap {
  sdk_session_ref: string;
  sdk_signature: string;
  participant_display_name: string;
  issued_at: string;
  expires_at: string;
  role: 0;
}

export interface RedeemEmbeddedBootstrapInput {
  actor: EmbeddedStudentActor;
  scope: JobScope;
  grant_key_digest: string;
  live_session_id: string;
  now: Date;
}

export type RedeemEmbeddedBootstrapResult =
  | {
      disposition: 'ready';
      safe_code: 'join_allowed';
      session: LiveStudentSession;
      bootstrap: EphemeralMeetingSdkBootstrap;
      response_headers: {
        'cache-control': 'no-store';
        'referrer-policy': 'no-referrer';
      };
    }
  | {
      disposition: 'denied';
      safe_code: EmbeddedJoinDenialCode;
    };

export type AttendanceEventSource = 'zoom_provider' | 'embedded_client' | 'admin_correction';
export type AttendanceEventKind = 'joined' | 'left' | 'manual_correction';

export interface AttendanceInterval {
  joined_at: string;
  left_at: string;
}

export interface AttendanceEvent {
  attendance_event_id: string;
  scope: JobScope;
  occurrence_id: string;
  student_id: string;
  source: AttendanceEventSource;
  event_kind: AttendanceEventKind;
  observed_at: string;
  connection_lineage_id: string;
  idempotency_key: string;
  source_event_ref_digest: string;
  provider_verified: boolean;
  correction_intervals: readonly AttendanceInterval[];
  correction_reason: string | null;
  correction_admin_id: string | null;
  audit_ref: string | null;
}

export type AttendanceReconciliationState =
  'provisional' | 'provider_verified' | 'provider_mismatch' | 'admin_corrected';

export interface AttendanceProjection {
  scope: JobScope;
  occurrence_id: string;
  student_id: string;
  first_joined_at: string | null;
  last_left_at: string | null;
  total_connected_minutes: number;
  attendance_percentage: number;
  reconnect_count: number;
  late: boolean;
  reconciliation_state: AttendanceReconciliationState;
  manual_correction_reason: string | null;
  correction_admin_id: string | null;
  source_event_count: number;
  version: number;
  updated_at: string;
}

export interface CommitBootstrapInput {
  prior_grant: LaunchGrantRecord;
  next_grant: LaunchGrantRecord;
  prior_session: LiveStudentSession | null;
  next_session: LiveStudentSession;
}

export interface EmbeddedClassroomRepository {
  insertLaunchGrant(grant: LaunchGrantRecord): Promise<'inserted' | 'replayed'>;
  loadLaunchGrant(input: {
    scope: JobScope;
    grant_key_digest: string;
  }): Promise<LaunchGrantRecord | null>;
  loadLiveSession(input: {
    scope: JobScope;
    student_id: string;
  }): Promise<LiveStudentSession | null>;
  commitBootstrap(input: CommitBootstrapInput): Promise<boolean>;
  persistLiveSession(input: {
    prior: LiveStudentSession;
    next: LiveStudentSession;
  }): Promise<boolean>;
  resetStudentLaunch(input: {
    prior_session: LiveStudentSession;
    next_session: LiveStudentSession;
    now: Date;
  }): Promise<boolean>;
  appendAttendance(input: {
    events: readonly AttendanceEvent[];
    prior_projection: AttendanceProjection | null;
    next_projection: AttendanceProjection;
  }): Promise<boolean>;
}

export interface EmbeddedJoinContextResolver {
  resolve(input: {
    scope: JobScope;
    actor: EmbeddedStudentActor;
    grant: LaunchGrantRecord;
  }): Promise<EmbeddedJoinContext>;
}

export interface MeetingSdkBootstrapPort {
  createEphemeralBootstrap(input: {
    context: EmbeddedJoinContext;
    grant: LaunchGrantRecord;
    live_session: LiveStudentSession;
    now: Date;
  }): Promise<EphemeralMeetingSdkBootstrap>;
}
