import { describe, expect, it } from 'vitest';
import {
  decideProductionBasicSessionContext,
  sanitizeStudentZoomDisplayName,
  type ProductionBasicBrowserPrincipal,
} from './session-context.ts';

const STUDENT: ProductionBasicBrowserPrincipal = {
  source: 'legacy',
  principal_id: 'student-principal',
  role: 'student',
};
const PARENT: ProductionBasicBrowserPrincipal = {
  source: 'adult',
  principal_id: 'parent-principal',
  role: 'parent',
};
const ADMIN: ProductionBasicBrowserPrincipal = {
  source: 'adult',
  principal_id: 'admin-principal',
  role: 'admin',
};

describe('production-basic dual-cookie session isolation', () => {
  it.each([
    {
      name: 'Student cookie only',
      input: {
        adult_cookie_present: false,
        legacy_cookie_present: true,
        adult: null,
        legacy: STUDENT,
      },
      expected: { status: 'resolved', principal: STUDENT, clear_stale: null },
    },
    {
      name: 'Parent adult cookie only',
      input: {
        adult_cookie_present: true,
        legacy_cookie_present: false,
        adult: PARENT,
        legacy: null,
      },
      expected: { status: 'resolved', principal: PARENT, clear_stale: null },
    },
    {
      name: 'Admin adult cookie only',
      input: {
        adult_cookie_present: true,
        legacy_cookie_present: false,
        adult: ADMIN,
        legacy: null,
      },
      expected: { status: 'resolved', principal: ADMIN, clear_stale: null },
    },
    {
      name: 'valid Student and valid Admin adult cookie',
      input: {
        adult_cookie_present: true,
        legacy_cookie_present: true,
        adult: ADMIN,
        legacy: STUDENT,
      },
      expected: { status: 'session_context_conflict' },
    },
    {
      name: 'valid Student and stale adult cookie',
      input: {
        adult_cookie_present: true,
        legacy_cookie_present: true,
        adult: null,
        legacy: STUDENT,
      },
      expected: { status: 'resolved', principal: STUDENT, clear_stale: 'adult' },
    },
    {
      name: 'valid Admin and stale Student cookie',
      input: {
        adult_cookie_present: true,
        legacy_cookie_present: true,
        adult: ADMIN,
        legacy: null,
      },
      expected: { status: 'resolved', principal: ADMIN, clear_stale: 'legacy' },
    },
  ])('$name', ({ input, expected }) => {
    expect(decideProductionBasicSessionContext(input)).toEqual(expected);
  });

  it('sanitizes the exact learner display name and never uses an email-like identifier', () => {
    expect(sanitizeStudentZoomDisplayName('  Rivka\u202E <Levi>  ')).toBe('Rivka Levi');
    expect(sanitizeStudentZoomDisplayName('private@example.test')).toBe('Student');
    expect(sanitizeStudentZoomDisplayName(null)).toBe('Student');
  });
});
