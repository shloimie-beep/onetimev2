import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { constantTimeEqual, redactedRefHash, stableProviderKey } from './shared.ts';

export type ZoomWebhookHeaders = {
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  requestId?: string | null | undefined;
};

export type ZoomWebhookAttendanceProjection = {
  event_key: string;
  event_type: string;
  meeting_id_digest: string | null;
  meeting_uuid_digest: string | null;
  occurrence_id: string | null;
  registrant_id_digest: string | null;
  participant_user_id_digest: string | null;
  attendance_state: 'joined' | 'left' | 'waiting' | 'unknown';
  occurred_at: string;
};

export type ZoomWebhookProcessResult =
  | {
      status: 200;
      code: 'URL_VALIDATION';
      body: { plainToken: string; encryptedToken: string };
      duplicate: false;
      projection: null;
    }
  | {
      status: 202;
      code: 'ACCEPTED' | 'DUPLICATE';
      body: { ok: true; duplicate: boolean };
      duplicate: boolean;
      projection: ZoomWebhookAttendanceProjection | null;
    }
  | {
      status: 400 | 401 | 403;
      code: 'INVALID_JSON' | 'INVALID_SIGNATURE' | 'STALE_TIMESTAMP';
      body: { ok: false; code: string };
      duplicate: false;
      projection: null;
    };

const zoomWebhookEventSchema = z.object({
  event: z.string().min(1),
  event_ts: z.number().optional(),
  payload: z
    .object({
      plainToken: z.string().optional(),
      object: z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          uuid: z.string().optional(),
          occurrence_id: z.string().optional(),
          start_time: z.string().optional(),
          participant: z
            .object({
              id: z.string().optional(),
              user_id: z.string().optional(),
              participant_user_id: z.string().optional(),
              registrant_id: z.string().optional(),
              join_time: z.string().optional(),
              leave_time: z.string().optional(),
            })
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
});

export function verifyZoomWebhookSignature(input: {
  rawBody: Buffer | string;
  headers: ZoomWebhookHeaders;
  secretToken: string;
  now?: Date | undefined;
  toleranceSeconds?: number | undefined;
}) {
  const timestamp = Number(input.headers.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false as const, reason: 'invalid_timestamp' };
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false as const, reason: 'stale_timestamp' };
  }
  const expected = zoomWebhookSignature({
    rawBody: input.rawBody,
    timestamp: String(input.headers.timestamp),
    secretToken: input.secretToken,
  });
  if (!input.headers.signature || !constantTimeEqual(expected, input.headers.signature)) {
    return { ok: false as const, reason: 'invalid_signature' };
  }
  return { ok: true as const };
}

export function zoomWebhookSignature(input: {
  rawBody: Buffer | string;
  timestamp: string;
  secretToken: string;
}) {
  const body = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody;
  const message = `v0:${input.timestamp}:${body}`;
  return `v0=${createHmac('sha256', input.secretToken).update(message).digest('hex')}`;
}

export function zoomWebhookUrlValidationToken(plainToken: string, secretToken: string) {
  return createHmac('sha256', secretToken).update(plainToken).digest('hex');
}

export function processZoomWebhook(input: {
  rawBody: Buffer | string;
  headers: ZoomWebhookHeaders;
  secretToken: string;
  now?: Date | undefined;
  seenEventKeys?: Set<string> | undefined;
}): ZoomWebhookProcessResult {
  const verified = verifyZoomWebhookSignature({
    rawBody: input.rawBody,
    headers: input.headers,
    secretToken: input.secretToken,
    now: input.now,
  });
  if (!verified.ok) {
    if (verified.reason === 'stale_timestamp') {
      return failure(403, 'STALE_TIMESTAMP');
    }
    return failure(401, 'INVALID_SIGNATURE');
  }

  const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody;
  let parsed: z.infer<typeof zoomWebhookEventSchema>;
  try {
    parsed = zoomWebhookEventSchema.parse(JSON.parse(raw));
  } catch {
    return failure(400, 'INVALID_JSON');
  }

  if (parsed.event === 'endpoint.url_validation') {
    const plainToken = parsed.payload?.plainToken;
    if (!plainToken) return failure(400, 'INVALID_JSON');
    return {
      status: 200,
      code: 'URL_VALIDATION',
      body: {
        plainToken,
        encryptedToken: zoomWebhookUrlValidationToken(plainToken, input.secretToken),
      },
      duplicate: false,
      projection: null,
    };
  }

  const projection = projectZoomWebhookAttendance(parsed, input.headers.requestId ?? null);
  const eventKey =
    projection?.event_key ??
    stableProviderKey('zoom_webhook_event', [
      parsed.event,
      String(parsed.event_ts ?? ''),
      input.headers.requestId ?? '',
      raw,
    ]);
  if (input.seenEventKeys?.has(eventKey)) {
    return {
      status: 202,
      code: 'DUPLICATE',
      body: { ok: true, duplicate: true },
      duplicate: true,
      projection,
    };
  }
  input.seenEventKeys?.add(eventKey);
  return {
    status: 202,
    code: 'ACCEPTED',
    body: { ok: true, duplicate: false },
    duplicate: false,
    projection,
  };
}

export function projectZoomWebhookAttendance(
  event: z.infer<typeof zoomWebhookEventSchema>,
  requestId?: string | null,
): ZoomWebhookAttendanceProjection | null {
  const object = event.payload?.object;
  if (!object) return null;
  const participant = object.participant;
  const occurredAt =
    participant?.join_time ??
    participant?.leave_time ??
    object.start_time ??
    (event.event_ts ? new Date(event.event_ts).toISOString() : new Date(0).toISOString());
  const meetingId = object.id === undefined ? null : String(object.id);
  const meetingUuid = object.uuid ?? null;
  const registrantId = participant?.registrant_id ?? null;
  const participantUserId =
    participant?.participant_user_id ?? participant?.user_id ?? participant?.id ?? null;
  const eventKey = stableProviderKey('zoom_webhook_event', [
    requestId ?? '',
    event.event,
    meetingUuid ?? '',
    object.occurrence_id ?? '',
    registrantId ?? '',
    participantUserId ?? '',
    occurredAt,
  ]);
  return {
    event_key: eventKey,
    event_type: event.event,
    meeting_id_digest: meetingId ? redactedRefHash(meetingId) : null,
    meeting_uuid_digest: meetingUuid ? redactedRefHash(meetingUuid) : null,
    occurrence_id: object.occurrence_id ?? null,
    registrant_id_digest: registrantId ? redactedRefHash(registrantId) : null,
    participant_user_id_digest: participantUserId ? redactedRefHash(participantUserId) : null,
    attendance_state: attendanceStateFor(event.event),
    occurred_at: new Date(occurredAt).toISOString(),
  };
}

function attendanceStateFor(
  eventType: string,
): ZoomWebhookAttendanceProjection['attendance_state'] {
  if (/participant_joined$/i.test(eventType)) return 'joined';
  if (/participant_left$/i.test(eventType)) return 'left';
  if (/jbh_waiting/i.test(eventType)) return 'waiting';
  return 'unknown';
}

function failure(
  status: 400 | 401 | 403,
  code: ZoomWebhookProcessResult['code'] & string,
): ZoomWebhookProcessResult {
  return {
    status,
    code: code as never,
    body: { ok: false, code },
    duplicate: false,
    projection: null,
  };
}
