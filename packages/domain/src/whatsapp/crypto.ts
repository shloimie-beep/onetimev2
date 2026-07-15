import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { AppConfig } from '../../../config/src/index.ts';

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function normalizeWhatsAppE164(input: string) {
  const trimmed = input.trim();
  const withPlus = trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/[^\d]/g, '')}`;
  const parsed = parsePhoneNumberFromString(withPlus);
  if (parsed?.isPossible()) return parsed.number;
  if (/^\+[1-9]\d{7,14}$/.test(withPlus)) return withPlus;
  throw new Error('whatsapp_sender_e164_invalid');
}

export function whatsappSenderKey(config: AppConfig, providerAccountKey: string, e164: string) {
  return `wa_sender_${hmacHex(config, 'sender', providerAccountKey, e164).slice(0, 32)}`;
}

export function whatsappRecipientKey(config: AppConfig, providerAccountKey: string, e164: string) {
  return `wa_recipient_${hmacHex(config, 'recipient', providerAccountKey, e164).slice(0, 32)}`;
}

export function whatsappTokenHash(config: AppConfig, token: string) {
  return hmacHex(config, 'account-link-token', token);
}

export function whatsappProviderRefHash(
  config: AppConfig,
  providerAccountKey: string,
  providerRef: string,
) {
  return hmacHex(config, 'provider-ref', providerAccountKey, providerRef);
}

export function digestBuffer(input: Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

export function digestText(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export function digestJson(input: unknown) {
  return digestText(JSON.stringify(input));
}

export function verifyHmacSha256(input: {
  rawBody: Buffer;
  signatureHeader?: string | undefined;
  secret?: string | undefined;
}) {
  if (!input.secret || !input.signatureHeader) return false;
  const supplied = input.signatureHeader.replace(/^sha256=/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', input.secret).update(input.rawBody).digest('hex');
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export function encryptForWhatsApp(config: AppConfig, plaintext: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptForWhatsApp(config: AppConfig, value: EncryptedValue) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(config),
    Buffer.from(value.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function encryptionKey(config: AppConfig) {
  return createHash('sha256')
    .update(
      ['ot85-whatsapp', config.accountKey, config.productKey, config.mfaSecretEncryptionKey].join(
        '\0',
      ),
    )
    .digest();
}

function hmacHex(config: AppConfig, scope: string, ...parts: string[]) {
  return createHmac('sha256', config.authCsrfSecret)
    .update([scope, config.accountKey, config.productKey, ...parts].join('\0'))
    .digest('hex');
}
