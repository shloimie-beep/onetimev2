import {
  SCHOOL_INQUIRY_COPY,
  SCHOOL_INQUIRY_FIELDS,
  SCHOOL_INQUIRY_FORBIDDEN_FIELDS,
  SCHOOL_INQUIRY_OPTIONAL_FIELDS,
  SCHOOL_INQUIRY_REQUIRED_FIELDS,
} from '../../../../../../packages/contracts/src/signup/school/index.ts';

export function schoolInquiryFormModel() {
  return {
    route: '/school' as const,
    access: 'signed_out_public' as const,
    classification: 'school' as const,
    submission: {
      method: 'POST' as const,
      endpoint: '/api/v2.1/signup/school-inquiry' as const,
      content_type: 'application/json' as const,
      accepted_statuses: [201, 200] as const,
    },
    required_fields: SCHOOL_INQUIRY_REQUIRED_FIELDS,
    optional_fields: SCHOOL_INQUIRY_OPTIONAL_FIELDS,
    fields: SCHOOL_INQUIRY_FIELDS,
    forbidden_fields: SCHOOL_INQUIRY_FORBIDDEN_FIELDS,
    cta: SCHOOL_INQUIRY_COPY.cta,
    success: SCHOOL_INQUIRY_COPY.success,
    creates_product_account: false as const,
    creates_access: false as const,
    creates_subscription: false as const,
    enrolls_nurture: false as const,
    asks_for_credentials: false as const,
    asks_for_student_data: false as const,
    asks_for_marketing_consent: false as const,
    school_role: null,
    school_portal: null,
    bulk_roster: null,
  };
}
