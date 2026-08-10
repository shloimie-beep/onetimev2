import {
  GHL_IDENTITY_CONTRACT_VERSION,
  type GhlHouseholdProjection,
  type GhlIdentitySubject,
} from '../../communications/ghl-identity/index.ts';
import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const FAMILY_SIGNUP_CONTRACT_VERSION = '2.1.0' as const;
export const FAMILY_SIGNUP_OPERATION = 'public_family_signup' as const;
export const FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH = 43 as const;
export const FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH = 128 as const;
export const FAMILY_SIGNUP_UNIFIED_AGREEMENT_POLICY_VERSION =
  'one_time_family_signup_unified_v1' as const;
export const FAMILY_SIGNUP_CLASSIFICATIONS = ['family'] as const;
export type FamilySignupClassification = (typeof FAMILY_SIGNUP_CLASSIFICATIONS)[number];

export const FAMILY_SIGNUP_COPY = {
  before_expiry: {
    cta: 'Create your Family account',
    helper: 'Try One Time free through September 11. No card required.',
  },
  at_or_after_expiry: {
    cta: 'Create your Family account',
    helper:
      'The free period has ended. Contact info@onetimeonetime.com for paid continuation options.',
  },
} as const;

export const FAMILY_SIGNUP_FIELDS = [
  'classification',
  'first_name',
  'last_name',
  'email',
  'password',
  'password_confirmation',
  'timezone',
  'terms_accepted',
  'privacy_accepted',
  'general_marketing_consent',
  'parent_newsletter_consent',
] as const;

export const FAMILY_SIGNUP_TIMEZONE_FIELD = {
  name: 'timezone',
  control: 'combobox',
  value_kind: 'iana_time_zone_identifier',
  option_source: 'iana_time_zone_database',
  searchable: true,
  editable: true,
  browser_prefill: 'suggestion_only',
  raw_offset_only: false,
} as const;

export const FAMILY_SIGNUP_VISIBLE_CONSENT_FIELDS = [
  {
    name: 'terms_accepted',
    scope: 'unified_terms',
    label: 'I agree to the Terms of Use',
    required: true,
    default_checked: false,
  },
] as const;

export const FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS = [] as const;

export const FAMILY_SIGNUP_FORBIDDEN_FIELDS = [
  'phone',
  'country',
  'student',
  'students',
  'learner_relationship',
  'guardian_consent',
  'recording_consent',
  'recognition_consent',
  'reminder_preference',
  'card',
  'payment_method',
] as const;

export interface FamilySignupCommand {
  classification: 'family';
  idempotency_key: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  timezone: string;
  terms_accepted: true;
  privacy_accepted: true;
  general_marketing_consent: boolean;
  parent_newsletter_consent: boolean;
}

export type FamilySignupAccessBranch =
  'immediate_free' | 'inactive_checkout' | 'inactive_identity_review' | 'inactive_support';
export type FamilySignupDisposition =
  'created' | 'recovered' | 'existing_account' | 'idempotency_conflict';

export interface FamilySignupScope {
  product: 'one_time_mishnayos';
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
}

export interface FamilySignupRequestBinding {
  scope: FamilySignupScope;
  operation: typeof FAMILY_SIGNUP_OPERATION;
  idempotency_key: string;
  canonical_request_digest: string;
}

export interface FamilySignupLocalProjection {
  adult_id: string;
  human_account_id: string;
  household_id: string;
  normalized_email: string;
  access_branch: FamilySignupAccessBranch;
  access_state: 'free' | 'inactive';
  seat_limit: 3;
  active_seat_count: 0;
  free_access_expires_at: string | null;
  checkout_required: boolean;
  checkout_blocked_by_identity_review: boolean;
  rolling_trial_granted: false;
  card_collected: false;
}

export interface FamilySignupAdultConsentChoices {
  general_marketing: boolean;
  parent_newsletter: boolean;
}

export interface FamilySignupUnifiedAgreement {
  policy_version: typeof FAMILY_SIGNUP_UNIFIED_AGREEMENT_POLICY_VERSION;
  captured_at: string;
  terms_accepted: true;
  privacy_accepted: true;
  student_data_child_safety_accepted: true;
  cancellation_refund_accepted: true;
  email_marketing_consent: 'opted_in';
  newsletter_consent: 'opted_in';
  sms_call_whatsapp_consent: false;
}

export interface FamilySignupGhlHandoff {
  contract_version: '1.0.0';
  target: 'p27_ghl_identity_sync';
  target_contract_version: typeof GHL_IDENTITY_CONTRACT_VERSION;
  operation_id: string;
  local_commit_id: string;
  local_commit_state: 'committed';
  local_result_durable: true;
  provider_failure_rolls_back_local_result: false;
  subject: Extract<GhlIdentitySubject, { kind: 'adult' }>;
  household: GhlHouseholdProjection;
  adult_signup_event?: {
    household_reconciliation_key: string;
    audience_type: 'adult';
    email_consent: 'opted_in';
    policy_version: typeof FAMILY_SIGNUP_UNIFIED_AGREEMENT_POLICY_VERSION;
    captured_at: string;
    lifecycle_stage: 'Active Member';
    tags: readonly ['ot | lead', 'ot | email opt-in'];
    ot01_authority: 'direct_enrollment_after_local_commit';
    student_contacts: 0;
    password_or_security_data: false;
  };
  provider_readback_required: boolean;
  provider_effect_authorized: false;
  message_delivery_authorized: false;
  billing_effect_authorized: false;
  student_contact_prohibited: true;
}

export interface FamilySignupOutboxIntent {
  intent_id: string;
  kind: 'ghl_adult_and_household_sync';
  request_binding: FamilySignupRequestBinding;
  adult_id: string;
  household_id: string;
  normalized_email_hash: string;
  adult_consent_choices: FamilySignupAdultConsentChoices;
  /** Present only for new unified-control signups; legacy durable receipts are preserved as-is. */
  unified_agreement?: FamilySignupUnifiedAgreement;
  dispatch_state: 'ready' | 'identity_review';
  preserve_adult_suppression: true;
  local_commit_required: true;
  ghl_handoff: FamilySignupGhlHandoff;
}

export interface FamilySignupResult {
  disposition: Exclude<FamilySignupDisposition, 'idempotency_conflict'>;
  projection: FamilySignupLocalProjection | null;
  next_action: 'signed_in' | 'checkout' | 'identity_review' | 'support' | 'sign_in_or_reset';
  setup_email_required: false;
  provider_effects_completed_inline: 0;
  outbox_intent_ids: readonly string[];
  ghl_handoff_state: 'ready' | 'readback_required' | 'identity_review' | 'not_applicable';
  checkout_handoff_state:
    'queued' | 'blocked_identity_review' | 'not_configured' | 'not_applicable';
  safe_message: string;
}

export interface FamilySignupReceipt {
  request_binding: FamilySignupRequestBinding;
  result: FamilySignupResult;
  outbox_intents: readonly FamilySignupOutboxIntent[];
}

export const FAMILY_SIGNUP_SECURITY_INVARIANTS = {
  local_commit_precedes_provider_effects: true,
  provider_failure_rolls_back_local_signup: false,
  one_normalized_email_one_adult: true,
  one_adult_one_human_account: true,
  student_ghl_contacts: 0,
  signup_form_card_fields: 0,
  setup_email_required_for_fresh_signup: false,
  duplicate_response_is_generic: true,
  existing_local_account_signup_writes: 0,
  existing_local_household_signup_writes: 0,
  idempotency_key_is_high_entropy_server_required: true,
  canonical_request_digest_is_server_computed: true,
  request_receipt_and_outbox_are_scope_operation_bound: true,
  idempotency_key_is_not_authentication: true,
  password_confirmation_must_match_exactly: true,
  timezone_must_be_iana: true,
  browser_timezone_is_editable_suggestion_only: true,
  visible_signup_consent_controls: 1,
  unified_agreement_policy_version: FAMILY_SIGNUP_UNIFIED_AGREEMENT_POLICY_VERSION,
  unified_agreement_captures_adult_marketing_email: true,
  sms_call_whatsapp_consent_from_signup: false,
  identity_review_blocks_post_expiry_checkout: true,
  unavailable_provider_evidence_is_not_identity_ambiguity: true,
  ghl_handoff_is_adult_only_and_non_effecting: true,
  hosted_checkout_handoff_uses_highlevel_without_direct_stripe_mutation: true,
} as const;
