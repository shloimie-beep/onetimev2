import type {
  ContentPublicationAuthorityRequestPort,
  ContentPublicationProjectionRepository,
  ContentPublicationProviderDispatchAdapter,
  ContentPublicationRepository,
  ContentPublicationWorkerRepository,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  JobFoundationRepository,
  JobScope,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderReadbackAdapter,
  ProviderReconciliationRepository,
  ProviderRegistryBinding,
  ProviderRegistryBindingReadPort,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { createContentPublicationService } from '../../../../web/src/server/features/content/publication/service.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../registry/index.ts';
import {
  createGatedVimeoPublicationReadbackAdapter,
  nullContentPublicationAuthorityPort,
} from './adapters.ts';
import { runContentPublicationBatch } from './runner.ts';

export interface ContentPublicationWorkerDependencies {
  jobRepository: JobFoundationRepository;
  publicationRepository: ContentPublicationRepository & ContentPublicationWorkerRepository;
  approvedProjectionRepository: ContentPublicationProjectionRepository;
  providerRepository: ProviderReconciliationRepository;
  registry: ProviderRegistryBindingReadPort;
  authority?: ContentPublicationAuthorityRequestPort | undefined;
  vimeoBinding: ProviderRegistryBinding;
  dispatchAdapter: ContentPublicationProviderDispatchAdapter;
  reconciliationAdapter: ProviderReadbackAdapter;
  finalizationReadbackAdapter: VimeoContentPublicationReadbackAdapter;
  createId: () => string;
  options?: {
    scope?: JobScope | undefined;
    batchSize?: number | undefined;
    dispatchTimeoutMs?: number | undefined;
    reconciliationTimeoutMs?: number | undefined;
    clock?: (() => Date) | undefined;
    random?: (() => number) | undefined;
  };
}

export async function runContentPublicationWorker(
  context: WorkerRunnerContext,
  dependencies?: ContentPublicationWorkerDependencies,
): Promise<WorkerRunnerResult> {
  if (!dependencies) return disabled();

  const authority = dependencies.authority ?? nullContentPublicationAuthorityPort;
  let providerCalls = 0;
  const dispatchAdapter: ContentPublicationProviderDispatchAdapter = {
    async dispatch(dispatchContext, evidence, signal) {
      providerCalls += 1;
      return dependencies.dispatchAdapter.dispatch(dispatchContext, evidence, signal);
    },
  };
  const reconciliationAdapter: ProviderReadbackAdapter = {
    provider: dependencies.reconciliationAdapter.provider,
    async readCanonical(operation, binding, signal) {
      providerCalls += 1;
      return dependencies.reconciliationAdapter.readCanonical(operation, binding, signal);
    },
  };
  const finalizationReadbackAdapter = createGatedVimeoPublicationReadbackAdapter({
    authority,
    registry: dependencies.registry,
    adapter: {
      async readCanonical(publicationContext, signal) {
        providerCalls += 1;
        return dependencies.finalizationReadbackAdapter.readCanonical(publicationContext, signal);
      },
    },
  });
  const finalizationService = createContentPublicationService({
    repository: dependencies.publicationRepository,
    approvedProjectionRepository: dependencies.approvedProjectionRepository,
    vimeoProviderBinding: dependencies.vimeoBinding,
    vimeoReadbackAdapter: finalizationReadbackAdapter,
    createId: dependencies.createId,
  });
  const scope = dependencies.options?.scope ?? runtimeScope(context);
  const summary = await runContentPublicationBatch({
    jobRepository: dependencies.jobRepository,
    publicationRepository: dependencies.publicationRepository,
    providerRepository: dependencies.providerRepository,
    authority,
    registry: dependencies.registry,
    dispatchAdapter,
    reconciliationAdapter,
    finalizationService,
    logger: {
      info: (fields, message) => context.logger.info(message, fields),
      warn: (fields, message) => context.logger.warn(message, fields),
    },
    options: {
      owner: context.workerInstanceKey,
      scope,
      batchSize: dependencies.options?.batchSize ?? 10,
      dispatchTimeoutMs: dependencies.options?.dispatchTimeoutMs ?? 10_000,
      reconciliationTimeoutMs: dependencies.options?.reconciliationTimeoutMs ?? 10_000,
      clock: dependencies.options?.clock ?? (() => new Date()),
      random: dependencies.options?.random ?? Math.random,
    },
  });
  return {
    enabled: true,
    providerCallsPerformed: providerCalls > 0,
    summary: { ...summary, providerCalls },
  };
}

function runtimeScope(context: WorkerRunnerContext): JobScope {
  return {
    product: 'one_time_mishnayos',
    runtime_tier: context.config.oneTimeRuntimeTier,
    verification_environment_id: context.config.oneTimeVerificationEnvironmentId,
  };
}

function disabled(): WorkerRunnerResult {
  return {
    enabled: false,
    providerCallsPerformed: false,
    summary: {
      disabledReason: 'content_publication_authority_unavailable',
      providerCalls: 0,
      dispatch: {
        claimed: 0,
        complete: 0,
        accepted: 0,
        retry_wait: 0,
        acceptance_unknown: 0,
        rejected: 0,
        dead_letter: 0,
        lease_lost: 0,
      },
      reconciliation: {
        claimed: 0,
        accepted_or_complete: 0,
        retry_safe: 0,
        rejected: 0,
        still_unknown_or_dead_letter: 0,
        stale_fenced: 0,
        failed_closed: 0,
      },
      finalization: { selected: 0, completed: 0, failed_closed: 0 },
    },
  };
}
