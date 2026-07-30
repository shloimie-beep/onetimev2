import { describe, expect, it } from 'vitest';

import {
  CANONICAL_ZOOM_MEETING_SETTINGS,
  type ClassroomResource,
  type StudentRegistrant,
  type ZoomPreparationRepository,
  type ZoomPreparationSaga,
  type ZoomPreparationUnitOfWork,
} from '../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
import type { ClassOccurrenceRecord } from '../../../../../packages/contracts/src/classes/core/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { zoomPreparationSha256 } from '../../../../../packages/domain/src/classroom/zoom-preparation/index.ts';
import { runZoomPreparation, type ZoomPreparationProvider } from './runner.ts';

const now = '2026-07-28T23:00:00.000Z';
const scope = { accountKey: 'account-1', productKey: 'one-time' };
const binding: ProviderRegistryBinding = {
  registry_binding_key: 'zoom-binding',
  provider: 'zoom',
  scope: {
    product: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'provider_sandbox',
  },
  provider_account_ref_hash: zoomPreparationSha256('account'),
  allowed_operation_types: ['zoom.meeting.create_or_reuse'],
  mutation_policy: 'allowed',
  active: true,
};
const operation: ProviderOperation = {
  job_id: zoomPreparationSha256('operation'),
  operation_type: 'zoom.meeting.create_or_reuse',
  aggregate_ref: 'resource-1',
  source_version: 1,
  provider: 'zoom',
  scope: binding.scope,
  idempotency_key: 'meeting-resource-1',
  canonical_request_hash: zoomPreparationSha256('request'),
  payload_ref: 'zoom-preparation/resource-1',
  payload_digest: zoomPreparationSha256('payload'),
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
  created_at: now,
  updated_at: now,
  registry_binding_key: binding.registry_binding_key,
  provider_account_ref_hash: binding.provider_account_ref_hash,
  effect_kind: 'mutation',
  household_id: null,
};
const fullBinding: ProviderRegistryBinding = {
  ...binding,
  allowed_operation_types: ['zoom.meeting.create_or_reuse', 'zoom.registrant.create_or_reuse'],
};
const saga: ZoomPreparationSaga = {
  ...scope,
  id: 'saga-1',
  occurrenceId: 'occurrence-1',
  trigger: 'admin_manual',
  scheduleVersion: 1,
  rosterVersion: 1,
  state: 'provisioning',
  confirmedPreviewDigest: zoomPreparationSha256('preview'),
  providerOperationIds: [operation.job_id],
  completedOperationIds: [],
  unknownOperationIds: [],
  version: 4,
  createdAt: now,
  updatedAt: now,
};
const resource: ClassroomResource = {
  ...scope,
  id: 'resource-1',
  occurrenceId: saga.occurrenceId,
  purpose: 'normal_class',
  provider: 'zoom',
  scope: binding.scope,
  state: 'provisioning',
  providerAccountRefHash: binding.provider_account_ref_hash,
  registryBindingKey: binding.registry_binding_key,
  provisioningIdempotencyKey: 'meeting-resource-1',
  sourceScheduleVersion: 1,
  sourceRosterVersion: 1,
  settings: CANONICAL_ZOOM_MEETING_SETTINGS,
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const registrant: StudentRegistrant = {
  ...scope,
  id: 'registrant-1',
  occurrenceId: saga.occurrenceId,
  classroomResourceId: resource.id,
  studentId: 'student-1',
  householdId: 'household-1',
  state: 'provisioning',
  technicalAliasDigest: zoomPreparationSha256('alias'),
  approvedClassroomName: 'Student One',
  provisioningIdempotencyKey: 'registrant-1',
  sourceStudentVersion: 1,
  sourceEnrollmentVersion: 1,
  sourceRosterVersion: 1,
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const registrantOperation: ProviderOperation = {
  ...operation,
  job_id: zoomPreparationSha256('registrant-operation'),
  operation_type: 'zoom.registrant.create_or_reuse',
  aggregate_ref: registrant.id,
  idempotency_key: registrant.provisioningIdempotencyKey,
  canonical_request_hash: zoomPreparationSha256('registrant-request'),
  payload_ref: `zoom-preparation/${registrant.id}`,
  payload_digest: zoomPreparationSha256('registrant-payload'),
};
const occurrence: ClassOccurrenceRecord = {
  ...scope,
  id: saga.occurrenceId,
  seriesId: 'canonical-class',
  localClassDate: '2026-07-29',
  startsAt: '2026-07-29T16:00:00.000Z',
  scheduledEndsAt: '2026-07-29T17:00:00.000Z',
  joinOpensAt: '2026-07-29T15:50:00.000Z',
  joinClosesAt: '2026-07-29T17:15:00.000Z',
  state: 'preparing',
  scheduleVersion: 1,
  version: 2,
  createdAt: now,
  updatedAt: now,
};

class MemoryRepository implements ZoomPreparationRepository {
  savedSaga?: ZoomPreparationSaga;
  savedResource?: ClassroomResource;
  savedRegistrants: StudentRegistrant[] = [];
  async inTransaction<T>(run: (unit: ZoomPreparationUnitOfWork) => Promise<T>) {
    return run({
      getSaga: async () => null,
      saveSaga: async (value) => {
        this.savedSaga = value;
      },
      getRoster: async () => null,
      saveRoster: async () => undefined,
      getClassroomResource: async () => null,
      saveClassroomResource: async (value) => {
        this.savedResource = value;
      },
      listRegistrants: async () => [],
      saveRegistrant: async (value) => {
        this.savedRegistrants.push(value);
      },
      saveProviderOperation: async () => undefined,
      getReceipt: async () => null,
      saveReceipt: async () => undefined,
    });
  }
}

function canonicalReadback(dispatched: ProviderOperation, providerBinding = binding) {
  return {
    operation_id: dispatched.job_id,
    provider: 'zoom' as const,
    scope: dispatched.scope,
    registry_binding_key: providerBinding.registry_binding_key,
    provider_account_ref_hash: providerBinding.provider_account_ref_hash,
    canonical_request_hash: dispatched.canonical_request_hash,
    disposition: 'effect_exists' as const,
    provider_resource_ref_hash: zoomPreparationSha256(`${dispatched.job_id}:resource`),
    provider_acceptance_digest: zoomPreparationSha256(`${dispatched.job_id}:acceptance`),
    reconciliation_digest: zoomPreparationSha256(`${dispatched.job_id}:reconciliation`),
    safe_error_code: null,
    completed_locally: true,
    observed_at: now,
  };
}

describe('P17 Zoom preparation worker', () => {
  it('quarantines acceptance-unknown work without a blind retry', async () => {
    const repository = new MemoryRepository();
    let calls = 0;
    const provider: ZoomPreparationProvider = {
      reconcileOrDispatch: async ({ operation: dispatched }) => {
        calls += 1;
        return {
          operation: dispatched,
          outcome: {
            kind: 'acceptance_unknown',
            safe_error_code: 'zoom_timeout_after_dispatch',
          },
        };
      },
    };
    const result = await runZoomPreparation({
      repository,
      provider,
      binding: fullBinding,
      saga: {
        ...saga,
        providerOperationIds: [operation.job_id, registrantOperation.job_id],
      },
      occurrence,
      resource,
      registrants: [registrant],
      operations: [operation, registrantOperation],
      occurredAt: now,
      timeoutMs: 1_000,
    });
    expect(calls).toBe(1);
    expect(result.saga).toMatchObject({
      state: 'acceptance_unknown',
      unknownOperationIds: [operation.job_id],
      safeErrorCode: 'zoom_preparation_provider_acceptance_unknown',
    });
    expect(repository.savedSaga?.state).toBe('acceptance_unknown');
    expect(result.registrants).toEqual([expect.objectContaining({ state: 'acceptance_unknown' })]);
  });

  it('rejects duplicate or inexact operation sets before dispatch', async () => {
    let calls = 0;
    const provider: ZoomPreparationProvider = {
      reconcileOrDispatch: async () => {
        calls += 1;
        throw new Error('should not dispatch');
      },
    };
    await expect(
      runZoomPreparation({
        repository: new MemoryRepository(),
        provider,
        binding,
        saga: { ...saga, providerOperationIds: [operation.job_id, operation.job_id] },
        occurrence,
        resource,
        registrants: [],
        operations: [operation, operation],
        occurredAt: now,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow('invalid_worker_input');
    expect(calls).toBe(0);
  });

  it('stops before registrants and persists safe failure when the meeting is rejected', async () => {
    const repository = new MemoryRepository();
    let calls = 0;
    const provider: ZoomPreparationProvider = {
      reconcileOrDispatch: async ({ operation: dispatched }) => {
        calls += 1;
        return {
          operation: dispatched,
          outcome: {
            kind: 'permanently_rejected',
            safe_error_code: 'zoom_meeting_rejected',
          },
        };
      },
    };
    const result = await runZoomPreparation({
      repository,
      provider,
      binding: fullBinding,
      saga: {
        ...saga,
        providerOperationIds: [operation.job_id, registrantOperation.job_id],
      },
      occurrence,
      resource,
      registrants: [registrant],
      operations: [operation, registrantOperation],
      occurredAt: now,
      timeoutMs: 1_000,
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      dispatched: 1,
      saga: { state: 'failed' },
      resource: { state: 'failed' },
      registrants: [{ state: 'failed' }],
    });
    expect(repository.savedSaga?.state).toBe('failed');
  });

  it('persists readback quarantine instead of throwing after an accepted meeting', async () => {
    const repository = new MemoryRepository();
    const provider: ZoomPreparationProvider = {
      reconcileOrDispatch: async ({ operation: dispatched }) => ({
        operation: dispatched,
        outcome: {
          kind: 'accepted',
          provider_acceptance_digest: zoomPreparationSha256(`${dispatched.job_id}:acceptance`),
          completed_locally: true,
        },
        canonicalReadback: canonicalReadback(dispatched),
      }),
    };
    const result = await runZoomPreparation({
      repository,
      provider,
      binding,
      saga,
      occurrence,
      resource,
      registrants: [],
      operations: [operation],
      occurredAt: now,
      timeoutMs: 1_000,
    });
    expect(result).toMatchObject({
      dispatched: 1,
      saga: {
        state: 'acceptance_unknown',
        safeErrorCode: 'zoom_preparation_invalid_readback',
      },
      resource: {
        state: 'acceptance_unknown',
        safeErrorCode: 'zoom_preparation_invalid_readback',
      },
    });
    expect(repository.savedSaga?.state).toBe('acceptance_unknown');
    expect(repository.savedResource?.state).toBe('acceptance_unknown');
  });
});
