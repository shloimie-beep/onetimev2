import { describe, expect, it, vi } from 'vitest';

import type {
  ContentPublicationAcceptedWork,
  ContentPublicationAuthoritySelector,
  ContentPublicationDispatchContext,
  ContentPublicationWorkerRepository,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  JobFoundationRepository,
  ProviderJobRecord,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
  ProviderRegistryBindingReadRequest,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { runContentPublicationBatch } from './runner.ts';

const hash = (value: string) => value.repeat(64).slice(0, 64);
const scope = {
  product: 'one_time_mishnayos' as const,
  runtime_tier: 'isolated_staging' as const,
  verification_environment_id: 'ci' as const,
};

describe('P21 content publication runner', () => {
  it('orders F05 before generic F06 and finalizes accepted publish/revoke work without caller audience', async () => {
    const events: string[] = [];
    const dispatchOperation = operation('dispatch_job', 'publish_private', 'in_flight');
    const unknownOperation = operation('unknown_job', 'publish_private', 'acceptance_unknown');
    const acceptedWork = [
      work('accepted_publish', 'publish_private'),
      work('accepted_revoke', 'revoke_private'),
    ];
    const publicationRepository = workerRepository({
      dispatchOperation,
      unknownOperations: [unknownOperation],
      acceptedWork,
      events,
    });
    const foundation = foundationRepository(dispatchOperation, events);
    const authority = authorityPort();
    const registry = registryPort();
    const persistReconciliation = vi.fn(async () => {
      events.push('f06:persist');
      return true;
    });
    const applyPrivatePublicationReadback = vi.fn(async (input) => {
      events.push(`finalize:${input.providerOperationId}`);
      expect(input).not.toHaveProperty('audience');
    });
    const applyPrivateRevocationReadback = vi.fn(async (input) => {
      events.push(`finalize:${input.providerOperationId}`);
      expect(input).not.toHaveProperty('audience');
    });
    const summary = await runContentPublicationBatch({
      jobRepository: foundation,
      publicationRepository,
      providerRepository: {
        claimAcceptanceUnknown: vi.fn(async () => []),
        persistReconciliation,
      },
      authority,
      registry,
      dispatchAdapter: {
        dispatch: vi.fn(async () => {
          events.push('f05:adapter');
          return {
            kind: 'accepted' as const,
            provider_acceptance_digest: hash('d'),
            completed_locally: true,
          };
        }),
      },
      reconciliationAdapter: {
        provider: 'vimeo',
        readCanonical: vi.fn(async (providerOperation) => {
          events.push('f06:adapter');
          return readback(providerOperation, 'effect_exists');
        }),
      },
      finalizationService: {
        applyPrivatePublicationReadback,
        applyPrivateRevocationReadback,
      },
      logger: { info: vi.fn(), warn: vi.fn() },
      options: options(),
    });

    expect(summary).toMatchObject({
      dispatch: { claimed: 1, accepted: 1 },
      reconciliation: { claimed: 1, accepted_or_complete: 1 },
      finalization: { selected: 2, completed: 2, failed_closed: 0 },
    });
    expect(events).toEqual([
      'f05:claim',
      'f05:adapter',
      'f05:persist',
      'f06:list',
      'f06:adapter',
      'f06:persist',
      'finalize:list',
      'finalize:accepted_publish',
      'finalize:accepted_revoke',
    ]);
    expect(applyPrivatePublicationReadback).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOperationId: 'accepted_publish',
        binding: expect.objectContaining({ expectedVersion: 7 }),
      }),
    );
    expect(applyPrivateRevocationReadback).toHaveBeenCalledWith(
      expect.objectContaining({ providerOperationId: 'accepted_revoke' }),
    );
  });

  it('routes effect-absent through F06 retry safety after dispatch and never blindly redispatches it', async () => {
    const events: string[] = [];
    const dispatchOperation = operation('dispatch_job', 'publish_private', 'in_flight');
    const unknownOperation = operation('unknown_job', 'publish_private', 'acceptance_unknown');
    const publicationRepository = workerRepository({
      dispatchOperation,
      unknownOperations: [unknownOperation],
      acceptedWork: [],
      events,
    });
    const foundation = foundationRepository(dispatchOperation, events);
    const dispatch = vi.fn(async () => ({
      kind: 'accepted' as const,
      provider_acceptance_digest: hash('d'),
      completed_locally: false,
    }));
    const persistReconciliation = vi.fn(async ({ next }) => {
      events.push('f06:persist');
      expect(next.state).toBe('retry_wait');
      expect(next.unknown_effect).toBe(false);
      return true;
    });

    const summary = await runContentPublicationBatch({
      jobRepository: foundation,
      publicationRepository,
      providerRepository: {
        claimAcceptanceUnknown: vi.fn(async () => []),
        persistReconciliation,
      },
      authority: authorityPort(),
      registry: registryPort(),
      dispatchAdapter: { dispatch },
      reconciliationAdapter: {
        provider: 'vimeo',
        readCanonical: vi.fn(async (providerOperation) =>
          readback(providerOperation, 'effect_absent_retry_safe'),
        ),
      },
      finalizationService: {
        applyPrivatePublicationReadback: vi.fn(),
        applyPrivateRevocationReadback: vi.fn(),
      },
      logger: { info: vi.fn(), warn: vi.fn() },
      options: options(),
    });

    expect(summary.reconciliation).toMatchObject({ claimed: 1, retry_safe: 1 });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(foundation.claimDueJobs).toHaveBeenCalledOnce();
    expect(events.indexOf('f05:persist')).toBeLessThan(events.indexOf('f06:list'));
  });
});

function options() {
  return {
    owner: 'worker_one',
    scope,
    batchSize: 10,
    dispatchTimeoutMs: 1_000,
    reconciliationTimeoutMs: 1_000,
    clock: () => new Date('2026-08-02T00:02:00.000Z'),
    random: () => 0.5,
  };
}

function operation(
  jobId: string,
  operationType: 'publish_private' | 'revoke_private',
  state: 'in_flight' | 'acceptance_unknown',
): ProviderOperation {
  return {
    job_id: jobId,
    operation_type: operationType,
    aggregate_ref: `content_${jobId}`,
    source_version: 1,
    provider: 'vimeo',
    scope,
    idempotency_key: `idempotency.${jobId}`,
    canonical_request_hash: hash('c'),
    payload_ref: `content_version_${jobId}`,
    payload_digest: hash('f'),
    compensation_for_job_id: null,
    state,
    version: 3,
    recovery_generation: 0,
    dispatch_attempts: 1,
    lifetime_dispatch_attempts: 1,
    reconciliation_attempts: state === 'acceptance_unknown' ? 1 : 0,
    lease_owner: state === 'in_flight' ? 'worker_one' : null,
    lease_generation: state === 'in_flight' ? 1 : 0,
    lease_expires_at: state === 'in_flight' ? '2026-08-02T00:05:00.000Z' : null,
    last_heartbeat_at: state === 'in_flight' ? '2026-08-02T00:00:00.000Z' : null,
    next_attempt_at: null,
    unknown_effect: state === 'acceptance_unknown',
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: state === 'acceptance_unknown' ? 'provider_acceptance_unknown' : null,
    created_at: '2026-08-01T23:59:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    registry_binding_key: 'vimeo_publication_primary',
    provider_account_ref_hash: hash('9'),
    effect_kind: 'mutation',
    household_id: null,
  };
}

function workerRepository(input: {
  dispatchOperation: ProviderOperation;
  unknownOperations: readonly ProviderOperation[];
  acceptedWork: readonly ContentPublicationAcceptedWork[];
  events: string[];
}): ContentPublicationWorkerRepository {
  return {
    reopenDispatchContext: vi.fn(async () => dispatchContext(input.dispatchOperation)),
    listAcceptanceUnknownOperations: vi.fn(async () => {
      input.events.push('f06:list');
      return input.unknownOperations;
    }),
    listAcceptedPendingWork: vi.fn(async () => {
      input.events.push('finalize:list');
      return input.acceptedWork;
    }),
  };
}

function foundationRepository(
  inFlight: ProviderOperation,
  events: string[],
): JobFoundationRepository & { claimDueJobs: ReturnType<typeof vi.fn> } {
  const leased: ProviderJobRecord = {
    ...inFlight,
    state: 'leased',
  };
  return {
    claimDueJobs: vi.fn(async () => {
      events.push('f05:claim');
      return [leased];
    }),
    markInFlight: vi.fn(async () => inFlight),
    heartbeat: vi.fn(async (lease) => lease),
    recordDispatchOutcome: vi.fn(async ({ outcome }) => {
      events.push('f05:persist');
      return {
        ...inFlight,
        state: outcome.kind === 'accepted' ? ('accepted' as const) : ('rejected' as const),
      };
    }),
  };
}

function dispatchContext(operationValue: ProviderOperation): ContentPublicationDispatchContext {
  return {
    intent: {
      intentId: `intent_${operationValue.job_id}`,
      accountKey: 'account_one',
      productKey: 'one_time_mishnayos',
      providerOperationId: operationValue.job_id,
      provider: 'vimeo',
      contentId: operationValue.aggregate_ref,
      contentVersionId: operationValue.payload_ref,
      publicationGeneration: operationValue.source_version,
      operation: operationValue.operation_type as 'publish_private' | 'revoke_private',
      idempotencyKey: operationValue.idempotency_key,
      requestHash: operationValue.canonical_request_hash,
      state: 'pending',
      createdAt: operationValue.created_at,
      approvalEvidence: { projectionDigest: operationValue.payload_digest } as never,
    },
    operation: operationValue,
    lease: {
      job_id: operationValue.job_id,
      owner: operationValue.lease_owner!,
      generation: operationValue.lease_generation,
      expires_at: operationValue.lease_expires_at!,
      job_version: operationValue.version,
    },
  };
}

function work(
  providerOperationId: string,
  operationType: 'publish_private' | 'revoke_private',
): ContentPublicationAcceptedWork {
  return {
    scope,
    accountKey: 'account_one',
    contentId: `content_${providerOperationId}`,
    providerOperationId,
    operation: operationType,
    providerOperationVersion: 4,
    outboxIntentId: `intent_${providerOperationId}`,
    contentRecordVersion: 7,
  };
}

function authorityPort() {
  return {
    getPreapprovedRequest: vi.fn(async (selector: ContentPublicationAuthoritySelector) =>
      authorityRequest(selector),
    ),
  };
}

function authorityRequest(
  selector: ContentPublicationAuthoritySelector,
): ProviderRegistryBindingReadRequest {
  return {
    registry_binding_key: 'vimeo_publication_primary',
    provider: 'vimeo',
    scope: selector.scope,
    operation_type: selector.operation_type,
    effect_kind: selector.effect_kind,
    expected_provider_account_ref_hash: hash('9'),
    expected_registry_evidence_digest: hash('a'),
    expected_provider_readback_evidence_digest: hash('b'),
    expected_version: 3,
    observed_not_before: '2026-08-02T00:00:00.000Z',
  };
}

function registryPort() {
  return {
    readActiveRegistryBinding: vi.fn(async (request: ProviderRegistryBindingReadRequest) => ({
      binding: binding(request.operation_type),
      registry_evidence_digest: request.expected_registry_evidence_digest,
      provider_readback_evidence_digest: request.expected_provider_readback_evidence_digest,
      observed_at: '2026-08-02T00:00:01.000Z',
      version: request.expected_version,
    })),
  };
}

function binding(_operationType: string): ProviderRegistryBinding {
  return {
    registry_binding_key: 'vimeo_publication_primary',
    provider: 'vimeo',
    scope,
    provider_account_ref_hash: hash('9'),
    allowed_operation_types: ['publish_private', 'revoke_private'],
    mutation_policy: 'allowed',
    active: true,
  };
}

function readback(
  providerOperation: ProviderOperation,
  disposition: 'effect_exists' | 'effect_absent_retry_safe',
): ProviderCanonicalReadback {
  return {
    operation_id: providerOperation.job_id,
    provider: 'vimeo',
    scope,
    registry_binding_key: providerOperation.registry_binding_key,
    provider_account_ref_hash: providerOperation.provider_account_ref_hash,
    canonical_request_hash: providerOperation.canonical_request_hash,
    disposition,
    provider_resource_ref_hash: disposition === 'effect_exists' ? hash('e') : null,
    provider_acceptance_digest: disposition === 'effect_exists' ? hash('d') : null,
    reconciliation_digest: hash('8'),
    safe_error_code: null,
    completed_locally: false,
    observed_at: '2026-08-02T00:01:00.000Z',
  };
}
