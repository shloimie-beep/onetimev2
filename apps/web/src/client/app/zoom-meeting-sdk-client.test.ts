import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('production-basic native Meeting SDK adapter', () => {
  it('has a dedicated registration-off adapter and conditionally omits registration-only fields', async () => {
    const source = await readFile('apps/web/src/client/app/zoom-meeting-sdk-client.ts', 'utf8');
    expect(source).toContain('joinZoomMeetingProductionBasic');
    expect(source).toContain('startZoomMeetingProductionBasic');
    expect(source).toContain('...(input.registrantToken ? { tk: input.registrantToken } : {})');
    expect(source).toContain('...(input.userEmail ? { userEmail: input.userEmail } : {})');
    expect(source).toContain('...(input.customerKey ? { customerKey: input.customerKey } : {})');
  });
});
