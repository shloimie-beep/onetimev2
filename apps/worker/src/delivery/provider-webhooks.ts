import { createHmac } from 'node:crypto';
import {
  buildProviderEventRecord,
  normalizeResendEventState,
  normalizeWapiEventState,
} from '../../../../packages/domain/src/providers/provider-events.ts';
import { constantTimeEqual } from '../../../../packages/domain/src/providers/shared.ts';

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
  signatureHeader?: string;
  secret: string;
}) {
  verifyDeliveryProviderHmac(input);
  const payload = JSON.parse(input.rawBody.toString('utf8')) as Record<string, unknown>;
  const eventType = stringValue(payload.type) ?? 'unknown';
  const providerEventRef = stringValue(payload.id) ?? stringValue(payload.message_id) ?? eventType;
  return buildProviderEventRecord({
    accountKey: input.accountKey,
    productKey: input.productKey,
    provider: 'resend',
    environment: 'staging',
    providerEventRef,
    eventType,
    canonicalState: normalizeResendEventState(eventType),
    providerCreatedAt: stringValue(payload.created_at) ?? null,
    objectRefs: {
      message_ref_hash_present: Boolean(payload.message_id),
    },
    minimizedPayload: {
      type: eventType,
      has_message_ref: Boolean(payload.message_id),
    },
  });
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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
