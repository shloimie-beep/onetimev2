import type { ContentIngestRepository } from '../../../../../packages/contracts/src/content/ingest/index.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../registry/index.ts';
import { scanRegisteredDriveFolder, type DriveIngestProvider } from './runner.ts';

export type ContentIngestWorkerDependencies = {
  repository: ContentIngestRepository;
  driveProvider: DriveIngestProvider;
};

export async function runContentIngestWorker(
  context: WorkerRunnerContext,
  dependencies?: ContentIngestWorkerDependencies,
): Promise<WorkerRunnerResult> {
  if (!context.config.contentMediaEnabled) return disabled('content_media_default_off');
  if (!context.config.contentDriveConfigured || !context.config.contentDriveFolderId) {
    return disabled('content_drive_optional_provider_off');
  }
  if (!dependencies) return disabled('content_drive_runtime_unavailable');

  let providerCalls = 0;
  const firstPage = await dependencies.driveProvider.listPage({
    registeredIncomingFolderId: context.config.contentDriveFolderId,
  });
  providerCalls += 1;
  if (firstPage.nextPageToken || firstPage.files.length !== 1) {
    return {
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        canaryBudget: 1,
        candidateCount: firstPage.files.length,
        stopped: true,
        stopReason: firstPage.nextPageToken
          ? 'content_drive_canary_pagination_exceeded'
          : 'content_drive_canary_requires_exactly_one_recording',
        databaseWrites: 0,
        providerCalls,
      },
    };
  }
  if (firstPage.files[0]?.fileId !== context.config.contentMediaCanaryId) {
    return {
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        canaryBudget: 1,
        candidateCount: 1,
        stopped: true,
        stopReason: 'content_drive_canary_binding_mismatch',
        databaseWrites: 0,
        providerCalls,
      },
    };
  }
  let consumed = false;
  const cachedProvider: DriveIngestProvider = {
    async listPage() {
      if (consumed) throw new Error('content_drive_canary_page_replay');
      consumed = true;
      return firstPage;
    },
    openRange: (request) => dependencies.driveProvider.openRange(request),
  };
  const scan = await scanRegisteredDriveFolder({
    scope: { accountKey: context.config.accountKey, productKey: context.config.productKey },
    registeredIncomingFolderId: context.config.contentDriveFolderId,
    observedAt: new Date().toISOString(),
    repository: dependencies.repository,
    provider: cachedProvider,
  });
  return {
    enabled: true,
    providerCallsPerformed: true,
    summary: { canaryBudget: 1, providerCalls, databaseWrites: scan.fileCount, ...scan },
  };
}

function disabled(disabledReason: string): WorkerRunnerResult {
  return {
    enabled: false,
    providerCallsPerformed: false,
    summary: {
      disabledReason,
      canaryBudget: 1,
      providerCalls: 0,
      databaseWrites: 0,
      driveNonblocking: true,
    },
  };
}
