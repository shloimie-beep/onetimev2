import { describe, expect, it } from 'vitest';

import {
  CANONICAL_ZOOM_MEETING_SETTINGS,
  ZOOM_BOOTSTRAP_TTL_MS,
  ZOOM_CONSTANT_PARENT_ROUTE,
  ZOOM_CONSTANT_STUDENT_ROUTE,
  ZOOM_DEVICE_HEARTBEAT_INTERVAL_MS,
  ZOOM_DEVICE_LEASE_TTL_MS,
  type ZoomStudentPreparationInput,
} from '../../../../contracts/src/classroom/zoom-preparation/index.ts';
import type {
  ClassOccurrenceRecord,
  ClassroomAdminActor,
} from '../../../../contracts/src/classes/core/index.ts';
import type { ProviderRegistryBinding } from '../../../../contracts/src/providers/v21-provider-core.ts';
import {
  acquireLiveStudentSession,
  buildPreparationPreview,
  buildRosterSnapshot,
  confirmPreparation,
  consumeLaunchGrant,
  createPreparationDraft,
  createProvisioningPlan,
  deriveStudentJoinState,
  heartbeatLiveStudentSession,
  issueLaunchGrant,
  planDisposableCanaryCleanup,
  verifyMeetingReadback,
  verifyRegistrantReadbacks,
  zoomPreparationSha256,
} from './index.ts';

const scope = { accountKey: 'account-1', productKey: 'one-time' };
const actor: ClassroomAdminActor = {
  ...scope,
  principalId: 'admin-1',
  role: 'admin',
};
const generatedAt = '2026-07-29T19:00:00.000Z';
const occurrence: ClassOccurrenceRecord = {
  ...scope,
  id: 'occurrence-1',
  seriesId: 'canonical-class',
  localClassDate: '2026-07-30',
  startsAt: '2026-07-30T16:00:00.000Z',
  scheduledEndsAt: '2026-07-30T17:00:00.000Z',
  joinOpensAt: '2026-07-30T15:50:00.000Z',
  joinClosesAt: '2026-07-30T17:15:00.000Z',
  state: 'scheduled',
  scheduleVersion: 2,
  version: 4,
  createdAt: generatedAt,
  updatedAt: generatedAt,
};
const binding: ProviderRegistryBinding = {
  registry_binding_key: 'zoom-production-binding',
  provider: 'zoom',
  scope: {
    product: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'provider_sandbox',
  },
  provider_account_ref_hash: zoomPreparationSha256('zoom-account'),
  allowed_operation_types: ['zoom.meeting.create_or_reuse', 'zoom.registrant.create_or_reuse'],
  mutation_policy: 'allowed',
  active: true,
};

function candidate(index: number, overrides: Partial<ZoomStudentPreparationInput> = {}) {
  const studentId = `student-${index}`;
  const householdId = `household-${index}`;
  return {
    student: {
      ...scope,
      studentId,
      householdId,
      state: 'active',
      version: 3,
    },
    enrollment: {
      ...scope,
      id: `enrollment-${index}`,
      seriesId: occurrence.seriesId,
      studentId,
      householdId,
      state: 'active',
      source: 'student_activation',
      effectiveAt: generatedAt,
      idempotencyKey: `enroll-${index}`,
      auditRef: `audit-${index}`,
      version: 2,
    },
    householdAccess: 'active',
    serviceAccountConsent: 'accepted',
    serviceAccountConsentVersion: 2,
    recordingParticipationConsent: 'accepted',
    recordingParticipationConsentVersion: 3,
    memberRecognitionConsent: 'accepted',
    memberRecognitionConsentVersion: 1,
    approvedClassroomName: `Student ${index}`,
    ...overrides,
  } satisfies ZoomStudentPreparationInput;
}

function prepared(students = [candidate(1), candidate(2), candidate(3)]) {
  const draft = createPreparationDraft({
    scope,
    occurrence,
    rosterVersion: 5,
    trigger: 'automatic_24h',
    occurredAt: generatedAt,
  });
  const roster = buildRosterSnapshot({
    scope,
    occurrence,
    rosterVersion: 5,
    students,
    generatedAt,
  });
  const previewed = buildPreparationPreview({
    saga: draft,
    occurrence,
    roster,
    occurredAt: generatedAt,
  });
  const confirmed = confirmPreparation({
    actor,
    saga: previewed.saga,
    expectedVersion: previewed.saga.version,
    previewDigest: previewed.preview.digest,
    occurredAt: generatedAt,
  });
  const plan = createProvisioningPlan({
    saga: confirmed,
    occurrence,
    roster,
    binding,
    occurredAt: generatedAt,
  });
  return { draft, roster, previewed, confirmed, plan };
}

function providerVerified() {
  const data = prepared();
  const meetingDigest = zoomPreparationSha256('meeting');
  const resource = verifyMeetingReadback({
    resource: data.plan.resource,
    occurrence,
    operation: data.plan.operations[0]!,
    readback: {
      operationId: data.plan.operations[0]!.job_id,
      providerMeetingRefDigest: meetingDigest,
      occurrenceId: occurrence.id,
      startTime: occurrence.startsAt,
      durationMinutes: 60,
      timeZone: 'Asia/Jerusalem',
      settings: CANONICAL_ZOOM_MEETING_SETTINGS,
      observedAt: generatedAt,
      reconciliationDigest: zoomPreparationSha256('meeting-readback'),
    },
  });
  const registrants = verifyRegistrantReadbacks({
    resource,
    registrants: data.plan.registrants,
    operations: data.plan.operations,
    readbacks: data.plan.registrants.map((registrant, index) => ({
      operationId: data.plan.operations[index + 1]!.job_id,
      providerMeetingRefDigest: meetingDigest,
      providerRegistrantRefDigest: zoomPreparationSha256(`registrant-${index}`),
      occurrenceId: occurrence.id,
      studentId: registrant.studentId,
      active: true,
      observedAt: generatedAt,
      reconciliationDigest: zoomPreparationSha256(`registrant-readback-${index}`),
    })),
  });
  return { ...data, resource, registrants };
}

describe('P17 Zoom preparation acceptance', () => {
  it('OTV2-CLASSROOM-068-AC01 validates exact occurrence and roster versions', () => {
    const excluded = candidate(4, { recordingParticipationConsent: 'withdrawn' });
    const data = prepared([candidate(1), candidate(2), excluded]);
    expect(data.roster).toMatchObject({
      occurrenceId: occurrence.id,
      scheduleVersion: occurrence.scheduleVersion,
      rosterVersion: 5,
    });
    expect(data.roster.entries.find((entry) => entry.studentId === 'student-4')).toMatchObject({
      decision: 'excluded',
      safeReason: 'recording_participation_consent_missing',
    });
    expect(data.previewed.saga.state).toBe('preview_ready');
    expect(data.confirmed.confirmedPreviewDigest).toBe(data.previewed.preview.digest);
  });

  it('OTV2-CLASSROOM-069-AC01 plans one stable app-owned meeting per occurrence', () => {
    const first = prepared();
    const replay = prepared();
    expect(first.plan.resource).toMatchObject({
      occurrenceId: occurrence.id,
      purpose: 'normal_class',
      provider: 'zoom',
      state: 'provisioning',
    });
    expect(replay.plan.resource.id).toBe(first.plan.resource.id);
    expect(
      first.plan.operations.filter(
        (operation) => operation.operation_type === 'zoom.meeting.create_or_reuse',
      ),
    ).toHaveLength(1);
  });

  it('OTV2-CLASSROOM-070-AC01 creates one distinct registrant per included Student', () => {
    const data = providerVerified();
    expect(data.registrants).toHaveLength(3);
    expect(new Set(data.registrants.map((registrant) => registrant.studentId)).size).toBe(3);
    expect(
      new Set(data.registrants.map((registrant) => registrant.providerRegistrantRefDigest)).size,
    ).toBe(3);
    expect(data.registrants.every((registrant) => registrant.state === 'active')).toBe(true);
  });

  it('OTV2-CLASSROOM-071-AC01 exposes constant secure Join Class state and one-use bootstrap', () => {
    const data = providerVerified();
    const readyOccurrence = { ...occurrence, state: 'ready' as const };
    const now = '2026-07-30T15:55:00.000Z';
    expect(
      deriveStudentJoinState({
        occurrence: readyOccurrence,
        resource: data.resource,
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        now,
      }),
    ).toEqual({
      route: ZOOM_CONSTANT_STUDENT_ROUTE,
      available: true,
      safeCode: 'join_available',
      occurrenceId: occurrence.id,
      exposesRawZoomUrl: false,
    });
    const secret = 'opaque-single-use-secret';
    const grant = issueLaunchGrant({
      scope,
      studentId: 'student-1',
      householdId: 'household-1',
      studentSessionId: 'session-1',
      deviceLineageId: 'tablet-1',
      occurrence: readyOccurrence,
      registrant: data.registrants[0]!,
      currentStudentAuthorized: true,
      grantDigest: zoomPreparationSha256(secret),
      studentVersion: 3,
      enrollmentVersion: 2,
      serviceAccountConsentVersion: 2,
      recordingParticipationConsentVersion: 3,
      occurredAt: now,
    });
    expect(Date.parse(grant.expiresAt) - Date.parse(grant.issuedAt)).toBe(ZOOM_BOOTSTRAP_TTL_MS);
    const consumed = consumeLaunchGrant({
      grant,
      presentedSecret: secret,
      currentStudentAuthorized: true,
      studentSessionId: 'session-1',
      deviceLineageId: 'tablet-1',
      sdkBootstrap: {
        meetingRef: 'opaque-meeting-ref',
        registrantRef: 'opaque-registrant-ref',
        sdkSignature: 'ephemeral-signature',
        displayName: 'Student 1',
        expiresAt: grant.expiresAt,
        cacheControl: 'private, no-store',
        referrerPolicy: 'no-referrer',
        durable: false,
      },
      occurredAt: '2026-07-30T15:55:20.000Z',
    });
    expect(consumed.grant.consumedAt).toBeDefined();
    expect(() =>
      consumeLaunchGrant({
        ...consumed,
        grant: consumed.grant,
        presentedSecret: secret,
        currentStudentAuthorized: true,
        studentSessionId: 'session-1',
        deviceLineageId: 'tablet-1',
        sdkBootstrap: consumed.bootstrap,
        occurredAt: '2026-07-30T15:55:30.000Z',
      }),
    ).toThrow('single-use');
  });

  it('OTV2-CLASSROOM-072-AC01 builds household reminders with labels and safe app paths only', () => {
    const data = prepared([
      candidate(1, {
        student: { ...candidate(1).student, householdId: 'household-shared' },
        enrollment: {
          ...candidate(1).enrollment,
          householdId: 'household-shared',
        },
      }),
      candidate(2, {
        student: { ...candidate(2).student, householdId: 'household-shared' },
        enrollment: {
          ...candidate(2).enrollment,
          householdId: 'household-shared',
        },
      }),
    ]);
    expect(data.previewed.preview.householdReminders).toEqual([
      {
        householdId: 'household-shared',
        studentLabels: ['Student 1', 'Student 2'],
        appPath: ZOOM_CONSTANT_PARENT_ROUTE,
        scheduledFor: '2026-07-30T15:30:00.000Z',
      },
    ]);
    expect(JSON.stringify(data.previewed.preview)).not.toMatch(/zoom\.us|pwd=|https?:\/\//);
  });

  it('OTV2-CLASSROOM-074-AC01 enforces muted-on-entry', () => {
    expect(CANONICAL_ZOOM_MEETING_SETTINGS.muteUponEntry).toBe(true);
    expect(prepared().plan.resource.settings.muteUponEntry).toBe(true);
  });

  it('OTV2-CLASSROOM-076-AC01 permits three separate Student tablet leases', () => {
    const sessions = [1, 2, 3].map((index) =>
      acquireLiveStudentSession({
        scope,
        existing: null,
        studentId: `student-${index}`,
        occurrenceId: occurrence.id,
        studentSessionId: `session-${index}`,
        deviceLineageId: `tablet-${index}`,
        occurredAt: '2026-07-30T15:55:00.000Z',
      }),
    );
    expect(sessions.map((result) => result.disposition)).toEqual([
      'acquired',
      'acquired',
      'acquired',
    ]);
    expect(ZOOM_DEVICE_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(
      Date.parse(sessions[0]!.session.leaseExpiresAt) -
        Date.parse(sessions[0]!.session.lastHeartbeatAt),
    ).toBe(ZOOM_DEVICE_LEASE_TTL_MS);
    expect(
      heartbeatLiveStudentSession({
        session: sessions[0]!.session,
        studentSessionId: 'session-1',
        deviceLineageId: 'tablet-1',
        occurredAt: '2026-07-30T15:55:30.000Z',
      }).leaseExpiresAt,
    ).toBe('2026-07-30T15:57:00.000Z');
  });

  it('OTV2-CLASSROOM-077-AC01 denies sibling/cross-household and second-device joins', () => {
    const existing = acquireLiveStudentSession({
      scope,
      existing: null,
      studentId: 'student-1',
      occurrenceId: occurrence.id,
      studentSessionId: 'session-1',
      deviceLineageId: 'tablet-1',
      occurredAt: '2026-07-30T15:55:00.000Z',
    }).session;
    expect(() =>
      acquireLiveStudentSession({
        scope,
        existing,
        studentId: 'student-1',
        occurrenceId: occurrence.id,
        studentSessionId: 'sibling-session',
        deviceLineageId: 'tablet-2',
        occurredAt: '2026-07-30T15:55:10.000Z',
      }),
    ).toThrow('another device');
    const data = providerVerified();
    expect(() =>
      issueLaunchGrant({
        scope,
        studentId: 'student-2',
        householdId: 'household-2',
        studentSessionId: 'session-2',
        deviceLineageId: 'tablet-2',
        occurrence: { ...occurrence, state: 'ready' },
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        grantDigest: zoomPreparationSha256('secret'),
        studentVersion: 3,
        enrollmentVersion: 2,
        serviceAccountConsentVersion: 2,
        recordingParticipationConsentVersion: 3,
        occurredAt: '2026-07-30T15:55:00.000Z',
      }),
    ).toThrow('required');
  });

  it('OTV2-CLASSROOM-079-AC01 isolates disposable canary cleanup from normal classroom', () => {
    const data = prepared();
    expect(
      planDisposableCanaryCleanup({
        purpose: 'disposable_canary',
        providerResourceRefDigest: zoomPreparationSha256('old-canary'),
        canonicalClassroomResourceIds: [data.plan.resource.id],
      }),
    ).toMatchObject({
      cleanupAuthorized: true,
      canonicalClassroomResourceIds: [data.plan.resource.id],
      blocksNormalClassroom: false,
    });
    expect(() =>
      planDisposableCanaryCleanup({
        purpose: 'normal_class',
        providerResourceRefDigest: zoomPreparationSha256('canonical'),
        canonicalClassroomResourceIds: [data.plan.resource.id],
      }),
    ).toThrow('disposable canary');
  });

  it('OTV2-CLASSROOM-188-AC01 locks every participant and recording setting', () => {
    expect(CANONICAL_ZOOM_MEETING_SETTINGS).toMatchObject({
      waitingRoom: false,
      participantRename: false,
      participantChat: false,
      participantScreenSharing: false,
      participantFileTransfer: false,
      participantInvite: false,
      muteUponEntry: true,
      autoRecording: 'none',
      cloudRecording: false,
      localRecording: false,
    });
  });
});
