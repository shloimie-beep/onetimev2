import type {
  ContentPublicationDispatchContext,
  ContentPublicationProviderDispatchAdapter,
  PendingContentPublicationProviderContext,
  VimeoContentPublicationObservation,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type { ProviderDispatchOutcome } from '../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderReadbackAdapter,
  ProviderRegistryBinding,
  ProviderRegistryBindingEvidence,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';

export const VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY = 'vimeo_publication_primary' as const;

export type VimeoPrivateIdentityReadback = {
  registryBindingKey: typeof VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY;
  providerAccountRefHash: string;
  authenticatedUserRefHash: string;
  credentialFingerprintHash: string;
  privateUploadEnforced: true;
  observedAt: string;
};

export interface VimeoPrivateClient {
  readIdentity(signal: AbortSignal): Promise<VimeoPrivateIdentityReadback>;
  dispatch(
    context: ContentPublicationDispatchContext,
    evidence: ProviderRegistryBindingEvidence,
    signal: AbortSignal,
  ): Promise<ProviderDispatchOutcome>;
  reconcile(
    operation: ProviderOperation,
    binding: ProviderRegistryBinding,
    signal: AbortSignal,
  ): Promise<ProviderCanonicalReadback>;
  readPublication(
    context: PendingContentPublicationProviderContext,
    signal: AbortSignal,
  ): Promise<VimeoContentPublicationObservation>;
}

export class VimeoPrivatePublicationAdapter
  implements ContentPublicationProviderDispatchAdapter, VimeoContentPublicationReadbackAdapter
{
  constructor(
    private readonly enabled: boolean,
    private readonly expectedProviderAccountRefHash: string | undefined,
    private readonly client: VimeoPrivateClient | null,
  ) {}

  async dispatch(
    context: ContentPublicationDispatchContext,
    evidence: ProviderRegistryBindingEvidence,
    signal: AbortSignal,
  ) {
    await this.assertIdentity(signal);
    assertBinding(evidence.binding, this.expectedProviderAccountRefHash);
    return this.requireClient().dispatch(context, evidence, signal);
  }

  reconciliationAdapter(): ProviderReadbackAdapter {
    return {
      provider: 'vimeo',
      readCanonical: async (operation, binding, signal) => {
        await this.assertIdentity(signal);
        assertBinding(binding, this.expectedProviderAccountRefHash);
        const readback = await this.requireClient().reconcile(operation, binding, signal);
        if (
          readback.provider !== 'vimeo' ||
          readback.registry_binding_key !== VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY ||
          readback.provider_account_ref_hash !== this.expectedProviderAccountRefHash
        ) {
          throw new Error('content_vimeo_reconciliation_readback_mismatch');
        }
        return readback;
      },
    };
  }

  async readCanonical(
    context: PendingContentPublicationProviderContext,
    signal: AbortSignal,
  ): Promise<VimeoContentPublicationObservation> {
    await this.assertIdentity(signal);
    const observation = await this.requireClient().readPublication(context, signal);
    if (
      !observation.exactContentVersionCorrelation ||
      !sha256(observation.providerResourceRefHash) ||
      (observation.operation === 'publish_private' && observation.vimeoPrivacy !== 'private')
    ) {
      throw new Error('content_vimeo_private_readback_mismatch');
    }
    return observation;
  }

  private async assertIdentity(signal: AbortSignal) {
    const identity = await this.requireClient().readIdentity(signal);
    if (
      identity.registryBindingKey !== VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY ||
      identity.providerAccountRefHash !== this.expectedProviderAccountRefHash ||
      !sha256(identity.providerAccountRefHash) ||
      !sha256(identity.authenticatedUserRefHash) ||
      !sha256(identity.credentialFingerprintHash) ||
      !identity.privateUploadEnforced
    ) {
      throw new Error('content_vimeo_identity_readback_mismatch');
    }
    return identity;
  }

  private requireClient() {
    if (!this.enabled || !this.expectedProviderAccountRefHash || !this.client) {
      throw new Error('content_media_default_off');
    }
    return this.client;
  }
}

function assertBinding(binding: ProviderRegistryBinding, expectedAccount: string | undefined) {
  if (
    binding.registry_binding_key !== VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY ||
    binding.provider !== 'vimeo' ||
    binding.provider_account_ref_hash !== expectedAccount ||
    !binding.active ||
    binding.mutation_policy !== 'allowed'
  ) {
    throw new Error('content_vimeo_registry_binding_mismatch');
  }
}

function sha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}
