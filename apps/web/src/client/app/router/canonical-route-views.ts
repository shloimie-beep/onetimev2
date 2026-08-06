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
  'RT-ADM-012': '/app/crm/households',
  'RT-ADM-013': '/app/crm/contact-operations?household=:householdId',
  'RT-ADM-014': '/app/crm/users',
  'RT-ADM-015': '/app/crm/users?user_key=:userId',
  'RT-ADM-016': '/app/crm/learners',
  'RT-ADM-017': '/app/crm/learners?learner_key=:studentId',
  'RT-ADM-024': '/app/content',
  'RT-ADM-030': '/app/classes',
  'RT-ADM-031': '/app/classes/occurrences',
  'RT-ADM-032': '/app/classes',
  'RT-ADM-033': '/app/classes?class_series_key=:classId',
  'RT-ADM-034': '/app/classes/occurrences',
  'RT-ADM-035': '/app/classes/occurrences?occurrence_key=:occurrenceId',
  'RT-ADM-036': '/app/classes/enrollments',
  'RT-ADM-037': '/app/classes/occurrences',
  'RT-ADM-038': '/app/classes/attendance',
  'RT-ADM-039': '/app/classes/recordings',
  'RT-ADM-040': '/app/classes/questions',
  'RT-ADM-041': '/app/rewards',
  'RT-ADM-042': '/app/rewards',
  'RT-ADM-043': '/app/classes/access',
  'RT-ADM-050': '/app/live-console',
  'RT-ADM-051': '/app/live-console?occurrence_key=:occurrenceId',
  'RT-ADM-062': '/app/support?view=tickets',
  'RT-ADM-063': '/app/support?view=tickets&ticket_id=:ticketId',
  'RT-ADM-064': '/app/billing',
  'RT-ADM-065': '/app/operations',
  'RT-ADM-067': '/app/crm/audit',
  'RT-ADM-069': '/app/operations',
  'RT-STU-020': '/app/student?section=library',
  'RT-STU-041': '/app/student/questions',
  'RT-STU-042': '/app/student/questions',
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
