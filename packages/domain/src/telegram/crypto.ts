import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
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

export class AesGcmPayloadCodec implements SensitivePayloadCodec {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }

  async encrypt(payload: unknown, context: SensitivePayloadContext): Promise<SensitivePayloadRef> {
    const json = JSON.stringify(payload);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(contextAAD(context), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat([iv, tag, ciphertext]).toString('base64url'),
      digest: stableDigest([context.botKey, context.environment, context.classification, json]),
      classification: context.classification,
    };
  }

  async decrypt(ref: SensitivePayloadRef, context: SensitivePayloadContext): Promise<unknown> {
    const packed = Buffer.from(ref.ciphertext, 'base64url');
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(contextAAD(context), 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );
    return JSON.parse(plaintext) as unknown;
  }
}

function contextAAD(context: SensitivePayloadContext) {
  return [
    context.botKey,
    context.environment,
    context.accountKey ?? '',
    context.productKey ?? '',
    context.actorKey ?? '',
    context.classification,
  ].join('\u001f');
}
