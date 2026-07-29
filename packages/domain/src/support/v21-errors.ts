export type SupportV21ErrorCode =
  | 'invalid_input'
  | 'forbidden'
  | 'not_found'
  | 'idempotency_conflict'
  | 'version_conflict'
  | 'invalid_transition'
  | 'conversation_link_conflict';

export class SupportV21Error extends Error {
  constructor(
    public readonly code: SupportV21ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SupportV21Error';
  }
}
