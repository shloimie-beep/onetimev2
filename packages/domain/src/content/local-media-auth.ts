import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;
const NONCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,179}$/;
const TARGET_PREFIX = '/api/v1/admin/content/local-runner';

export type LocalMediaSignedRequest = {
  method: string;
  requestTarget: string;
  timestamp: string;
  nonce: string;
  body: string;
};

export function localMediaBodySha256(body: string) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function buildLocalMediaSignature(key: string, request: LocalMediaSignedRequest) {
  if (key.trim().length < 32) throw new Error('local_media_signing_key_required');
  const canonical = canonicalSignedRequest(request);
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}

export function verifyLocalMediaSignature(input: {
  key: string;
  request: LocalMediaSignedRequest;
  signature: string;
  now?: Date;
  maximumClockSkewMs?: number;
}) {
  if (!SIGNATURE_PATTERN.test(input.signature)) return false;
  const timestampMs = Number(input.request.timestamp);
  const nowMs = (input.now ?? new Date()).getTime();
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(nowMs - timestampMs) > (input.maximumClockSkewMs ?? 5 * 60_000)
  ) {
    return false;
  }
  let expected: string;
  try {
    expected = buildLocalMediaSignature(input.key, input.request);
  } catch {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.signature, 'hex'));
}

function canonicalSignedRequest(request: LocalMediaSignedRequest) {
  const method = request.method.trim().toUpperCase();
  const target = request.requestTarget.trim();
  if (!/^[A-Z]+$/.test(method)) throw new Error('local_media_method_invalid');
  if (
    !target.startsWith(TARGET_PREFIX) ||
    target.includes('\n') ||
    target.includes('\r') ||
    target.includes('://')
  ) {
    throw new Error('local_media_request_target_invalid');
  }
  if (!/^\d{13}$/.test(request.timestamp)) throw new Error('local_media_timestamp_invalid');
  if (!NONCE_PATTERN.test(request.nonce)) throw new Error('local_media_nonce_invalid');
  return [
    'ONE-TIME-LOCAL-MEDIA-SIGNATURE-V1',
    method,
    target,
    request.timestamp,
    request.nonce,
    localMediaBodySha256(request.body),
  ].join('\n');
}
