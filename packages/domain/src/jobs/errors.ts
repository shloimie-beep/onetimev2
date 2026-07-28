export const JOB_FOUNDATION_ERROR_CODES = [
  'invalid_identity',
  'invalid_scope',
  'invalid_contract',
  'invalid_request_hash',
  'invalid_version',
  'stale_version',
  'idempotency_conflict',
  'invalid_transition',
  'lease_lost',
  'lease_expired',
  'dispatch_attempts_exhausted',
  'acceptance_unknown_quarantined',
  'recovery_not_authorized',
  'unsafe_url_contract',
] as const;

export type JobFoundationErrorCode = (typeof JOB_FOUNDATION_ERROR_CODES)[number];

export class JobFoundationError extends Error {
  readonly code: JobFoundationErrorCode;

  constructor(code: JobFoundationErrorCode, message: string) {
    super(message);
    this.name = 'JobFoundationError';
    this.code = code;
  }
}
