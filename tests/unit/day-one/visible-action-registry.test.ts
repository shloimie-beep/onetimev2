import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

type Registry = {
  schema_version: string;
  generated_by: string;
  source_inputs: Array<{ path: string; sha256: string }>;
  production_roles: string[];
  public_actor: string;
  readiness_states: string[];
  actions: RegistryAction[];
};

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

describe('v2.1 visible action registry', () => {
  const sourceText = readFileSync('ops/day-one/visible-action-registry.json', 'utf8');
  const registry = JSON.parse(sourceText) as Registry;

  it('is a deterministic projection of its exact locked and runtime sources', () => {
    expect(registry.schema_version).toBe('onetime.v2_1.visible_actions.v1');
    expect(registry.generated_by).toBe('I36');
    expect(registry.production_roles).toEqual(['admin', 'parent', 'student']);
    expect(registry.public_actor).toBe('public');
    expect(registry.readiness_states).toEqual(['ready']);

    expect(registry.source_inputs.map(({ path }) => path)).toEqual([
      'ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml',
      'ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md',
      'ops/v2.1-execution/source-spec/05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md',
      'ops/v2.1-execution/source-spec/08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md',
      'apps/web/src/server/app.ts',
      'apps/web/src/server/features/portals/routers.ts',
      'apps/web/src/server/features/support/router.ts',
      'apps/web/src/client/app/crm-entry.tsx',
      'apps/web/src/client/app/live-entry.tsx',
      'apps/web/src/client/app/portal-entry.tsx',
      'apps/web/src/client/public/public-entry.ts',
      'packages/domain/src/dashboard/service.ts',
    ]);
    for (const input of registry.source_inputs) {
      expect(input.sha256, input.path).toBe(sha256(readFileSync(input.path)));
    }

    const actionIds = registry.actions.map(({ action_id }) => action_id);
    expect(actionIds).toEqual([...actionIds].sort());
    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(registry.actions).toHaveLength(50);
    expect(sourceText.endsWith('\n')).toBe(true);
  });

  it('maps every production action to a ready local handler and focused evidence', () => {
    for (const action of registry.actions) {
      expect(action.label).toBeTruthy();
      expect(action.surface).toMatch(/^(route|button|form)$/);
      expect(action.route).toMatch(/^\//);
      expect(action.roles.length).toBeGreaterThan(0);
      expect(
        action.roles.every((role) => ['public', 'admin', 'parent', 'student'].includes(role)),
      ).toBe(true);
      expect(action.capability).toMatch(/:/);
      expect(action.handler.path).toBeTruthy();
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

  it('excludes every retired v2.0 surface and non-v2.1 role', () => {
    const serialized = JSON.stringify(registry.actions);
    expect(serialized).not.toMatch(
      /unavailable_by_design|tisha|class[_ -]?helper|vimeo[_ -]?autotrim|portal[_ -]?test[_ -]?lab|preview|demo|test-only|test_only/i,
    );
    expect(serialized).not.toMatch(/reward_goal/i);
    expect(registry.actions.flatMap(({ roles }) => roles)).not.toEqual(
      expect.arrayContaining(['owner', 'crm_agent', 'viewer']),
    );
  });

  it('binds representative public, Admin, Parent, and Student actions to production handlers', () => {
    const byId = new Map(registry.actions.map((action) => [action.action_id, action]));
    expect(byId.get('public.signup.submit.form')).toMatchObject({
      roles: ['public'],
      handler: { method: 'POST', path: '/api/v1/leads' },
    });
    expect(byId.get('dashboard.view.route')).toMatchObject({
      roles: ['admin'],
      handler: { method: 'GET', path: '/api/v1/dashboard/owner' },
    });
    expect(byId.get('portal.parent.student_access.reset.button')).toMatchObject({
      roles: ['parent'],
      handler: {
        method: 'POST',
        path: '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/reset',
      },
    });
    expect(byId.get('portal.student.private_question.send.button')).toMatchObject({
      roles: ['student'],
      handler: { method: 'POST', path: '/api/v1/portals/student/questions' },
    });
    expect(byId.get('support.submit.form')).toMatchObject({
      roles: ['admin', 'parent', 'student'],
      handler: { method: 'POST', path: '/api/v1/support/tickets' },
    });
  });
});
