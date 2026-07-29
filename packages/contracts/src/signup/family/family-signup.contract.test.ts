import { describe, expect, it } from 'vitest';
import {
  FAMILY_FREE_EXPIRY,
  FAMILY_SIGNUP_CLASSIFICATIONS,
  FAMILY_SIGNUP_COPY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_FORBIDDEN_FIELDS,
  FAMILY_SIGNUP_SECURITY_INVARIANTS,
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
    expect(FAMILY_SIGNUP_FIELDS).toEqual([
      'classification',
      'first_name',
      'last_name',
      'email',
      'password',
      'timezone',
      'terms_accepted',
      'privacy_accepted',
    ]);
    expect(FAMILY_SIGNUP_FORBIDDEN_FIELDS).toContain('card');
    expect(FAMILY_SIGNUP_FORBIDDEN_FIELDS).toContain('students');
    expect(FAMILY_SIGNUP_SECURITY_INVARIANTS).toMatchObject({
      local_commit_precedes_provider_effects: true,
      provider_failure_rolls_back_local_signup: false,
      one_normalized_email_one_adult: true,
      duplicate_response_is_generic: true,
    });
  });
});
