import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STSClient } from '@aws-sdk/client-sts';

import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import type {
  ContentProcessingSource,
  DerivativeReadback,
} from '../../../../../packages/contracts/src/content/processing/index.ts';
import type {
  ContentPublicationRepository,
  ContentPublicationWorkerRepository,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import {
  JOB_LEASE_DURATION_MS,
  type JobFoundationRepository,
  type ProviderJobRecord,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderOperation,
  ProviderRegistryBindingReadPort,
  ProviderRegistryBindingReadRequest,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { processingSha256 } from '../../../../../packages/domain/src/content/processing/index.ts';
import {
  AwsS3ManagedOriginalClient,
  S3_CONTENT_ORIGINAL_REGISTRY_KEY,
} from '../../../../../packages/db/src/content/ingest/index.ts';
import { createContentIngestRepository } from '../../../../../packages/db/src/content/ingest/repository.ts';
import { createContentProcessingRepository } from '../../../../../packages/db/src/content/processing/repository.ts';
import { createPostgresContentPublicationRepository } from '../../../../../packages/db/src/content/publication/repository.ts';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import { createPostgresJobFoundationRepository } from '../../../../../packages/db/src/jobs/repository.ts';
import { createPostgresProviderCoreRepository } from '../../../../../packages/db/src/providers/v21-provider-core-repository.ts';
import { GoogleDriveContentIngestAdapter } from '../content-ingest/google-drive-adapter.ts';
import {
  GoogleDriveHttpClient,
  createGoogleServiceAccountTokenProvider,
} from '../content-ingest/google-drive-http-client.ts';
import { FfmpegOpenAiContentProcessingAdapter } from '../content-processing/ffmpeg-openai-adapter.ts';
import {
  ExecutableFfmpegOpenAiClient,
  NodeBoundedProcessRunner,
  type ContentProcessingMediaStore,
} from '../content-processing/ffmpeg-openai-client.ts';
import type { ProcessContentCommand } from '../content-processing/runner.ts';
import { VimeoPrivatePublicationAdapter } from '../content-publication/vimeo-private-adapter.ts';
import {
  VimeoPrivateHttpClient,
  type VimeoPrivateUploadSource,
} from '../content-publication/vimeo-http-client.ts';
import type { ContentMediaWorkerRuntime } from '../registry/index.ts';

export type ContentMediaRuntimeDependencies = {
  registry?: ProviderRegistryBindingReadPort | undefined;
  s3?: S3Client | undefined;
  sts?: STSClient | undefined;
  fetchImpl?: typeof fetch | undefined;
};

export function createContentMediaWorkerRuntime(input: {
  config: AppConfig;
  pool: DbPool;
  source: NodeJS.ProcessEnv;
  dependencies?: ContentMediaRuntimeDependencies | undefined;
}): ContentMediaWorkerRuntime | undefined {
  if (!input.config.contentMediaProviderCanary) return undefined;
  assertProviderCanary(input.config);
  const registry = input.dependencies?.registry ?? createPostgresProviderCoreRepository(input.pool);
  const s3 = input.dependencies?.s3 ?? new S3Client({ region: 'eu-central-1' });
  const sts = input.dependencies?.sts ?? new STSClient({ region: 'eu-central-1' });
  const fetchImpl = input.dependencies?.fetchImpl ?? fetch;
  const scope = {
    product: 'one_time_mishnayos' as const,
    runtime_tier: 'production' as const,
    verification_environment_id: 'production_operator_canary' as const,
  };
  const s3Proof = providerProof(input.source, 'CONTENT_S3');
  const s3Registry = registryGuard(registry, {
    registry_binding_key: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
    provider: 's3',
    scope,
    operation_type: 'multipart_original_write',
    effect_kind: 'mutation',
    ...s3Proof,
  });
  const s3Identity = new AwsS3ManagedOriginalClient(
    {
      region: 'eu-central-1',
      bucketRef: required(input.config.contentS3Bucket, 'content_s3_bucket_missing'),
      kmsKeyVersionRef: required(input.config.contentS3KmsKeyArn, 'content_s3_kms_binding_missing'),
      storageClass: input.config.contentS3StorageClass,
      browserOrigin: new URL(input.config.publicBaseUrl).origin,
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_operator_canary',
      timeoutMs: 15_000,
    },
    s3,
    sts,
    s3Registry,
  );
  const mediaStore = new AwsProcessingMediaStore({
    config: input.config,
    pool: input.pool,
    s3,
    registry,
    registryProof: s3Proof,
    identity: s3Identity,
  });

  const runtime: ContentMediaWorkerRuntime = {};
  if (input.config.contentDriveConfigured && input.config.contentDriveFolderId) {
    const driveProof = providerProof(input.source, 'CONTENT_DRIVE');
    const token = createGoogleServiceAccountTokenProvider({
      serviceAccountJson: required(
        input.config.contentDriveServiceAccountJson,
        'content_drive_service_account_missing',
      ),
      timeoutMs: 15_000,
      fetchImpl,
    });
    const driveClient = new GoogleDriveHttpClient(
      {
        folderId: input.config.contentDriveFolderId,
        serviceAccountEmail: token.serviceAccountEmail,
        timeoutMs: 15_000,
      },
      token.accessToken,
      registryGuard(registry, {
        registry_binding_key: 'google_drive_content_ingest_optional',
        provider: 'drive',
        scope,
        operation_type: 'drive_exact_folder_read',
        effect_kind: 'readback',
        ...driveProof,
      }),
      fetchImpl,
    );
    runtime.ingest = {
      repository: createContentIngestRepository(input.pool),
      driveProvider: new GoogleDriveContentIngestAdapter(
        true,
        input.config.contentDriveFolderId,
        driveClient,
      ),
    };
  }

  const openAiProof = providerProof(input.source, 'CONTENT_OPENAI');
  const processingClient = new ExecutableFfmpegOpenAiClient(
    {
      ffmpegPath: required(input.config.contentFfmpegPath, 'content_ffmpeg_path_missing'),
      ffprobePath: required(input.config.contentFfprobePath, 'content_ffprobe_path_missing'),
      openAiApiKey: required(input.config.contentOpenAiApiKey, 'content_openai_key_missing'),
      openAiProjectId: required(
        input.config.contentOpenAiProjectId,
        'content_openai_project_missing',
      ),
      ...(input.config.contentOpenAiOrganizationId
        ? { openAiOrganizationId: input.config.contentOpenAiOrganizationId }
        : {}),
      timeoutMs: 120_000,
    },
    registryGuard(registry, {
      registry_binding_key: 'openai_content_processing_primary',
      provider: 'openai',
      scope,
      operation_type: 'transcribe_and_generate_learning_draft',
      effect_kind: 'mutation',
      ...openAiProof,
    }),
    mediaStore,
    new NodeBoundedProcessRunner(),
    fetchImpl,
  );
  mediaStore.bindDerivativeVerifier((filePath, versionId) =>
    processingClient.measureDerivativeFile(filePath, versionId),
  );
  runtime.processing = {
    repository: createContentProcessingRepository(input.pool),
    provider: new FfmpegOpenAiContentProcessingAdapter(
      true,
      digest(required(input.config.contentOpenAiProjectId, 'content_openai_project_missing')),
      processingClient,
    ),
    nextCommand: () =>
      selectExactCanaryProcessingCommand({
        config: input.config,
        source: input.source,
        pool: input.pool,
        client: processingClient,
      }),
  };

  const vimeoProof = providerProof(input.source, 'CONTENT_VIMEO');
  const vimeoBinding = {
    registry_binding_key: 'vimeo_publication_primary',
    provider: 'vimeo' as const,
    scope,
    provider_account_ref_hash: vimeoProof.expected_provider_account_ref_hash,
    allowed_operation_types: ['publish_private', 'revoke_private'] as const,
    mutation_policy: 'allowed' as const,
    active: true,
  };
  const vimeoClient = new VimeoPrivateHttpClient(
    {
      accessToken: required(
        input.config.contentVimeoAccessToken,
        'content_vimeo_credential_missing',
      ),
      expectedAccountId: required(
        input.config.contentVimeoAccountId,
        'content_vimeo_account_binding_missing',
      ),
      expectedProviderAccountRefHash: vimeoProof.expected_provider_account_ref_hash,
      timeoutMs: 30_000,
    },
    mediaStore,
    fetchImpl,
  );
  const vimeoAdapter = new VimeoPrivatePublicationAdapter(
    true,
    vimeoProof.expected_provider_account_ref_hash,
    vimeoClient,
  );
  const publicationRepository = createPostgresContentPublicationRepository(input.pool);
  const canaryRepositories = createCanaryBoundPublicationRepositories({
    pool: input.pool,
    canaryId: required(input.config.contentMediaCanaryId, 'content_media_canary_missing'),
    jobRepository: createPostgresJobFoundationRepository(input.pool),
    publicationRepository,
  });
  const providerRepository = createPostgresProviderCoreRepository(input.pool);
  runtime.publication = {
    jobRepository: canaryRepositories.jobRepository,
    publicationRepository: canaryRepositories.publicationRepository,
    approvedProjectionRepository: createContentProcessingRepository(input.pool),
    providerRepository,
    registry,
    authority: {
      getPreapprovedRequest: async (selector) => ({
        registry_binding_key: 'vimeo_publication_primary',
        provider: 'vimeo',
        scope: selector.scope,
        operation_type: selector.operation_type,
        effect_kind: selector.effect_kind,
        ...vimeoProof,
      }),
    },
    vimeoBinding,
    dispatchAdapter: vimeoAdapter,
    reconciliationAdapter: vimeoAdapter.reconciliationAdapter(),
    finalizationReadbackAdapter: vimeoAdapter,
    createId: () => `media_${randomUUID()}`,
    options: { scope, batchSize: 1, dispatchTimeoutMs: 30_000, reconciliationTimeoutMs: 30_000 },
  };
  return runtime;
}

export function createCanaryBoundPublicationRepositories(input: {
  pool: DbPool;
  canaryId: string;
  jobRepository: JobFoundationRepository;
  publicationRepository: ContentPublicationRepository & ContentPublicationWorkerRepository;
}) {
  if (!input.canaryId.trim()) throw new Error('content_media_canary_missing');
  const jobRepository: JobFoundationRepository = {
    async claimDueJobs(claim) {
      const result = await input.pool.query(
        `WITH candidate AS (
           SELECT job.job_id
             FROM onetime.job_outbox AS job
             JOIN onetime.content_publication_outbox AS publication
               ON publication.provider_operation_id = job.job_id
             JOIN onetime.provider_operation_binding AS binding
               ON binding.job_id = job.job_id
            WHERE job.product = $1
              AND job.runtime_tier = $2
              AND job.verification_environment_id = $3
              AND job.aggregate_ref = $4
              AND job.provider = 'vimeo'
              AND job.operation_type = ANY($5::text[])
              AND job.state IN ('not_started', 'retry_wait')
              AND job.unknown_effect = false
              AND job.dispatch_attempts < 8
              AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= $6::timestamptz)
              AND publication.product_key = job.product
              AND publication.provider = 'vimeo'
              AND publication.provider = job.provider
              AND publication.operation = job.operation_type
              AND publication.content_id = job.aggregate_ref
              AND publication.content_version_id = job.payload_ref
              AND publication.publication_generation = job.source_version
              AND publication.request_hash = job.canonical_request_hash
              AND publication.state = 'pending'
              AND binding.registry_binding_key = 'vimeo_publication_primary'
              AND binding.effect_kind = 'mutation'
            ORDER BY COALESCE(job.next_attempt_at, job.created_at), job.created_at, job.job_id
            LIMIT $7
            FOR UPDATE OF job SKIP LOCKED
         )
         UPDATE onetime.job_outbox AS job
            SET state = 'leased',
                version = job.version + 1,
                lease_owner = $8,
                lease_generation = job.lease_generation + 1,
                lease_expires_at = $6::timestamptz + make_interval(secs => $9),
                last_heartbeat_at = $6::timestamptz,
                next_attempt_at = NULL,
                updated_at = $6::timestamptz
           FROM candidate
          WHERE job.job_id = candidate.job_id
          RETURNING job.*`,
        [
          claim.scope.product,
          claim.scope.runtime_tier,
          claim.scope.verification_environment_id,
          input.canaryId,
          claim.operation_types,
          claim.now.toISOString(),
          Math.min(claim.limit, 1),
          claim.owner,
          JOB_LEASE_DURATION_MS / 1_000,
        ],
      );
      const claimed = result.rows.map(mapProviderJobRow);
      if (claimed.some((job) => job.aggregate_ref !== input.canaryId)) {
        throw new Error('content_publication_canary_claim_mismatch');
      }
      return claimed;
    },
    heartbeat: (lease, now) => input.jobRepository.heartbeat(lease, now),
    markInFlight: (lease, expectedVersion, now) =>
      input.jobRepository.markInFlight(lease, expectedVersion, now),
    recordDispatchOutcome: (record) => input.jobRepository.recordDispatchOutcome(record),
  };
  const publicationRepository: ContentPublicationRepository & ContentPublicationWorkerRepository = {
    inTransaction: (work) => input.publicationRepository.inTransaction(work),
    async reopenDispatchContext(job) {
      if (job.aggregate_ref !== input.canaryId) return null;
      const context = await input.publicationRepository.reopenDispatchContext(job);
      if (context && context.operation.aggregate_ref !== input.canaryId) {
        throw new Error('content_publication_canary_dispatch_context_mismatch');
      }
      return context;
    },
    async listAcceptanceUnknownOperations(scope, limit) {
      const result = await input.pool.query(
        `SELECT job.*, binding.registry_binding_key,
                binding.provider_account_ref_hash,
                binding.effect_kind, binding.household_id
           FROM onetime.job_outbox AS job
           JOIN onetime.content_publication_outbox AS publication
             ON publication.provider_operation_id = job.job_id
           JOIN onetime.provider_operation_binding AS binding
             ON binding.job_id = job.job_id
          WHERE job.product = $1
            AND job.runtime_tier = $2
            AND job.verification_environment_id = $3
            AND job.aggregate_ref = $4
            AND publication.content_id = $4
            AND job.provider = 'vimeo'
            AND job.operation_type IN ('publish_private', 'revoke_private')
            AND job.state = 'acceptance_unknown'
            AND job.unknown_effect = TRUE
            AND publication.product_key = job.product
            AND publication.provider = job.provider
            AND publication.operation = job.operation_type
            AND publication.content_id = job.aggregate_ref
            AND publication.content_version_id = job.payload_ref
            AND publication.publication_generation = job.source_version
            AND publication.request_hash = job.canonical_request_hash
            AND publication.state = 'pending'
            AND binding.registry_binding_key = 'vimeo_publication_primary'
            AND binding.effect_kind = 'mutation'
          ORDER BY job.updated_at, job.job_id
          LIMIT $5`,
        [
          scope.product,
          scope.runtime_tier,
          scope.verification_environment_id,
          input.canaryId,
          Math.min(limit, 1),
        ],
      );
      return result.rows.map(mapProviderOperationRow);
    },
    async listAcceptedPendingWork(scope, limit) {
      const result = await input.pool.query(
        `SELECT publication.account_key, publication.content_id,
                publication.provider_operation_id, publication.operation,
                job.version AS provider_operation_version,
                publication.intent_id, content.version AS content_record_version
           FROM onetime.content_publication_outbox AS publication
           JOIN onetime.job_outbox AS job
             ON job.job_id = publication.provider_operation_id
           JOIN onetime.provider_operation_binding AS binding
             ON binding.job_id = job.job_id
           JOIN onetime.content_publications AS content
             ON content.account_key = publication.account_key
            AND content.product_key = publication.product_key
            AND content.content_id = publication.content_id
            AND content.content_version_id = publication.content_version_id
            AND content.publication_generation = publication.publication_generation
            AND content.pending_provider_operation_id = publication.provider_operation_id
          WHERE job.product = $1
            AND job.runtime_tier = $2
            AND job.verification_environment_id = $3
            AND job.aggregate_ref = $4
            AND publication.content_id = $4
            AND job.provider = 'vimeo'
            AND job.operation_type IN ('publish_private', 'revoke_private')
            AND job.state = 'accepted'
            AND job.unknown_effect = FALSE
            AND publication.product_key = job.product
            AND publication.provider = job.provider
            AND publication.operation = job.operation_type
            AND publication.content_id = job.aggregate_ref
            AND publication.content_version_id = job.payload_ref
            AND publication.publication_generation = job.source_version
            AND publication.request_hash = job.canonical_request_hash
            AND publication.state = 'pending'
            AND binding.registry_binding_key = 'vimeo_publication_primary'
            AND binding.effect_kind = 'mutation'
          ORDER BY job.updated_at, job.job_id
          LIMIT $5`,
        [
          scope.product,
          scope.runtime_tier,
          scope.verification_environment_id,
          input.canaryId,
          Math.min(limit, 1),
        ],
      );
      return result.rows.map((row) => ({
        scope: { ...scope },
        accountKey: String(row.account_key),
        contentId: String(row.content_id),
        providerOperationId: String(row.provider_operation_id),
        operation: String(row.operation) as 'publish_private' | 'revoke_private',
        providerOperationVersion: Number(row.provider_operation_version),
        outboxIntentId: String(row.intent_id),
        contentRecordVersion: Number(row.content_record_version),
      }));
    },
  };
  return { jobRepository, publicationRepository };
}

export class AwsProcessingMediaStore
  implements ContentProcessingMediaStore, VimeoPrivateUploadSource
{
  private derivativeVerifier:
    ((filePath: string, versionId: string) => Promise<DerivativeReadback>) | undefined;

  constructor(
    private readonly input: {
      config: AppConfig;
      pool: DbPool;
      s3: S3Client;
      registry: ProviderRegistryBindingReadPort;
      registryProof: ReturnType<typeof providerProof>;
      identity: AwsS3ManagedOriginalClient;
      signPrivateGet?:
        ((client: S3Client, command: GetObjectCommand) => Promise<string>) | undefined;
    },
  ) {}

  bindDerivativeVerifier(
    verifier: (filePath: string, versionId: string) => Promise<DerivativeReadback>,
  ) {
    if (this.derivativeVerifier) {
      throw new Error('content_processing_derivative_verifier_already_bound');
    }
    this.derivativeVerifier = verifier;
  }

  async readDerivative(operationId: string) {
    await this.assertS3('managed_derivative_read', 'readback');
    const versions = await this.input.s3.send(
      new ListObjectVersionsCommand({
        Bucket: this.bucket,
        Prefix: derivativeKey(operationId),
        MaxKeys: 3,
      }),
    );
    if (versions.IsTruncated) {
      throw new Error('content_processing_derivative_version_scan_unbounded');
    }
    const exactVersions = (versions.Versions ?? []).filter(
      (version) => version.Key === derivativeKey(operationId) && Boolean(version.VersionId),
    );
    const exactDeleteMarkers = (versions.DeleteMarkers ?? []).filter(
      (marker) => marker.Key === derivativeKey(operationId),
    );
    if (exactVersions.length === 0 && exactDeleteMarkers.length === 0) return null;
    if (exactVersions.length !== 1 || exactDeleteMarkers.length !== 0) {
      throw new Error('content_processing_derivative_version_ambiguous');
    }
    return this.readDerivativeVersion(operationId, exactVersions[0]!.VersionId!);
  }

  async downloadSource(source: ContentProcessingSource, destinationPath: string) {
    await this.assertS3('managed_original_read', 'readback');
    const key = await this.exactOriginalKey(source);
    const object = await this.input.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        VersionId: source.objectVersionId,
      }),
    );
    if (object.VersionId !== source.objectVersionId) {
      throw new Error('content_processing_original_version_readback_mismatch');
    }
    if (!object.Body) throw new Error('content_processing_original_readback_unavailable');
    const body = Readable.from(object.Body as AsyncIterable<Uint8Array>);
    await pipeline(body, createWriteStream(destinationPath, { flags: 'wx' }));
    const file = await stat(destinationPath);
    if (file.size !== source.byteCount || (await fileSha256(destinationPath)) !== source.sha256) {
      throw new Error('content_processing_original_readback_mismatch');
    }
  }

  async uploadDerivative(input: {
    operationId: string;
    source: ContentProcessingSource;
    filePath: string;
    readback: DerivativeReadback;
  }) {
    await this.assertS3('managed_derivative_write', 'mutation');
    const file = await stat(input.filePath);
    if (file.size !== input.readback.byteCount) {
      throw new Error('content_processing_derivative_size_mismatch');
    }
    const prior = await this.readDerivative(input.operationId);
    if (prior) {
      if (prior.sha256 !== input.readback.sha256 || prior.byteCount !== input.readback.byteCount) {
        throw new Error('content_processing_derivative_existing_mismatch');
      }
      return prior;
    }
    let versionId: string | undefined;
    try {
      const put = await this.input.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: derivativeKey(input.operationId),
          IfNoneMatch: '*',
          Body: createReadStream(input.filePath),
          ContentLength: file.size,
          ContentType: 'video/mp4',
          ChecksumSHA256: Buffer.from(input.readback.sha256, 'hex').toString('base64'),
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.kms,
          StorageClass: this.input.config.contentS3StorageClass,
          Metadata: derivativeMetadata(input.operationId, input.readback),
        }),
      );
      versionId = put.VersionId;
    } catch {
      const recovered = await this.readDerivative(input.operationId);
      if (recovered) return recovered;
      throw new Error('content_processing_derivative_acceptance_unknown');
    }
    const persisted = versionId
      ? await this.readDerivativeVersion(input.operationId, versionId)
      : await this.readDerivative(input.operationId);
    if (
      !persisted ||
      persisted.sha256 !== input.readback.sha256 ||
      persisted.byteCount !== input.readback.byteCount
    ) {
      throw new Error('content_processing_derivative_readback_mismatch');
    }
    return persisted;
  }

  async createPrivatePullUrl(contentVersionId: string) {
    await this.assertS3('managed_derivative_read', 'readback');
    const result = await this.input.pool.query(
      `SELECT record_json
         FROM onetime.content_processing_versions
        WHERE account_key = $1
          AND product_key = $2
          AND content_version_key = $3
          AND processing_state = 'approved'
        LIMIT 2`,
      [this.input.config.accountKey, this.input.config.productKey, contentVersionId],
    );
    if (result.rows.length !== 1) {
      throw new Error('content_vimeo_derivative_binding_unavailable');
    }
    const version = parseJson<{ transcodePlan?: { command?: { args?: readonly string[] } } }>(
      result.rows[0]?.record_json,
    );
    const outputLocator = version?.transcodePlan?.command?.args?.at(-1);
    const operationId = outputLocator?.match(/^derivative_([a-f0-9]{64})$/u)?.[1];
    if (!operationId) throw new Error('content_vimeo_derivative_binding_invalid');
    const verified = await this.readDerivative(operationId);
    if (!verified) throw new Error('content_vimeo_derivative_readback_unavailable');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: derivativeKey(operationId),
      VersionId: verified.objectVersionId,
    });
    return this.input.signPrivateGet
      ? this.input.signPrivateGet(this.input.s3, command)
      : getSignedUrl(this.input.s3, command, { expiresIn: 900 });
  }

  private async readDerivativeVersion(operationId: string, versionId: string) {
    const verifier = this.derivativeVerifier;
    if (!verifier) throw new Error('content_processing_derivative_verifier_unavailable');
    const head = await this.input.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: derivativeKey(operationId),
        VersionId: versionId,
        ChecksumMode: 'ENABLED',
      }),
    );
    if (
      head.VersionId !== versionId ||
      head.ContentLength === undefined ||
      head.ServerSideEncryption !== 'aws:kms' ||
      head.SSEKMSKeyId !== this.kms ||
      (head.StorageClass ?? 'STANDARD') !== this.input.config.contentS3StorageClass ||
      head.Metadata?.['ot-operation-id'] !== operationId
    ) {
      throw new Error('content_processing_derivative_version_readback_mismatch');
    }
    const directory = await mkdtemp(path.join(tmpdir(), 'one-time-derivative-readback-'));
    const filePath = path.join(directory, 'derivative.mp4');
    try {
      const object = await this.input.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: derivativeKey(operationId),
          VersionId: versionId,
        }),
      );
      if (!object.Body || object.VersionId !== versionId) {
        throw new Error('content_processing_derivative_body_unavailable');
      }
      await pipeline(
        Readable.from(object.Body as AsyncIterable<Uint8Array>),
        createWriteStream(filePath, { flags: 'wx' }),
      );
      const measured = await verifier(filePath, versionId);
      if (
        measured.objectVersionId !== versionId ||
        measured.byteCount !== head.ContentLength ||
        measured.byteCount !== Number(head.Metadata?.['ot-byte-count']) ||
        measured.sha256 !== head.Metadata?.['ot-sha256'] ||
        head.ChecksumSHA256 !== Buffer.from(measured.sha256, 'hex').toString('base64')
      ) {
        throw new Error('content_processing_derivative_measured_readback_mismatch');
      }
      return measured;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async exactOriginalKey(source: ContentProcessingSource) {
    const result = await this.input.pool.query(
      `SELECT upload_row.record_json AS upload_json
         FROM onetime.content_source_links_v21 AS link_row
         JOIN onetime.content_ingest_upload_sessions AS upload_row
           ON upload_row.account_key = link_row.account_key
          AND upload_row.product_key = link_row.product_key
          AND upload_row.record_json->>'providerUploadIdDigest' = link_row.provenance_ref_digest
        WHERE link_row.account_key = $1
          AND link_row.product_key = $2
          AND link_row.source_key = $3
          AND link_row.source_kind = 'app_upload'
        LIMIT 2`,
      [source.accountKey, source.productKey, source.id],
    );
    const session = parseJson<{ opaqueObjectKey?: string }>(result.rows[0]?.upload_json);
    if (
      result.rows.length !== 1 ||
      !session?.opaqueObjectKey ||
      !/^source_[a-f0-9]{32}$/u.test(session.opaqueObjectKey) ||
      digest(session.opaqueObjectKey) !== source.objectKeyDigest
    ) {
      throw new Error('content_processing_original_key_binding_unavailable');
    }
    return session.opaqueObjectKey;
  }

  private async assertS3(operationType: string, effectKind: 'mutation' | 'readback') {
    const evidence = await this.input.registry.readActiveRegistryBinding({
      registry_binding_key: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
      provider: 's3',
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_operator_canary',
      },
      operation_type: operationType,
      effect_kind: effectKind,
      ...this.input.registryProof,
    });
    if (evidence === null) throw new Error('content_s3_registry_binding_unavailable');
    await this.input.identity.readIdentity();
  }

  private get bucket() {
    return required(this.input.config.contentS3Bucket, 'content_s3_bucket_missing');
  }

  private get kms() {
    return required(this.input.config.contentS3KmsKeyArn, 'content_s3_kms_binding_missing');
  }
}

async function selectExactCanaryProcessingCommand(input: {
  config: AppConfig;
  source: NodeJS.ProcessEnv;
  pool: DbPool;
  client: ExecutableFfmpegOpenAiClient;
}): Promise<ProcessContentCommand | null> {
  const canaryId = required(input.config.contentMediaCanaryId, 'content_media_canary_missing');
  const result = await input.pool.query(
    `SELECT record_json
       FROM onetime.content_sources_v21
      WHERE account_key = $1
        AND product_key = $2
        AND record_json->>'occurrenceId' = $3
        AND lifecycle_state IN ('received', 'processing')
      ORDER BY updated_at
      LIMIT 2`,
    [input.config.accountKey, input.config.productKey, canaryId],
  );
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error('content_processing_canary_selection_ambiguous');
  const source = parseJson<ContentProcessingSource>(result.rows[0]?.record_json);
  if (
    !source ||
    source.occurrenceId !== canaryId ||
    source.runtimeTier !== 'production' ||
    source.verificationEnvironmentId !== 'production_operator_canary'
  ) {
    throw new Error('content_processing_canary_binding_mismatch');
  }
  const principalId = required(
    source.recordingAdminId ?? source.matchedByAdminId,
    'content_processing_admin_binding_missing',
  );
  const probe = await input.client.probeSource(source);
  const occurredAt = new Date().toISOString();
  const requestHash = digest(`${source.sha256}\0${source.objectVersionId}\0${probe.durationMs}`);
  const contentVersionId = processingSha256(
    `${source.id}:${source.sha256}:${source.objectVersionId}:${requestHash}`,
  );
  const transcodeOperationId = processingSha256(
    `${contentVersionId}:${source.sha256}:${source.objectVersionId}:transcode`,
  );
  return {
    actor: {
      accountKey: source.accountKey,
      productKey: source.productKey,
      principalId,
      role: 'admin',
    },
    source,
    readback: {
      runtimeTier: source.runtimeTier,
      verificationEnvironmentId: source.verificationEnvironmentId,
      region: 'eu-central-1',
      bucketRef: source.bucketRef,
      objectKeyDigest: source.objectKeyDigest,
      objectVersionId: source.objectVersionId,
      byteCount: source.byteCount,
      durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
      checksumAlgorithm: 'sha256',
      sha256: source.sha256,
      kmsKeyVersionRef: source.kmsKeyVersionRef,
      storageClass: input.config.contentS3StorageClass,
      blockPublicAccess: true,
      bucketOwnerEnforced: true,
    },
    storage: {
      policyVersion: 'OT-PROCESSING-STORAGE-1',
      provider: 'aws-s3',
      region: 'eu-central-1',
      private: true,
      versioningEnabled: true,
      encryption: 'SSE-KMS',
      blockPublicAccess: true,
      bucketOwnerEnforced: true,
      browserCredentialsExposed: false,
      bucketRef: source.bucketRef,
      kmsKeyVersionRef: source.kmsKeyVersionRef,
    },
    captureEvidence: {
      evidenceVersion: 'OT-OBS-CAPTURE-1',
      sourceId: source.id,
      occurrenceId: canaryId,
      captureMethod: 'obs',
      zoomCloudRecordingDisabled: exactTrue(
        input.source.CONTENT_MEDIA_ZOOM_CLOUD_RECORDING_DISABLED,
        'content_processing_zoom_cloud_binding_missing',
      ),
      controlledEncryptedDevice: exactTrue(
        input.source.CONTENT_MEDIA_CONTROLLED_ENCRYPTED_DEVICE,
        'content_processing_device_binding_missing',
      ),
      accountOwnerConsentVersion: required(
        input.source.CONTENT_MEDIA_ACCOUNT_OWNER_CONSENT_VERSION,
        'content_processing_consent_binding_missing',
      ),
      consentedParticipantSnapshotDigest: sha256(
        input.source.CONTENT_MEDIA_PARTICIPANT_SNAPSHOT_DIGEST,
      ),
      recordingNotice: exactNotice(input.source.CONTENT_MEDIA_RECORDING_NOTICE),
      capturedAt: iso(source.obsRecordingStartedAt, 'content_processing_capture_timestamp_missing'),
      uploadConfirmedAt: source.stableAt,
      durableChecksumReadbackReceiptId: source.checksumReadbackReceiptId,
      linkedIngestSourceId: source.id,
    },
    probe,
    trimStartMs: 0,
    trimEndMs: probe.durationMs,
    inputLocator: `managed_original_${source.id}`,
    outputLocator: `derivative_${transcodeOperationId}`,
    idempotencyKey: canaryId,
    requestHash,
    occurredAt,
  };
}

function registryGuard(
  registry: ProviderRegistryBindingReadPort,
  request: ProviderRegistryBindingReadRequest,
) {
  return {
    read: async () => {
      const evidence = await registry.readActiveRegistryBinding(request);
      if (evidence === null) throw new Error('content_media_registry_binding_unavailable');
      return {
        providerAccountRefHash: evidence.binding.provider_account_ref_hash,
        observedAt: evidence.observed_at,
      };
    },
  };
}

function providerProof(
  source: NodeJS.ProcessEnv,
  prefix: 'CONTENT_S3' | 'CONTENT_DRIVE' | 'CONTENT_OPENAI' | 'CONTENT_VIMEO',
) {
  const expectedVersion = Number(
    required(source[`${prefix}_REGISTRY_VERSION`], 'registry_version'),
  );
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('content_media_registry_version_invalid');
  }
  return {
    expected_provider_account_ref_hash: sha256(source[`${prefix}_PROVIDER_ACCOUNT_REF_HASH`]),
    expected_registry_evidence_digest: sha256(source[`${prefix}_REGISTRY_EVIDENCE_DIGEST`]),
    expected_provider_readback_evidence_digest: sha256(
      source[`${prefix}_PROVIDER_READBACK_EVIDENCE_DIGEST`],
    ),
    expected_version: expectedVersion,
    observed_not_before: iso(
      source[`${prefix}_REGISTRY_OBSERVED_NOT_BEFORE`],
      'registry_observed_not_before',
    ),
  };
}

function assertProviderCanary(config: AppConfig) {
  if (
    config.contentMediaMode !== 'provider_canary' ||
    config.oneTimeRuntimeTier !== 'production' ||
    config.oneTimeVerificationEnvironmentId !== 'production_operator_canary' ||
    !config.contentMediaAuthorizationId ||
    !config.contentMediaCanaryId
  ) {
    throw new Error('content_media_provider_canary_binding_mismatch');
  }
}

function derivativeKey(operationId: string) {
  if (!/^[a-f0-9]{64}$/u.test(operationId)) {
    throw new Error('content_processing_derivative_operation_invalid');
  }
  return `derivative_${operationId}`;
}

function derivativeMetadata(operationId: string, readback: DerivativeReadback) {
  return {
    'ot-operation-id': operationId,
    'ot-profile': readback.profileVersion,
    'ot-byte-count': String(readback.byteCount),
    'ot-sha256': readback.sha256,
    'ot-duration-ms': String(readback.durationMs),
    'ot-width': String(readback.width),
    'ot-height': String(readback.height),
    'ot-fps': String(readback.framesPerSecond),
    'ot-audio-bitrate': String(readback.audioBitrateBps),
  };
}

function parseJson<T>(value: unknown): T | null {
  if (!value) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function mapProviderJobRow(row: Record<string, unknown>): ProviderJobRecord {
  return {
    job_id: String(row.job_id),
    operation_type: String(row.operation_type),
    aggregate_ref: String(row.aggregate_ref),
    source_version: Number(row.source_version),
    provider: String(row.provider),
    scope: {
      product: String(row.product) as ProviderJobRecord['scope']['product'],
      runtime_tier: String(row.runtime_tier) as ProviderJobRecord['scope']['runtime_tier'],
      verification_environment_id: String(
        row.verification_environment_id,
      ) as ProviderJobRecord['scope']['verification_environment_id'],
    },
    idempotency_key: String(row.idempotency_key),
    canonical_request_hash: String(row.canonical_request_hash),
    payload_ref: String(row.payload_ref),
    payload_digest: String(row.payload_digest),
    compensation_for_job_id: nullableString(row.compensation_for_job_id),
    state: String(row.state) as ProviderJobRecord['state'],
    version: Number(row.version),
    recovery_generation: Number(row.recovery_generation),
    dispatch_attempts: Number(row.dispatch_attempts),
    lifetime_dispatch_attempts: Number(row.lifetime_dispatch_attempts),
    reconciliation_attempts: Number(row.reconciliation_attempts),
    lease_owner: nullableString(row.lease_owner),
    lease_generation: Number(row.lease_generation),
    lease_expires_at: nullableIso(row.lease_expires_at),
    last_heartbeat_at: nullableIso(row.last_heartbeat_at),
    next_attempt_at: nullableIso(row.next_attempt_at),
    unknown_effect: Boolean(row.unknown_effect),
    provider_acceptance_digest: nullableString(row.provider_acceptance_digest),
    reconciliation_digest: nullableString(row.reconciliation_digest),
    safe_error_code: nullableString(row.safe_error_code),
    created_at: requiredIso(row.created_at),
    updated_at: requiredIso(row.updated_at),
  };
}

function mapProviderOperationRow(row: Record<string, unknown>): ProviderOperation {
  return {
    ...mapProviderJobRow(row),
    provider: String(row.provider) as ProviderOperation['provider'],
    registry_binding_key: String(row.registry_binding_key),
    provider_account_ref_hash: String(row.provider_account_ref_hash),
    effect_kind: String(row.effect_kind) as ProviderOperation['effect_kind'],
    household_id: nullableString(row.household_id),
  };
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function nullableIso(value: unknown) {
  return value === null || value === undefined ? null : requiredIso(value);
}

function requiredIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function sha256(value: string | undefined) {
  const normalized = required(value, 'content_media_registry_digest_missing');
  if (!/^[a-f0-9]{64}$/u.test(normalized)) throw new Error('content_media_registry_digest_invalid');
  return normalized;
}

function iso(value: string | undefined, code: string) {
  const normalized = required(value, code);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(code);
  return new Date(normalized).toISOString();
}

function exactTrue(value: string | undefined, code: string): true {
  if (value !== 'true') throw new Error(code);
  return true;
}

function exactNotice(value: string | undefined): 'visible_and_verbal' {
  if (value !== 'visible_and_verbal') {
    throw new Error('content_processing_recording_notice_binding_missing');
  }
  return value;
}

async function fileSha256(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
