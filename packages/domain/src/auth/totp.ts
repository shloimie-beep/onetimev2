import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

export function generateTotpSecret(bytes = 20) {
  return randomBytes(bytes);
}

export function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  const normalized = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function hotp({
  secret,
  counter,
  digits = DEFAULT_DIGITS,
}: {
  secret: Buffer;
  counter: number | bigint;
  digits?: number;
}) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    (((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff)) %
    10 ** digits;
  return code.toString().padStart(digits, '0');
}

export function totp({
  secret,
  at = Date.now(),
  stepSeconds = DEFAULT_STEP_SECONDS,
  digits = DEFAULT_DIGITS,
}: {
  secret: Buffer;
  at?: number;
  stepSeconds?: number;
  digits?: number;
}) {
  return hotp({ secret, counter: counterForTime(at, stepSeconds), digits });
}

export function verifyTotp({
  secret,
  code,
  at = Date.now(),
  window = 1,
  stepSeconds = DEFAULT_STEP_SECONDS,
  digits = DEFAULT_DIGITS,
  lastAcceptedCounter,
}: {
  secret: Buffer;
  code: string;
  at?: number;
  window?: number;
  stepSeconds?: number;
  digits?: number;
  lastAcceptedCounter?: number | null;
}) {
  const normalized = code.trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(normalized)) return { ok: false as const };
  const currentCounter = counterForTime(at, stepSeconds);
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = currentCounter + offset;
    if (counter < 0) continue;
    if (
      lastAcceptedCounter !== undefined &&
      lastAcceptedCounter !== null &&
      counter <= lastAcceptedCounter
    ) {
      continue;
    }
    const expected = hotp({ secret, counter, digits });
    if (safeEqualCode(normalized, expected)) {
      return { ok: true as const, counter };
    }
  }
  return { ok: false as const };
}

export function otpauthUri({
  issuer,
  accountName,
  secret,
}: {
  issuer: string;
  accountName: string;
  secret: Buffer;
}) {
  const encodedSecret = base32Encode(secret);
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: encodedSecret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function counterForTime(at: number, stepSeconds: number) {
  return Math.floor(at / 1000 / stepSeconds);
}

function safeEqualCode(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
