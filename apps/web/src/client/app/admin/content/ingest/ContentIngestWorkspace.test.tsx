import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_INGEST_PART_BYTES,
  type UploadSessionRecord,
} from '../../../../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  allowsOccurrenceMatching,
  ContentIngestWorkspace,
  uploadFileInBoundedParts,
} from './ContentIngestWorkspace.tsx';

const session: UploadSessionRecord = {
  accountKey: 'account-1',
  productKey: 'one-time',
  id: 'upload-1',
  actorId: 'admin-1',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci-1',
  displayFilename: 'recording.mp4',
  mimeType: 'video/mp4',
  container: 'mp4',
  declaredByteCount: 5 * CONTENT_INGEST_PART_BYTES,
  opaqueObjectKey: 'source_opaque',
  providerUploadIdDigest: 'pending',
  state: 'initiated',
  totalParts: 5,
  completedParts: 0,
  receivedByteCount: 0,
  attemptCount: 0,
  retryState: 'ready',
  idempotencyKey: 'begin-1',
  requestHash: 'a'.repeat(64),
  expiresAt: '2026-07-29T22:00:00.000Z',
  version: 1,
  createdAt: '2026-07-28T22:00:00.000Z',
  updatedAt: '2026-07-28T22:00:00.000Z',
};

describe('P19 Admin recording intake workspace', () => {
  it('OTV2-CONTENT-190 renders an accessible picker with bounded-upload guidance', () => {
    const html = renderToStaticMarkup(
      <ContentIngestWorkspace
        beginUpload={async () => {
          throw new Error('not called during render');
        }}
        uploadPart={async () => undefined}
        confirmUpload={async () => {
          throw new Error('not called during render');
        }}
        listOccurrences={async () => []}
        matchSource={async () => {
          throw new Error('not called during render');
        }}
      />,
    );
    expect(html).toContain('Recording intake');
    expect(html).toContain('up to 5 GiB');
    expect(html).toContain('64 MiB parts');
    expect(html).toContain('type="file"');
    expect(html).toContain('aria-live="polite"');
  });

  it('OTV2-CONTENT-190 uploads no more than four parts concurrently', async () => {
    const fakeFile = {
      size: 5 * CONTENT_INGEST_PART_BYTES,
      slice: () => new Blob(),
    } as File;
    let active = 0;
    let maxActive = 0;
    const progress: number[] = [];
    await uploadFileInBoundedParts(
      fakeFile,
      session,
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
      },
      (completed) => progress.push(completed),
    );
    expect(maxActive).toBe(4);
    expect(progress).toHaveLength(5);
    expect(progress.at(-1)).toBe(5);
  });

  it('keeps an existing reviewed recording out of the historical class-date matcher', () => {
    expect(allowsOccurrenceMatching('existing_reviewed_recording')).toBe(false);
    expect(allowsOccurrenceMatching('obs')).toBe(true);
  });
});
