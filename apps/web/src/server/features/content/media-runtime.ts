import { S3Client } from '@aws-sdk/client-s3';
import { STSClient } from '@aws-sdk/client-sts';

import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { ProviderRegistryBindingReadPort } from '../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  AwsS3ManagedOriginalAdapter,
  AwsS3ManagedOriginalClient,
  S3_CONTENT_ORIGINAL_REGISTRY_KEY,
} from '../../../../../../packages/db/src/content/ingest/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import { createPostgresProviderCoreRepository } from '../../../../../../packages/db/src/providers/v21-provider-core-repository.ts';
import { VimeoPlaybackReadbackHttpClient } from './publication/vimeo-http-client.ts';

export type ContentMediaWebRuntime = {
  ingest: { managedOriginal: AwsS3ManagedOriginalAdapter };
  publication: {
    providerBinding: {
      registry_binding_key: 'vimeo_publication_primary';
      provider: 'vimeo';
      scope: {
        product: 'one_time_mishnayos';
        runtime_tier: 'production';
        verification_environment_id: 'production_operator_canary' | 'production_broad';
      };
      provider_account_ref_hash: string;
      allowed_operation_types: readonly ['publish_private', 'revoke_private'];
      mutation_policy: 'allowed';
      active: true;
    };
    readbackAdapter: VimeoPlaybackReadbackHttpClient;
  };
};

export function createContentMediaWebRuntime(input: {
  config: AppConfig;
  pool: DbPool;
  source: NodeJS.ProcessEnv;
  dependencies?:
    | {
        registry: ProviderRegistryBindingReadPort;
        s3Client: Pick<S3Client, 'send'>;
        stsClient: Pick<STSClient, 'send'>;
        fetchImpl?: typeof fetch | undefined;
      }
    | undefined;
}): ContentMediaWebRuntime | undefined {
  if (!input.config.contentMediaProviderCanary && !input.config.contentMediaProductionBroad) {
    return undefined;
  }
  assertProviderRuntime(input.config);
  if (!input.config.contentMediaProvidersReady) return undefined;
  try {
    return createContentMediaWebRuntimeUnchecked(input);
  } catch (error) {
    if (input.config.contentMediaProductionBroad) return undefined;
    throw error;
  }
}

function createContentMediaWebRuntimeUnchecked(input: {
  config: AppConfig;
  pool: DbPool;
  source: NodeJS.ProcessEnv;
  dependencies?:
    | {
        registry: ProviderRegistryBindingReadPort;
        s3Client: Pick<S3Client, 'send'>;
        stsClient: Pick<STSClient, 'send'>;
        fetchImpl?: typeof fetch | undefined;
      }
    | undefined;
}): ContentMediaWebRuntime | undefined {
  const registry = input.dependencies?.registry ?? createPostgresProviderCoreRepository(input.pool);
  const s3Proof = providerProof(input.source, 'CONTENT_S3');
  const vimeoProof = providerProof(input.source, 'CONTENT_VIMEO');
  const scope = {
    product: 'one_time_mishnayos' as const,
    runtime_tier: 'production' as const,
    verification_environment_id: input.config.oneTimeVerificationEnvironmentId as
      'production_operator_canary' | 'production_broad',
  };
  const s3Registry = {
    read: async () => {
      const evidence = await registry.readActiveRegistryBinding({
        registry_binding_key: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
        provider: 's3',
        scope,
        operation_type: 'multipart_original_write',
        effect_kind: 'mutation',
        ...s3Proof,
      });
      if (evidence === null) throw new Error('content_s3_registry_binding_unavailable');
      return {
        providerAccountRefHash: evidence.binding.provider_account_ref_hash,
        observedAt: evidence.observed_at,
      };
    },
  };
  const concreteS3 = new AwsS3ManagedOriginalClient(
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
    input.dependencies?.s3Client ?? new S3Client({ region: 'eu-central-1' }),
    input.dependencies?.stsClient ?? new STSClient({ region: 'eu-central-1' }),
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
    concreteS3,
  );
  const vimeoAccountId = required(
    input.config.contentVimeoAccountId,
    'content_vimeo_account_binding_missing',
  );
  const vimeoAccessToken = required(
    input.config.contentVimeoAccessToken,
    'content_vimeo_credential_missing',
  );
  const readbackAdapter = new VimeoPlaybackReadbackHttpClient(
    {
      accessToken: vimeoAccessToken,
      expectedAccountId: vimeoAccountId,
      expectedProviderAccountRefHash: vimeoProof.expected_provider_account_ref_hash,
      expectedRegistryEvidenceDigest: vimeoProof.expected_registry_evidence_digest,
      expectedProviderReadbackEvidenceDigest: vimeoProof.expected_provider_readback_evidence_digest,
      expectedRegistryVersion: vimeoProof.expected_version,
      registryObservedNotBefore: vimeoProof.observed_not_before,
      timeoutMs: 15_000,
    },
    registry,
    input.dependencies?.fetchImpl ?? fetch,
  );
  return {
    ingest: { managedOriginal },
    publication: {
      providerBinding: {
        registry_binding_key: 'vimeo_publication_primary',
        provider: 'vimeo',
        scope,
        provider_account_ref_hash: vimeoProof.expected_provider_account_ref_hash,
        allowed_operation_types: ['publish_private', 'revoke_private'],
        mutation_policy: 'allowed',
        active: true,
      },
      readbackAdapter,
    },
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

function providerProof(source: NodeJS.ProcessEnv, prefix: 'CONTENT_S3' | 'CONTENT_VIMEO') {
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

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function sha256(value: string | undefined) {
  const normalized = required(value, 'content_media_registry_digest_missing');
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error('content_media_registry_digest_invalid');
  }
  return normalized;
}

function iso(value: string | undefined, code: string) {
  const normalized = required(value, code);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(code);
  return new Date(normalized).toISOString();
}
