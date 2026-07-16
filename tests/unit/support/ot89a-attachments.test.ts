import { describe, expect, it } from 'vitest';
import {
  normalizeSupportAttachments,
  SupportAttachmentError,
} from '../../../packages/domain/src/support/attachments.ts';
import { redactSupportText } from '../../../packages/domain/src/support/redaction.ts';

describe('OT-89A support attachment and privacy policy', () => {
  it('normalizes safe text and image attachments into private metadata only', () => {
    const [text, image] = normalizeSupportAttachments([
      {
        filename: 'notes@example.test.txt',
        media_type: 'text/plain',
        content_base64: Buffer.from('hello\r\nworld\u0000').toString('base64'),
      },
      {
        filename: 'screen.png',
        media_type: 'image/png',
        content_base64: minimalPng(10, 12).toString('base64'),
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
  });

  it('rejects limit, malicious, spoofed, traversal, invalid UTF-8, and bomb-like files', () => {
    expect(() =>
      normalizeSupportAttachments([
        upload('a.txt', 'text/plain', 'a'),
        upload('b.txt', 'text/plain', 'b'),
        upload('c.txt', 'text/plain', 'c'),
        upload('d.txt', 'text/plain', 'd'),
      ]),
    ).toThrow(SupportAttachmentError);
    expect(() =>
      normalizeSupportAttachments([upload('../secret.txt', 'text/plain', 'safe')]),
    ).toThrow(SupportAttachmentError);
    expect(() =>
      normalizeSupportAttachments([upload('bad.svg', 'text/plain', '<svg></svg>')]),
    ).toThrow(SupportAttachmentError);
    expect(() =>
      normalizeSupportAttachments([
        {
          filename: 'bad.txt',
          media_type: 'text/plain',
          content_base64: Buffer.from([0xff]).toString('base64'),
        },
      ]),
    ).toThrow(SupportAttachmentError);
    expect(() =>
      normalizeSupportAttachments([
        {
          filename: 'fake.png',
          media_type: 'image/png',
          content_base64: Buffer.from('%PDF').toString('base64'),
        },
      ]),
    ).toThrow(SupportAttachmentError);
    expect(() =>
      normalizeSupportAttachments([
        {
          filename: 'bomb.png',
          media_type: 'image/png',
          content_base64: minimalPng(8000, 8000).toString('base64'),
        },
      ]),
    ).toThrow(SupportAttachmentError);
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

function minimalPng(width: number, height: number) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 2;
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0]);
  return Buffer.concat([signature, ihdr, iend]);
}
