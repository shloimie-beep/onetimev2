import { describe, expect, it, vi } from 'vitest';
import {
  createRealVimeoCatalogReadAdapter,
  inspectVimeoCatalogReadAuth,
  VimeoCatalogReadError,
} from '../../../packages/domain/src/content/vimeo-mishnayos-provider.ts';

describe('read-only Vimeo catalog provider', () => {
  it('reports the exact unavailable state without making a request', () => {
    expect(inspectVimeoCatalogReadAuth({})).toEqual({
      available: false,
      requiredVariableName: 'VIMEO_ACCESS_TOKEN',
    });
    expect(() => createRealVimeoCatalogReadAdapter({ env: {} })).toThrowError(
      VimeoCatalogReadError,
    );
  });

  it('uses GET-only metadata, showcase, and transient caption reads with no video bytes or mutation', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method ?? 'GET' });
      if (url.includes('/me/videos')) {
        return response({
          total: 1,
          paging: { next: null },
          data: [
            {
              uri: '/videos/fixture_provider',
              name: 'Bava Kamma 4',
              description: '',
              duration: 100,
              privacy: { view: 'nobody', embed: 'whitelist' },
              pictures: { sizes: [{ width: 640 }] },
              tags: [{ name: 'Torah' }],
              parent_folder: { name: 'Archive' },
              metadata: { connections: { texttracks: { total: 1 } } },
            },
          ],
        });
      }
      if (url.includes('/albums')) return response({ data: [{ name: 'Mishnayos' }] });
      if (url.includes('/texttracks')) {
        return response({ data: [{ link: 'https://captions.invalid/fixture.vtt' }] });
      }
      if (url.startsWith('https://captions.invalid/')) {
        return new Response('WEBVTT\nMishnah Bava Kamma', { status: 200 });
      }
      return response({}, 404);
    });
    const adapter = createRealVimeoCatalogReadAdapter({
      env: { VIMEO_ACCESS_TOKEN: 'synthetic-test-token' },
      fetchImpl: fetchImpl as typeof fetch,
    });
    const page = await adapter.readPage(1, 100);
    const evidence = await adapter.readCaptionEvidence?.(page.items[0]!);
    expect(page).toMatchObject({ providerTotal: 1, nextPage: null });
    expect(page.items[0]).toMatchObject({
      providerIdentity: '/videos/fixture_provider',
      folders: ['Archive'],
      showcases: ['Mishnayos'],
      captionsAvailable: true,
    });
    expect(evidence).toEqual({ mishnahTermPresent: true, gemaraTermPresent: false });
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(requests.some((request) => /(?:download|source|files)/i.test(request.url))).toBe(false);
  });

  it('redacts provider response bodies from safe errors', async () => {
    const adapter = createRealVimeoCatalogReadAdapter({
      env: { VIMEO_ACCESS_TOKEN: 'synthetic-test-token' },
      fetchImpl: vi.fn(
        async () => new Response('private-provider-body', { status: 403 }),
      ) as typeof fetch,
    });
    await expect(adapter.readPage(1, 100)).rejects.toMatchObject({
      code: 'VIMEO_READ_AUTH_UNAVAILABLE',
      message: 'Vimeo read request failed with safe status 403.',
    });
  });
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
