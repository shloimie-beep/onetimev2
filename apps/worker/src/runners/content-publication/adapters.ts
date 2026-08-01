import type {
  ContentPublicationAuthorityRequestPort,
  ContentPublicationAuthoritySelector,
  ContentPublicationDispatchContext,
  ContentPublicationProviderDispatchAdapter,
  ContentPublicationWorkerRepository,
  PendingContentPublicationProviderContext,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  ProviderDispatchOutcome,
  ProviderJobHandler,
  ProviderJobRecord,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderOperation,
  ProviderReadbackAdapter,
  ProviderRegistryBinding,
  ProviderRegistryBindingEvidence,
  ProviderRegistryBindingReadPort,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  assertProviderOperationBound,
  assertProviderRegistryBindingEvidence,
} from '../../../../../packages/domain/src/providers/shared/index.ts';

export const nullContentPublicationAuthorityPort: ContentPublicationAuthorityRequestPort =
  Object.freeze({
    async getPreapprovedRequest() {
      return null;
    },
  });

export async function resolveContentPublicationAuthority(input: {
  selector: ContentPublicationAuthoritySelector;
  operation: ProviderOperation;
  authority: ContentPublicationAuthorityRequestPort;
  registry: ProviderRegistryBindingReadPort;
}): Promise<ProviderRegistryBindingEvidence> {
  assertSelectorMatchesOperation(input.selector, input.operation);
  const request = await input.authority.getPreapprovedRequest({ ...input.selector });
  if (
    request === null ||
    request.provider !== 'vimeo' ||
    request.registry_binding_key !== input.operation.registry_binding_key ||
    request.expected_provider_account_ref_hash !== input.operation.provider_account_ref_hash ||
    request.operation_type !== input.selector.operation_type ||
    request.effect_kind !== input.selector.effect_kind ||
    !sameScope(request.scope, input.selector.scope)
  ) {
    throw new Error('content_publication_authority_request_mismatch');
  }
  const evidence = await input.registry.readActiveRegistryBinding(request);
  if (evidence === null) throw new Error('content_publication_registry_binding_unavailable');
  assertProviderRegistryBindingEvidence(request, evidence);
  assertProviderOperationBound(input.operation, evidence.binding);
  if (
    evidence.binding.provider !== 'vimeo' ||
    evidence.binding.registry_binding_key !== input.operation.registry_binding_key ||
    evidence.binding.provider_account_ref_hash !== input.operation.provider_account_ref_hash ||
    !evidence.binding.allowed_operation_types.includes(input.selector.operation_type) ||
    evidence.binding.mutation_policy !== 'allowed'
  ) {
    throw new Error('content_publication_registry_binding_mismatch');
  }
  return evidence;
}

export function createContentPublicationDispatchHandlers(input: {
  repository: ContentPublicationWorkerRepository;
  authority: ContentPublicationAuthorityRequestPort;
  registry: ProviderRegistryBindingReadPort;
  adapter: ContentPublicationProviderDispatchAdapter;
}): readonly ProviderJobHandler[] {
  return (['publish_private', 'revoke_private'] as const).map((operationType) => ({
    operation_type: operationType,
    async dispatch(job: ProviderJobRecord, signal: AbortSignal): Promise<ProviderDispatchOutcome> {
      let context: ContentPublicationDispatchContext | null;
      let evidence: ProviderRegistryBindingEvidence;
      try {
        context = await input.repository.reopenDispatchContext(job);
        if (context === null || !dispatchContextMatchesJob(context, job, operationType)) {
          throw new Error('content_publication_dispatch_context_mismatch');
        }
        evidence = await resolveContentPublicationAuthority({
          selector: selector('dispatch', operationType, context.operation),
          operation: context.operation,
          authority: input.authority,
          registry: input.registry,
        });
      } catch {
        return {
          kind: 'permanently_rejected',
          safe_error_code: 'content_publication_authority_rejected',
        };
      }
      const outcome = await input.adapter.dispatch(context, evidence, signal);
      return outcome.kind === 'accepted' ? { ...outcome, completed_locally: false } : outcome;
    },
  }));
}

export function createGatedProviderReconciliationAdapter(input: {
  authority: ContentPublicationAuthorityRequestPort;
  registry: ProviderRegistryBindingReadPort;
  adapter: ProviderReadbackAdapter;
}): ProviderReadbackAdapter {
  if (input.adapter.provider !== 'vimeo') {
    throw new Error('content_publication_vimeo_reconciliation_adapter_required');
  }
  return {
    provider: 'vimeo',
    async readCanonical(operation, suppliedBinding, signal) {
      const operationType = contentPublicationOperationType(operation);
      const evidence = await resolveContentPublicationAuthority({
        selector: selector('reconciliation', operationType, operation),
        operation,
        authority: input.authority,
        registry: input.registry,
      });
      assertSameBinding(suppliedBinding, evidence.binding);
      return input.adapter.readCanonical(operation, evidence.binding, signal);
    },
  };
}

export function createGatedVimeoPublicationReadbackAdapter(input: {
  authority: ContentPublicationAuthorityRequestPort;
  registry: ProviderRegistryBindingReadPort;
  adapter: VimeoContentPublicationReadbackAdapter;
}): VimeoContentPublicationReadbackAdapter {
  return {
    async readCanonical(context, signal) {
      const operation = requireContextOperation(context);
      const operationType = contentPublicationOperationType(operation);
      await resolveContentPublicationAuthority({
        selector: selector('finalization', operationType, operation),
        operation,
        authority: input.authority,
        registry: input.registry,
      });
      return input.adapter.readCanonical(context, signal);
    },
  };
}

function selector(
  stage: ContentPublicationAuthoritySelector['stage'],
  operationType: ContentPublicationAuthoritySelector['operation_type'],
  operation: ProviderOperation,
): ContentPublicationAuthoritySelector {
  return {
    stage,
    operation_type: operationType,
    scope: { ...operation.scope },
    effect_kind: 'mutation',
  };
}

function contentPublicationOperationType(
  operation: ProviderOperation,
): ContentPublicationAuthoritySelector['operation_type'] {
  if (
    operation.provider !== 'vimeo' ||
    (operation.operation_type !== 'publish_private' &&
      operation.operation_type !== 'revoke_private')
  ) {
    throw new Error('content_publication_operation_mismatch');
  }
  return operation.operation_type;
}

function assertSelectorMatchesOperation(
  selectorValue: ContentPublicationAuthoritySelector,
  operation: ProviderOperation,
): void {
  if (
    selectorValue.effect_kind !== 'mutation' ||
    operation.effect_kind !== 'mutation' ||
    selectorValue.operation_type !== contentPublicationOperationType(operation) ||
    !sameScope(selectorValue.scope, operation.scope)
  ) {
    throw new Error('content_publication_authority_selector_mismatch');
  }
}

function dispatchContextMatchesJob(
  context: ContentPublicationDispatchContext,
  job: ProviderJobRecord,
  operationType: ContentPublicationAuthoritySelector['operation_type'],
): boolean {
  return (
    context.operation.provider === 'vimeo' &&
    context.operation.provider === job.provider &&
    context.operation.operation_type === operationType &&
    context.operation.job_id === job.job_id &&
    context.operation.aggregate_ref === job.aggregate_ref &&
    context.operation.source_version === job.source_version &&
    sameScope(context.operation.scope, job.scope) &&
    context.operation.idempotency_key === job.idempotency_key &&
    context.operation.canonical_request_hash === job.canonical_request_hash &&
    context.operation.payload_ref === job.payload_ref &&
    context.operation.payload_digest === job.payload_digest &&
    context.operation.compensation_for_job_id === job.compensation_for_job_id &&
    context.operation.version === job.version &&
    context.operation.state === 'in_flight' &&
    context.operation.recovery_generation === job.recovery_generation &&
    context.operation.dispatch_attempts === job.dispatch_attempts &&
    context.operation.lifetime_dispatch_attempts === job.lifetime_dispatch_attempts &&
    context.operation.reconciliation_attempts === job.reconciliation_attempts &&
    context.operation.lease_owner === job.lease_owner &&
    context.operation.lease_generation === job.lease_generation &&
    context.operation.lease_expires_at === job.lease_expires_at &&
    context.operation.last_heartbeat_at === job.last_heartbeat_at &&
    context.operation.next_attempt_at === job.next_attempt_at &&
    context.operation.unknown_effect === false &&
    context.operation.provider_acceptance_digest === job.provider_acceptance_digest &&
    context.operation.reconciliation_digest === job.reconciliation_digest &&
    context.operation.safe_error_code === job.safe_error_code &&
    context.operation.created_at === job.created_at &&
    context.operation.updated_at === job.updated_at &&
    context.operation.effect_kind === 'mutation' &&
    context.intent.providerOperationId === job.job_id &&
    context.intent.provider === 'vimeo' &&
    context.intent.operation === operationType &&
    context.intent.productKey === job.scope.product &&
    context.intent.contentId === job.aggregate_ref &&
    context.intent.contentVersionId === job.payload_ref &&
    context.intent.publicationGeneration === job.source_version &&
    context.intent.idempotencyKey === job.idempotency_key &&
    context.intent.requestHash === job.canonical_request_hash &&
    context.intent.approvalEvidence.projectionDigest === job.payload_digest &&
    context.intent.state === 'pending' &&
    context.intent.createdAt === job.created_at &&
    context.lease.job_id === job.job_id &&
    context.lease.owner === job.lease_owner &&
    context.lease.generation === job.lease_generation &&
    context.lease.expires_at === job.lease_expires_at &&
    context.lease.job_version === job.version
  );
}

function requireContextOperation(
  context: PendingContentPublicationProviderContext,
): ProviderOperation {
  const operation = context.operationRecord;
  if (
    !operation ||
    operation.provider !== 'vimeo' ||
    operation.effect_kind !== 'mutation' ||
    operation.job_id !== context.providerOperation.providerOperationId ||
    operation.version !== context.providerOperation.providerOperationVersion ||
    operation.operation_type !== context.providerOperation.operation ||
    operation.provider !== context.providerOperation.provider ||
    operation.scope.product !== context.providerOperation.productKey ||
    operation.aggregate_ref !== context.providerOperation.contentId ||
    operation.payload_ref !== context.providerOperation.contentVersionId ||
    operation.source_version !== context.providerOperation.publicationGeneration ||
    operation.idempotency_key !== context.providerOperation.idempotencyKey ||
    operation.canonical_request_hash !== context.providerOperation.canonicalRequestHash ||
    operation.registry_binding_key !== context.providerOperation.registryBindingKey ||
    operation.provider_account_ref_hash !== context.providerOperation.providerAccountRefHash ||
    operation.provider_acceptance_digest !== context.providerOperation.providerAcceptanceDigest ||
    operation.reconciliation_digest !== context.providerOperation.providerReconciliationDigest ||
    operation.payload_digest !== context.providerOperation.approvalProjectionDigest ||
    operation.state !== 'accepted' ||
    operation.unknown_effect ||
    context.intent.providerOperationId !== operation.job_id ||
    context.intent.provider !== operation.provider ||
    context.intent.operation !== operation.operation_type ||
    context.intent.productKey !== operation.scope.product ||
    context.intent.contentId !== operation.aggregate_ref ||
    context.intent.contentVersionId !== operation.payload_ref ||
    context.intent.publicationGeneration !== operation.source_version ||
    context.intent.idempotencyKey !== operation.idempotency_key ||
    context.intent.requestHash !== operation.canonical_request_hash ||
    context.intent.approvalEvidence.projectionDigest !== operation.payload_digest ||
    context.intent.state !== 'pending' ||
    !context.executionScope ||
    !sameScope(context.executionScope, operation.scope)
  ) {
    throw new Error('content_publication_finalization_context_mismatch');
  }
  return operation;
}

function assertSameBinding(
  supplied: ProviderRegistryBinding,
  active: ProviderRegistryBinding,
): void {
  if (
    supplied.registry_binding_key !== active.registry_binding_key ||
    supplied.provider !== active.provider ||
    supplied.provider_account_ref_hash !== active.provider_account_ref_hash ||
    supplied.mutation_policy !== active.mutation_policy ||
    supplied.active !== active.active ||
    !sameScope(supplied.scope, active.scope) ||
    JSON.stringify([...supplied.allowed_operation_types].sort()) !==
      JSON.stringify([...active.allowed_operation_types].sort())
  ) {
    throw new Error('content_publication_reconciliation_binding_mismatch');
  }
}

function sameScope(left: ProviderOperation['scope'], right: ProviderOperation['scope']): boolean {
  return (
    left.product === right.product &&
    left.runtime_tier === right.runtime_tier &&
    left.verification_environment_id === right.verification_environment_id
  );
}
