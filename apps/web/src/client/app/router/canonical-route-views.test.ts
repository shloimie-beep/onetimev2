import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SupportTicketLinks } from '../support/SupportFeature.tsx';
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
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'ready')).toHaveLength(76);
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'isolated')).toHaveLength(
      7,
    );
    expect(CANONICAL_V21_ROUTES.filter(({ readiness }) => readiness === 'missing')).toHaveLength(
      10,
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
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-043']).toBe('/app/classes/access');
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-038']).toBe('/app/classes/attendance');
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-062']).toBe('/app/support?view=tickets');
    const supportTicket = resolveCurrentClientRoute('/app/tickets/ticket-1', 'admin');
    expect(supportTicket && compatibilityPathForRoute(supportTicket, '/app/tickets/ticket-1')).toBe(
      '/app/support?view=tickets&ticket_id=ticket-1',
    );
    const occurrence = resolveCurrentClientRoute(
      '/app/classroom/occurrences/occurrence-1',
      'admin',
    );
    expect(
      occurrence &&
        compatibilityPathForRoute(occurrence, '/app/classroom/occurrences/occurrence-1'),
    ).toBe('/app/classes/occurrences?occurrence_key=occurrence-1');
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-040']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-STU-060']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-STU-061']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-STU-040']).toBeUndefined();
    expect(resolveCurrentClientRoute('/app/student/questions', 'student')).toMatchObject({
      routeId: 'RT-STU-040',
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(resolveCurrentClientRoute('/app/student/support', 'student')).toMatchObject({
      routeId: 'RT-STU-060',
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(resolveCurrentClientRoute('/app/student/support/ticket-1', 'student')).toMatchObject({
      routeId: 'RT-STU-061',
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(resolveCurrentClientRoute('/app/classroom/questions', 'admin')).toMatchObject({
      routeId: 'RT-ADM-040',
      readiness: 'isolated',
      handler: null,
    });
    expect(resolveCurrentClientRoute('/signup/received')).toMatchObject({
      routeId: 'RT-PUB-003',
      readiness: 'isolated',
      handler: null,
    });
    expect(CANONICAL_V21_ROUTES.find((route) => route.routeId === 'RT-ADM-001')).toMatchObject({
      readiness: 'ready',
      handler: 'admin.rt-adm-001',
      handlerDisposition: 'mounted',
    });
    expect(CANONICAL_V21_ROUTES.find((route) => route.routeId === 'RT-ADM-012')).toMatchObject({
      readiness: 'ready',
      handlerDisposition: 'bounded-alias',
    });
    expect(CANONICAL_V21_ROUTES.find((route) => route.routeId === 'RT-ADM-060')).toMatchObject({
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(CANONICAL_V21_ROUTES.find((route) => route.routeId === 'RT-ADM-066')).toMatchObject({
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(CANONICAL_V21_ROUTES.find((route) => route.routeId === 'RT-STU-051')).toMatchObject({
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-STU-041']).toBe('/app/student/questions');
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-ADM-066']).toBeUndefined();
    expect(CANONICAL_ROUTE_COMPATIBILITY_PATHS['RT-PAR-011']).toBeUndefined();
  });

  it('renders recent Student support receipts on the canonical Student route only', () => {
    const markup = renderToStaticMarkup(
      createElement(SupportTicketLinks, {
        basePath: '/app/student/support',
        tickets: [
          {
            receipt_id: 'ticket/one',
            status: 'received',
            delivery_state: 'queued',
            public_summary: 'Received',
            updated_at: '2026-08-02T07:00:00.000Z',
          },
        ],
      }),
    );

    expect(markup).toContain('href="/app/student/support/ticket%2Fone"');
    expect(markup).not.toContain('/app/support');
    expect(markup).not.toContain('/app/parent/support');
  });
});
