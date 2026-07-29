import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const FAMILY_SIGNUP_CONTRACT_VERSION = '2.0.0' as const;
export const FAMILY_SIGNUP_OPERATION = 'public_family_signup' as const;
export const FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH = 43 as const;
export const FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH = 128 as const;
export const FAMILY_SIGNUP_CLASSIFICATIONS = ['family', 'school'] as const;
export type FamilySignupClassification = (typeof FAMILY_SIGNUP_CLASSIFICATIONS)[number];

export const FAMILY_FREE_EXPIRY = '2026-09-13T16:24:00.000Z' as const;
export const FAMILY_SIGNUP_COPY = {
  before_expiry: {
    cta: 'Create my free family account',
    helper: 'No credit card. Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.',
  },
  at_or_after_expiry: {
    cta: 'Create account and continue to checkout',
    helper: 'Create your family account, then continue to secure checkout.',
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

export const FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS = [
  {
    name: 'general_marketing_consent',
    scope: 'general_marketing',
    label: 'General marketing',
    required: false,
    default_checked: false,
  },
  {
    name: 'parent_newsletter_consent',
    scope: 'parent_newsletter',
    label: 'Parent newsletter',
    required: false,
    default_checked: false,
  },
] as const;

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
  'immediate_free' | 'inactive_checkout' | 'inactive_identity_review';
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
  free_access_expires_at: typeof FAMILY_FREE_EXPIRY | null;
  checkout_required: boolean;
  checkout_blocked_by_identity_review: boolean;
  rolling_trial_granted: false;
  card_collected: false;
}

export interface FamilySignupAdultConsentChoices {
  general_marketing: boolean;
  parent_newsletter: boolean;
}

export interface FamilySignupOutboxIntent {
  intent_id: string;
  kind: 'ghl_adult_and_household_sync';
  request_binding: FamilySignupRequestBinding;
  adult_id: string;
  household_id: string;
  normalized_email_hash: string;
  adult_consent_choices: FamilySignupAdultConsentChoices;
  dispatch_state: 'ready' | 'identity_review';
  preserve_adult_suppression: true;
  local_commit_required: true;
}

export interface FamilySignupResult {
  disposition: Exclude<FamilySignupDisposition, 'idempotency_conflict'>;
  projection: FamilySignupLocalProjection | null;
  next_action: 'signed_in' | 'checkout' | 'identity_review' | 'sign_in_or_reset';
  setup_email_required: false;
  provider_effects_completed_inline: 0;
  outbox_intent_ids: readonly string[];
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
  optional_adult_consents_are_separate: true,
  optional_adult_consents_are_never_inferred: true,
  identity_review_blocks_post_expiry_checkout: true,
} as const;
