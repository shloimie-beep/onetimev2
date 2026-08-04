import { createHash } from 'node:crypto';

import {
  CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
  CONTENT_INGEST_PART_BYTES,
  CONTENT_INGEST_REGION,
  type ManagedMultipartBeginReadback,
  type ManagedMultipartUploadBinding,
  type ManagedObjectReadback,
  type RecoveryJournalReceipt,
} from '../../../../contracts/src/content/ingest/index.ts';

export const S3_CONTENT_ORIGINAL_REGISTRY_KEY = 's3_content_original_primary' as const;

export type S3ManagedOriginalIdentityReadback = {
  registryBindingKey: typeof S3_CONTENT_ORIGINAL_REGISTRY_KEY;
  providerAccountRefHash: string;
  principalArnHash: string;
  region: typeof CONTENT_INGEST_REGION;
  bucketRef: string;
  kmsKeyVersionRef: string;
  versioningEnabled: true;
  blockPublicAccess: true;
  bucketOwnerEnforced: true;
  browserCredentialsExposed: false;
  corsAllowedOrigins: readonly string[];
  corsAllowedMethods: readonly ['PUT'];
  corsAllowedHeaders: readonly ['content-length', 'x-amz-checksum-sha256'];
  corsExposedHeaders: readonly ['ETag'];
  observedAt: string;
};

export type S3CompletedOriginal = {
  readback: ManagedObjectReadback;
  journalReceipt: RecoveryJournalReceipt;
};

export interface S3ManagedOriginalClient {
  readIdentity(): Promise<S3ManagedOriginalIdentityReadback>;
  beginReconciledMultipart?(
    input: ManagedMultipartUploadBinding & {
      byteCount: number;
      mimeType: string;
      checksumAlgorithm: 'sha256';
    },
  ): Promise<ManagedMultipartBeginReadback>;
  /** @deprecated Compatibility-only shape; executable composition never invokes it. */
  createMultipart?(
    input: ManagedMultipartUploadBinding & {
      byteCount: number;
      mimeType: string;
      checksumAlgorithm: 'sha256';
    },
  ): Promise<{ providerUploadIdDigest: string }>;
  authorizePart(
    input: ManagedMultipartUploadBinding & {
      partNumber: number;
      byteCount: number;
      partSha256: string;
      expiresInSeconds: number;
    },
  ): Promise<{ uploadUrl: string; requiredHeaders: Readonly<Record<string, string>> }>;
  recordCompletedPart(
    input: ManagedMultipartUploadBinding & {
      partNumber: number;
      byteCount: number;
      partSha256: string;
      providerPartRef: string;
    },
  ): Promise<{ providerPartRefDigest: string }>;
  completeAndReadBack(
    input: ManagedMultipartUploadBinding & {
      fullSha256?: string;
      orderedProviderPartRefDigests: readonly string[];
    },
  ): Promise<S3CompletedOriginal>;
  abortMultipart(input: ManagedMultipartUploadBinding): Promise<void>;
  putStreamPart(
    input: ManagedMultipartUploadBinding & {
      partNumber: number;
      byteCount: number;
      body: AsyncIterable<Uint8Array>;
    },
  ): Promise<{ providerPartRefDigest: string }>;
}

type InjectedS3ManagedOriginalClient = Omit<S3ManagedOriginalClient, 'readIdentity'> & {
  readIdentity(): Promise<
    | S3ManagedOriginalIdentityReadback
    | Omit<S3ManagedOriginalIdentityReadback, 'corsAllowedHeaders'>
  >;
};

export type AwsS3ManagedOriginalAdapterConfig = {
  enabled: boolean;
  region: string | undefined;
  bucketRef: string | undefined;
  kmsKeyVersionRef: string | undefined;
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING';
  browserOrigin: string;
  accountKey?: string | undefined;
  productKey?: string | undefined;
};

/**
 * Fail-closed infrastructure seam for the versioned managed original.
 * The concrete AWS client is injected only by separately authorized runtime composition.
 */
export class AwsS3ManagedOriginalAdapter {
  constructor(
    private readonly config: AwsS3ManagedOriginalAdapterConfig,
    private readonly client: InjectedS3ManagedOriginalClient | null,
  ) {}

  async readCanonicalIdentity() {
    const client = this.requireClient();
    const identity = await client.readIdentity();
    if (
      identity.registryBindingKey !== S3_CONTENT_ORIGINAL_REGISTRY_KEY ||
      identity.region !== CONTENT_INGEST_REGION ||
      identity.region !== this.config.region ||
      identity.bucketRef !== this.config.bucketRef ||
      identity.kmsKeyVersionRef !== this.config.kmsKeyVersionRef ||
      !identity.versioningEnabled ||
      !identity.blockPublicAccess ||
      !identity.bucketOwnerEnforced ||
      identity.browserCredentialsExposed ||
      identity.corsAllowedOrigins.length !== 1 ||
      identity.corsAllowedOrigins[0] !== this.config.browserOrigin ||
      identity.corsAllowedMethods.length !== 1 ||
      identity.corsAllowedMethods[0] !== 'PUT' ||
      !('corsAllowedHeaders' in identity) ||
      identity.corsAllowedHeaders === undefined ||
      identity.corsAllowedHeaders.length !== 2 ||
      identity.corsAllowedHeaders[0] !== 'content-length' ||
      identity.corsAllowedHeaders[1] !== 'x-amz-checksum-sha256' ||
      identity.corsExposedHeaders.length !== 1 ||
      identity.corsExposedHeaders[0] !== 'ETag' ||
      !sha256(identity.providerAccountRefHash) ||
      !sha256(identity.principalArnHash)
    ) {
      throw new Error('content_s3_identity_readback_mismatch');
    }
    return identity;
  }

  async beginDirectUpload(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    byteCount: number;
    mimeType: string;
  }) {
    await this.readCanonicalIdentity();
    const client = this.requireClient();
    if (!client.beginReconciledMultipart) {
      throw new Error('content_s3_reconciled_begin_unavailable');
    }
    const readback = await client.beginReconciledMultipart({
      ...input,
      checksumAlgorithm: 'sha256',
    });
    if (readback.disposition === 'duplicate') {
      throw new Error('content_s3_duplicate_multipart_reconciliation_required');
    }
    return readback;
  }

  async authorizePart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    partNumber: number;
    byteCount: number;
    partSha256: string;
  }) {
    if (!Number.isInteger(input.partNumber) || input.partNumber < 1) {
      throw new Error('content_s3_part_number_invalid');
    }
    if (input.byteCount < 1 || input.byteCount > CONTENT_INGEST_PART_BYTES) {
      throw new Error('content_s3_part_size_invalid');
    }
    if (!sha256(input.partSha256)) throw new Error('content_s3_part_checksum_invalid');
    await this.readCanonicalIdentity();
    return this.requireClient().authorizePart({
      ...input,
      expiresInSeconds: CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
    });
  }

  async recordCompletedPart(input: {
    uploadSessionId: string;
    opaqueObjectKey: string;
    partNumber: number;
    byteCount: number;
    partSha256: string;
    providerPartRef: string;
  }) {
    if (!input.providerPartRef.trim()) throw new Error('content_s3_part_readback_missing');
    await this.readCanonicalIdentity();
    return this.requireClient().recordCompletedPart(input);
  }

  async completeAndReadBack(input: {
    uploadSessionId: string;
    opaqueObjectKey?: string;
    fullSha256?: string;
    orderedProviderPartRefDigests: readonly string[];
  }): Promise<S3CompletedOriginal> {
    if (input.fullSha256 !== undefined && !sha256(input.fullSha256)) {
      throw new Error('content_s3_full_checksum_invalid');
    }
    if (
      input.orderedProviderPartRefDigests.length < 1 ||
      input.orderedProviderPartRefDigests.some((digest) => !sha256(digest))
    ) {
      throw new Error('content_s3_part_readback_invalid');
    }
    await this.readCanonicalIdentity();
    const client = this.requireClient();
    const opaqueObjectKey =
      input.opaqueObjectKey ??
      (client.beginReconciledMultipart
        ? (() => {
            throw new Error('content_s3_exact_object_binding_invalid');
          })()
        : stableKey('source', [input.uploadSessionId]));
    const completed = await client.completeAndReadBack({ ...input, opaqueObjectKey });
    assertCompletedOriginal(completed, this.config, input.fullSha256);
    return completed;
  }

  async abortMultipart(input: ManagedMultipartUploadBinding) {
    await this.readCanonicalIdentity();
    return this.requireClient().abortMultipart(input);
  }

  async beginDriveTransfer(input: {
    transferId: string;
    opaqueObjectKey: string;
    byteCount: number;
  }) {
    if (input.opaqueObjectKey !== this.driveObjectKey(input.transferId)) {
      throw new Error('content_s3_drive_object_binding_mismatch');
    }
    await this.beginDirectUpload({
      uploadSessionId: input.transferId,
      opaqueObjectKey: input.opaqueObjectKey,
      byteCount: input.byteCount,
      mimeType: 'application/octet-stream',
    });
  }

  async putPart(input: {
    transferId: string;
    partNumber: number;
    byteCount: number;
    body: AsyncIterable<Uint8Array>;
  }) {
    await this.readCanonicalIdentity();
    return this.requireClient().putStreamPart({
      uploadSessionId: input.transferId,
      opaqueObjectKey: this.driveObjectKey(input.transferId),
      partNumber: input.partNumber,
      byteCount: input.byteCount,
      body: input.body,
    });
  }

  private requireClient() {
    if (!this.config.enabled || !this.client) throw new Error('content_media_default_off');
    if (
      this.config.region !== CONTENT_INGEST_REGION ||
      !this.config.bucketRef ||
      !this.config.kmsKeyVersionRef
    ) {
      throw new Error('content_s3_configuration_incomplete');
    }
    return this.client;
  }

  private driveObjectKey(transferId: string) {
    if (!this.config.accountKey || !this.config.productKey) {
      throw new Error('content_s3_drive_scope_unavailable');
    }
    return stableKey('source', [this.config.accountKey, this.config.productKey, transferId]);
  }
}

function assertCompletedOriginal(
  completed: S3CompletedOriginal,
  config: AwsS3ManagedOriginalAdapterConfig,
  fullSha256: string | undefined,
) {
  const { readback, journalReceipt } = completed;
  if (
    readback.region !== CONTENT_INGEST_REGION ||
    readback.bucketRef !== config.bucketRef ||
    readback.kmsKeyVersionRef !== config.kmsKeyVersionRef ||
    (fullSha256 !== undefined && readback.sha256 !== fullSha256) ||
    !sha256(readback.sha256) ||
    readback.durabilityEvidenceVersion !== 'OT-MANAGED-ORIGINAL-1' ||
    readback.checksumAlgorithm !== 'sha256' ||
    readback.storageClass !== config.storageClass ||
    !readback.blockPublicAccess ||
    !readback.bucketOwnerEnforced ||
    journalReceipt.durabilityEvidenceVersion !== readback.durabilityEvidenceVersion ||
    journalReceipt.bucketRef !== readback.bucketRef ||
    journalReceipt.objectKeyDigest !== readback.objectKeyDigest ||
    journalReceipt.objectVersionId !== readback.objectVersionId ||
    journalReceipt.byteCount !== readback.byteCount ||
    journalReceipt.sha256 !== readback.sha256 ||
    journalReceipt.kmsKeyVersionRef !== readback.kmsKeyVersionRef ||
    journalReceipt.storageClass !== readback.storageClass
  ) {
    throw new Error('content_s3_original_readback_mismatch');
  }
}

function sha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}

export function protectedProviderReferenceDigest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stableKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32)}`;
}
