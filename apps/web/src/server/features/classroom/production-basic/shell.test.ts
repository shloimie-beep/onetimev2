import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('production-basic Student classroom shell', () => {
  it('permits Meeting SDK assets only when the same actor-aware binding is ready', async () => {
    const source = (await readFile('apps/web/src/server/app.ts', 'utf8')).replaceAll('\r\n', '\n');
    expect(source).toContain('const productionBasicProviderReady =');
    expect(source).toContain('await productionBasicClassroomService.ready({');
    expect(source).toContain('||\n      productionBasicStudentReady');
    expect(source).toContain("\"script-src 'self' https://source.zoom.us");
  });
});
