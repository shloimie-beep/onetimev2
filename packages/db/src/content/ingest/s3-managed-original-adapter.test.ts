import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  AwsS3ManagedOriginalAdapter,
  S3_CONTENT_ORIGINAL_REGISTRY_KEY,
  type S3ManagedOriginalClient,
} from './s3-managed-original-adapter.ts';

const directId = `upload_${'a'.repeat(32)}`;
const driveId = `drive_transfer_${'b'.repeat(32)}`;
const directKey = `source_${'c'.repeat(32)}`;

describe('AwsS3ManagedOriginalAdapter', () => {
  it('binds direct and Drive multipart identities without weakening object keys', async () => {
    const client = fakeClient();
    const adapter = createAdapter(client);

    await adapter.beginDirectUpload({
      uploadSessionId: directId,
      opaqueObjectKey: directKey,
      byteCount: 8,
      mimeType: 'video/mp4',
    });
    const driveKey = stableKey('source', ['account-1', 'one-time', driveId]);
    await adapter.beginDriveTransfer({
      transferId: driveId,
      opaqueObjectKey: driveKey,
      byteCount: 8,
    });
    await adapter.putPart({
      transferId: driveId,
      partNumber: 1,
      byteCount: 8,
      body: oneChunk(),
    });

    expect(client.beginReconciledMultipart).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ uploadSessionId: directId, opaqueObjectKey: directKey }),
    );
    expect(client.beginReconciledMultipart).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ uploadSessionId: driveId, opaqueObjectKey: driveKey }),
    );
    expect(client.putStreamPart).toHaveBeenCalledWith(
      expect.objectContaining({ uploadSessionId: driveId, opaqueObjectKey: driveKey }),
    );
  });

  it('fails closed when exact browser PUT AllowedHeaders are absent', async () => {
    const client = fakeClient();
    client.readIdentity.mockResolvedValueOnce(
      // Runtime validation deliberately covers legacy structurally compatible fakes.
      withoutAllowedHeaders(identity()) as never,
    );
    const adapter = createAdapter(client);

    await expect(adapter.readCanonicalIdentity()).rejects.toThrow(
      'content_s3_identity_readback_mismatch',
    );
  });

  it('returns no usable upload when reconciliation finds duplicate multipart sessions', async () => {
    const client = fakeClient();
    client.beginReconciledMultipart.mockResolvedValueOnce({
      disposition: 'duplicate',
      providerUploadIdDigests: ['d'.repeat(64), 'e'.repeat(64)],
      openUploadCount: 2,
    } as never);
    const adapter = createAdapter(client);

    await expect(
      adapter.beginDirectUpload({
        uploadSessionId: directId,
        opaqueObjectKey: directKey,
        byteCount: 8,
        mimeType: 'video/mp4',
      }),
    ).rejects.toThrow('content_s3_duplicate_multipart_reconciliation_required');
  });
});

function createAdapter(client: ReturnType<typeof fakeClient>) {
  return new AwsS3ManagedOriginalAdapter(
    {
      enabled: true,
      region: 'eu-central-1',
      bucketRef: 'private-originals',
      kmsKeyVersionRef: 'kms-version-1',
      storageClass: 'STANDARD',
      browserOrigin: 'https://example.test',
      accountKey: 'account-1',
      productKey: 'one-time',
    },
    client,
  );
}

function identity(): Awaited<ReturnType<S3ManagedOriginalClient['readIdentity']>> {
  return {
    registryBindingKey: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
    providerAccountRefHash: '1'.repeat(64),
    principalArnHash: '2'.repeat(64),
    region: 'eu-central-1',
    bucketRef: 'private-originals',
    kmsKeyVersionRef: 'kms-version-1',
    versioningEnabled: true,
    blockPublicAccess: true,
    bucketOwnerEnforced: true,
    browserCredentialsExposed: false,
    corsAllowedOrigins: ['https://example.test'],
    corsAllowedMethods: ['PUT'],
    corsAllowedHeaders: ['content-length', 'x-amz-checksum-sha256'],
    corsExposedHeaders: ['ETag'],
    observedAt: '2026-08-04T00:00:00.000Z',
  };
}

function fakeClient() {
  return {
    readIdentity: vi.fn(async () => identity()),
    beginReconciledMultipart: vi.fn(async () => ({
      disposition: 'created' as const,
      providerUploadIdDigest: '3'.repeat(64),
      openUploadCount: 1 as const,
    })),
    authorizePart: vi.fn(async () => ({
      uploadUrl: 'https://signed.invalid',
      requiredHeaders: {},
    })),
    recordCompletedPart: vi.fn(async () => ({ providerPartRefDigest: '4'.repeat(64) })),
    completeAndReadBack: vi.fn(async () => {
      throw new Error('not used');
    }),
    abortMultipart: vi.fn(async () => undefined),
    putStreamPart: vi.fn(async () => ({ providerPartRefDigest: '5'.repeat(64) })),
  };
}

function withoutAllowedHeaders(value: ReturnType<typeof identity>) {
  const copy: Record<string, unknown> = { ...value };
  delete copy.corsAllowedHeaders;
  return copy as Omit<ReturnType<typeof identity>, 'corsAllowedHeaders'>;
}

async function* oneChunk() {
  yield new Uint8Array([1]);
}

function stableKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32)}`;
}
