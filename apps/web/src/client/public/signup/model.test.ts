import { describe, expect, it } from 'vitest';
import {
  familySignupFormModel,
  parsePublicSignupClassification,
  schoolInquiryFormModel,
} from './model.ts';

describe('P08 public signup model', () => {
  it('accepts exactly one Family or School classification', () => {
    expect(parsePublicSignupClassification('family')).toBe('family');
    expect(parsePublicSignupClassification('school')).toBe('school');
    for (const invalid of [undefined, '', 'hybrid', ['family', 'school'], { family: true }]) {
      expect(() => parsePublicSignupClassification(invalid)).toThrow(
        'invalid_public_signup_classification',
      );
    }
  });

  it('changes the Family CTA exactly at expiry without adding forbidden fields', () => {
    expect(familySignupFormModel(new Date('2026-09-13T16:23:59.000Z')).cta).toBe(
      'Create my free family account',
    );
    const boundary = familySignupFormModel(new Date('2026-09-13T16:24:00.000Z'));
    expect(boundary.cta).toBe('Create account and continue to checkout');
    expect(boundary.card_fields).toBe(0);
    expect(boundary.student_fields).toBe(0);
    expect(boundary.forbidden_fields).toContain('reminder_preference');
  });

  it('keeps School inquiry free of password, card, household, and Student fields', () => {
    expect(schoolInquiryFormModel()).toMatchObject({
      classification: 'school',
      password_fields: 0,
      card_fields: 0,
      household_fields: 0,
      student_fields: 0,
    });
  });
});
