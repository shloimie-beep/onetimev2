import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('launch-first live console', () => {
  it('uses native Zoom end controls and closes only One Time access after status 3', async () => {
    const source = await readFile('apps/web/src/client/app/live-entry.tsx', 'utf8');
    expect(source).toContain('End the meeting using Zoom’s End Meeting for All control.');
    expect(source).toContain('Zoom ended. One Time Student access is closed.');
    expect(source).toContain('Retry access close');
    expect(source).toContain('if (status === 3)');
    expect(source).toContain('pendingAccessClose = closeProductionBasicAccess();');
    expect(source).toContain('await confirmProductionBasicHostLive(session.csrf_token);');
    expect(source).toContain(
      'await pendingAccessClose;\n        await closeProductionBasicAccess();',
    );
    expect(source).not.toMatch(/End Class|Reconcile \/ Refresh Status|Retry access cleanup/u);
    expect(source).not.toMatch(/host-end-attempt|host-end-status|host-end-cleanup/u);
  });
});
