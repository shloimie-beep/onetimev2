import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  totp,
  verifyTotp,
} from '../../packages/domain/src/auth/totp.ts';

describe('TOTP security primitive', () => {
  it('matches RFC 6238 SHA-1 test vectors', () => {
    const secret = Buffer.from('12345678901234567890', 'ascii');
    expect(totp({ secret, at: 59_000, digits: 8 })).toBe('94287082');
    expect(totp({ secret, at: 1_111_111_109_000, digits: 8 })).toBe('07081804');
    expect(totp({ secret, at: 1_111_111_111_000, digits: 8 })).toBe('14050471');
    expect(totp({ secret, at: 1_234_567_890_000, digits: 8 })).toBe('89005924');
    expect(totp({ secret, at: 2_000_000_000_000, digits: 8 })).toBe('69279037');
    expect(totp({ secret, at: 20_000_000_000_000, digits: 8 })).toBe('65353130');
  });

  it('encodes authenticator secrets as standard base32 and rejects replayed counters', () => {
    const secret = Buffer.from('one-time-totp-secret', 'utf8');
    const encoded = base32Encode(secret);
    expect(base32Decode(encoded).toString('utf8')).toBe('one-time-totp-secret');

    const at = 1_800_000_000_000;
    const code = totp({ secret, at });
    const first = verifyTotp({ secret, code, at, window: 1 });
    expect(first).toMatchObject({ ok: true });
    if (!first.ok) throw new Error('expected accepted TOTP');
    expect(verifyTotp({ secret, code, at, window: 1, lastAcceptedCounter: first.counter })).toEqual(
      {
        ok: false,
      },
    );
  });

  it('handles invalid, drifted, and expired codes with a narrow window', () => {
    const secret = Buffer.from('one-time-window-secret', 'utf8');
    const at = 1_800_000_000_000;
    const code = totp({ secret, at });

    expect(verifyTotp({ secret, code: '123456', at, window: 1 })).toEqual({ ok: false });
    expect(verifyTotp({ secret, code, at: at + 30_000, window: 1 })).toMatchObject({
      ok: true,
    });
    expect(verifyTotp({ secret, code, at: at + 90_000, window: 1 })).toEqual({ ok: false });
  });
});
