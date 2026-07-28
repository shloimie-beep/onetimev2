import { CONTENT_INGEST_ERROR_CODES } from '../../../../contracts/src/content/ingest/index.ts';

export type ContentIngestErrorCode =
  (typeof CONTENT_INGEST_ERROR_CODES)[keyof typeof CONTENT_INGEST_ERROR_CODES];

export class ContentIngestError extends Error {
  constructor(
    readonly code: ContentIngestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContentIngestError';
  }
}
