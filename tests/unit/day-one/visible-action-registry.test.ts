import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CANONICAL_V21_ROUTES } from '../../../apps/web/src/client/app/router/registry.ts';

type RegistryAction = {
  action_id: string;
  label: string;
  surface: string;
  route: string;
  roles: string[];
  capability: string;
  handler: { method: string; path: string };
  audit: { mode: string; event: string };
  states: Record<string, string>;
  readiness_state: string;
  external_mutation: boolean;
  test_evidence: string[];
};

type RegistryRoute = {
  route_id: string;
  path: string;
  roles: string[];
  handler: string | null;
  readiness_state: 'ready' | 'isolated' | 'missing';
  handler_disposition: 'mounted' | 'bounded-alias' | 'isolated' | 'missing';
};

type Registry = {
  schema_version: string;
  generated_by: string;
  source_inputs: Array<{ path: string; sha256: string }>;
  production_roles: string[];
  public_actor: string;
  readiness_states: string[];
  canonical_routes: RegistryRoute[];
  actions: RegistryAction[];
};

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

describe('v2.1 visible action registry', () => {
  const sourceText = readFileSync('ops/day-one/visible-action-registry.json', 'utf8');
  const registry = JSON.parse(sourceText) as Registry;

  it('is an exact deterministic projection of locked routes and raw source bytes', () => {
    expect(registry.schema_version).toBe('onetime.v2_1.visible_actions.v2');
    expect(registry.generated_by).toBe('I36');
    expect(registry.production_roles).toEqual(['admin', 'parent', 'student']);
    expect(registry.public_actor).toBe('public');
    expect(registry.readiness_states).toEqual(['ready', 'isolated', 'missing']);
    for (const input of registry.source_inputs) {
      expect(input.sha256, input.path).toBe(
        sha256(execFileSync('git', ['show', `:${input.path}`])),
      );
    }
    expect(registry.canonical_routes).toEqual(
      CANONICAL_V21_ROUTES.map((route) => ({
        route_id: route.routeId,
        path: route.pathname,
        roles: [...route.roles],
        handler: route.handler,
        readiness_state: route.readiness,
        handler_disposition: route.handlerDisposition,
      })),
    );
    expect(registry.canonical_routes).toHaveLength(93);
    expect(
      registry.canonical_routes.filter(({ readiness_state }) => readiness_state === 'ready'),
    ).toHaveLength(46);
    expect(
      registry.canonical_routes.filter(({ readiness_state }) => readiness_state === 'isolated'),
    ).toHaveLength(17);
    expect(
      registry.canonical_routes.filter(({ readiness_state }) => readiness_state === 'missing'),
    ).toHaveLength(30);
    expect(sourceText.endsWith('\n')).toBe(true);
  });

  it('advertises actions only on canonical routes with ready local behavior', () => {
    const readyRoutes = registry.canonical_routes.filter(
      ({ readiness_state }) => readiness_state === 'ready',
    );
    const actionIds = registry.actions.map(({ action_id }) => action_id);
    expect(actionIds).toEqual([...actionIds].sort());
    expect(new Set(actionIds).size).toBe(actionIds.length);
    for (const action of registry.actions) {
      const route = readyRoutes.find(({ path }) => path === action.route);
      expect(route, action.action_id).toBeDefined();
      expect(
        action.roles.every((role) => route?.roles.includes(role)),
        action.action_id,
      ).toBe(true);
      expect(action.surface).toMatch(/^(route|button|form)$/u);
      expect(action.capability).toMatch(/:/u);
      expect(action.handler.path).toMatch(/^(?:\/|(?:apps|packages|scripts)\/)/u);
      expect(action.audit.event).toBeTruthy();
      expect(action.readiness_state).toBe('ready');
      expect(action.external_mutation).toBe(false);
      expect(action.test_evidence.length).toBeGreaterThan(0);
      expect(Object.keys(action.states).sort()).toEqual([
        'error',
        'loading',
        'offline',
        'permission',
        'success',
      ]);
    }
  });

  it('keeps non-ready routes handler-free and excludes retired surfaces and roles', () => {
    for (const route of registry.canonical_routes) {
      if (route.readiness_state === 'ready') expect(route.handler, route.route_id).toBeTruthy();
      else expect(route.handler, route.route_id).toBeNull();
    }
    const serialized = JSON.stringify(registry.actions);
    expect(serialized).not.toMatch(
      /unavailable_by_design|tisha|class[_ -]?helper|reward|preview|demo|test-only|test_only/iu,
    );
    expect(registry.actions.flatMap(({ roles }) => roles)).not.toEqual(
      expect.arrayContaining(['owner', 'crm_agent', 'viewer']),
    );
  });

  it('binds central Family signup and role-scoped support to production handlers', () => {
    const byId = new Map(registry.actions.map((action) => [action.action_id, action]));
    expect(byId.get('public.signup.submit.form')).toMatchObject({
      roles: ['public'],
      handler: { method: 'POST', path: '/api/v1/signup/family' },
    });
    expect(byId.get('dashboard.view.route')).toMatchObject({
      roles: ['admin'],
      handler: { method: 'GET', path: '/api/v1/dashboard/owner' },
    });
    expect(byId.get('portal.parent.student_access.reset.button')).toMatchObject({
      route: '/app/parent/students',
      roles: ['parent'],
    });
    expect(byId.get('support.student.submit.form')).toMatchObject({
      route: '/app/student/support',
      roles: ['student'],
      handler: { method: 'POST', path: '/api/v1/support/tickets' },
    });
  });
});
