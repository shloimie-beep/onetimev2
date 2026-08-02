import { describe, expect, it, vi } from 'vitest';
import type {
  EmbeddedClassroomRepository,
  EmbeddedJoinContext,
  LaunchGrantRecord,
  LiveStudentSession,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import { createEmbeddedClassroomService } from './service.ts';

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-07-28T17:00:00.000Z');

describe('embedded classroom service', () => {
  it('issues and rechecks a 60-second launch grant before redemption', async () => {
    const repository = repositoryFixture();
    const service = createEmbeddedClassroomService({
      repository,
      context_resolver: contextResolver(),
      sdk_bootstrap: {
        createEphemeralBootstrap: vi.fn(async () => usableBootstrap()),
      },
    });

    await expect(service.bootstrap({ ...command(), grant_id: 'grant-1' })).resolves.toEqual(
      expect.objectContaining({ disposition: 'ready', safe_code: 'join_allowed' }),
    );
    expect(repository.insertLaunchGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        grant_id: 'grant-1',
        grant_key_digest: HASH,
        issued_at: NOW.toISOString(),
        expires_at: '2026-07-28T17:01:00.000Z',
        student_id: 'student-1',
        occurrence_id: 'occurrence-1',
      }),
    );
  });

  it('commits grant consumption and the lease before returning a minimal no-store SDK bootstrap', async () => {
    const order: string[] = [];
    const repository = repositoryFixture();
    repository.commitBootstrap = vi.fn(async () => {
      order.push('commit');
      return true;
    });
    const createEphemeralBootstrap = vi.fn(async () => {
      order.push('sign');
      return usableBootstrap();
    });
    const service = createEmbeddedClassroomService({
      repository,
      context_resolver: contextResolver(),
      sdk_bootstrap: { createEphemeralBootstrap },
    });

    const result = await service.redeem(command());

    expect(result.disposition).toBe('ready');
    expect(order).toEqual(['commit', 'sign']);
    expect(createEphemeralBootstrap).toHaveBeenCalledOnce();
    expect(result.disposition === 'ready' && result.response_headers).toEqual({
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    });
    expect(JSON.stringify(result)).not.toMatch(/https?:\/\//i);
  });

  it('denies a second device before consuming the grant or invoking the SDK port', async () => {
    const repository = repositoryFixture({
      current: { ...sessionFixture(), device_lineage_id: 'other-device' },
    });
    const createEphemeralBootstrap = vi.fn();
    const service = createEmbeddedClassroomService({
      repository,
      context_resolver: contextResolver(),
      sdk_bootstrap: { createEphemeralBootstrap },
    });

    await expect(service.redeem(command())).resolves.toEqual({
      disposition: 'denied',
      safe_code: 'second_device_active',
    });
    expect(repository.commitBootstrap).not.toHaveBeenCalled();
    expect(createEphemeralBootstrap).not.toHaveBeenCalled();
  });

  it('denies expired grants and missing consent before local or provider work', async () => {
    const expiredRepository = repositoryFixture({
      grant: { ...grantFixture(), expires_at: '2026-07-28T16:59:59.999Z' },
    });
    const sdk = vi.fn();
    const expiredService = createEmbeddedClassroomService({
      repository: expiredRepository,
      context_resolver: contextResolver(),
      sdk_bootstrap: { createEphemeralBootstrap: sdk },
    });
    await expect(expiredService.redeem(command())).resolves.toEqual({
      disposition: 'denied',
      safe_code: 'grant_expired',
    });

    const consentRepository = repositoryFixture();
    const noConsent = {
      ...contextFixture(),
      consent_events: contextFixture().consent_events.slice(0, 1),
    };
    const consentService = createEmbeddedClassroomService({
      repository: consentRepository,
      context_resolver: contextResolver(noConsent),
      sdk_bootstrap: { createEphemeralBootstrap: sdk },
    });
    await expect(consentService.redeem(command())).resolves.toEqual({
      disposition: 'denied',
      safe_code: 'recording_consent_required',
    });
    expect(expiredRepository.commitBootstrap).not.toHaveBeenCalled();
    expect(consentRepository.commitBootstrap).not.toHaveBeenCalled();
    expect(sdk).not.toHaveBeenCalled();
  });

  it('heartbeats with exact fencing and persists an audited Admin reset', async () => {
    const repository = repositoryFixture({ current: sessionFixture() });
    const service = createEmbeddedClassroomService({
      repository,
      context_resolver: contextResolver(),
      sdk_bootstrap: { createEphemeralBootstrap: vi.fn() },
    });
    await expect(
      service.heartbeat({
        scope: contextFixture().scope,
        actor: contextFixture().actor,
        lease_generation: 1,
        expected_version: 1,
        now: new Date('2026-07-28T17:00:30.000Z'),
      }),
    ).resolves.toEqual({
      persisted: true,
      lease_generation: 1,
      version: 2,
      lease_expires_at: '2026-07-28T17:02:00.000Z',
      next_heartbeat_at: '2026-07-28T17:01:00.000Z',
    });
    await expect(
      service.reset({
        scope: contextFixture().scope,
        actor: { role: 'admin', admin_id: 'admin-1', audit_ref: 'audit-reset-1' },
        student_id: 'student-1',
        now: new Date('2026-07-28T17:00:40.000Z'),
      }),
    ).resolves.toEqual({ disposition: 'revoked' });
    expect(repository.persistLiveSession).toHaveBeenCalledOnce();
    expect(repository.resetStudentLaunch).toHaveBeenCalledOnce();
    expect(repository.resetStudentLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        next_session: expect.objectContaining({
          state: 'revoked',
          revoked_by_admin_id: 'admin-1',
          revoke_audit_ref: 'audit-reset-1',
        }),
      }),
    );
  });

  it('derives embedded attendance subject and lineage from the reauthorized live session', async () => {
    const repository = repositoryFixture({ current: sessionFixture() });
    const service = createEmbeddedClassroomService({
      repository,
      context_resolver: contextResolver(),
      sdk_bootstrap: { createEphemeralBootstrap: vi.fn() },
    });

    await expect(
      service.recordClientAttendance({
        scope: contextFixture().scope,
        actor: contextFixture().actor,
        event_kind: 'joined',
        attendance_event_id: 'attendance-1',
        idempotency_key: 'attendance-idempotency-1',
        source_event_ref_digest: HASH,
        now: NOW,
      }),
    ).resolves.toEqual({ disposition: 'accepted' });
    expect(repository.loadAttendanceEvidence).toHaveBeenCalledWith({
      scope: contextFixture().scope,
      occurrence_id: 'occurrence-1',
      student_id: 'student-1',
    });
    expect(repository.appendAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            occurrence_id: 'occurrence-1',
            student_id: 'student-1',
            connection_lineage_id: 'device-1',
            source: 'embedded_client',
            provider_verified: false,
          }),
        ],
        next_projection: expect.objectContaining({
          occurrence_id: 'occurrence-1',
          student_id: 'student-1',
          reconciliation_state: 'provisional',
          source_event_count: 1,
        }),
      }),
    );
  });
});

function command() {
  return {
    actor: contextFixture().actor,
    scope: contextFixture().scope,
    grant_key_digest: HASH,
    live_session_id: 'live-new',
    now: NOW,
  };
}

function repositoryFixture(input?: {
  grant?: LaunchGrantRecord;
  current?: LiveStudentSession | null;
}): EmbeddedClassroomRepository {
  return {
    insertLaunchGrant: vi.fn(async () => 'inserted' as const),
    loadLaunchGrant: vi.fn(async () => input?.grant ?? grantFixture()),
    loadLiveSession: vi.fn(async () => input?.current ?? null),
    commitBootstrap: vi.fn(async () => true),
    persistLiveSession: vi.fn(async () => true),
    resetStudentLaunch: vi.fn(async () => true),
    loadAttendanceEvidence: vi.fn(async () => ({ events: [], projection: null })),
    appendAttendance: vi.fn(async () => true),
  };
}

function usableBootstrap() {
  return {
    sdk_session_ref: 'sdk-session-1',
    sdk_web_version: '3.11.2',
    sdk_signature: 'ephemeral-signature',
    meeting_number: '12345678901',
    meeting_password: 'meeting-password',
    registrant_token: 'registrant-token',
    participant_email: 'student-alias@example.invalid',
    customer_key: 'customer-key',
    participant_display_name: 'Student One',
    recording_capture_active: true,
    leave_path: '/app/classroom' as const,
    issued_at: NOW.toISOString(),
    expires_at: '2026-07-28T17:00:45.000Z',
    role: 0 as const,
  };
}

function contextResolver(context = contextFixture()) {
  return {
    resolveForIssue: vi.fn(async () => context),
    resolve: vi.fn(async () => context),
    resolveLiveSession: vi.fn(async () => context),
  };
}

function grantFixture(): LaunchGrantRecord {
  const context = contextFixture();
  return {
    grant_id: 'grant-1',
    grant_key_digest: HASH,
    scope: context.scope,
    student_id: context.actor.student_id,
    household_id: context.actor.household_id,
    authenticated_session_id: context.actor.authenticated_session_id,
    occurrence_id: context.occurrence.id,
    registrant_id: context.registrant_id,
    issued_at: NOW.toISOString(),
    expires_at: '2026-07-28T17:01:00.000Z',
    used_at: null,
    revoked_at: null,
    student_version: context.student_version,
    enrollment_version: context.enrollment_version,
    access_version: context.access_version,
    consent_version_digest: HASH,
    registrant_version: context.registrant_version,
    occurrence_version: context.occurrence.version,
    version: 1,
  };
}

function sessionFixture(): LiveStudentSession {
  return {
    live_session_id: 'live-1',
    scope: contextFixture().scope,
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

function contextFixture(): EmbeddedJoinContext {
  return {
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    actor: {
      role: 'student',
      student_id: 'student-1',
      household_id: 'household-1',
      authenticated_session_id: 'student-session-1',
      device_lineage_id: 'device-1',
      csrf_verified: true,
    },
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
    current_policy_versions: {
      privacy_notice: 'privacy-v1',
      terms: 'terms-v1',
      student_data_recording: 'recording-v1',
      cancellation_refund: null,
    },
    current_consent_version_digest: HASH,
    launch_revoked: false,
    provider_meeting_ended: false,
  };
}

function consent(scope: 'service_account' | 'recording_participation') {
  return {
    consent_event_id: `consent-${scope}`,
    idempotency_key: `consent-key-${scope}`,
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
    policy_versions: {
      privacy_notice: 'privacy-v1',
      terms: 'terms-v1',
      student_data_recording: 'recording-v1',
      cancellation_refund: null,
    },
    occurred_at: '2026-07-20T10:00:00.000Z',
    request_correlation_id: `request-${scope}`,
    network_evidence_digest: HASH,
    supersedes_consent_event_id: null,
    reason_code: 'account_owner_choice',
  };
}
