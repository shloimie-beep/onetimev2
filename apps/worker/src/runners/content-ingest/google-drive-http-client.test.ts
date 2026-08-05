import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  GoogleDriveHttpClient,
  createGoogleServiceAccountTokenProvider,
} from './google-drive-http-client.ts';

describe('GoogleDriveHttpClient', () => {
  it('reads the canonical identity before an exact, bounded folder scan', async () => {
    const events: string[] = [];
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      events.push(url);
      if (url.includes('/about?')) {
        return json({ user: { permissionId: 'permission-1', emailAddress: 'media@example.test' } });
      }
      if (url.includes('/files/folder-1?')) {
        return json({
          id: 'folder-1',
          mimeType: 'application/vnd.google-apps.folder',
          trashed: false,
        });
      }
      if (url.includes('/files?')) {
        expect(url).toContain('pageSize=2');
        return json({
          files: [
            {
              id: 'recording-1',
              name: 'recording.mp4',
              mimeType: 'video/mp4',
              size: '4',
              version: '7',
              md5Checksum: 'md5',
              modifiedTime: '2026-08-04T00:00:00.000Z',
              parents: ['folder-1'],
              trashed: false,
            },
          ],
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const client = new GoogleDriveHttpClient(
      { folderId: 'folder-1', serviceAccountEmail: 'media@example.test', timeoutMs: 1_000 },
      vi.fn(async () => 'test-token'),
      {
        read: vi.fn(async () => {
          events.push('registry');
          return { providerAccountRefHash: sha('permission-1'), observedAt: '' };
        }),
      },
      fetchImpl as typeof fetch,
      () => new Date('2026-08-04T00:00:00.000Z'),
    );

    await expect(
      client.listPage({ registeredIncomingFolderId: 'folder-1' }),
    ).resolves.toMatchObject({
      files: [{ fileId: 'recording-1', parentFolderId: 'folder-1', byteCount: 4 }],
    });
    expect(events[0]).toBe('registry');
  });

  it('range-reads only one exact unchanged recording', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const metadata = {
      id: 'recording-1',
      name: 'recording.mp4',
      mimeType: 'video/mp4',
      size: '4',
      version: '7',
      md5Checksum: 'md5',
      modifiedTime: '2026-08-04T00:00:00.000Z',
      parents: ['folder-1'],
      trashed: false,
    };
    const marker = sha(['7', 'md5', metadata.modifiedTime, '4'].join('\0'));
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = String(request);
      if (url.includes('/about?')) {
        return json({ user: { permissionId: 'permission-1', emailAddress: 'media@example.test' } });
      }
      if (url.includes('/files/folder-1?')) {
        return json({
          id: 'folder-1',
          mimeType: 'application/vnd.google-apps.folder',
          trashed: false,
        });
      }
      if (url.includes('/files/recording-1?alt=media')) {
        expect(new Headers(init?.headers).get('range')).toBe('bytes=0-3');
        return new Response(bytes, {
          status: 206,
          headers: { 'content-range': 'bytes 0-3/4', 'content-length': '4' },
        });
      }
      if (url.includes('/files/recording-1?')) return json(metadata);
      throw new Error(`unexpected URL ${url}`);
    });
    const client = new GoogleDriveHttpClient(
      { folderId: 'folder-1', serviceAccountEmail: 'media@example.test', timeoutMs: 1_000 },
      vi.fn(async () => 'test-token'),
      {
        read: vi.fn(async () => ({ providerAccountRefHash: sha('permission-1'), observedAt: '' })),
      },
      fetchImpl as typeof fetch,
    );

    const received: number[] = [];
    for await (const chunk of client.openRange({
      fileId: 'recording-1',
      start: 0,
      endExclusive: 4,
      expectedChangeMarker: marker,
    })) {
      received.push(...chunk);
    }
    expect(received).toEqual([1, 2, 3, 4]);
  });

  it('rejects mismatched range headers and noncanonical OAuth token endpoints', async () => {
    expect(() =>
      createGoogleServiceAccountTokenProvider({
        serviceAccountJson: JSON.stringify({
          client_email: 'media@example.test',
          private_key: 'not-used',
          token_uri: 'https://credential-proxy.invalid/token',
        }),
        timeoutMs: 1_000,
      }),
    ).toThrow('content_drive_service_account_invalid');

    const metadata = {
      id: 'recording-1',
      name: 'recording.mp4',
      mimeType: 'video/mp4',
      size: '4',
      version: '7',
      md5Checksum: 'md5',
      modifiedTime: '2026-08-04T00:00:00.000Z',
      parents: ['folder-1'],
      trashed: false,
    };
    const marker = sha(['7', 'md5', metadata.modifiedTime, '4'].join('\0'));
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('/about?')) {
        return json({ user: { permissionId: 'permission-1', emailAddress: 'media@example.test' } });
      }
      if (url.includes('/files/folder-1?')) {
        return json({
          id: 'folder-1',
          mimeType: 'application/vnd.google-apps.folder',
          trashed: false,
        });
      }
      if (url.includes('/files/recording-1?alt=media')) {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 206,
          headers: { 'content-range': 'bytes 1-4/4', 'content-length': '4' },
        });
      }
      if (url.includes('/files/recording-1?')) return json(metadata);
      throw new Error(`unexpected URL ${url}`);
    });
    const client = new GoogleDriveHttpClient(
      { folderId: 'folder-1', serviceAccountEmail: 'media@example.test', timeoutMs: 1_000 },
      vi.fn(async () => 'test-token'),
      {
        read: vi.fn(async () => ({ providerAccountRefHash: sha('permission-1'), observedAt: '' })),
      },
      fetchImpl as typeof fetch,
    );

    const consume = async () => {
      for await (const chunk of client.openRange({
        fileId: 'recording-1',
        start: 0,
        endExclusive: 4,
        expectedChangeMarker: marker,
      })) {
        // Consume to require the downstream byte-count proof.
        void chunk;
      }
    };
    await expect(consume()).rejects.toThrow('content_drive_range_readback_failed');
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
