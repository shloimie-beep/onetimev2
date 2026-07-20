import { createHmac, timingSafeEqual } from 'node:crypto';
import type { HighLevelWebhookPayload } from '../../../contracts/src/highlevel/index.ts';
import { highLevelWebhookPayloadSchema } from '../../../contracts/src/highlevel/index.ts';
import type { Queryable } from '../../../db/src/index.ts';
import type { HighLevelRuntimeConfig } from './config.ts';
import { stableDigest } from './normalization.ts';

export const HIGHLEVEL_ALLOWED_WEBHOOK_EVENTS = new Set([
  'subscription.active',
  'payment.succeeded',
  'payment.failed',
  'payment.recovered',
  'subscription.canceled',
  'refund.full',
  'chargeback',
]);

export type HighLevelWebhookHeaders = {
  contentType?: string | undefined;
  signature?: string | undefined;
  timestamp?: string | undefined;
  eventId?: string | undefined;
};

export function verifyHighLevelWebhook(input: {
  config: HighLevelRuntimeConfig;
  rawBody: Buffer;
  headers: HighLevelWebhookHeaders;
  now?: Date | undefined;
}):
  | { ok: true; payload: HighLevelWebhookPayload; digest: string }
  | { ok: false; code: string; status: number } {
  if (input.headers.contentType !== 'application/json') {
    return { ok: false, code: 'CONTENT_TYPE_REJECTED', status: 415 };
  }
  if (input.rawBody.byteLength > 128 * 1024) {
    return { ok: false, code: 'BODY_TOO_LARGE', status: 413 };
  }
  if (!input.config.highLevelOutboundWebhookSecret) {
    return { ok: false, code: 'WEBHOOK_SECRET_MISSING', status: 503 };
  }
  if (!input.headers.signature || !input.headers.timestamp) {
    return { ok: false, code: 'SIGNATURE_HEADERS_REQUIRED', status: 401 };
  }
  const timestamp = Number(input.headers.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, code: 'TIMESTAMP_INVALID', status: 401 };
  const skew = Math.abs(Math.floor((input.now ?? new Date()).getTime() / 1000) - timestamp);
  if (skew > 300) return { ok: false, code: 'TIMESTAMP_OUT_OF_RANGE', status: 401 };
  const expected = signHighLevelWebhook({
    rawBody: input.rawBody,
    timestamp: input.headers.timestamp,
    secret: input.config.highLevelOutboundWebhookSecret,
  });
  if (!constantTimeStringEqual(input.headers.signature, expected)) {
    return { ok: false, code: 'SIGNATURE_INVALID', status: 401 };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody.toString('utf8'));
  } catch {
    return { ok: false, code: 'JSON_INVALID', status: 400 };
  }
  const payload = highLevelWebhookPayloadSchema.safeParse(parsedJson);
  if (!payload.success) return { ok: false, code: 'PAYLOAD_INVALID', status: 422 };
  if (!HIGHLEVEL_ALLOWED_WEBHOOK_EVENTS.has(payload.data.event_type)) {
    return { ok: false, code: 'EVENT_TYPE_REJECTED', status: 422 };
  }
  if (input.headers.eventId && input.headers.eventId !== payload.data.provider_event_id) {
    return { ok: false, code: 'EVENT_ID_MISMATCH', status: 409 };
  }
  return { ok: true, payload: payload.data, digest: stableDigest(payload.data) };
}

export function signHighLevelWebhook(input: {
  rawBody: Buffer;
  timestamp: string;
  secret: string;
}) {
  return `v1=${createHmac('sha256', input.secret)
    .update(`${input.timestamp}.`)
    .update(input.rawBody)
    .digest('hex')}`;
}

export async function recordHighLevelWebhookInbox(input: {
  target: Queryable;
  payload: HighLevelWebhookPayload;
  payloadDigest: string;
  receivedAt: Date;
}) {
  const result = await input.target.query(
    `INSERT INTO onetime.highlevel_event_inbox
     (provider_event_id, event_type, ghl_contact_id, ghl_subscription_id, payload_digest,
      received_at, disposition, dedupe_state, replay_state, out_of_order_state, minimized_payload)
     VALUES ($1,$2,$3,$4,$5,$6::timestamptz,'queued','first_seen','not_replayed','not_detected',$7::jsonb)
     ON CONFLICT (provider_event_id)
     DO UPDATE SET dedupe_state = 'duplicate', replay_state = 'replayed'
     RETURNING dedupe_state`,
    [
      input.payload.provider_event_id,
      input.payload.event_type,
      input.payload.contact_id,
      input.payload.subscription_id,
      input.payloadDigest,
      input.receivedAt.toISOString(),
      JSON.stringify({
        event_type: input.payload.event_type,
        contact_id_present: Boolean(input.payload.contact_id),
        subscription_id_present: Boolean(input.payload.subscription_id),
        transaction_id_present: Boolean(input.payload.transaction_id),
        occurred_at: input.payload.occurred_at,
      }),
    ],
  );
  return String(result.rows[0]?.dedupe_state ?? 'first_seen');
}

function constantTimeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
