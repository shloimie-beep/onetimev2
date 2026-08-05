import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetBucketCorsCommand,
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketOwnershipControlsCommand,
  GetBucketVersioningCommand,
  GetPublicAccessBlockCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
  type CreateMultipartUploadCommandOutput,
  type GetBucketCorsCommandOutput,
  type GetBucketEncryptionCommandOutput,
  type GetBucketLocationCommandOutput,
  type GetBucketOwnershipControlsCommandOutput,
  type GetBucketVersioningCommandOutput,
  type GetObjectCommandOutput,
  type GetPublicAccessBlockCommandOutput,
  type HeadObjectCommandOutput,
  type ListMultipartUploadsCommandOutput,
  type ListObjectVersionsCommandOutput,
  type ListPartsCommandOutput,
  type MultipartUpload,
  type Part,
  type UploadPartCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  GetCallerIdentityCommand,
  STSClient,
  type GetCallerIdentityCommandOutput,
} from '@aws-sdk/client-sts';

import {
  CONTENT_INGEST_REGION,
  type ManagedMultipartBeginReadback,
} from '../../../../contracts/src/content/ingest/index.ts';
import {
  protectedProviderReferenceDigest,
  S3_CONTENT_ORIGINAL_REGISTRY_KEY,
  type S3CompletedOriginal,
  type S3ManagedOriginalClient,
} from './s3-managed-original-adapter.ts';

export interface S3CanonicalRegistryGuard {
  read(): Promise<{ providerAccountRefHash: string; observedAt: string }>;
}

export type AwsS3ManagedOriginalClientConfig = {
  region: typeof CONTENT_INGEST_REGION;
  bucketRef: string;
  kmsKeyVersionRef: string;
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING';
  browserOrigin: string;
  runtimeTier: 'isolated_staging' | 'production';
  verificationEnvironmentId: string;
  timeoutMs: number;
  clock?: (() => Date) | undefined;
};

export class AwsS3ManagedOriginalClient implements S3ManagedOriginalClient {
  private readonly clock: () => Date;

  constructor(
    private readonly config: AwsS3ManagedOriginalClientConfig,
    private readonly s3: Pick<S3Client, 'send'>,
    private readonly sts: Pick<STSClient, 'send'>,
    private readonly registry: S3CanonicalRegistryGuard,
    private readonly signPart: (
      client: Pick<S3Client, 'send'>,
      command: UploadPartCommand,
      expiresInSeconds: number,
    ) => Promise<string> = (client, command, expiresInSeconds) =>
      getSignedUrl(client as S3Client, command, { expiresIn: expiresInSeconds }),
  ) {
    this.clock = config.clock ?? (() => new Date());
  }

  async readIdentity() {
    const registry = await this.registry.read();
    const caller = (await this.sendSts(
      new GetCallerIdentityCommand({}),
    )) as GetCallerIdentityCommandOutput;
    const [location, versioning, publicAccess, ownership, cors, encryption] = await Promise.all([
      this.sendS3(
        new GetBucketLocationCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetBucketLocationCommandOutput>,
      this.sendS3(
        new GetBucketVersioningCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetBucketVersioningCommandOutput>,
      this.sendS3(
        new GetPublicAccessBlockCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetPublicAccessBlockCommandOutput>,
      this.sendS3(
        new GetBucketOwnershipControlsCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetBucketOwnershipControlsCommandOutput>,
      this.sendS3(
        new GetBucketCorsCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetBucketCorsCommandOutput>,
      this.sendS3(
        new GetBucketEncryptionCommand({ Bucket: this.config.bucketRef }),
      ) as Promise<GetBucketEncryptionCommandOutput>,
    ]);
    const accountHash = digestRequired(caller.Account);
    const principalHash = digestRequired(caller.Arn);
    const corsRules = cors.CORSRules ?? [];
    const kmsKey = encryption.ServerSideEncryptionConfiguration?.Rules?.find(
      (rule) => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms',
    )?.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID;
    if (
      registry.providerAccountRefHash !== accountHash ||
      location.LocationConstraint !== CONTENT_INGEST_REGION ||
      versioning.Status !== 'Enabled' ||
      publicAccess.PublicAccessBlockConfiguration?.BlockPublicAcls !== true ||
      publicAccess.PublicAccessBlockConfiguration?.IgnorePublicAcls !== true ||
      publicAccess.PublicAccessBlockConfiguration?.BlockPublicPolicy !== true ||
      publicAccess.PublicAccessBlockConfiguration?.RestrictPublicBuckets !== true ||
      ownership.OwnershipControls?.Rules?.length !== 1 ||
      ownership.OwnershipControls.Rules[0]?.ObjectOwnership !== 'BucketOwnerEnforced' ||
      corsRules.length !== 1 ||
      !sameStrings(corsRules[0]?.AllowedOrigins, [this.config.browserOrigin]) ||
      !sameStrings(corsRules[0]?.AllowedMethods, ['PUT']) ||
      !sameStrings(corsRules[0]?.AllowedHeaders?.map((header) => header.toLowerCase()).sort(), [
        'content-length',
        'x-amz-checksum-sha256',
      ]) ||
      !sameStrings(corsRules[0]?.ExposeHeaders, ['ETag']) ||
      kmsKey !== this.config.kmsKeyVersionRef
    ) {
      throw new Error('content_s3_identity_readback_mismatch');
    }
    return {
      registryBindingKey: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
      providerAccountRefHash: accountHash,
      principalArnHash: principalHash,
      region: CONTENT_INGEST_REGION,
      bucketRef: this.config.bucketRef,
      kmsKeyVersionRef: this.config.kmsKeyVersionRef,
      versioningEnabled: true as const,
      blockPublicAccess: true as const,
      bucketOwnerEnforced: true as const,
      browserCredentialsExposed: false as const,
      corsAllowedOrigins: [this.config.browserOrigin],
      corsAllowedMethods: ['PUT'] as const,
      corsAllowedHeaders: ['content-length', 'x-amz-checksum-sha256'] as const,
      corsExposedHeaders: ['ETag'] as const,
      observedAt: this.clock().toISOString(),
    };
  }

  async beginReconciledMultipart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    byteCount: number;
    mimeType: string;
    checksumAlgorithm: 'sha256';
  }): Promise<ManagedMultipartBeginReadback> {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const before = await this.listExactOpenUploads(input.opaqueObjectKey);
    const prior = multipartReadback(before, 'recovered');
    if (prior) return prior;

    let createdUploadId: string;
    try {
      const created = (await this.sendS3(
        new CreateMultipartUploadCommand({
          Bucket: this.config.bucketRef,
          Key: input.opaqueObjectKey,
          ContentType: input.mimeType,
          ChecksumAlgorithm: 'SHA256',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.config.kmsKeyVersionRef,
          StorageClass: this.config.storageClass,
          Metadata: {
            'one-time-upload-session': protectedProviderReferenceDigest(input.uploadSessionId),
            'one-time-declared-bytes': String(input.byteCount),
          },
        }),
      )) as CreateMultipartUploadCommandOutput;
      if (!created.UploadId || created.Key !== input.opaqueObjectKey) {
        throw new Error('content_s3_multipart_create_readback_invalid');
      }
      createdUploadId = created.UploadId;
    } catch {
      const recovered = multipartReadback(
        await this.listExactOpenUploads(input.opaqueObjectKey),
        'recovered',
      );
      if (recovered) return recovered;
      throw new Error('content_s3_multipart_acceptance_unknown');
    }

    const after = await this.listExactOpenUploads(input.opaqueObjectKey);
    const readback = multipartReadback(after, 'created');
    if (
      !readback ||
      (readback.disposition === 'created' &&
        readback.providerUploadIdDigest !== protectedProviderReferenceDigest(createdUploadId))
    ) {
      throw new Error('content_s3_multipart_acceptance_unknown');
    }
    return readback;
  }

  async authorizePart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    partNumber: number;
    byteCount: number;
    partSha256: string;
    expiresInSeconds: number;
  }) {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const upload = await this.requireSingleOpen(input.opaqueObjectKey);
    const checksum = Buffer.from(input.partSha256, 'hex').toString('base64');
    const command = new UploadPartCommand({
      Bucket: this.config.bucketRef,
      Key: input.opaqueObjectKey,
      UploadId: upload.UploadId,
      PartNumber: input.partNumber,
      ContentLength: input.byteCount,
      ChecksumSHA256: checksum,
    });
    const uploadUrl = await this.signPart(this.s3, command, input.expiresInSeconds);
    return {
      uploadUrl,
      requiredHeaders: {
        'content-length': String(input.byteCount),
        'x-amz-checksum-sha256': checksum,
      },
    };
  }

  async recordCompletedPart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    partNumber: number;
    byteCount: number;
    partSha256: string;
    providerPartRef: string;
  }) {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const upload = await this.requireSingleOpen(input.opaqueObjectKey);
    const parts = await this.listAllParts(input.opaqueObjectKey, upload.UploadId!);
    const expectedEtag = normalizeEtag(input.providerPartRef);
    const part = parts.find((candidate) => candidate.PartNumber === input.partNumber);
    if (
      normalizeEtag(part?.ETag) !== expectedEtag ||
      part?.Size !== input.byteCount ||
      !part.ChecksumSHA256 ||
      part.ChecksumSHA256 !== Buffer.from(input.partSha256, 'hex').toString('base64')
    ) {
      throw new Error('content_s3_part_readback_mismatch');
    }
    return { providerPartRefDigest: protectedProviderReferenceDigest(expectedEtag) };
  }

  async completeAndReadBack(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    fullSha256?: string;
    orderedProviderPartRefDigests: readonly string[];
  }): Promise<S3CompletedOriginal> {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const uploads = await this.listExactOpenUploads(input.opaqueObjectKey);
    if (uploads.length === 0) {
      return this.reconcileCompletedVersion(input);
    }
    if (uploads.length !== 1) {
      throw new Error('content_s3_duplicate_multipart_reconciliation_required');
    }
    const upload = uploads[0]!;
    const parts = await this.listAllParts(input.opaqueObjectKey, upload.UploadId!);
    const ordered = [...parts].sort((left, right) => left.PartNumber! - right.PartNumber!);
    if (
      ordered.length !== input.orderedProviderPartRefDigests.length ||
      ordered.some(
        (part, index) =>
          protectedProviderReferenceDigest(normalizeEtag(part.ETag)) !==
          input.orderedProviderPartRefDigests[index],
      )
    ) {
      throw new Error('content_s3_complete_parts_mismatch');
    }
    const completedParts: CompletedPart[] = ordered.map((part) => ({
      PartNumber: part.PartNumber,
      ETag: part.ETag,
      ...(part.ChecksumSHA256 ? { ChecksumSHA256: part.ChecksumSHA256 } : {}),
    }));
    let completionVersionId: string | undefined;
    try {
      const completed = (await this.sendS3(
        new CompleteMultipartUploadCommand({
          Bucket: this.config.bucketRef,
          Key: input.opaqueObjectKey,
          UploadId: upload.UploadId,
          MultipartUpload: { Parts: completedParts },
        }),
      )) as { VersionId?: string };
      completionVersionId = completed.VersionId;
    } catch {
      return this.reconcileCompletedVersion(input);
    }
    if (!completionVersionId) {
      return this.reconcileCompletedVersion(input);
    }
    return this.readCompletedVersion(input, completionVersionId);
  }

  private async reconcileCompletedVersion(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    fullSha256?: string;
    orderedProviderPartRefDigests: readonly string[];
  }): Promise<S3CompletedOriginal> {
    const versions = await this.listExactObjectVersions(input.opaqueObjectKey);
    const sessionDigest = protectedProviderReferenceDigest(input.uploadSessionId);
    const candidates: string[] = [];
    for (const version of versions) {
      const head = (await this.sendS3(
        new HeadObjectCommand({
          Bucket: this.config.bucketRef,
          Key: input.opaqueObjectKey,
          VersionId: version,
        }),
      )) as HeadObjectCommandOutput;
      const declaredByteCount = Number(head.Metadata?.['one-time-declared-bytes']);
      if (
        head.VersionId === version &&
        head.Metadata?.['one-time-upload-session'] === sessionDigest &&
        Number.isSafeInteger(declaredByteCount) &&
        declaredByteCount >= 0 &&
        head.ContentLength === declaredByteCount &&
        head.ServerSideEncryption === 'aws:kms' &&
        head.SSEKMSKeyId === this.config.kmsKeyVersionRef
      ) {
        candidates.push(version);
      }
    }
    if (candidates.length === 0) {
      throw new Error('content_s3_completion_acceptance_unknown');
    }
    if (candidates.length !== 1) {
      throw new Error('content_s3_completed_version_reconciliation_ambiguous');
    }
    return this.readCompletedVersion(input, candidates[0]!);
  }

  private async readCompletedVersion(
    input: {
      uploadSessionId: string;
      opaqueObjectKey: string;
      fullSha256?: string;
      orderedProviderPartRefDigests: readonly string[];
    },
    versionId: string,
  ): Promise<S3CompletedOriginal> {
    const head = (await this.sendS3(
      new HeadObjectCommand({
        Bucket: this.config.bucketRef,
        Key: input.opaqueObjectKey,
        VersionId: versionId,
        ChecksumMode: 'ENABLED',
      }),
    )) as HeadObjectCommandOutput;
    if (head.VersionId !== versionId) {
      throw new Error('content_s3_original_version_readback_mismatch');
    }
    const object = (await this.sendS3(
      new GetObjectCommand({
        Bucket: this.config.bucketRef,
        Key: input.opaqueObjectKey,
        VersionId: versionId,
      }),
    )) as GetObjectCommandOutput;
    const fullByteReadback = await hashExactBody(object.Body, head.ContentLength);
    const sha256 = fullByteReadback.sha256;
    if (
      !sha256 ||
      (input.fullSha256 !== undefined && sha256 !== input.fullSha256) ||
      head.ServerSideEncryption !== 'aws:kms' ||
      head.SSEKMSKeyId !== this.config.kmsKeyVersionRef ||
      head.ContentLength === undefined ||
      head.Metadata?.['one-time-upload-session'] !==
        protectedProviderReferenceDigest(input.uploadSessionId) ||
      Number(head.Metadata?.['one-time-declared-bytes']) !== head.ContentLength
    ) {
      throw new Error('content_s3_original_readback_mismatch');
    }
    const now = this.clock().toISOString();
    const objectKeyDigest = protectedProviderReferenceDigest(input.opaqueObjectKey);
    const readback = {
      runtimeTier: this.config.runtimeTier,
      verificationEnvironmentId: this.config.verificationEnvironmentId,
      region: CONTENT_INGEST_REGION,
      bucketRef: this.config.bucketRef,
      objectKeyDigest,
      objectVersionId: versionId,
      byteCount: head.ContentLength,
      durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1' as const,
      checksumAlgorithm: 'sha256' as const,
      sha256,
      kmsKeyVersionRef: this.config.kmsKeyVersionRef,
      storageClass: head.StorageClass ?? 'STANDARD',
      blockPublicAccess: true as const,
      bucketOwnerEnforced: true as const,
    };
    return {
      readback,
      journalReceipt: {
        receiptId: `s3_readback_${protectedProviderReferenceDigest(
          `${input.uploadSessionId}\0${versionId}\0${sha256}`,
        ).slice(0, 32)}`,
        uploadSessionId: input.uploadSessionId,
        runtimeTier: this.config.runtimeTier,
        verificationEnvironmentId: this.config.verificationEnvironmentId,
        durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
        bucketRef: this.config.bucketRef,
        objectKeyDigest,
        objectVersionId: versionId,
        byteCount: head.ContentLength,
        checksumAlgorithm: 'sha256',
        sha256,
        kmsKeyVersionRef: this.config.kmsKeyVersionRef,
        storageClass: head.StorageClass ?? 'STANDARD',
        writtenAt: head.LastModified?.toISOString() ?? now,
        readBackAt: now,
      },
    };
  }

  private async listExactObjectVersions(opaqueObjectKey: string) {
    const result = (await this.sendS3(
      new ListObjectVersionsCommand({
        Bucket: this.config.bucketRef,
        Prefix: opaqueObjectKey,
        MaxKeys: 8,
      }),
    )) as ListObjectVersionsCommandOutput;
    if (result.IsTruncated) {
      throw new Error('content_s3_completed_version_scan_unbounded');
    }
    return (result.Versions ?? [])
      .filter((version) => version.Key === opaqueObjectKey && Boolean(version.VersionId))
      .map((version) => version.VersionId!);
  }

  async abortMultipart(input: { uploadSessionId: string; opaqueObjectKey: string }) {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const upload = await this.requireSingleOpen(input.opaqueObjectKey);
    await this.sendS3(
      new AbortMultipartUploadCommand({
        Bucket: this.config.bucketRef,
        Key: input.opaqueObjectKey,
        UploadId: upload.UploadId,
      }),
    );
  }

  async putStreamPart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    partNumber: number;
    byteCount: number;
    body: AsyncIterable<Uint8Array>;
  }) {
    assertBinding(input.uploadSessionId, input.opaqueObjectKey);
    await this.readIdentity();
    const upload = await this.requireSingleOpen(input.opaqueObjectKey);
    const result = (await this.sendS3(
      new UploadPartCommand({
        Bucket: this.config.bucketRef,
        Key: input.opaqueObjectKey,
        UploadId: upload.UploadId,
        PartNumber: input.partNumber,
        ContentLength: input.byteCount,
        Body: Readable.from(input.body),
      }),
    )) as UploadPartCommandOutput;
    const etag = normalizeEtag(result.ETag);
    if (!etag) throw new Error('content_s3_part_readback_missing');
    return { providerPartRefDigest: protectedProviderReferenceDigest(etag) };
  }

  private async requireSingleOpen(opaqueObjectKey: string) {
    const uploads = await this.listExactOpenUploads(opaqueObjectKey);
    if (uploads.length === 0) throw new Error('content_s3_multipart_missing');
    if (uploads.length !== 1) {
      throw new Error('content_s3_duplicate_multipart_reconciliation_required');
    }
    return uploads[0]!;
  }

  private async listExactOpenUploads(opaqueObjectKey: string) {
    const matches: MultipartUpload[] = [];
    let keyMarker: string | undefined;
    let uploadIdMarker: string | undefined;
    for (let page = 0; page < 8; page += 1) {
      const result = (await this.sendS3(
        new ListMultipartUploadsCommand({
          Bucket: this.config.bucketRef,
          Prefix: opaqueObjectKey,
          ...(keyMarker ? { KeyMarker: keyMarker } : {}),
          ...(uploadIdMarker ? { UploadIdMarker: uploadIdMarker } : {}),
        }),
      )) as ListMultipartUploadsCommandOutput;
      matches.push(
        ...(result.Uploads ?? []).filter(
          (upload) => upload.Key === opaqueObjectKey && Boolean(upload.UploadId),
        ),
      );
      if (!result.IsTruncated) return matches;
      keyMarker = result.NextKeyMarker;
      uploadIdMarker = result.NextUploadIdMarker;
      if (!keyMarker || !uploadIdMarker) break;
    }
    throw new Error('content_s3_multipart_scan_unbounded');
  }

  private async listAllParts(opaqueObjectKey: string, uploadId: string) {
    const parts: Part[] = [];
    let marker: string | undefined;
    for (let page = 0; page < 64; page += 1) {
      const result = (await this.sendS3(
        new ListPartsCommand({
          Bucket: this.config.bucketRef,
          Key: opaqueObjectKey,
          UploadId: uploadId,
          ...(marker ? { PartNumberMarker: marker } : {}),
        }),
      )) as ListPartsCommandOutput;
      parts.push(...(result.Parts ?? []));
      if (!result.IsTruncated) return parts;
      marker = result.NextPartNumberMarker;
      if (!marker) break;
    }
    throw new Error('content_s3_part_scan_unbounded');
  }

  private sendS3<T>(command: T): Promise<unknown> {
    return withAbortTimeout(
      (signal) => this.s3.send(command as never, { abortSignal: signal }) as never,
      this.config.timeoutMs,
    );
  }

  private sendSts<T>(command: T): Promise<unknown> {
    return withAbortTimeout(
      (signal) => this.sts.send(command as never, { abortSignal: signal }) as never,
      this.config.timeoutMs,
    );
  }
}

function multipartReadback(
  uploads: readonly MultipartUpload[],
  success: 'created' | 'recovered',
): ManagedMultipartBeginReadback | null {
  if (uploads.length === 0) return null;
  const digests = uploads
    .map((upload) => protectedProviderReferenceDigest(upload.UploadId!))
    .sort();
  return uploads.length === 1
    ? { disposition: success, providerUploadIdDigest: digests[0]!, openUploadCount: 1 }
    : {
        disposition: 'duplicate',
        providerUploadIdDigests: digests,
        openUploadCount: uploads.length,
      };
}

function assertBinding(uploadSessionId: string, opaqueObjectKey: string) {
  if (
    !/^(?:upload|drive_transfer)_[a-f0-9]{32}$/u.test(uploadSessionId) ||
    !/^source_[a-f0-9]{32}$/u.test(opaqueObjectKey)
  ) {
    throw new Error('content_s3_exact_object_binding_invalid');
  }
}

function normalizeEtag(value: string | undefined) {
  return value?.trim().replace(/^"|"$/gu, '') ?? '';
}

function digestRequired(value: string | undefined) {
  if (!value) throw new Error('content_s3_live_identity_unavailable');
  return createHash('sha256').update(value).digest('hex');
}

async function hashExactBody(body: unknown, expectedByteCount: number | undefined) {
  if (
    expectedByteCount === undefined ||
    !body ||
    typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== 'function'
  ) {
    throw new Error('content_s3_full_byte_readback_unavailable');
  }
  const hash = createHash('sha256');
  let byteCount = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    if (!(chunk instanceof Uint8Array)) {
      throw new Error('content_s3_full_byte_readback_invalid');
    }
    byteCount += chunk.byteLength;
    if (byteCount > expectedByteCount) {
      throw new Error('content_s3_full_byte_readback_invalid');
    }
    hash.update(chunk);
  }
  if (byteCount !== expectedByteCount) {
    throw new Error('content_s3_full_byte_readback_invalid');
  }
  return { byteCount, sha256: hash.digest('hex') };
}

function sameStrings(actual: readonly string[] | undefined, expected: readonly string[]) {
  return JSON.stringify(actual ?? []) === JSON.stringify(expected);
}

async function withAbortTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
