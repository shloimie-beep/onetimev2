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
    classification: 'school' as const,
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
    school_role: null,
    school_portal: null,
    bulk_roster: null,
  };
}
