import { describe, expect, it, vi } from 'vitest';

import type {
  ContentPublicationAuthorityRequestPort,
  ContentPublicationDispatchContext,
  ContentPublicationProviderDispatchAdapter,
  ContentPublicationWorkerRepository,
  PendingContentPublicationProviderContext,
  VimeoContentPublicationObservation,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
  ProviderRegistryBindingEvidence,
  ProviderRegistryBindingReadPort,
  ProviderRegistryBindingReadRequest,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  createContentPublicationDispatchHandlers,
  createGatedProviderReconciliationAdapter,
  createGatedVimeoPublicationReadbackAdapter,
} from './adapters.ts';

const hash = (value: string) => value.repeat(64).slice(0, 64);
const scope = {
  product: 'one_time_mishnayos' as const,
  runtime_tier: 'isolated_staging' as const,
  verification_environment_id: 'ci' as const,
};

describe('P21 authority-gated provider adapters', () => {
  it('reopens the exact F05 context, reads independently approved F06 evidence, and never completes locally', async () => {
    const fixture = authorityFixture();
    const dispatch = vi.fn(async () => ({
      kind: 'accepted' as const,
      provider_acceptance_digest: hash('d'),
      completed_locally: true,
    }));
    const handler = createContentPublicationDispatchHandlers({
      repository: workerRepository(fixture.context),
      authority: fixture.authority,
      registry: fixture.registry,
      adapter: { dispatch },
    })[0]!;

    await expect(
      handler.dispatch(fixture.operation, new AbortController().signal),
    ).resolves.toEqual({
      kind: 'accepted',
      provider_acceptance_digest: hash('d'),
      completed_locally: false,
    });
    expect(fixture.authority.getPreapprovedRequest).toHaveBeenCalledWith({
      stage: 'dispatch',
      operation_type: 'publish_private',
      scope,
      effect_kind: 'mutation',
    });
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it.each([
    'missing_context',
    'scope_mismatch',
    'operation_mismatch',
    'effect_mismatch',
    'lease_mismatch',
    'version_mismatch',
    'outbox_mismatch',
    'missing_authority',
    'request_binding_mismatch',
    'request_selector_mismatch',
    'registry_missing',
    'registry_evidence_mismatch',
  ] as const)('fails %s before the dispatch adapter', async (failure) => {
    const fixture = authorityFixture();
    let context: ContentPublicationDispatchContext | null = fixture.context;
    let authority = fixture.authority;
    let registry: ProviderRegistryBindingReadPort = fixture.registry;
    if (failure === 'missing_context') context = null;
    if (failure === 'scope_mismatch') {
      context = {
        ...fixture.context,
        operation: {
          ...fixture.context.operation,
          scope: {
            product: 'one_time_mishnayos',
            runtime_tier: 'production',
            verification_environment_id: 'production_operator_canary',
          },
        },
      };
    }
    if (failure === 'operation_mismatch') {
      context = {
        ...fixture.context,
        intent: { ...fixture.context.intent, operation: 'revoke_private' },
        operation: { ...fixture.context.operation, operation_type: 'revoke_private' },
      };
    }
    if (failure === 'effect_mismatch') {
      context = {
        ...fixture.context,
        operation: { ...fixture.context.operation, effect_kind: 'readback' },
      };
    }
    if (failure === 'lease_mismatch') {
      context = {
        ...fixture.context,
        lease: { ...fixture.context.lease, generation: fixture.context.lease.generation + 1 },
      };
    }
    if (failure === 'version_mismatch') {
      context = {
        ...fixture.context,
        operation: {
          ...fixture.context.operation,
          version: fixture.context.operation.version + 1,
        },
      };
    }
    if (failure === 'outbox_mismatch') {
      context = {
        ...fixture.context,
        intent: { ...fixture.context.intent, contentId: 'content_other' },
      };
    }
    if (failure === 'missing_authority') {
      authority = { getPreapprovedRequest: vi.fn(async () => null) };
    }
    if (failure === 'request_binding_mismatch') {
      authority = {
        getPreapprovedRequest: vi.fn(async () => ({
          ...fixture.request,
          registry_binding_key: 'vimeo_other',
        })),
      };
    }
    if (failure === 'request_selector_mismatch') {
      authority = {
        getPreapprovedRequest: vi.fn(async () => ({
          ...fixture.request,
          operation_type: 'revoke_private',
        })),
      };
    }
    if (failure === 'registry_missing') {
      registry = { readActiveRegistryBinding: vi.fn(async () => null) };
    }
    if (failure === 'registry_evidence_mismatch') {
      registry = {
        readActiveRegistryBinding: vi.fn(async () => ({
          ...fixture.evidence,
          registry_evidence_digest: hash('0'),
        })),
      };
    }
    const dispatch = vi.fn<ContentPublicationProviderDispatchAdapter['dispatch']>();
    const handler = createContentPublicationDispatchHandlers({
      repository: workerRepository(context),
      authority,
      registry,
      adapter: { dispatch },
    })[0]!;

    await expect(
      handler.dispatch(fixture.operation, new AbortController().signal),
    ).resolves.toEqual({
      kind: 'permanently_rejected',
      safe_error_code: 'content_publication_authority_rejected',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('gates generic F06 readback and rejects a stale supplied binding before its adapter', async () => {
    const fixture = authorityFixture();
    const readCanonical = vi.fn(async () => canonicalReadback(fixture.operation));
    const adapter = createGatedProviderReconciliationAdapter({
      authority: fixture.authority,
      registry: fixture.registry,
      adapter: { provider: 'vimeo', readCanonical },
    });
    const stale = { ...fixture.binding, provider_account_ref_hash: hash('0') };

    await expect(
      adapter.readCanonical(fixture.operation, stale, new AbortController().signal),
    ).rejects.toThrow(/binding_mismatch/i);
    expect(readCanonical).not.toHaveBeenCalled();
    await expect(
      adapter.readCanonical(fixture.operation, fixture.binding, new AbortController().signal),
    ).resolves.toMatchObject({ disposition: 'effect_exists' });
    expect(readCanonical).toHaveBeenCalledOnce();
    expect(fixture.authority.getPreapprovedRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'reconciliation' }),
    );
  });

  it('requires the immutable accepted operation before finalization readback', async () => {
    const fixture = authorityFixture();
    const observation: VimeoContentPublicationObservation = {
      operation: 'publish_private',
      observedAt: '2026-08-02T00:01:00.000Z',
      opaqueProviderAssetRef: 'asset_private_one',
      providerResourceRefHash: hash('e'),
      vimeoPrivacy: 'private',
      vimeoAvailability: 'available',
      matchingCanonicalAssetCount: 1,
      exactContentVersionCorrelation: true,
      providerAcceptanceDigest: hash('d'),
    };
    const readCanonical = vi.fn(async () => observation);
    const adapter = createGatedVimeoPublicationReadbackAdapter({
      authority: fixture.authority,
      registry: fixture.registry,
      adapter: { readCanonical },
    });
    const acceptedContext = finalizationContext(fixture.operation);
    const missingOperationContext: PendingContentPublicationProviderContext = {
      intent: acceptedContext.intent,
      providerOperation: acceptedContext.providerOperation,
      executionScope: acceptedContext.executionScope!,
    };

    await expect(
      adapter.readCanonical(missingOperationContext, new AbortController().signal),
    ).rejects.toThrow(/context_mismatch/i);
    expect(readCanonical).not.toHaveBeenCalled();
    await expect(
      adapter.readCanonical(
        {
          ...acceptedContext,
          intent: { ...acceptedContext.intent, contentId: 'content_other' },
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/context_mismatch/i);
    await expect(
      adapter.readCanonical(
        {
          ...acceptedContext,
          operationRecord: {
            ...acceptedContext.operationRecord!,
            state: 'acceptance_unknown',
            unknown_effect: true,
          },
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/context_mismatch/i);
    expect(readCanonical).not.toHaveBeenCalled();
    await expect(
      adapter.readCanonical(acceptedContext, new AbortController().signal),
    ).resolves.toEqual(observation);
    expect(readCanonical).toHaveBeenCalledOnce();
    expect(fixture.authority.getPreapprovedRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'finalization' }),
    );
  });
});

function authorityFixture() {
  const operation = providerOperation();
  const binding: ProviderRegistryBinding = {
    registry_binding_key: operation.registry_binding_key,
    provider: 'vimeo',
    scope,
    provider_account_ref_hash: operation.provider_account_ref_hash,
    allowed_operation_types: ['publish_private', 'revoke_private'],
    mutation_policy: 'allowed',
    active: true,
  };
  const request: ProviderRegistryBindingReadRequest = {
    registry_binding_key: binding.registry_binding_key,
    provider: 'vimeo',
    scope,
    operation_type: 'publish_private',
    effect_kind: 'mutation',
    expected_provider_account_ref_hash: binding.provider_account_ref_hash,
    expected_registry_evidence_digest: hash('a'),
    expected_provider_readback_evidence_digest: hash('b'),
    expected_version: 3,
    observed_not_before: '2026-08-02T00:00:00.000Z',
  };
  const evidence: ProviderRegistryBindingEvidence = {
    binding,
    registry_evidence_digest: request.expected_registry_evidence_digest,
    provider_readback_evidence_digest: request.expected_provider_readback_evidence_digest,
    observed_at: '2026-08-02T00:00:01.000Z',
    version: request.expected_version,
  };
  const authority: ContentPublicationAuthorityRequestPort = {
    getPreapprovedRequest: vi.fn(async () => request),
  };
  const registry = { readActiveRegistryBinding: vi.fn(async () => evidence) };
  const context = dispatchContext(operation);
  return { operation, binding, request, evidence, authority, registry, context };
}

function providerOperation(): ProviderOperation {
  return {
    job_id: 'p21_publish_job_one',
    operation_type: 'publish_private',
    aggregate_ref: 'content_one',
    source_version: 1,
    provider: 'vimeo',
    scope,
    idempotency_key: 'publish.one',
    canonical_request_hash: hash('c'),
    payload_ref: 'content_version_one',
    payload_digest: hash('f'),
    compensation_for_job_id: null,
    state: 'in_flight',
    version: 3,
    recovery_generation: 0,
    dispatch_attempts: 1,
    lifetime_dispatch_attempts: 1,
    reconciliation_attempts: 0,
    lease_owner: 'worker_one',
    lease_generation: 1,
    lease_expires_at: '2026-08-02T00:05:00.000Z',
    last_heartbeat_at: '2026-08-02T00:00:00.000Z',
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: '2026-08-01T23:59:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    registry_binding_key: 'vimeo_publication_primary',
    provider_account_ref_hash: hash('9'),
    effect_kind: 'mutation',
    household_id: null,
  };
}

function dispatchContext(operation: ProviderOperation): ContentPublicationDispatchContext {
  return {
    intent: {
      intentId: 'publication_intent_one',
      accountKey: 'account_one',
      productKey: 'one_time_mishnayos',
      providerOperationId: operation.job_id,
      provider: 'vimeo',
      contentId: operation.aggregate_ref,
      contentVersionId: operation.payload_ref,
      publicationGeneration: operation.source_version,
      operation: 'publish_private',
      idempotencyKey: operation.idempotency_key,
      requestHash: operation.canonical_request_hash,
      state: 'pending',
      createdAt: operation.created_at,
      approvalEvidence: { projectionDigest: operation.payload_digest } as never,
    },
    operation,
    lease: {
      job_id: operation.job_id,
      owner: operation.lease_owner!,
      generation: operation.lease_generation,
      expires_at: operation.lease_expires_at!,
      job_version: operation.version,
    },
  };
}

function workerRepository(
  context: ContentPublicationDispatchContext | null,
): ContentPublicationWorkerRepository {
  return {
    reopenDispatchContext: vi.fn(async () => context),
    listAcceptanceUnknownOperations: vi.fn(async () => []),
    listAcceptedPendingWork: vi.fn(async () => []),
  };
}

function canonicalReadback(operation: ProviderOperation): ProviderCanonicalReadback {
  return {
    operation_id: operation.job_id,
    provider: 'vimeo',
    scope,
    registry_binding_key: operation.registry_binding_key,
    provider_account_ref_hash: operation.provider_account_ref_hash,
    canonical_request_hash: operation.canonical_request_hash,
    disposition: 'effect_exists',
    provider_resource_ref_hash: hash('e'),
    provider_acceptance_digest: hash('d'),
    reconciliation_digest: hash('8'),
    safe_error_code: null,
    completed_locally: false,
    observed_at: '2026-08-02T00:01:00.000Z',
  };
}

function finalizationContext(
  operation: ProviderOperation,
): PendingContentPublicationProviderContext {
  const accepted = {
    ...operation,
    state: 'accepted' as const,
    unknown_effect: false,
    provider_acceptance_digest: hash('d'),
    reconciliation_digest: hash('8'),
  };
  const context = dispatchContext(operation);
  return {
    intent: context.intent,
    executionScope: scope,
    operationRecord: accepted,
    providerOperation: {
      accountKey: context.intent.accountKey,
      providerOperationId: accepted.job_id,
      providerOperationVersion: accepted.version,
      provider: 'vimeo',
      operation: 'publish_private',
      productKey: 'one_time_mishnayos',
      contentId: accepted.aggregate_ref,
      contentVersionId: accepted.payload_ref,
      publicationGeneration: accepted.source_version,
      idempotencyKey: accepted.idempotency_key,
      canonicalRequestHash: accepted.canonical_request_hash,
      state: 'accepted',
      unknownEffect: false,
      registryBindingKey: accepted.registry_binding_key,
      providerAccountRefHash: accepted.provider_account_ref_hash,
      providerAcceptanceDigest: accepted.provider_acceptance_digest,
      providerReconciliationDigest: accepted.reconciliation_digest,
      approvalProjectionDigest: accepted.payload_digest,
    },
  };
}
