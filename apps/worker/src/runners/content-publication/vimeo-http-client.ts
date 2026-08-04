import { createHash } from 'node:crypto';

import type {
  ContentPublicationDispatchContext,
  PendingContentPublicationProviderContext,
} from '../../../../../packages/contracts/src/content/publication/index.ts';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
  ProviderRegistryBindingEvidence,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY,
  type VimeoPrivateClient,
} from './vimeo-private-adapter.ts';

export interface VimeoPrivateUploadSource {
  createPrivatePullUrl(contentVersionId: string, signal: AbortSignal): Promise<string>;
}

export class VimeoPrivateHttpClient implements VimeoPrivateClient {
  constructor(
    private readonly config: {
      accessToken: string;
      expectedAccountId: string;
      expectedProviderAccountRefHash: string;
      timeoutMs: number;
      apiBaseUrl?: string | undefined;
    },
    private readonly uploadSource: VimeoPrivateUploadSource,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async readIdentity(signal: AbortSignal) {
    const me = await this.request<VimeoUser>('/me?fields=uri,account,resource_key', {
      method: 'GET',
      signal,
    });
    const accountRef = exactAccountRef(me.uri, this.config.expectedAccountId);
    const accountHash = digestRequired(accountRef);
    if (
      accountHash !== this.config.expectedProviderAccountRefHash ||
      accountRef !== this.config.expectedAccountId
    ) {
      throw new Error('content_vimeo_identity_readback_mismatch');
    }
    return {
      registryBindingKey: VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY,
      providerAccountRefHash: accountHash,
      authenticatedUserRefHash: digestRequired(me.uri),
      credentialFingerprintHash: digest(this.config.accessToken),
      privateUploadEnforced: true as const,
      observedAt: this.clock().toISOString(),
    };
  }

  async dispatch(
    context: ContentPublicationDispatchContext,
    evidence: ProviderRegistryBindingEvidence,
    signal: AbortSignal,
  ) {
    assertEvidence(context.operation, evidence);
    const existing = await this.findExact(context.operation, signal);
    if (existing.length > 1) {
      return { kind: 'permanently_rejected' as const, safe_error_code: 'vimeo_asset_ambiguous' };
    }
    if (context.operation.operation_type === 'publish_private') {
      if (existing[0]) {
        return existing[0].privacy?.view === 'nobody'
          ? accepted(context.operation, existing[0])
          : {
              kind: 'permanently_rejected' as const,
              safe_error_code: 'vimeo_privacy_mismatch',
            };
      }
      const pullUrl = await this.uploadSource.createPrivatePullUrl(
        context.operation.payload_ref,
        signal,
      );
      try {
        await this.request<VimeoVideo>('/me/videos', {
          method: 'POST',
          signal,
          idempotencyKey: context.operation.idempotency_key,
          body: {
            upload: { approach: 'pull', link: pullUrl },
            name: safeVideoName(context.operation),
            description: operationMarker(context.operation),
            privacy: {
              view: 'nobody',
              embed: 'whitelist',
              download: false,
              add: false,
              comments: 'nobody',
            },
          },
        });
      } catch {
        const recovered = await this.findExact(context.operation, signal).catch(() => []);
        return recovered.length === 1 && recovered[0]?.privacy?.view === 'nobody'
          ? accepted(context.operation, recovered[0])
          : {
              kind: 'acceptance_unknown' as const,
              safe_error_code:
                recovered.length === 1
                  ? 'vimeo_privacy_mismatch'
                  : 'vimeo_publish_acceptance_unknown',
            };
      }
      const readback = await this.findExact(context.operation, signal);
      return readback.length === 1 && readback[0]?.privacy?.view === 'nobody'
        ? accepted(context.operation, readback[0])
        : {
            kind: 'acceptance_unknown' as const,
            safe_error_code:
              readback.length === 1 ? 'vimeo_privacy_mismatch' : 'vimeo_publish_acceptance_unknown',
          };
    }

    if (!existing[0]) {
      return accepted(context.operation, { uri: operationMarker(context.operation) });
    }
    try {
      await this.request<void>(existing[0].uri!, {
        method: 'DELETE',
        signal,
        idempotencyKey: context.operation.idempotency_key,
      });
    } catch {
      const recovered = await this.findExact(context.operation, signal).catch(() => existing);
      return recovered.length === 0
        ? accepted(context.operation, existing[0])
        : {
            kind: 'acceptance_unknown' as const,
            safe_error_code: 'vimeo_revoke_acceptance_unknown',
          };
    }
    return (await this.findExact(context.operation, signal)).length === 0
      ? accepted(context.operation, existing[0])
      : {
          kind: 'acceptance_unknown' as const,
          safe_error_code: 'vimeo_revoke_acceptance_unknown',
        };
  }

  async reconcile(
    operation: ProviderOperation,
    binding: ProviderRegistryBinding,
    signal: AbortSignal,
  ): Promise<ProviderCanonicalReadback> {
    assertBinding(operation, binding);
    const matches = await this.findExact(operation, signal);
    const observedAt = this.clock().toISOString();
    const common = {
      operation_id: operation.job_id,
      provider: 'vimeo' as const,
      scope: operation.scope,
      registry_binding_key: operation.registry_binding_key,
      provider_account_ref_hash: operation.provider_account_ref_hash,
      canonical_request_hash: operation.canonical_request_hash,
      completed_locally: false,
      observed_at: observedAt,
    };
    if (matches.length > 1) {
      return {
        ...common,
        disposition: 'still_unknown',
        provider_resource_ref_hash: null,
        provider_acceptance_digest: null,
        reconciliation_digest: digest(`${operation.job_id}\0duplicate\0${matches.length}`),
        safe_error_code: 'vimeo_asset_ambiguous',
      };
    }
    if (
      operation.operation_type === 'publish_private' &&
      matches.length === 1 &&
      matches[0]?.privacy?.view !== 'nobody'
    ) {
      return {
        ...common,
        disposition: 'still_unknown',
        provider_resource_ref_hash: matches[0]?.uri ? digest(matches[0].uri) : null,
        provider_acceptance_digest: null,
        reconciliation_digest: digest(`${operation.job_id}\0privacy_mismatch`),
        safe_error_code: 'vimeo_privacy_mismatch',
      };
    }
    const effectExists =
      operation.operation_type === 'publish_private' ? Boolean(matches[0]) : matches.length === 0;
    if (effectExists) {
      const resource = matches[0]?.uri ?? operationMarker(operation);
      return {
        ...common,
        disposition: 'effect_exists',
        provider_resource_ref_hash: digest(resource),
        provider_acceptance_digest: acceptanceDigest(operation, resource),
        reconciliation_digest: digest(`${operation.job_id}\0effect_exists\0${resource}`),
        safe_error_code: null,
      };
    }
    return {
      ...common,
      disposition: 'effect_absent_retry_safe',
      provider_resource_ref_hash: null,
      provider_acceptance_digest: null,
      reconciliation_digest: digest(`${operation.job_id}\0effect_absent`),
      safe_error_code: null,
    };
  }

  async readPublication(context: PendingContentPublicationProviderContext, signal: AbortSignal) {
    const operation = context.operationRecord ?? providerOperationAsOperation(context);
    const matches = await this.findExact(operation, signal);
    if (context.intent.operation === 'revoke_private') {
      if (matches.length !== 0) throw new Error('content_vimeo_revoked_asset_still_present');
      return {
        operation: 'revoke_private' as const,
        observedAt: this.clock().toISOString(),
        providerResourceRefHash: digest(operationMarker(operation)),
        vimeoAvailability: 'revoked' as const,
        matchingCanonicalAssetCount: 0 as const,
        exactContentVersionCorrelation: true as const,
        providerAcceptanceDigest: context.providerOperation.providerAcceptanceDigest,
      };
    }
    if (matches.length !== 1) throw new Error('content_vimeo_private_readback_ambiguous');
    const video = matches[0]!;
    if (video.privacy?.view !== 'nobody' || video.status !== 'available' || !video.uri) {
      throw new Error('content_vimeo_private_readback_incomplete');
    }
    return {
      operation: 'publish_private' as const,
      observedAt: this.clock().toISOString(),
      opaqueProviderAssetRef: context.providerOperation.providerOperationId,
      providerResourceRefHash: digest(video.uri),
      vimeoPrivacy: 'private' as const,
      vimeoAvailability: 'available' as const,
      matchingCanonicalAssetCount: 1 as const,
      exactContentVersionCorrelation: true as const,
      providerAcceptanceDigest: acceptanceDigest(operation, video.uri),
    };
  }

  private async findExact(operation: ProviderOperation, signal: AbortSignal) {
    const marker = operationMarker(operation);
    const query = new URLSearchParams({
      query: marker,
      per_page: '3',
      fields: 'data.uri,data.name,data.description,data.privacy.view,data.status',
    });
    const page = await this.request<{ data?: readonly VimeoVideo[] }>(
      `/me/videos?${query.toString()}`,
      { method: 'GET', signal },
    );
    return (page.data ?? []).filter(
      (video) => video.description === marker && video.name === safeVideoName(operation),
    );
  }

  private async request<T>(
    path: string,
    input: {
      method: 'GET' | 'POST' | 'DELETE';
      signal: AbortSignal;
      idempotencyKey?: string | undefined;
      body?: unknown;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const abort = () => controller.abort();
    input.signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(
        new URL(path, this.config.apiBaseUrl ?? 'https://api.vimeo.com').toString(),
        {
          method: input.method,
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${this.config.accessToken}`,
            accept: 'application/vnd.vimeo.*+json;version=3.4',
            ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
            ...(input.idempotencyKey ? { 'x-idempotency-key': input.idempotencyKey } : {}),
          },
          ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        },
      );
      if (!response.ok) throw new Error('content_vimeo_request_failed');
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
    }
  }
}

type VimeoUser = { uri?: string; account?: string; resource_key?: string };
type VimeoVideo = {
  uri?: string;
  name?: string;
  description?: string;
  privacy?: { view?: string };
  status?: string;
};

function assertEvidence(operation: ProviderOperation, evidence: ProviderRegistryBindingEvidence) {
  assertBinding(operation, evidence.binding);
  if (!/^[a-f0-9]{64}$/u.test(evidence.provider_readback_evidence_digest)) {
    throw new Error('content_vimeo_registry_evidence_invalid');
  }
}

function assertBinding(operation: ProviderOperation, binding: ProviderRegistryBinding) {
  if (
    operation.provider !== 'vimeo' ||
    binding.provider !== 'vimeo' ||
    binding.registry_binding_key !== VIMEO_PRIVATE_PUBLICATION_REGISTRY_KEY ||
    binding.registry_binding_key !== operation.registry_binding_key ||
    binding.provider_account_ref_hash !== operation.provider_account_ref_hash ||
    binding.mutation_policy !== 'allowed' ||
    !binding.active
  ) {
    throw new Error('content_vimeo_registry_binding_mismatch');
  }
}

function providerOperationAsOperation(
  context: PendingContentPublicationProviderContext,
): ProviderOperation {
  const operation = context.providerOperation;
  return {
    job_id: operation.providerOperationId,
    operation_type: operation.operation,
    aggregate_ref: operation.contentId,
    source_version: operation.publicationGeneration,
    provider: 'vimeo',
    scope: context.executionScope ?? {
      product: operation.productKey,
      runtime_tier: 'production',
      verification_environment_id: 'production_operator_canary',
    },
    idempotency_key: operation.idempotencyKey,
    canonical_request_hash: operation.canonicalRequestHash,
    payload_ref: operation.contentVersionId,
    payload_digest: operation.approvalProjectionDigest,
    compensation_for_job_id: null,
    state: 'accepted',
    version: operation.providerOperationVersion,
    recovery_generation: 0,
    dispatch_attempts: 1,
    lifetime_dispatch_attempts: 1,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: operation.providerAcceptanceDigest,
    reconciliation_digest: operation.providerReconciliationDigest,
    safe_error_code: null,
    created_at: context.intent.createdAt,
    updated_at: context.intent.createdAt,
    registry_binding_key: operation.registryBindingKey,
    provider_account_ref_hash: operation.providerAccountRefHash,
    effect_kind: 'mutation',
    household_id: null,
  };
}

function accepted(operation: ProviderOperation, video: VimeoVideo) {
  const resource = video.uri ?? operationMarker(operation);
  return {
    kind: 'accepted' as const,
    provider_acceptance_digest: acceptanceDigest(operation, resource),
    completed_locally: false,
  };
}

function acceptanceDigest(operation: ProviderOperation, resource: string) {
  return digest(`${operation.job_id}\0${operation.canonical_request_hash}\0${resource}`);
}

function operationMarker(operation: ProviderOperation) {
  return `one-time-operation:${operation.job_id}:${operation.payload_ref}:${operation.canonical_request_hash}`;
}

function safeVideoName(operation: ProviderOperation) {
  return `One Time ${operation.aggregate_ref} ${operation.source_version}`.slice(0, 120);
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
