import { createHash } from 'node:crypto';
import type { DeliveryFailure } from '../../../contracts/src/delivery/types.ts';
import { DeliveryProviderError } from '../../../contracts/src/delivery/errors.ts';

const BASE_DELAY_MS = 30_000;
export const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

const ALLOWED_FAILURE_CODES = new Set([
  'provider_activation_disabled',
  'provider_authorization_missing',
  'provider_canary_budget_exhausted',
  'provider_destination_not_authorized',
  'provider_environment_gate_mismatch',
  'provider_idempotency_key_mismatch',
  'provider_idempotency_key_missing',
  'provider_mode_not_enabled',
  'provider_network_failure',
  'provider_production_disabled',
  'provider_request_aborted',
  'provider_staging_isolation_missing',
  'provider_timeout',
  'provider_unavailable',
  'provider_transport_disabled',
  'provider_unclassified_failure',
  'resend_internal_server_error',
  'resend_rate_limit_exceeded',
  'resend_validation_error',
  'resend_disabled',
  'one_time_wapi_rate_limited',
  'one_time_wapi_validation_error',
  'unsupported_provider_channel',
  'wapi_disabled',
]);

export function sanitizeFailureCode(code: string | undefined): string {
  const normalized = (code ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return ALLOWED_FAILURE_CODES.has(normalized) ? normalized : 'provider_unclassified_failure';
}

function sanitizeFailure(failure: DeliveryFailure): DeliveryFailure {
  return {
    code: sanitizeFailureCode(failure.code),
    category: failure.category,
    ...(failure.provider ? { provider: failure.provider } : {}),
    ...(failure.httpStatus !== undefined ? { httpStatus: failure.httpStatus } : {}),
    ...(failure.retryAfterMs !== undefined
      ? { retryAfterMs: Math.min(Math.max(0, failure.retryAfterMs), MAX_RETRY_DELAY_MS) }
      : {}),
  };
}

export function classifyDeliveryError(error: unknown): DeliveryFailure {
  if (error instanceof DeliveryProviderError) return sanitizeFailure(error.failure);

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      code: 'provider_timeout',
      category: 'transient',
      provider: 'worker',
    };
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return {
      code: 'provider_timeout',
      category: 'transient',
      provider: 'worker',
    };
  }

  if (error instanceof TypeError) {
    return {
      code: 'provider_network_failure',
      category: 'transient',
      provider: 'worker',
    };
  }

  return {
    code: 'provider_unclassified_failure',
    category: 'transient',
    provider: 'worker',
  };
}

function deterministicJitter(deliveryKey: string, attempt: number): number {
  const byte = createHash('sha256').update(`${deliveryKey}\0${attempt}`).digest()[0] ?? 128;
  return 0.8 + (byte / 255) * 0.4;
}

export function nextRetryAt(input: {
  now: Date;
  deliveryKey: string;
  attempt: number;
  retryAfterMs?: number;
}): Date {
  const exponent = Math.max(0, input.attempt - 1);
  const exponential = Math.min(MAX_RETRY_DELAY_MS, BASE_DELAY_MS * 2 ** exponent);
  const jittered = Math.min(
    MAX_RETRY_DELAY_MS,
    Math.round(exponential * deterministicJitter(input.deliveryKey, input.attempt)),
  );
  const providerDelay = Math.min(MAX_RETRY_DELAY_MS, Math.max(0, input.retryAfterMs ?? 0));
  return new Date(input.now.getTime() + Math.max(jittered, providerDelay));
}

export function shouldDeadLetter(
  failure: DeliveryFailure,
  attempt: number,
  maxAttempts: number,
): boolean {
  return failure.category === 'permanent' || attempt >= maxAttempts;
}
