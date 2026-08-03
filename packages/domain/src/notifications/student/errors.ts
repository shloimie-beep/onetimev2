export const STUDENT_NOTIFICATION_ERROR_CODES = [
  'invalid_identity',
  'invalid_scope',
  'invalid_source_version',
  'invalid_time',
  'invalid_copy',
  'invalid_internal_route',
  'invalid_lifetime',
  'student_scope_denied',
  'notification_not_available',
] as const;

export type StudentNotificationErrorCode = (typeof STUDENT_NOTIFICATION_ERROR_CODES)[number];

export class StudentNotificationError extends Error {
  constructor(
    public readonly code: StudentNotificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StudentNotificationError';
  }
}
