import { describe, expect, it } from 'vitest';
import { schoolInquiryFormModel } from './model.ts';

describe('P09 public School inquiry model', () => {
  it('renders exactly the required and optional fields with approved copy', () => {
    const model = schoolInquiryFormModel();
    expect(model.route).toBe('/school');
    expect(model.access).toBe('signed_out_public');
    expect(model.submission).toEqual({
      method: 'POST',
      endpoint: '/api/v2.1/signup/school-inquiry',
      content_type: 'application/json',
      accepted_statuses: [201, 200],
    });
    expect(model.required_fields).toEqual([
      'school_name',
      'contact_first_name',
      'contact_last_name',
      'email',
    ]);
    expect(model.optional_fields).toEqual(['phone', 'note']);
    expect(model.cta).toBe('Send school inquiry');
    expect(model.success).toBe(
      'Thanks—we received your school inquiry. We’ll be in touch shortly.',
    );
  });

  it('exposes no account, access, nurture, School-role, portal, or bulk-roster surface', () => {
    const model = schoolInquiryFormModel();
    expect(model.forbidden_fields).toEqual(
      expect.arrayContaining([
        'password',
        'student',
        'household',
        'subscription',
        'access',
        'role',
        'portal',
        'bulk_roster',
      ]),
    );
    expect(model).toMatchObject({
      creates_product_account: false,
      creates_access: false,
      creates_subscription: false,
      enrolls_nurture: false,
      asks_for_credentials: false,
      asks_for_student_data: false,
      asks_for_marketing_consent: false,
      school_role: null,
      school_portal: null,
      bulk_roster: null,
    });
  });
});
