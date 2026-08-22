import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import type { ProductionBasicHostLifecycleStore } from '../../../apps/web/src/server/features/classroom/production-basic/host-lifecycle-repository.ts';
import {
  PRODUCTION_BASIC_ZOOM_WEBHOOK_MAX_BYTES,
  receiveProductionBasicZoomWebhook,
} from '../../../apps/web/src/server/features/classroom/production-basic/zoom-provider-proof.ts';
import type { ProductionBasicHostLiveMarker } from '../../../apps/web/src/server/features/classroom/production-basic/service.ts';

const now = new Date('2026-08-22T16:05:00.000Z');
const timestamp = String(Math.floor(now.getTime() / 1000));
const secret = 'synthetic_zoom_webhook_secret_token';
const accountId = 'synthetic-account';
const hostId = 'synthetic-host';
const meetingId = '12345678901';
const instanceUuid = 'synthetic-instance-uuid';

describe('production-basic verified Zoom provider proof', () => {
  it('answers a valid signed endpoint validation challenge without persistence', async () => {
    const rawBody = body({
      event: 'endpoint.url_validation',
      payload: { plainToken: 'synthetic-plain-token' },
    });
    const harness = createHarness();
    const result = await receive(harness, rawBody);

    expect(result).toEqual({
      status: 200,
      body: {
        plainToken: 'synthetic-plain-token',
        encryptedToken: createHmac('sha256', secret).update('synthetic-plain-token').digest('hex'),
      },
    });
    expect(harness.lifecycle.recordVerifiedProviderEvent).not.toHaveBeenCalled();
  });

  it('accepts a valid started event and passes only domain-separated digests to storage', async () => {
    const rawBody = lifecycleBody('meeting.started');
    const harness = createHarness();
    const result = await receive(harness, rawBody);

    expect(result).toEqual({
      status: 202,
      body: { ok: true, disposition: 'accepted' },
    });
    const recorded = vi.mocked(harness.lifecycle.recordVerifiedProviderEvent).mock.calls[0]![0];
    expect(recorded.event).toMatchObject({
      eventType: 'meeting_started',
      providerEventAt: new Date('2026-08-22T16:00:00.000Z'),
      meetingStartedAt: new Date('2026-08-22T16:00:00.000Z'),
      meetingEndedAt: null,
    });
    expect(Object.values(recorded.event).filter((value) => typeof value === 'string')).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/u)]),
    );
    const storedShape = JSON.stringify(recorded);
    for (const raw of [accountId, hostId, meetingId, instanceUuid]) {
      expect(storedShape).not.toContain(raw);
    }
  });

  it('persists exact ended proof before one proof-bound local cleanup', async () => {
    const target = {
      scope: { account_key: 'one_time', product_key: 'one_time_mishnah_class' },
      occurrenceKey: 'occurrence-one',
      meetingRefDigest: 'a'.repeat(64),
      meetingInstanceDigest: 'b'.repeat(64),
      clearedAt: new Date('2026-08-22T16:30:00.000Z'),
    };
    const harness = createHarness({ cleanupTarget: target });
    const result = await receive(harness, lifecycleBody('meeting.ended'));

    expect(result.status).toBe(202);
    expect(harness.lifecycle.recordVerifiedProviderEvent).toHaveBeenCalledOnce();
    expect(harness.lifecycle.beginProviderCleanup).toHaveBeenCalledWith(target);
    expect(harness.liveMarker.clear).toHaveBeenCalledWith({
      scope: target.scope,
      meeting_ref_digest: target.meetingRefDigest,
      occurrence_key: target.occurrenceKey,
      cleared_at: target.clearedAt,
    });
    expect(harness.lifecycle.finishProviderCleanup).toHaveBeenCalledWith(target, true);
  });

  it('keeps duplicate delivery idempotent and does not double-clear', async () => {
    const target = {
      scope: { account_key: 'one_time', product_key: 'one_time_mishnah_class' },
      occurrenceKey: 'occurrence-one',
      meetingRefDigest: 'a'.repeat(64),
      meetingInstanceDigest: 'b'.repeat(64),
      clearedAt: new Date('2026-08-22T16:30:00.000Z'),
    };
    const harness = createHarness({ cleanupTarget: target });
    vi.mocked(harness.lifecycle.recordVerifiedProviderEvent)
      .mockResolvedValueOnce({ duplicate: false, cleanupTarget: target })
      .mockResolvedValueOnce({ duplicate: true, cleanupTarget: target });
    vi.mocked(harness.lifecycle.beginProviderCleanup)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(null);
    const rawBody = lifecycleBody('meeting.ended');

    await receive(harness, rawBody);
    const duplicate = await receive(harness, rawBody);
    expect(duplicate.body).toEqual({ ok: true, disposition: 'duplicate' });
    expect(harness.liveMarker.clear).toHaveBeenCalledOnce();
  });

  it('retains cleanup-pending state when proof-bound local cleanup fails', async () => {
    const target = {
      scope: { account_key: 'one_time', product_key: 'one_time_mishnah_class' },
      occurrenceKey: 'occurrence-one',
      meetingRefDigest: 'a'.repeat(64),
      meetingInstanceDigest: 'b'.repeat(64),
      clearedAt: new Date('2026-08-22T16:30:00.000Z'),
    };
    const harness = createHarness({ cleanupTarget: target });
    vi.mocked(harness.liveMarker.clear).mockRejectedValueOnce(new Error('synthetic local failure'));

    const result = await receive(harness, lifecycleBody('meeting.ended'));

    expect(result.status).toBe(202);
    expect(harness.lifecycle.finishProviderCleanup).toHaveBeenCalledWith(target, false);
  });

  it('fails closed for provider-off, signatures, replay, content type, size, and authority mismatch', async () => {
    const rawBody = lifecycleBody('meeting.started');
    const harness = createHarness();
    const cases = [
      receive(harness, rawBody, { signatureHeader: 'v0=invalid' }),
      receive(harness, rawBody, { timestampHeader: String(Number(timestamp) - 301) }),
      receive(harness, rawBody, { contentType: 'text/plain' }),
      receive(harness, Buffer.alloc(PRODUCTION_BASIC_ZOOM_WEBHOOK_MAX_BYTES + 1)),
      receive(harness, lifecycleBody('meeting.started', { account_id: 'wrong-account' })),
      receive(
        harness,
        lifecycleBody('meeting.started', {
          object: lifecycleObject({ host_id: 'wrong-host' }),
        }),
      ),
      receive(
        harness,
        lifecycleBody('meeting.started', {
          object: lifecycleObject({ id: '99999999999' }),
        }),
      ),
      receive(createHarness({ webhookSecret: undefined }), rawBody),
    ];
    const results = await Promise.all(cases);
    expect(results.map((result) => result.status)).toEqual([
      401, 403, 415, 413, 403, 403, 403, 503,
    ]);
    expect(harness.lifecycle.recordVerifiedProviderEvent).not.toHaveBeenCalled();
  });

  it('ignores every event outside the lifecycle allowlist without persistence', async () => {
    const harness = createHarness();
    const result = await receive(
      harness,
      body({ event: 'meeting.participant_joined', payload: {} }),
    );
    expect(result).toEqual({
      status: 202,
      body: { ok: true, disposition: 'ignored' },
    });
    expect(harness.lifecycle.recordVerifiedProviderEvent).not.toHaveBeenCalled();
  });
});

function createHarness(
  input: {
    cleanupTarget?: Awaited<ReturnType<ProductionBasicHostLifecycleStore['beginProviderCleanup']>>;
    webhookSecret?: string | undefined;
  } = {},
) {
  const lifecycle = {
    createLive: vi.fn(),
    beginEnd: vi.fn(),
    markUnknown: vi.fn(),
    read: vi.fn(),
    reconcile: vi.fn(),
    beginCleanup: vi.fn(),
    finishCleanup: vi.fn(),
    markCleanupPending: vi.fn(),
    recordVerifiedProviderEvent: vi.fn<
      ProductionBasicHostLifecycleStore['recordVerifiedProviderEvent']
    >(async () => ({
      duplicate: false,
      cleanupTarget: input.cleanupTarget ?? null,
    })),
    beginProviderCleanup: vi.fn(async (target) => target),
    finishProviderCleanup: vi.fn(async () => undefined),
  } satisfies ProductionBasicHostLifecycleStore;
  const liveMarker = {
    confirm: vi.fn(async () => true),
    currentForStudent: vi.fn(async () => true),
    currentForParent: vi.fn(async () => true),
    clear: vi.fn(async () => undefined),
  } satisfies ProductionBasicHostLiveMarker;
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    ZOOM_S2S_ACCOUNT_ID: accountId,
    ZOOM_HOST_USER_ID: hostId,
    ZOOM_REAL_CONTROL_MEETING_ID: meetingId,
  };
  const webhookSecret = 'webhookSecret' in input ? input.webhookSecret : secret;
  if (webhookSecret) source.ZOOM_WEBHOOK_SECRET_TOKEN = webhookSecret;
  return { config: loadConfig(source), lifecycle, liveMarker };
}

async function receive(
  harness: ReturnType<typeof createHarness>,
  rawBody: Buffer,
  overrides: {
    timestampHeader?: string;
    signatureHeader?: string;
    contentType?: string;
  } = {},
) {
  const timestampHeader = overrides.timestampHeader ?? timestamp;
  return receiveProductionBasicZoomWebhook({
    ...harness,
    rawBody,
    contentType: overrides.contentType ?? 'application/json',
    timestampHeader,
    signatureHeader: overrides.signatureHeader ?? sign(rawBody, timestampHeader),
    requestId: 'synthetic-request-id',
    clock: () => now,
  });
}

function lifecycleBody(
  event: 'meeting.started' | 'meeting.ended',
  payloadOverrides: Record<string, unknown> = {},
) {
  return body({
    event,
    event_ts: Date.parse(
      event === 'meeting.started' ? '2026-08-22T16:00:00.000Z' : '2026-08-22T16:30:00.000Z',
    ),
    payload: {
      account_id: accountId,
      object: lifecycleObject(
        event === 'meeting.ended' ? { end_time: '2026-08-22T16:30:00.000Z' } : {},
      ),
      ...payloadOverrides,
    },
  });
}

function lifecycleObject(overrides: Record<string, unknown> = {}) {
  return {
    id: meetingId,
    uuid: instanceUuid,
    host_id: hostId,
    start_time: '2026-08-22T16:00:00.000Z',
    ...overrides,
  };
}

function body(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function sign(rawBody: Buffer, timestampHeader: string) {
  const hmac = createHmac('sha256', secret);
  hmac.update(Buffer.from(`v0:${timestampHeader}:`, 'utf8'));
  hmac.update(rawBody);
  return `v0=${hmac.digest('hex')}`;
}
