import type {
  EmbeddedJoinContext,
  LiveSessionDecision,
  LiveStudentSession,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import { CLASSROOM_LEASE_TTL_MS } from '../../../../contracts/src/classroom/embedded/index.ts';
import { EmbeddedClassroomError } from './errors.ts';

export function acquireLiveStudentSession(input: {
  current: LiveStudentSession | null;
  context: EmbeddedJoinContext;
  live_session_id: string;
  now: Date;
}): LiveSessionDecision {
  const { current, context, now } = input;
  if (current !== null && isActive(current, now)) {
    const sameLineage =
      current.student_id === context.actor.student_id &&
      current.household_id === context.actor.household_id &&
      current.occurrence_id === context.occurrence.id &&
      current.authenticated_session_id === context.actor.authenticated_session_id &&
      current.device_lineage_id === context.actor.device_lineage_id;
    if (!sameLineage) {
      return {
        allowed: false,
        disposition: 'second_device_denied',
        safe_code: 'second_device_active',
      };
    }
    return {
      allowed: true,
      disposition: 'reconnected',
      session: renewed(current, now),
    };
  }

  const nextGeneration = (current?.lease_generation ?? 0) + 1;
  const afterReset = current?.state === 'revoked';
  const session: LiveStudentSession = {
    live_session_id: required(input.live_session_id),
    scope: context.scope,
    student_id: context.actor.student_id,
    household_id: context.actor.household_id,
    occurrence_id: context.occurrence.id,
    authenticated_session_id: context.actor.authenticated_session_id,
    device_lineage_id: context.actor.device_lineage_id,
    state: 'active',
    lease_generation: nextGeneration,
    last_heartbeat_at: now.toISOString(),
    lease_expires_at: leaseExpiry(now),
    revoked_at: null,
    revoked_by_admin_id: null,
    revoke_audit_ref: null,
    version: afterReset ? 1 : (current?.version ?? 0) + 1,
  };
  return {
    allowed: true,
    disposition:
      current === null
        ? 'acquired'
        : afterReset
          ? 'reacquired_after_reset'
          : 'reacquired_after_expiry',
    session,
  };
}

export function heartbeatLiveStudentSession(
  current: LiveStudentSession,
  input: {
    authenticated_session_id: string;
    device_lineage_id: string;
    lease_generation: number;
    expected_version: number;
    now: Date;
  },
): LiveStudentSession {
  if (
    !isActive(current, input.now) ||
    current.authenticated_session_id !== input.authenticated_session_id ||
    current.device_lineage_id !== input.device_lineage_id ||
    current.lease_generation !== input.lease_generation ||
    current.version !== input.expected_version
  ) {
    throw new EmbeddedClassroomError('authorization_changed', 'Live session lease changed.');
  }
  return renewed(current, input.now);
}

export function revokeLiveStudentSession(
  current: LiveStudentSession,
  input: { admin_id: string; audit_ref: string; now: Date },
): LiveStudentSession {
  if (current.state === 'revoked') return current;
  return {
    ...current,
    state: 'revoked',
    revoked_at: input.now.toISOString(),
    revoked_by_admin_id: required(input.admin_id),
    revoke_audit_ref: required(input.audit_ref),
    version: current.version + 1,
  };
}

function isActive(session: LiveStudentSession, now: Date): boolean {
  return session.state === 'active' && new Date(session.lease_expires_at).getTime() > now.getTime();
}

function renewed(session: LiveStudentSession, now: Date): LiveStudentSession {
  return {
    ...session,
    state: 'active',
    last_heartbeat_at: now.toISOString(),
    lease_expires_at: leaseExpiry(now),
    version: session.version + 1,
  };
}

function leaseExpiry(now: Date): string {
  return new Date(now.getTime() + CLASSROOM_LEASE_TTL_MS).toISOString();
}

function required(value: string): string {
  if (value.trim() === '') {
    throw new EmbeddedClassroomError('invalid_contract', 'Opaque identifier is required.');
  }
  return value;
}
