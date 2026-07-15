import { z } from 'zod';
import type { ProviderReadinessSnapshot } from '../../../contracts/src/providers/events.ts';
import { assertNoLiveReference, safeFingerprint, stableProviderKey } from './shared.ts';

export const vimeoAdapterConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    accountKey: z.string().min(1),
    productKey: z.string().min(1),
    environment: z.enum(['test', 'staging', 'production']).default('staging'),
    accountRefConfigured: z.boolean().default(false),
    readOnlyVerificationEnabled: z.boolean().default(false),
    mutationCanaryEnabled: z.boolean().default(false),
  })
  .strict();
export type VimeoAdapterConfig = z.infer<typeof vimeoAdapterConfigSchema>;

export type VimeoReadinessClient = {
  getPlaybackReadiness(): Promise<{
    accountRef: string;
    embedDomainAllowed: boolean;
    privacy: 'private' | 'unlisted' | 'public' | 'unknown';
  }>;
};

export type VimeoPlaybackDescriptorInput = {
  contentKey: string;
  providerVideoRef: string;
  embedDomain: string;
  playbackSecretRef: string;
  now?: Date;
};

export type VimeoPlaybackDescriptor = {
  content_key: string;
  provider: 'vimeo';
  provider_reference_digest: string;
  embed_domain: string;
  playback_token_ref: string;
  expires_at: string;
  raw_url_included: false;
};

export function buildVimeoPlaybackDescriptor(
  input: VimeoPlaybackDescriptorInput,
): VimeoPlaybackDescriptor {
  assertNoLiveReference('vimeo video ref', input.providerVideoRef);
  const now = input.now ?? new Date();
  const domain = normalizeEmbedDomain(input.embedDomain);
  return {
    content_key: input.contentKey,
    provider: 'vimeo',
    provider_reference_digest: safeFingerprint(input.providerVideoRef),
    embed_domain: domain,
    playback_token_ref: stableProviderKey('vimeo_playback', [
      input.contentKey,
      input.providerVideoRef,
      domain,
      input.playbackSecretRef,
      String(now.getTime()),
    ]),
    expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    raw_url_included: false,
  };
}

export async function inspectVimeoReadiness(input: {
  config: VimeoAdapterConfig;
  client?: VimeoReadinessClient;
  observedAt?: Date;
}): Promise<ProviderReadinessSnapshot> {
  const observedAt = input.observedAt ?? new Date();
  if (!input.config.enabled || !input.config.accountRefConfigured) {
    return snapshot(input.config, 'not_configured', [], null, observedAt);
  }
  if (!input.config.readOnlyVerificationEnabled || !input.client) {
    return snapshot(
      input.config,
      'configured',
      ['short_lived_playback_descriptor', 'redacted_outcome_events'],
      null,
      observedAt,
    );
  }
  const readiness = await input.client.getPlaybackReadiness();
  if (!readiness.embedDomainAllowed || readiness.privacy === 'public') {
    return snapshot(
      input.config,
      'unavailable',
      ['privacy_or_embed_domain_not_ready'],
      null,
      observedAt,
    );
  }
  return snapshot(
    input.config,
    'authenticated',
    ['short_lived_playback_descriptor', 'embed_domain_verified', `privacy_${readiness.privacy}`],
    safeFingerprint(readiness.accountRef),
    observedAt,
  );
}

function normalizeEmbedDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain) || domain.includes('..')) {
    throw new Error('Vimeo embed domain rejected.');
  }
  return domain;
}

function snapshot(
  config: VimeoAdapterConfig,
  state: ProviderReadinessSnapshot['readiness_state'],
  capabilityNames: string[],
  fingerprint: string | null,
  observedAt: Date,
): ProviderReadinessSnapshot {
  return {
    snapshot_key: stableProviderKey('vimeo_readiness', [
      config.accountKey,
      config.productKey,
      config.environment,
      observedAt.toISOString(),
    ]),
    account_key: config.accountKey,
    product_key: config.productKey,
    provider: 'vimeo',
    environment: config.environment,
    readiness_state: state,
    capability_names: capabilityNames,
    safe_fingerprint: fingerprint,
    observed_at: observedAt.toISOString(),
  };
}
