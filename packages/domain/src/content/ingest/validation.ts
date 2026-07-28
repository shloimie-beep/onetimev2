import { createHash } from 'node:crypto';
import {
  CONTENT_INGEST_CONTAINERS,
  CONTENT_INGEST_ERROR_CODES,
  CONTENT_INGEST_MAX_BYTES,
  CONTENT_INGEST_MIME_TYPES,
  type ContentIngestContainer,
  type ContentIngestMimeType,
} from '../../../../contracts/src/content/ingest/index.ts';
import { ContentIngestError } from './errors.ts';

export function assertSha256(value: string, field = 'sha256') {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidSha256,
      `${field} must be a lowercase SHA-256 digest.`,
    );
  }
}

export function validateRecordingMetadata(input: {
  displayFilename: string;
  mimeType: string;
  byteCount: number;
}) {
  if (
    !Number.isSafeInteger(input.byteCount) ||
    input.byteCount < 1 ||
    input.byteCount > CONTENT_INGEST_MAX_BYTES
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidSize,
      `Recording size must be between 1 byte and ${CONTENT_INGEST_MAX_BYTES} bytes.`,
    );
  }
  const displayFilename = safeDisplayFilename(input.displayFilename);
  const extension = displayFilename.split('.').pop()?.toLowerCase();
  if (!extension || !CONTENT_INGEST_CONTAINERS.includes(extension as ContentIngestContainer)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidContainer,
      'Recording container must be MP4, MOV, or MKV.',
    );
  }
  if (!CONTENT_INGEST_MIME_TYPES.includes(input.mimeType as ContentIngestMimeType)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidContainer,
      'Recording MIME type is not supported.',
    );
  }
  const expectedMime: Record<ContentIngestContainer, ContentIngestMimeType> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
  };
  if (expectedMime[extension as ContentIngestContainer] !== input.mimeType) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidContainer,
      'Recording filename extension and MIME type disagree.',
    );
  }
  return {
    displayFilename,
    container: extension as ContentIngestContainer,
    mimeType: input.mimeType as ContentIngestMimeType,
  };
}

export function safeDisplayFilename(value: string) {
  const normalized = value.normalize('NFKC').trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });
  if (
    normalized.length < 1 ||
    normalized.length > 240 ||
    /[\\/]/.test(normalized) ||
    hasControlCharacter ||
    normalized === '.' ||
    normalized === '..'
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.unsafeFilename,
      'Recording filename is unsafe.',
    );
  }
  return normalized;
}

export function stableIngestKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32)}`;
}

export function digestProtectedReference(value: string) {
  if (!value) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Protected reference cannot be empty.',
    );
  }
  return createHash('sha256').update(value).digest('hex');
}
