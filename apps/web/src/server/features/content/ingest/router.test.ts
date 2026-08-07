import type { AddressInfo } from 'node:net';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONTENT_INGEST_MAX_CONCURRENT_PARTS,
  CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
  CONTENT_INGEST_PART_BYTES,
  type MultipartUploadPlan,
  type UploadSessionRecord,
} from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
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

  it.each(['authorization_id', 'canary_id', 'idempotency_key'])(
    'strictly rejects browser-supplied %s before any service or storage call',
    async (field) => {
      const input = fakeInput(true);
      const baseUrl = await start(input);
      const response = await post(baseUrl, '/api/app/content/ingest/sessions', {
        ...beginBody(),
        [field]: `browser-supplied-${field}`,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        code: 'content_ingest_invalid_request',
      });
      expect(input.service.beginDirectUpload).not.toHaveBeenCalled();
      expect(input.state.getUploadSession).not.toHaveBeenCalled();
      expect(input.managedOriginal.beginDirectUpload).not.toHaveBeenCalled();
    },
  );

  it('fails closed when protected server binding is unavailable', async () => {
    const input = fakeInput(true);
    input.authorizationId = undefined;
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      code: 'content_media_server_binding_unavailable',
    });
    expect(input.service.beginDirectUpload).not.toHaveBeenCalled();
  });

  it('initializes managed storage exactly once for a new durable begin', async () => {
    const input = fakeInput(true);
    const session = uploadSession();
    vi.mocked(input.service.beginDirectUpload).mockResolvedValue({
      replay: false,
      session,
      plan: uploadPlan(session),
      receipt: {
        accountKey: session.accountKey,
        productKey: session.productKey,
        idempotencyKey: session.idempotencyKey,
        requestHash: session.requestHash,
        operation: 'direct_upload:begin',
        resultRef: session.id,
        resultVersion: session.version,
        committedAt: session.createdAt,
      },
    });
    vi.mocked(input.managedOriginal.beginDirectUpload).mockResolvedValue({
      disposition: 'created',
      providerUploadIdDigest: 'a'.repeat(64),
      openUploadCount: 1,
    });
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());

    expect(response.status).toBe(201);
    expect(input.managedOriginal.beginDirectUpload).toHaveBeenCalledTimes(1);
    expect(input.managedOriginal.beginDirectUpload).toHaveBeenCalledWith({
      uploadSessionId: session.id,
      opaqueObjectKey: session.opaqueObjectKey,
      byteCount: session.declaredByteCount,
      mimeType: session.mimeType,
    });
    expect(await response.json()).toMatchObject({
      data: { session: { id: session.id, version: session.version } },
    });
  });

  it('derives one stable replay identity from protected server binding', async () => {
    const input = fakeInput(true);
    const session = uploadSession();
    vi.mocked(input.service.beginDirectUpload).mockResolvedValue({
      replay: true,
      session: undefined,
      plan: undefined,
    });
    vi.mocked(input.state.getUploadSession).mockResolvedValue(session);
    vi.mocked(input.managedOriginal.beginDirectUpload).mockResolvedValue({
      disposition: 'recovered',
      providerUploadIdDigest: 'a'.repeat(64),
      openUploadCount: 1,
    });
    const baseUrl = await start(input);
    const first = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());
    const retry = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());
    const body = await first.json();

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      replay: true,
      data: { session: { id: session.id }, plan: { uploadSessionId: session.id } },
    });
    expect(JSON.stringify(body)).not.toMatch(/idempotencyKey|requestHash/iu);
    expect(JSON.stringify(body)).not.toContain(input.authorizationId);
    expect(JSON.stringify(body)).not.toContain(input.canaryId);
    const commands = vi
      .mocked(input.service.beginDirectUpload)
      .mock.calls.map(([command]) => command);
    expect(commands).toHaveLength(2);
    expect(commands[0]?.idempotencyKey).toMatch(/^media_canary_[a-f0-9]{32}$/u);
    expect(commands[1]?.idempotencyKey).toBe(commands[0]?.idempotencyKey);
    expect(commands[1]?.requestHash).toBe(commands[0]?.requestHash);
    expect(commands[0]?.idempotencyKey).not.toContain(input.authorizationId);
    expect(commands[0]?.idempotencyKey).not.toContain(input.canaryId);
    expect(input.managedOriginal.beginDirectUpload).not.toHaveBeenCalled();
  });

  it('derives distinct scoped broad upload identities from bounded browser request keys', async () => {
    const input = fakeInput(true);
    input.mediaMode = 'production_broad';
    input.canaryId = undefined;
    input.runtimeTier = 'production';
    input.verificationEnvironmentId = 'production_broad';
    const session = {
      ...uploadSession(),
      runtimeTier: 'production' as const,
      verificationEnvironmentId: 'production_broad',
    };
    vi.mocked(input.service.beginDirectUpload).mockResolvedValue({
      replay: true,
      session: undefined,
      plan: undefined,
    });
    vi.mocked(input.state.getUploadSession).mockResolvedValue(session);
    const baseUrl = await start(input);

    const missing = await post(baseUrl, '/api/app/content/ingest/sessions', beginBody());
    expect(missing.status).toBe(409);
    expect(await missing.json()).toMatchObject({
      code: 'content_media_client_request_binding_unavailable',
    });
    const first = await post(baseUrl, '/api/app/content/ingest/sessions', {
      ...beginBody(),
      client_request_key: '1'.repeat(64),
    });
    const second = await post(baseUrl, '/api/app/content/ingest/sessions', {
      ...beginBody(),
      client_request_key: '2'.repeat(64),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const commands = vi
      .mocked(input.service.beginDirectUpload)
      .mock.calls.map(([command]) => command);
    expect(commands).toHaveLength(2);
    expect(commands[0]?.idempotencyKey).toMatch(/^media_broad_[a-f0-9]{32}$/u);
    expect(commands[1]?.idempotencyKey).not.toBe(commands[0]?.idempotencyKey);
    expect(JSON.stringify(await first.json())).not.toContain(input.authorizationId);
  });

  it('matches a confirmed source only to an occurrence in the authenticated account and product', async () => {
    const input = fakeInput(true);
    const occurrence = {
      accountKey: 'account-one',
      productKey: 'one_time_mishnayos',
      id: 'occurrence-one',
      seriesId: 'canonical-class',
      localClassDate: '2026-08-07',
      startsAt: '2026-08-07T16:00:00.000Z',
      scheduledEndsAt: '2026-08-07T17:00:00.000Z',
      joinOpensAt: '2026-08-07T15:50:00.000Z',
      joinClosesAt: '2026-08-07T17:15:00.000Z',
      state: 'completed' as const,
      scheduleVersion: 1,
      version: 1,
      createdAt: '2026-08-07T15:00:00.000Z',
      updatedAt: '2026-08-07T17:00:00.000Z',
    };
    vi.mocked(input.state.getOccurrence).mockResolvedValue(occurrence);
    vi.mocked(input.service.matchSourceToOccurrence).mockResolvedValue({
      replay: false,
      source: { id: 'source-one', version: 2 },
    } as never);
    const baseUrl = await start(input);
    const response = await post(baseUrl, '/api/app/content/ingest/sources/source-one/match', {
      occurrence_id: occurrence.id,
      expected_version: 1,
      idempotency_key: 'match-source-one-occurrence-one',
    });

    expect(response.status).toBe(200);
    expect(input.state.getOccurrence).toHaveBeenCalledWith(identity().actor, occurrence.id);
    expect(input.service.matchSourceToOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: identity().actor,
        sourceId: 'source-one',
        occurrenceId: occurrence.id,
        expectedVersion: 1,
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
      occurrence,
    );
    expect(JSON.stringify(await response.json())).not.toMatch(/token|provider|https?:\/\//iu);
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
    mediaMode: 'provider_canary',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'isolated_staging_ot_live_004',
    service: {
      beginDirectUpload: vi.fn(unexpected),
      recordUploadPart: vi.fn(unexpected),
      confirmDirectUpload: vi.fn(unexpected),
      matchSourceToOccurrence: vi.fn(unexpected),
    } as never,
    state: {
      getUploadSession: vi.fn(unexpected),
      listUploadParts: vi.fn(unexpected),
      getOccurrence: vi.fn(unexpected),
      listOccurrences: vi.fn(unexpected),
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
    idempotencyKey: `media_canary_${'e'.repeat(32)}`,
    requestHash: 'd'.repeat(64),
    expiresAt: '2026-08-05T13:00:00.000Z',
    version: 1,
    createdAt: '2026-08-04T13:00:00.000Z',
    updatedAt: '2026-08-04T13:00:00.000Z',
  };
}

function uploadPlan(session: UploadSessionRecord): MultipartUploadPlan {
  return {
    uploadSessionId: session.id,
    partBytes: CONTENT_INGEST_PART_BYTES,
    totalParts: session.totalParts,
    maxConcurrentParts: CONTENT_INGEST_MAX_CONCURRENT_PARTS,
    authorizationTtlSeconds: CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
    expiresAt: session.expiresAt,
  };
}
