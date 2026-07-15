import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeFingerprint(value: string): string {
  return sha256Hex(value).slice(0, 24);
}

export function stableProviderKey(prefix: string, parts: readonly string[]): string {
  return `${prefix}_${sha256Hex(parts.join('\0')).slice(0, 32)}`;
}

export function assertNoLiveReference(label: string, value: string | null | undefined): void {
  if (!value) return;
  if (/\blive\b|_(?:live)_/i.test(value)) {
    throw new Error(`${label} rejected a live-like provider reference.`);
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function redactedRefHash(value: string): string {
  return sha256Hex(value).slice(0, 48);
}
