import {
  FAMILY_FREE_EXPIRY,
  FAMILY_SIGNUP_COPY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_FORBIDDEN_FIELDS,
  type FamilySignupClassification,
} from '../../../../../../packages/contracts/src/signup/family/index.ts';

export function parsePublicSignupClassification(value: unknown): FamilySignupClassification {
  if (value === 'family' || value === 'school') return value;
  throw new Error('invalid_public_signup_classification');
}

export function familySignupFormModel(now: Date) {
  const beforeExpiry = now.getTime() < Date.parse(FAMILY_FREE_EXPIRY);
  return {
    classification: 'family' as const,
    fields: FAMILY_SIGNUP_FIELDS,
    forbidden_fields: FAMILY_SIGNUP_FORBIDDEN_FIELDS,
    ...FAMILY_SIGNUP_COPY[beforeExpiry ? 'before_expiry' : 'at_or_after_expiry'],
    card_fields: 0 as const,
    student_fields: 0 as const,
  };
}

export function schoolInquiryFormModel() {
  return {
    classification: 'school' as const,
    fields: [
      'classification',
      'first_name',
      'last_name',
      'email',
      'school_name',
      'timezone',
      'terms_accepted',
      'privacy_accepted',
    ] as const,
    password_fields: 0 as const,
    card_fields: 0 as const,
    household_fields: 0 as const,
    student_fields: 0 as const,
  };
}
