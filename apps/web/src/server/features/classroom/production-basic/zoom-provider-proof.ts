import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type {
  ProductionBasicHostLifecycleStore,
  ProductionBasicVerifiedZoomLifecycleEvent,
} from './host-lifecycle-repository.ts';
import { productionBasicDigest } from './host-lifecycle-repository.ts';
import { productionBasicMeetingRefDigest } from './service.ts';
import type { ProductionBasicHostLiveMarker, ProductionBasicScope } from './service.ts';

export const PRODUCTION_BASIC_ZOOM_WEBHOOK_MAX_BYTES = 64 * 1024;
export const PRODUCTION_BASIC_ZOOM_WEBHOOK_REPLAY_WINDOW_SECONDS = 5 * 60;

const zoomLifecycleEventSchema = z.object({
  event: z.string(),
  event_ts: z.number().finite().optional(),
  payload: z.object({
    account_id: z.string().min(1).optional(),
    plainToken: z.string().min(1).max(512).optional(),
    object: z
      .object({
        id: z.union([z.string(), z.number()]),
        uuid: z.string().min(1).max(512),
        host_id: z.string().min(1).max(512),
        start_time: z.string().datetime({ offset: true }),
        end_time: z.string().datetime({ offset: true }).optional(),
      })
      .optional(),
  }),
});

export type ProductionBasicZoomWebhookResult = {
  status: 200 | 202 | 400 | 401 | 403 | 413 | 415 | 503;
  body:
    | { plainToken: string; encryptedToken: string }
    | { ok: true; disposition: 'accepted' | 'duplicate' | 'ignored' }
    | { ok: false; code: string };
};

export async function receiveProductionBasicZoomWebhook(input: {
  config: AppConfig;
  lifecycle: ProductionBasicHostLifecycleStore;
  liveMarker: ProductionBasicHostLiveMarker;
  rawBody: Buffer | unknown;
  contentType: string | null | undefined;
  timestampHeader: string | null | undefined;
  signatureHeader: string | null | undefined;
  requestId?: string | null | undefined;
  clock?: (() => Date) | undefined;
}): Promise<ProductionBasicZoomWebhookResult> {
  const secret = input.config.zoomWebhookSecretToken;
  if (!secret) return failure(503, 'ZOOM_PROVIDER_PROOF_UNAVAILABLE');
  if (!/^application\/json(?:\s*;|$)/iu.test(input.contentType ?? '')) {
    return failure(415, 'ZOOM_WEBHOOK_CONTENT_TYPE_REQUIRED');
  }
  if (!Buffer.isBuffer(input.rawBody)) return failure(400, 'ZOOM_WEBHOOK_RAW_BODY_REQUIRED');
  if (input.rawBody.byteLength > PRODUCTION_BASIC_ZOOM_WEBHOOK_MAX_BYTES) {
    return failure(413, 'ZOOM_WEBHOOK_BODY_TOO_LARGE');
  }
  const now = input.clock?.() ?? new Date();
  const verification = verifyProductionBasicZoomWebhookSignature({
    rawBody: input.rawBody,
    timestampHeader: input.timestampHeader,
    signatureHeader: input.signatureHeader,
    secret,
    now,
  });
  if (!verification.ok) {
    return failure(
      verification.reason === 'stale_timestamp' ? 403 : 401,
      verification.reason === 'stale_timestamp'
        ? 'ZOOM_WEBHOOK_STALE_TIMESTAMP'
        : 'ZOOM_WEBHOOK_INVALID_SIGNATURE',
    );
  }

  const parsed = parseEvent(input.rawBody);
  if (!parsed) return failure(400, 'ZOOM_WEBHOOK_INVALID_JSON');
  if (parsed.event === 'endpoint.url_validation') {
    const plainToken = parsed.payload.plainToken;
    if (!plainToken) return failure(400, 'ZOOM_WEBHOOK_INVALID_CHALLENGE');
    return {
      status: 200,
      body: {
        plainToken,
        encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex'),
      },
    };
  }
  if (parsed.event !== 'meeting.started' && parsed.event !== 'meeting.ended') {
    return { status: 202, body: { ok: true, disposition: 'ignored' } };
  }

  const object = parsed.payload.object;
  const configuredAccount = input.config.zoomAccountId;
  const configuredHost = input.config.zoomHostUserId;
  const configuredMeeting = input.config.zoomRealControlMeetingId;
  if (!configuredAccount || !configuredHost || !configuredMeeting || !object) {
    return failure(503, 'ZOOM_PROVIDER_PROOF_UNAVAILABLE');
  }
  if (
    parsed.payload.account_id !== configuredAccount ||
    object.host_id !== configuredHost ||
    canonicalMeetingNumber(String(object.id)) !== canonicalMeetingNumber(configuredMeeting)
  ) {
    return failure(403, 'ZOOM_WEBHOOK_AUTHORITY_MISMATCH');
  }

  const meetingStartedAt = new Date(object.start_time);
  const meetingEndedAt = object.end_time ? new Date(object.end_time) : null;
  const providerEventAt = providerEventDate(parsed.event_ts, meetingEndedAt ?? meetingStartedAt);
  if (
    !Number.isFinite(meetingStartedAt.getTime()) ||
    (meetingEndedAt && !Number.isFinite(meetingEndedAt.getTime())) ||
    !Number.isFinite(providerEventAt.getTime())
  ) {
    return failure(400, 'ZOOM_WEBHOOK_INVALID_EVENT_TIME');
  }

  const scope: ProductionBasicScope = {
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
  };
  const event: ProductionBasicVerifiedZoomLifecycleEvent = {
    providerEventKeyDigest: productionBasicProviderEventKeyDigest({
      rawBody: input.rawBody,
      requestId: input.requestId ?? '',
    }),
    providerAccountRefDigest: productionBasicDigest('zoom-account-v1', configuredAccount),
    providerHostRefDigest: productionBasicDigest('zoom-host-v1', configuredHost),
    meetingRefDigest: productionBasicMeetingRefDigest(configuredMeeting),
    meetingInstanceDigest: productionBasicDigest('zoom-meeting-instance-v1', object.uuid),
    eventType: parsed.event === 'meeting.started' ? 'meeting_started' : 'meeting_ended',
    providerEventAt,
    meetingStartedAt,
    meetingEndedAt: parsed.event === 'meeting.ended' ? (meetingEndedAt ?? providerEventAt) : null,
    receivedAt: now,
  };
  const recorded = await input.lifecycle.recordVerifiedProviderEvent({ scope, event });
  if (recorded.cleanupTarget) {
    const target = await input.lifecycle.beginProviderCleanup(recorded.cleanupTarget);
    if (target) {
      try {
        await input.liveMarker.clear({
          scope: target.scope,
          meeting_ref_digest: target.meetingRefDigest,
          occurrence_key: target.occurrenceKey,
          cleared_at: target.clearedAt,
        });
        await input.lifecycle.finishProviderCleanup(target, true);
      } catch {
        await input.lifecycle.finishProviderCleanup(target, false);
      }
    }
  }
  return {
    status: 202,
    body: { ok: true, disposition: recorded.duplicate ? 'duplicate' : 'accepted' },
  };
}

export function verifyProductionBasicZoomWebhookSignature(input: {
  rawBody: Buffer;
  timestampHeader: string | null | undefined;
  signatureHeader: string | null | undefined;
  secret: string;
  now: Date;
}) {
  if (!/^\d{10}$/u.test(input.timestampHeader ?? '')) {
    return { ok: false as const, reason: 'invalid_signature' as const };
  }
  const timestamp = Number(input.timestampHeader);
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestamp) > PRODUCTION_BASIC_ZOOM_WEBHOOK_REPLAY_WINDOW_SECONDS) {
    return { ok: false as const, reason: 'stale_timestamp' as const };
  }
  const hmac = createHmac('sha256', input.secret);
  hmac.update(Buffer.from(`v0:${input.timestampHeader}:`, 'utf8'));
  hmac.update(input.rawBody);
  const expected = `v0=${hmac.digest('hex')}`;
  const supplied = input.signatureHeader ?? '';
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(supplied, 'utf8');
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false as const, reason: 'invalid_signature' as const };
  }
  return { ok: true as const };
}

function parseEvent(rawBody: Buffer) {
  try {
    return zoomLifecycleEventSchema.parse(JSON.parse(rawBody.toString('utf8')));
  } catch {
    return null;
  }
}

function providerEventDate(eventTimestamp: number | undefined, fallback: Date) {
  if (eventTimestamp === undefined) return fallback;
  return new Date(eventTimestamp > 10_000_000_000 ? eventTimestamp : eventTimestamp * 1000);
}

function canonicalMeetingNumber(value: string) {
  return value.replace(/[\s-]/gu, '');
}

function productionBasicProviderEventKeyDigest(input: { rawBody: Buffer; requestId: string }) {
  const rawDigest = createHash('sha256').update(input.rawBody).digest('hex');
  return productionBasicDigest('zoom-provider-event-v1', `${input.requestId}\0${rawDigest}`);
}

function failure(
  status: 400 | 401 | 403 | 413 | 415 | 503,
  code: string,
): ProductionBasicZoomWebhookResult {
  return { status, body: { ok: false, code } };
}
