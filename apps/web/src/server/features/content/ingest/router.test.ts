import type { AddressInfo } from 'node:net';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UploadSessionRecord } from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  createContentIngestRouter,
  type ContentIngestRequestIdentity,
  type ContentIngestRouterInput,
} from './router.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('content ingest router', () => {
  it('fails closed before service, state, or managed storage are called', async () => {
    const input = fakeInput(false);
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      code: 'content_media_default_off',
    });
    expect(input.service.beginDirectUpload).not.toHaveBeenCalled();
    expect(input.state.getUploadSession).not.toHaveBeenCalled();
    expect(input.managedOriginal.beginDirectUpload).not.toHaveBeenCalled();
  });

  it('requires Admin entitlement and CSRF before the default-off gate', async () => {
    const input = fakeInput(false);
    input.resolveIdentity = async () => null;
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());

    expect(response.status).toBe(401);
    expect(input.service.beginDirectUpload).not.toHaveBeenCalled();
  });

  it('replays a begin request without creating a second durable session', async () => {
    const input = fakeInput(true);
    const session = uploadSession();
    vi.mocked(input.service.beginDirectUpload).mockResolvedValue({
      replay: true,
      session: undefined,
      plan: undefined,
    });
    vi.mocked(input.state.getUploadSession).mockResolvedValue(session);
    vi.mocked(input.managedOriginal.beginDirectUpload).mockResolvedValue({
      providerUploadIdDigest: 'a'.repeat(64),
    });
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      replay: true,
      data: { session: { id: session.id }, plan: { uploadSessionId: session.id } },
    });
    expect(input.managedOriginal.beginDirectUpload).toHaveBeenCalledTimes(1);
  });
});

function fakeInput(enabled: boolean): ContentIngestRouterInput {
  const unexpected = vi.fn(async () => {
    throw new Error('unexpected_content_ingest_effect');
  });
  return {
    enabled,
    authorizationId: 'authorization-ot-live-004',
    canaryId: 'one-operator-recording',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'isolated_staging_ot_live_004',
    service: {
      beginDirectUpload: vi.fn(unexpected),
      recordUploadPart: vi.fn(unexpected),
      confirmDirectUpload: vi.fn(unexpected),
    } as never,
    state: {
      getUploadSession: vi.fn(unexpected),
      listUploadParts: vi.fn(unexpected),
    },
    managedOriginal: {
      beginDirectUpload: vi.fn(unexpected),
      authorizePart: vi.fn(unexpected),
      recordCompletedPart: vi.fn(unexpected),
      completeAndReadBack: vi.fn(unexpected),
    },
    resolveIdentity: async () => identity(),
    verifyCsrf: async (req) => req.header('x-csrf-token') === 'csrf-test',
    clock: () => new Date('2026-08-04T13:00:00.000Z'),
  };
}

async function start(input: ContentIngestRouterInput) {
  const app = express();
  app.use(express.json());
  app.use('/api/app/content/ingest', createContentIngestRouter(input));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) =>
      error ? reject(error) : resolve(listening),
    );
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function post(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-test' },
    body: JSON.stringify(body),
  });
}

function beginBody() {
  return {
    file_name: 'operator-recording.mp4',
    mime_type: 'video/mp4',
    byte_count: 1024,
    idempotency_key: 'one-operator-recording',
    authorization_id: 'authorization-ot-live-004',
    canary_id: 'one-operator-recording',
  };
}

function identity(): ContentIngestRequestIdentity {
  return {
    sessionKey: 'session-one',
    actor: {
      principalId: 'admin-one',
      role: 'admin',
      accountKey: 'account-one',
      productKey: 'one_time_mishnayos',
    },
  };
}

function uploadSession(): UploadSessionRecord {
  return {
    ...identity().actor,
    id: `upload_${'a'.repeat(32)}`,
    actorId: 'admin-one',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'isolated_staging_ot_live_004',
    displayFilename: 'operator-recording.mp4',
    mimeType: 'video/mp4',
    container: 'mp4',
    declaredByteCount: 1024,
    opaqueObjectKey: `source_${'b'.repeat(32)}`,
    providerUploadIdDigest: 'c'.repeat(64),
    state: 'initiated',
    totalParts: 1,
    completedParts: 0,
    receivedByteCount: 0,
    attemptCount: 0,
    retryState: 'ready',
    idempotencyKey: 'one-operator-recording',
    requestHash: 'd'.repeat(64),
    expiresAt: '2026-08-05T13:00:00.000Z',
    version: 1,
    createdAt: '2026-08-04T13:00:00.000Z',
    updatedAt: '2026-08-04T13:00:00.000Z',
  };
}
