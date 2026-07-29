import { describe, expect, it } from 'vitest';
import { familySignupFormModel, parsePublicSignupClassification } from './model.ts';

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

  it('publishes the exact Family fields and editable searchable IANA metadata', () => {
    expect(familySignupFormModel(new Date('2026-09-13T16:23:59.000Z')).cta).toBe(
      'Create my free family account',
    );
    const boundary = familySignupFormModel(new Date('2026-09-13T16:24:00.000Z'));
    expect(boundary.cta).toBe('Create account and continue to checkout');
    expect(boundary.card_fields).toBe(0);
    expect(boundary.student_fields).toBe(0);
    expect(boundary.forbidden_fields).toContain('reminder_preference');
    expect(boundary.fields).toContain('password_confirmation');
    expect(boundary.timezone_field).toMatchObject({
      control: 'combobox',
      value_kind: 'iana_time_zone_identifier',
      searchable: true,
      editable: true,
      browser_prefill: 'suggestion_only',
      raw_offset_only: false,
    });
    expect(boundary.optional_consent_fields.map(({ name }) => name)).toEqual([
      'general_marketing_consent',
      'parent_newsletter_consent',
    ]);
    expect(boundary.optional_consent_fields.every(({ default_checked }) => !default_checked)).toBe(
      true,
    );
  });
});
