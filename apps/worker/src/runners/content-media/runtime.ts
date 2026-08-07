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
  AwsS3ManagedOriginalAdapter,
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
  if (!input.config.contentMediaProviderCanary && !input.config.contentMediaProductionBroad) {
    return undefined;
  }
  assertProviderRuntime(input.config);
  if (!input.config.contentMediaProvidersReady) return undefined;
  try {
    return createContentMediaWorkerRuntimeUnchecked(input);
  } catch (error) {
    if (input.config.contentMediaProductionBroad) return undefined;
    throw error;
  }
}

function createContentMediaWorkerRuntimeUnchecked(input: {
  config: AppConfig;
  pool: DbPool;
  source: NodeJS.ProcessEnv;
  dependencies?: ContentMediaRuntimeDependencies | undefined;
}): ContentMediaWorkerRuntime | undefined {
  const registry = input.dependencies?.registry ?? createPostgresProviderCoreRepository(input.pool);
  const s3 = input.dependencies?.s3 ?? new S3Client({ region: 'eu-central-1' });
  const sts = input.dependencies?.sts ?? new STSClient({ region: 'eu-central-1' });
  const fetchImpl = input.dependencies?.fetchImpl ?? fetch;
  const scope = {
    product: 'one_time_mishnayos' as const,
    runtime_tier: 'production' as const,
    verification_environment_id: input.config.oneTimeVerificationEnvironmentId as
      'production_operator_canary' | 'production_broad',
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
      verificationEnvironmentId: scope.verification_environment_id,
      timeoutMs: 15_000,
    },
    s3,
    sts,
    s3Registry,
  );
  const managedOriginal = new AwsS3ManagedOriginalAdapter(
    {
      enabled: true,
      region: 'eu-central-1',
      bucketRef: input.config.contentS3Bucket,
      kmsKeyVersionRef: input.config.contentS3KmsKeyArn,
      storageClass: input.config.contentS3StorageClass,
      browserOrigin: new URL(input.config.publicBaseUrl).origin,
      accountKey: input.config.accountKey,
      productKey: input.config.productKey,
    },
    s3Identity,
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
        pageSize:
          input.config.contentMediaMode === 'provider_canary'
            ? 1
            : input.config.contentMediaBatchSize,
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
      staging: {
        beginDriveTransfer: (request) => managedOriginal.beginDriveTransfer(request),
        putPart: (request) => managedOriginal.putPart(request),
        completeAndReadBack: (request) =>
          managedOriginal.completeAndReadBack({
            uploadSessionId: request.transferId,
            opaqueObjectKey: stableKey('source', [
              input.config.accountKey,
              input.config.productKey,
              request.transferId,
            ]),
            fullSha256: request.fullSha256,
            orderedProviderPartRefDigests: request.orderedProviderPartRefDigests,
          }),
      },
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
    nextCommands: async (limit) =>
      input.config.contentMediaMode === 'provider_canary'
        ? [
            await selectExactCanaryProcessingCommand({
              config: input.config,
              source: input.source,
              pool: input.pool,
              client: processingClient,
            }),
          ].filter((command): command is ProcessContentCommand => command !== null)
        : selectBroadProcessingCommands({
            config: input.config,
            source: input.source,
            pool: input.pool,
            client: processingClient,
            limit,
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
  const baseJobRepository = createPostgresJobFoundationRepository(input.pool);
  const boundedRepositories =
    input.config.contentMediaMode === 'provider_canary'
      ? createCanaryBoundPublicationRepositories({
          pool: input.pool,
          canaryId: required(input.config.contentMediaCanaryId, 'content_media_canary_missing'),
          jobRepository: baseJobRepository,
          publicationRepository,
        })
      : createBroadBoundPublicationRepositories({
          pool: input.pool,
          accountKey: input.config.accountKey,
          maxBatchSize: input.config.contentMediaBatchSize,
          jobRepository: baseJobRepository,
          publicationRepository,
        });
  const providerRepository = createPostgresProviderCoreRepository(input.pool);
  runtime.publication = {
    jobRepository: boundedRepositories.jobRepository,
    publicationRepository: boundedRepositories.publicationRepository,
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
    options: {
      scope,
      batchSize:
        input.config.contentMediaMode === 'provider_canary'
          ? 1
          : input.config.contentMediaBatchSize,
      dispatchTimeoutMs: 30_000,
      reconciliationTimeoutMs: 30_000,
    },
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

export function createBroadBoundPublicationRepositories(input: {
  pool: DbPool;
  accountKey: string;
  maxBatchSize: number;
  jobRepository: JobFoundationRepository;
  publicationRepository: ContentPublicationRepository & ContentPublicationWorkerRepository;
}) {
  if (!input.accountKey.trim()) throw new Error('content_media_broad_account_missing');
  if (
    !Number.isSafeInteger(input.maxBatchSize) ||
    input.maxBatchSize < 1 ||
    input.maxBatchSize > 10
  ) {
    throw new Error('content_media_broad_batch_invalid');
  }
  const bounded = (limit: number) => Math.min(limit, input.maxBatchSize);
  const jobRepository: JobFoundationRepository = {
    async claimDueJobs(claim) {
      if (
        claim.scope.product !== 'one_time_mishnayos' ||
        claim.scope.runtime_tier !== 'production' ||
        claim.scope.verification_environment_id !== 'production_broad'
      ) {
        throw new Error('content_publication_broad_scope_mismatch');
      }
      const result = await input.pool.query(
        `WITH candidate AS (
           SELECT job.job_id
             FROM onetime.job_outbox AS job
             JOIN onetime.content_publication_outbox AS publication
               ON publication.provider_operation_id = job.job_id
             JOIN onetime.provider_operation_binding AS binding
               ON binding.job_id = job.job_id
             JOIN onetime.content_publications AS content
               ON content.account_key = publication.account_key
              AND content.product_key = publication.product_key
              AND content.content_id = publication.content_id
              AND content.content_version_id = publication.content_version_id
              AND content.publication_generation = publication.publication_generation
              AND content.pending_provider_operation_id = publication.provider_operation_id
             JOIN onetime.content_processing_versions AS processing
               ON processing.account_key = publication.account_key
              AND processing.product_key = publication.product_key
              AND processing.content_version_key = publication.content_version_id
            WHERE job.product = $1
              AND job.runtime_tier = $2
              AND job.verification_environment_id = $3
              AND publication.account_key = $4
              AND job.provider = 'vimeo'
              AND job.operation_type = ANY($5::text[])
              AND job.state IN ('not_started', 'retry_wait')
              AND job.unknown_effect = false
              AND job.dispatch_attempts < 8
              AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= $6::timestamptz)
              AND publication.product_key = job.product
              AND publication.provider = job.provider
              AND publication.operation = job.operation_type
              AND publication.content_id = job.aggregate_ref
              AND publication.content_version_id = job.payload_ref
              AND publication.publication_generation = job.source_version
              AND publication.request_hash = job.canonical_request_hash
              AND publication.state = 'pending'
              AND publication.intent_json->'approvalEvidence' IS NOT NULL
              AND binding.registry_binding_key = 'vimeo_publication_primary'
              AND binding.effect_kind = 'mutation'
              AND (
                (job.operation_type = 'publish_private'
                  AND content.state = 'publishing'
                  AND content.record_json->'approval' IS NOT NULL
                  AND processing.processing_state = 'approved')
                OR
                (job.operation_type = 'revoke_private'
                  AND content.state IN ('approved', 'archived'))
              )
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
          input.accountKey,
          claim.operation_types,
          claim.now.toISOString(),
          bounded(claim.limit),
          claim.owner,
          JOB_LEASE_DURATION_MS / 1_000,
        ],
      );
      const claimed = result.rows.map(mapProviderJobRow);
      if (claimed.length > bounded(claim.limit)) {
        throw new Error('content_publication_broad_claim_limit_exceeded');
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
      if (job.scope.verification_environment_id !== 'production_broad') return null;
      const context = await input.publicationRepository.reopenDispatchContext(job);
      if (context && context.intent.accountKey !== input.accountKey) {
        throw new Error('content_publication_broad_dispatch_account_mismatch');
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
            AND publication.account_key = $4
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
            AND publication.intent_json->'approvalEvidence' IS NOT NULL
            AND binding.registry_binding_key = 'vimeo_publication_primary'
            AND binding.effect_kind = 'mutation'
          ORDER BY job.updated_at, job.job_id
          LIMIT $5`,
        [
          scope.product,
          scope.runtime_tier,
          scope.verification_environment_id,
          input.accountKey,
          bounded(limit),
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
            AND publication.account_key = $4
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
            AND publication.intent_json->'approvalEvidence' IS NOT NULL
            AND binding.registry_binding_key = 'vimeo_publication_primary'
            AND binding.effect_kind = 'mutation'
          ORDER BY job.updated_at, job.job_id
          LIMIT $5`,
        [
          scope.product,
          scope.runtime_tier,
          scope.verification_environment_id,
          input.accountKey,
          bounded(limit),
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
      `SELECT link_row.source_kind, link_row.provenance_ref_digest,
              link_row.provider_change_marker,
              upload_row.record_json AS upload_json
         FROM onetime.content_source_links_v21 AS link_row
         LEFT JOIN onetime.content_ingest_upload_sessions AS upload_row
           ON upload_row.account_key = link_row.account_key
          AND upload_row.product_key = link_row.product_key
          AND upload_row.record_json->>'providerUploadIdDigest' = link_row.provenance_ref_digest
        WHERE link_row.account_key = $1
          AND link_row.product_key = $2
          AND link_row.source_key = $3
        ORDER BY CASE WHEN link_row.source_kind = 'app_upload' THEN 0 ELSE 1 END,
                 link_row.source_link_key
        LIMIT 9`,
      [source.accountKey, source.productKey, source.id],
    );
    if (result.rows.length === 9) {
      throw new Error('content_processing_original_key_binding_unbounded');
    }
    const candidates = new Set<string>();
    for (const row of result.rows) {
      const session = parseJson<{ opaqueObjectKey?: string }>(row.upload_json);
      const key =
        row.source_kind === 'app_upload' ||
        (row.source_kind === undefined && session?.opaqueObjectKey)
          ? session?.opaqueObjectKey
          : row.source_kind === 'drive' && row.provider_change_marker
            ? stableKey('source', [
                source.accountKey,
                source.productKey,
                stableKey('drive_transfer', [
                  String(row.provenance_ref_digest),
                  String(row.provider_change_marker),
                ]),
              ])
            : undefined;
      if (key && /^source_[a-f0-9]{32}$/u.test(key) && digest(key) === source.objectKeyDigest) {
        candidates.add(key);
      }
    }
    if (candidates.size !== 1) {
      throw new Error('content_processing_original_key_binding_unavailable');
    }
    return [...candidates][0]!;
  }

  private async assertS3(operationType: string, effectKind: 'mutation' | 'readback') {
    const evidence = await this.input.registry.readActiveRegistryBinding({
      registry_binding_key: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
      provider: 's3',
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: this.input.config.oneTimeVerificationEnvironmentId as
          'production_operator_canary' | 'production_broad',
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

export async function selectBroadProcessingCommands(input: {
  config: AppConfig;
  source: NodeJS.ProcessEnv;
  pool: DbPool;
  client: ExecutableFfmpegOpenAiClient;
  limit: number;
}): Promise<ProcessContentCommand[]> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 10) {
    throw new Error('content_processing_broad_limit_invalid');
  }
  const result = await input.pool.query(
    `SELECT source.record_json
       FROM onetime.content_sources_v21 AS source
       LEFT JOIN LATERAL (
         SELECT version.processing_state, version.retry_state, version.record_json
           FROM onetime.content_processing_versions AS version
          WHERE version.account_key = source.account_key
            AND version.product_key = source.product_key
            AND version.source_key = source.source_key
          ORDER BY version.updated_at DESC, version.content_version_key
          LIMIT 1
       ) AS processing ON TRUE
       LEFT JOIN onetime.content_processing_commands AS receipt
         ON receipt.account_key = source.account_key
        AND receipt.product_key = source.product_key
        AND receipt.idempotency_key = source.source_key
        AND receipt.operation = 'process_source'
      WHERE source.account_key = $1
        AND source.product_key = $2
        AND source.lifecycle_state IN ('received', 'processing')
        AND source.record_json->>'runtimeTier' = 'production'
        AND source.record_json->>'verificationEnvironmentId' = 'production_broad'
        AND COALESCE(source.record_json->>'occurrenceId', '') <> ''
        AND receipt.idempotency_key IS NULL
        AND (
          processing.processing_state IS NULL
          OR processing.processing_state IN ('validating', 'transcoding', 'transcribing', 'drafting')
          OR (
            processing.processing_state = 'failed'
            AND processing.retry_state = 'retry_wait'
            AND (processing.record_json->>'retryAt')::timestamptz <= now()
          )
        )
      ORDER BY source.updated_at, source.source_key
      LIMIT $3`,
    [input.config.accountKey, input.config.productKey, input.limit],
  );
  if (result.rows.length > input.limit) throw new Error('content_processing_broad_limit_exceeded');
  const commands: ProcessContentCommand[] = [];
  for (const row of result.rows) {
    const source = parseJson<ContentProcessingSource>(row.record_json);
    if (
      !source ||
      source.accountKey !== input.config.accountKey ||
      source.productKey !== input.config.productKey ||
      source.runtimeTier !== 'production' ||
      source.verificationEnvironmentId !== 'production_broad' ||
      !source.occurrenceId
    ) {
      throw new Error('content_processing_broad_binding_mismatch');
    }
    commands.push(
      await buildProcessingCommand({
        ...input,
        sourceRecord: source,
        idempotencyKey: source.id,
      }),
    );
  }
  return commands;
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
  return buildProcessingCommand({
    ...input,
    sourceRecord: source,
    idempotencyKey: canaryId,
  });
}

async function buildProcessingCommand(input: {
  config: AppConfig;
  source: NodeJS.ProcessEnv;
  client: ExecutableFfmpegOpenAiClient;
  sourceRecord: ContentProcessingSource;
  idempotencyKey: string;
}): Promise<ProcessContentCommand> {
  const contentSource = input.sourceRecord;
  const occurrenceId = required(
    contentSource.occurrenceId,
    'content_processing_occurrence_binding_missing',
  );
  const principalId = required(
    contentSource.recordingAdminId ?? contentSource.matchedByAdminId,
    'content_processing_admin_binding_missing',
  );
  const probe = await input.client.probeSource(contentSource);
  const occurredAt = new Date().toISOString();
  const requestHash = digest(
    `${contentSource.sha256}\0${contentSource.objectVersionId}\0${probe.durationMs}`,
  );
  const contentVersionId = processingSha256(
    `${contentSource.id}:${contentSource.sha256}:${contentSource.objectVersionId}:${requestHash}`,
  );
  const transcodeOperationId = processingSha256(
    `${contentVersionId}:${contentSource.sha256}:${contentSource.objectVersionId}:transcode`,
  );
  return {
    actor: {
      accountKey: contentSource.accountKey,
      productKey: contentSource.productKey,
      principalId,
      role: 'admin',
    },
    source: contentSource,
    readback: {
      runtimeTier: contentSource.runtimeTier,
      verificationEnvironmentId: contentSource.verificationEnvironmentId,
      region: 'eu-central-1',
      bucketRef: contentSource.bucketRef,
      objectKeyDigest: contentSource.objectKeyDigest,
      objectVersionId: contentSource.objectVersionId,
      byteCount: contentSource.byteCount,
      durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
      checksumAlgorithm: 'sha256',
      sha256: contentSource.sha256,
      kmsKeyVersionRef: contentSource.kmsKeyVersionRef,
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
      bucketRef: contentSource.bucketRef,
      kmsKeyVersionRef: contentSource.kmsKeyVersionRef,
    },
    captureEvidence: {
      evidenceVersion: 'OT-OBS-CAPTURE-1',
      sourceId: contentSource.id,
      occurrenceId,
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
      capturedAt: iso(
        contentSource.obsRecordingStartedAt,
        'content_processing_capture_timestamp_missing',
      ),
      uploadConfirmedAt: contentSource.stableAt,
      durableChecksumReadbackReceiptId: contentSource.checksumReadbackReceiptId,
      linkedIngestSourceId: contentSource.id,
    },
    probe,
    trimStartMs: 0,
    trimEndMs: probe.durationMs,
    inputLocator: `managed_original_${contentSource.id}`,
    outputLocator: `derivative_${transcodeOperationId}`,
    idempotencyKey: input.idempotencyKey,
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

function assertProviderRuntime(config: AppConfig) {
  if (
    config.oneTimeRuntimeTier !== 'production' ||
    !config.contentMediaAuthorizationId ||
    (config.contentMediaMode === 'provider_canary' &&
      (config.oneTimeVerificationEnvironmentId !== 'production_operator_canary' ||
        !config.contentMediaCanaryId)) ||
    (config.contentMediaMode === 'production_broad' &&
      config.oneTimeVerificationEnvironmentId !== 'production_broad') ||
    !['provider_canary', 'production_broad'].includes(config.contentMediaMode)
  ) {
    throw new Error('content_media_provider_runtime_binding_mismatch');
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

function stableKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32)}`;
}
