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

  it('joins media-off and waits for Zoom to report a real connected state', async () => {
    const source = await readFile('apps/web/src/client/app/zoom-meeting-sdk-client.ts', 'utf8');
    expect(source).toContain('disablePreview: input.disablePreview ?? false');
    expect(source).toContain('{ ...input, disablePreview: true }');
    expect(source).toContain("zoom.inMeetingServiceListener('onMeetingStatus'");
    expect(source).toContain("zoom.removeInMeetingServiceListener?.('onMeetingStatus'");
    expect(source).toContain('status === 2');
    expect(source).toContain('status === 3 && !connected');
    expect(source).toContain('Meeting SDK connection timed out.');
    expect(source).toContain('}, 45_000);');
    expect(source).toContain('success: () => undefined');
  });

  it("does not pass Zoom's deprecated sdkKey join parameter", async () => {
    const source = await readFile('apps/web/src/client/app/zoom-meeting-sdk-client.ts', 'utf8');
    expect(source).not.toContain('sdkKey: sdkKeyFromSignature');
    expect(source).not.toContain('function sdkKeyFromSignature');
  });
});
