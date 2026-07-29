import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const FAMILY_SIGNUP_CONTRACT_VERSION = '1.0.0' as const;
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
  'timezone',
  'terms_accepted',
  'privacy_accepted',
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
  canonical_request_hash: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  timezone: string;
  terms_accepted: true;
  privacy_accepted: true;
}

export interface SchoolInquiryCommand {
  classification: 'school';
  idempotency_key: string;
  canonical_request_hash: string;
  first_name: string;
  last_name: string;
  email: string;
  school_name: string;
  timezone: string;
  terms_accepted: true;
  privacy_accepted: true;
}

export type PublicSignupCommand = FamilySignupCommand | SchoolInquiryCommand;
export type FamilySignupAccessBranch = 'immediate_free' | 'inactive_checkout';
export type FamilySignupDisposition =
  'created' | 'recovered' | 'existing_account' | 'idempotency_conflict';

export interface FamilySignupScope {
  product: 'one_time_mishnayos';
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
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
  rolling_trial_granted: false;
  card_collected: false;
}

export interface FamilySignupOutboxIntent {
  intent_id: string;
  kind: 'ghl_adult_and_household_sync';
  adult_id: string;
  household_id: string;
  normalized_email_hash: string;
  preserve_adult_suppression: true;
  local_commit_required: true;
}

export interface FamilySignupResult {
  disposition: Exclude<FamilySignupDisposition, 'idempotency_conflict'>;
  projection: FamilySignupLocalProjection | null;
  next_action: 'signed_in' | 'checkout' | 'sign_in_or_reset';
  setup_email_required: false;
  provider_effects_completed_inline: 0;
  outbox_intent_ids: readonly string[];
  safe_message: string;
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
} as const;
