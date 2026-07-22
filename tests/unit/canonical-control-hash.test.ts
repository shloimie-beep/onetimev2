import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalTextForHash } from '../../scripts/ops/canonical-text.ts';

describe('canonical control-file hashing', () => {
  it('produces the same hash for LF, CRLF, and CR checkouts', () => {
    const lf = 'goal_id: OT-LAUNCH-01\nstatus: active\n';
    const crlf = lf.replaceAll('\n', '\r\n');
    const cr = lf.replaceAll('\n', '\r');
    const digest = (value: string) =>
      createHash('sha256').update(canonicalTextForHash(value)).digest('hex');

    expect(digest(crlf)).toBe(digest(lf));
    expect(digest(cr)).toBe(digest(lf));
    expect(canonicalTextForHash(`${lf}\n\n`)).toBe(canonicalTextForHash(lf));
  });
});
