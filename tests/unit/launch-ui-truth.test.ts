import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Sunday launch UI truth', () => {
  it('presents the protected recurring Zoom meeting ahead of legacy occurrence controls', async () => {
    const source = await readFile('apps/web/src/client/app/live-entry.tsx', 'utf8');

    expect(source).toMatch(/productionBasicReady\s*\?\s*'protected recurring ready'/u);
    expect(source).toContain('Surface: Protected recurring Zoom');
    expect(source).toContain('Advanced Stage Host: deferred/off');
    expect(source).toContain('Protected recurring Zoom is ready.');
    expect(source).toContain("'End class'");
    expect(source).toContain('onEndProductionBasic');
    expect(source).toContain('Participant roster controls remain deferred');
    expect(source).toContain('Zoom identity correlation is');
  });

  it('keeps Buffer and Social launch-off values out of the Content overview', async () => {
    const source = await readFile(
      'apps/web/src/client/app/content-workspace/ContentWorkspace.tsx',
      'utf8',
    );

    expect(source).toContain("port.port !== 'buffer'");
    expect(source).toContain("key !== 'social_pending' && key !== 'buffer_pending'");
  });
});
