import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Zoom host explicit-start control', () => {
  it('does not auto-join when the protected host page loads', async () => {
    const source = await readFile('apps/web/src/client/app/zoom-host-entry.ts', 'utf8');
    expect(source).toContain("document.querySelector<HTMLButtonElement>('[data-zoom-host-start]')");
    expect(source).toContain("startButton?.addEventListener('click', () => void start())");
    expect(source).not.toMatch(/^void start\(\);$/mu);
    expect(source).not.toMatch(/location\.(?:search|hash).*start/iu);
  });
});
