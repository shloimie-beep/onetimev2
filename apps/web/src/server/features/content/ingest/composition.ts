import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { ContentIngestRepository } from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import { createContentIngestRepository } from '../../../../../../../packages/db/src/content/ingest/index.ts';
import { AwsS3ManagedOriginalAdapter } from '../../../../../../../packages/db/src/content/ingest/s3-managed-original-adapter.ts';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../../registry/index.ts';
import {
  createContentIngestRouter,
  type ContentIngestCsrfVerifier,
  type ContentIngestIdentityResolver,
  type ManagedOriginalWebPort,
} from './router.ts';
import { createContentIngestService } from './service.ts';

export type ContentIngestRuntime = {
  managedOriginal?: ManagedOriginalWebPort | undefined;
  repository?: ContentIngestRepository | undefined;
};

export function createContentIngestFeatureRegistration(input: {
  resolveIdentity: ContentIngestIdentityResolver;
  verifyCsrf: ContentIngestCsrfVerifier;
  runtime?: ContentIngestRuntime | undefined;
}) {
  return defineServerFeature({
    featureId: 'onetime.content-ingest',
    contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
    mountPath: '/api/app/content/ingest',
    createRouter: ({ config, pool, clock }) => {
      const repository = input.runtime?.repository ?? createContentIngestRepository(pool);
      return createContentIngestRouter({
        enabled: config.contentMediaEnabled && Boolean(input.runtime?.managedOriginal),
        authorizationId: config.contentMediaAuthorizationId,
        canaryId: config.contentMediaCanaryId,
        runtimeTier: config.oneTimeRuntimeTier,
        verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
        service: createContentIngestService(repository),
        state: {
          getUploadSession: (actor, uploadSessionId) =>
            repository.inTransaction((unit) => unit.getUploadSession(actor, uploadSessionId)),
          listUploadParts: (actor, uploadSessionId) =>
            repository.inTransaction((unit) => unit.listUploadParts(actor, uploadSessionId)),
        },
        managedOriginal: input.runtime?.managedOriginal ?? disabledManagedOriginalAdapter(config),
        resolveIdentity: input.resolveIdentity,
        verifyCsrf: input.verifyCsrf,
        ...(clock ? { clock } : {}),
      });
    },
  });
}

export function disabledManagedOriginalAdapter(config: AppConfig): ManagedOriginalWebPort {
  return new AwsS3ManagedOriginalAdapter(
    {
      enabled: false,
      region: config.contentAwsRegion,
      bucketRef: config.contentS3Bucket,
      kmsKeyVersionRef: config.contentS3KmsKeyArn,
      storageClass: config.contentS3StorageClass,
      browserOrigin: new URL(config.publicBaseUrl).origin,
    },
    null,
  );
}
