import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { VimeoContentPublicationReadbackAdapter } from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import type { ProviderRegistryBinding } from '../../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { createPostgresContentPublicationRepository } from '../../../../../../../packages/db/src/content/publication/index.ts';
import { createContentProcessingRepository } from '../../../../../../../packages/db/src/content/processing/repository.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../../registry/index.ts';
import {
  createContentPublicationRouter,
  type ContentPublicationCsrfVerifier,
  type ContentPublicationIdentityResolver,
} from './router.ts';
import { createContentPublicationService } from './service.ts';

export type ContentPublicationRegistrationInput = {
  resolveIdentity: ContentPublicationIdentityResolver;
  verifyCsrf: ContentPublicationCsrfVerifier;
  providerBinding?: ProviderRegistryBinding | undefined;
  vimeoReadbackAdapter?: VimeoContentPublicationReadbackAdapter | undefined;
  createId?: (() => string) | undefined;
};

export function createContentPublicationFeatureRegistration(
  input: ContentPublicationRegistrationInput,
) {
  return defineServerFeature({
    featureId: 'onetime.content-publication',
    contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
    mountPath: '/api',
    createRouter: ({ config, pool, clock }) => {
      const service = composeContentPublicationService({
        config,
        pool,
        providerBinding: input.providerBinding,
        vimeoReadbackAdapter: input.vimeoReadbackAdapter,
        createId: input.createId,
      });
      return createContentPublicationRouter({
        service,
        resolveIdentity: input.resolveIdentity,
        verifyCsrf: input.verifyCsrf,
        ...(clock ? { clock } : {}),
      });
    },
  });
}

export function composeContentPublicationService(input: {
  config: AppConfig;
  pool: DbPool;
  providerBinding?: ProviderRegistryBinding | undefined;
  vimeoReadbackAdapter?: VimeoContentPublicationReadbackAdapter | undefined;
  createId?: (() => string) | undefined;
}) {
  const repository = createPostgresContentPublicationRepository(input.pool);
  const service = createContentPublicationService({
    repository,
    approvedProjectionRepository: createContentProcessingRepository(input.pool),
    vimeoProviderBinding:
      input.config.contentMediaEnabled && input.providerBinding
        ? input.providerBinding
        : disabledVimeoBinding(input.config),
    vimeoReadbackAdapter:
      input.config.contentMediaEnabled && input.vimeoReadbackAdapter
        ? input.vimeoReadbackAdapter
        : disabledVimeoReadbackAdapter(),
    createId: input.createId ?? (() => `playback_${randomUUID()}`),
  });
  return service;
}

export function disabledVimeoReadbackAdapter(): VimeoContentPublicationReadbackAdapter {
  return {
    async readCanonical() {
      throw new Error('content_publication_vimeo_readback_unavailable');
    },
  };
}

export function disabledVimeoBinding(config: AppConfig): ProviderRegistryBinding {
  return {
    registry_binding_key: 'vimeo-publication-unbound',
    provider: 'vimeo',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: config.oneTimeRuntimeTier,
      verification_environment_id: config.oneTimeVerificationEnvironmentId,
    },
    provider_account_ref_hash: 'unbound',
    allowed_operation_types: [],
    mutation_policy: 'prohibited',
    active: false,
  };
}
