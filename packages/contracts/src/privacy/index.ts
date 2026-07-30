import type { StudentRelationship } from '../accounts/v21-household-identity.ts';
import type { JobScope, TransactionalOutboxIntent } from '../jobs/index.ts';

export const PRIVACY_CONTRACT_VERSION = '1.0.0' as const;
export type PrivacyPersistenceScope = JobScope;
export const EXPORT_DOWNLOAD_TTL_MS = 15 * 60 * 1000;
export const EXPORT_PACKAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const VERIFIED_ERASURE_DEADLINE_MS = 30 * 24 * 60 * 60 * 1000;

export const CONSENT_SCOPES = [
  'service_account',
  'recording_participation',
  'member_recognition',
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
export type ConsentChoice = 'granted' | 'declined' | 'withdrawn';
export type ConsentActorKind = 'parent_account_owner' | 'adult_self_student';

export interface PrivacyPolicyVersions {
  privacy_notice: string;
  terms: string;
  student_data_recording: string;
  cancellation_refund: string | null;
}

export interface PrivacyActorContext {
  role: 'admin' | 'parent' | 'student';
  account_or_credential_id: string;
  adult_id: string | null;
  student_id: string | null;
  household_id: string | null;
  recent_password_verified: boolean;
  session_id: string;
}

export interface ConsentEvent {
  consent_event_id: string;
  idempotency_key: string;
  canonical_request_hash: string;
  actor_kind: ConsentActorKind;
  actor_account_or_credential_id: string;
  actor_adult_id: string;
  household_id: string;
  student_id: string;
  relationship: StudentRelationship;
  parent_authority_attested: boolean;
  scope: ConsentScope;
  choice: ConsentChoice;
  policy_versions: PrivacyPolicyVersions;
  occurred_at: string;
  request_correlation_id: string;
  network_evidence_digest: string;
  supersedes_consent_event_id: string | null;
  reason_code: string;
}

export interface StudentConsentSubject {
  student_id: string;
  household_id: string;
  relationship: StudentRelationship;
  owner_adult_id: string;
  self_adult_id: string | null;
}

export interface ConsentMutationInput {
  consent_event_id: string;
  idempotency_key: string;
  canonical_request_hash: string;
  actor: PrivacyActorContext;
  subject: StudentConsentSubject;
  scope: ConsentScope;
  choice: ConsentChoice;
  policy_versions: PrivacyPolicyVersions;
  occurred_at: string;
  request_correlation_id: string;
  network_evidence_digest: string;
  reason_code: string;
}

export interface ConsentDecision {
  allowed: boolean;
  safe_code:
    | 'current_consent'
    | 'service_account_missing'
    | 'recording_consent_missing'
    | 'actor_mismatch'
    | 'playback_derived_independently';
}

export interface RecordingParticipantSnapshot {
  snapshot_id: string;
  occurrence_id: string;
  student_id: string;
  household_id: string;
  relationship: StudentRelationship;
  capture_intervals: readonly { started_at: string; ended_at: string | null }[];
  service_consent_event_id: string;
  recording_consent_event_id: string;
  member_recognition_event_id: string | null;
  recognition_state: 'allowed' | 'anonymous' | 'withdrawn';
  notice_state: 'visible_and_verbal_confirmed';
  student_lifecycle_version: number;
  enrollment_version: number;
  access_version: number;
  session_version: number;
  evidence_source: 'roster_and_join_readback';
  created_at: string;
  audit_ref: string;
}

export const DATA_RIGHTS_REQUEST_KINDS = [
  'export',
  'correction',
  'closure',
  'erasure',
  'consent_withdrawal',
] as const;
export type DataRightsRequestKind = (typeof DATA_RIGHTS_REQUEST_KINDS)[number];

export const DATA_RIGHTS_INTERNAL_STATES = [
  'received',
  'identity_verified',
  'approved',
  'executing',
  'provider_pending',
  'completed',
  'denied',
  'failed',
  'canceled',
] as const;
export type DataRightsInternalState = (typeof DATA_RIGHTS_INTERNAL_STATES)[number];

export const REQUESTER_VISIBLE_PRIVACY_STATUSES = [
  'requested',
  'processing',
  'completed',
  'partially_excepted',
  'failed',
] as const;
export type RequesterVisiblePrivacyStatus = (typeof REQUESTER_VISIBLE_PRIVACY_STATUSES)[number];

export type DataRightsSubjectScope =
  | { kind: 'adult'; adult_id: string }
  | { kind: 'household'; household_id: string }
  | {
      kind: 'student';
      student_id: string;
      household_id: string;
      relationship: StudentRelationship;
      self_adult_id: string | null;
    };

export type DataRightsRequesterKind = 'account_owner' | 'adult_self_student' | 'privacy_admin';

export interface ProviderCascadeState {
  provider: string;
  state: 'not_started' | 'pending' | 'complete' | 'excepted' | 'failed';
  reconciliation_digest: string | null;
  safe_exception_code: string | null;
  unknown_effect: boolean;
}

export interface DataRightsRequest extends JobScope {
  request_id: string;
  kind: DataRightsRequestKind;
  subject: DataRightsSubjectScope;
  requester_kind: DataRightsRequesterKind;
  requester_ref: string;
  requester_household_id: string | null;
  relationship_evidence: StudentRelationship | null;
  recent_password_session_id: string;
  state: DataRightsInternalState;
  visible_status: RequesterVisiblePrivacyStatus | null;
  requested_categories: readonly string[];
  excluded_categories: readonly string[];
  legal_exception_codes: readonly string[];
  provider_cascades: readonly ProviderCascadeState[];
  dependent_review_required: boolean;
  dependent_review_completed: boolean;
  due_at: string;
  completed_at: string | null;
  terminal_reason_code: string | null;
  version: number;
  audit_refs: readonly string[];
}

export interface DataRightsRequestInput {
  scope: PrivacyPersistenceScope;
  request_id: string;
  kind: DataRightsRequestKind;
  subject: DataRightsSubjectScope;
  actor: PrivacyActorContext;
  owner_adult_id: string;
  requested_categories: readonly string[];
  now: Date;
  audit_ref: string;
}

export interface ExportDownloadGrant extends JobScope {
  grant_id: string;
  request_id: string;
  subject_binding_hash: string;
  token_hash: string;
  initiating_session_id: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  version: number;
}

export interface ContentParticipantPrivacyState {
  content_version_id: string;
  student_id: string;
  other_participant_count: number;
  required_actions: readonly (
    'cut' | 'mute' | 'blur' | 'transcript_redaction' | 'worksheet_redaction'
  )[];
  redaction_state: 'required' | 'in_progress' | 'complete' | 'restricted';
}

export interface SharedMediaPrivacyPlan {
  student_id: string;
  restrict_immediately: true;
  delete_other_students: false;
  replacement_required: boolean;
  permanently_restrict_if_infeasible: true;
  participant_actions: readonly ContentParticipantPrivacyState[];
  search_and_derivative_invalidation_required: true;
}

export type PurgeDisposition =
  'delete' | 'anonymize' | 'suppress' | 'unpublish' | 'block_recreation';

export interface PurgeIdentifier {
  scope: 'adult' | 'household' | 'student' | 'content' | 'provider' | 'object';
  hmac_sha256: string;
  hmac_key_version: string;
}

export interface DeletionPurgeRecord {
  ledger_event_id: string;
  occurred_at: string;
  request_audit_digest: string;
  policy_version_hash: string;
  identifiers: readonly PurgeIdentifier[];
  dispositions: readonly PurgeDisposition[];
  category_tombstones: readonly string[];
  provider_tombstones: readonly string[];
  effective_at: string;
  replay_until: string;
  legal_hold_codes: readonly string[];
  scope: JobScope;
  release_digest: string;
  configuration_digest: string;
  sequence: number;
  previous_record_digest: string | null;
  record_digest: string;
}

export interface PurgeLedgerReadback {
  record_digest: string;
  primary_object_version_hash: string;
  replica_object_version_hash: string;
  primary_checksum_verified: boolean;
  replica_checksum_verified: boolean;
  object_lock_compliance_verified: boolean;
  replication_completed_at: string;
}

export interface RetentionWorkItem {
  work_id: string;
  request_id: string;
  subject_binding_hash: string;
  category: string;
  due_at: string;
  legal_hold_codes: readonly string[];
  provider_outbox_intents: readonly TransactionalOutboxIntent[];
  state: 'due' | 'planned' | 'provider_pending' | 'complete' | 'failed';
  version: number;
}

export interface PrivacyRetentionRepository {
  claimDue(input: {
    scope: JobScope;
    now: Date;
    limit: number;
  }): Promise<readonly RetentionWorkItem[]>;
  persistPlan(input: {
    prior: RetentionWorkItem;
    next: RetentionWorkItem;
    purge_record: DeletionPurgeRecord;
  }): Promise<boolean>;
}
