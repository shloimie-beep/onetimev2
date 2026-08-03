import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type {
  AttendanceEvent,
  EmbeddedClassroomRepository,
  EmbeddedJoinContext,
  LaunchGrantRecord,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  EMBEDDED_CLASSROOM_FEATURE_ID,
  EMBEDDED_CLASSROOM_MOUNT_PATH,
  createEmbeddedClassroomFeatureComposition,
  isEmbeddedClassroomInstalledRuntimeReceipt,
} from './composition.ts';

const NOW = new Date('2026-07-28T17:00:00.000Z');
const HASH = 'a'.repeat(64);
const servers: Array<ReturnType<express.Express['listen']>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P18 embedded-classroom composition', () => {
  it('constructs exactly one repository with the exact P22 callback and issues an authentic receipt', async () => {
    let storedGrant: LaunchGrantRecord | null = null;
    const repository = repositoryFixture({
      insertLaunchGrant: vi.fn(async (grant: LaunchGrantRecord) => {
        storedGrant = grant;
        return 'inserted' as const;
      }),
      loadLaunchGrant: vi.fn(async () => storedGrant),
    });
    const attendanceProjectionChanges = {
      onAttendanceProjectionChange: vi.fn(async () => undefined),
    };
    const repositoryFactory = vi.fn((_pool, callback) => {
      expect(callback).toBe(attendanceProjectionChanges);
      return repository;
    });
    const context = joinContext();
    const composition = createEmbeddedClassroomFeatureComposition({
      attendanceProjectionChanges,
      identities: {
        resolveStudent: async () => ({ scope: context.scope, actor: context.actor }),
        resolveAdmin: async () => null,
      },
      candidateRuntime: {
        contextResolver: {
          resolveForIssue: async () => context,
          resolve: async () => context,
          resolveLiveSession: async () => context,
        },
        sdkBootstrap: {
          createEphemeralBootstrap: async () => sdkBootstrap(),
        },
        providerAttendance: {
          verify: async () => ({
            subject: attendanceSubject(),
            event: providerEvent('provider-left', 'left', '2026-07-28T17:30:00.000Z'),
          }),
        },
      },
      repositoryFactory,
    });

    expect(composition.registration).toMatchObject({
      featureId: EMBEDDED_CLASSROOM_FEATURE_ID,
      contractVersion: '1.0.0',
      mountPath: EMBEDDED_CLASSROOM_MOUNT_PATH,
    });
    expect(composition.readInstalledReceipt()).toBeNull();

    const app = express();
    app.use(express.json());
    app.use(
      composition.registration.mountPath,
      composition.registration.createRouter({
        config: testConfig(),
        pool: unusedPool(),
        distDir: 'unused',
        clock: () => NOW,
      }),
    );
    const baseUrl = await listen(app);

    expect(repositoryFactory).toHaveBeenCalledOnce();
    const receipt = composition.readInstalledReceipt();
    expect(receipt).toEqual({
      feature_id: EMBEDDED_CLASSROOM_FEATURE_ID,
      mount_path: EMBEDDED_CLASSROOM_MOUNT_PATH,
      contract_version: '1.0.0',
    });
    expect(receipt && Object.isFrozen(receipt)).toBe(true);
    expect(isEmbeddedClassroomInstalledRuntimeReceipt(receipt)).toBe(true);
    expect(isEmbeddedClassroomInstalledRuntimeReceipt(receipt ? { ...receipt } : null)).toBe(false);

    const bootstrap = await fetch(`${baseUrl}${EMBEDDED_CLASSROOM_MOUNT_PATH}/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exchange_secret: 'x'.repeat(48) }),
    });
    expect(bootstrap.status).toBe(200);
    expect(repository.insertLaunchGrant).toHaveBeenCalledOnce();
    expect(repository.loadLaunchGrant).toHaveBeenCalledOnce();
    expect(repository.commitBootstrap).toHaveBeenCalledOnce();

    const providerAttendance = await fetch(
      `${baseUrl}${EMBEDDED_CLASSROOM_MOUNT_PATH}/attendance/provider`,
      { method: 'POST' },
    );
    expect(providerAttendance.status).toBe(202);
    expect(repository.loadAttendanceEvidence).toHaveBeenCalledOnce();
    expect(repository.appendAttendance).toHaveBeenCalledOnce();
    expect(repositoryFactory).toHaveBeenCalledOnce();

    expect(() =>
      composition.registration.createRouter({
        config: testConfig(),
        pool: unusedPool(),
        distDir: 'unused',
      }),
    ).toThrow('embedded_classroom_runtime_already_constructed');
    expect(repositoryFactory).toHaveBeenCalledOnce();
  });

  it('captures fail-closed candidate ports without performing eager database work', () => {
    const repository = repositoryFixture();
    const repositoryFactory = vi.fn(() => repository);
    const composition = createEmbeddedClassroomFeatureComposition({
      attendanceProjectionChanges: { onAttendanceProjectionChange: async () => undefined },
      identities: {
        resolveStudent: async () => null,
        resolveAdmin: async () => null,
      },
      repositoryFactory,
    });

    expect(repositoryFactory).not.toHaveBeenCalled();
    expect(composition.readInstalledReceipt()).toBeNull();
    expect(
      isEmbeddedClassroomInstalledRuntimeReceipt({
        feature_id: EMBEDDED_CLASSROOM_FEATURE_ID,
        mount_path: EMBEDDED_CLASSROOM_MOUNT_PATH,
        contract_version: '1.0.0',
      }),
    ).toBe(false);
  });
});

function repositoryFixture(
  overrides: Partial<EmbeddedClassroomRepository> = {},
): EmbeddedClassroomRepository {
  return {
    insertLaunchGrant: vi.fn(async () => 'inserted' as const),
    loadLaunchGrant: vi.fn(async () => null),
    loadLiveSession: vi.fn(async () => null),
    commitBootstrap: vi.fn(async () => true),
    persistLiveSession: vi.fn(async () => true),
    resetStudentLaunch: vi.fn(async () => true),
    loadAttendanceEvidence: vi.fn(async () => ({
      events: [providerEvent('provider-join', 'joined', '2026-07-28T17:00:00.000Z')],
      projection: null,
    })),
    appendAttendance: vi.fn(async () => true),
    ...overrides,
  };
}

function joinContext(): EmbeddedJoinContext {
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
      authenticated_session_id: 'session-1',
      device_lineage_id: 'device-lineage-1',
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

function sdkBootstrap() {
  return {
    sdk_session_ref: 'sdk-session-1',
    sdk_web_version: '3.11.2',
    sdk_signature: 'ephemeral-signature',
    meeting_number: '91234567890',
    meeting_password: 'meeting-password',
    registrant_token: 'registrant-token',
    participant_email: 'zoom-registration+fixture@onetimeonetime.com',
    customer_key: 'zoom_ck_1234567890abcdef12345678',
    participant_display_name: 'Student One',
    recording_capture_active: true,
    leave_path: '/app/classroom' as const,
    issued_at: NOW.toISOString(),
    expires_at: '2026-07-28T17:00:45.000Z',
    role: 0 as const,
  };
}

function attendanceSubject() {
  return {
    scope: joinContext().scope,
    occurrence_id: 'occurrence-1',
    student_id: 'student-1',
    registrant_id: 'registrant-1',
    scheduled_start_at: '2026-07-28T17:00:00.000Z',
    scheduled_end_at: '2026-07-28T18:00:00.000Z',
  };
}

function providerEvent(
  id: string,
  eventKind: 'joined' | 'left',
  observedAt: string,
): AttendanceEvent {
  return {
    attendance_event_id: id,
    scope: joinContext().scope,
    occurrence_id: 'occurrence-1',
    student_id: 'student-1',
    source: 'zoom_provider',
    event_kind: eventKind,
    observed_at: observedAt,
    connection_lineage_id: 'provider-connection-1',
    idempotency_key: `idempotency-${id}`,
    source_event_ref_digest: HASH,
    provider_verified: true,
    correction_intervals: [],
    correction_reason: null,
    correction_admin_id: null,
    audit_ref: null,
  };
}

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    AUTH_CSRF_SECRET: 'test-embedded-classroom-csrf-secret',
  });
}

function unusedPool(): DbPool {
  const unavailable = async () => {
    throw new Error('P18 composition performed unexpected database access.');
  };
  return {
    connect: unavailable,
    query: unavailable,
    end: async () => undefined,
  } as unknown as DbPool;
}

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
