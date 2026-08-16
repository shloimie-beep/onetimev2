import { describe, expect, it } from 'vitest';
import type {
  ParentHouseholdPrincipal,
  ParentHouseholdRecord,
} from '../../../../contracts/src/portals/parent-household/index.ts';
import { ParentHouseholdError } from './errors.ts';
import {
  archiveParentStudent,
  buildParentHouseholdSnapshot,
  createParentStudent,
  resetParentStudentCredential,
  restoreParentStudent,
  updateParentStudent,
} from './aggregate.ts';

const principal: ParentHouseholdPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  household_id: 'household-1',
  session_id: 'session-parent-1',
};

function household(active = 0): ParentHouseholdRecord {
  return {
    household_id: 'household-1',
    owner_adult_id: 'adult-1',
    display_name: 'Our household',
    access_state: 'active',
    student_allowance: 3,
    revision: 7,
    students: Array.from({ length: active }, (_, index) => ({
      student_id: `student-${index + 1}`,
      household_id: 'household-1',
      actual_name: `Student ${index + 1}`,
      display_name: null,
      username: `student.${index + 1}`,
      relationship: 'dependent' as const,
      state: 'active' as const,
      credential_version: 2,
      version: 3,
    })),
  };
}

describe('P12 Parent household aggregate', () => {
  it('shows only the exact owned household and denies cross-household or wrong owner scope', () => {
    expect(buildParentHouseholdSnapshot({ principal, household: household(1) })).toMatchObject({
      active_student_count: 1,
      available_student_seats: 2,
      can_manage_students: true,
    });
    expect(() =>
      buildParentHouseholdSnapshot({
        principal,
        household: { ...household(), household_id: 'household-2' },
      }),
    ).toThrowError(ParentHouseholdError);
    expect(() =>
      buildParentHouseholdSnapshot({
        principal,
        household: { ...household(), owner_adult_id: 'adult-2' },
      }),
    ).toThrowError(/unavailable/);
  });

  it('creates the third active Student with display-once credentials but rejects a fourth', () => {
    const created = createParentStudent({
      principal,
      household: household(2),
      expected_revision: 7,
      student_id: 'student-3',
      actual_name: 'שלמה Student',
      display_name: 'Shlomo',
      username: 'shlomo.student',
      relationship: 'dependent',
      new_password: '123456',
      password_confirmation: '123456',
    });
    expect(created.result.snapshot.active_student_count).toBe(3);
    expect(created.result.canonical_enrollment).toBe('enroll');
    expect(created.result.credential_handoff).toMatchObject({
      username: 'shlomo.student',
      new_password: '123456',
      display_once: true,
      emailed: false,
    });
    expect(JSON.stringify(created.next)).not.toContain('123456');
    expect(() =>
      createParentStudent({
        principal,
        household: household(3),
        expected_revision: 7,
        student_id: 'student-4',
        actual_name: 'Fourth Student',
        username: 'student.4',
        relationship: 'dependent',
        new_password: '654321',
        password_confirmation: '654321',
      }),
    ).toThrowError(/all 3 active Student seats/);
  });

  it('rejects creating a new self Student while preserving legacy self records', () => {
    expect(() =>
      createParentStudent({
        principal,
        household: household(),
        expected_revision: 7,
        student_id: 'student-self',
        actual_name: 'Parent Learner',
        username: 'parent.learner',
        relationship: 'self',
        new_password: '123456',
        password_confirmation: '123456',
      }),
    ).toThrowError(/dependent/i);
  });

  it('hard-caps an inflated repository allowance at three active Student seats', () => {
    const inflated = { ...household(3), student_allowance: 99 };
    expect(buildParentHouseholdSnapshot({ principal, household: inflated })).toMatchObject({
      student_allowance: 3,
      active_student_count: 3,
      available_student_seats: 0,
    });
    expect(() =>
      createParentStudent({
        principal,
        household: inflated,
        expected_revision: 7,
        student_id: 'student-4',
        actual_name: 'Fourth Student',
        username: 'student.4',
        relationship: 'dependent',
        new_password: '654321',
        password_confirmation: '654321',
      }),
    ).toThrowError(/all 3 active Student seats/);
  });

  it('fails stale revisions and inactive access before any mutation', () => {
    expect(() =>
      updateParentStudent({
        principal,
        household: household(1),
        expected_revision: 6,
        student_id: 'student-1',
        actual_name: 'Changed',
        username: 'student.1',
      }),
    ).toThrowError(/Refresh/);
    expect(() =>
      createParentStudent({
        principal,
        household: { ...household(), access_state: 'inactive' },
        expected_revision: 7,
        student_id: 'student-1',
        actual_name: 'Student',
        username: 'student.new',
        relationship: 'dependent',
        new_password: '123456',
        password_confirmation: '123456',
      }),
    ).toThrowError(/inactive/);
  });

  it('archives, frees a seat, restores only with allowance, and revokes sessions', () => {
    const archived = archiveParentStudent({
      principal,
      household: household(3),
      expected_revision: 7,
      student_id: 'student-1',
    });
    expect(archived.result).toMatchObject({
      revoke_student_sessions: true,
      canonical_enrollment: 'disable',
      snapshot: { active_student_count: 2, available_student_seats: 1 },
    });
    const restored = restoreParentStudent({
      principal,
      household: archived.next,
      expected_revision: 8,
      student_id: 'student-1',
    });
    expect(restored.result).toMatchObject({
      canonical_enrollment: 'enroll',
      snapshot: { active_student_count: 3, available_student_seats: 0 },
    });
    expect(() =>
      restoreParentStudent({
        principal,
        household: {
          ...archived.next,
          students: [
            ...archived.next.students,
            {
              ...archived.next.students[1]!,
              student_id: 'replacement-active',
              username: 'replacement.active',
            },
          ],
        },
        expected_revision: 8,
        student_id: 'student-1',
      }),
    ).toThrowError(/all 3 active Student seats/);
  });

  it('rejects same-state lifecycle resubmits before replacement, revision, or audit creation', () => {
    const archived = archiveParentStudent({
      principal,
      household: household(1),
      expected_revision: 7,
      student_id: 'student-1',
    }).next;
    const archivedBefore = structuredClone(archived);

    expect(() =>
      archiveParentStudent({
        principal,
        household: archived,
        expected_revision: 8,
        student_id: 'student-1',
      }),
    ).toThrowError(/already archived/);
    expect(archived).toEqual(archivedBefore);
    expect(archived.revision).toBe(8);

    const active = household(1);
    const activeBefore = structuredClone(active);
    expect(() =>
      restoreParentStudent({
        principal,
        household: active,
        expected_revision: 7,
        student_id: 'student-1',
      }),
    ).toThrowError(/already active/);
    expect(active).toEqual(activeBefore);
    expect(active.revision).toBe(7);
  });

  it('increments credential version, revokes sessions, and never exposes an old password', () => {
    const reset = resetParentStudentCredential({
      principal,
      household: household(1),
      expected_revision: 7,
      student_id: 'student-1',
      new_password: '654321',
      password_confirmation: '654321',
    });
    expect(reset.next.students[0]!.credential_version).toBe(3);
    expect(reset.result.revoke_student_sessions).toBe(true);
    expect(reset.result.credential_handoff?.new_password).toBe('654321');
    expect(reset.result.credential_handoff).not.toHaveProperty('old_password');
    expect(JSON.stringify(reset.next)).not.toMatch(/password/i);
  });
});
