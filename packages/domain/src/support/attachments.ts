import { TextDecoder } from 'node:util';
import type { SupportAttachmentUpload } from '../../../contracts/src/support/index.ts';
import { sha256Hex } from './hmac.ts';
import { createSupportId } from './ids.ts';
import { redactSupportText } from './redaction.ts';

export type NormalizedSupportAttachment = {
  attachment_id: string;
  normalized_filename: string;
  media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'text/plain';
  size_bytes: number;
  sha256: string;
  transfer_locator: string;
  normalization: 'image-decoded-and-reencoded' | 'utf8-text-normalized';
  storage_class: 'private';
  content_disposition: 'attachment';
  pixel_width: number | null;
  pixel_height: number | null;
  blob_bytes: Buffer;
  redacted_filename: boolean;
};

export class SupportAttachmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const maxAttachments = 3;
const maxImageBytes = 5 * 1024 * 1024;
const maxTextBytes = 1024 * 1024;
const maxTotalBytes = 10 * 1024 * 1024;
const maxAxisPixels = 8000;
const maxMegapixels = 20;

export function normalizeSupportAttachments(
  uploads: SupportAttachmentUpload[],
): NormalizedSupportAttachment[] {
  if (uploads.length > maxAttachments) {
    throw new SupportAttachmentError('ATTACHMENT_LIMIT_EXCEEDED', 'Attach up to three files.');
  }
  const normalized: NormalizedSupportAttachment[] = [];
  let totalBytes = 0;
  for (const upload of uploads) {
    const declaredType = canonicalMediaType(upload.media_type);
    if (!declaredType) {
      throw new SupportAttachmentError('ATTACHMENT_TYPE_REJECTED', 'Unsupported attachment type.');
    }
    const bytes = decodeBase64(upload.content_base64);
    if (bytes.length === 0) {
      throw new SupportAttachmentError('ATTACHMENT_EMPTY', 'Attachment is empty.');
    }
    totalBytes += bytes.length;
    if (totalBytes > maxTotalBytes) {
      throw new SupportAttachmentError('ATTACHMENT_TOTAL_TOO_LARGE', 'Attachments are too large.');
    }
    rejectForbiddenBytes(bytes);
    const filenameResult = normalizeFilename(upload.filename, declaredType);
    const attachment =
      declaredType === 'text/plain'
        ? normalizeTextAttachment(bytes, filenameResult.name)
        : normalizeImageAttachment(bytes, filenameResult.name, declaredType);
    normalized.push({
      ...attachment,
      redacted_filename: filenameResult.redacted,
    });
  }
  return normalized;
}

function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) {
    throw new SupportAttachmentError(
      'ATTACHMENT_BASE64_INVALID',
      'Attachment encoding is invalid.',
    );
  }
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64').replace(/=+$/u, '') !== normalized.replace(/=+$/u, '')) {
    throw new SupportAttachmentError(
      'ATTACHMENT_BASE64_INVALID',
      'Attachment encoding is invalid.',
    );
  }
  return bytes;
}

function canonicalMediaType(value: string) {
  const normalized = value.toLowerCase().split(';')[0]?.trim();
  if (
    normalized === 'image/png' ||
    normalized === 'image/jpeg' ||
    normalized === 'image/webp' ||
    normalized === 'text/plain'
  ) {
    return normalized;
  }
  return null;
}

function normalizeFilename(
  filename: string,
  mediaType: NormalizedSupportAttachment['media_type'],
): { name: string; redacted: boolean } {
  if (hasUnsafeFilenameCharacters(filename) || filename.includes('..')) {
    throw new SupportAttachmentError(
      'ATTACHMENT_FILENAME_REJECTED',
      'Attachment filename is unsafe.',
    );
  }
  const trimmed = filename.trim();
  if (!trimmed) {
    throw new SupportAttachmentError(
      'ATTACHMENT_FILENAME_REJECTED',
      'Attachment filename is unsafe.',
    );
  }
  const redacted = redactSupportText(trimmed);
  let base = redacted.text
    .normalize('NFKC')
    .replace(/[^\w .()[\]-]+/gu, '_')
    .replace(/\s+/gu, ' ')
    .replace(/^\.+/u, '')
    .trim();
  if (!base) base = 'support-attachment';
  const extension =
    mediaType === 'image/png'
      ? '.png'
      : mediaType === 'image/jpeg'
        ? '.jpg'
        : mediaType === 'image/webp'
          ? '.webp'
          : '.txt';
  base = base.replace(/\.[A-Za-z0-9]{1,8}$/u, '');
  const maxBaseLength = Math.max(1, 100 - extension.length);
  return {
    name: `${base.slice(0, maxBaseLength)}${extension}`,
    redacted: redacted.changed,
  };
}

function normalizeTextAttachment(bytes: Buffer, filename: string): NormalizedSupportAttachment {
  if (bytes.length > maxTextBytes) {
    throw new SupportAttachmentError('ATTACHMENT_TEXT_TOO_LARGE', 'Text attachment is too large.');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SupportAttachmentError('ATTACHMENT_UTF8_INVALID', 'Text attachment must be UTF-8.');
  }
  const lowered = text.slice(0, 512).toLowerCase();
  if (/<\s*(?:svg|html|script|iframe|body|object)\b/u.test(lowered)) {
    throw new SupportAttachmentError('ATTACHMENT_MARKUP_REJECTED', 'Markup files are not allowed.');
  }
  const normalizedText = text
    .replace(/^\uFEFF/u, '')
    .split('')
    .filter((char) => isSafeTextChar(char))
    .join('')
    .replace(/\r\n?/gu, '\n');
  const stored = Buffer.from(normalizedText, 'utf8');
  const attachmentId = createSupportId('ota');
  return {
    attachment_id: attachmentId,
    normalized_filename: filename.endsWith('.txt') ? filename : `${filename}.txt`,
    media_type: 'text/plain',
    size_bytes: stored.length,
    sha256: sha256Hex(stored),
    transfer_locator: `onetime-private-blob://${attachmentId}`,
    normalization: 'utf8-text-normalized',
    storage_class: 'private',
    content_disposition: 'attachment',
    pixel_width: null,
    pixel_height: null,
    blob_bytes: stored,
    redacted_filename: false,
  };
}

function normalizeImageAttachment(
  bytes: Buffer,
  filename: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp',
): NormalizedSupportAttachment {
  if (bytes.length > maxImageBytes) {
    throw new SupportAttachmentError(
      'ATTACHMENT_IMAGE_TOO_LARGE',
      'Image attachment is too large.',
    );
  }
  const parsed =
    mediaType === 'image/png'
      ? parsePng(bytes)
      : mediaType === 'image/jpeg'
        ? parseJpeg(bytes)
        : parseWebp(bytes);
  if (parsed.mediaType !== mediaType) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'Attachment type does not match.');
  }
  if (
    parsed.width > maxAxisPixels ||
    parsed.height > maxAxisPixels ||
    (parsed.width * parsed.height) / 1_000_000 > maxMegapixels
  ) {
    throw new SupportAttachmentError('ATTACHMENT_IMAGE_DIMENSIONS_REJECTED', 'Image is too large.');
  }
  const stored =
    mediaType === 'image/png'
      ? stripPngMetadata(bytes)
      : mediaType === 'image/jpeg'
        ? stripJpegMetadata(bytes)
        : stripWebpMetadata(bytes);
  const attachmentId = createSupportId('ota');
  return {
    attachment_id: attachmentId,
    normalized_filename: filename,
    media_type: mediaType,
    size_bytes: stored.length,
    sha256: sha256Hex(stored),
    transfer_locator: `onetime-private-blob://${attachmentId}`,
    normalization: 'image-decoded-and-reencoded',
    storage_class: 'private',
    content_disposition: 'attachment',
    pixel_width: parsed.width,
    pixel_height: parsed.height,
    blob_bytes: stored,
    redacted_filename: false,
  };
}

function rejectForbiddenBytes(bytes: Buffer) {
  const header = bytes.subarray(0, Math.min(bytes.length, 512)).toString('latin1').toLowerCase();
  const ascii = bytes.subarray(0, Math.min(bytes.length, 512)).toString('utf8').toLowerCase();
  if (
    bytes.subarray(0, 4).equals(Buffer.from('%PDF')) ||
    bytes.subarray(0, 2).equals(Buffer.from('MZ')) ||
    bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
    bytes.subarray(0, 4).equals(Buffer.from('PK\x03\x04', 'latin1')) ||
    bytes.subarray(0, 4).equals(Buffer.from('Rar!')) ||
    ascii.includes('<svg') ||
    ascii.includes('<html') ||
    ascii.includes('<script') ||
    header.includes('<?php')
  ) {
    throw new SupportAttachmentError(
      'ATTACHMENT_FORBIDDEN_CONTENT',
      'Attachment content is not allowed.',
    );
  }
}

function parsePng(bytes: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'PNG signature is invalid.');
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'PNG header is invalid.');
  }
  return {
    mediaType: 'image/png' as const,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function parseJpeg(bytes: Buffer) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'JPEG signature is invalid.');
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        mediaType: 'image/jpeg' as const,
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'JPEG dimensions were not found.');
}

function parseWebp(bytes: Buffer) {
  if (
    bytes.length < 30 ||
    bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'WebP signature is invalid.');
  }
  const chunkType = bytes.subarray(12, 16).toString('ascii');
  if (chunkType === 'VP8X') {
    return {
      mediaType: 'image/webp' as const,
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (chunkType === 'VP8L') {
    if (bytes[20] !== 0x2f) {
      throw new SupportAttachmentError(
        'ATTACHMENT_IMAGE_INVALID',
        'WebP lossless header is invalid.',
      );
    }
    const bits = bytes.readUInt32LE(21);
    return {
      mediaType: 'image/webp' as const,
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunkType === 'VP8 ') {
    if (bytes.subarray(23, 26).toString('hex') !== '9d012a') {
      throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'WebP lossy header is invalid.');
    }
    return {
      mediaType: 'image/webp' as const,
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'WebP type is unsupported.');
}

function readUint24LE(bytes: Buffer, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function stripPngMetadata(bytes: Buffer) {
  const parts = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    const firstChar = type.charCodeAt(0);
    const isCritical = firstChar >= 65 && firstChar <= 90;
    if (isCritical) parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

function stripJpegMetadata(bytes: Buffer) {
  const parts = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset));
      return Buffer.concat(parts);
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (end > bytes.length) break;
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return bytes;
}

function stripWebpMetadata(bytes: Buffer) {
  const chunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.subarray(offset, offset + 4).toString('ascii');
    const length = bytes.readUInt32LE(offset + 4);
    const paddedEnd = offset + 8 + length + (length % 2);
    if (paddedEnd > bytes.length) break;
    if (!['EXIF', 'ICCP', 'XMP '].includes(type)) {
      chunks.push(bytes.subarray(offset, paddedEnd));
    }
    offset = paddedEnd;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

function hasUnsafeFilenameCharacters(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === '/' || char === '\\' || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isSafeTextChar(char: string) {
  const code = char.charCodeAt(0);
  return code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code !== 0x7f);
}
