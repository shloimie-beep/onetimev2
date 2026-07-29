import { describe, expect, it } from 'vitest';
import {
  APPROVED_SCHOOL_CONFIGURATION_FIELDS,
  APPROVED_SCHOOL_EXPERIENCE,
  SCHOOL_INQUIRY_COPY,
  SCHOOL_INQUIRY_FIELDS,
  SCHOOL_INQUIRY_FORBIDDEN_FIELDS,
  SCHOOL_INQUIRY_OPTIONAL_FIELDS,
  SCHOOL_INQUIRY_REQUIRED_FIELDS,
  SCHOOL_SECURITY_INVARIANTS,
} from './index.ts';

describe('P09 School signup contract', () => {
  it('publishes exactly the approved public form fields and copy', () => {
    expect(SCHOOL_INQUIRY_REQUIRED_FIELDS).toEqual([
      'school_name',
      'contact_first_name',
      'contact_last_name',
      'email',
    ]);
    expect(SCHOOL_INQUIRY_OPTIONAL_FIELDS).toEqual(['phone', 'note']);
    expect(SCHOOL_INQUIRY_FIELDS).toEqual([
      ...SCHOOL_INQUIRY_REQUIRED_FIELDS,
      ...SCHOOL_INQUIRY_OPTIONAL_FIELDS,
    ]);
    expect(SCHOOL_INQUIRY_COPY).toEqual({
      cta: 'Send school inquiry',
      success: 'Thanks—we received your school inquiry. We’ll be in touch shortly.',
    });
    expect(SCHOOL_INQUIRY_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining(['password', 'student', 'subscription', 'access', 'role', 'portal']),
    );
  });

  it('defines ordinary Parent/Student reuse and no School-only capability', () => {
    expect(APPROVED_SCHOOL_CONFIGURATION_FIELDS).toEqual([
      'approved_school_id',
      'adult_account_manager_id',
      'household_id',
      'seat_allowance',
      'price_minor_units',
      'currency',
      'billing_starts_at',
      'terms_reference',
      'expected_configuration_version',
    ]);
    expect(APPROVED_SCHOOL_EXPERIENCE).toEqual({
      account_model: 'parent_student',
      adult_account_manager_role: 'parent',
      student_account_role: 'student',
      school_role_exists: false,
      school_portal_exists: false,
      bulk_roster_exists: false,
      automated_school_nurture_exists: false,
    });
    expect(SCHOOL_SECURITY_INVARIANTS).toMatchObject({
      public_inquiry_creates_product_access: false,
      public_inquiry_enrolls_nurture: false,
      school_authorization_role_exists: false,
      school_specific_portal_exists: false,
      provider_effects_inline: 0,
    });
  });
});
