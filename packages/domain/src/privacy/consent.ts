import type {
  ConsentDecision,
  ConsentEvent,
  ConsentMutationInput,
  ConsentScope,
  PrivacyPolicyVersions,
  RecordingParticipantSnapshot,
  StudentConsentSubject,
} from '../../../contracts/src/privacy/index.ts';
import { PrivacyError } from './errors.ts';

const SHA256 = /^[a-f0-9]{64}$/;

export function appendConsentEvent(
  existing: readonly ConsentEvent[],
  input: ConsentMutationInput,
): { disposition: 'appended' | 'replayed'; event: ConsentEvent } {
  const replay = existing.find((event) => event.idempotency_key === input.idempotency_key);
  if (replay !== undefined) {
    if (replay.canonical_request_hash !== input.canonical_request_hash) {
      throw new PrivacyError(
        'consent_conflict',
        'A consent idempotency key cannot be reused for a changed choice.',
      );
    }
    return { disposition: 'replayed', event: replay };
  }
  assertHash(input.canonical_request_hash, 'canonical_request_hash');
  assertHash(input.network_evidence_digest, 'network_evidence_digest');
  assertPolicyVersions(input.policy_versions);
  const actorKind = authorizeConsentActor(input.subject, input.scope, input.actor);
  const prior = currentConsentEvent(existing, input.subject.student_id, input.scope);
  const event: ConsentEvent = {
    consent_event_id: requiredOpaque(input.consent_event_id, 'consent_event_id'),
    idempotency_key: requiredOpaque(input.idempotency_key, 'idempotency_key'),
    canonical_request_hash: input.canonical_request_hash,
    actor_kind: actorKind,
    actor_account_or_credential_id: requiredOpaque(
      input.actor.account_or_credential_id,
      'actor_account_or_credential_id',
    ),
    actor_adult_id: requiredOpaque(input.actor.adult_id ?? '', 'actor_adult_id'),
    household_id: input.subject.household_id,
    student_id: input.subject.student_id,
    relationship: input.subject.relationship,
    parent_authority_attested:
      input.subject.relationship === 'dependent' && actorKind === 'parent_account_owner',
    scope: input.scope,
    choice: input.choice,
    policy_versions: input.policy_versions,
    occurred_at: validIso(input.occurred_at),
    request_correlation_id: requiredOpaque(input.request_correlation_id, 'request_correlation_id'),
    network_evidence_digest: input.network_evidence_digest,
    supersedes_consent_event_id: prior?.consent_event_id ?? null,
    reason_code: requiredOpaque(input.reason_code, 'reason_code'),
  };
  return { disposition: 'appended', event };
}

export function currentConsentEvent(
  events: readonly ConsentEvent[],
  studentId: string,
  scope: ConsentScope,
): ConsentEvent | null {
  return (
    events
      .filter((event) => event.student_id === studentId && event.scope === scope)
      .sort(
        (left, right) =>
          new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(),
      )[0] ?? null
  );
}

export function decideRecordedClassJoin(input: {
  subject: StudentConsentSubject;
  events: readonly ConsentEvent[];
  current_policy_versions: PrivacyPolicyVersions;
}): ConsentDecision {
  const service = currentConsentEvent(input.events, input.subject.student_id, 'service_account');
  if (!isCurrentGrant(service, input.current_policy_versions, 'service_account')) {
    return { allowed: false, safe_code: 'service_account_missing' };
  }
  const recording = currentConsentEvent(
    input.events,
    input.subject.student_id,
    'recording_participation',
  );
  if (!isCurrentGrant(recording, input.current_policy_versions, 'recording_participation')) {
    return { allowed: false, safe_code: 'recording_consent_missing' };
  }
  return { allowed: true, safe_code: 'current_consent' };
}

export function decideProtectedPlayback(derivedAuthorization: boolean): ConsentDecision {
  return {
    allowed: derivedAuthorization,
    safe_code: 'playback_derived_independently',
  };
}

export function freezeRecordingParticipantSnapshot(input: {
  snapshot_id: string;
  occurrence_id: string;
  subject: StudentConsentSubject;
  events: readonly ConsentEvent[];
  current_policy_versions: PrivacyPolicyVersions;
  capture_intervals: readonly { started_at: string; ended_at: string | null }[];
  notice_confirmed: boolean;
  student_lifecycle_version: number;
  enrollment_version: number;
  access_version: number;
  session_version: number;
  created_at: string;
  audit_ref: string;
}): Readonly<RecordingParticipantSnapshot> {
  const decision = decideRecordedClassJoin(input);
  if (!decision.allowed || !input.notice_confirmed) {
    throw new PrivacyError(
      'current_consent_missing',
      'Snapshot requires current exact-Student consent and confirmed recording notice.',
    );
  }
  const service = currentConsentEvent(input.events, input.subject.student_id, 'service_account');
  const recording = currentConsentEvent(
    input.events,
    input.subject.student_id,
    'recording_participation',
  );
  if (service === null || recording === null) {
    throw new PrivacyError('current_consent_missing', 'Required consent evidence is absent.');
  }
  const recognition = currentConsentEvent(
    input.events,
    input.subject.student_id,
    'member_recognition',
  );
  const snapshot: RecordingParticipantSnapshot = {
    snapshot_id: requiredOpaque(input.snapshot_id, 'snapshot_id'),
    occurrence_id: requiredOpaque(input.occurrence_id, 'occurrence_id'),
    student_id: input.subject.student_id,
    household_id: input.subject.household_id,
    relationship: input.subject.relationship,
    capture_intervals: input.capture_intervals.map((interval) => ({
      started_at: validIso(interval.started_at),
      ended_at: interval.ended_at === null ? null : validIso(interval.ended_at),
    })),
    service_consent_event_id: service.consent_event_id,
    recording_consent_event_id: recording.consent_event_id,
    member_recognition_event_id: recognition?.consent_event_id ?? null,
    recognition_state:
      recognition?.choice === 'granted'
        ? 'allowed'
        : recognition?.choice === 'withdrawn'
          ? 'withdrawn'
          : 'anonymous',
    notice_state: 'visible_and_verbal_confirmed',
    student_lifecycle_version: positiveVersion(input.student_lifecycle_version),
    enrollment_version: positiveVersion(input.enrollment_version),
    access_version: positiveVersion(input.access_version),
    session_version: positiveVersion(input.session_version),
    evidence_source: 'roster_and_join_readback',
    created_at: validIso(input.created_at),
    audit_ref: requiredOpaque(input.audit_ref, 'audit_ref'),
  };
  return Object.freeze({
    ...snapshot,
    capture_intervals: Object.freeze(
      snapshot.capture_intervals.map((interval) => Object.freeze({ ...interval })),
    ),
  });
}

function authorizeConsentActor(
  subject: StudentConsentSubject,
  scope: ConsentScope,
  actor: ConsentMutationInput['actor'],
): ConsentEvent['actor_kind'] {
  if (
    subject.relationship === 'dependent' &&
    actor.role === 'parent' &&
    actor.adult_id === subject.owner_adult_id &&
    actor.household_id === subject.household_id
  ) {
    return 'parent_account_owner';
  }
  if (subject.relationship === 'self' && subject.self_adult_id === subject.owner_adult_id) {
    if (
      scope === 'service_account' &&
      actor.role === 'parent' &&
      actor.adult_id === subject.self_adult_id &&
      actor.household_id === subject.household_id
    ) {
      return 'parent_account_owner';
    }
    if (
      scope !== 'service_account' &&
      actor.role === 'student' &&
      actor.student_id === subject.student_id &&
      actor.adult_id === subject.self_adult_id
    ) {
      return 'adult_self_student';
    }
  }
  throw new PrivacyError(
    'actor_scope_denied',
    'Consent actor does not match the exact relationship-authorized adult and Student.',
  );
}

function isCurrentGrant(
  event: ConsentEvent | null,
  versions: PrivacyPolicyVersions,
  scope: ConsentScope,
): boolean {
  if (event === null || event.choice !== 'granted') return false;
  if (
    event.policy_versions.privacy_notice !== versions.privacy_notice ||
    event.policy_versions.terms !== versions.terms
  ) {
    return false;
  }
  return scope !== 'recording_participation'
    ? true
    : event.policy_versions.student_data_recording === versions.student_data_recording;
}

function assertPolicyVersions(versions: PrivacyPolicyVersions): void {
  requiredOpaque(versions.privacy_notice, 'privacy_notice');
  requiredOpaque(versions.terms, 'terms');
  requiredOpaque(versions.student_data_recording, 'student_data_recording');
  if (versions.cancellation_refund !== null) {
    requiredOpaque(versions.cancellation_refund, 'cancellation_refund');
  }
}

function requiredOpaque(value: string, field: string): string {
  if (value.trim() === '' || /(?:@|password|token|secret|bearer)/i.test(value)) {
    throw new PrivacyError('invalid_contract', `${field} must be a safe opaque identifier.`);
  }
  return value;
}

function assertHash(value: string, field: string): void {
  if (!SHA256.test(value)) {
    throw new PrivacyError('invalid_hash', `${field} must be a lowercase SHA-256 digest.`);
  }
}

function validIso(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new PrivacyError('invalid_contract', 'Timestamps must be canonical UTC ISO values.');
  }
  return value;
}

function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PrivacyError('invalid_contract', 'Snapshot versions must be positive integers.');
  }
  return value;
}
