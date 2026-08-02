import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ROUTE_COMPATIBILITY_PATHS,
  CANONICAL_ROUTE_VIEW_BINDINGS,
  compatibilityPathForRoute,
  resolveCanonicalRouteView,
} from './canonical-route-views.ts';
import { CANONICAL_V21_ROUTES, resolveCurrentClientRoute } from './registry.ts';

describe('v2.1 canonical route views', () => {
  it('projects all 93 locked routes without promoting isolated or missing behavior', () => {
    expect(CANONICAL_V21_ROUTES).toHaveLength(93);
    expect(Object.keys(CANONICAL_ROUTE_VIEW_BINDINGS).sort()).toEqual(
      CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'ready')
        .map(({ routeId }) => routeId)
        .sort(),
    );
    expect(new Set(CANONICAL_V21_ROUTES.map(({ routeId }) => routeId)).size).toBe(93);
    expect(
      CANONICAL_V21_ROUTES.filter(({ routeId }) => routeId.startsWith('RT-PUB-')),
    ).toHaveLength(10);
    expect(
      CANONICAL_V21_ROUTES.filter(({ routeId }) => routeId.startsWith('RT-AUTH-')),
    ).toHaveLength(8);
    expect(
      CANONICAL_V21_ROUTES.filter(({ routeId }) => routeId.startsWith('RT-ADM-')),
    ).toHaveLength(41);
    expect(
      CANONICAL_V21_ROUTES.filter(({ routeId }) => routeId.startsWith('RT-PAR-')),
    ).toHaveLength(17);
    expect(
      CANONICAL_V21_ROUTES.filter(({ routeId }) => routeId.startsWith('RT-STU-')),
    ).toHaveLength(17);
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'ready')).toHaveLength(46);
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'isolated')).toHaveLength(
      17,
    );
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'missing')).toHaveLength(
      30,
    );
    for (const route of CANONICAL_V21_ROUTES) {
      if (route.readiness === 'ready') {
        expect(route.handler, route.routeId).not.toMatch(/fallback|default|missing|unavailable/);
        expect(CANONICAL_ROUTE_VIEW_BINDINGS[route.routeId]).toMatchObject({
          routeId: route.routeId,
          title: route.title,
          handler: route.handler,
        });
      } else {
        expect(route.handler, route.routeId).toBeNull();
        expect(CANONICAL_ROUTE_VIEW_BINDINGS[route.routeId]).toBeUndefined();
      }
    }
  });

  it('resolves parameter routes exactly and never by a broad prefix fallback', () => {
    expect(resolveCurrentClientRoute('/app/contacts/contact-1', 'admin')?.routeId).toBe(
      'RT-ADM-011',
    );
    expect(resolveCurrentClientRoute('/app/contacts/contact-1/extra', 'admin')).toBeNull();
    expect(resolveCurrentClientRoute('/app/student/library/item-1', 'student')?.routeId).toBe(
      'RT-STU-021',
    );
    expect(() => resolveCanonicalRouteView('/app/not-a-product-route', 'admin')).toThrow(
      /No canonical route-specific view/,
    );
    expect(() => resolveCanonicalRouteView('/app/search', 'admin')).toThrow(/missing/);
    expect(() => resolveCanonicalRouteView('/app/student/class/occ-1', 'student')).toThrow(
      /isolated/,
    );
  });

  it('uses only explicit intended-behavior compatibility aliases', () => {
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-010']).toBe('/app/crm');
    const detail = resolveCurrentClientRoute('/app/contacts/contact-1', 'admin');
    expect(detail && compatibilityPathForRoute(detail, '/app/contacts/contact-1')).toBe(
      '/app/crm/contacts/contact-1',
    );
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-002']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-043']).toBe('/app/billing');
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-066']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-PAR-011']).toBeUndefined();
  });
});
