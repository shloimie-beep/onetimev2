import { describe, expect, it, vi } from 'vitest';

import type { UploadSessionRecord } from '../../../../../../../../packages/contracts/src/content/ingest/index.ts';
import { createContentIngestApi } from './api.ts';

describe('content ingest browser API', () => {
  it('sends only recording metadata and same-origin session protection on begin', async () => {
    const requests: Array<{ resource: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (resource: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ resource, init });
      return Response.json({
        success: true,
        data: {
          session: uploadSession(),
          plan: {
            uploadSessionId: 'upload-one',
            partBytes: 64 * 1024 * 1024,
            totalParts: 1,
            maxConcurrentParts: 4,
            authorizationTtlSeconds: 900,
            expiresAt: '2026-08-05T13:00:00.000Z',
          },
        },
      });
    }) as unknown as typeof fetch;
    const api = createContentIngestApi({
      csrfToken: 'csrf-browser-test',
      onProtectedStateCleared: vi.fn(),
      fetchImpl,
    });

    const started = await api.beginUpload(
      new File([new Uint8Array([1, 2, 3])], 'operator-recording.mp4', {
        type: 'video/mp4',
        lastModified: 1_785_850_800_000,
      }),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.resource).toBe('/api/app/content/ingest/sessions');
    expect(String(requests[0]?.resource)).not.toContain('?');
    expect(requests[0]?.init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(new Headers(requests[0]?.init?.headers).get('x-csrf-token')).toBe('csrf-browser-test');
    expect(new Headers(requests[0]?.init?.headers).get('cache-control')).toBe('no-store');
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      file_name: 'operator-recording.mp4',
      mime_type: 'video/mp4',
      byte_count: 3,
      client_request_key: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(String(requests[0]?.init?.body)).not.toMatch(/authorization|canary|idempotency/iu);
    expect(started.session).not.toHaveProperty('idempotencyKey');
    expect(started.session).not.toHaveProperty('requestHash');
  });
});

function uploadSession(): Omit<UploadSessionRecord, 'idempotencyKey' | 'requestHash'> {
  return {
    accountKey: 'account-one',
    productKey: 'one_time_mishnayos',
    id: 'upload-one',
    actorId: 'admin-one',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    displayFilename: 'operator-recording.mp4',
    mimeType: 'video/mp4',
    container: 'mp4',
    declaredByteCount: 3,
    opaqueObjectKey: 'source-one',
    providerUploadIdDigest: 'a'.repeat(64),
    state: 'initiated',
    totalParts: 1,
    completedParts: 0,
    receivedByteCount: 0,
    attemptCount: 0,
    retryState: 'ready',
    expiresAt: '2026-08-05T13:00:00.000Z',
    version: 1,
    createdAt: '2026-08-04T13:00:00.000Z',
    updatedAt: '2026-08-04T13:00:00.000Z',
  };
}
