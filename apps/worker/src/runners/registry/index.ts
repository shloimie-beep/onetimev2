import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import { runContentIngestWorker } from '../content-ingest/composition.ts';
import type { ContentIngestWorkerDependencies } from '../content-ingest/composition.ts';
import { runContentProcessingWorker } from '../content-processing/composition.ts';
import type { ContentProcessingWorkerDependencies } from '../content-processing/composition.ts';
import { runContentPublicationWorker } from '../content-publication/composition.ts';
import type { ContentPublicationWorkerDependencies } from '../content-publication/composition.ts';
import { runOt16CheckpointWorker } from '../ghl-workflows/campaigns/composition.ts';

export const WORKER_RUNNER_REGISTRY_CONTRACT_VERSION = '1.0.0' as const;

export type WorkerRunnerLogger = {
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
};

export type WorkerRunnerContext = {
  config: AppConfig;
  pool: DbPool;
  source: NodeJS.ProcessEnv;
  workerInstanceKey: string;
  logger: WorkerRunnerLogger;
};

export type WorkerRunnerResult = {
  enabled: boolean;
  providerCallsPerformed: boolean;
  summary?: Record<string, unknown> | undefined;
};

export type WorkerRunnerRegistration = {
  runnerId: string;
  contractVersion: typeof WORKER_RUNNER_REGISTRY_CONTRACT_VERSION;
  run: (context: WorkerRunnerContext) => Promise<WorkerRunnerResult>;
};

export type WorkerRunnerResults = Readonly<Record<string, WorkerRunnerResult>>;

export function defineWorkerRunner(
  registration: WorkerRunnerRegistration,
): WorkerRunnerRegistration {
  validateWorkerRunners([registration]);
  return Object.freeze({ ...registration });
}

const ot16CheckpointRegistration = defineWorkerRunner({
  runnerId: 'communications.ot16-checkpoint',
  contractVersion: WORKER_RUNNER_REGISTRY_CONTRACT_VERSION,
  run: runOt16CheckpointWorker,
});

export type ContentMediaWorkerRuntime = {
  ingest?: ContentIngestWorkerDependencies | undefined;
  processing?: ContentProcessingWorkerDependencies | undefined;
  publication?: ContentPublicationWorkerDependencies | undefined;
};

export function createWorkerRunnerRegistrations(
  contentMediaRuntime?: ContentMediaWorkerRuntime,
): readonly WorkerRunnerRegistration[] {
  return Object.freeze([
    defineWorkerRunner({
      runnerId: 'content.media-ingest',
      contractVersion: WORKER_RUNNER_REGISTRY_CONTRACT_VERSION,
      run: (context) => runContentIngestWorker(context, contentMediaRuntime?.ingest),
    }),
    defineWorkerRunner({
      runnerId: 'content.media-processing',
      contractVersion: WORKER_RUNNER_REGISTRY_CONTRACT_VERSION,
      run: (context) => runContentProcessingWorker(context, contentMediaRuntime?.processing),
    }),
    defineWorkerRunner({
      runnerId: 'content.p21-publication',
      contractVersion: WORKER_RUNNER_REGISTRY_CONTRACT_VERSION,
      run: (context) => runContentPublicationWorker(context, contentMediaRuntime?.publication),
    }),
    ot16CheckpointRegistration,
  ]);
}

export const workerRunnerRegistrations = createWorkerRunnerRegistrations();

export async function runWorkerRunners(input: {
  context: WorkerRunnerContext;
  registrations?: readonly WorkerRunnerRegistration[] | undefined;
}): Promise<WorkerRunnerResults> {
  const registrations = [...(input.registrations ?? workerRunnerRegistrations)];
  validateWorkerRunners(registrations);
  const results: Record<string, WorkerRunnerResult> = {};
  for (const registration of registrations) {
    results[registration.runnerId] = await registration.run(input.context);
  }
  return Object.freeze(results);
}

function validateWorkerRunners(registrations: readonly WorkerRunnerRegistration[]): void {
  const ids = new Set<string>();
  for (const registration of registrations) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(registration.runnerId)) {
      throw new Error(
        `Invalid worker runner ID "${registration.runnerId}"; use a namespaced lowercase ID.`,
      );
    }
    if (registration.contractVersion !== WORKER_RUNNER_REGISTRY_CONTRACT_VERSION) {
      throw new Error(
        `Worker runner "${registration.runnerId}" requires unsupported contract ${registration.contractVersion}.`,
      );
    }
    if (ids.has(registration.runnerId)) {
      throw new Error(`Duplicate worker runner ID "${registration.runnerId}".`);
    }
    ids.add(registration.runnerId);
  }
}
