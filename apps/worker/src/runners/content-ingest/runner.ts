import { createHash } from 'node:crypto';
import {
  CONTENT_INGEST_ERROR_CODES,
  type ContentIngestRepository,
  type ContentIngestScope,
  type ManagedObjectReadback,
  type RecoveryJournalReceipt,
} from '../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  ContentIngestError,
  assertDrivePagination,
  digestProtectedReference,
  observeDriveFile,
  planDriveRanges,
  stableIngestKey,
} from '../../../../../packages/domain/src/content/ingest/index.ts';

export type DriveProviderFile = {
  fileId: string;
  parentFolderId: string;
  displayFilename: string;
  mimeType: string;
  byteCount: number;
  changeMarker: string;
};

export interface DriveIngestProvider {
  listPage(input: {
    registeredIncomingFolderId: string;
    pageToken?: string;
  }): Promise<{ files: readonly DriveProviderFile[]; nextPageToken?: string }>;
  openRange(input: {
    fileId: string;
    start: number;
    endExclusive: number;
    expectedChangeMarker: string;
  }): AsyncIterable<Uint8Array>;
}

export interface ManagedSourceStaging {
  beginDriveTransfer(input: {
    transferId: string;
    opaqueObjectKey: string;
    byteCount: number;
  }): Promise<void>;
  putPart(input: {
    transferId: string;
    partNumber: number;
    byteCount: number;
    body: AsyncIterable<Uint8Array>;
  }): Promise<{ providerPartRefDigest: string }>;
  completeAndReadBack(input: {
    transferId: string;
    fullSha256: string;
    orderedProviderPartRefDigests: readonly string[];
  }): Promise<{ readback: ManagedObjectReadback; journalReceipt: RecoveryJournalReceipt }>;
}

export async function scanRegisteredDriveFolder(input: {
  scope: ContentIngestScope;
  registeredIncomingFolderId: string;
  observedAt: string;
  repository: ContentIngestRepository;
  provider: DriveIngestProvider;
}) {
  const visited = new Set<string>();
  const observations = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  do {
    if (pageToken) {
      if (visited.has(pageToken)) {
        throw new ContentIngestError(
          CONTENT_INGEST_ERROR_CODES.invalidState,
          'Drive pagination token repeated before the folder inventory completed.',
        );
      }
      visited.add(pageToken);
    }
    const page = await input.provider.listPage({
      registeredIncomingFolderId: input.registeredIncomingFolderId,
      ...(pageToken ? { pageToken } : {}),
    });
    assertDrivePagination(visited, pageToken, page.nextPageToken);
    pageCount += 1;
    for (const file of page.files) {
      if (file.parentFolderId !== input.registeredIncomingFolderId) {
        throw new ContentIngestError(
          CONTENT_INGEST_ERROR_CODES.accessDenied,
          'Drive scan returned a file outside the registered incoming folder.',
        );
      }
      const observation = await input.repository.inTransaction(async (unit) => {
        const digest = digestProtectedReference(file.fileId);
        const previous = await unit.getDriveObservation(input.scope, digest);
        const result = observeDriveFile(
          input.scope,
          {
            driveFileId: file.fileId,
            parentFolderId: file.parentFolderId,
            displayFilename: file.displayFilename,
            mimeType: file.mimeType,
            byteCount: file.byteCount,
            changeMarker: file.changeMarker,
            observedAt: input.observedAt,
          },
          previous,
        );
        await unit.saveDriveObservation(result.observation);
        return result;
      });
      observations.push(observation);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return {
    pageCount,
    fileCount: observations.length,
    stableCount: observations.filter((item) => item.stable).length,
    observations,
  };
}

export async function transferStableDriveFile(input: {
  scope: ContentIngestScope;
  file: DriveProviderFile;
  provider: DriveIngestProvider;
  staging: ManagedSourceStaging;
}) {
  const ranges = planDriveRanges(input.file.byteCount);
  const transferId = stableIngestKey('drive_transfer', [
    digestProtectedReference(input.file.fileId),
    input.file.changeMarker,
  ]);
  const opaqueObjectKey = stableIngestKey('source', [
    input.scope.accountKey,
    input.scope.productKey,
    transferId,
  ]);
  await input.staging.beginDriveTransfer({
    transferId,
    opaqueObjectKey,
    byteCount: input.file.byteCount,
  });
  const fullHash = createHash('sha256');
  const partRefs: string[] = [];
  let transferred = 0;
  for (const range of ranges) {
    const expectedByteCount = range.endExclusive - range.start;
    let partByteCount = 0;
    const body = hashAndCount(
      input.provider.openRange({
        fileId: input.file.fileId,
        start: range.start,
        endExclusive: range.endExclusive,
        expectedChangeMarker: input.file.changeMarker,
      }),
      (chunk) => {
        partByteCount += chunk.byteLength;
        transferred += chunk.byteLength;
        fullHash.update(chunk);
        if (partByteCount > expectedByteCount) {
          throw new ContentIngestError(
            CONTENT_INGEST_ERROR_CODES.invalidSize,
            'Drive range exceeded its bounded transfer plan.',
          );
        }
      },
    );
    const completed = await input.staging.putPart({
      transferId,
      partNumber: range.partNumber,
      byteCount: expectedByteCount,
      body,
    });
    if (partByteCount !== expectedByteCount) {
      throw new ContentIngestError(
        CONTENT_INGEST_ERROR_CODES.invalidSize,
        'Drive range ended before the bounded transfer plan completed.',
      );
    }
    partRefs.push(completed.providerPartRefDigest);
  }
  if (transferred !== input.file.byteCount) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidSize,
      'Drive transfer byte count does not match the stable observation.',
    );
  }
  const fullSha256 = fullHash.digest('hex');
  const confirmed = await input.staging.completeAndReadBack({
    transferId,
    fullSha256,
    orderedProviderPartRefDigests: partRefs,
  });
  return {
    transferId,
    fullSha256,
    byteCount: transferred,
    partCount: ranges.length,
    ...confirmed,
  };
}

async function* hashAndCount(
  source: AsyncIterable<Uint8Array>,
  inspect: (chunk: Uint8Array) => void,
) {
  for await (const chunk of source) {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) {
      throw new ContentIngestError(
        CONTENT_INGEST_ERROR_CODES.invalidState,
        'Drive range stream yielded an invalid chunk.',
      );
    }
    inspect(chunk);
    yield chunk;
  }
}
