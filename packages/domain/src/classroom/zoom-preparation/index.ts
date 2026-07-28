import { createHash, timingSafeEqual } from 'node:crypto';

import {
  CANONICAL_ZOOM_MEETING_SETTINGS,
  ZOOM_BOOTSTRAP_TTL_MS,
  ZOOM_CONSTANT_PARENT_ROUTE,
  ZOOM_CONSTANT_STUDENT_ROUTE,
  ZOOM_DEVICE_LEASE_TTL_MS,
  ZOOM_PREPARATION_AUTOMATIC_LEAD_MS,
  ZOOM_PREPARATION_ERROR_CODES,
  ZOOM_REMINDER_LEAD_MS,
  type ClassroomResource,
  type LaunchGrantRecord,
  type LiveStudentSession,
  type MeetingSdkBootstrap,
  type OccurrenceRosterSnapshot,
  type StudentJoinState,
  type StudentRegistrant,
  type ZoomMeetingReadback,
  type ZoomPreparationAdminActor,
  type ZoomPreparationPreview,
  type ZoomPreparationSaga,
  type ZoomPreparationScope,
  type ZoomPreparationTrigger,
  type ZoomProviderExecutionResult,
  type ZoomRegistrantReadback,
  type ZoomRosterEntry,
  type ZoomStudentPreparationInput,
} from '../../../../contracts/src/classroom/zoom-preparation/index.ts';
import type { ClassOccurrenceRecord } from '../../../../contracts/src/classes/core/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../contracts/src/providers/v21-provider-core.ts';
import { assertProviderRegistryBinding } from '../../providers/shared/index.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const UNSAFE_BEARER = /(?:https?:\/\/|zoom\.us|pwd=|zak=|bearer|token|password)/i;

export class ZoomPreparationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function zoomPreparationSha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function createPreparationDraft(input: {
  scope: ZoomPreparationScope;
  occurrence: ClassOccurrenceRecord;
  rosterVersion: number;
  trigger: ZoomPreparationTrigger;
  occurredAt: string;
}): ZoomPreparationSaga {
  assertOccurrence(input.scope, input.occurrence);
  const now = Date.parse(input.occurredAt);
  const startsAt = Date.parse(input.occurrence.startsAt);
  if (
    input.trigger === 'automatic_24h' &&
    (now < startsAt - ZOOM_PREPARATION_AUTOMATIC_LEAD_MS || now >= startsAt)
  ) {
    fail('invalidOccurrence', 'Automatic preparation begins at the exact 24-hour boundary.');
  }
  if (!Number.isSafeInteger(input.rosterVersion) || input.rosterVersion < 1) {
    fail('invalidRoster', 'A positive roster version is required.');
  }
  return {
    id: zoomPreparationSha256(
      `${input.scope.accountKey}:${input.scope.productKey}:${input.occurrence.id}:${input.occurrence.scheduleVersion}:${input.rosterVersion}`,
    ),
    ...input.scope,
    occurrenceId: input.occurrence.id,
    trigger: input.trigger,
    scheduleVersion: input.occurrence.scheduleVersion,
    rosterVersion: input.rosterVersion,
    state: 'draft',
    providerOperationIds: [],
    completedOperationIds: [],
    unknownOperationIds: [],
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function buildRosterSnapshot(input: {
  scope: ZoomPreparationScope;
  occurrence: ClassOccurrenceRecord;
  rosterVersion: number;
  students: readonly ZoomStudentPreparationInput[];
  generatedAt: string;
}): OccurrenceRosterSnapshot {
  assertOccurrence(input.scope, input.occurrence);
  const seen = new Set<string>();
  const entries: ZoomRosterEntry[] = input.students.map((candidate) => {
    if (seen.has(candidate.student.studentId)) {
      fail('invalidRoster', 'A Student may appear only once in a roster snapshot.');
    }
    seen.add(candidate.student.studentId);
    assertSameScope(input.scope, candidate.student);
    assertSameScope(input.scope, candidate.enrollment);
    const safeReason = rosterReason(candidate, input.occurrence.seriesId);
    return {
      ...input.scope,
      studentId: candidate.student.studentId,
      householdId: candidate.student.householdId,
      decision: safeReason === 'eligible' ? 'included' : 'excluded',
      safeReason,
      approvedClassroomName: safeClassroomName(candidate.approvedClassroomName),
      studentVersion: candidate.student.version,
      enrollmentVersion: candidate.enrollment.version,
      serviceAccountConsentVersion: candidate.serviceAccountConsentVersion,
      recordingParticipationConsentVersion: candidate.recordingParticipationConsentVersion,
      memberRecognitionConsentVersion: candidate.memberRecognitionConsentVersion,
    };
  });
  if (!entries.some((entry) => entry.decision === 'included')) {
    fail('invalidRoster', 'Preparation requires at least one currently authorized Student.');
  }
  const digest = zoomPreparationSha256(canonicalJson(entries));
  return {
    ...input.scope,
    id: zoomPreparationSha256(
      `${input.occurrence.id}:${input.occurrence.scheduleVersion}:${input.rosterVersion}:${digest}`,
    ),
    occurrenceId: input.occurrence.id,
    scheduleVersion: input.occurrence.scheduleVersion,
    rosterVersion: input.rosterVersion,
    entries,
    digest,
    generatedAt: input.generatedAt,
  };
}

export function buildPreparationPreview(input: {
  saga: ZoomPreparationSaga;
  occurrence: ClassOccurrenceRecord;
  roster: OccurrenceRosterSnapshot;
  occurredAt: string;
}): { saga: ZoomPreparationSaga; preview: ZoomPreparationPreview } {
  if (input.saga.state !== 'draft' && input.saga.state !== 'validating') {
    fail('invalidState', 'Only a draft or validating preparation can produce a preview.');
  }
  if (
    input.saga.occurrenceId !== input.occurrence.id ||
    input.saga.scheduleVersion !== input.occurrence.scheduleVersion ||
    input.saga.rosterVersion !== input.roster.rosterVersion ||
    input.roster.occurrenceId !== input.occurrence.id
  ) {
    fail('invalidRoster', 'Preview inputs must bind the exact occurrence and roster versions.');
  }
  const households = new Map<string, string[]>();
  for (const entry of input.roster.entries.filter((item) => item.decision === 'included')) {
    const labels = households.get(entry.householdId) ?? [];
    labels.push(entry.approvedClassroomName);
    households.set(entry.householdId, labels);
  }
  const householdReminders = [...households.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([householdId, studentLabels]) => ({
      householdId,
      studentLabels: [...studentLabels].sort(),
      appPath: ZOOM_CONSTANT_PARENT_ROUTE,
      scheduledFor: new Date(
        Date.parse(input.occurrence.startsAt) - ZOOM_REMINDER_LEAD_MS,
      ).toISOString(),
    }));
  const previewBody = {
    occurrenceId: input.occurrence.id,
    occurrenceVersion: input.occurrence.version,
    scheduleVersion: input.occurrence.scheduleVersion,
    rosterSnapshotId: input.roster.id,
    rosterDigest: input.roster.digest,
    meetingSettings: CANONICAL_ZOOM_MEETING_SETTINGS,
    householdReminders,
    createdAt: input.occurredAt,
  };
  const preview: ZoomPreparationPreview = {
    ...previewBody,
    digest: zoomPreparationSha256(canonicalJson(previewBody)),
  };
  return {
    preview,
    saga: {
      ...input.saga,
      state: 'preview_ready',
      preview,
      version: input.saga.version + 1,
      updatedAt: input.occurredAt,
    },
  };
}

export function confirmPreparation(input: {
  actor: ZoomPreparationAdminActor;
  saga: ZoomPreparationSaga;
  expectedVersion: number;
  previewDigest: string;
  occurredAt: string;
}): ZoomPreparationSaga {
  assertAdmin(input.actor, input.saga);
  if (
    input.saga.version !== input.expectedVersion ||
    input.saga.state !== 'preview_ready' ||
    !input.saga.preview ||
    input.saga.preview.digest !== input.previewDigest
  ) {
    fail('staleVersion', 'Confirmation must bind the exact current preview and version.');
  }
  return {
    ...input.saga,
    state: 'confirmed',
    confirmedPreviewDigest: input.previewDigest,
    confirmedByAdminId: input.actor.principalId,
    version: input.saga.version + 1,
    updatedAt: input.occurredAt,
  };
}

export function createProvisioningPlan(input: {
  saga: ZoomPreparationSaga;
  occurrence: ClassOccurrenceRecord;
  roster: OccurrenceRosterSnapshot;
  binding: ProviderRegistryBinding;
  occurredAt: string;
}): {
  saga: ZoomPreparationSaga;
  resource: ClassroomResource;
  registrants: readonly StudentRegistrant[];
  operations: readonly ProviderOperation[];
} {
  const preview = input.saga.preview;
  if (
    input.saga.state !== 'confirmed' ||
    !preview ||
    input.saga.confirmedPreviewDigest !== preview.digest ||
    input.occurrence.id !== input.saga.occurrenceId ||
    input.occurrence.scheduleVersion !== input.saga.scheduleVersion ||
    input.roster.id !== preview.rosterSnapshotId ||
    input.roster.digest !== preview.rosterDigest ||
    input.roster.rosterVersion !== input.saga.rosterVersion
  ) {
    fail(
      'invalidState',
      'Only the exact confirmed occurrence, schedule, roster, and preview can provision Zoom.',
    );
  }
  assertZoomBinding(input.binding);
  const resourceId = zoomPreparationSha256(
    `${input.saga.occurrenceId}:normal_class:${input.saga.scheduleVersion}:${input.saga.rosterVersion}`,
  );
  const resource: ClassroomResource = {
    id: resourceId,
    accountKey: input.saga.accountKey,
    productKey: input.saga.productKey,
    occurrenceId: input.saga.occurrenceId,
    purpose: 'normal_class',
    provider: 'zoom',
    scope: input.binding.scope,
    state: 'provisioning',
    providerAccountRefHash: input.binding.provider_account_ref_hash,
    registryBindingKey: input.binding.registry_binding_key,
    provisioningIdempotencyKey: `zoom-meeting-${resourceId}`,
    sourceScheduleVersion: input.saga.scheduleVersion,
    sourceRosterVersion: input.saga.rosterVersion,
    settings: CANONICAL_ZOOM_MEETING_SETTINGS,
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  const included = input.roster.entries.filter((entry) => entry.decision === 'included');
  const registrants = included.map((entry) => {
    const id = zoomPreparationSha256(`${resourceId}:${entry.studentId}`);
    return {
      id,
      accountKey: input.saga.accountKey,
      productKey: input.saga.productKey,
      occurrenceId: input.saga.occurrenceId,
      classroomResourceId: resourceId,
      studentId: entry.studentId,
      householdId: entry.householdId,
      state: 'provisioning' as const,
      technicalAliasDigest: zoomPreparationSha256(
        `${input.saga.occurrenceId}:${entry.studentId}:non-routable-alias`,
      ),
      approvedClassroomName: entry.approvedClassroomName,
      provisioningIdempotencyKey: `zoom-registrant-${id}`,
      sourceStudentVersion: entry.studentVersion,
      sourceEnrollmentVersion: entry.enrollmentVersion,
      sourceRosterVersion: input.roster.rosterVersion,
      version: 1,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    };
  });
  const meetingOperation = providerOperation({
    id: zoomPreparationSha256(`${resourceId}:meeting`),
    operationType: 'zoom.meeting.create_or_reuse',
    aggregateRef: resourceId,
    sourceVersion: resource.sourceScheduleVersion,
    idempotencyKey: resource.provisioningIdempotencyKey,
    payloadDigest: zoomPreparationSha256(
      canonicalJson({
        occurrenceId: input.occurrence.id,
        startsAt: input.occurrence.startsAt,
        settings: resource.settings,
      }),
    ),
    binding: input.binding,
    now: input.occurredAt,
  });
  const registrantOperations = registrants.map((registrant) =>
    providerOperation({
      id: zoomPreparationSha256(`${registrant.id}:registrant`),
      operationType: 'zoom.registrant.create_or_reuse',
      aggregateRef: registrant.id,
      sourceVersion: registrant.sourceRosterVersion,
      idempotencyKey: registrant.provisioningIdempotencyKey,
      payloadDigest: zoomPreparationSha256(
        canonicalJson({
          occurrenceId: registrant.occurrenceId,
          studentId: registrant.studentId,
          technicalAliasDigest: registrant.technicalAliasDigest,
          classroomName: registrant.approvedClassroomName,
        }),
      ),
      binding: input.binding,
      now: input.occurredAt,
    }),
  );
  const operations = [meetingOperation, ...registrantOperations];
  return {
    resource,
    registrants,
    operations,
    saga: {
      ...input.saga,
      state: 'provisioning',
      providerOperationIds: operations.map((operation) => operation.job_id),
      version: input.saga.version + 1,
      updatedAt: input.occurredAt,
    },
  };
}

export function verifyMeetingReadback(input: {
  resource: ClassroomResource;
  occurrence: ClassOccurrenceRecord;
  operation: ProviderOperation;
  readback: ZoomMeetingReadback;
}): ClassroomResource {
  if (
    input.readback.operationId !== input.operation.job_id ||
    input.readback.occurrenceId !== input.resource.occurrenceId ||
    input.readback.startTime !== input.occurrence.startsAt ||
    input.readback.durationMinutes !== 60 ||
    input.readback.timeZone !== 'Asia/Jerusalem' ||
    canonicalJson(input.readback.settings) !== canonicalJson(CANONICAL_ZOOM_MEETING_SETTINGS) ||
    !SHA256.test(input.readback.providerMeetingRefDigest) ||
    !SHA256.test(input.readback.reconciliationDigest)
  ) {
    fail('invalidReadback', 'Meeting readback must prove exact occurrence, account, and settings.');
  }
  return {
    ...input.resource,
    state: 'active',
    providerMeetingRefDigest: input.readback.providerMeetingRefDigest,
    version: input.resource.version + 1,
    updatedAt: input.readback.observedAt,
  };
}

export function verifyRegistrantReadbacks(input: {
  resource: ClassroomResource;
  registrants: readonly StudentRegistrant[];
  operations: readonly ProviderOperation[];
  readbacks: readonly ZoomRegistrantReadback[];
}): readonly StudentRegistrant[] {
  if (!input.resource.providerMeetingRefDigest) {
    fail('invalidReadback', 'Registrant readback requires an active verified meeting.');
  }
  const byStudent = new Map(input.readbacks.map((readback) => [readback.studentId, readback]));
  if (byStudent.size !== input.registrants.length) {
    fail('invalidReadback', 'Every included Student requires one distinct registrant readback.');
  }
  return input.registrants.map((registrant) => {
    const readback = byStudent.get(registrant.studentId);
    const operation = input.operations.find(
      (candidate) => candidate.aggregate_ref === registrant.id,
    );
    if (
      !readback ||
      !operation ||
      readback.operationId !== operation.job_id ||
      readback.occurrenceId !== registrant.occurrenceId ||
      readback.providerMeetingRefDigest !== input.resource.providerMeetingRefDigest ||
      readback.active !== true ||
      !SHA256.test(readback.providerRegistrantRefDigest) ||
      !SHA256.test(readback.reconciliationDigest)
    ) {
      fail('invalidReadback', 'Registrant readback is missing or cross-bound.');
    }
    return {
      ...registrant,
      state: 'active',
      providerRegistrantRefDigest: readback.providerRegistrantRefDigest,
      version: registrant.version + 1,
      updatedAt: readback.observedAt,
    };
  });
}

export function finalizeProvisioning(input: {
  saga: ZoomPreparationSaga;
  results: readonly ZoomProviderExecutionResult[];
  occurredAt: string;
}): ZoomPreparationSaga {
  if (input.saga.state !== 'provisioning') {
    fail('invalidState', 'Provider results apply only to a provisioning saga.');
  }
  const unknown = input.results
    .filter((result) => result.outcome.kind === 'acceptance_unknown')
    .map((result) => result.operation.job_id);
  const completed = input.results
    .filter((result) => result.outcome.kind === 'accepted' && result.outcome.completed_locally)
    .map((result) => result.operation.job_id);
  const failed = input.results.filter(
    (result) =>
      result.outcome.kind === 'permanently_rejected' ||
      result.outcome.kind === 'not_accepted_retryable',
  );
  const state =
    unknown.length > 0
      ? 'acceptance_unknown'
      : failed.length > 0
        ? completed.length > 0
          ? 'partial_failure'
          : 'failed'
        : completed.length === input.saga.providerOperationIds.length
          ? 'ready_to_notify'
          : 'failed';
  const next: ZoomPreparationSaga = {
    ...input.saga,
    state,
    completedOperationIds: completed,
    unknownOperationIds: unknown,
    version: input.saga.version + 1,
    updatedAt: input.occurredAt,
  };
  if (state === 'failed' || state === 'partial_failure') {
    next.failedStage = 'provisioning';
    next.safeErrorCode = 'zoom_provisioning_incomplete';
  }
  if (state === 'acceptance_unknown') {
    next.failedStage = 'provisioning';
    next.safeErrorCode = ZOOM_PREPARATION_ERROR_CODES.providerAcceptanceUnknown;
  }
  return next;
}

export function deriveStudentJoinState(input: {
  occurrence: ClassOccurrenceRecord;
  resource: ClassroomResource | null;
  registrant: StudentRegistrant | null;
  currentStudentAuthorized: boolean;
  now: string;
}): StudentJoinState {
  let safeCode: StudentJoinState['safeCode'] = 'join_available';
  if (!input.currentStudentAuthorized) safeCode = 'student_not_authorized';
  else if (!input.resource || input.resource.state !== 'active') safeCode = 'preparation_pending';
  else if (!input.registrant || input.registrant.state !== 'active')
    safeCode = 'registrant_not_ready';
  else if (
    !['ready', 'live'].includes(input.occurrence.state) ||
    Date.parse(input.now) < Date.parse(input.occurrence.joinOpensAt) ||
    Date.parse(input.now) > Date.parse(input.occurrence.joinClosesAt)
  )
    safeCode = 'outside_join_window';
  return {
    route: ZOOM_CONSTANT_STUDENT_ROUTE,
    available: safeCode === 'join_available',
    safeCode,
    occurrenceId: input.occurrence.id,
    exposesRawZoomUrl: false,
  };
}

export function issueLaunchGrant(input: {
  scope: ZoomPreparationScope;
  studentId: string;
  householdId: string;
  studentSessionId: string;
  deviceLineageId: string;
  occurrence: ClassOccurrenceRecord;
  registrant: StudentRegistrant;
  currentStudentAuthorized: boolean;
  grantDigest: string;
  studentVersion: number;
  enrollmentVersion: number;
  serviceAccountConsentVersion: number;
  recordingParticipationConsentVersion: number;
  occurredAt: string;
}): LaunchGrantRecord {
  if (
    !input.currentStudentAuthorized ||
    input.registrant.state !== 'active' ||
    !['ready', 'live'].includes(input.occurrence.state) ||
    Date.parse(input.occurredAt) < Date.parse(input.occurrence.joinOpensAt) ||
    Date.parse(input.occurredAt) > Date.parse(input.occurrence.joinClosesAt) ||
    input.registrant.studentId !== input.studentId ||
    input.registrant.householdId !== input.householdId ||
    !SHA256.test(input.grantDigest)
  ) {
    fail(
      'joinDenied',
      'Current Student, consent, access, occurrence, and registrant are required.',
    );
  }
  return {
    id: zoomPreparationSha256(
      `${input.studentId}:${input.occurrence.id}:${input.studentSessionId}:${input.deviceLineageId}:${input.occurredAt}`,
    ),
    ...input.scope,
    studentId: input.studentId,
    householdId: input.householdId,
    studentSessionId: safeOpaque(input.studentSessionId),
    deviceLineageId: safeOpaque(input.deviceLineageId),
    occurrenceId: input.occurrence.id,
    registrantId: input.registrant.id,
    grantDigest: input.grantDigest,
    issuedAt: input.occurredAt,
    expiresAt: new Date(Date.parse(input.occurredAt) + ZOOM_BOOTSTRAP_TTL_MS).toISOString(),
    studentVersion: input.studentVersion,
    enrollmentVersion: input.enrollmentVersion,
    serviceAccountConsentVersion: input.serviceAccountConsentVersion,
    recordingParticipationConsentVersion: input.recordingParticipationConsentVersion,
    version: 1,
  };
}

export function consumeLaunchGrant(input: {
  grant: LaunchGrantRecord;
  presentedSecret: string;
  currentStudentAuthorized: boolean;
  studentSessionId: string;
  deviceLineageId: string;
  sdkBootstrap: MeetingSdkBootstrap;
  occurredAt: string;
}): { grant: LaunchGrantRecord; bootstrap: MeetingSdkBootstrap } {
  if (input.grant.consumedAt || input.grant.revokedAt) {
    fail('bootstrapReplay', 'Launch grant is single-use.');
  }
  if (Date.parse(input.occurredAt) > Date.parse(input.grant.expiresAt)) {
    fail('bootstrapExpired', 'Launch grant expired.');
  }
  const presentedDigest = zoomPreparationSha256(input.presentedSecret);
  if (
    !input.currentStudentAuthorized ||
    input.grant.studentSessionId !== input.studentSessionId ||
    input.grant.deviceLineageId !== input.deviceLineageId ||
    !safeDigestEqual(input.grant.grantDigest, presentedDigest)
  ) {
    fail('joinDenied', 'Launch grant is not valid for this Student session and device.');
  }
  assertEphemeralBootstrap(input.sdkBootstrap, input.grant.expiresAt);
  return {
    grant: {
      ...input.grant,
      consumedAt: input.occurredAt,
      version: input.grant.version + 1,
    },
    bootstrap: input.sdkBootstrap,
  };
}

export function acquireLiveStudentSession(input: {
  scope: ZoomPreparationScope;
  existing: LiveStudentSession | null;
  studentId: string;
  occurrenceId: string;
  studentSessionId: string;
  deviceLineageId: string;
  occurredAt: string;
}): { disposition: 'acquired' | 'reconnected'; session: LiveStudentSession } {
  const now = Date.parse(input.occurredAt);
  if (
    input.existing?.state === 'active' &&
    Date.parse(input.existing.leaseExpiresAt) > now &&
    (input.existing.studentSessionId !== input.studentSessionId ||
      input.existing.deviceLineageId !== input.deviceLineageId)
  ) {
    fail('concurrentDeviceDenied', 'This Student is already live on another device.');
  }
  const reconnect =
    input.existing?.state === 'active' &&
    input.existing.studentSessionId === input.studentSessionId &&
    input.existing.deviceLineageId === input.deviceLineageId;
  const baseVersion = input.existing?.version ?? 0;
  return {
    disposition: reconnect ? 'reconnected' : 'acquired',
    session: {
      id: input.existing?.id ?? zoomPreparationSha256(`${input.studentId}:${input.occurrenceId}`),
      ...input.scope,
      studentId: input.studentId,
      occurrenceId: input.occurrenceId,
      studentSessionId: safeOpaque(input.studentSessionId),
      deviceLineageId: safeOpaque(input.deviceLineageId),
      state: 'active',
      leaseExpiresAt: new Date(now + ZOOM_DEVICE_LEASE_TTL_MS).toISOString(),
      lastHeartbeatAt: input.occurredAt,
      version: baseVersion + 1,
    },
  };
}

export function heartbeatLiveStudentSession(input: {
  session: LiveStudentSession;
  studentSessionId: string;
  deviceLineageId: string;
  occurredAt: string;
}): LiveStudentSession {
  if (
    input.session.state !== 'active' ||
    input.session.studentSessionId !== input.studentSessionId ||
    input.session.deviceLineageId !== input.deviceLineageId ||
    Date.parse(input.occurredAt) > Date.parse(input.session.leaseExpiresAt)
  ) {
    fail('concurrentDeviceDenied', 'Only the active device lineage may heartbeat.');
  }
  return {
    ...input.session,
    lastHeartbeatAt: input.occurredAt,
    leaseExpiresAt: new Date(Date.parse(input.occurredAt) + ZOOM_DEVICE_LEASE_TTL_MS).toISOString(),
    version: input.session.version + 1,
  };
}

export function revokeLiveStudentSession(input: {
  actor: ZoomPreparationAdminActor;
  session: LiveStudentSession;
  occurredAt: string;
}): LiveStudentSession {
  assertSameScope(input.actor, input.session);
  return {
    ...input.session,
    state: 'revoked',
    leaseExpiresAt: input.occurredAt,
    lastHeartbeatAt: input.occurredAt,
    version: input.session.version + 1,
  };
}

export function planDisposableCanaryCleanup(input: {
  purpose: 'disposable_canary' | 'normal_class';
  providerResourceRefDigest: string;
  canonicalClassroomResourceIds: readonly string[];
}) {
  if (input.purpose !== 'disposable_canary' || !SHA256.test(input.providerResourceRefDigest)) {
    fail('accessDenied', 'Cleanup may target only an exact disposable canary digest.');
  }
  return {
    cleanupAuthorized: true,
    targetDigest: input.providerResourceRefDigest,
    canonicalClassroomResourceIds: input.canonicalClassroomResourceIds,
    blocksNormalClassroom: false,
  } as const;
}

function providerOperation(input: {
  id: string;
  operationType: string;
  aggregateRef: string;
  sourceVersion: number;
  idempotencyKey: string;
  payloadDigest: string;
  binding: ProviderRegistryBinding;
  now: string;
}): ProviderOperation {
  const requestHash = zoomPreparationSha256(
    `${input.operationType}:${input.aggregateRef}:${input.sourceVersion}:${input.payloadDigest}`,
  );
  return {
    job_id: input.id,
    operation_type: input.operationType,
    aggregate_ref: input.aggregateRef,
    source_version: input.sourceVersion,
    provider: 'zoom',
    scope: input.binding.scope,
    idempotency_key: input.idempotencyKey,
    canonical_request_hash: requestHash,
    payload_ref: `zoom-preparation/${input.aggregateRef}`,
    payload_digest: input.payloadDigest,
    compensation_for_job_id: null,
    state: 'not_started',
    version: 1,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: input.now,
    updated_at: input.now,
    registry_binding_key: input.binding.registry_binding_key,
    provider_account_ref_hash: input.binding.provider_account_ref_hash,
    effect_kind: 'mutation',
    household_id: null,
  };
}

function assertZoomBinding(binding: ProviderRegistryBinding) {
  try {
    assertProviderRegistryBinding(binding);
  } catch {
    fail('invalidProviderBinding', 'Zoom binding failed the integrated provider contract.');
  }
  if (
    binding.provider !== 'zoom' ||
    binding.mutation_policy !== 'allowed' ||
    !binding.allowed_operation_types.includes('zoom.meeting.create_or_reuse') ||
    !binding.allowed_operation_types.includes('zoom.registrant.create_or_reuse')
  ) {
    fail(
      'invalidProviderBinding',
      'Exact active Zoom meeting and registrant authority is required.',
    );
  }
}

function rosterReason(
  input: ZoomStudentPreparationInput,
  seriesId: string,
): ZoomRosterEntry['safeReason'] {
  if (input.student.state !== 'active') return 'student_inactive';
  if (input.enrollment.state !== 'active') return 'enrollment_inactive';
  if (input.enrollment.seriesId !== seriesId) return 'series_mismatch';
  if (input.householdAccess === 'inactive') return 'household_access_inactive';
  if (input.serviceAccountConsent !== 'accepted') return 'service_account_consent_missing';
  if (input.recordingParticipationConsent !== 'accepted')
    return 'recording_participation_consent_missing';
  return 'eligible';
}

function assertOccurrence(scope: ZoomPreparationScope, occurrence: ClassOccurrenceRecord) {
  assertSameScope(scope, occurrence);
  if (
    !['scheduled', 'preparing'].includes(occurrence.state) ||
    Date.parse(occurrence.startsAt) >= Date.parse(occurrence.scheduledEndsAt) ||
    Date.parse(occurrence.joinOpensAt) >= Date.parse(occurrence.joinClosesAt)
  ) {
    fail('invalidOccurrence', 'Preparation requires one valid scheduled/preparing occurrence.');
  }
}

function assertAdmin(actor: ZoomPreparationAdminActor, scoped: ZoomPreparationScope) {
  if (actor.role !== 'admin') fail('accessDenied', 'Admin authority is required.');
  assertSameScope(actor, scoped);
}

function assertSameScope(left: ZoomPreparationScope, right: ZoomPreparationScope) {
  if (left.accountKey !== right.accountKey || left.productKey !== right.productKey) {
    fail('accessDenied', 'Account and product scope must match.');
  }
}

function safeClassroomName(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 80 || UNSAFE_BEARER.test(normalized)) {
    fail('invalidRoster', 'Classroom name is missing or unsafe.');
  }
  return normalized;
}

function safeOpaque(value: string) {
  if (!value.trim() || UNSAFE_BEARER.test(value) || /[@?&#]/.test(value)) {
    fail('joinDenied', 'Session and device identifiers must be opaque.');
  }
  return value;
}

function assertEphemeralBootstrap(value: MeetingSdkBootstrap, grantExpiry: string) {
  if (
    !value.meetingRef ||
    !value.registrantRef ||
    !value.sdkSignature ||
    UNSAFE_BEARER.test(value.meetingRef) ||
    UNSAFE_BEARER.test(value.registrantRef) ||
    value.expiresAt !== grantExpiry ||
    value.cacheControl !== 'private, no-store' ||
    value.referrerPolicy !== 'no-referrer' ||
    value.durable !== false
  ) {
    fail('joinDenied', 'Bootstrap must contain only bounded no-store SDK fields.');
  }
}

function safeDigestEqual(left: string, right: string) {
  if (!SHA256.test(left) || !SHA256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fail(key: keyof typeof ZOOM_PREPARATION_ERROR_CODES, message: string): never {
  throw new ZoomPreparationError(ZOOM_PREPARATION_ERROR_CODES[key], message);
}
