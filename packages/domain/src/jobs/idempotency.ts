import { createHash } from 'node:crypto';
import type { TransactionalOutboxIntent } from '../../../contracts/src/jobs/index.ts';
import { JobFoundationError } from './errors.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new JobFoundationError(
        'invalid_contract',
        'Canonical job payloads contain only safe integers.',
      );
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new JobFoundationError(
    'invalid_contract',
    'Canonical job payloads cannot contain undefined, bigint, functions, or symbols.',
  );
}

export function canonicalRequestHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function assertSha256(value: string, field: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new JobFoundationError(
      'invalid_request_hash',
      `${field} must be a lowercase SHA-256 digest.`,
    );
  }
}

export function assertStableJobIdentity(
  prior: Pick<TransactionalOutboxIntent, 'idempotency_key' | 'canonical_request_hash'>,
  incoming: Pick<TransactionalOutboxIntent, 'idempotency_key' | 'canonical_request_hash'>,
): void {
  if (
    prior.idempotency_key !== incoming.idempotency_key ||
    prior.canonical_request_hash !== incoming.canonical_request_hash
  ) {
    throw new JobFoundationError(
      'idempotency_conflict',
      'A logical job identity cannot be reused with a different request hash.',
    );
  }
}
