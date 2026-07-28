import type {
  ClassroomResource,
  StudentRegistrant,
  ZoomPreparationRepository,
  ZoomPreparationSaga,
  ZoomProviderExecutionResult,
} from '../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
import type { ClassOccurrenceRecord } from '../../../../../packages/contracts/src/classes/core/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  finalizeProvisioning,
  verifyMeetingReadback,
  verifyRegistrantReadbacks,
} from '../../../../../packages/domain/src/classroom/zoom-preparation/index.ts';
import {
  assertCanonicalReadback,
  assertProviderOperationBound,
} from '../../../../../packages/domain/src/providers/shared/index.ts';

export interface ZoomPreparationProvider {
  reconcileOrDispatch(input: {
    operation: ProviderOperation;
    binding: ProviderRegistryBinding;
    signal: AbortSignal;
  }): Promise<ZoomProviderExecutionResult>;
}

export type ZoomPreparationRunInput = {
  repository: ZoomPreparationRepository;
  provider: ZoomPreparationProvider;
  binding: ProviderRegistryBinding;
  saga: ZoomPreparationSaga;
  occurrence: ClassOccurrenceRecord;
  resource: ClassroomResource;
  registrants: readonly StudentRegistrant[];
  operations: readonly ProviderOperation[];
  occurredAt: string;
  timeoutMs: number;
};

export type ZoomPreparationRunResult = {
  saga: ZoomPreparationSaga;
  resource: ClassroomResource;
  registrants: readonly StudentRegistrant[];
  dispatched: number;
};

export async function runZoomPreparation(
  input: ZoomPreparationRunInput,
): Promise<ZoomPreparationRunResult> {
  if (
    input.saga.state !== 'provisioning' ||
    input.operations.length !== input.saga.providerOperationIds.length ||
    input.operations.some(
      (operation) => !input.saga.providerOperationIds.includes(operation.job_id),
    )
  ) {
    throw new Error('zoom_preparation_invalid_worker_input');
  }
  const results: ZoomProviderExecutionResult[] = [];
  for (const operation of input.operations) {
    assertProviderOperationBound(operation, input.binding);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const result = await input.provider.reconcileOrDispatch({
        operation,
        binding: input.binding,
        signal: controller.signal,
      });
      if (result.operation.job_id !== operation.job_id) {
        throw new Error('zoom_preparation_operation_mismatch');
      }
      if (result.outcome.kind === 'accepted' && !result.canonicalReadback) {
        throw new Error('zoom_canonical_readback_required');
      }
      if (result.canonicalReadback) {
        assertCanonicalReadback(operation, input.binding, result.canonicalReadback);
      }
      results.push(result);
    } finally {
      clearTimeout(timeout);
    }
  }
  let resource = input.resource;
  let registrants = input.registrants;
  const saga = finalizeProvisioning({
    saga: input.saga,
    results,
    occurredAt: input.occurredAt,
  });
  if (saga.state === 'ready_to_notify') {
    const meetingResult = results.find(
      (result) => result.operation.operation_type === 'zoom.meeting.create_or_reuse',
    );
    if (!meetingResult?.meetingReadback) throw new Error('zoom_meeting_readback_required');
    resource = verifyMeetingReadback({
      resource,
      occurrence: input.occurrence,
      operation: meetingResult.operation,
      readback: meetingResult.meetingReadback,
    });
    registrants = verifyRegistrantReadbacks({
      resource,
      registrants,
      operations: input.operations,
      readbacks: results.flatMap((result) =>
        result.registrantReadback ? [result.registrantReadback] : [],
      ),
    });
  }
  await input.repository.inTransaction(async (unit) => {
    await unit.saveClassroomResource(resource);
    for (const registrant of registrants) await unit.saveRegistrant(registrant);
    await unit.saveSaga(saga);
  });
  return { saga, resource, registrants, dispatched: results.length };
}
