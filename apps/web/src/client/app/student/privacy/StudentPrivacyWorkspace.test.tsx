import { describe, expect, it } from 'vitest';
import { isStudentCurrentCredential } from './StudentPrivacyWorkspace.tsx';

describe('Student privacy current credential validation', () => {
  it('accepts an exact six-digit Student PIN including leading zeros', () => {
    expect(isStudentCurrentCredential('000123')).toBe(true);
    expect(isStudentCurrentCredential('123456')).toBe(true);
  });

  it('preserves current privacy access for existing longer Student passwords', () => {
    expect(isStudentCurrentCredential('LegacyStudentPass!234')).toBe(true);
  });

  it('rejects incomplete, non-numeric, non-ASCII, and overlong credentials', () => {
    expect(isStudentCurrentCredential('12345')).toBe(false);
    expect(isStudentCurrentCredential('1234567')).toBe(false);
    expect(isStudentCurrentCredential('12a456')).toBe(false);
    expect(isStudentCurrentCredential('１２３４５６')).toBe(false);
    expect(isStudentCurrentCredential('x'.repeat(257))).toBe(false);
  });
});
