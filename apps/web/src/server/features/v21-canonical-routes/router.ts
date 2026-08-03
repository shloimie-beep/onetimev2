import type { Express, RequestHandler } from 'express';
import {
  CANONICAL_V21_ROUTES,
  type ClientRouteDefinition,
} from '../../../client/app/router/registry.js';

export type CanonicalProtectedRoute = ClientRouteDefinition & {
  shell: 'admin' | 'parent' | 'student' | 'live';
};

export type CanonicalReadyProtectedRoute = CanonicalProtectedRoute & {
  readiness: 'ready';
  handler: string;
};

export const CANONICAL_PROTECTED_ROUTES = CANONICAL_V21_ROUTES.filter(
  (route): route is CanonicalProtectedRoute =>
    route.shell === 'admin' ||
    route.shell === 'parent' ||
    route.shell === 'student' ||
    route.shell === 'live',
);

export const CANONICAL_READY_PROTECTED_ROUTES = CANONICAL_PROTECTED_ROUTES.filter(
  (route): route is CanonicalReadyProtectedRoute =>
    route.readiness === 'ready' && route.handler !== null,
);

export function installCanonicalProtectedRoutes(input: {
  app: Pick<Express, 'get'>;
  handlerFor: (route: CanonicalReadyProtectedRoute) => RequestHandler;
  unavailableHandlerFor: (route: CanonicalProtectedRoute) => RequestHandler;
}) {
  for (const route of CANONICAL_PROTECTED_ROUTES) {
    input.app.get(
      route.pathname,
      route.readiness === 'ready' && route.handler !== null
        ? input.handlerFor(route as CanonicalReadyProtectedRoute)
        : input.unavailableHandlerFor(route),
    );
  }
}
