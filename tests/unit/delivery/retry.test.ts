import { describe, expect, it } from 'vitest';
import { providerError } from '../../../packages/contracts/src/delivery/errors.ts';
import {
  classifyDeliveryError,
  MAX_RETRY_DELAY_MS,
  nextRetryAt,
  sanitizeFailureCode,
  shouldDeadLetter,
} from '../../../packages/domain/src/delivery/retry.ts';
import { BASE_TIME } from '../../support/delivery/fixtures.ts';

describe('delivery retry policy', () => {
  it('preserves allowlisted provider failure classification', () => {
    const failure = classifyDeliveryError(
      providerError('resend_rate_limit_exceeded', {
        retryable: true,
        provider: 'resend',
        httpStatus: 429,
        retryAfterMs: 90_000,
      }),
    );
    expect(failure).toEqual({
      code: 'resend_rate_limit_exceeded',
      category: 'transient',
      provider: 'resend',
      httpStatus: 429,
      retryAfterMs: 90_000,
    });
  });

  it('sanitizes unrecognized provider codes before audit persistence', () => {
    expect(sanitizeFailureCode('Resend: raw recipient@example.test token=abc')).toBe(
      'provider_unclassified_failure',
    );
  });

  it('uses deterministic exponential backoff and caps Retry-After', () => {
    const first = nextRetryAt({
      now: BASE_TIME,
      deliveryKey: 'delivery_a',
      attempt: 1,
    });
    const repeat = nextRetryAt({
      now: BASE_TIME,
      deliveryKey: 'delivery_a',
      attempt: 1,
    });
    const capped = nextRetryAt({
      now: BASE_TIME,
      deliveryKey: 'delivery_a',
      attempt: 1,
      retryAfterMs: MAX_RETRY_DELAY_MS * 5,
    });
    expect(first).toEqual(repeat);
    expect(capped.getTime() - BASE_TIME.getTime()).toBe(MAX_RETRY_DELAY_MS);
  });

  it('dead-letters permanent failures immediately and transient failures at the limit', () => {
    expect(shouldDeadLetter({ code: 'bad_request', category: 'permanent' }, 1, 5)).toBe(true);
    expect(shouldDeadLetter({ code: 'timeout', category: 'transient' }, 4, 5)).toBe(false);
    expect(shouldDeadLetter({ code: 'timeout', category: 'transient' }, 5, 5)).toBe(true);
  });
});
