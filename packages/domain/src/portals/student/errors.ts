import { STUDENT_PORTAL_ERROR_CODES } from '../../../../contracts/src/portals/student/index.ts';

export type StudentPortalErrorCode =
  (typeof STUDENT_PORTAL_ERROR_CODES)[keyof typeof STUDENT_PORTAL_ERROR_CODES];

export class StudentPortalError extends Error {
  constructor(
    readonly code: StudentPortalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StudentPortalError';
  }
}
