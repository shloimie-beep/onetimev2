import { randomBytes } from 'node:crypto';

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type SupportIdPrefix = 'ots' | 'otr' | 'otx' | 'ota' | 'evt' | 'bna' | 'corr' | 'req';

export function createSupportId(prefix: SupportIdPrefix): string {
  return `${prefix}_${base32(randomBytes(16)).slice(0, 26)}`;
}

export function isOt89Id(value: string, prefix: SupportIdPrefix): boolean {
  return new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`).test(value);
}

function base32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
