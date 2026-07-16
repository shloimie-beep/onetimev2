import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type RegistryEntry = {
  action_id?: string;
  route_id?: string;
  label?: string;
  route: string;
  roles: string[];
  capability: string;
  handler: string | { method: string; path: string };
  confirmation?: { required: boolean; reason: string };
  audit?: { mode: string; event: string };
  idempotency?: { required: boolean; key_source: string | null };
  readiness_state: string;
  external_mutation?: boolean;
  positive_tests: string[];
  negative_tests: string[];
};

describe('OT-83R portal route/action registry', () => {
  const registry = JSON.parse(
    readFileSync('ops/codex-runs/OT-83R/ROUTE-ACTION-REGISTRY.json', 'utf8'),
  ) as {
    schema_version: string;
    external_mutations_performed: boolean;
    routes: RegistryEntry[];
    actions: RegistryEntry[];
  };

  it('records routes and visible actions with handlers, readiness, and tests', () => {
    expect(registry.schema_version).toBe('onetime.ot83r.portal_route_action_registry.v1');
    expect(registry.external_mutations_performed).toBe(false);

    const entries = [...registry.routes, ...registry.actions];
    const ids = entries.map((entry) => entry.route_id ?? entry.action_id ?? '');
    expect(new Set(ids).size).toBe(ids.length);

    for (const entry of entries) {
      expect(entry.route).toMatch(/^\//);
      expect(entry.roles.length).toBeGreaterThan(0);
      expect(entry.capability).toMatch(/:/);
      expect(entry.handler).toBeTruthy();
      expect(entry.readiness_state).toMatch(/^(ready|default_off_adapter_ready)$/);
      expect(entry.positive_tests.length).toBeGreaterThan(0);
      expect(entry.negative_tests.length).toBeGreaterThan(0);
      expect(JSON.stringify(entry)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);
    }

    for (const action of registry.actions) {
      expect(action.label).toBeTruthy();
      expect(action.confirmation?.reason).toBeTruthy();
      expect(action.audit?.event).toBeTruthy();
      expect(action.idempotency).toBeTruthy();
      expect(action.external_mutation).toBe(false);
    }
  });

  it('covers the OT-83R parent and student portal controls', () => {
    const actionIds = new Set(registry.actions.map((action) => action.action_id));
    expect([...actionIds]).toEqual(
      expect.arrayContaining([
        'account.parent_activation.accept',
        'account.student_setup.accept',
        'portal.parent.learner.create',
        'portal.parent.learner.update',
        'portal.parent.learner.archive_restore',
        'portal.parent.student_access.manage',
        'portal.parent.class.launch',
        'portal.parent.content.open',
        'portal.parent.support.preview',
        'portal.student.class.launch',
        'portal.student.content.open',
        'portal.student.question.submit',
        'portal.student.support.preview',
      ]),
    );
  });
});
