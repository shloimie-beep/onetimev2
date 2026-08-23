import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { ContentIngestRepository } from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import { createClassroomCoreRepository } from '../../../../../../../packages/db/src/classes/core/repository.ts';
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
      const classroom = createClassroomCoreRepository(pool);
      return createContentIngestRouter({
        enabled: config.contentMediaEnabled && Boolean(input.runtime?.managedOriginal),
        authorizationId: config.contentMediaAuthorizationId,
        canaryId: config.contentMediaCanaryId,
        mediaMode:
          config.contentMediaMode === 'production_broad' ? 'production_broad' : 'provider_canary',
        runtimeTier: config.oneTimeRuntimeTier,
        verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
        service: createContentIngestService(repository),
        state: {
          getUploadSession: (actor, uploadSessionId) =>
            repository.inTransaction((unit) => unit.getUploadSession(actor, uploadSessionId)),
          listUploadParts: (actor, uploadSessionId) =>
            repository.inTransaction((unit) => unit.listUploadParts(actor, uploadSessionId)),
          getOccurrence: (actor, occurrenceId) =>
            classroom.inTransaction((unit) => unit.getOccurrence(actor, occurrenceId)),
          listOccurrences: async (actor) => {
            const result = await pool.query(
              `SELECT occurrence_key, local_class_date, starts_at, occurrence_state
                 FROM onetime.class_occurrences
                WHERE account_key = $1 AND product_key = $2
                  AND occurrence_state IN ('scheduled', 'preparing', 'ready', 'live', 'completed')
                  AND starts_at >= now() - interval '180 days'
                ORDER BY starts_at DESC
                LIMIT 100`,
              [actor.accountKey, actor.productKey],
            );
            return result.rows.map((row) => ({
              id: String(row.occurrence_key),
              localClassDate: String(row.local_class_date).slice(0, 10),
              startsAt:
                row.starts_at instanceof Date
                  ? row.starts_at.toISOString()
                  : new Date(String(row.starts_at)).toISOString(),
              state: String(row.occurrence_state) as
                'scheduled' | 'preparing' | 'ready' | 'live' | 'completed',
            }));
          },
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
