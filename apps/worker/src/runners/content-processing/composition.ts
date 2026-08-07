import type { ContentProcessingRepository } from '../../../../../packages/contracts/src/content/processing/index.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../registry/index.ts';
import {
  ContentProcessingRunner,
  type ContentProcessingProvider,
  type ProcessContentCommand,
} from './runner.ts';

export type ContentProcessingWorkerDependencies = {
  repository: ContentProcessingRepository;
  provider: ContentProcessingProvider;
  nextCommand?: (() => Promise<ProcessContentCommand | null>) | undefined;
  nextCommands?: ((limit: number) => Promise<readonly ProcessContentCommand[]>) | undefined;
};

export async function runContentProcessingWorker(
  context: WorkerRunnerContext,
  dependencies?: ContentProcessingWorkerDependencies,
): Promise<WorkerRunnerResult> {
  if (!context.config.contentMediaEnabled || !dependencies) {
    return {
      enabled: false,
      providerCallsPerformed: false,
      summary: {
        disabledReason: !context.config.contentMediaEnabled
          ? 'content_media_default_off'
          : 'content_processing_runtime_unavailable',
        canaryBudget: 1,
        commandsSelected: 0,
        providerCalls: 0,
      },
    };
  }
  const canary = context.config.contentMediaMode !== 'production_broad';
  const batchLimit = canary ? 1 : context.config.contentMediaBatchSize;
  const concurrency = canary ? 1 : context.config.contentMediaConcurrency;
  let commands: readonly ProcessContentCommand[];
  try {
    commands = dependencies.nextCommands
      ? await dependencies.nextCommands(batchLimit)
      : dependencies.nextCommand
        ? [await dependencies.nextCommand()].filter(
            (command): command is ProcessContentCommand => command !== null,
          )
        : [];
  } catch (error) {
    if (!canary) {
      context.logger.warn('content media processing selection failed closed', {
        media_mode: 'production_broad',
        stage: 'processing_selection',
      });
      return {
        enabled: true,
        providerCallsPerformed: false,
        summary: {
          batchLimit,
          commandsSelected: 0,
          providerCalls: 0,
          stopped: true,
          stopReason: 'content_processing_broad_failed_closed',
        },
      };
    }
    throw error;
  }
  if (commands.length > batchLimit) {
    throw new Error('content_processing_batch_limit_exceeded');
  }
  if (commands.length === 0) {
    return {
      enabled: true,
      providerCallsPerformed: false,
      summary: {
        canaryBudget: canary ? 1 : undefined,
        batchLimit,
        commandsSelected: 0,
        providerCalls: 0,
      },
    };
  }
  if (
    canary &&
    commands.some((command) => command.idempotencyKey !== context.config.contentMediaCanaryId)
  ) {
    return {
      enabled: true,
      providerCallsPerformed: false,
      summary: {
        canaryBudget: 1,
        commandsSelected: commands.length,
        providerCalls: 0,
        stopped: true,
        stopReason: 'content_processing_canary_binding_mismatch',
      },
    };
  }
  if (
    !canary &&
    commands.some(
      (command) =>
        command.actor.accountKey !== context.config.accountKey ||
        command.actor.productKey !== context.config.productKey ||
        command.source.runtimeTier !== 'production' ||
        command.source.verificationEnvironmentId !== 'production_broad',
    )
  ) {
    throw new Error('content_processing_broad_scope_mismatch');
  }
  let providerCalls = 0;
  const provider: ContentProcessingProvider = {
    reconcileOrTranscode: (request) => {
      providerCalls += 1;
      return dependencies.provider.reconcileOrTranscode(request);
    },
    reconcileOrTranscribe: (request) => {
      providerCalls += 1;
      return dependencies.provider.reconcileOrTranscribe(request);
    },
    reconcileOrGenerateDrafts: (request) => {
      providerCalls += 1;
      return dependencies.provider.reconcileOrGenerateDrafts(request);
    },
  };
  const runner = new ContentProcessingRunner(dependencies.repository, provider);
  let results;
  try {
    results = await mapWithConcurrency(commands, concurrency, (command) => runner.run(command));
  } catch (error) {
    if (canary) throw error;
    context.logger.warn('content media processing failed closed', {
      media_mode: 'production_broad',
      stage: 'processing',
    });
    return {
      enabled: true,
      providerCallsPerformed: providerCalls > 0,
      summary: {
        batchLimit,
        concurrency,
        commandsSelected: commands.length,
        providerCalls,
        stopped: true,
        stopReason: 'content_processing_broad_failed_closed',
      },
    };
  }
  const dispositions = results.reduce<Record<string, number>>((counts, result) => {
    counts[result.disposition] = (counts[result.disposition] ?? 0) + 1;
    return counts;
  }, {});
  return {
    enabled: true,
    providerCallsPerformed: providerCalls > 0,
    summary: {
      canaryBudget: canary ? 1 : undefined,
      batchLimit,
      concurrency,
      commandsSelected: commands.length,
      providerCalls,
      ...(canary ? { disposition: results[0]!.disposition } : { dispositions }),
    },
  };
}

async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  run: (value: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = new Array<Output>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= values.length) return;
        results[index] = await run(values[index]!);
      }
    }),
  );
  return results;
}
