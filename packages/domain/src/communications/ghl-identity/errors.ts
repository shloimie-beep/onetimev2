export const GHL_IDENTITY_ERROR_CODES = [
  'student_contact_prohibited',
  'local_commit_required',
  'invalid_contract',
  'stale_version',
] as const;
export type GhlIdentityErrorCode = (typeof GHL_IDENTITY_ERROR_CODES)[number];

export class GhlIdentityError extends Error {
  constructor(
    readonly code: GhlIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GhlIdentityError';
  }
}
