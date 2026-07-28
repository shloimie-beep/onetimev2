export const PROVIDER_CORE_ERROR_CODES = [
  'invalid_contract',
  'invalid_hash',
  'invalid_scope',
  'registry_mismatch',
  'provider_mutation_forbidden',
  'identity_review_required',
  'identity_resolution_invalid',
  'household_mapping_collision',
  'stale_version',
  'readback_mismatch',
] as const;

export type ProviderCoreErrorCode = (typeof PROVIDER_CORE_ERROR_CODES)[number];

export class ProviderCoreError extends Error {
  constructor(
    readonly code: ProviderCoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderCoreError';
  }
}
