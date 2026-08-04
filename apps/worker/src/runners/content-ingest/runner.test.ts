import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  ContentIngestRepository,
  ContentIngestUnitOfWork,
  DriveFileObservation,
} from '../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  digestProtectedReference,
  stableIngestKey,
} from '../../../../../packages/domain/src/content/ingest/index.ts';
import {
  scanRegisteredDriveFolder,
  transferStableDriveFile,
  type DriveIngestProvider,
  type ManagedSourceStaging,
} from './runner.ts';

const scope = { accountKey: 'account-1', productKey: 'one-time' };
const file = {
  fileId: 'drive-file-1',
  parentFolderId: 'incoming-folder',
  displayFilename: 'recording.mp4',
  mimeType: 'video/mp4',
  byteCount: 10,
  changeMarker: 'v1',
};

function observationRepository() {
  const observations: DriveFileObservation[] = [];
  const repository: ContentIngestRepository = {
    inTransaction: async (run) => {
      const unit = {
        getDriveObservation: async (_scope, digest) =>
          observations.find((item) => item.driveFileRefDigest === digest) ?? null,
        saveDriveObservation: async (record) => {
          const index = observations.findIndex(
            (item) => item.driveFileRefDigest === record.driveFileRefDigest,
          );
          if (index >= 0) observations[index] = record;
          else observations.push(record);
        },
      } as ContentIngestUnitOfWork;
      return run(unit);
    },
  };
  return { repository, observations };
}

describe('P19 Drive ingest runner', () => {
  it('OTV2-CONTENT-081 paginates the complete registered folder and persists observations', async () => {
    const { repository, observations } = observationRepository();
    const calls: Array<string | undefined> = [];
    const provider: DriveIngestProvider = {
      listPage: async ({ pageToken }) => {
        calls.push(pageToken);
        return pageToken
          ? { files: [{ ...file, fileId: 'drive-file-2' }] }
          : { files: [file], nextPageToken: 'page-2' };
      },
      openRange: () => chunks([]),
    };
    const result = await scanRegisteredDriveFolder({
      scope,
      registeredIncomingFolderId: 'incoming-folder',
      observedAt: '2026-07-28T22:00:00.000Z',
      repository,
      provider,
    });
    expect(result).toMatchObject({ pageCount: 2, fileCount: 2, stableCount: 0 });
    expect(calls).toEqual([undefined, 'page-2']);
    expect(observations).toHaveLength(2);
  });

  it('OTV2-CONTENT-081 rejects files outside the registered incoming folder', async () => {
    const { repository } = observationRepository();
    const provider: DriveIngestProvider = {
      listPage: async () => ({
        files: [{ ...file, parentFolderId: 'unregistered-folder' }],
      }),
      openRange: () => chunks([]),
    };
    await expect(
      scanRegisteredDriveFolder({
        scope,
        registeredIncomingFolderId: 'incoming-folder',
        observedAt: '2026-07-28T22:00:00.000Z',
        repository,
        provider,
      }),
    ).rejects.toMatchObject({ code: 'content_ingest_access_denied' });
  });

  it('OTV2-CONTENT-081 streams bounded ranges while calculating the full checksum', async () => {
    const bytes = new TextEncoder().encode('0123456789');
    let consumed = 0;
    const provider: DriveIngestProvider = {
      listPage: async () => ({ files: [] }),
      openRange: ({ start, endExclusive }) =>
        chunks([
          bytes.slice(start, Math.min(start + 3, endExclusive)),
          bytes.slice(Math.min(start + 3, endExclusive), endExclusive),
        ]),
    };
    const transferId = stableIngestKey('drive_transfer', [
      digestProtectedReference(file.fileId),
      file.changeMarker,
    ]);
    const staging: ManagedSourceStaging = {
      beginDriveTransfer: async (input) => {
        expect(input.transferId).toBe(transferId);
        expect(input.opaqueObjectKey).not.toContain(file.displayFilename);
      },
      putPart: async ({ body, byteCount }) => {
        let partBytes = 0;
        for await (const chunk of body) partBytes += chunk.byteLength;
        consumed += partBytes;
        expect(partBytes).toBe(byteCount);
        return { providerPartRefDigest: '1'.repeat(64) };
      },
      completeAndReadBack: async ({ fullSha256 }) => ({
        readback: {
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'ci-1',
          region: 'eu-central-1',
          bucketRef: 'bucket-ref',
          objectKeyDigest: '2'.repeat(64),
          objectVersionId: 'version-1',
          byteCount: 10,
          durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
          checksumAlgorithm: 'sha256',
          sha256: fullSha256,
          kmsKeyVersionRef: 'kms-1',
          storageClass: 'STANDARD',
          blockPublicAccess: true,
          bucketOwnerEnforced: true,
        },
        journalReceipt: {
          receiptId: 'journal-1',
          uploadSessionId: transferId,
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'ci-1',
          durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
          bucketRef: 'bucket-ref',
          objectKeyDigest: '2'.repeat(64),
          objectVersionId: 'version-1',
          byteCount: 10,
          checksumAlgorithm: 'sha256',
          sha256: fullSha256,
          kmsKeyVersionRef: 'kms-1',
          storageClass: 'STANDARD',
          writtenAt: '2026-07-28T22:00:00.000Z',
          readBackAt: '2026-07-28T22:00:01.000Z',
        },
      }),
    };
    const result = await transferStableDriveFile({ scope, file, provider, staging });
    expect(result).toMatchObject({
      transferId,
      byteCount: 10,
      partCount: 1,
      fullSha256: createHash('sha256').update(bytes).digest('hex'),
    });
    expect(consumed).toBe(10);
  });

  it('OTV2-CONTENT-081 rejects a truncated ranged download before confirmation', async () => {
    const provider: DriveIngestProvider = {
      listPage: async () => ({ files: [] }),
      openRange: () => chunks([new Uint8Array([1, 2, 3])]),
    };
    const staging: ManagedSourceStaging = {
      beginDriveTransfer: async () => undefined,
      putPart: async ({ body }) => {
        for await (const chunk of body) {
          // Consume the bounded stream as a real adapter would.
          expect(chunk).toBeInstanceOf(Uint8Array);
        }
        return { providerPartRefDigest: '1'.repeat(64) };
      },
      completeAndReadBack: async () => {
        throw new Error('must not complete');
      },
    };
    await expect(transferStableDriveFile({ scope, file, provider, staging })).rejects.toThrow(
      /ended before/,
    );
  });
});

async function* chunks(values: readonly Uint8Array[]) {
  for (const value of values) {
    if (value.byteLength) yield value;
  }
}
