import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { revealCurrentSectionTab } from './react.tsx';

describe('SectionTabs narrow-viewport behavior', () => {
  it('reveals a selected tab that is beyond the visible right edge', () => {
    const current = { offsetLeft: 280, offsetWidth: 96 } as HTMLElement;
    const nav = {
      clientWidth: 320,
      scrollLeft: 0,
      querySelector: () => current,
    } as unknown as HTMLElement;

    revealCurrentSectionTab(nav);

    expect(nav.scrollLeft).toBe(56);
  });

  it('reveals a selected tab that is beyond the visible left edge', () => {
    const current = { offsetLeft: 72, offsetWidth: 96 } as HTMLElement;
    const nav = {
      clientWidth: 320,
      scrollLeft: 180,
      querySelector: () => current,
    } as unknown as HTMLElement;

    revealCurrentSectionTab(nav);

    expect(nav.scrollLeft).toBe(72);
  });

  it('keeps horizontal overflow inside the strip and enables Android touch panning', async () => {
    const css = await readFile('packages/brand-system/src/styles/react.css', 'utf8');
    expect(css).toMatch(/\.ot-section-tabs\s*\{[^}]*max-width:\s*100%/su);
    expect(css).toMatch(/\.ot-section-tabs\s*\{[^}]*overflow-x:\s*auto/su);
    expect(css).toMatch(/\.ot-section-tabs\s*\{[^}]*overscroll-behavior-x:\s*contain/su);
    expect(css).toMatch(/\.ot-section-tabs\s*\{[^}]*touch-action:\s*pan-x pan-y pinch-zoom/su);
  });
});
