import type {
  ContentPublicationAcceptedWork,
  ContentPublicationAuthorityRequestPort,
  ContentPublicationCommandBinding,
  ContentPublicationProviderDispatchAdapter,
  ContentPublicationScope,
  ContentPublicationWorkerRepository,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  JobFoundationRepository,
  JobScope,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderReadbackAdapter,
  ProviderReconciliationRepository,
  ProviderRegistryBindingReadPort,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { runFoundationJobBatch } from '../foundation/runner.ts';
import {
  runProviderReconciliationBatch,
  type ProviderReconciliationRunSummary,
} from '../provider-reconciliation/runner.ts';
import {
  createContentPublicationDispatchHandlers,
  createGatedProviderReconciliationAdapter,
  resolveContentPublicationAuthority,
} from './adapters.ts';

export interface ContentPublicationFinalizationService {
  applyPrivatePublicationReadback(input: {
    scope: ContentPublicationScope;
    contentId: string;
    providerOperationId: string;
    binding: ContentPublicationCommandBinding;
  }): Promise<unknown>;
  applyPrivateRevocationReadback(input: {
    scope: ContentPublicationScope;
    contentId: string;
    providerOperationId: string;
    binding: ContentPublicationCommandBinding;
  }): Promise<unknown>;
}

export interface ContentPublicationRunnerLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface ContentPublicationRunSummary {
  dispatch: Awaited<ReturnType<typeof runFoundationJobBatch>>;
  reconciliation: ProviderReconciliationRunSummary;
  finalization: {
    selected: number;
    completed: number;
    failed_closed: number;
  };
}

export async function runContentPublicationBatch(input: {
  jobRepository: JobFoundationRepository;
  publicationRepository: ContentPublicationWorkerRepository;
  providerRepository: ProviderReconciliationRepository;
  authority: ContentPublicationAuthorityRequestPort;
  registry: ProviderRegistryBindingReadPort;
  dispatchAdapter: ContentPublicationProviderDispatchAdapter;
  reconciliationAdapter: ProviderReadbackAdapter;
  finalizationService: ContentPublicationFinalizationService;
  logger: ContentPublicationRunnerLogger;
  options: {
    owner: string;
    scope: JobScope;
    batchSize: number;
    dispatchTimeoutMs: number;
    reconciliationTimeoutMs: number;
    clock: () => Date;
    random: () => number;
  };
}): Promise<ContentPublicationRunSummary> {
  const dispatch = await runFoundationJobBatch({
    repository: input.jobRepository,
    handlers: createContentPublicationDispatchHandlers({
      repository: input.publicationRepository,
      authority: input.authority,
      registry: input.registry,
      adapter: input.dispatchAdapter,
    }),
    logger: input.logger,
    options: {
      owner: input.options.owner,
      scope: input.options.scope,
      batch_size: input.options.batchSize,
      dispatch_timeout_ms: input.options.dispatchTimeoutMs,
      random: input.options.random,
      clock: input.options.clock,
    },
  });

  const reconciliation = emptyReconciliationSummary();
  const unknownOperations = await input.publicationRepository.listAcceptanceUnknownOperations(
    input.options.scope,
    input.options.batchSize,
  );
  const gatedReconciliationAdapter = createGatedProviderReconciliationAdapter({
    authority: input.authority,
    registry: input.registry,
    adapter: input.reconciliationAdapter,
  });
  for (const operation of unknownOperations) {
    try {
      const evidence = await resolveContentPublicationAuthority({
        selector: {
          stage: 'reconciliation',
          operation_type: publicationOperation(operation.operation_type),
          scope: { ...operation.scope },
          effect_kind: 'mutation',
        },
        operation,
        authority: input.authority,
        registry: input.registry,
      });
      const oneOperationRepository: ProviderReconciliationRepository = {
        async claimAcceptanceUnknown() {
          return [operation];
        },
        persistReconciliation: (persistInput) =>
          input.providerRepository.persistReconciliation(persistInput),
      };
      const result = await runProviderReconciliationBatch({
        repository: oneOperationRepository,
        bindings: [evidence.binding],
        adapters: [gatedReconciliationAdapter],
        scope: input.options.scope,
        limit: 1,
        timeout_ms: input.options.reconciliationTimeoutMs,
        now: input.options.clock(),
        random_unit_interval: input.options.random,
      });
      addReconciliationSummary(reconciliation, result);
    } catch {
      reconciliation.failed_closed += 1;
      input.logger.warn(
        {
          operation_id: operation.job_id,
          operation_type: operation.operation_type,
          state: operation.state,
        },
        'content publication reconciliation failed closed',
      );
    }
  }

  const finalization = { selected: 0, completed: 0, failed_closed: 0 };
  const accepted = await input.publicationRepository.listAcceptedPendingWork(
    input.options.scope,
    input.options.batchSize,
  );
  finalization.selected = accepted.length;
  for (const work of accepted) {
    try {
      assertAcceptedWork(work, input.options.scope);
      const binding = finalizationBinding(work, input.options.clock());
      const finalizationInput = {
        scope: {
          accountKey: work.accountKey,
          productKey: work.scope.product,
        },
        contentId: work.contentId,
        providerOperationId: work.providerOperationId,
        binding,
      };
      if (work.operation === 'publish_private') {
        await input.finalizationService.applyPrivatePublicationReadback(finalizationInput);
      } else {
        await input.finalizationService.applyPrivateRevocationReadback(finalizationInput);
      }
      finalization.completed += 1;
    } catch {
      finalization.failed_closed += 1;
      input.logger.warn(
        {
          operation_id: work.providerOperationId,
          operation_type: work.operation,
          content_id: work.contentId,
        },
        'content publication finalization failed closed',
      );
    }
  }

  return { dispatch, reconciliation, finalization };
}

function finalizationBinding(
  work: ContentPublicationAcceptedWork,
  now: Date,
): ContentPublicationCommandBinding {
  return {
    idempotencyKey: [
      'p21-finalize',
      work.operation,
      work.providerOperationId,
      work.providerOperationVersion,
      work.outboxIntentId,
    ].join(':'),
    requestHash: '0'.repeat(64),
    expectedVersion: work.contentRecordVersion,
    occurredAt: now.toISOString(),
  };
}

function assertAcceptedWork(work: ContentPublicationAcceptedWork, scope: JobScope): void {
  if (
    !sameScope(work.scope, scope) ||
    work.accountKey.trim() === '' ||
    work.contentId.trim() === '' ||
    work.providerOperationId.trim() === '' ||
    work.outboxIntentId.trim() === '' ||
    !Number.isSafeInteger(work.providerOperationVersion) ||
    work.providerOperationVersion < 1 ||
    !Number.isSafeInteger(work.contentRecordVersion) ||
    work.contentRecordVersion < 1
  ) {
    throw new Error('content_publication_accepted_work_invalid');
  }
}

function publicationOperation(operation: string): 'publish_private' | 'revoke_private' {
  if (operation !== 'publish_private' && operation !== 'revoke_private') {
    throw new Error('content_publication_operation_mismatch');
  }
  return operation;
}

function sameScope(left: JobScope, right: JobScope): boolean {
  return (
    left.product === right.product &&
    left.runtime_tier === right.runtime_tier &&
    left.verification_environment_id === right.verification_environment_id
  );
}

function emptyReconciliationSummary(): ProviderReconciliationRunSummary {
  return {
    claimed: 0,
    accepted_or_complete: 0,
    retry_safe: 0,
    rejected: 0,
    still_unknown_or_dead_letter: 0,
    stale_fenced: 0,
    failed_closed: 0,
  };
}

function addReconciliationSummary(
  target: ProviderReconciliationRunSummary,
  source: ProviderReconciliationRunSummary,
): void {
  for (const key of Object.keys(target) as Array<keyof ProviderReconciliationRunSummary>) {
    target[key] += source[key];
  }
}
