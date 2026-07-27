import type { DeliveryFailure } from './types.ts';

export class DeliveryProviderError extends Error {
  readonly failure: DeliveryFailure;

  constructor(message: string, failure: DeliveryFailure) {
    super(message);
    this.name = 'DeliveryProviderError';
    this.failure = failure;
  }
}

export function providerError(
  code: string,
  options: {
    retryable: boolean;
    acceptance?: DeliveryFailure['acceptance'];
    provider?: DeliveryFailure['provider'];
    httpStatus?: number;
    retryAfterMs?: number;
  },
): DeliveryProviderError {
  return new DeliveryProviderError(code, {
    code,
    category: options.retryable ? 'transient' : 'permanent',
    acceptance: options.acceptance ?? 'not_accepted',
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.httpStatus !== undefined ? { httpStatus: options.httpStatus } : {}),
    ...(options.retryAfterMs !== undefined ? { retryAfterMs: options.retryAfterMs } : {}),
  });
}
