import { describe, expect, it } from 'vitest';
import {
  FAMILY_FREE_EXPIRY,
  FAMILY_SIGNUP_CLASSIFICATIONS,
  FAMILY_SIGNUP_CONTRACT_VERSION,
  FAMILY_SIGNUP_COPY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_FORBIDDEN_FIELDS,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH,
  FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS,
  FAMILY_SIGNUP_OPERATION,
  FAMILY_SIGNUP_SECURITY_INVARIANTS,
  FAMILY_SIGNUP_TIMEZONE_FIELD,
} from './index.ts';

describe('P08 family signup contract', () => {
  it('pins the two exclusive branches and exact fixed-expiry copy', () => {
    expect(FAMILY_SIGNUP_CLASSIFICATIONS).toEqual(['family', 'school']);
    expect(FAMILY_FREE_EXPIRY).toBe('2026-09-13T16:24:00.000Z');
    expect(FAMILY_SIGNUP_COPY.before_expiry).toEqual({
      cta: 'Create my free family account',
      helper: 'No credit card. Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.',
    });
    expect(FAMILY_SIGNUP_COPY.at_or_after_expiry.cta).toBe(
      'Create account and continue to checkout',
    );
  });

  it('keeps the Family form cardless and local-first', () => {
    expect(FAMILY_SIGNUP_CONTRACT_VERSION).toBe('2.0.0');
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
    expect(FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS).toEqual([
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
    ]);
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
      optional_adult_consents_are_separate: true,
      optional_adult_consents_are_never_inferred: true,
      identity_review_blocks_post_expiry_checkout: true,
    });
  });
});
