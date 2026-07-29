import type {
  EmbeddedJoinContext,
  LaunchGrantRecord,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import { CLASSROOM_BOOTSTRAP_TTL_MS } from '../../../../contracts/src/classroom/embedded/index.ts';
import { EmbeddedClassroomError } from './errors.ts';
import { decideEmbeddedJoin } from './join-policy.ts';

export function createLaunchGrant(input: {
  grant_id: string;
  grant_key_digest: string;
  context: EmbeddedJoinContext;
  consent_version_digest: string;
  now: Date;
}): LaunchGrantRecord {
  const decision = decideEmbeddedJoin(input.context, input.now);
  if (!decision.allowed) {
    throw new EmbeddedClassroomError(decision.safe_code, 'Student is not eligible to join.');
  }
  assertDigest(input.grant_key_digest);
  assertDigest(input.consent_version_digest);
  return {
    grant_id: required(input.grant_id),
    grant_key_digest: input.grant_key_digest,
    scope: input.context.scope,
    student_id: input.context.actor.student_id,
    household_id: input.context.actor.household_id,
    authenticated_session_id: input.context.actor.authenticated_session_id,
    occurrence_id: input.context.occurrence.id,
    registrant_id: input.context.registrant_id,
    issued_at: input.now.toISOString(),
    expires_at: new Date(input.now.getTime() + CLASSROOM_BOOTSTRAP_TTL_MS).toISOString(),
    used_at: null,
    revoked_at: null,
    student_version: input.context.student_version,
    enrollment_version: input.context.enrollment_version,
    access_version: input.context.access_version,
    consent_version_digest: input.consent_version_digest,
    registrant_version: input.context.registrant_version,
    occurrence_version: input.context.occurrence.version,
    version: 1,
  };
}

export function consumeLaunchGrant(grant: LaunchGrantRecord, now: Date): LaunchGrantRecord {
  if (grant.used_at !== null) {
    throw new EmbeddedClassroomError('grant_consumed', 'Launch grant was already consumed.');
  }
  if (grant.revoked_at !== null) {
    throw new EmbeddedClassroomError('launch_revoked', 'Launch grant was revoked.');
  }
  if (now.getTime() > new Date(grant.expires_at).getTime()) {
    throw new EmbeddedClassroomError('grant_expired', 'Launch grant expired.');
  }
  return { ...grant, used_at: now.toISOString(), version: grant.version + 1 };
}

function assertDigest(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new EmbeddedClassroomError('invalid_contract', 'Digest must be lowercase SHA-256.');
  }
}

function required(value: string): string {
  if (value.trim() === '') {
    throw new EmbeddedClassroomError('invalid_contract', 'Opaque identifier is required.');
  }
  return value;
}
