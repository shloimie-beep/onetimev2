import {
  CONTENT_INGEST_DRIVE_STABILITY_SECONDS,
  CONTENT_INGEST_ERROR_CODES,
  CONTENT_INGEST_PART_BYTES,
  CONTENT_INGEST_REGION,
  type ContentIngestScope,
  type ContentSourceLinkRecord,
  type ContentSourceRecord,
  type DriveFileObservation,
  type ManagedObjectReadback,
  type RecoveryJournalReceipt,
} from '../../../../contracts/src/content/ingest/index.ts';
import { ContentIngestError } from './errors.ts';
import {
  assertSha256,
  digestProtectedReference,
  stableIngestKey,
  validateRecordingMetadata,
} from './validation.ts';

export function observeDriveFile(
  scope: ContentIngestScope,
  input: {
    driveFileId: string;
    parentFolderId: string;
    displayFilename: string;
    mimeType: string;
    byteCount: number;
    changeMarker: string;
    observedAt: string;
  },
  previous?: DriveFileObservation | null,
) {
  const driveFileRefDigest = digestProtectedReference(input.driveFileId);
  const parentFolderRefDigest = digestProtectedReference(input.parentFolderId);
  const metadata = validateRecordingMetadata(input);
  if (
    previous &&
    (previous.accountKey !== scope.accountKey ||
      previous.productKey !== scope.productKey ||
      previous.driveFileRefDigest !== driveFileRefDigest)
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.accessDenied,
      'Drive observation is outside the registered account and folder scope.',
    );
  }
  const unchanged =
    previous?.byteCount === input.byteCount &&
    previous.changeMarker === input.changeMarker &&
    previous.mimeType === metadata.mimeType;
  if (
    unchanged &&
    previous &&
    ['processed', 'quarantined', 'dead_lettered'].includes(previous.state)
  ) {
    return {
      observation: {
        ...previous,
        lastObservedAt: input.observedAt,
        version: previous.version + 1,
      },
      stable: false,
      changed: false,
      terminal: true as const,
    };
  }
  const firstObservedAt = unchanged ? previous.firstObservedAt : input.observedAt;
  const stable =
    unchanged &&
    Date.parse(input.observedAt) - Date.parse(firstObservedAt) >=
      CONTENT_INGEST_DRIVE_STABILITY_SECONDS * 1_000;
  const observation: DriveFileObservation = {
    accountKey: scope.accountKey,
    productKey: scope.productKey,
    driveFileRefDigest,
    parentFolderRefDigest,
    displayFilename: metadata.displayFilename,
    mimeType: metadata.mimeType,
    byteCount: input.byteCount,
    changeMarker: input.changeMarker,
    firstObservedAt,
    lastObservedAt: input.observedAt,
    ...(stable ? { stableAt: input.observedAt } : {}),
    state: stable ? 'stable' : 'observing',
    attemptCount: unchanged ? (previous?.attemptCount ?? 0) : 0,
    retryState: 'ready',
    version: (previous?.version ?? 0) + 1,
  };
  return {
    observation,
    stable,
    changed: Boolean(previous && !unchanged),
    terminal: false as const,
  };
}

export function planDriveRanges(byteCount: number) {
  if (!Number.isSafeInteger(byteCount) || byteCount < 1) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidSize,
      'Stable Drive file must have a nonzero safe byte count.',
    );
  }
  const ranges: Array<{ partNumber: number; start: number; endExclusive: number }> = [];
  for (let start = 0, partNumber = 1; start < byteCount; start += CONTENT_INGEST_PART_BYTES) {
    ranges.push({
      partNumber,
      start,
      endExclusive: Math.min(start + CONTENT_INGEST_PART_BYTES, byteCount),
    });
    partNumber += 1;
  }
  return ranges;
}

export function assertDrivePagination(
  visitedTokens: ReadonlySet<string>,
  currentToken: string | undefined,
  nextToken: string | undefined,
) {
  if (nextToken && (nextToken === currentToken || visitedTokens.has(nextToken))) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Drive pagination token repeated before the folder inventory completed.',
    );
  }
}

export function confirmDriveImport(
  observation: DriveFileObservation,
  input: {
    finalByteCount: number;
    finalChangeMarker: string;
    fullSha256: string;
    readback: ManagedObjectReadback;
    journalReceipt: RecoveryJournalReceipt;
    retentionDueAt: string;
    occurredAt: string;
  },
  existingSource?: ContentSourceRecord | null,
) {
  if (observation.state !== 'stable' || !observation.stableAt) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.driveUnstable,
      'Drive import cannot confirm until the file is stable for 120 seconds.',
    );
  }
  assertSha256(input.fullSha256, 'fullSha256');
  const transferId = stableIngestKey('drive_transfer', [
    observation.driveFileRefDigest,
    observation.changeMarker,
  ]);
  const journalWrittenAt = Date.parse(input.journalReceipt.writtenAt);
  const journalReadBackAt = Date.parse(input.journalReceipt.readBackAt);
  const versionedDurabilityEvidence =
    input.readback.durabilityEvidenceVersion !== undefined ||
    input.journalReceipt.durabilityEvidenceVersion !== undefined;
  const versionedDurabilityMismatch =
    versionedDurabilityEvidence &&
    (input.readback.durabilityEvidenceVersion !== 'OT-MANAGED-ORIGINAL-1' ||
      input.journalReceipt.durabilityEvidenceVersion !== input.readback.durabilityEvidenceVersion ||
      input.readback.checksumAlgorithm !== 'sha256' ||
      typeof input.readback.storageClass !== 'string' ||
      !input.readback.storageClass.trim() ||
      input.journalReceipt.bucketRef !== input.readback.bucketRef ||
      input.journalReceipt.objectKeyDigest !== input.readback.objectKeyDigest ||
      input.journalReceipt.checksumAlgorithm !== input.readback.checksumAlgorithm ||
      input.journalReceipt.kmsKeyVersionRef !== input.readback.kmsKeyVersionRef ||
      input.journalReceipt.storageClass !== input.readback.storageClass);
  if (
    input.finalByteCount !== observation.byteCount ||
    input.finalChangeMarker !== observation.changeMarker ||
    input.readback.region !== CONTENT_INGEST_REGION ||
    input.readback.byteCount !== observation.byteCount ||
    input.readback.sha256 !== input.fullSha256 ||
    !input.journalReceipt.receiptId.trim() ||
    input.journalReceipt.uploadSessionId !== transferId ||
    input.journalReceipt.runtimeTier !== input.readback.runtimeTier ||
    input.journalReceipt.verificationEnvironmentId !== input.readback.verificationEnvironmentId ||
    input.journalReceipt.objectVersionId !== input.readback.objectVersionId ||
    input.journalReceipt.byteCount !== input.readback.byteCount ||
    input.journalReceipt.sha256 !== input.readback.sha256 ||
    versionedDurabilityMismatch ||
    !Number.isFinite(journalWrittenAt) ||
    !Number.isFinite(journalReadBackAt) ||
    journalReadBackAt < journalWrittenAt ||
    !input.readback.blockPublicAccess ||
    !input.readback.bucketOwnerEnforced ||
    !input.readback.objectVersionId ||
    !input.readback.kmsKeyVersionRef ||
    !input.readback.bucketRef
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidReadback,
      'Final Drive marker, managed object, and recovery journal readbacks must agree.',
    );
  }
  assertSha256(input.readback.objectKeyDigest, 'objectKeyDigest');
  const metadata = validateRecordingMetadata({
    displayFilename: observation.displayFilename,
    mimeType: observation.mimeType,
    byteCount: observation.byteCount,
  });
  const source: ContentSourceRecord = existingSource ?? {
    accountKey: observation.accountKey,
    productKey: observation.productKey,
    id: stableIngestKey('content_source', [
      observation.accountKey,
      observation.productKey,
      input.fullSha256,
    ]),
    sourceKind: 'drive',
    captureMethod: 'obs',
    runtimeTier: input.readback.runtimeTier,
    verificationEnvironmentId: input.readback.verificationEnvironmentId,
    bucketRef: input.readback.bucketRef,
    objectKeyDigest: input.readback.objectKeyDigest,
    objectVersionId: input.readback.objectVersionId,
    kmsKeyVersionRef: input.readback.kmsKeyVersionRef,
    checksumReadbackReceiptId: input.journalReceipt.receiptId,
    displayFilename: metadata.displayFilename,
    mimeType: metadata.mimeType,
    container: metadata.container,
    byteCount: observation.byteCount,
    sha256: input.fullSha256,
    receivedAt: input.occurredAt,
    stableAt: observation.stableAt,
    matchConfidence: 'none',
    retentionDueAt: input.retentionDueAt,
    lifecycleState: 'received',
    retryState: 'ready',
    attemptCount: 0,
    originalPreserved: true,
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  const link: ContentSourceLinkRecord = {
    accountKey: observation.accountKey,
    productKey: observation.productKey,
    id: stableIngestKey('source_link', [
      'drive',
      observation.driveFileRefDigest,
      observation.changeMarker,
      source.id,
    ]),
    sourceId: source.id,
    sourceKind: 'drive',
    provenanceRefDigest: observation.driveFileRefDigest,
    providerChangeMarker: observation.changeMarker,
    displayFilename: observation.displayFilename,
    observedAt: input.occurredAt,
  };
  return {
    source,
    link,
    deduplicated: Boolean(existingSource),
    observation: {
      ...observation,
      state: 'processed' as const,
      version: observation.version + 1,
      lastObservedAt: input.occurredAt,
    },
  };
}
