import type { JobScope, ProviderJobRecord, ProviderReconciliationOutcome } from '../jobs/index.ts';

export const PROVIDER_CORE_CONTRACT_VERSION = '1.0.0' as const;

export const PROVIDER_KEYS = [
  'highlevel',
  'stripe',
  'resend',
  'zoom',
  'vimeo',
  'drive',
  'openai',
  'telegram',
  's3',
] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export const PROVIDER_MUTATION_POLICIES = ['allowed', 'orchestration_only', 'prohibited'] as const;
export type ProviderMutationPolicy = (typeof PROVIDER_MUTATION_POLICIES)[number];

export interface ProviderRegistryBinding {
  registry_binding_key: string;
  provider: ProviderKey;
  scope: JobScope;
  provider_account_ref_hash: string;
  allowed_operation_types: readonly string[];
  mutation_policy: ProviderMutationPolicy;
  active: boolean;
}

export interface ProviderOperation extends Omit<ProviderJobRecord, 'provider'> {
  provider: ProviderKey;
  registry_binding_key: string;
  provider_account_ref_hash: string;
  effect_kind: 'mutation' | 'readback' | 'signed_event_ingest';
  household_id: string | null;
}

export type ProviderReadbackDisposition =
  'effect_exists' | 'effect_absent_retry_safe' | 'permanently_rejected' | 'still_unknown';

export interface ProviderCanonicalReadback {
  operation_id: string;
  provider: ProviderKey;
  scope: JobScope;
  registry_binding_key: string;
  provider_account_ref_hash: string;
  canonical_request_hash: string;
  disposition: ProviderReadbackDisposition;
  provider_resource_ref_hash: string | null;
  provider_acceptance_digest: string | null;
  reconciliation_digest: string;
  safe_error_code: string | null;
  completed_locally: boolean;
  observed_at: string;
}

export interface ProviderReadbackAdapter {
  provider: ProviderKey;
  readCanonical(
    operation: ProviderOperation,
    binding: ProviderRegistryBinding,
    signal: AbortSignal,
  ): Promise<ProviderCanonicalReadback>;
}

export interface ClaimProviderReconciliationInput {
  scope: JobScope;
  provider_keys: readonly ProviderKey[];
  limit: number;
}

export interface PersistProviderReconciliationInput {
  prior: ProviderOperation;
  next: ProviderOperation;
  readback: ProviderCanonicalReadback;
}

export interface ProviderReconciliationRepository {
  claimAcceptanceUnknown(
    input: ClaimProviderReconciliationInput,
  ): Promise<readonly ProviderOperation[]>;
  persistReconciliation(input: PersistProviderReconciliationInput): Promise<boolean>;
}

export function toProviderReconciliationOutcome(
  readback: ProviderCanonicalReadback,
): ProviderReconciliationOutcome {
  switch (readback.disposition) {
    case 'effect_exists':
      if (readback.provider_acceptance_digest === null) {
        throw new Error('provider_acceptance_digest_required');
      }
      return {
        kind: 'effect_exists',
        provider_acceptance_digest: readback.provider_acceptance_digest,
        completed_locally: readback.completed_locally,
        reconciliation_digest: readback.reconciliation_digest,
      };
    case 'effect_absent_retry_safe':
      return {
        kind: 'effect_absent_retry_safe',
        reconciliation_digest: readback.reconciliation_digest,
      };
    case 'permanently_rejected':
      if (readback.safe_error_code === null) {
        throw new Error('safe_error_code_required');
      }
      return {
        kind: 'permanently_rejected',
        safe_error_code: readback.safe_error_code,
        reconciliation_digest: readback.reconciliation_digest,
      };
    case 'still_unknown':
      if (readback.safe_error_code === null) {
        throw new Error('safe_error_code_required');
      }
      return {
        kind: 'still_unknown',
        safe_error_code: readback.safe_error_code,
        reconciliation_digest: readback.reconciliation_digest,
      };
  }
}

export const GHL_IDENTITY_LINK_STATES = ['unlinked', 'linked', 'identity_review'] as const;
export type GhlIdentityLinkState = (typeof GHL_IDENTITY_LINK_STATES)[number];

export interface AdultContactSuppression {
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  evidence_digest: string;
  version: number;
}

export interface AdultGhlIdentityLink {
  adult_id: string;
  normalized_email_hash: string;
  state: GhlIdentityLinkState;
  verified_contact_ref_hash: string | null;
  candidate_contact_ref_hashes: readonly string[];
  quarantined_outbox_intent_ids: readonly string[];
  suppression: AdultContactSuppression;
  version: number;
}

export interface HouseholdProviderMapping {
  household_id: string;
  owner_adult_id: string;
  runtime_tier: JobScope['runtime_tier'];
  verification_environment_id: JobScope['verification_environment_id'];
  billing_program: string;
  ghl_household_record_ref_hash: string;
  projected_owner_contact_ref_hash: string;
  stripe_customer_ref_hash: string;
  service_reminders_enabled: boolean;
  lifecycle_state: string;
  access_projection: 'free' | 'active' | 'grace' | 'inactive';
  reconciliation_state: 'in_sync' | 'reconciliation_hold';
  transfer_target_contact_ref_hash: string | null;
  provider_revision: string;
  last_readback_digest: string;
  version: number;
}

export type IdentityBoundEffect =
  | 'local_login'
  | 'local_free_access'
  | 'local_student_management'
  | 'resend_security'
  | 'ghl_contact_upsert'
  | 'ghl_household_projection'
  | 'ghl_workflow'
  | 'ghl_billing'
  | 'stripe_financial_mutation';

export interface ProviderEffectDecision {
  allowed: boolean;
  safe_code:
    | 'local_effect_independent'
    | 'ghl_contact_creation_allowed'
    | 'ghl_identity_linked'
    | 'ghl_identity_review'
    | 'ghl_identity_not_linked'
    | 'stripe_financial_mutation_forbidden';
}
