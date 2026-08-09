import { describe, expect, it } from 'vitest';
import { familySignupFormModel, parsePublicSignupClassification } from './model.ts';

describe('P08 public signup model', () => {
  it('accepts only the Family classification', () => {
    expect(parsePublicSignupClassification('family')).toBe('family');
    for (const invalid of [undefined, '', 'school', 'hybrid', ['family'], { family: true }]) {
      expect(() => parsePublicSignupClassification(invalid)).toThrow(
        'invalid_public_signup_classification',
      );
    }
  });

  it('publishes the exact Family fields and editable searchable IANA metadata', () => {
    const expiresAt = '2026-09-11T15:00:00.000Z';
    expect(familySignupFormModel(new Date('2026-09-11T14:59:59.000Z'), expiresAt).cta).toBe(
      'Create your Family account',
    );
    const boundary = familySignupFormModel(new Date('2026-09-11T15:00:00.000Z'), expiresAt);
    expect(boundary.cta).toBe('Create your Family account');
    expect(familySignupFormModel(new Date('2026-09-11T14:59:59.000Z'), expiresAt).helper).toBe(
      'Try One Time free through September 11. No card required.',
    );
    expect(boundary.helper).toContain('info@onetimeonetime.com');
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

  it('uses the safe checkout branch when no free expiry is configured', () => {
    expect(familySignupFormModel(new Date('2026-08-01T12:00:00.000Z'))).toMatchObject({
      classification: 'family',
      cta: 'Create your Family account',
      card_fields: 0,
      student_fields: 0,
    });
  });
});
