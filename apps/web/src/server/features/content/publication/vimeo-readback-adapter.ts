import type {
  PendingContentPublicationProviderContext,
  VimeoContentPublicationObservation,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';

export const VIMEO_PUBLICATION_REGISTRY_KEY = 'vimeo_publication_primary' as const;

export type VimeoIdentityReadback = {
  registryBindingKey: typeof VIMEO_PUBLICATION_REGISTRY_KEY;
  providerAccountRefHash: string;
  authenticatedUserRefHash: string;
  tokenFingerprintHash: string;
  observedAt: string;
};

export interface VimeoPublicationReadbackClient {
  readIdentity(signal: AbortSignal): Promise<VimeoIdentityReadback>;
  readCanonical(
    context: PendingContentPublicationProviderContext,
    signal: AbortSignal,
  ): Promise<VimeoContentPublicationObservation>;
}

/** Read-only Vimeo seam. It accepts fingerprints and opaque references, never credentials or URLs. */
export class VimeoPublicationReadbackAdapter implements VimeoContentPublicationReadbackAdapter {
  constructor(
    private readonly enabled: boolean,
    private readonly expectedProviderAccountRefHash: string | undefined,
    private readonly client: VimeoPublicationReadbackClient | null,
  ) {}

  async readCanonical(
    context: PendingContentPublicationProviderContext,
    signal: AbortSignal,
  ): Promise<VimeoContentPublicationObservation> {
    const client = this.requireClient();
    const identity = await client.readIdentity(signal);
    if (
      identity.registryBindingKey !== VIMEO_PUBLICATION_REGISTRY_KEY ||
      identity.providerAccountRefHash !== this.expectedProviderAccountRefHash ||
      !sha256(identity.providerAccountRefHash) ||
      !sha256(identity.authenticatedUserRefHash) ||
      !sha256(identity.tokenFingerprintHash)
    ) {
      throw new Error('content_vimeo_identity_readback_mismatch');
    }
    const observation = await client.readCanonical(context, signal);
    if (
      observation.providerAcceptanceDigest !== context.providerOperation.providerAcceptanceDigest ||
      !sha256(observation.providerResourceRefHash) ||
      !observation.exactContentVersionCorrelation ||
      (observation.operation === 'publish_private' &&
        (observation.vimeoPrivacy !== 'private' ||
          observation.vimeoAvailability !== 'available' ||
          observation.matchingCanonicalAssetCount !== 1))
    ) {
      throw new Error('content_vimeo_publication_readback_mismatch');
    }
    return observation;
  }

  private requireClient() {
    if (!this.enabled || !this.expectedProviderAccountRefHash || !this.client) {
      throw new Error('content_media_default_off');
    }
    return this.client;
  }
}

function sha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}
