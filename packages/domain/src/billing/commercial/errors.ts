export const COMMERCIAL_BILLING_ERROR_CODES = [
  'invalid_configuration',
  'invalid_time',
  'invalid_scope',
  'authorization_denied',
  'cross_household_denied',
  'seat_limit_exceeded',
  'stale_version',
  'idempotency_conflict',
  'checkout_not_allowed',
  'portal_not_available',
  'consent_required',
  'consent_mismatch',
  'paid_period_required',
  'admin_approval_required',
  'invalid_refund',
  'unverified_evidence',
  'evidence_mismatch',
] as const;

export type CommercialBillingErrorCode = (typeof COMMERCIAL_BILLING_ERROR_CODES)[number];

export class CommercialBillingError extends Error {
  constructor(
    public readonly code: CommercialBillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CommercialBillingError';
  }
}
