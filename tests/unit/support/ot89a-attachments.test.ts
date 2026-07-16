import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  normalizeSupportAttachments,
  SupportAttachmentError,
  supportAttachmentLimits,
} from '../../../packages/domain/src/support/attachments.ts';
import { redactSupportText } from '../../../packages/domain/src/support/redaction.ts';

describe('OT-89A support attachment and privacy policy', () => {
  it('normalizes safe text and truly re-encoded image attachments into private metadata only', async () => {
    const png = await imageFixture('png', 10, 12);
    const [text, image] = await normalizeSupportAttachments([
      {
        filename: 'notes@example.test.txt',
        media_type: 'text/plain',
        content_base64: Buffer.from('hello\r\nworld\u0000').toString('base64'),
      },
      {
        filename: 'screen.png',
        media_type: 'image/png',
        content_base64: png.toString('base64'),
      },
    ]);
    expect(text).toMatchObject({
      media_type: 'text/plain',
      normalization: 'utf8-text-normalized',
      storage_class: 'private',
      content_disposition: 'attachment',
      pixel_width: null,
      pixel_height: null,
    });
    expect(text?.transfer_locator).toMatch(/^onetime-private-blob:\/\/ota_/);
    expect(text?.normalized_filename).toContain('[REDACTED_email]');
    expect(text?.blob_bytes.toString('utf8')).toBe('hello\nworld');
    expect(image).toMatchObject({
      media_type: 'image/png',
      normalization: 'image-decoded-and-reencoded',
      pixel_width: 10,
      pixel_height: 12,
    });
    expect(image?.transfer_locator).toMatch(/^onetime-private-blob:\/\/ota_/);
    expect(image?.blob_bytes.equals(png)).toBe(false);
    await expect(sharp(image?.blob_bytes).metadata()).resolves.toMatchObject({ format: 'png' });
  });

  it('rejects limit, malicious, spoofed, traversal, invalid UTF-8, and bomb-like files', async () => {
    await expect(
      normalizeSupportAttachments([
        upload('a.txt', 'text/plain', 'a'),
        upload('b.txt', 'text/plain', 'b'),
        upload('c.txt', 'text/plain', 'c'),
        upload('d.txt', 'text/plain', 'd'),
      ]),
    ).rejects.toThrow(SupportAttachmentError);
    await expect(
      normalizeSupportAttachments([upload('../secret.txt', 'text/plain', 'safe')]),
    ).rejects.toThrow(SupportAttachmentError);
    await expect(
      normalizeSupportAttachments([upload('bad.svg', 'text/plain', '<svg></svg>')]),
    ).rejects.toThrow(SupportAttachmentError);
    await expect(
      normalizeSupportAttachments([
        {
          filename: 'bad.txt',
          media_type: 'text/plain',
          content_base64: Buffer.from([0xff]).toString('base64'),
        },
      ]),
    ).rejects.toThrow(SupportAttachmentError);
    await expect(
      normalizeSupportAttachments([
        {
          filename: 'fake.png',
          media_type: 'image/png',
          content_base64: Buffer.from('%PDF').toString('base64'),
        },
      ]),
    ).rejects.toThrow(SupportAttachmentError);
    await expect(
      normalizeSupportAttachments([
        {
          filename: 'bomb.png',
          media_type: 'image/png',
          content_base64: (await imageFixture('png', 5000, 5000)).toString('base64'),
        },
      ]),
    ).rejects.toThrow(SupportAttachmentError);
  });

  it('rejects image polyglots and strips metadata through decoder re-encoding', async () => {
    const cleanPng = await imageFixture('png', 4, 4);
    await expect(
      normalizeSupportAttachments([
        {
          filename: 'polyglot.png',
          media_type: 'image/png',
          content_base64: Buffer.concat([cleanPng, Buffer.from('%PDF-1.7')]).toString('base64'),
        },
      ]),
    ).rejects.toMatchObject({ code: 'ATTACHMENT_POLYGLOT_REJECTED' });

    const jpeg = await imageFixture('jpeg', 8, 8);
    const withMetadata = jpegWithAppSegments(jpeg, jpeg.length + 4096, Buffer.from('Exif'));
    const [normalized] = await normalizeSupportAttachments([
      {
        filename: 'metadata.jpg',
        media_type: 'image/jpeg',
        content_base64: withMetadata.toString('base64'),
      },
    ]);
    expect(normalized?.normalization).toBe('image-decoded-and-reencoded');
    expect(normalized?.blob_bytes.includes(Buffer.from('Exif'))).toBe(false);
    expect(normalized?.sha256).not.toBe(sha256HexForTest(withMetadata));
  });

  it('keeps the decoded aggregate limit strict under, exact, and over the 10 MiB boundary', async () => {
    const jpeg = await imageFixture('jpeg', 8, 8);
    const underA = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes);
    const underB = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes - 1);
    await expect(
      normalizeSupportAttachments([
        imageUpload('under-a.jpg', 'image/jpeg', underA),
        imageUpload('under-b.jpg', 'image/jpeg', underB),
      ]),
    ).resolves.toHaveLength(2);

    const exactA = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes);
    const exactB = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes);
    await expect(
      normalizeSupportAttachments([
        imageUpload('exact-a.jpg', 'image/jpeg', exactA),
        imageUpload('exact-b.jpg', 'image/jpeg', exactB),
      ]),
    ).resolves.toHaveLength(2);

    await expect(
      normalizeSupportAttachments([
        imageUpload('over-a.jpg', 'image/jpeg', exactA),
        imageUpload('over-b.jpg', 'image/jpeg', exactB),
        upload('over.txt', 'text/plain', 'x'),
      ]),
    ).rejects.toMatchObject({ code: 'ATTACHMENT_TOTAL_TOO_LARGE' });
  });

  it('redacts direct contact details, secrets, tokens, payment data, and addresses', () => {
    const redacted = redactSupportText(
      'email parent@example.test phone +1 202 555 0123 password: secret123 token=abc.def 4111 1111 1111 1111 123 Main Street',
    );
    expect(redacted.count).toBeGreaterThanOrEqual(5);
    expect(redacted.text).not.toContain('parent@example.test');
    expect(redacted.text).not.toContain('202 555');
    expect(redacted.text).not.toContain('secret123');
    expect(redacted.text).not.toContain('4111 1111');
    expect(redacted.text).not.toContain('123 Main Street');
  });
});

function upload(filename: string, mediaType: string, text: string) {
  return { filename, media_type: mediaType, content_base64: Buffer.from(text).toString('base64') };
}

function imageUpload(filename: string, mediaType: string, bytes: Buffer) {
  return { filename, media_type: mediaType, content_base64: bytes.toString('base64') };
}

async function imageFixture(format: 'jpeg' | 'png', width: number, height: number) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 248, g: 210, b: 64 },
    },
    limitInputPixels: false,
  });
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

function jpegWithAppSegments(input: Buffer, targetBytes: number, prefix = Buffer.from('OT89')) {
  if (
    input[0] !== 0xff ||
    input[1] !== 0xd8 ||
    input[input.length - 2] !== 0xff ||
    input[input.length - 1] !== 0xd9
  ) {
    throw new Error('expected JPEG fixture');
  }
  const extraBytes = targetBytes - input.length;
  if (extraBytes < 0) throw new Error('target smaller than fixture');
  const segments: Buffer[] = [];
  let remaining = extraBytes;
  let sequence = 0;
  while (remaining > 0) {
    if (remaining < 4) throw new Error('target leaves an impossible JPEG segment remainder');
    const segmentSize = Math.min(remaining, 65_537);
    const payloadLength = segmentSize - 4;
    const segment = Buffer.alloc(segmentSize, 0x41);
    segment[0] = 0xff;
    segment[1] = 0xe1;
    segment.writeUInt16BE(payloadLength + 2, 2);
    prefix.copy(segment, 4, 0, Math.min(prefix.length, payloadLength));
    if (payloadLength > prefix.length + 1) {
      segment.writeUInt16BE(sequence % 65_536, 4 + prefix.length);
    }
    segments.push(segment);
    remaining -= segmentSize;
    sequence += 1;
  }
  return Buffer.concat([input.subarray(0, 2), ...segments, input.subarray(2)]);
}

function sha256HexForTest(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}
