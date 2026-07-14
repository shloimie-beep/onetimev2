import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  SensitivePayloadCodec,
  SensitivePayloadContext,
  SensitivePayloadRef,
} from '../../../contracts/src/telegram/types.ts';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableDigest(parts: Array<string | number | boolean | null | undefined>) {
  return sha256(parts.map((part) => String(part ?? '')).join('\u001f'));
}

export function constantTimeStringEqual(left: string, right: string) {
  const leftDigest = Buffer.from(sha256(left), 'hex');
  const rightDigest = Buffer.from(sha256(right), 'hex');
  return timingSafeEqual(leftDigest, rightDigest);
}

export function correlationKey(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export class DeterministicTestPayloadCodec implements SensitivePayloadCodec {
  async encrypt(payload: unknown, context: SensitivePayloadContext): Promise<SensitivePayloadRef> {
    const json = JSON.stringify(payload);
    return {
      ciphertext: Buffer.from(json, 'utf8').toString('base64url'),
      digest: stableDigest([context.botKey, context.environment, context.classification, json]),
      classification: context.classification,
    };
  }

  async decrypt(ref: SensitivePayloadRef, _context: SensitivePayloadContext): Promise<unknown> {
    return JSON.parse(Buffer.from(ref.ciphertext, 'base64url').toString('utf8')) as unknown;
  }
}
