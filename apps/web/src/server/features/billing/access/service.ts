import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  BillingAccessRepository,
  BillingEventKind,
  BillingProjectionResult,
  VerifiedBillingEvent,
} from '../../../../../../../packages/contracts/src/billing/access/index.ts';
import {
  BILLING_EVENT_KINDS,
  BILLING_WEBHOOK_MAX_BYTES,
  BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_MS,
} from '../../../../../../../packages/contracts/src/billing/access/index.ts';
import { BillingAccessError } from '../../../../../../../packages/domain/src/billing/access/index.ts';

export interface ReceiveSignedBillingEventInput {
  raw_body: string | Buffer;
  signature_header: string;
  signing_secret: string;
  received_at: Date;
  repository: BillingAccessRepository;
}

export async function receiveSignedBillingEvent(
  input: ReceiveSignedBillingEventInput,
): Promise<BillingProjectionResult> {
  const body = Buffer.isBuffer(input.raw_body)
    ? input.raw_body
    : Buffer.from(input.raw_body, 'utf8');
  if (body.byteLength === 0 || body.byteLength > BILLING_WEBHOOK_MAX_BYTES) {
    throw new BillingAccessError(
      'invalid_contract',
      'Signed billing event body size is outside the accepted bound.',
    );
  }
  const timestamp = verifyStripeStyleSignature({
    body,
    signatureHeader: input.signature_header,
    secret: input.signing_secret,
    now: input.received_at,
  });
  const payloadDigest = createHash('sha256').update(body).digest('hex');
  const event = parseVerifiedBillingEvent(body, payloadDigest);
  if (Math.abs(Date.parse(event.occurred_at) - timestamp.getTime()) > 24 * 60 * 60 * 1_000) {
    throw new BillingAccessError(
      'invalid_contract',
      'Signed billing event occurrence is not bound to its signature time.',
    );
  }
  return input.repository.projectVerifiedEvent(event, input.received_at);
}

export function verifyStripeStyleSignature(input: {
  body: Buffer;
  signatureHeader: string;
  secret: string;
  now: Date;
}): Date {
  if (input.secret.trim() === '') {
    throw new BillingAccessError('signature_invalid', 'Billing signature is invalid.');
  }
  const fields = input.signatureHeader.split(',').map((part) => part.trim().split('=', 2));
  const timestampValue = fields.find(([key]) => key === 't')?.[1];
  const signatures = fields
    .filter(([key, value]) => key === 'v1' && value !== undefined)
    .map(([, value]) => value as string);
  const timestampSeconds = Number(timestampValue);
  if (!Number.isSafeInteger(timestampSeconds) || signatures.length === 0) {
    throw new BillingAccessError('signature_invalid', 'Billing signature is invalid.');
  }
  const timestamp = new Date(timestampSeconds * 1_000);
  if (
    Math.abs(input.now.getTime() - timestamp.getTime()) > BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_MS
  ) {
    throw new BillingAccessError('signature_stale', 'Billing signature is outside its time bound.');
  }
  const expected = createHmac('sha256', input.secret)
    .update(`${timestampSeconds}.`, 'utf8')
    .update(input.body)
    .digest();
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  });
  if (!valid) {
    throw new BillingAccessError('signature_invalid', 'Billing signature is invalid.');
  }
  return timestamp;
}

function parseVerifiedBillingEvent(body: Buffer, payloadDigest: string): VerifiedBillingEvent {
  let value: unknown;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    throw new BillingAccessError('invalid_contract', 'Billing event JSON is invalid.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BillingAccessError('invalid_contract', 'Billing event contract is invalid.');
  }
  const record = value as Record<string, unknown>;
  const kind = requiredString(record.kind, 'kind');
  if (!BILLING_EVENT_KINDS.includes(kind as BillingEventKind)) {
    throw new BillingAccessError('invalid_contract', 'Billing event kind is invalid.');
  }
  return {
    event_id: requiredString(record.event_id, 'event_id'),
    provider: 'stripe',
    household_id: requiredString(record.household_id, 'household_id'),
    provider_customer_ref_hash: requiredString(
      record.provider_customer_ref_hash,
      'provider_customer_ref_hash',
    ),
    billing_term_id: requiredString(record.billing_term_id, 'billing_term_id'),
    kind: kind as BillingEventKind,
    occurred_at: requiredString(record.occurred_at, 'occurred_at'),
    term_ends_at: requiredString(record.term_ends_at, 'term_ends_at'),
    payload_digest: payloadDigest,
    signature_verified: true,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BillingAccessError('invalid_contract', `${field} is required.`);
  }
  return value;
}
