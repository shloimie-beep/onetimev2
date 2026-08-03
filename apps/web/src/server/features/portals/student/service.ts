import {
  STUDENT_PORTAL_ERROR_CODES,
  type StudentPortalPrincipal,
  type StudentSelfRepository,
  type StudentSessionRevocationPort,
} from '../../../../../../../packages/contracts/src/portals/student/index.ts';
import {
  StudentPortalError,
  assertActiveStudentPrincipal,
  authorizeStudentRoute,
  buildStudentPortalBootstrap,
} from '../../../../../../../packages/domain/src/portals/student/index.ts';

export function createStudentPortalService(dependencies: {
  repository: StudentSelfRepository;
  sessions: StudentSessionRevocationPort;
}) {
  return {
    async bootstrap(principal: StudentPortalPrincipal) {
      assertActiveStudentPrincipal(principal);
      const self = await dependencies.repository.loadSelf({
        studentId: principal.studentId,
        householdId: principal.householdId,
      });
      if (!self) {
        throw new StudentPortalError(
          STUDENT_PORTAL_ERROR_CODES.selfRecordMissing,
          'This Student page is unavailable.',
        );
      }
      return buildStudentPortalBootstrap({
        principal,
        profile: self.profile,
        today: self.today,
      });
    },

    authorize(principal: StudentPortalPrincipal, path: string) {
      return authorizeStudentRoute(principal, path);
    },

    async logout(principal: StudentPortalPrincipal) {
      assertActiveStudentPrincipal(principal);
      await dependencies.sessions.revokeStudentSession({
        sessionId: principal.sessionId,
        studentId: principal.studentId,
        reason: 'student_logout',
      });
      return { loggedOut: true as const };
    },
  };
}
