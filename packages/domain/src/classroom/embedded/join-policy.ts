import type {
  EmbeddedJoinContext,
  EmbeddedJoinDecision,
  LaunchGrantRecord,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import { decideRecordedClassJoin } from '../../privacy/consent.ts';
import { EmbeddedClassroomError } from './errors.ts';

const SHA256 = /^[a-f0-9]{64}$/;

export function decideEmbeddedJoin(context: EmbeddedJoinContext, now: Date): EmbeddedJoinDecision {
  assertContext(context);
  if (!context.actor.csrf_verified) return denied('csrf_required');
  if (context.student_state !== 'active') return denied('student_inactive');
  if (context.enrollment_state !== 'active') return denied('enrollment_inactive');
  if (!['free', 'active', 'grace'].includes(context.access_state)) {
    return denied('access_inactive');
  }
  const consent = decideRecordedClassJoin({
    subject: context.consent_subject,
    events: context.consent_events,
    current_policy_versions: context.current_policy_versions,
  });
  if (!consent.allowed) {
    return denied(
      consent.safe_code === 'service_account_missing'
        ? 'service_consent_required'
        : 'recording_consent_required',
    );
  }
  if (context.registrant_state !== 'active') return denied('registration_unavailable');
  if (context.launch_revoked) return denied('launch_revoked');
  if (context.provider_meeting_ended) return denied('occurrence_closed');

  const timestamp = now.getTime();
  const opensAt = instant(context.occurrence.joinOpensAt);
  const closesAt = instant(context.occurrence.joinClosesAt);
  if (context.occurrence.state === 'live') {
    return timestamp <= closesAt ? allowed() : denied('occurrence_closed');
  }
  if (context.occurrence.state === 'ready') {
    if (timestamp < opensAt) return denied('join_not_open');
    return timestamp <= closesAt ? allowed() : denied('occurrence_closed');
  }
  return denied('occurrence_closed');
}

export function assertGrantAuthorizesContext(
  grant: LaunchGrantRecord,
  context: EmbeddedJoinContext,
  now: Date,
): void {
  if (!SHA256.test(grant.grant_key_digest)) {
    throw new EmbeddedClassroomError('grant_invalid', 'Launch grant digest is invalid.');
  }
  if (grant.used_at !== null) {
    throw new EmbeddedClassroomError('grant_consumed', 'Launch grant was already consumed.');
  }
  if (grant.revoked_at !== null) {
    throw new EmbeddedClassroomError('launch_revoked', 'Launch grant was revoked.');
  }
  if (now.getTime() > instant(grant.expires_at)) {
    throw new EmbeddedClassroomError('grant_expired', 'Launch grant expired.');
  }
  const sameBinding =
    grant.scope.product === context.scope.product &&
    grant.scope.runtime_tier === context.scope.runtime_tier &&
    grant.scope.verification_environment_id === context.scope.verification_environment_id &&
    grant.student_id === context.actor.student_id &&
    grant.household_id === context.actor.household_id &&
    grant.authenticated_session_id === context.actor.authenticated_session_id &&
    grant.occurrence_id === context.occurrence.id &&
    grant.registrant_id === context.registrant_id;
  const sameVersions =
    grant.student_version === context.student_version &&
    grant.enrollment_version === context.enrollment_version &&
    grant.access_version === context.access_version &&
    grant.consent_version_digest === context.current_consent_version_digest &&
    grant.registrant_version === context.registrant_version &&
    grant.occurrence_version === context.occurrence.version;
  if (!sameBinding || !sameVersions) {
    throw new EmbeddedClassroomError(
      'authorization_changed',
      'Launch authorization changed before bootstrap.',
    );
  }
}

function assertContext(context: EmbeddedJoinContext): void {
  if (
    context.actor.student_id !== context.consent_subject.student_id ||
    context.actor.household_id !== context.consent_subject.household_id ||
    context.actor.role !== 'student'
  ) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Join context must bind the authenticated Student and household.',
    );
  }
  if (!SHA256.test(context.registrant_ref_digest)) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Registrant evidence must be a SHA-256 digest.',
    );
  }
  if (!SHA256.test(context.current_consent_version_digest)) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Consent version evidence must be a SHA-256 digest.',
    );
  }
}

function instant(value: string): number {
  const result = new Date(value).getTime();
  if (!Number.isFinite(result)) {
    throw new EmbeddedClassroomError('invalid_contract', 'Timestamp must be valid.');
  }
  return result;
}

function allowed(): EmbeddedJoinDecision {
  return { allowed: true, safe_code: 'join_allowed' };
}

function denied(safe_code: Exclude<EmbeddedJoinDecision, { allowed: true }>['safe_code']) {
  return { allowed: false as const, safe_code };
}
