import { TextDecoder } from 'node:util';
import sharp, { type Metadata } from 'sharp';
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
const maxInputPixels = maxMegapixels * 1_000_000;

export const supportAttachmentLimits = {
  maxAttachments,
  maxImageBytes,
  maxTextBytes,
  maxTotalBytes,
  maxAxisPixels,
  maxMegapixels,
};

export async function normalizeSupportAttachments(
  uploads: SupportAttachmentUpload[],
): Promise<NormalizedSupportAttachment[]> {
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
        : await normalizeImageAttachment(bytes, filenameResult.name, declaredType);
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

async function normalizeImageAttachment(
  bytes: Buffer,
  filename: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp',
): Promise<NormalizedSupportAttachment> {
  if (bytes.length > maxImageBytes) {
    throw new SupportAttachmentError(
      'ATTACHMENT_IMAGE_TOO_LARGE',
      'Image attachment is too large.',
    );
  }
  assertStrictImageContainer(bytes, mediaType);
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      animated: false,
      failOn: 'error',
      limitInputPixels: maxInputPixels,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'Image could not be decoded.');
  }
  if (metadata.format !== sharpFormatForMediaType(mediaType)) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'Attachment type does not match.');
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new SupportAttachmentError(
      'ATTACHMENT_IMAGE_INVALID',
      'Animated images are not allowed.',
    );
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < 1 ||
    height < 1 ||
    width > maxAxisPixels ||
    height > maxAxisPixels ||
    (width * height) / 1_000_000 > maxMegapixels
  ) {
    throw new SupportAttachmentError('ATTACHMENT_IMAGE_DIMENSIONS_REJECTED', 'Image is too large.');
  }
  let stored: Buffer;
  try {
    stored = await reencodeImage(bytes, mediaType);
  } catch {
    throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'Image could not be re-encoded.');
  }
  if (stored.length === 0 || stored.length > maxImageBytes) {
    throw new SupportAttachmentError(
      'ATTACHMENT_IMAGE_TOO_LARGE',
      'Normalized image is too large.',
    );
  }
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
    pixel_width: width,
    pixel_height: height,
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

function assertStrictImageContainer(
  bytes: Buffer,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp',
) {
  if (mediaType === 'image/png') {
    assertStrictPngContainer(bytes);
    return;
  }
  if (mediaType === 'image/jpeg') {
    assertStrictJpegContainer(bytes);
    return;
  }
  assertStrictWebpContainer(bytes);
}

function assertStrictPngContainer(bytes: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'PNG signature is invalid.');
  }
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || end > bytes.length) {
      throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'PNG chunks are invalid.');
    }
    if (type === 'IEND') {
      if (end !== bytes.length) {
        throw new SupportAttachmentError(
          'ATTACHMENT_POLYGLOT_REJECTED',
          'Image contains trailing data.',
        );
      }
      return;
    }
    offset = end;
  }
  throw new SupportAttachmentError('ATTACHMENT_IMAGE_INVALID', 'PNG end marker is missing.');
}

function assertStrictJpegContainer(bytes: Buffer) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'JPEG signature is invalid.');
  }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new SupportAttachmentError(
      'ATTACHMENT_POLYGLOT_REJECTED',
      'Image contains trailing data.',
    );
  }
}

function assertStrictWebpContainer(bytes: Buffer) {
  if (
    bytes.length < 20 ||
    bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    throw new SupportAttachmentError('ATTACHMENT_MIME_MISMATCH', 'WebP signature is invalid.');
  }
  const riffSize = bytes.readUInt32LE(4);
  if (riffSize + 8 !== bytes.length) {
    throw new SupportAttachmentError(
      'ATTACHMENT_POLYGLOT_REJECTED',
      'Image contains trailing data.',
    );
  }
}

function sharpFormatForMediaType(mediaType: 'image/png' | 'image/jpeg' | 'image/webp') {
  if (mediaType === 'image/png') return 'png';
  if (mediaType === 'image/jpeg') return 'jpeg';
  return 'webp';
}

async function reencodeImage(bytes: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/webp') {
  const pipeline = sharp(bytes, {
    animated: false,
    failOn: 'error',
    limitInputPixels: maxInputPixels,
    sequentialRead: true,
  }).rotate();
  if (mediaType === 'image/png') {
    return pipeline.png({ compressionLevel: 9, force: true }).toBuffer();
  }
  if (mediaType === 'image/jpeg') {
    return pipeline.jpeg({ force: true, mozjpeg: false, quality: 90 }).toBuffer();
  }
  return pipeline.webp({ force: true, quality: 90 }).toBuffer();
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
