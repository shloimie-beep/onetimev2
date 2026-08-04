import { describe, expect, it } from 'vitest';
import manifest from '../../../packages/brand-system/manifest/one-time-brand.v1.json' with { type: 'json' };
import {
  requiredRouteTemplates,
  routeBranding,
  routeBrandingForPath,
  shellForRoute,
  tickerAllowlist,
} from '../../../packages/brand-system/src/route-branding.ts';
import { oneTimeTokens } from '../../../packages/brand-system/src/tokens.ts';
import {
  componentContracts,
  preUsableScreenshotBan,
  visualMatrixRows,
  visualViewports,
} from '../../../packages/brand-system/src/visual-contract.ts';

describe('One Time brand system manifest', () => {
  it('keeps the versioned manifest and token outputs aligned', () => {
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.tokens.color.background).toBe(oneTimeTokens.color.background);
    expect(manifest.tokens.color.action).toBe(oneTimeTokens.color.action);
    expect(manifest.tokens.typography.display).toBe(oneTimeTokens.typography.display);
    expect(manifest.tokens.typography.campaign).toBe(oneTimeTokens.typography.campaign);
    expect(manifest.tokens.motion.standard).toBe(oneTimeTokens.motion.standard);
    expect(manifest.tokens.layers.dialog).toBe(oneTimeTokens.layers.dialog);
    expect(manifest.tokens.density.default).toBe(oneTimeTokens.density.default);
    expect(manifest.tokens.componentSizes.touchTarget).toBe(
      oneTimeTokens.componentSizes.touchTarget,
    );
  });

  it('assigns every known visible route to exactly one shell', () => {
    const manifestRoutes = Object.keys(manifest.routes).sort();
    const registryRoutes = routeBranding.map((entry) => entry.route).sort();
    expect(manifestRoutes).toEqual(registryRoutes);
    expect(shellForRoute('/app/parent/students')).toBe('parent');
    expect(shellForRoute('/app/student')).toBe('student');
    expect(shellForRoute('/setup/operator_fixture')).toBe('auth');
    expect(shellForRoute('/forgot-password')).toBe('auth');
    expect(shellForRoute('/reset-password/operator_fixture')).toBe('auth');
    expect(shellForRoute('/app/student/support')).toBe('student');
    expect(shellForRoute('/app/classroom/questions')).toBe('owner-admin');
    expect(shellForRoute('/app/contacts/contact_fixture')).toBe('owner-admin');
    expect(routeBrandingForPath('/app/student/support/ticket_fixture')?.role).toBe('student');
    for (const route of [
      '/setup/:token',
      '/forgot-password',
      '/reset-password/:token',
      '/app/student/support',
      '/app/student/support/:ticketId',
      '/app/classroom/questions',
      '/app/contacts/:contactId',
    ]) {
      expect(requiredRouteTemplates).toContain(route);
    }
  });

  it('keeps the promotional ticker restricted to the public landing route', () => {
    expect([...tickerAllowlist]).toEqual(['/']);
    expect(routeBranding.find((entry) => entry.route === '/')?.ticker).toBe(true);
    expect(
      routeBranding.filter((entry) => entry.route !== '/').every((entry) => !entry.ticker),
    ).toBe(true);
  });

  it('defines component fixtures and visual matrix gates for OT-112', () => {
    expect(componentContracts.map((contract) => contract.primitive)).toEqual(
      expect.arrayContaining([
        'Header',
        'SectionTabs',
        'Card',
        'MetricTile',
        'Table',
        'FilterStrip',
        'Button',
        'StatusChip',
        'StatePanel',
        'Dialog',
        'ToastBanner',
        'Footer',
        'MediaFrame',
        'ActivityTimeline',
      ]),
    );
    expect(visualViewports.map((viewport) => viewport.id)).toEqual([
      '360x800',
      '390x844',
      '768x1024',
      '1440x1000',
    ]);
    expect(visualMatrixRows()).toContainEqual(
      expect.objectContaining({
        route: '/app/student/support',
        mode: 'default',
        viewport: '390x844',
      }),
    );
    expect(preUsableScreenshotBan).toEqual(
      expect.arrayContaining(['Refreshing', 'Checking session', 'Signed out']),
    );
  });
});
