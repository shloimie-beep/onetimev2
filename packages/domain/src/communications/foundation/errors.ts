export const COMMUNICATION_FOUNDATION_ERROR_CODES = [
  'student_contact_prohibited',
  'invalid_reminder_preference',
  'invalid_class_reminder_routing',
  'non_admin_forbidden',
  'provider_readback_required',
  'unsafe_ghl_url',
  'invalid_workflow_fragment',
  'registry_identity_conflict',
] as const;

export type CommunicationFoundationErrorCode =
  (typeof COMMUNICATION_FOUNDATION_ERROR_CODES)[number];

export class CommunicationFoundationError extends Error {
  constructor(public readonly code: CommunicationFoundationErrorCode) {
    super(code);
    this.name = 'CommunicationFoundationError';
  }
}
