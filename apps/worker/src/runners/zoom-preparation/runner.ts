import type {
  ClassroomResource,
  StudentRegistrant,
  ZoomPreparationRepository,
  ZoomPreparationSaga,
  ZoomProviderExecutionResult,
} from '../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
import { ZOOM_PREPARATION_ERROR_CODES as ERROR_CODES } from '../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
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
  assertExactWorkerInput(input);
  const meetingOperation = input.operations.find(
    (operation) => operation.operation_type === 'zoom.meeting.create_or_reuse',
  )!;
  const registrantOperations = input.registrants.map((registrant) =>
    input.operations.find(
      (operation) =>
        operation.operation_type === 'zoom.registrant.create_or_reuse' &&
        operation.aggregate_ref === registrant.id,
    )!,
  );
  const results: ZoomProviderExecutionResult[] = [];
  const execute = async (operation: ProviderOperation) => {
    assertProviderOperationBound(operation, input.binding);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const result = await input.provider.reconcileOrDispatch({
        operation,
        binding: input.binding,
        signal: controller.signal,
      });
      if (!sameOperation(result.operation, operation)) {
        throw new Error('zoom_preparation_operation_mismatch');
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  };

  const meetingResult = await execute(meetingOperation);
  results.push(meetingResult);
  if (!completedLocally(meetingResult)) {
    const saga = finalizeProvisioning({
      saga: input.saga,
      results,
      occurredAt: input.occurredAt,
    });
    return persistResult(input, {
      saga,
      resource: resourceForSafeSaga(input.resource, saga, input.occurredAt),
      registrants: registrantsForSafeSaga(input.registrants, saga, input.occurredAt),
      dispatched: results.length,
    });
  }

  let resource: ClassroomResource;
  try {
    assertAcceptedReadback(meetingOperation, input.binding, meetingResult);
    if (!meetingResult.meetingReadback || meetingResult.registrantReadback) {
      throw new Error('zoom_meeting_readback_required');
    }
    resource = verifyMeetingReadback({
      resource: input.resource,
      occurrence: input.occurrence,
      operation: meetingResult.operation,
      readback: meetingResult.meetingReadback,
    });
  } catch {
    return persistInvalidReadback(input, results, [meetingOperation.job_id]);
  }

  for (const operation of registrantOperations) {
    const result = await execute(operation);
    results.push(result);
    if (!completedLocally(result)) break;
    try {
      assertAcceptedReadback(operation, input.binding, result);
      if (!result.registrantReadback || result.meetingReadback) {
        throw new Error('zoom_registrant_readback_required');
      }
    } catch {
      return persistInvalidReadback(input, results, [operation.job_id], resource);
    }
  }

  const saga = finalizeProvisioning({
    saga: input.saga,
    results,
    occurredAt: input.occurredAt,
  });
  if (saga.state !== 'ready_to_notify') {
    return persistResult(input, {
      saga,
      resource: resourceForSafeSaga(resource, saga, input.occurredAt),
      registrants: registrantsForSafeSaga(input.registrants, saga, input.occurredAt),
      dispatched: results.length,
    });
  }

  try {
    const registrants = verifyRegistrantReadbacks({
      resource,
      registrants: input.registrants,
      operations: input.operations,
      readbacks: results.flatMap((result) =>
        result.registrantReadback ? [result.registrantReadback] : [],
      ),
    });
    return persistResult(input, { saga, resource, registrants, dispatched: results.length });
  } catch {
    return persistInvalidReadback(
      input,
      results,
      registrantOperations.map((operation) => operation.job_id),
      resource,
    );
  }
}

function assertExactWorkerInput(input: ZoomPreparationRunInput) {
  const sagaIds = input.saga.providerOperationIds;
  const operationIds = input.operations.map((operation) => operation.job_id);
  const sagaSet = new Set(sagaIds);
  const operationSet = new Set(operationIds);
  const meetingOperations = input.operations.filter(
    (operation) => operation.operation_type === 'zoom.meeting.create_or_reuse',
  );
  const registrantOperations = input.operations.filter(
    (operation) => operation.operation_type === 'zoom.registrant.create_or_reuse',
  );
  const registrantIds = input.registrants.map((registrant) => registrant.id);
  const registrantSet = new Set(registrantIds);
  const registrantAggregateSet = new Set(
    registrantOperations.map((operation) => operation.aggregate_ref),
  );
  if (
    input.saga.state !== 'provisioning' ||
    input.saga.accountKey !== input.resource.accountKey ||
    input.saga.productKey !== input.resource.productKey ||
    input.saga.occurrenceId !== input.occurrence.id ||
    input.resource.occurrenceId !== input.occurrence.id ||
    input.occurrence.accountKey !== input.saga.accountKey ||
    input.occurrence.productKey !== input.saga.productKey ||
    sagaIds.length !== input.operations.length ||
    sagaSet.size !== sagaIds.length ||
    operationSet.size !== operationIds.length ||
    [...sagaSet].some((id) => !operationSet.has(id)) ||
    meetingOperations.length !== 1 ||
    meetingOperations[0]!.aggregate_ref !== input.resource.id ||
    registrantOperations.length !== input.registrants.length ||
    registrantSet.size !== registrantIds.length ||
    registrantAggregateSet.size !== registrantSet.size ||
    [...registrantAggregateSet].some((id) => !registrantSet.has(id)) ||
    input.registrants.some(
      (registrant) =>
        registrant.accountKey !== input.saga.accountKey ||
        registrant.productKey !== input.saga.productKey ||
        registrant.occurrenceId !== input.saga.occurrenceId ||
        registrant.classroomResourceId !== input.resource.id,
    ) ||
    input.operations.some(
      (operation) =>
        operation.operation_type !== 'zoom.meeting.create_or_reuse' &&
        operation.operation_type !== 'zoom.registrant.create_or_reuse',
    )
  ) {
    throw new Error('zoom_preparation_invalid_worker_input');
  }
}

function sameOperation(actual: ProviderOperation, expected: ProviderOperation) {
  return (
    actual.job_id === expected.job_id &&
    actual.operation_type === expected.operation_type &&
    actual.aggregate_ref === expected.aggregate_ref &&
    actual.source_version === expected.source_version &&
    actual.provider === expected.provider &&
    actual.idempotency_key === expected.idempotency_key &&
    actual.canonical_request_hash === expected.canonical_request_hash &&
    actual.payload_digest === expected.payload_digest &&
    actual.registry_binding_key === expected.registry_binding_key &&
    actual.provider_account_ref_hash === expected.provider_account_ref_hash
  );
}

function completedLocally(result: ZoomProviderExecutionResult) {
  return result.outcome.kind === 'accepted' && result.outcome.completed_locally === true;
}

function assertAcceptedReadback(
  operation: ProviderOperation,
  binding: ProviderRegistryBinding,
  result: ZoomProviderExecutionResult,
) {
  if (
    result.outcome.kind !== 'accepted' ||
    result.outcome.completed_locally !== true ||
    !result.canonicalReadback ||
    result.canonicalReadback.disposition !== 'effect_exists' ||
    result.canonicalReadback.completed_locally !== true ||
    result.canonicalReadback.provider_acceptance_digest !==
      result.outcome.provider_acceptance_digest
  ) {
    throw new Error('zoom_canonical_readback_required');
  }
  assertCanonicalReadback(operation, binding, result.canonicalReadback);
}

function invalidReadbackSaga(
  saga: ZoomPreparationSaga,
  results: readonly ZoomProviderExecutionResult[],
  unknownOperationIds: readonly string[],
  occurredAt: string,
): ZoomPreparationSaga {
  const unknown = [...new Set(unknownOperationIds)];
  return {
    ...saga,
    state: 'acceptance_unknown',
    completedOperationIds: results
      .filter((result) => completedLocally(result) && !unknown.includes(result.operation.job_id))
      .map((result) => result.operation.job_id),
    unknownOperationIds: unknown,
    failedStage: 'provisioning',
    safeErrorCode: ERROR_CODES.invalidReadback,
    version: saga.version + 1,
    updatedAt: occurredAt,
  };
}

function resourceForSafeSaga(
  resource: ClassroomResource,
  saga: ZoomPreparationSaga,
  occurredAt: string,
): ClassroomResource {
  if (
    saga.state !== 'failed' &&
    saga.state !== 'partial_failure' &&
    saga.state !== 'acceptance_unknown'
  ) {
    return resource;
  }
  return {
    ...resource,
    state: saga.state === 'acceptance_unknown' ? 'acceptance_unknown' : 'failed',
    safeErrorCode: saga.safeErrorCode ?? ERROR_CODES.invalidState,
    version: resource.version + 1,
    updatedAt: occurredAt,
  };
}

function registrantsForSafeSaga(
  registrants: readonly StudentRegistrant[],
  saga: ZoomPreparationSaga,
  occurredAt: string,
): readonly StudentRegistrant[] {
  if (
    saga.state !== 'failed' &&
    saga.state !== 'partial_failure' &&
    saga.state !== 'acceptance_unknown'
  ) {
    return registrants;
  }
  return registrants.map((registrant) => ({
    ...registrant,
    state: saga.state === 'acceptance_unknown' ? 'acceptance_unknown' : 'failed',
    safeErrorCode: saga.safeErrorCode ?? ERROR_CODES.invalidState,
    version: registrant.version + 1,
    updatedAt: occurredAt,
  }));
}

async function persistInvalidReadback(
  input: ZoomPreparationRunInput,
  results: readonly ZoomProviderExecutionResult[],
  unknownOperationIds: readonly string[],
  verifiedResource: ClassroomResource = input.resource,
) {
  const saga = invalidReadbackSaga(input.saga, results, unknownOperationIds, input.occurredAt);
  return persistResult(input, {
    saga,
    resource: resourceForSafeSaga(verifiedResource, saga, input.occurredAt),
    registrants: registrantsForSafeSaga(input.registrants, saga, input.occurredAt),
    dispatched: results.length,
  });
}

async function persistResult(
  input: ZoomPreparationRunInput,
  result: ZoomPreparationRunResult,
): Promise<ZoomPreparationRunResult> {
  await input.repository.inTransaction(async (unit) => {
    await unit.saveClassroomResource(result.resource);
    for (const registrant of result.registrants) await unit.saveRegistrant(registrant);
    await unit.saveSaga(result.saga);
  });
  return result;
}
