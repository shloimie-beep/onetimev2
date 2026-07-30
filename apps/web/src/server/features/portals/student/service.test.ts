import { describe, expect, it, vi } from 'vitest';
import type {
  StudentPortalPrincipal,
  StudentSelfRecord,
  StudentTodaySnapshot,
} from '../../../../../../../packages/contracts/src/portals/student/index.ts';
import { createStudentPortalService } from './service.ts';

const principal: StudentPortalPrincipal = {
  role: 'student',
  humanAccountId: 'account-1',
  sessionId: 'session-1',
  householdId: 'household-1',
  studentId: 'student-1',
  credentialVersion: 1,
  relationship: 'dependent',
  selfAdultOwnerVerified: false,
  accessState: 'active',
  studentState: 'active',
  preferredTimeZone: 'Asia/Jerusalem',
};

const profile: StudentSelfRecord = {
  studentId: 'student-1',
  householdId: 'household-1',
  actualName: 'Student One',
  displayName: null,
  username: 'student.one',
  relationship: 'dependent',
  state: 'active',
  version: 1,
};

const today: StudentTodaySnapshot = {
  nextClassLabel: null,
  nextClassTimeLabel: null,
  join: null,
  latestLessonTitle: null,
  latestLessonContentId: null,
  questionStatus: 'none',
  unreadNoticeCount: 0,
  nextBadgeLabel: null,
  nextBadgeProgressPercent: null,
};

describe('P14 Student server service', () => {
  it('derives the only repository target from authenticated Student scope', async () => {
    const loadSelf = vi.fn().mockResolvedValue({ profile, today });
    const service = createStudentPortalService({
      repository: { loadSelf },
      sessions: { revokeStudentSession: vi.fn() },
    });
    const result = await service.bootstrap(principal);
    expect(loadSelf).toHaveBeenCalledWith({
      studentId: 'student-1',
      householdId: 'household-1',
    });
    expect(result.profile.studentId).toBe('student-1');
  });

  it('logs out only the authenticated Student session', async () => {
    const revokeStudentSession = vi.fn().mockResolvedValue(undefined);
    const service = createStudentPortalService({
      repository: { loadSelf: vi.fn() },
      sessions: { revokeStudentSession },
    });
    await expect(service.logout(principal)).resolves.toEqual({ loggedOut: true });
    expect(revokeStudentSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-1',
      reason: 'student_logout',
    });
  });
});
