import { describe, expect, it } from 'vitest';
import manifest from '../../../packages/brand-system/manifest/one-time-brand.v1.json' with { type: 'json' };
import {
  routeBranding,
  shellForRoute,
  tickerAllowlist,
} from '../../../packages/brand-system/src/route-branding.ts';
import { oneTimeTokens } from '../../../packages/brand-system/src/tokens.ts';

describe('One Time brand system manifest', () => {
  it('keeps the versioned manifest and token outputs aligned', () => {
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.tokens.color.background).toBe(oneTimeTokens.color.background);
    expect(manifest.tokens.color.action).toBe(oneTimeTokens.color.action);
    expect(manifest.tokens.typography.display).toBe(oneTimeTokens.typography.display);
    expect(manifest.tokens.componentSizes.touchTarget).toBe(
      oneTimeTokens.componentSizes.touchTarget,
    );
  });

  it('assigns every known visible route to exactly one shell', () => {
    const manifestRoutes = Object.keys(manifest.routes).sort();
    const registryRoutes = routeBranding.map((entry) => entry.route).sort();
    expect(manifestRoutes).toEqual(registryRoutes);
    expect(shellForRoute('/app/parent')).toBe('parent');
    expect(shellForRoute('/app/student')).toBe('student');
  });

  it('keeps the promotional ticker restricted to the public landing route', () => {
    expect([...tickerAllowlist]).toEqual(['/']);
    expect(routeBranding.find((entry) => entry.route === '/')?.ticker).toBe(true);
    expect(
      routeBranding.filter((entry) => entry.route !== '/').every((entry) => !entry.ticker),
    ).toBe(true);
  });
});
