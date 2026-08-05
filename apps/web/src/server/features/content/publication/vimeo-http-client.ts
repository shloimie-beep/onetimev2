import { createHash } from 'node:crypto';

import type {
  PendingContentPublicationProviderContext,
  VimeoContentPublicationReadbackAdapter,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import type { ProviderRegistryBindingReadPort } from '../../../../../../../packages/contracts/src/providers/v21-provider-core.ts';

export class VimeoPlaybackReadbackHttpClient implements VimeoContentPublicationReadbackAdapter {
  constructor(
    private readonly config: {
      accessToken: string;
      expectedAccountId: string;
      expectedProviderAccountRefHash: string;
      expectedRegistryEvidenceDigest: string;
      expectedProviderReadbackEvidenceDigest: string;
      expectedRegistryVersion: number;
      registryObservedNotBefore: string;
      timeoutMs: number;
      apiBaseUrl?: string | undefined;
    },
    private readonly registry: ProviderRegistryBindingReadPort,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async readCanonical(context: PendingContentPublicationProviderContext, signal: AbortSignal) {
    const scope = context.executionScope ?? {
      product: 'one_time_mishnayos' as const,
      runtime_tier: 'production' as const,
      verification_environment_id: 'production_operator_canary' as const,
    };
    const request = {
      registry_binding_key: 'vimeo_publication_primary',
      provider: 'vimeo' as const,
      scope,
      operation_type: context.intent.operation,
      effect_kind: 'mutation' as const,
      expected_provider_account_ref_hash: this.config.expectedProviderAccountRefHash,
      expected_registry_evidence_digest: this.config.expectedRegistryEvidenceDigest,
      expected_provider_readback_evidence_digest:
        this.config.expectedProviderReadbackEvidenceDigest,
      expected_version: this.config.expectedRegistryVersion,
      observed_not_before: this.config.registryObservedNotBefore,
    };
    const evidence = await this.registry.readActiveRegistryBinding(request);
    if (evidence === null) throw new Error('content_vimeo_registry_binding_unavailable');
    await this.assertLiveIdentity(signal);
    const marker = operationMarker(context);
    const query = new URLSearchParams({
      query: marker,
      per_page: '3',
      fields: 'data.uri,data.name,data.description,data.privacy.view,data.status',
    });
    const page = await this.request<{ data?: readonly VimeoVideo[] }>(
      `/me/videos?${query.toString()}`,
      signal,
    );
    const matches = (page.data ?? []).filter((video) => video.description === marker);
    const observedAt = this.clock().toISOString();
    if (context.intent.operation === 'revoke_private') {
      if (matches.length !== 0) throw new Error('content_vimeo_revocation_readback_incomplete');
      return {
        operation: 'revoke_private' as const,
        observedAt,
        providerResourceRefHash: digest(marker),
        vimeoAvailability: 'revoked' as const,
        matchingCanonicalAssetCount: 0 as const,
        exactContentVersionCorrelation: true as const,
        providerAcceptanceDigest: context.providerOperation.providerAcceptanceDigest,
      };
    }
    const video = matches[0];
    if (
      matches.length !== 1 ||
      !video?.uri ||
      video.privacy?.view !== 'nobody' ||
      video.status !== 'available'
    ) {
      throw new Error('content_vimeo_private_readback_incomplete');
    }
    return {
      operation: 'publish_private' as const,
      observedAt,
      opaqueProviderAssetRef: context.providerOperation.providerOperationId,
      providerResourceRefHash: digest(video.uri),
      vimeoPrivacy: 'private' as const,
      vimeoAvailability: 'available' as const,
      matchingCanonicalAssetCount: 1 as const,
      exactContentVersionCorrelation: true as const,
      providerAcceptanceDigest: context.providerOperation.providerAcceptanceDigest,
    };
  }

  private async assertLiveIdentity(signal: AbortSignal) {
    const me = await this.request<{ uri?: string; account?: string }>(
      '/me?fields=uri,account',
      signal,
    );
    const accountRef = exactAccountRef(me.uri, this.config.expectedAccountId);
    if (
      accountRef !== this.config.expectedAccountId ||
      digestRequired(accountRef) !== this.config.expectedProviderAccountRefHash
    ) {
      throw new Error('content_vimeo_identity_readback_mismatch');
    }
  }

  private async request<T>(path: string, signal: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(
        new URL(path, this.config.apiBaseUrl ?? 'https://api.vimeo.com').toString(),
        {
          method: 'GET',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${this.config.accessToken}`,
            accept: 'application/vnd.vimeo.*+json;version=3.4',
          },
        },
      );
      if (!response.ok) throw new Error('content_vimeo_readback_failed');
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
}

type VimeoVideo = {
  uri?: string;
  description?: string;
  privacy?: { view?: string };
  status?: string;
};

function operationMarker(context: PendingContentPublicationProviderContext) {
  const operation = context.providerOperation;
  return `one-time-operation:${operation.providerOperationId}:${operation.contentVersionId}:${operation.canonicalRequestHash}`;
}

function digestRequired(value: string | undefined) {
  if (!value) throw new Error('content_vimeo_live_identity_unavailable');
  return digest(value);
}

function exactAccountRef(providerUri: string | undefined, expectedAccountId: string) {
  if (
    !providerUri ||
    (providerUri !== expectedAccountId && providerUri !== `/users/${expectedAccountId}`)
  ) {
    throw new Error('content_vimeo_identity_readback_mismatch');
  }
  return expectedAccountId;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
