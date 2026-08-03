import React from 'react';
import {
  CANONICAL_V21_ROUTES,
  resolveCurrentClientRoute,
  type CanonicalRouteId,
  type ClientRouteDefinition,
  type CurrentClientRole,
} from './registry.js';

export type CanonicalRouteViewBinding = {
  routeId: CanonicalRouteId;
  title: string;
  handler: string;
  summary: string;
};

const summaryFor = (route: ClientRouteDefinition): string => {
  if (route.routeId.startsWith('RT-ADM-')) {
    return `${route.title} is scoped to the signed-in Admin account and the current One Time product.`;
  }
  if (route.routeId.startsWith('RT-PAR-')) {
    return `${route.title} is limited to the selected household and Parent-safe information.`;
  }
  if (route.routeId.startsWith('RT-STU-')) {
    return `${route.title} is limited to the signed-in Student profile.`;
  }
  if (route.routeId.startsWith('RT-AUTH-')) {
    return `${route.title} preserves same-origin, safe-return, and non-disclosure protections.`;
  }
  return `${route.title} is a public One Time route.`;
};

export const CANONICAL_ROUTE_VIEW_BINDINGS = Object.freeze(
  Object.fromEntries(
    CANONICAL_V21_ROUTES.filter(
      (route): route is ClientRouteDefinition & { readiness: 'ready'; handler: string } =>
        route.readiness === 'ready' && route.handler !== null,
    ).map((route) => [
      route.routeId,
      Object.freeze({
        routeId: route.routeId,
        title: route.title,
        handler: route.handler,
        summary: summaryFor(route),
      }),
    ]),
  ) as Partial<Record<CanonicalRouteId, CanonicalRouteViewBinding>>,
);

export function resolveCanonicalRouteView(
  pathname: string,
  role?: CurrentClientRole,
): CanonicalRouteViewBinding {
  const route = resolveCurrentClientRoute(pathname, role);
  if (!route) throw new Error(`No canonical route-specific view is registered for "${pathname}".`);
  const view = CANONICAL_ROUTE_VIEW_BINDINGS[route.routeId];
  if (!view) {
    throw new Error(
      `Canonical route "${route.routeId}" is ${route.readiness}; no ready view may be rendered.`,
    );
  }
  return view;
}

export function CanonicalRouteView({
  pathname,
  role,
  children,
}: {
  pathname: string;
  role?: CurrentClientRole;
  children?: React.ReactNode;
}) {
  const view = resolveCanonicalRouteView(pathname, role);
  const headingId = `canonical-route-${view.routeId}`;
  return React.createElement(
    'section',
    {
      'aria-labelledby': headingId,
      'data-canonical-route-id': view.routeId,
      'data-canonical-handler': view.handler,
    },
    React.createElement('h1', { id: headingId }, view.title),
    React.createElement('p', null, view.summary),
    children,
  );
}

/** Explicit aliases to an already-composed view with the same intended behavior. */
export const CANONICAL_ROUTE_COMPATIBILITY_PATHS: Readonly<
  Partial<Record<CanonicalRouteId, `/${string}`>>
> = Object.freeze({
  'RT-ADM-010': '/app/crm',
  'RT-ADM-011': '/app/crm/contacts/:contactId',
  'RT-ADM-013': '/app/crm/contact-operations?household=:householdId',
  'RT-ADM-034': '/app/classes/occurrences',
  'RT-ADM-035': '/app/classes/occurrences?occurrence_key=:occurrenceId',
  'RT-ADM-037': '/app/classes/occurrences',
  'RT-ADM-039': '/app/classes/recordings',
  'RT-ADM-067': '/app/crm/audit',
  'RT-STU-020': '/app/student?section=library',
});

export function compatibilityPathForRoute(
  route: ClientRouteDefinition,
  pathname: string,
): string | null {
  const template = CANONICAL_ROUTE_COMPATIBILITY_PATHS[route.routeId];
  if (!template) return null;
  const sourceSegments = route.pathname.split('/');
  const actualSegments = pathname.split('/');
  return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/gu, (_match, name: string) => {
    const index = sourceSegments.indexOf(`:${name}`);
    return index < 0 ? '' : (actualSegments[index] ?? '');
  });
}
