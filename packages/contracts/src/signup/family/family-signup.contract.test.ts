import { describe, expect, it } from 'vitest';
import {
  FAMILY_SIGNUP_CLASSIFICATIONS,
  FAMILY_SIGNUP_CONTRACT_VERSION,
  FAMILY_SIGNUP_COPY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_FORBIDDEN_FIELDS,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH,
  FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS,
  FAMILY_SIGNUP_VISIBLE_CONSENT_FIELDS,
  FAMILY_SIGNUP_OPERATION,
  FAMILY_SIGNUP_SECURITY_INVARIANTS,
  FAMILY_SIGNUP_TIMEZONE_FIELD,
} from './index.ts';

describe('P08 family signup contract', () => {
  it('pins the Family-only classification and date-free optional-expiry copy', () => {
    expect(FAMILY_SIGNUP_CLASSIFICATIONS).toEqual(['family']);
    expect(FAMILY_SIGNUP_COPY.before_expiry).toEqual({
      cta: 'Create your Family account',
      helper: 'Try One Time free through September 11. No card required.',
    });
    expect(FAMILY_SIGNUP_COPY.at_or_after_expiry).toEqual({
      cta: 'Create your Family account',
      helper:
        'The free period has ended. Contact info@onetimeonetime.com for paid continuation options.',
    });
  });

  it('keeps the Family form cardless and local-first', () => {
    expect(FAMILY_SIGNUP_CONTRACT_VERSION).toBe('2.1.0');
    expect(FAMILY_SIGNUP_OPERATION).toBe('public_family_signup');
    expect(FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH).toBe(43);
    expect(FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH).toBe(128);
    expect(FAMILY_SIGNUP_FIELDS).toEqual([
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
    ]);
    expect(FAMILY_SIGNUP_TIMEZONE_FIELD).toMatchObject({
      control: 'combobox',
      value_kind: 'iana_time_zone_identifier',
      searchable: true,
      editable: true,
      browser_prefill: 'suggestion_only',
      raw_offset_only: false,
    });
    expect(FAMILY_SIGNUP_VISIBLE_CONSENT_FIELDS).toEqual([
      {
        name: 'terms_accepted',
        scope: 'unified_terms',
        label: 'I agree to the Terms of Use',
        required: true,
        default_checked: false,
      },
    ]);
    expect(FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS).toEqual([]);
    expect(FAMILY_SIGNUP_FORBIDDEN_FIELDS).toContain('card');
    expect(FAMILY_SIGNUP_FORBIDDEN_FIELDS).toContain('students');
    expect(FAMILY_SIGNUP_SECURITY_INVARIANTS).toMatchObject({
      local_commit_precedes_provider_effects: true,
      provider_failure_rolls_back_local_signup: false,
      one_normalized_email_one_adult: true,
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
      unified_agreement_policy_version: 'one_time_family_signup_unified_v1',
      unified_agreement_captures_adult_marketing_email: true,
      sms_call_whatsapp_consent_from_signup: false,
      identity_review_blocks_post_expiry_checkout: true,
      unavailable_provider_evidence_is_not_identity_ambiguity: true,
      ghl_handoff_is_adult_only_and_non_effecting: true,
      hosted_checkout_handoff_uses_highlevel_without_direct_stripe_mutation: true,
    });
  });
});
