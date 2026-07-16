import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const OT89_EVENT_TARGET = '/api/internal/integrations/onetime/support-events/v1';
export const OT89_STATUS_TARGET = '/api/internal/integrations/onetime/support-ticket-status/v1';
export const OT89_ATTACHMENT_TARGET_PREFIX = '/api/internal/support/attachments/v1/';
export const OT89_TIMESTAMP_SKEW_SECONDS = 300;

export type Ot89SigningInput = {
  method: string;
  requestTarget: string;
  timestamp: string;
  nonce: string;
  rawBody: Buffer | string;
  secret: string;
};

export type Ot89Headers = {
  keyId?: string | undefined;
  timestamp?: string | undefined;
  nonce?: string | undefined;
  signature?: string | undefined;
  eventId?: string | undefined;
};

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function ot89CanonicalString(input: Omit<Ot89SigningInput, 'secret'>): string {
  return [
    input.method.toUpperCase(),
    input.requestTarget,
    input.timestamp,
    input.nonce,
    sha256Hex(input.rawBody),
  ].join('\n');
}

export function signOt89Request(input: Ot89SigningInput): string {
  return `v1=${createHmac('sha256', input.secret)
    .update(ot89CanonicalString(input))
    .digest('hex')}`;
}

export function createOt89Nonce(): string {
  return randomBytes(24).toString('base64url');
}

export function createOt89SignedHeaders(input: {
  keyId: string;
  secret: string;
  method: string;
  requestTarget: string;
  rawBody: Buffer | string;
  eventId?: string | undefined;
  now?: Date | undefined;
  nonce?: string | undefined;
}): Record<string, string> {
  const timestamp = Math.floor((input.now ?? new Date()).getTime() / 1000).toString();
  const nonce = input.nonce ?? createOt89Nonce();
  const signature = signOt89Request({
    method: input.method,
    requestTarget: input.requestTarget,
    timestamp,
    nonce,
    rawBody: input.rawBody,
    secret: input.secret,
  });
  return {
    'X-OT89-Key-Id': input.keyId,
    'X-OT89-Timestamp': timestamp,
    'X-OT89-Nonce': nonce,
    'X-OT89-Signature': signature,
    ...(input.eventId ? { 'X-OT89-Event-Id': input.eventId } : {}),
  };
}

export type Ot89VerificationResult =
  { ok: true; bodyFingerprint: string } | { ok: false; code: string; status: number };

export function verifyOt89Signature(input: {
  expectedKeyId: string;
  secret: string;
  method: string;
  requestTarget: string;
  rawBody: Buffer;
  headers: Ot89Headers;
  now?: Date | undefined;
}): Ot89VerificationResult {
  const { keyId, timestamp, nonce, signature } = input.headers;
  if (!keyId || !timestamp || !nonce || !signature) {
    return { ok: false, code: 'SIGNING_HEADERS_REQUIRED', status: 401 };
  }
  if (keyId !== input.expectedKeyId) {
    return { ok: false, code: 'KEY_ID_REJECTED', status: 401 };
  }
  if (!/^\d{10,}$/.test(timestamp)) {
    return { ok: false, code: 'TIMESTAMP_INVALID', status: 401 };
  }
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce)) {
    return { ok: false, code: 'NONCE_INVALID', status: 401 };
  }
  if (!/^v1=[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, code: 'SIGNATURE_INVALID', status: 401 };
  }
  const skew = Math.abs(Math.floor((input.now ?? new Date()).getTime() / 1000) - Number(timestamp));
  if (skew > OT89_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, code: 'TIMESTAMP_OUT_OF_RANGE', status: 401 };
  }
  const expected = signOt89Request({
    method: input.method,
    requestTarget: input.requestTarget,
    timestamp,
    nonce,
    rawBody: input.rawBody,
    secret: input.secret,
  });
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, code: 'SIGNATURE_INVALID', status: 401 };
  }
  return { ok: true, bodyFingerprint: sha256Hex(input.rawBody) };
}
