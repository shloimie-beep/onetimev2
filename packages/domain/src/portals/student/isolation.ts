import {
  STUDENT_PORTAL_ERROR_CODES,
  type StudentPortalPrincipal,
  type StudentSelfRecord,
} from '../../../../contracts/src/portals/student/index.ts';
import { StudentPortalError } from './errors.ts';

const GENERIC_DENIAL = 'This Student page is unavailable.';

export function assertActiveStudentPrincipal(principal: StudentPortalPrincipal) {
  if (
    principal.role !== 'student' ||
    !principal.studentId ||
    !principal.householdId ||
    !principal.sessionId
  ) {
    throw new StudentPortalError(STUDENT_PORTAL_ERROR_CODES.scopeDenied, GENERIC_DENIAL);
  }
  if (principal.studentState === 'archived') {
    throw new StudentPortalError(STUDENT_PORTAL_ERROR_CODES.archived, GENERIC_DENIAL);
  }
  if (principal.accessState === 'inactive') {
    throw new StudentPortalError(
      STUDENT_PORTAL_ERROR_CODES.accessInactive,
      'This household’s access is inactive. Ask your account owner to restore access.',
    );
  }
  return principal;
}

export function assertStudentSelfRecord(
  principal: StudentPortalPrincipal,
  record: StudentSelfRecord,
) {
  assertActiveStudentPrincipal(principal);
  if (
    record.studentId !== principal.studentId ||
    record.householdId !== principal.householdId ||
    record.relationship !== principal.relationship ||
    record.state !== 'active'
  ) {
    throw new StudentPortalError(STUDENT_PORTAL_ERROR_CODES.scopeDenied, GENERIC_DENIAL);
  }
  return record;
}
