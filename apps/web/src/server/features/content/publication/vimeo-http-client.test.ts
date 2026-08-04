import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { VimeoPlaybackReadbackHttpClient } from './vimeo-http-client.ts';

describe('VimeoPlaybackReadbackHttpClient', () => {
  it('binds registry and live identity before readback-only private playback discovery', async () => {
    const events: string[] = [];
    const context = publicationContext('publish_private');
    const marker = `one-time-operation:provider-op-1:version-1:${'c'.repeat(64)}`;
    const registry = {
      readActiveRegistryBinding: vi.fn(async () => {
        events.push('registry');
        return {
          binding: { provider_account_ref_hash: sha('/users/1') },
          observed_at: '2026-08-04T00:00:00.000Z',
        };
      }),
    };
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = String(request);
      events.push(url);
      expect(init?.method).toBe('GET');
      if (url.includes('/me?fields=')) return json({ uri: '/users/1' });
      if (url.includes('/me/videos?')) {
        return json({
          data: [
            {
              uri: '/videos/1',
              description: marker,
              privacy: { view: 'nobody' },
              status: 'available',
            },
          ],
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const client = new VimeoPlaybackReadbackHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        expectedRegistryEvidenceDigest: '1'.repeat(64),
        expectedProviderReadbackEvidenceDigest: '2'.repeat(64),
        expectedRegistryVersion: 1,
        registryObservedNotBefore: '2026-08-04T00:00:00.000Z',
        timeoutMs: 1_000,
        apiBaseUrl: 'https://vimeo.invalid',
      },
      registry as never,
      fetchImpl as typeof fetch,
      () => new Date('2026-08-04T00:00:01.000Z'),
    );

    await expect(
      client.readCanonical(context as never, new AbortController().signal),
    ).resolves.toMatchObject({
      operation: 'publish_private',
      vimeoPrivacy: 'private',
      vimeoAvailability: 'available',
      matchingCanonicalAssetCount: 1,
    });
    expect(events[0]).toBe('registry');
    expect(events.filter((event) => event.startsWith('https://'))).toHaveLength(2);
  });

  it('fails closed before Vimeo when the canonical registry binding is unavailable', async () => {
    const fetchImpl = vi.fn();
    const client = new VimeoPlaybackReadbackHttpClient(
      {
        accessToken: 'test-only-token',
        expectedAccountId: '/users/1',
        expectedProviderAccountRefHash: sha('/users/1'),
        expectedRegistryEvidenceDigest: '1'.repeat(64),
        expectedProviderReadbackEvidenceDigest: '2'.repeat(64),
        expectedRegistryVersion: 1,
        registryObservedNotBefore: '2026-08-04T00:00:00.000Z',
        timeoutMs: 1_000,
      },
      { readActiveRegistryBinding: vi.fn(async () => null) } as never,
      fetchImpl as typeof fetch,
    );

    await expect(
      client.readCanonical(
        publicationContext('publish_private') as never,
        new AbortController().signal,
      ),
    ).rejects.toThrow('content_vimeo_registry_binding_unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function publicationContext(operation: 'publish_private' | 'revoke_private') {
  return {
    intent: { operation, createdAt: '2026-08-04T00:00:00.000Z' },
    providerOperation: {
      providerOperationId: 'provider-op-1',
      contentVersionId: 'version-1',
      canonicalRequestHash: 'c'.repeat(64),
      providerAcceptanceDigest: 'a'.repeat(64),
    },
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
