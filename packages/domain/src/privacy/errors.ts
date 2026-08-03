export const PRIVACY_ERROR_CODES = [
  'invalid_contract',
  'invalid_hash',
  'actor_scope_denied',
  'consent_conflict',
  'current_consent_missing',
  'recent_password_required',
  'dependent_review_required',
  'invalid_transition',
  'stale_version',
  'download_denied',
  'purge_ledger_not_durable',
  'restore_gate_closed',
] as const;

export type PrivacyErrorCode = (typeof PRIVACY_ERROR_CODES)[number];

export class PrivacyError extends Error {
  constructor(
    readonly code: PrivacyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PrivacyError';
  }
}
