import { createHmac, timingSafeEqual, verify } from 'node:crypto';

export const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export function verifyWorkflowSharedSecret(supplied: string | undefined, expected: string) {
  if (!supplied || expected.length < 16) return false;
  const left = Buffer.from(createHmac('sha256', expected).update(supplied).digest('hex'));
  const right = Buffer.from(createHmac('sha256', expected).update(expected).digest('hex'));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyGhlEd25519Signature(
  rawBody: Uint8Array,
  signature: string | undefined,
  publicKey = GHL_ED25519_PUBLIC_KEY,
) {
  if (!signature || signature === 'N/A') return false;
  try {
    const decoded = Buffer.from(signature, 'base64');
    return decoded.length === 64 && verify(null, Buffer.from(rawBody), publicKey, decoded);
  } catch {
    return false;
  }
}

export function signReplyCopilotAction(
  actionId: string,
  actionCode: string,
  version: number,
  secret: string,
) {
  return createHmac('sha256', secret)
    .update(`${actionId}.${actionCode}.${version}`)
    .digest('base64url')
    .slice(0, 12);
}

export function verifyReplyCopilotActionSignature(input: {
  actionId: string;
  actionCode: string;
  version: number;
  signature: string;
  secret: string;
}) {
  const expected = signReplyCopilotAction(
    input.actionId,
    input.actionCode,
    input.version,
    input.secret,
  );
  const left = Buffer.from(input.signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
