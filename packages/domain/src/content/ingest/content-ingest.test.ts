import { describe, expect, it } from 'vitest';
import {
  CONTENT_INGEST_MAX_BYTES,
  CONTENT_INGEST_PART_BYTES,
  type ContentIngestAdminActor,
  type ContentSourceRecord,
  type DriveFileObservation,
  type ManagedObjectReadback,
  type RecoveryJournalReceipt,
  type UploadPartRecord,
} from '../../../../contracts/src/content/ingest/index.ts';
import type { ClassOccurrenceRecord } from '../../../../contracts/src/classes/core/index.ts';
import {
  ContentIngestError,
  assertDrivePagination,
  beginDirectUpload,
  confirmDirectUpload,
  confirmDriveImport,
  digestProtectedReference,
  matchSourceToOccurrence,
  observeDriveFile,
  planDriveRanges,
  recordIngestFailure,
  recordUploadPart,
  stableIngestKey,
  transitionContentSource,
  validateRecordingMetadata,
} from './index.ts';

const now = '2026-07-28T22:00:00.000Z';
const actor: ContentIngestAdminActor = {
  accountKey: 'account-1',
  productKey: 'one-time',
  principalId: 'admin-1',
  role: 'admin',
};
const sha = (digit: string) => digit.repeat(64);

function begin(byteCount = CONTENT_INGEST_PART_BYTES + 17) {
  return beginDirectUpload({
    actor,
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci-1',
    displayFilename: '2026-07-28_1900_occurrence-1_Class.mp4',
    mimeType: 'video/mp4',
    declaredByteCount: byteCount,
    idempotencyKey: 'upload-1',
    requestHash: sha('a'),
    occurredAt: now,
  });
}

function partsForSession(session: NonNullable<ReturnType<typeof begin>['session']>) {
  const records: UploadPartRecord[] = [];
  for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
    const existing = records;
    const result = recordUploadPart(
      {
        ...session,
        completedParts: records.length,
        receivedByteCount: records.reduce((n, p) => n + p.byteCount, 0),
      },
      {
        partNumber,
        byteCount:
          partNumber === session.totalParts
            ? session.declaredByteCount - (partNumber - 1) * CONTENT_INGEST_PART_BYTES
            : CONTENT_INGEST_PART_BYTES,
        partSha256: sha(String(partNumber % 10)),
        providerPartRefDigest: sha(String((partNumber + 1) % 10)),
        occurredAt: now,
      },
      existing,
    );
    records.push(result.part);
  }
  return records;
}

function readback(
  session: NonNullable<ReturnType<typeof begin>['session']>,
  fullSha256 = sha('f'),
) {
  const managed: ManagedObjectReadback = {
    runtimeTier: session.runtimeTier,
    verificationEnvironmentId: session.verificationEnvironmentId,
    region: 'eu-central-1',
    bucketRef: 'staging-bucket-ref',
    objectKeyDigest: sha('e'),
    objectVersionId: 'version-1',
    byteCount: session.declaredByteCount,
    sha256: fullSha256,
    kmsKeyVersionRef: 'kms-version-1',
    blockPublicAccess: true,
    bucketOwnerEnforced: true,
  };
  const journal: RecoveryJournalReceipt = {
    receiptId: 'journal-1',
    uploadSessionId: session.id,
    runtimeTier: session.runtimeTier,
    verificationEnvironmentId: session.verificationEnvironmentId,
    objectVersionId: managed.objectVersionId,
    byteCount: managed.byteCount,
    sha256: managed.sha256,
    writtenAt: now,
    readBackAt: '2026-07-28T22:00:01.000Z',
  };
  return { managed, journal };
}

function source(): ContentSourceRecord {
  const started = begin();
  const session = started.session!;
  const { managed, journal } = readback(session);
  return confirmDirectUpload(
    { ...session, state: 'uploading', version: 3 },
    partsForSession(session),
    {
      actor,
      uploadSessionId: session.id,
      expectedVersion: 3,
      fullSha256: managed.sha256,
      idempotencyKey: 'confirm-1',
      requestHash: sha('b'),
      readback: managed,
      journalReceipt: journal,
      retentionDueAt: '2026-10-26T22:00:00.000Z',
      occurredAt: now,
    },
  ).source;
}

describe('P19 direct upload contract', () => {
  it('OTV2-CONTENT-190 accepts supported originals through 5 GiB and rejects unsafe metadata', () => {
    expect(
      validateRecordingMetadata({
        displayFilename: 'recording.mkv',
        mimeType: 'video/x-matroska',
        byteCount: CONTENT_INGEST_MAX_BYTES,
      }),
    ).toMatchObject({ container: 'mkv' });
    expect(() =>
      validateRecordingMetadata({
        displayFilename: 'recording.mp4',
        mimeType: 'video/mp4',
        byteCount: CONTENT_INGEST_MAX_BYTES + 1,
      }),
    ).toThrowError(/5/);
    expect(() =>
      validateRecordingMetadata({
        displayFilename: '../recording.mp4',
        mimeType: 'video/mp4',
        byteCount: 10,
      }),
    ).toThrowError(ContentIngestError);
    expect(() =>
      validateRecordingMetadata({
        displayFilename: 'recording.mp4',
        mimeType: 'video/quicktime',
        byteCount: 10,
      }),
    ).toThrowError(/disagree/);
  });

  it('OTV2-CONTENT-190 plans exact 64 MiB parts and at most four-way browser concurrency', () => {
    const result = begin(CONTENT_INGEST_MAX_BYTES);
    expect(result.plan).toMatchObject({
      partBytes: CONTENT_INGEST_PART_BYTES,
      totalParts: 80,
      maxConcurrentParts: 4,
      authorizationTtlSeconds: 900,
    });
    expect(result.session?.opaqueObjectKey).not.toContain('Class');
  });

  it('OTV2-CONTENT-192 records bounded parts idempotently and fences conflicting replay', () => {
    const session = begin().session!;
    const first = recordUploadPart(
      session,
      {
        partNumber: 1,
        byteCount: CONTENT_INGEST_PART_BYTES,
        partSha256: sha('1'),
        providerPartRefDigest: sha('2'),
        occurredAt: now,
      },
      [],
    );
    expect(first.session).toMatchObject({ state: 'uploading', completedParts: 1 });
    expect(
      recordUploadPart(
        session,
        {
          partNumber: 1,
          byteCount: CONTENT_INGEST_PART_BYTES,
          partSha256: sha('1'),
          providerPartRefDigest: sha('2'),
          occurredAt: now,
        },
        [first.part],
      ).replay,
    ).toBe(true);
    expect(() =>
      recordUploadPart(
        session,
        {
          partNumber: 1,
          byteCount: CONTENT_INGEST_PART_BYTES,
          partSha256: sha('3'),
          providerPartRefDigest: sha('2'),
          occurredAt: now,
        },
        [first.part],
      ),
    ).toThrowError(/disagrees/);
  });

  it('OTV2-CONTENT-083 confirms only mutually consistent object, journal, checksum, and parts', () => {
    const session = begin().session!;
    const records = partsForSession(session);
    const { managed, journal } = readback(session);
    const command = {
      actor,
      uploadSessionId: session.id,
      expectedVersion: 3,
      fullSha256: managed.sha256,
      idempotencyKey: 'confirm-1',
      requestHash: sha('b'),
      readback: managed,
      journalReceipt: journal,
      retentionDueAt: '2026-10-26T22:00:00.000Z',
      occurredAt: now,
    };
    expect(() =>
      confirmDirectUpload(
        { ...session, state: 'uploading', version: 3 },
        records.slice(0, 1),
        command,
      ),
    ).toThrowError(/Every bounded multipart/);
    expect(() =>
      confirmDirectUpload({ ...session, state: 'uploading', version: 3 }, records, {
        ...command,
        journalReceipt: { ...journal, sha256: sha('0') },
      }),
    ).toThrowError(/do not agree/);
    const confirmed = confirmDirectUpload(
      { ...session, state: 'uploading', version: 3 },
      records,
      command,
    );
    expect(confirmed.source).toMatchObject({
      sha256: managed.sha256,
      objectVersionId: managed.objectVersionId,
      originalPreserved: true,
      lifecycleState: 'received',
    });
  });

  it('OTV2-CONTENT-192 links a repeated app checksum to the canonical source', () => {
    const canonical = source();
    const session = begin().session!;
    const { managed, journal } = readback(session, canonical.sha256);
    const result = confirmDirectUpload(
      { ...session, state: 'uploading', version: 2 },
      partsForSession(session),
      {
        actor,
        uploadSessionId: session.id,
        expectedVersion: 2,
        fullSha256: canonical.sha256,
        idempotencyKey: 'confirm-duplicate',
        requestHash: sha('c'),
        readback: managed,
        journalReceipt: journal,
        retentionDueAt: canonical.retentionDueAt,
        occurredAt: now,
      },
      canonical,
    );
    expect(result.deduplicated).toBe(true);
    expect(result.source).toBe(canonical);
    expect(result.link.sourceId).toBe(canonical.id);
  });
});

describe('P19 Drive intake', () => {
  function observe(at: string, previous?: DriveFileObservation, marker = 'v1') {
    return observeDriveFile(
      actor,
      {
        driveFileId: 'drive-file-1',
        parentFolderId: 'incoming-folder',
        displayFilename: 'recording.mov',
        mimeType: 'video/quicktime',
        byteCount: 100,
        changeMarker: marker,
        observedAt: at,
      },
      previous,
    );
  }

  it('OTV2-CONTENT-081 marks nonzero unchanged Drive metadata stable only after 120 seconds', () => {
    const first = observe(now);
    expect(first.stable).toBe(false);
    const early = observe('2026-07-28T22:01:59.000Z', first.observation);
    expect(early.stable).toBe(false);
    const stable = observe('2026-07-28T22:02:00.000Z', early.observation);
    expect(stable).toMatchObject({ stable: true });
    expect(stable.observation.state).toBe('stable');
  });

  it('OTV2-CONTENT-081 resets stability when the provider change marker changes', () => {
    const first = observe(now);
    const changed = observe('2026-07-28T22:03:00.000Z', first.observation, 'v2');
    expect(changed).toMatchObject({ stable: false, changed: true });
    expect(changed.observation.firstObservedAt).toBe('2026-07-28T22:03:00.000Z');
  });

  it('OTV2-CONTENT-081 rejects pagination loops and plans bounded ranged transfer', () => {
    expect(() => assertDrivePagination(new Set(['page-2']), 'page-1', 'page-2')).toThrowError(
      /repeated/,
    );
    const ranges = planDriveRanges(CONTENT_INGEST_PART_BYTES + 1);
    expect(ranges).toEqual([
      { partNumber: 1, start: 0, endExclusive: CONTENT_INGEST_PART_BYTES },
      {
        partNumber: 2,
        start: CONTENT_INGEST_PART_BYTES,
        endExclusive: CONTENT_INGEST_PART_BYTES + 1,
      },
    ]);
  });

  it('OTV2-CONTENT-192 deduplicates a Drive import against an app source checksum', () => {
    const canonical = source();
    const stable = observe('2026-07-28T22:02:00.000Z', observe(now).observation).observation;
    const transferId = stableIngestKey('drive_transfer', [
      digestProtectedReference('drive-file-1'),
      stable.changeMarker,
    ]);
    const { managed } = readback(begin(100).session!, canonical.sha256);
    const journal: RecoveryJournalReceipt = {
      receiptId: 'drive-journal-1',
      uploadSessionId: transferId,
      runtimeTier: managed.runtimeTier,
      verificationEnvironmentId: managed.verificationEnvironmentId,
      objectVersionId: managed.objectVersionId,
      byteCount: 100,
      sha256: canonical.sha256,
      writtenAt: now,
      readBackAt: '2026-07-28T22:02:01.000Z',
    };
    const result = confirmDriveImport(
      stable,
      {
        finalByteCount: 100,
        finalChangeMarker: stable.changeMarker,
        fullSha256: canonical.sha256,
        readback: { ...managed, byteCount: 100 },
        journalReceipt: journal,
        retentionDueAt: canonical.retentionDueAt,
        occurredAt: '2026-07-28T22:02:01.000Z',
      },
      canonical,
    );
    expect(result.deduplicated).toBe(true);
    expect(result.source.id).toBe(canonical.id);
    expect(result.observation.state).toBe('processed');
  });
});

describe('P19 source matching and lifecycle', () => {
  const occurrence: ClassOccurrenceRecord = {
    accountKey: actor.accountKey,
    productKey: actor.productKey,
    id: 'occurrence-1',
    seriesId: 'canonical-class',
    localClassDate: '2026-07-28',
    startsAt: '2026-07-28T16:00:00.000Z',
    scheduledEndsAt: '2026-07-28T17:00:00.000Z',
    joinOpensAt: '2026-07-28T15:50:00.000Z',
    joinClosesAt: '2026-07-28T17:15:00.000Z',
    state: 'completed',
    scheduleVersion: 1,
    version: 5,
    createdAt: now,
    updatedAt: now,
  };

  it('OTV2-CONTENT-082 requires an Admin-confirmed occurrence binding', () => {
    const current = source();
    const result = matchSourceToOccurrence(current, occurrence, {
      actor,
      sourceId: current.id,
      occurrenceId: occurrence.id,
      expectedVersion: current.version,
      idempotencyKey: 'match-1',
      requestHash: sha('d'),
      occurredAt: now,
    });
    expect(result.source).toMatchObject({
      occurrenceId: occurrence.id,
      matchConfidence: 'exact',
      matchedByAdminId: actor.principalId,
    });
  });

  it('OTV2-CONTENT-080 follows exact ingest lifecycle and recorded failed_from retry', () => {
    let current = source();
    current = transitionContentSource(current, {
      to: 'validating',
      expectedVersion: current.version,
      occurredAt: now,
    });
    current = transitionContentSource(current, {
      to: 'failed',
      expectedVersion: current.version,
      occurredAt: now,
      safeErrorCode: 'signature_invalid',
    });
    expect(current).toMatchObject({ lifecycleState: 'failed', failedFrom: 'validating' });
    expect(() =>
      transitionContentSource(current, {
        to: 'processing',
        expectedVersion: current.version,
        occurredAt: now,
      }),
    ).toThrowError(/failed_from/);
    current = transitionContentSource(current, {
      to: 'validating',
      expectedVersion: current.version,
      occurredAt: now,
    });
    expect(current.lifecycleState).toBe('validating');
  });

  it('OTV2-CONTENT-081 reaches durable dead letter on the eighth bounded failure', () => {
    let current = source();
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      current = recordIngestFailure(current, 'provider_unavailable', now);
    }
    expect(current).toMatchObject({ attemptCount: 8, retryState: 'dead_lettered' });
  });
});
