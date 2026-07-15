import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ownerAdminVisibleActions } from '../../../packages/domain/src/dashboard/service.ts';

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

describe('OT81 visible action registry', () => {
  const registry = JSON.parse(readFileSync('ops/day-one/visible-action-registry.json', 'utf8')) as {
    actions: RegistryAction[];
  };

  it('maps every visible action to handler, authorization, audit, state, and tests', () => {
    expect(registry.actions.length).toBeGreaterThanOrEqual(30);
    const ids = registry.actions.map((action) => action.action_id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const action of registry.actions) {
      expect(action.label).toBeTruthy();
      expect(action.surface).toMatch(/^(route|button|form)$/);
      expect(action.route).toMatch(/^\//);
      expect(action.roles.length).toBeGreaterThan(0);
      expect(action.capability).toMatch(/:/);
      expect(action.handler.path).toBeTruthy();
      expect(action.audit.event).toBeTruthy();
      expect(action.readiness_state).toMatch(/^(ready|unavailable_by_design)$/);
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

  it('contains the runtime owner/admin dashboard registry exactly once', () => {
    const registryIds = new Set(registry.actions.map((action) => action.action_id));
    for (const action of ownerAdminVisibleActions()) {
      expect(registryIds.has(action.action_id), action.action_id).toBe(true);
    }
  });

  it('marks default-off provider actions as visible unavailable states', () => {
    const unavailable = registry.actions.filter(
      (action) => action.readiness_state === 'unavailable_by_design',
    );
    expect(unavailable.map((action) => action.action_id)).toEqual(
      expect.arrayContaining([
        'portal.parent.class.launch.button',
        'portal.student.class.launch.button',
        'portal.parent.support.preview.button',
        'portal.student.support.preview.button',
      ]),
    );
    expect(unavailable.every((action) => action.external_mutation === false)).toBe(true);
  });
});
