import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { VimeoPrivateHttpClient } from './vimeo-http-client.ts';

describe('VimeoPrivateHttpClient', () => {
  it('reconciles first, uses a stable operation identity, and publishes private by pull URL', async () => {
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    let searches = 0;
    const marker = `one-time-operation:job-1:version-1:${'c'.repeat(64)}`;
    const name = 'One Time content-1 1';
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = String(request);
      requests.push({ url, init });
      if (url.includes('/me/videos?')) {
        searches += 1;
        return json(
          searches === 1
            ? { data: [] }
            : {
                data: [
                  {
                    uri: '/videos/private-1',
                    name,
                    description: marker,
                    privacy: { view: 'nobody' },
                    status: 'available',
                  },
                ],
              },
        );
      }
      if (url.endsWith('/me/videos')) {
        const body = JSON.parse(String(init?.body)) as {
          description: string;
          privacy: { view: string };
          upload: { link: string };
        };
        expect(body.description).toBe(marker);
        expect(body.privacy.view).toBe('nobody');
        expect(body.upload.link).toBe('https://pull.invalid/exact-version');
        expect(new Headers(init?.headers).get('x-idempotency-key')).toBe('idem-1');
        return json({ uri: '/videos/private-1' });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const source = {
      createPrivatePullUrl: vi.fn(async () => 'https://pull.invalid/exact-version'),
    };
    const client = new VimeoPrivateHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        timeoutMs: 1_000,
        apiBaseUrl: 'https://vimeo.invalid',
      },
      source,
      fetchImpl as typeof fetch,
    );

    await expect(
      client.dispatch(
        { operation: operation() } as never,
        { binding: binding(), provider_readback_evidence_digest: 'e'.repeat(64) } as never,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ kind: 'accepted', completed_locally: false });
    expect(requests.map((request) => request.init?.method)).toEqual(['GET', 'POST', 'GET']);
    expect(source.createPrivatePullUrl).toHaveBeenCalledWith('version-1', expect.any(AbortSignal));
  });

  it('returns revoked readback only when the exact marker is absent', async () => {
    const client = new VimeoPrivateHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        timeoutMs: 1_000,
        apiBaseUrl: 'https://vimeo.invalid',
      },
      { createPrivatePullUrl: vi.fn(async () => 'https://pull.invalid') },
      vi.fn(async () => json({ data: [] })) as typeof fetch,
    );
    const context = {
      intent: { operation: 'revoke_private', createdAt: '2026-08-04T00:00:00.000Z' },
      providerOperation: {
        providerOperationId: 'job-1',
        providerAcceptanceDigest: 'a'.repeat(64),
        providerReconciliationDigest: 'b'.repeat(64),
        providerOperationVersion: 1,
        operation: 'revoke_private',
        productKey: 'one-time',
        contentId: 'content-1',
        publicationGeneration: 1,
        idempotencyKey: 'idem-1',
        canonicalRequestHash: 'c'.repeat(64),
        contentVersionId: 'version-1',
        approvalProjectionDigest: 'd'.repeat(64),
        registryBindingKey: 'vimeo_publication_primary',
        providerAccountRefHash: sha('/users/1'),
      },
    };

    await expect(
      client.readPublication(context as never, new AbortController().signal),
    ).resolves.toMatchObject({ operation: 'revoke_private', matchingCanonicalAssetCount: 0 });
  });

  it('never accepts or reconciles an exact marker whose privacy drifted public', async () => {
    const marker = `one-time-operation:job-1:version-1:${'c'.repeat(64)}`;
    const fetchImpl = vi.fn(async () =>
      json({
        data: [
          {
            uri: '/videos/public-1',
            name: 'One Time content-1 1',
            description: marker,
            privacy: { view: 'anybody' },
            status: 'available',
          },
        ],
      }),
    );
    const client = new VimeoPrivateHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        timeoutMs: 1_000,
        apiBaseUrl: 'https://vimeo.invalid',
      },
      { createPrivatePullUrl: vi.fn(async () => 'https://pull.invalid') },
      fetchImpl as typeof fetch,
    );

    await expect(
      client.dispatch(
        { operation: operation() } as never,
        { binding: binding(), provider_readback_evidence_digest: 'e'.repeat(64) } as never,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ kind: 'permanently_rejected', safe_error_code: 'vimeo_privacy_mismatch' });
    await expect(
      client.reconcile(operation() as never, binding() as never, new AbortController().signal),
    ).resolves.toMatchObject({
      disposition: 'still_unknown',
      safe_error_code: 'vimeo_privacy_mismatch',
      provider_acceptance_digest: null,
    });
  });

  it('recovers an unknown publish only from one exact private marker', async () => {
    let searches = 0;
    const marker = `one-time-operation:job-1:version-1:${'c'.repeat(64)}`;
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') throw new Error('simulated timeout after acceptance');
      if (String(request).includes('/me/videos?')) {
        searches += 1;
        return json({
          data:
            searches === 1
              ? []
              : [
                  {
                    uri: '/videos/recovered-1',
                    name: 'One Time content-1 1',
                    description: marker,
                    privacy: { view: 'nobody' },
                    status: 'uploading',
                  },
                ],
        });
      }
      throw new Error('unexpected request');
    });
    const client = new VimeoPrivateHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        timeoutMs: 1_000,
        apiBaseUrl: 'https://vimeo.invalid',
      },
      { createPrivatePullUrl: vi.fn(async () => 'https://pull.invalid') },
      fetchImpl as typeof fetch,
    );

    await expect(
      client.dispatch(
        { operation: operation() } as never,
        { binding: binding(), provider_readback_evidence_digest: 'e'.repeat(64) } as never,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ kind: 'accepted' });
  });
});

function operation() {
  return {
    job_id: 'job-1',
    operation_type: 'publish_private',
    aggregate_ref: 'content-1',
    source_version: 1,
    provider: 'vimeo',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'production',
      verification_environment_id: 'production_operator_canary',
    },
    idempotency_key: 'idem-1',
    canonical_request_hash: 'c'.repeat(64),
    payload_ref: 'version-1',
    payload_digest: 'd'.repeat(64),
    registry_binding_key: 'vimeo_publication_primary',
    provider_account_ref_hash: sha('/users/1'),
    effect_kind: 'mutation',
  };
}

function binding() {
  return {
    registry_binding_key: 'vimeo_publication_primary',
    provider: 'vimeo',
    scope: operation().scope,
    provider_account_ref_hash: sha('/users/1'),
    allowed_operation_types: ['publish_private', 'revoke_private'],
    mutation_policy: 'allowed',
    active: true,
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
