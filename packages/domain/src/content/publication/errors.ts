export const CONTENT_PUBLICATION_ERROR_CODES = {
  accessDenied: 'content_publication_access_denied',
  unavailable: 'content_publication_unavailable',
  invalidInput: 'content_publication_invalid_input',
  invalidState: 'content_publication_invalid_state',
  conflict: 'content_publication_conflict',
} as const;

export type ContentPublicationErrorCode =
  (typeof CONTENT_PUBLICATION_ERROR_CODES)[keyof typeof CONTENT_PUBLICATION_ERROR_CODES];

export class ContentPublicationError extends Error {
  constructor(
    readonly code: ContentPublicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContentPublicationError';
  }
}
