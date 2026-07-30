import { describe, expect, it } from 'vitest';
import type {
  StudentPortalPrincipal,
  StudentSelfRecord,
  StudentTodaySnapshot,
} from '../../../../contracts/src/portals/student/index.ts';
import { StudentPortalError } from './errors.ts';
import { assertStudentSelfRecord } from './isolation.ts';
import { authorizeStudentRoute, studentNavigation } from './navigation.ts';
import { buildStudentPortalBootstrap } from './view.ts';

const principal: StudentPortalPrincipal = {
  role: 'student',
  humanAccountId: 'account-student-1',
  sessionId: 'session-1',
  householdId: 'household-1',
  studentId: 'student-1',
  credentialVersion: 3,
  relationship: 'dependent',
  selfAdultOwnerVerified: false,
  accessState: 'active',
  studentState: 'active',
  preferredTimeZone: 'America/New_York',
};

const profile: StudentSelfRecord = {
  studentId: 'student-1',
  householdId: 'household-1',
  actualName: 'Student One',
  displayName: 'One',
  username: 'student.one',
  relationship: 'dependent',
  state: 'active',
  version: 4,
};

const today: StudentTodaySnapshot = {
  nextClassLabel: 'Sunday class',
  nextClassTimeLabel: '7:00 PM EDT',
  join: {
    state: 'join',
    occurrenceId: 'occurrence-1',
    action: 'open_student_class',
  },
  latestLessonTitle: 'Mishnah lesson',
  latestLessonContentId: 'content-1',
  questionStatus: 'answered',
  unreadNoticeCount: 2,
  nextBadgeLabel: 'Five classes',
  nextBadgeProgressPercent: 80,
};

describe('P14 Student self-only portal contract', () => {
  it('OTV2-STUDENT-041 and 049 deny sibling and cross-household records', () => {
    expect(() =>
      assertStudentSelfRecord(principal, { ...profile, studentId: 'sibling-2' }),
    ).toThrowError(StudentPortalError);
    expect(() =>
      assertStudentSelfRecord(principal, { ...profile, householdId: 'household-2' }),
    ).toThrowError(StudentPortalError);
  });

  it('denies archived Students and inactive household access before projection', () => {
    expect(() =>
      buildStudentPortalBootstrap({
        principal: { ...principal, studentState: 'archived' },
        profile,
        today,
      }),
    ).toThrowError(/unavailable/);
    expect(() =>
      buildStudentPortalBootstrap({
        principal: { ...principal, accessState: 'inactive' },
        profile,
        today,
      }),
    ).toThrowError(/access is inactive/);
  });

  it('OTV2-STUDENT-042 through 048 exposes only canonical Student navigation', () => {
    const navigation = studentNavigation(principal);
    expect(navigation.map((item) => item.id)).toEqual([
      'today',
      'calendar',
      'library',
      'progress',
      'questions',
      'updates',
      'notifications',
      'support',
      'account',
    ]);
    expect(JSON.stringify(navigation)).not.toMatch(/parent|admin|billing|crm|newsletter/i);
    for (const path of [
      '/app/student',
      '/app/student/calendar',
      '/app/student/classes/occurrence-1',
      '/app/student/class/occurrence-1',
      '/app/student/library/content-1',
      '/app/student/progress',
      '/app/student/questions/question-1',
      '/app/student/updates',
      '/app/student/notifications',
      '/app/student/support/ticket-1',
      '/app/student/account',
    ]) {
      expect(authorizeStudentRoute(principal, path)).toEqual({ allowed: true, path });
    }
  });

  it('denies Parent/Admin, malformed, sibling-selector, and dependent privacy routes', () => {
    for (const path of [
      '/app/parent',
      '/app/dashboard',
      '/app/student/siblings/student-2',
      '/app/student/../parent',
      '/app/student/privacy',
      '/app/student/data-rights',
    ]) {
      expect(() => authorizeStudentRoute(principal, path)).toThrowError(/unavailable/);
    }
  });

  it('allows self-managed adult Student privacy routes only with verified ownership', () => {
    const self = {
      ...principal,
      relationship: 'self' as const,
      selfAdultOwnerVerified: true,
    };
    expect(studentNavigation(self).map((item) => item.id)).toContain('privacy');
    expect(authorizeStudentRoute(self, '/app/student/data-rights')).toEqual({
      allowed: true,
      path: '/app/student/data-rights',
    });
  });

  it('OTV2-STUDENT-050 returns read-only username and Parent/Admin credential guidance', () => {
    const result = buildStudentPortalBootstrap({ principal, profile, today });
    expect(result.profile).toEqual({
      studentId: 'student-1',
      actualName: 'Student One',
      displayName: 'One',
      username: 'student.one',
      relationship: 'dependent',
    });
    expect(result.account).toMatchObject({
      credentialManagedBy: 'parent_or_admin',
      canChangePassword: false,
      canViewCurrentPassword: false,
      canLogout: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/email|passwordHash|sibling|household-2/i);
  });
});
