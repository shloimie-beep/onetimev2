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
  nextCommand: () => Promise<ProcessContentCommand | null>;
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
  const command = await dependencies.nextCommand();
  if (!command) {
    return {
      enabled: true,
      providerCallsPerformed: false,
      summary: { canaryBudget: 1, commandsSelected: 0, providerCalls: 0 },
    };
  }
  if (command.idempotencyKey !== context.config.contentMediaCanaryId) {
    return {
      enabled: true,
      providerCallsPerformed: false,
      summary: {
        canaryBudget: 1,
        commandsSelected: 1,
        providerCalls: 0,
        stopped: true,
        stopReason: 'content_processing_canary_binding_mismatch',
      },
    };
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
  const result = await new ContentProcessingRunner(dependencies.repository, provider).run(command);
  return {
    enabled: true,
    providerCallsPerformed: providerCalls > 0,
    summary: {
      canaryBudget: 1,
      commandsSelected: 1,
      providerCalls,
      disposition: result.disposition,
    },
  };
}
