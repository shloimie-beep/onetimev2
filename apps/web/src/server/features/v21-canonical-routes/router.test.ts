import { describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_PROTECTED_ROUTES,
  CANONICAL_READY_PROTECTED_ROUTES,
  installCanonicalProtectedRoutes,
} from './router.ts';

describe('v2.1 canonical route server registration', () => {
  it('mounts every protected route explicitly and fails non-ready routes closed', () => {
    const registrations: Array<{ path: string; handler: unknown; kind: string }> = [];
    const get = vi.fn((path: string, handler: unknown) => {
      registrations.push({ path, handler, kind: '' });
    });
    installCanonicalProtectedRoutes({
      app: { get } as never,
      handlerFor: (route) =>
        ((_req: unknown, _res: unknown, next: (value: string) => void) =>
          next(route.routeId)) as never,
      unavailableHandlerFor: (route) =>
        ((_req: unknown, _res: unknown, next: (value: string) => void) =>
          next(`unavailable:${route.routeId}`)) as never,
    });

    expect(CANONICAL_PROTECTED_ROUTES).toHaveLength(75);
    expect(registrations.map(({ path }) => path)).toEqual(
      CANONICAL_PROTECTED_ROUTES.map(({ pathname }) => pathname),
    );
    expect(registrations.every(({ path }) => !path.includes('*'))).toBe(true);
    expect(new Set(registrations.map(({ path }) => path)).size).toBe(75);
    expect(CANONICAL_READY_PROTECTED_ROUTES).toHaveLength(26);
    expect(
      CANONICAL_PROTECTED_ROUTES.filter(({ readiness }) => readiness !== 'ready'),
    ).toHaveLength(49);
  });

  it('binds exact shell and role semantics', () => {
    expect(
      CANONICAL_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-ADM-002'),
    ).toMatchObject({ pathname: '/app/search', shell: 'admin', roles: ['admin'] });
    expect(
      CANONICAL_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-PAR-030'),
    ).toMatchObject({ pathname: '/app/parent/billing', shell: 'parent', roles: ['parent'] });
    expect(
      CANONICAL_READY_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-PAR-001'),
    ).toMatchObject({
      pathname: '/app/parent',
      shell: 'parent',
      roles: ['parent'],
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(
      CANONICAL_READY_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-ADM-001'),
    ).toMatchObject({
      pathname: '/app/dashboard',
      shell: 'admin',
      roles: ['admin'],
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(
      CANONICAL_READY_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-PAR-070'),
    ).toMatchObject({
      pathname: '/app/parent/account',
      shell: 'parent',
      roles: ['parent'],
      readiness: 'ready',
      handlerDisposition: 'mounted',
    });
    expect(
      CANONICAL_PROTECTED_ROUTES.find(({ routeId }) => routeId === 'RT-STU-012'),
    ).toMatchObject({
      pathname: '/app/student/class/:occurrenceId',
      shell: 'student',
      roles: ['student'],
    });
  });
});
