import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  buildProviderEventRecord,
  normalizeResendEventState,
  normalizeWapiEventState,
} from '../../../../packages/domain/src/providers/provider-events.ts';
import {
  constantTimeEqual,
  redactedRefHash,
  sha256Hex,
} from '../../../../packages/domain/src/providers/shared.ts';

export type WebhookDisposition =
  'accepted' | 'duplicated' | 'replayed' | 'digest_mismatch' | 'out_of_order';

export class ProviderWebhookConformanceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export type ResendSvixHeaders = {
  id?: string | undefined;
  timestamp?: string | undefined;
  signature?: string | undefined;
};

export type ProviderWebhookLedger = {
  record(input: {
    provider: 'resend';
    svixId: string;
    providerEventRef: string;
    rawBodyDigest: string;
    orderingKey?: string | undefined;
    providerCreatedAt?: string | null | undefined;
  }): WebhookDisposition;
};

export class InMemoryProviderWebhookLedger implements ProviderWebhookLedger {
  private readonly svixMessages = new Map<string, string>();
  private readonly providerEvents = new Map<string, string>();
  private readonly ordering = new Map<string, string>();

  record(input: {
    provider: 'resend';
    svixId: string;
    providerEventRef: string;
    rawBodyDigest: string;
    orderingKey?: string | undefined;
    providerCreatedAt?: string | null | undefined;
  }): WebhookDisposition {
    const messageDigest = this.svixMessages.get(input.svixId);
    if (messageDigest === input.rawBodyDigest) return 'replayed';
    if (messageDigest && messageDigest !== input.rawBodyDigest) return 'digest_mismatch';
    this.svixMessages.set(input.svixId, input.rawBodyDigest);

    const eventKey = `${input.provider}:${input.providerEventRef}`;
    const eventDigest = this.providerEvents.get(eventKey);
    if (eventDigest === input.rawBodyDigest) return 'duplicated';
    if (eventDigest && eventDigest !== input.rawBodyDigest) return 'digest_mismatch';
    this.providerEvents.set(eventKey, input.rawBodyDigest);

    if (input.orderingKey && input.providerCreatedAt) {
      const previous = this.ordering.get(input.orderingKey);
      if (previous && new Date(input.providerCreatedAt) < new Date(previous)) {
        return 'out_of_order';
      }
      this.ordering.set(input.orderingKey, input.providerCreatedAt);
    }

    return 'accepted';
  }
}

export function verifyDeliveryProviderHmac(input: {
  rawBody: Buffer;
  signatureHeader?: string;
  secret: string;
}) {
  if (!input.signatureHeader || !input.secret)
    throw new Error('provider_webhook_signature_missing');
  const expected = createHmac('sha256', input.secret).update(input.rawBody).digest('hex');
  const supplied = input.signatureHeader.replace(/^sha256=/i, '').trim();
  if (!constantTimeEqual(expected, supplied))
    throw new Error('provider_webhook_signature_rejected');
}

export function normalizeResendWebhookEvent(input: {
  accountKey: string;
  productKey: string;
  rawBody: Buffer;
  headers: ResendSvixHeaders;
  webhookSecret: string;
  environment?: 'test' | 'staging' | 'production' | undefined;
  now?: Date | undefined;
  toleranceSeconds?: number | undefined;
}) {
  verifyResendSvixSignature(input);
  const payload = JSON.parse(input.rawBody.toString('utf8')) as Record<string, unknown>;
  const data = objectValue(payload.data);
  const eventType = stringValue(payload.type) ?? 'unknown';
  const messageRef = stringValue(data?.email_id) ?? stringValue(payload.message_id);
  const providerEventRef = resendProviderEventRef(payload, eventType, messageRef, input.headers.id);
  const record = buildProviderEventRecord({
    accountKey: input.accountKey,
    productKey: input.productKey,
    provider: 'resend',
    environment: input.environment ?? 'staging',
    providerEventRef,
    eventType,
    canonicalState: normalizeResendEventState(eventType),
    providerCreatedAt: stringValue(payload.created_at) ?? null,
    objectRefs: {
      ...(input.headers.id ? { svix_message_ref_hash: redactedRefHash(input.headers.id) } : {}),
      ...(messageRef ? { message_ref_hash: redactedRefHash(messageRef) } : {}),
      message_ref_hash_present: Boolean(messageRef),
      svix_message_ref_hash_present: Boolean(input.headers.id),
    },
    minimizedPayload: {
      type: eventType,
      has_message_ref: Boolean(payload.message_id),
      has_svix_message_ref: Boolean(input.headers.id),
    },
  });
  return {
    ...record,
    payload_digest: sha256Hex(input.rawBody),
  };
}

export function verifyAndNormalizeResendWebhookEvent(input: {
  accountKey: string;
  productKey: string;
  rawBody: Buffer | unknown;
  contentType?: string | undefined;
  headers: ResendSvixHeaders;
  webhookSecret: string;
  environment?: 'test' | 'staging' | 'production' | undefined;
  ledger?: ProviderWebhookLedger | undefined;
  now?: Date | undefined;
  maxBytes?: number | undefined;
}) {
  assertJsonRawWebhookEnvelope({
    rawBody: input.rawBody,
    contentType: input.contentType,
    maxBytes: input.maxBytes ?? 128 * 1024,
  });
  const rawBody = input.rawBody as Buffer;
  const record = normalizeResendWebhookEvent({
    accountKey: input.accountKey,
    productKey: input.productKey,
    rawBody,
    headers: input.headers,
    webhookSecret: input.webhookSecret,
    environment: input.environment,
    now: input.now,
  });
  const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
  const data = objectValue(payload.data);
  const disposition =
    input.ledger?.record({
      provider: 'resend',
      svixId: input.headers.id ?? '',
      providerEventRef: resendProviderEventRef(
        payload,
        record.event_type,
        stringValue(data?.email_id) ?? stringValue(payload.message_id),
        input.headers.id,
      ),
      rawBodyDigest: sha256Hex(rawBody),
      orderingKey: stringValue(data?.email_id) ?? stringValue(payload.message_id),
      providerCreatedAt: stringValue(payload.created_at) ?? null,
    }) ?? 'accepted';

  return {
    disposition,
    record,
    raw_body_digest: sha256Hex(rawBody),
  };
}

function resendProviderEventRef(
  payload: Record<string, unknown>,
  eventType: string,
  messageRef: string | undefined,
  svixId: string | undefined,
) {
  return (
    stringValue(payload.id) ??
    ([messageRef, eventType, stringValue(payload.created_at)].filter(Boolean).join(':') ||
      svixId ||
      eventType)
  );
}

export function normalizeWapiWebhookEvent(input: {
  accountKey: string;
  productKey: string;
  rawBody: Buffer;
  signatureHeader?: string;
  secret: string;
}) {
  verifyDeliveryProviderHmac(input);
  const payload = JSON.parse(input.rawBody.toString('utf8')) as Record<string, unknown>;
  const eventType = stringValue(payload.event) ?? stringValue(payload.type) ?? 'unknown';
  const status = stringValue(payload.status);
  const providerEventRef = stringValue(payload.id) ?? stringValue(payload.message_id) ?? eventType;
  return buildProviderEventRecord({
    accountKey: input.accountKey,
    productKey: input.productKey,
    provider: 'one_time_wapi',
    environment: 'staging',
    providerEventRef,
    eventType,
    canonicalState: normalizeWapiEventState(eventType, status),
    providerCreatedAt: stringValue(payload.timestamp) ?? null,
    objectRefs: {
      message_ref_hash_present: Boolean(payload.message_id),
      contact_ref_hash_present: Boolean(payload.contact_id),
    },
    minimizedPayload: {
      type: eventType,
      status: status ?? 'unknown',
      has_message_ref: Boolean(payload.message_id),
    },
  });
}

export function assertJsonRawWebhookEnvelope(input: {
  rawBody: Buffer | unknown;
  contentType?: string | undefined;
  maxBytes: number;
}) {
  if (!Buffer.isBuffer(input.rawBody)) {
    throw new ProviderWebhookConformanceError('parsed_body_misuse', 400);
  }
  if (input.rawBody.byteLength > input.maxBytes) {
    throw new ProviderWebhookConformanceError('oversized', 413);
  }
  if (!isJsonContentType(input.contentType)) {
    throw new ProviderWebhookConformanceError('wrong_content_type', 415);
  }
}

export function verifyResendSvixSignature(input: {
  rawBody: Buffer;
  headers: ResendSvixHeaders;
  webhookSecret: string;
  now?: Date | undefined;
  toleranceSeconds?: number | undefined;
}) {
  const id = input.headers.id?.trim();
  const timestamp = input.headers.timestamp?.trim();
  const signatureHeader = input.headers.signature?.trim();
  if (!id || !timestamp || !signatureHeader) {
    throw new ProviderWebhookConformanceError('svix_headers_required', 400);
  }
  if (!/^\d+$/.test(timestamp)) {
    throw new ProviderWebhookConformanceError('svix_timestamp_invalid', 400);
  }
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > tolerance
  ) {
    throw new ProviderWebhookConformanceError('svix_timestamp_out_of_range', 400);
  }
  const secretBytes = svixSecretBytes(input.webhookSecret);
  const signedContent = Buffer.concat([Buffer.from(`${id}.${timestamp}.`, 'utf8'), input.rawBody]);
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest();
  const supplied = signatureHeader
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(','))
    .filter(([version, value]) => version === 'v1' && Boolean(value))
    .map(([, value]) => Buffer.from(value ?? '', 'base64'));
  if (
    supplied.length < 1 ||
    !supplied.some(
      (candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected),
    )
  ) {
    throw new ProviderWebhookConformanceError('svix_signature_rejected', 400);
  }
}

export function signResendSvixFixture(input: {
  rawBody: Buffer;
  webhookSecret: string;
  id: string;
  timestamp: number;
}) {
  const signedContent = Buffer.concat([
    Buffer.from(`${input.id}.${input.timestamp}.`, 'utf8'),
    input.rawBody,
  ]);
  const signature = createHmac('sha256', svixSecretBytes(input.webhookSecret))
    .update(signedContent)
    .digest('base64');
  return {
    id: input.id,
    timestamp: String(input.timestamp),
    signature: `v1,${signature}`,
  } satisfies ResendSvixHeaders;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function svixSecretBytes(secret: string) {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length < 16) {
    throw new ProviderWebhookConformanceError('svix_secret_invalid', 500);
  }
  return decoded;
}

function isJsonContentType(value: string | undefined) {
  if (!value) return false;
  return /^application\/json(?:\s*;|$)/i.test(value.trim());
}
