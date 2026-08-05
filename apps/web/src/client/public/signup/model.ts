import {
  FAMILY_SIGNUP_COPY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_FORBIDDEN_FIELDS,
  FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS,
  FAMILY_SIGNUP_TIMEZONE_FIELD,
  type FamilySignupClassification,
} from '../../../../../../packages/contracts/src/signup/family/index.ts';

export function parsePublicSignupClassification(value: unknown): FamilySignupClassification {
  if (value === 'family') return value;
  throw new Error('invalid_public_signup_classification');
}

export function familySignupFormModel(now: Date, freeAccessExpiresAt?: string) {
  const expiry = freeAccessExpiresAt ? Date.parse(freeAccessExpiresAt) : Number.NaN;
  const beforeExpiry = Number.isFinite(expiry) && now.getTime() < expiry;
  return {
    classification: 'family' as const,
    fields: FAMILY_SIGNUP_FIELDS,
    forbidden_fields: FAMILY_SIGNUP_FORBIDDEN_FIELDS,
    timezone_field: FAMILY_SIGNUP_TIMEZONE_FIELD,
    optional_consent_fields: FAMILY_SIGNUP_OPTIONAL_CONSENT_FIELDS,
    ...FAMILY_SIGNUP_COPY[beforeExpiry ? 'before_expiry' : 'at_or_after_expiry'],
    cta: 'Create your Family account' as const,
    card_fields: 0 as const,
    student_fields: 0 as const,
  };
}
