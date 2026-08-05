import type { ContentProcessingProvider } from './runner.ts';

export const OPENAI_CONTENT_PROCESSING_REGISTRY_KEY = 'openai_content_processing_primary' as const;

export type ContentProcessingProviderIdentityReadback = {
  registryBindingKey: typeof OPENAI_CONTENT_PROCESSING_REGISTRY_KEY;
  providerAccountRefHash: string;
  projectRefHash: string;
  credentialFingerprintHash: string;
  transcriptionModel: string;
  draftModel: string;
  ffmpegBinarySha256: string;
  ffprobeBinarySha256: string;
  observedAt: string;
};

export interface FfmpegOpenAiClient extends ContentProcessingProvider {
  readIdentity(): Promise<ContentProcessingProviderIdentityReadback>;
}

export class FfmpegOpenAiContentProcessingAdapter implements ContentProcessingProvider {
  constructor(
    private readonly enabled: boolean,
    private readonly expectedProjectRefHash: string | undefined,
    private readonly client: FfmpegOpenAiClient | null,
  ) {}

  async readCanonicalIdentity() {
    const client = this.requireClient();
    const identity = await client.readIdentity();
    if (
      identity.registryBindingKey !== OPENAI_CONTENT_PROCESSING_REGISTRY_KEY ||
      identity.projectRefHash !== this.expectedProjectRefHash ||
      !sha256(identity.providerAccountRefHash) ||
      !sha256(identity.projectRefHash) ||
      !sha256(identity.credentialFingerprintHash) ||
      !sha256(identity.ffmpegBinarySha256) ||
      !sha256(identity.ffprobeBinarySha256) ||
      !identity.transcriptionModel ||
      !identity.draftModel
    ) {
      throw new Error('content_processing_identity_readback_mismatch');
    }
    return identity;
  }

  async reconcileOrTranscode(
    input: Parameters<ContentProcessingProvider['reconcileOrTranscode']>[0],
  ) {
    await this.readCanonicalIdentity();
    return this.requireClient().reconcileOrTranscode(input);
  }

  async reconcileOrTranscribe(
    input: Parameters<ContentProcessingProvider['reconcileOrTranscribe']>[0],
  ) {
    await this.readCanonicalIdentity();
    return this.requireClient().reconcileOrTranscribe(input);
  }

  async reconcileOrGenerateDrafts(
    input: Parameters<ContentProcessingProvider['reconcileOrGenerateDrafts']>[0],
  ) {
    await this.readCanonicalIdentity();
    return this.requireClient().reconcileOrGenerateDrafts(input);
  }

  private requireClient() {
    if (!this.enabled || !this.expectedProjectRefHash || !this.client) {
      throw new Error('content_media_default_off');
    }
    return this.client;
  }
}

function sha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}
