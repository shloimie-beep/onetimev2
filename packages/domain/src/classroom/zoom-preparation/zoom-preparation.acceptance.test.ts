import { describe, expect, it } from 'vitest';

import {
  CANONICAL_ZOOM_MEETING_SETTINGS,
  ZOOM_CONSTANT_PARENT_ROUTE,
  ZOOM_CONSTANT_STUDENT_ROUTE,
  type ZoomStudentPreparationInput,
} from '../../../../contracts/src/classroom/zoom-preparation/index.ts';
import type {
  ClassOccurrenceRecord,
  ClassroomAdminActor,
} from '../../../../contracts/src/classes/core/index.ts';
import type { ProviderRegistryBinding } from '../../../../contracts/src/providers/v21-provider-core.ts';
import {
  buildPreparationPreview,
  buildRosterSnapshot,
  confirmPreparation,
  createPreparationDraft,
  createProvisioningPlan,
  deriveStudentJoinState,
  finalizeProvisioning,
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
    householdAccessVersion: 7,
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

function prepared(
  students = [candidate(1), candidate(2), candidate(3)],
  sourceOccurrence = occurrence,
  rosterVersion = 5,
) {
  const draft = createPreparationDraft({
    scope,
    occurrence: sourceOccurrence,
    rosterVersion,
    trigger: 'automatic_24h',
    occurredAt: generatedAt,
  });
  const roster = buildRosterSnapshot({
    scope,
    occurrence: sourceOccurrence,
    rosterVersion,
    students,
    generatedAt,
  });
  const previewed = buildPreparationPreview({
    saga: draft,
    occurrence: sourceOccurrence,
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
    occurrence: sourceOccurrence,
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
    expect(data.roster.entries[0]).toMatchObject({
      studentVersion: 3,
      enrollmentVersion: 2,
      householdAccessVersion: 7,
      serviceAccountConsentVersion: 2,
      recordingParticipationConsentVersion: 3,
      memberRecognitionConsentVersion: 1,
    });
    expect(data.previewed.saga.state).toBe('preview_ready');
    expect(data.confirmed.confirmedPreviewDigest).toBe(data.previewed.preview.digest);
    expect(() =>
      buildRosterSnapshot({
        scope,
        occurrence,
        rosterVersion: 6,
        students: [
          candidate(1, {
            enrollment: { ...candidate(1).enrollment, studentId: 'student-2' },
          }),
        ],
        generatedAt,
      }),
    ).toThrow('exact Student and household');
    expect(() =>
      buildRosterSnapshot({
        scope,
        occurrence,
        rosterVersion: 6,
        students: [
          candidate(1, {
            enrollment: { ...candidate(1).enrollment, householdId: 'household-2' },
          }),
        ],
        generatedAt,
      }),
    ).toThrow('exact Student and household');
  });

  it('OTV2-CLASSROOM-069-AC01 plans one stable app-owned meeting per occurrence', () => {
    const first = prepared();
    const replay = prepared(
      undefined,
      { ...occurrence, scheduleVersion: occurrence.scheduleVersion + 1, version: 5 },
      6,
    );
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
    expect(replay.plan.registrants.map((registrant) => registrant.id)).toEqual(
      first.plan.registrants.map((registrant) => registrant.id),
    );
    expect(() =>
      createProvisioningPlan({
        saga: first.confirmed,
        occurrence: { ...occurrence, version: occurrence.version + 1 },
        roster: first.roster,
        binding,
        occurredAt: generatedAt,
      }),
    ).toThrow('exact confirmed occurrence');
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

  it('OTV2-CLASSROOM-071-AC01 exposes only constant secure Join Class availability', () => {
    const data = providerVerified();
    const readyOccurrence = { ...occurrence, state: 'ready' as const };
    const now = '2026-07-30T15:55:00.000Z';
    expect(
      deriveStudentJoinState({
        scope,
        studentId: 'student-1',
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
    expect(
      deriveStudentJoinState({
        scope,
        studentId: 'student-2',
        occurrence: readyOccurrence,
        resource: data.resource,
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        now,
      }),
    ).toMatchObject({ available: false, safeCode: 'registrant_not_ready' });
    expect(
      deriveStudentJoinState({
        scope,
        studentId: 'student-1',
        occurrence: readyOccurrence,
        resource: { ...data.resource, occurrenceId: 'other-occurrence' },
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        now,
      }),
    ).toMatchObject({ available: false, safeCode: 'preparation_pending' });
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

  it('OTV2-CLASSROOM-076-AC01 exposes independent join availability for three Students', () => {
    const data = providerVerified();
    const readyOccurrence = { ...occurrence, state: 'ready' as const };
    const states = data.registrants.map((registrant) =>
      deriveStudentJoinState({
        scope,
        studentId: registrant.studentId,
        occurrence: readyOccurrence,
        resource: data.resource,
        registrant,
        currentStudentAuthorized: true,
        now: '2026-07-30T15:55:00.000Z',
      }),
    );
    expect(states).toHaveLength(3);
    expect(states.every((state) => state.available && !state.exposesRawZoomUrl)).toBe(true);
  });

  it('OTV2-CLASSROOM-077-AC01 denies cross-Student and cross-scope join availability', () => {
    const data = providerVerified();
    const readyOccurrence = { ...occurrence, state: 'ready' as const };
    expect(
      deriveStudentJoinState({
        scope,
        studentId: 'student-2',
        occurrence: readyOccurrence,
        resource: data.resource,
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        now: '2026-07-30T15:55:00.000Z',
      }),
    ).toMatchObject({ available: false, safeCode: 'registrant_not_ready' });
    expect(
      deriveStudentJoinState({
        scope,
        studentId: 'student-1',
        occurrence: { ...readyOccurrence, accountKey: 'other-account' },
        resource: data.resource,
        registrant: data.registrants[0]!,
        currentStudentAuthorized: true,
        now: '2026-07-30T15:55:00.000Z',
      }),
    ).toMatchObject({ available: false, safeCode: 'student_not_authorized' });
  });

  it('OTV2-CLASSROOM-079-AC01 isolates disposable canary cleanup from normal classroom', () => {
    const data = prepared();
    const canonicalProviderResourceRefDigest = zoomPreparationSha256('canonical');
    const canaryDigest = zoomPreparationSha256('old-canary');
    const canonicalSet = [canonicalProviderResourceRefDigest];
    const registryEvidence = {
      registryBindingKey: binding.registry_binding_key,
      purpose: 'disposable_canary' as const,
      providerResourceRefDigest: canaryDigest,
      canonicalResourceSetDigest: zoomPreparationSha256(JSON.stringify(canonicalSet)),
      reconciliationDigest: zoomPreparationSha256('canary-registry-readback'),
      observedAt: generatedAt,
    };
    expect(
      planDisposableCanaryCleanup({
        purpose: 'disposable_canary',
        providerResourceRefDigest: canaryDigest,
        canonicalProviderResourceRefDigests: canonicalSet,
        registryEvidence,
      }),
    ).toMatchObject({
      cleanupAuthorized: true,
      canonicalProviderResourceRefDigests: canonicalSet,
      blocksNormalClassroom: false,
    });
    expect(() =>
      planDisposableCanaryCleanup({
        purpose: 'normal_class',
        providerResourceRefDigest: canonicalProviderResourceRefDigest,
        canonicalProviderResourceRefDigests: canonicalSet,
        registryEvidence: {
          ...registryEvidence,
          providerResourceRefDigest: canonicalProviderResourceRefDigest,
        },
      }),
    ).toThrow('disposable canary');
    expect(() =>
      planDisposableCanaryCleanup({
        purpose: 'disposable_canary',
        providerResourceRefDigest: canonicalProviderResourceRefDigest,
        canonicalProviderResourceRefDigests: canonicalSet,
        registryEvidence: {
          ...registryEvidence,
          providerResourceRefDigest: canonicalProviderResourceRefDigest,
        },
      }),
    ).toThrow('disposable canary');
    expect(data.plan.resource.id).toBeTruthy();
  });

  it('rejects duplicate accepted provider results and readback extras/cross-types', () => {
    const data = prepared();
    const accepted = {
      operation: data.plan.operations[0]!,
      outcome: {
        kind: 'accepted' as const,
        provider_acceptance_digest: zoomPreparationSha256('accepted'),
        completed_locally: true,
      },
    };
    expect(() =>
      finalizeProvisioning({
        saga: data.plan.saga,
        results: [accepted, accepted],
        occurredAt: generatedAt,
      }),
    ).toThrow('unique');

    const verified = providerVerified();
    const meetingOperation = verified.plan.operations[0]!;
    expect(() =>
      verifyMeetingReadback({
        resource: verified.plan.resource,
        occurrence,
        operation: { ...meetingOperation, operation_type: 'zoom.registrant.create_or_reuse' },
        readback: {
          operationId: meetingOperation.job_id,
          providerMeetingRefDigest: zoomPreparationSha256('meeting'),
          occurrenceId: occurrence.id,
          startTime: occurrence.startsAt,
          durationMinutes: 60,
          timeZone: 'Asia/Jerusalem',
          settings: CANONICAL_ZOOM_MEETING_SETTINGS,
          observedAt: generatedAt,
          reconciliationDigest: zoomPreparationSha256('meeting-readback'),
        },
      }),
    ).toThrow('exact occurrence');
    expect(() =>
      verifyRegistrantReadbacks({
        resource: verified.resource,
        registrants: verified.plan.registrants,
        operations: verified.plan.operations,
        readbacks: [
          ...verified.plan.registrants.map((registrant, index) => ({
            operationId: verified.plan.operations[index + 1]!.job_id,
            providerMeetingRefDigest: verified.resource.providerMeetingRefDigest!,
            providerRegistrantRefDigest: zoomPreparationSha256(`extra-${index}`),
            occurrenceId: occurrence.id,
            studentId: registrant.studentId,
            active: true as const,
            observedAt: generatedAt,
            reconciliationDigest: zoomPreparationSha256(`extra-readback-${index}`),
          })),
          {
            operationId: zoomPreparationSha256('extra-operation'),
            providerMeetingRefDigest: verified.resource.providerMeetingRefDigest!,
            providerRegistrantRefDigest: zoomPreparationSha256('extra-registrant'),
            occurrenceId: occurrence.id,
            studentId: 'student-extra',
            active: true,
            observedAt: generatedAt,
            reconciliationDigest: zoomPreparationSha256('extra-readback'),
          },
        ],
      }),
    ).toThrow('one distinct registrant');
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
