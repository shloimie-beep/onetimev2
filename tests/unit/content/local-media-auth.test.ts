import { describe, expect, it } from 'vitest';
import {
  buildLocalMediaSignature,
  verifyLocalMediaSignature,
} from '../../../packages/domain/src/content/local-media-auth.ts';

const key = 'test-only-local-media-signing-key-1234567890';
const now = new Date('2026-08-11T18:00:00.000Z');

describe('local media signed requests', () => {
  it('accepts the exact bounded request', () => {
    const request = {
      method: 'POST',
      requestTarget: '/api/v1/admin/content/local-runner/import',
      timestamp: String(now.getTime()),
      nonce: 'local-media-job-1234',
      body: JSON.stringify({ occurrence_key: 'occurrence_1' }),
    };
    const signature = buildLocalMediaSignature(key, request);
    expect(verifyLocalMediaSignature({ key, request, signature, now })).toBe(true);
  });

  it('rejects body, target, nonce, signature, and stale timestamp changes', () => {
    const request = {
      method: 'GET',
      requestTarget:
        '/api/v1/admin/content/local-runner/occurrences?recorded_at=2026-08-11T18%3A00%3A00.000Z',
      timestamp: String(now.getTime()),
      nonce: 'local-media-job-5678',
      body: '',
    };
    const signature = buildLocalMediaSignature(key, request);
    expect(
      verifyLocalMediaSignature({
        key,
        request: { ...request, body: '{}' },
        signature,
        now,
      }),
    ).toBe(false);
    expect(
      verifyLocalMediaSignature({
        key,
        request: { ...request, requestTarget: '/api/v1/admin/content/factory' },
        signature,
        now,
      }),
    ).toBe(false);
    expect(verifyLocalMediaSignature({ key, request, signature: '0'.repeat(64), now })).toBe(false);
    expect(
      verifyLocalMediaSignature({
        key,
        request,
        signature,
        now: new Date(now.getTime() + 5 * 60_000 + 1),
      }),
    ).toBe(false);
  });
});
