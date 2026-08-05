import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import type { S3Client } from '@aws-sdk/client-s3';
import type { STSClient } from '@aws-sdk/client-sts';
import { describe, expect, it, vi } from 'vitest';

import { AwsS3ManagedOriginalClient } from './aws-s3-managed-original-client.ts';
import { protectedProviderReferenceDigest } from './s3-managed-original-adapter.ts';

const directId = `upload_${'a'.repeat(32)}`;
const driveId = `drive_transfer_${'b'.repeat(32)}`;
const objectKey = `source_${'c'.repeat(32)}`;

describe('AwsS3ManagedOriginalClient', () => {
  it.each([directId, driveId])(
    'accepts an explicit %s binding while retaining the exact source-key grammar',
    async (uploadSessionId) => {
      const opened = new Set<string>();
      const harness = createHarness((command) => {
        if (name(command) === 'ListMultipartUploadsCommand') {
          const key = commandInput(command).Prefix as string;
          return { Uploads: opened.has(key) ? [{ Key: key, UploadId: `provider-${key}` }] : [] };
        }
        if (name(command) === 'CreateMultipartUploadCommand') {
          const key = commandInput(command).Key as string;
          opened.add(key);
          return { Key: key, UploadId: `provider-${key}` };
        }
        return undefined;
      });

      await expect(
        harness.client.beginReconciledMultipart({
          uploadSessionId,
          opaqueObjectKey: objectKey,
          byteCount: 14,
          mimeType: 'video/mp4',
          checksumAlgorithm: 'sha256',
        }),
      ).resolves.toMatchObject({ disposition: 'created', openUploadCount: 1 });
      await expect(
        harness.client.beginReconciledMultipart({
          uploadSessionId,
          opaqueObjectKey: `unsafe/${'c'.repeat(32)}`,
          byteCount: 14,
          mimeType: 'video/mp4',
          checksumAlgorithm: 'sha256',
        }),
      ).rejects.toThrow('content_s3_exact_object_binding_invalid');
    },
  );

  it('returns a digest-only duplicate state without selecting or aborting', async () => {
    const harness = createHarness((command) => {
      if (name(command) === 'ListMultipartUploadsCommand') {
        return {
          Uploads: [
            { Key: objectKey, UploadId: 'provider-one' },
            { Key: objectKey, UploadId: 'provider-two' },
          ],
        };
      }
      return undefined;
    });

    await expect(
      harness.client.beginReconciledMultipart({
        uploadSessionId: directId,
        opaqueObjectKey: objectKey,
        byteCount: 14,
        mimeType: 'video/mp4',
        checksumAlgorithm: 'sha256',
      }),
    ).resolves.toEqual({
      disposition: 'duplicate',
      providerUploadIdDigests: [
        protectedProviderReferenceDigest('provider-one'),
        protectedProviderReferenceDigest('provider-two'),
      ].sort(),
      openUploadCount: 2,
    });
    expect(harness.commands).not.toContain('AbortMultipartUploadCommand');
    expect(harness.commands).not.toContain('CreateMultipartUploadCommand');
  });

  it('completes without a FULL_OBJECT checksum and hashes exact bytes from the returned version', async () => {
    const bytes = Buffer.from('canonical original bytes');
    const fullSha256 = sha(bytes);
    const etag = 'part-etag';
    const inputs: Record<string, Record<string, unknown>[]> = {};
    const harness = createHarness((command) => {
      (inputs[name(command)] ??= []).push(commandInput(command));
      switch (name(command)) {
        case 'ListMultipartUploadsCommand':
          return { Uploads: [{ Key: objectKey, UploadId: 'upload-provider-1' }] };
        case 'ListPartsCommand':
          return {
            Parts: [
              {
                PartNumber: 1,
                ETag: etag,
                Size: bytes.byteLength,
                ChecksumSHA256: Buffer.from(sha(bytes), 'hex').toString('base64'),
              },
            ],
          };
        case 'CompleteMultipartUploadCommand':
          return { VersionId: 'version-exact-1' };
        case 'HeadObjectCommand':
          return completedHead('version-exact-1', directId, bytes.byteLength, 'COMPOSITE-NOT-SHA');
        case 'GetObjectCommand':
          return { Body: Readable.from([bytes]), VersionId: 'version-exact-1' };
        default:
          return undefined;
      }
    });

    const result = await harness.client.completeAndReadBack({
      uploadSessionId: directId,
      opaqueObjectKey: objectKey,
      fullSha256,
      orderedProviderPartRefDigests: [protectedProviderReferenceDigest(etag)],
    });

    expect(result.readback.sha256).toBe(fullSha256);
    expect(result.readback.objectVersionId).toBe('version-exact-1');
    expect(inputs.CompleteMultipartUploadCommand?.[0]).not.toHaveProperty('ChecksumSHA256');
    expect(inputs.HeadObjectCommand?.[0]).toMatchObject({ VersionId: 'version-exact-1' });
    expect(inputs.GetObjectCommand?.[0]).toMatchObject({ VersionId: 'version-exact-1' });
  });

  it('recovers an accepted completion after timeout and on restart from one exact durable version', async () => {
    const bytes = Buffer.from('restart-safe original');
    const fullSha256 = sha(bytes);
    let open = true;
    let completionCalls = 0;
    const harness = createHarness((command) => {
      switch (name(command)) {
        case 'ListMultipartUploadsCommand':
          return { Uploads: open ? [{ Key: objectKey, UploadId: 'provider-upload' }] : [] };
        case 'ListPartsCommand':
          return { Parts: [{ PartNumber: 1, ETag: 'etag-restart', Size: bytes.byteLength }] };
        case 'CompleteMultipartUploadCommand':
          completionCalls += 1;
          open = false;
          throw new Error('simulated transport timeout after acceptance');
        case 'ListObjectVersionsCommand':
          return { Versions: [{ Key: objectKey, VersionId: 'version-recovered' }] };
        case 'HeadObjectCommand':
          return completedHead('version-recovered', directId, bytes.byteLength);
        case 'GetObjectCommand':
          return { Body: Readable.from([bytes]), VersionId: 'version-recovered' };
        default:
          return undefined;
      }
    });
    const request = {
      uploadSessionId: directId,
      opaqueObjectKey: objectKey,
      fullSha256,
      orderedProviderPartRefDigests: [protectedProviderReferenceDigest('etag-restart')],
    };

    await expect(harness.client.completeAndReadBack(request)).resolves.toMatchObject({
      readback: { objectVersionId: 'version-recovered', sha256: fullSha256 },
    });
    await expect(harness.client.completeAndReadBack(request)).resolves.toMatchObject({
      readback: { objectVersionId: 'version-recovered', sha256: fullSha256 },
    });
    expect(completionCalls).toBe(1);
  });

  it('fails closed when durable completion reconciliation finds ambiguous versions', async () => {
    const bytes = Buffer.from('ambiguous');
    const harness = createHarness((command) => {
      switch (name(command)) {
        case 'ListMultipartUploadsCommand':
          return { Uploads: [] };
        case 'ListObjectVersionsCommand':
          return {
            Versions: [
              { Key: objectKey, VersionId: 'version-1' },
              { Key: objectKey, VersionId: 'version-2' },
            ],
          };
        case 'HeadObjectCommand':
          return completedHead(
            commandInput(command).VersionId as string,
            directId,
            bytes.byteLength,
          );
        default:
          return undefined;
      }
    });

    await expect(
      harness.client.completeAndReadBack({
        uploadSessionId: directId,
        opaqueObjectKey: objectKey,
        fullSha256: sha(bytes),
        orderedProviderPartRefDigests: ['1'.repeat(64)],
      }),
    ).rejects.toThrow('content_s3_completed_version_reconciliation_ambiguous');
    expect(harness.commands).not.toContain('GetObjectCommand');
  });

  it('fails identity readback when signed PUT AllowedHeaders are not exact', async () => {
    const harness = createHarness(() => undefined, ['content-length']);
    await expect(harness.client.readIdentity()).rejects.toThrow(
      'content_s3_identity_readback_mismatch',
    );
  });

  it('rejects a browser part when S3 omits the persisted SHA-256 checksum', async () => {
    const harness = createHarness((command) => {
      if (name(command) === 'ListMultipartUploadsCommand') {
        return { Uploads: [{ Key: objectKey, UploadId: 'provider-upload' }] };
      }
      if (name(command) === 'ListPartsCommand') {
        return { Parts: [{ PartNumber: 1, ETag: 'etag-1', Size: 8 }] };
      }
      return undefined;
    });

    await expect(
      harness.client.recordCompletedPart({
        uploadSessionId: directId,
        opaqueObjectKey: objectKey,
        partNumber: 1,
        byteCount: 8,
        partSha256: 'f'.repeat(64),
        providerPartRef: 'etag-1',
      }),
    ).rejects.toThrow('content_s3_part_readback_mismatch');
  });

  it('signs the exact content-length and SHA-256 headers required by CORS readback', async () => {
    const signed: { input: Record<string, unknown>; expires: number }[] = [];
    const harness = createHarness(
      (command) =>
        name(command) === 'ListMultipartUploadsCommand'
          ? { Uploads: [{ Key: objectKey, UploadId: 'provider-upload' }] }
          : undefined,
      undefined,
      async (_client, command, expires) => {
        signed.push({ input: commandInput(command), expires });
        return 'https://signed.invalid/part';
      },
    );
    const partSha256 = 'f'.repeat(64);

    await expect(
      harness.client.authorizePart({
        uploadSessionId: directId,
        opaqueObjectKey: objectKey,
        partNumber: 1,
        byteCount: 8,
        partSha256,
        expiresInSeconds: 900,
      }),
    ).resolves.toEqual({
      uploadUrl: 'https://signed.invalid/part',
      requiredHeaders: {
        'content-length': '8',
        'x-amz-checksum-sha256': Buffer.from(partSha256, 'hex').toString('base64'),
      },
    });
    expect(signed).toEqual([
      {
        input: expect.objectContaining({
          Key: objectKey,
          UploadId: 'provider-upload',
          ContentLength: 8,
          ChecksumSHA256: Buffer.from(partSha256, 'hex').toString('base64'),
        }),
        expires: 900,
      },
    ]);
  });
});

function createHarness(
  operation: (command: unknown) => unknown,
  allowedHeaders: readonly string[] = ['content-length', 'x-amz-checksum-sha256'],
  signPart?: (client: Pick<S3Client, 'send'>, command: unknown, expires: number) => Promise<string>,
) {
  const commands: string[] = [];
  const s3 = {
    send: vi.fn(async (command: unknown) => {
      commands.push(name(command));
      const common = identityS3Response(name(command), allowedHeaders);
      return common ?? operation(command);
    }),
  } as unknown as Pick<S3Client, 'send'>;
  const sts = {
    send: vi.fn(async () => ({ Account: 'aws-account-1', Arn: 'arn:aws:iam::1:role/media' })),
  } as unknown as Pick<STSClient, 'send'>;
  return {
    commands,
    client: new AwsS3ManagedOriginalClient(
      {
        region: 'eu-central-1',
        bucketRef: 'private-originals',
        kmsKeyVersionRef: 'kms-version-1',
        storageClass: 'STANDARD',
        browserOrigin: 'https://example.test',
        runtimeTier: 'production',
        verificationEnvironmentId: 'production_operator_canary',
        timeoutMs: 1_000,
        clock: () => new Date('2026-08-04T00:00:00.000Z'),
      },
      s3,
      sts,
      {
        read: vi.fn(async () => ({ providerAccountRefHash: sha('aws-account-1'), observedAt: '' })),
      },
      signPart as never,
    ),
  };
}

function identityS3Response(command: string, allowedHeaders: readonly string[]) {
  switch (command) {
    case 'GetBucketLocationCommand':
      return { LocationConstraint: 'eu-central-1' };
    case 'GetBucketVersioningCommand':
      return { Status: 'Enabled' };
    case 'GetPublicAccessBlockCommand':
      return {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      };
    case 'GetBucketOwnershipControlsCommand':
      return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } };
    case 'GetBucketCorsCommand':
      return {
        CORSRules: [
          {
            AllowedOrigins: ['https://example.test'],
            AllowedMethods: ['PUT'],
            AllowedHeaders: [...allowedHeaders],
            ExposeHeaders: ['ETag'],
          },
        ],
      };
    case 'GetBucketEncryptionCommand':
      return {
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
                KMSMasterKeyID: 'kms-version-1',
              },
            },
          ],
        },
      };
    default:
      return undefined;
  }
}

function completedHead(
  versionId: string,
  sessionId: string,
  byteCount: number,
  checksumSha256?: string,
) {
  return {
    VersionId: versionId,
    ContentLength: byteCount,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: 'kms-version-1',
    StorageClass: 'STANDARD',
    LastModified: new Date('2026-08-04T00:00:00.000Z'),
    Metadata: {
      'one-time-upload-session': protectedProviderReferenceDigest(sessionId),
      'one-time-declared-bytes': String(byteCount),
    },
    ...(checksumSha256 ? { ChecksumSHA256: checksumSha256 } : {}),
  };
}

function name(command: unknown) {
  return (command as { constructor: { name: string } }).constructor.name;
}

function commandInput(command: unknown) {
  return (command as { input: Record<string, unknown> }).input;
}

function sha(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
