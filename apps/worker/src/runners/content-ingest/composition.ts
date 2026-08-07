import type { ContentIngestRepository } from '../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  confirmDriveImport,
  digestProtectedReference,
} from '../../../../../packages/domain/src/content/ingest/index.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../registry/index.ts';
import {
  scanRegisteredDriveFolder,
  transferStableDriveFile,
  type DriveIngestProvider,
  type DriveProviderFile,
  type ManagedSourceStaging,
} from './runner.ts';

export type ContentIngestWorkerDependencies = {
  repository: ContentIngestRepository;
  driveProvider: DriveIngestProvider;
  staging?: ManagedSourceStaging | undefined;
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

  if (context.config.contentMediaMode === 'production_broad') {
    return runBroadContentIngest(context, dependencies);
  }

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

async function runBroadContentIngest(
  context: WorkerRunnerContext,
  dependencies: ContentIngestWorkerDependencies,
): Promise<WorkerRunnerResult> {
  const batchLimit = context.config.contentMediaBatchSize;
  if (!dependencies.staging) return disabled('content_drive_staging_unavailable', batchLimit);
  const scope = { accountKey: context.config.accountKey, productKey: context.config.productKey };
  const observedAt = new Date().toISOString();
  let providerCalls = 0;
  const countedProvider: DriveIngestProvider = {
    async listPage(request) {
      providerCalls += 1;
      return dependencies.driveProvider.listPage(request);
    },
    openRange(request) {
      providerCalls += 1;
      return dependencies.driveProvider.openRange(request);
    },
  };
  try {
    const inventory = await listFiles(countedProvider, context.config.contentDriveFolderId!, 1);
    let inventoryConsumed = false;
    const cachedProvider: DriveIngestProvider = {
      async listPage() {
        if (inventoryConsumed) throw new Error('content_drive_broad_inventory_replay');
        inventoryConsumed = true;
        return { files: inventory.files };
      },
      openRange: (request) => countedProvider.openRange(request),
    };
    const scan = await scanRegisteredDriveFolder({
      scope,
      registeredIncomingFolderId: context.config.contentDriveFolderId!,
      observedAt,
      repository: dependencies.repository,
      provider: cachedProvider,
      maxFiles: batchLimit,
      maxPages: 1,
    });
    const filesByDigest = new Map<string, DriveProviderFile>();
    for (const file of inventory.files) {
      filesByDigest.set(digestProtectedReference(file.fileId), file);
    }
    let imported = 0;
    let deduplicated = 0;
    for (const selected of scan.observations.filter((item) => item.stable).slice(0, batchLimit)) {
      const file = filesByDigest.get(selected.observation.driveFileRefDigest);
      if (!file) continue;
      const transfer = await transferStableDriveFile({
        scope,
        file,
        provider: countedProvider,
        staging: dependencies.staging,
      });
      const result = await dependencies.repository.inTransaction(async (unit) => {
        const observation = await unit.getDriveObservation(
          scope,
          selected.observation.driveFileRefDigest,
        );
        if (!observation || observation.state !== 'stable') {
          throw new Error('content_drive_broad_observation_lease_lost');
        }
        const existing = await unit.findSourceByChecksum(scope, transfer.fullSha256);
        const confirmed = confirmDriveImport(
          observation,
          {
            finalByteCount: file.byteCount,
            finalChangeMarker: file.changeMarker,
            fullSha256: transfer.fullSha256,
            readback: transfer.readback,
            journalReceipt: transfer.journalReceipt,
            retentionDueAt: new Date(Date.parse(observedAt) + 10 * 365 * 86_400_000).toISOString(),
            occurredAt: observedAt,
          },
          existing,
        );
        if (!confirmed.deduplicated) await unit.saveSource(confirmed.source);
        await unit.saveSourceLink(confirmed.link);
        await unit.saveDriveObservation(confirmed.observation);
        return confirmed;
      });
      imported += 1;
      if (result.deduplicated) deduplicated += 1;
    }
    return {
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        batchLimit,
        concurrency: context.config.contentMediaConcurrency,
        providerCalls,
        databaseWrites: scan.fileCount + imported,
        imported,
        deduplicated,
        pageCount: scan.pageCount,
        candidateCount: scan.candidateCount,
        truncated: inventory.truncated || scan.truncated,
      },
    };
  } catch {
    context.logger.warn('content media Drive ingest failed closed', {
      media_mode: 'production_broad',
      provider: 'drive',
    });
    return {
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        batchLimit,
        stopped: true,
        stopReason: 'content_drive_broad_failed_closed',
        providerCalls,
        databaseWrites: 'unknown_after_failure',
      },
    };
  }
}

async function listFiles(provider: DriveIngestProvider, folderId: string, maxPages: number) {
  const files: DriveProviderFile[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await provider.listPage({
      registeredIncomingFolderId: folderId,
      ...(pageToken ? { pageToken } : {}),
    });
    pageCount += 1;
    files.push(...result.files);
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }
  return { files, pageCount, truncated: Boolean(pageToken) };
}

function disabled(disabledReason: string, batchLimit = 1): WorkerRunnerResult {
  return {
    enabled: false,
    providerCallsPerformed: false,
    summary: {
      disabledReason,
      canaryBudget: batchLimit === 1 ? 1 : undefined,
      batchLimit,
      providerCalls: 0,
      databaseWrites: 0,
      driveNonblocking: true,
    },
  };
}
