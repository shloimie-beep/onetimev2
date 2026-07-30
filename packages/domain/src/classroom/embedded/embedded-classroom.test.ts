import { describe, expect, it } from 'vitest';
import type {
  AttendanceEvent,
  EmbeddedJoinContext,
  LiveStudentSession,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import {
  CLASSROOM_BOOTSTRAP_TTL_MS,
  CLASSROOM_AUTO_CLOSE_LAG_MS,
  CLASSROOM_CANONICAL_DURATION_MS,
  CLASSROOM_HEARTBEAT_INTERVAL_MS,
  CLASSROOM_JOIN_OPEN_LEAD_MS,
  CLASSROOM_LEASE_TTL_MS,
  CLASSROOM_PREPARATION_LEAD_MS,
  CLASSROOM_REMINDER_LEAD_MS,
  CLASSROOM_ROLLING_HORIZON_DAYS,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import {
  acquireLiveStudentSession,
  consumeLaunchGrant,
  createLaunchGrant,
  decideEmbeddedJoin,
  heartbeatLiveStudentSession,
  reconcileAttendance,
  revokeLiveStudentSession,
} from './index.ts';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const NOW = new Date('2026-07-28T17:00:00.000Z');

describe('embedded classroom domain', () => {
  it('uses exact bootstrap, heartbeat, and lease timings and allows late live join', () => {
    expect([
      CLASSROOM_BOOTSTRAP_TTL_MS,
      CLASSROOM_HEARTBEAT_INTERVAL_MS,
      CLASSROOM_LEASE_TTL_MS,
    ]).toEqual([60_000, 30_000, 90_000]);
    expect([
      CLASSROOM_ROLLING_HORIZON_DAYS,
      CLASSROOM_PREPARATION_LEAD_MS,
      CLASSROOM_REMINDER_LEAD_MS,
      CLASSROOM_JOIN_OPEN_LEAD_MS,
      CLASSROOM_CANONICAL_DURATION_MS,
      CLASSROOM_AUTO_CLOSE_LAG_MS,
    ]).toEqual([90, 86_400_000, 1_800_000, 600_000, 3_600_000, 900_000]);
    const context = joinContext({
      occurrence: {
        ...joinContext().occurrence,
        state: 'live',
        scheduledEndsAt: '2026-07-28T16:55:00.000Z',
        joinClosesAt: '2026-07-28T17:10:00.000Z',
      },
    });
    expect(decideEmbeddedJoin(context, NOW)).toEqual({
      allowed: true,
      safe_code: 'join_allowed',
    });
  });

  it('opens a ready occurrence only at its join window and enforces current recording consent', () => {
    const context = joinContext();
    expect(decideEmbeddedJoin(context, new Date('2026-07-28T16:49:59.999Z'))).toEqual({
      allowed: false,
      safe_code: 'join_not_open',
    });
    const withdrawn = {
      ...context,
      consent_events: [
        context.consent_events[0]!,
        { ...context.consent_events[1]!, choice: 'withdrawn' as const },
      ],
    };
    expect(decideEmbeddedJoin(withdrawn, NOW)).toEqual({
      allowed: false,
      safe_code: 'recording_consent_required',
    });
  });

  it('issues one digest-only 60-second grant and rejects replay or expiry', () => {
    const grant = createLaunchGrant({
      grant_id: 'grant-1',
      grant_key_digest: HASH,
      consent_version_digest: OTHER_HASH,
      context: joinContext(),
      now: NOW,
    });
    expect(grant.expires_at).toBe('2026-07-28T17:01:00.000Z');
    const consumed = consumeLaunchGrant(grant, new Date('2026-07-28T17:00:59.999Z'));
    expect(consumed.used_at).toBe('2026-07-28T17:00:59.999Z');
    expect(() => consumeLaunchGrant(consumed, NOW)).toThrow(/already consumed/i);
    expect(() => consumeLaunchGrant(grant, new Date('2026-07-28T17:01:00.001Z'))).toThrow(
      /expired/i,
    );
  });

  it('permits same-lineage reconnect and denies a second device without revealing it', () => {
    const acquired = acquireLiveStudentSession({
      current: null,
      context: joinContext(),
      live_session_id: 'live-1',
      now: NOW,
    });
    expect(acquired.allowed && acquired.session.lease_expires_at).toBe('2026-07-28T17:01:30.000Z');
    if (!acquired.allowed) throw new Error('fixture acquisition failed');
    const reconnect = acquireLiveStudentSession({
      current: acquired.session,
      context: joinContext(),
      live_session_id: 'ignored-reconnect-id',
      now: new Date('2026-07-28T17:00:30.000Z'),
    });
    expect(reconnect.allowed && reconnect.disposition).toBe('reconnected');
    const secondDevice = acquireLiveStudentSession({
      current: acquired.session,
      context: joinContext({
        actor: { ...joinContext().actor, device_lineage_id: 'device-other' },
      }),
      live_session_id: 'live-2',
      now: new Date('2026-07-28T17:00:30.000Z'),
    });
    expect(secondDevice).toEqual({
      allowed: false,
      disposition: 'second_device_denied',
      safe_code: 'second_device_active',
    });
  });

  it('fences heartbeat, allows acquisition after expiry, and audits Admin reset', () => {
    const current = liveSession();
    const heartbeat = heartbeatLiveStudentSession(current, {
      authenticated_session_id: current.authenticated_session_id,
      device_lineage_id: current.device_lineage_id,
      lease_generation: 1,
      expected_version: 1,
      now: new Date('2026-07-28T17:00:30.000Z'),
    });
    expect(heartbeat.lease_expires_at).toBe('2026-07-28T17:02:00.000Z');
    expect(() =>
      heartbeatLiveStudentSession(current, {
        authenticated_session_id: current.authenticated_session_id,
        device_lineage_id: current.device_lineage_id,
        lease_generation: 2,
        expected_version: 1,
        now: NOW,
      }),
    ).toThrow(/changed/i);
    const reacquired = acquireLiveStudentSession({
      current,
      context: joinContext({
        actor: { ...joinContext().actor, device_lineage_id: 'device-new' },
      }),
      live_session_id: 'live-new',
      now: new Date('2026-07-28T17:01:30.001Z'),
    });
    expect(reacquired.allowed && reacquired.disposition).toBe('reacquired_after_expiry');
    const revoked = revokeLiveStudentSession(current, {
      admin_id: 'admin-1',
      audit_ref: 'audit-reset-1',
      now: NOW,
    });
    expect([revoked.state, revoked.revoked_by_admin_id, revoked.revoke_audit_ref]).toEqual([
      'revoked',
      'admin-1',
      'audit-reset-1',
    ]);
    const reacquiredAfterReset = acquireLiveStudentSession({
      current: revoked,
      context: joinContext({
        actor: { ...joinContext().actor, device_lineage_id: 'device-after-reset' },
      }),
      live_session_id: 'live-after-reset',
      now: new Date('2026-07-28T17:00:40.001Z'),
    });
    expect(reacquiredAfterReset).toMatchObject({
      allowed: true,
      disposition: 'reacquired_after_reset',
      session: {
        live_session_id: 'live-after-reset',
        lease_generation: 2,
        version: 1,
        revoked_at: null,
      },
    });
    expect(revoked).toMatchObject({
      live_session_id: 'live-1',
      state: 'revoked',
      revoked_by_admin_id: 'admin-1',
      revoke_audit_ref: 'audit-reset-1',
    });
  });

  it('uses verified provider intervals, merges overlap, and records mismatch and reconnects', () => {
    const events = [
      event('p1-join', 'zoom_provider', 'joined', '2026-07-28T17:00:00.000Z', 'p1', true),
      event('p1-left', 'zoom_provider', 'left', '2026-07-28T17:20:00.000Z', 'p1', true),
      event('p2-join', 'zoom_provider', 'joined', '2026-07-28T17:15:00.000Z', 'p2', true),
      event('p2-left', 'zoom_provider', 'left', '2026-07-28T17:30:00.000Z', 'p2', true),
      event('c1-join', 'embedded_client', 'joined', '2026-07-28T17:00:00.000Z', 'c1'),
      event('c1-left', 'embedded_client', 'left', '2026-07-28T17:25:00.000Z', 'c1'),
    ];
    const result = reconcileAttendance({
      events,
      scheduled_start_at: '2026-07-28T17:00:00.000Z',
      scheduled_end_at: '2026-07-28T18:00:00.000Z',
      prior_projection: null,
      now: new Date('2026-07-28T18:01:00.000Z'),
    });
    expect(result.total_connected_minutes).toBe(30);
    expect(result.attendance_percentage).toBe(50);
    expect(result.reconnect_count).toBe(1);
    expect(result.reconciliation_state).toBe('provider_mismatch');
  });

  it('applies the latest audited correction without erasing source events', () => {
    const correction = {
      ...event(
        'correction',
        'admin_correction',
        'manual_correction',
        '2026-07-28T18:05:00.000Z',
        'admin',
      ),
      correction_intervals: [
        {
          joined_at: '2026-07-28T17:00:00.000Z',
          left_at: '2026-07-28T18:00:00.000Z',
        },
      ],
      correction_reason: 'verified_operator_correction',
      correction_admin_id: 'admin-1',
      audit_ref: 'audit-correction-1',
    } satisfies AttendanceEvent;
    const result = reconcileAttendance({
      events: [
        event('client-join', 'embedded_client', 'joined', '2026-07-28T17:10:00.000Z', 'c1'),
        event('client-left', 'embedded_client', 'left', '2026-07-28T17:20:00.000Z', 'c1'),
        correction,
      ],
      scheduled_start_at: '2026-07-28T17:00:00.000Z',
      scheduled_end_at: '2026-07-28T18:00:00.000Z',
      prior_projection: null,
      now: new Date('2026-07-28T18:06:00.000Z'),
    });
    expect(result.reconciliation_state).toBe('admin_corrected');
    expect(result.attendance_percentage).toBe(100);
    expect(result.source_event_count).toBe(3);
    expect(result.manual_correction_reason).toBe('verified_operator_correction');
  });
});

function joinContext(patch: Partial<EmbeddedJoinContext> = {}): EmbeddedJoinContext {
  const actor = {
    role: 'student' as const,
    student_id: 'student-1',
    household_id: 'household-1',
    authenticated_session_id: 'student-session-1',
    device_lineage_id: 'device-1',
    csrf_verified: true,
  };
  const context: EmbeddedJoinContext = {
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    actor,
    occurrence: {
      accountKey: 'account-1',
      productKey: 'one_time_mishnayos',
      id: 'occurrence-1',
      seriesId: 'canonical-class',
      localClassDate: '2026-07-28',
      startsAt: '2026-07-28T17:00:00.000Z',
      scheduledEndsAt: '2026-07-28T18:00:00.000Z',
      joinOpensAt: '2026-07-28T16:50:00.000Z',
      joinClosesAt: '2026-07-28T18:15:00.000Z',
      state: 'ready',
      scheduleVersion: 1,
      version: 2,
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T16:00:00.000Z',
    },
    student_state: 'active',
    student_version: 3,
    enrollment_state: 'active',
    enrollment_version: 4,
    access_state: 'active',
    access_version: 5,
    registrant_state: 'active',
    registrant_id: 'registrant-1',
    registrant_ref_digest: HASH,
    registrant_version: 6,
    consent_subject: {
      student_id: 'student-1',
      household_id: 'household-1',
      relationship: 'dependent',
      owner_adult_id: 'adult-1',
      self_adult_id: null,
    },
    consent_events: [consent('service_account'), consent('recording_participation')],
    current_policy_versions: policy(),
    current_consent_version_digest: OTHER_HASH,
    launch_revoked: false,
    provider_meeting_ended: false,
  };
  return { ...context, ...patch };
}

function consent(scope: 'service_account' | 'recording_participation') {
  return {
    consent_event_id: `consent-${scope}`,
    idempotency_key: `consent-idempotency-${scope}`,
    canonical_request_hash: HASH,
    actor_kind: 'parent_account_owner' as const,
    actor_account_or_credential_id: 'account-1',
    actor_adult_id: 'adult-1',
    household_id: 'household-1',
    student_id: 'student-1',
    relationship: 'dependent' as const,
    parent_authority_attested: true,
    scope,
    choice: 'granted' as const,
    policy_versions: policy(),
    occurred_at: '2026-07-20T10:00:00.000Z',
    request_correlation_id: `request-${scope}`,
    network_evidence_digest: OTHER_HASH,
    supersedes_consent_event_id: null,
    reason_code: 'account_owner_choice',
  };
}

function policy() {
  return {
    privacy_notice: 'privacy-v1',
    terms: 'terms-v1',
    student_data_recording: 'recording-v1',
    cancellation_refund: null,
  };
}

function liveSession(): LiveStudentSession {
  return {
    live_session_id: 'live-1',
    scope: joinContext().scope,
    student_id: 'student-1',
    household_id: 'household-1',
    occurrence_id: 'occurrence-1',
    authenticated_session_id: 'student-session-1',
    device_lineage_id: 'device-1',
    state: 'active',
    lease_generation: 1,
    last_heartbeat_at: NOW.toISOString(),
    lease_expires_at: '2026-07-28T17:01:30.000Z',
    revoked_at: null,
    revoked_by_admin_id: null,
    revoke_audit_ref: null,
    version: 1,
  };
}

function event(
  id: string,
  source: AttendanceEvent['source'],
  eventKind: AttendanceEvent['event_kind'],
  observedAt: string,
  lineage: string,
  providerVerified = false,
): AttendanceEvent {
  return {
    attendance_event_id: `event-${id}`,
    scope: joinContext().scope,
    occurrence_id: 'occurrence-1',
    student_id: 'student-1',
    source,
    event_kind: eventKind,
    observed_at: observedAt,
    connection_lineage_id: lineage,
    idempotency_key: `idempotency-${id}`,
    source_event_ref_digest: HASH,
    provider_verified: providerVerified,
    correction_intervals: [],
    correction_reason: null,
    correction_admin_id: null,
    audit_ref: null,
  };
}
