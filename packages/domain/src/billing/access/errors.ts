export const BILLING_ACCESS_ERROR_CODES = [
  'invalid_contract',
  'signature_invalid',
  'signature_stale',
  'household_scope_mismatch',
  'event_id_conflict',
] as const;

export type BillingAccessErrorCode = (typeof BILLING_ACCESS_ERROR_CODES)[number];

export class BillingAccessError extends Error {
  constructor(
    readonly code: BillingAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BillingAccessError';
  }
}
