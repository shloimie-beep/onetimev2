import {
  CONTENT_INGEST_ERROR_CODES,
  CONTENT_INGEST_INCOMPLETE_UPLOAD_HOURS,
  CONTENT_INGEST_MAX_CONCURRENT_PARTS,
  CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
  CONTENT_INGEST_PART_BYTES,
  CONTENT_INGEST_REGION,
  type BeginDirectUploadCommand,
  type ConfirmDirectUploadCommand,
  type ContentIngestCommandReceipt,
  type ContentSourceLinkRecord,
  type ContentSourceRecord,
  type MultipartUploadPlan,
  type UploadPartRecord,
  type UploadSessionRecord,
} from '../../../../contracts/src/content/ingest/index.ts';
import { ContentIngestError } from './errors.ts';
import {
  assertSha256,
  digestProtectedReference,
  stableIngestKey,
  validateRecordingMetadata,
} from './validation.ts';

export function beginDirectUpload(
  command: BeginDirectUploadCommand,
  priorReceipt?: ContentIngestCommandReceipt | null,
) {
  if (priorReceipt) {
    assertReplay(command, priorReceipt);
    return { replay: true as const, session: undefined, plan: undefined };
  }
  const metadata = validateRecordingMetadata({
    displayFilename: command.displayFilename,
    mimeType: command.mimeType,
    byteCount: command.declaredByteCount,
  });
  const sessionId = stableIngestKey('upload', [
    command.actor.accountKey,
    command.actor.productKey,
    command.idempotencyKey,
  ]);
  const totalParts = Math.ceil(command.declaredByteCount / CONTENT_INGEST_PART_BYTES);
  const expiresAt = new Date(
    Date.parse(command.occurredAt) + CONTENT_INGEST_INCOMPLETE_UPLOAD_HOURS * 3_600_000,
  ).toISOString();
  const session: UploadSessionRecord = {
    accountKey: command.actor.accountKey,
    productKey: command.actor.productKey,
    id: sessionId,
    actorId: command.actor.principalId,
    runtimeTier: command.runtimeTier,
    verificationEnvironmentId: command.verificationEnvironmentId,
    displayFilename: metadata.displayFilename,
    mimeType: metadata.mimeType,
    container: metadata.container,
    declaredByteCount: command.declaredByteCount,
    opaqueObjectKey: stableIngestKey('source', [
      command.runtimeTier,
      command.actor.accountKey,
      command.actor.productKey,
      sessionId,
    ]),
    providerUploadIdDigest: digestProtectedReference(sessionId),
    state: 'initiated',
    totalParts,
    completedParts: 0,
    receivedByteCount: 0,
    attemptCount: 0,
    retryState: 'ready',
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    ...(command.existingRecordingIntent
      ? { existingRecordingIntent: command.existingRecordingIntent }
      : {}),
    expiresAt,
    version: 1,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  };
  const plan: MultipartUploadPlan = {
    uploadSessionId: session.id,
    partBytes: CONTENT_INGEST_PART_BYTES,
    totalParts,
    maxConcurrentParts: CONTENT_INGEST_MAX_CONCURRENT_PARTS,
    authorizationTtlSeconds: CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
    expiresAt,
  };
  const receipt: ContentIngestCommandReceipt = {
    accountKey: session.accountKey,
    productKey: session.productKey,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    operation: 'direct_upload:begin',
    resultRef: session.id,
    resultVersion: session.version,
    committedAt: command.occurredAt,
  };
  return { replay: false as const, session, plan, receipt };
}

export function expectedUploadPart(session: UploadSessionRecord, partNumber: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.totalParts) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Upload part number is outside the session plan.',
    );
  }
  const byteOffset = (partNumber - 1) * CONTENT_INGEST_PART_BYTES;
  const byteCount = Math.min(CONTENT_INGEST_PART_BYTES, session.declaredByteCount - byteOffset);
  return { partNumber, byteOffset, byteCount };
}

export function recordUploadPart(
  session: UploadSessionRecord,
  completed: {
    partNumber: number;
    byteCount: number;
    partSha256: string;
    providerPartRefDigest: string;
    occurredAt: string;
  },
  existingParts: readonly UploadPartRecord[],
) {
  if (!['initiated', 'uploading'].includes(session.state)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Upload parts can be recorded only for an open session.',
    );
  }
  assertSha256(completed.partSha256, 'partSha256');
  assertSha256(completed.providerPartRefDigest, 'providerPartRefDigest');
  const expected = expectedUploadPart(session, completed.partNumber);
  if (completed.byteCount !== expected.byteCount) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidSize,
      'Upload part byte count does not match the bounded multipart plan.',
    );
  }
  const prior = existingParts.find((part) => part.partNumber === completed.partNumber);
  if (
    prior &&
    (prior.byteCount !== completed.byteCount ||
      prior.partSha256 !== completed.partSha256 ||
      prior.providerPartRefDigest !== completed.providerPartRefDigest)
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.conflict,
      'Upload part replay disagrees with the durable receipt.',
    );
  }
  if (prior) return { session, part: prior, replay: true as const };
  const part: UploadPartRecord = {
    accountKey: session.accountKey,
    productKey: session.productKey,
    uploadSessionId: session.id,
    ...expected,
    partSha256: completed.partSha256,
    providerPartRefDigest: completed.providerPartRefDigest,
    completedAt: completed.occurredAt,
  };
  return {
    session: {
      ...session,
      state: 'uploading' as const,
      completedParts: session.completedParts + 1,
      receivedByteCount: session.receivedByteCount + completed.byteCount,
      version: session.version + 1,
      updatedAt: completed.occurredAt,
    },
    part,
    replay: false as const,
  };
}

export function confirmDirectUpload(
  session: UploadSessionRecord,
  parts: readonly UploadPartRecord[],
  command: ConfirmDirectUploadCommand,
  existingSource?: ContentSourceRecord | null,
) {
  assertScope(session, command);
  if (session.version !== command.expectedVersion) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.staleVersion,
      'Upload session changed; reload before confirming.',
    );
  }
  if (!['uploading', 'completing', 'acceptance_unknown'].includes(session.state)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Upload session is not ready for confirmation.',
    );
  }
  assertSha256(command.fullSha256, 'fullSha256');
  assertCompleteParts(session, parts);
  assertReadback(session, command);
  const sourceId =
    existingSource?.id ??
    stableIngestKey('content_source', [session.accountKey, session.productKey, command.fullSha256]);
  const source: ContentSourceRecord =
    existingSource ??
    (session.existingRecordingIntent
      ? {
          accountKey: session.accountKey,
          productKey: session.productKey,
          id: sourceId,
          sourceKind: 'app_upload',
          captureMethod: 'existing_reviewed_recording',
          runtimeTier: session.runtimeTier,
          verificationEnvironmentId: session.verificationEnvironmentId,
          bucketRef: command.readback.bucketRef,
          objectKeyDigest: command.readback.objectKeyDigest,
          objectVersionId: command.readback.objectVersionId,
          kmsKeyVersionRef: command.readback.kmsKeyVersionRef,
          checksumReadbackReceiptId: command.journalReceipt.receiptId,
          displayFilename: session.displayFilename,
          mimeType: session.mimeType,
          container: session.container,
          byteCount: session.declaredByteCount,
          sha256: command.fullSha256,
          receivedAt: command.occurredAt,
          stableAt: command.occurredAt,
          matchConfidence: 'none',
          retentionDueAt: command.retentionDueAt,
          lifecycleState: 'received',
          retryState: 'ready',
          attemptCount: 0,
          originalPreserved: true,
          version: 1,
          createdAt: command.occurredAt,
          updatedAt: command.occurredAt,
          existingRecordingAttestation: {
            evidenceVersion: 'OT-EXISTING-REVIEWED-RECORDING-1',
            origin: session.existingRecordingIntent.origin,
            rightsAttestedByAdminId: command.actor.principalId,
            rightsAttestedAt: command.occurredAt,
            rightsToProcessAndPrivatelyPublish: true,
            humanReviewedByAdminId: command.actor.principalId,
            humanReviewedAt: command.occurredAt,
            childDataDisposition: session.existingRecordingIntent.childDataDisposition,
            noUnreviewedChildData: true,
          },
        }
      : {
          accountKey: session.accountKey,
          productKey: session.productKey,
          id: sourceId,
          sourceKind: 'app_upload',
          captureMethod: 'obs',
          runtimeTier: session.runtimeTier,
          verificationEnvironmentId: session.verificationEnvironmentId,
          bucketRef: command.readback.bucketRef,
          objectKeyDigest: command.readback.objectKeyDigest,
          objectVersionId: command.readback.objectVersionId,
          kmsKeyVersionRef: command.readback.kmsKeyVersionRef,
          checksumReadbackReceiptId: command.journalReceipt.receiptId,
          displayFilename: session.displayFilename,
          mimeType: session.mimeType,
          container: session.container,
          byteCount: session.declaredByteCount,
          sha256: command.fullSha256,
          receivedAt: command.occurredAt,
          stableAt: command.occurredAt,
          matchConfidence: 'none',
          retentionDueAt: command.retentionDueAt,
          lifecycleState: 'received',
          retryState: 'ready',
          attemptCount: 0,
          originalPreserved: true,
          version: 1,
          createdAt: command.occurredAt,
          updatedAt: command.occurredAt,
        });
  const link: ContentSourceLinkRecord = {
    accountKey: session.accountKey,
    productKey: session.productKey,
    id: stableIngestKey('source_link', ['app_upload', session.id, source.id]),
    sourceId: source.id,
    sourceKind: 'app_upload',
    provenanceRefDigest: session.providerUploadIdDigest,
    displayFilename: session.displayFilename,
    observedAt: command.occurredAt,
  };
  return {
    source,
    link,
    deduplicated: Boolean(existingSource),
    session: {
      ...session,
      state: 'confirmed' as const,
      retryState: 'ready' as const,
      completedParts: parts.length,
      receivedByteCount: session.declaredByteCount,
      version: session.version + 1,
      updatedAt: command.occurredAt,
    },
  };
}

function assertCompleteParts(session: UploadSessionRecord, parts: readonly UploadPartRecord[]) {
  const sorted = [...parts].sort((left, right) => left.partNumber - right.partNumber);
  if (
    sorted.length !== session.totalParts ||
    sorted.some((part, index) => {
      const expected = expectedUploadPart(session, index + 1);
      return (
        part.partNumber !== expected.partNumber ||
        part.byteOffset !== expected.byteOffset ||
        part.byteCount !== expected.byteCount
      );
    }) ||
    sorted.reduce((sum, part) => sum + part.byteCount, 0) !== session.declaredByteCount
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.incompleteParts,
      'Every bounded multipart receipt must be durable before confirmation.',
    );
  }
}

function assertReadback(session: UploadSessionRecord, command: ConfirmDirectUploadCommand) {
  const { readback, journalReceipt } = command;
  const journalWrittenAt = Date.parse(journalReceipt.writtenAt);
  const journalReadBackAt = Date.parse(journalReceipt.readBackAt);
  const versionedDurabilityEvidence =
    readback.durabilityEvidenceVersion !== undefined ||
    journalReceipt.durabilityEvidenceVersion !== undefined;
  const versionedDurabilityMismatch =
    versionedDurabilityEvidence &&
    (readback.durabilityEvidenceVersion !== 'OT-MANAGED-ORIGINAL-1' ||
      journalReceipt.durabilityEvidenceVersion !== readback.durabilityEvidenceVersion ||
      readback.checksumAlgorithm !== 'sha256' ||
      typeof readback.storageClass !== 'string' ||
      !readback.storageClass.trim() ||
      journalReceipt.bucketRef !== readback.bucketRef ||
      journalReceipt.objectKeyDigest !== readback.objectKeyDigest ||
      journalReceipt.checksumAlgorithm !== readback.checksumAlgorithm ||
      journalReceipt.kmsKeyVersionRef !== readback.kmsKeyVersionRef ||
      journalReceipt.storageClass !== readback.storageClass);
  if (
    readback.region !== CONTENT_INGEST_REGION ||
    readback.runtimeTier !== session.runtimeTier ||
    readback.verificationEnvironmentId !== session.verificationEnvironmentId ||
    readback.byteCount !== session.declaredByteCount ||
    readback.sha256 !== command.fullSha256 ||
    !readback.objectVersionId ||
    !readback.kmsKeyVersionRef ||
    !readback.objectKeyDigest ||
    !readback.bucketRef ||
    !readback.blockPublicAccess ||
    !readback.bucketOwnerEnforced ||
    !journalReceipt.receiptId.trim() ||
    journalReceipt.uploadSessionId !== session.id ||
    journalReceipt.runtimeTier !== session.runtimeTier ||
    journalReceipt.verificationEnvironmentId !== session.verificationEnvironmentId ||
    journalReceipt.objectVersionId !== readback.objectVersionId ||
    journalReceipt.byteCount !== readback.byteCount ||
    journalReceipt.sha256 !== readback.sha256 ||
    versionedDurabilityMismatch ||
    !Number.isFinite(journalWrittenAt) ||
    !Number.isFinite(journalReadBackAt) ||
    journalReadBackAt < journalWrittenAt
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidReadback,
      'Managed object, recovery journal, and upload-session readbacks do not agree.',
    );
  }
  assertSha256(readback.objectKeyDigest, 'objectKeyDigest');
}

function assertScope(session: UploadSessionRecord, command: ConfirmDirectUploadCommand) {
  if (
    session.accountKey !== command.actor.accountKey ||
    session.productKey !== command.actor.productKey ||
    session.actorId !== command.actor.principalId
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.accessDenied,
      'Upload confirmation is outside the authenticated Admin scope.',
    );
  }
}

function assertReplay(
  command: Pick<BeginDirectUploadCommand, 'idempotencyKey' | 'requestHash'>,
  receipt: ContentIngestCommandReceipt,
) {
  if (
    receipt.idempotencyKey !== command.idempotencyKey ||
    receipt.requestHash !== command.requestHash
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.conflict,
      'The idempotency key was already used for a different upload.',
    );
  }
}
