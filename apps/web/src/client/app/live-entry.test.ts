import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('launch-first live console', () => {
  it('keeps native Zoom end controls separate from One Time and gives status 3 only local meaning', async () => {
    const source = await readFile('apps/web/src/client/app/live-entry.tsx', 'utf8');
    expect(source).toContain('End the meeting using Zoom’s End Meeting for All control.');
    expect(source).toContain('Zoom ended. One Time access will close automatically.');
    expect(source).toContain('if (status === 3)');
    expect(source).not.toMatch(/End Class|Reconcile \/ Refresh Status|Retry access cleanup/u);
    expect(source).not.toMatch(/host-end|host-ended|host-end-status|host-end-cleanup/u);
  });
});
