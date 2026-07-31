import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_SCHOOL_CONFIGURATION_FIELDS,
  APPROVED_SCHOOL_EXPERIENCE,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  SCHOOL_INQUIRY_COPY,
  SCHOOL_INQUIRY_FIELDS,
  SCHOOL_INQUIRY_FORBIDDEN_FIELDS,
  SCHOOL_INQUIRY_OPTIONAL_FIELDS,
  SCHOOL_INQUIRY_REQUIRED_FIELDS,
  SCHOOL_SECURITY_INVARIANTS,
  type SchoolInquiryCommand,
} from './index.ts';

describe('P09 School signup contract', () => {
  it('publishes exactly the approved public form fields and copy', () => {
    const fourRequiredFields = {
      school_name: 'Yeshiva One',
      contact_first_name: 'Ari',
      contact_last_name: 'Levi',
      email: 'ari@example.com',
    } satisfies SchoolInquiryCommand;
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
    expect(Object.keys(fourRequiredFields).sort()).toEqual(
      [...SCHOOL_INQUIRY_REQUIRED_FIELDS].sort(),
    );
    expect(SCHOOL_INQUIRY_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining(['password', 'student', 'subscription', 'access', 'role', 'portal']),
    );
  });

  it('binds acknowledgment delivery to the approved catalog template and digest', () => {
    expect(SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE).toEqual({
      workflow_id: 'OT-01',
      template_id: 'OT-01.school_acknowledgment',
      template_version: '2.1.0',
      sender_key: 'office',
      subject: 'We received your One Time school inquiry',
      body: [
        'Hi {{contact.first_name}},',
        '',
        'Thank you for your interest in One Time Mishnayos for your school.',
        '',
        'We received your information. Shloimie will contact you to discuss pricing, Student seats, and setup.',
        '',
        'No account or paid subscription has been created yet.',
        '',
        'One Time Mishnayos',
        'info@onetimeonetime.com',
      ].join('\n'),
    });
    expect(
      createHash('sha256')
        .update(JSON.stringify(SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE), 'utf8')
        .digest('hex'),
    ).toBe(SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST);
    expect(SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.body).not.toBe(SCHOOL_INQUIRY_COPY.success);
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
      'immutable_contract_reference',
      'authorization_reason',
      'idempotency_key',
      'expected_configuration_version',
      'audit_ref',
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
