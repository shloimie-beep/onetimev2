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

const EXPECTED_SOURCE_INPUT_PATHS = [
  'ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml',
  'ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md',
  'ops/v2.1-execution/source-spec/05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md',
  'ops/v2.1-execution/source-spec/08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md',
  'integrations/highlevel/registry/workflow-registry.yaml',
  'apps/web/src/server/app.ts',
  'apps/web/src/server/communications/register.ts',
  'apps/web/src/server/communications/workflow-readback.ts',
  'apps/web/src/server/features/admin/operations/index.ts',
  'apps/web/src/server/features/admin/operations/repository.ts',
  'apps/web/src/server/features/admin/operations/router.ts',
  'apps/web/src/server/features/admin/operations/service.ts',
  'apps/web/src/server/features/auth/v21-adult-session.ts',
  'apps/web/src/server/features/classroom/embedded/adapters.ts',
  'apps/web/src/server/features/classroom/embedded/composition.ts',
  'apps/web/src/server/features/classroom/embedded/router.ts',
  'apps/web/src/server/features/portals/routers.ts',
  'apps/web/src/server/features/support/router.ts',
  'apps/web/src/server/features/support/v21-router.ts',
  'apps/web/src/server/features/signup/school/router.ts',
  'apps/web/src/server/features/v21-canonical-routes/router.ts',
  'apps/web/src/client/app/admin-ia.ts',
  'apps/web/src/client/app/admin/learning/AdminLearningWorkspace.tsx',
  'apps/web/src/client/app/admin/search/AdminGlobalSearch.tsx',
  'apps/web/src/client/app/admin/support/AdminSupportWorkspace.tsx',
  'apps/web/src/client/app/communications/CommunicationsFeature.tsx',
  'apps/web/src/client/app/communications/WorkflowReadbackFeature.tsx',
  'apps/web/src/client/app/crm-api.ts',
  'apps/web/src/client/app/crm-entry.tsx',
  'apps/web/src/client/app/live-entry.tsx',
  'apps/web/src/client/app/portal-entry.tsx',
  'apps/web/src/client/app/student/library/StudentLibraryWorkspace.tsx',
  'apps/web/src/client/features/portals/PortalFeatures.tsx',
  'apps/web/src/client/app/router/registry.ts',
  'apps/web/src/client/app/router/canonical-route-views.ts',
  'apps/web/src/client/app/shell/AppShell.tsx',
  'apps/web/src/client/app/support/SupportFeature.tsx',
  'apps/web/src/client/public/public-entry.ts',
  'apps/web/src/client/public/school/model.ts',
  'packages/brand-system/src/styles/communications.css',
  'packages/brand-system/src/styles/react.css',
  'packages/brand-system/src/route-branding.ts',
  'packages/brand-system/src/v21.ts',
  'packages/contracts/src/communications/index.ts',
  'packages/db/src/index.ts',
  'packages/db/src/learning/repository.ts',
  'scripts/build-public-pages.ts',
  'scripts/highlevel/workflow-registry-source.ts',
  'packages/domain/src/dashboard/service.ts',
  'packages/domain/src/landing/content.ts',
  'packages/domain/src/legal/content.ts',
] as const;

const EXPECTED_ACTION_BINDINGS = [
  [
    'admin.class_series.archive.button',
    '/app/classroom/classes/:classId',
    ['admin'],
    'PATCH',
    '/api/v1/admin/classes/series/:seriesKey',
  ],
  [
    'admin.class_series.edit.form',
    '/app/classroom/classes/:classId',
    ['admin'],
    'PATCH',
    '/api/v1/admin/classes/series/:seriesKey',
  ],
  [
    'admin.class_series.view.route',
    '/app/classroom/classes/:classId',
    ['admin'],
    'GET',
    '/api/v1/admin/classes/series',
  ],
  [
    'admin.communications.workflow_readback.view.route',
    '/app/communications/:workflowId',
    ['admin'],
    'GET',
    '/api/v1/communications/workflows/:workflowId',
  ],
  [
    'admin.content.review.artifact_approve.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/artifacts/approve',
  ],
  [
    'admin.content.review.artifact_publish.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/artifacts/publish',
  ],
  [
    'admin.content.review.social_approve.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/social/approve',
  ],
  [
    'admin.content.review.social_retract.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/social/retract',
  ],
  [
    'admin.content.review.social_schedule.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/social/schedule',
  ],
  [
    'admin.content.review.transcript_approve.button',
    '/app/content/:contentId/review',
    ['admin'],
    'POST',
    '/api/v1/admin/content/sources/:sourceKey/transcript/approve',
  ],
  [
    'admin.content.review.view.route',
    '/app/content/:contentId/review',
    ['admin'],
    'GET',
    '/api/v1/admin/content/sources/:sourceKey',
  ],
  [
    'admin.directory.student.archive_restore.button',
    '/app/students/:studentId',
    ['admin'],
    'POST',
    '/api/v1/admin-directory/learners/:learnerKey/:action',
  ],
  [
    'admin.directory.student.edit.form',
    '/app/students/:studentId',
    ['admin'],
    'PATCH',
    '/api/v1/admin-directory/learners/:learnerKey',
  ],
  [
    'admin.directory.student.setup.form',
    '/app/students/:studentId',
    ['admin'],
    'POST',
    '/api/v1/admin-directory/learners/:learnerKey/student-setup',
  ],
  [
    'admin.directory.student.view.route',
    '/app/students/:studentId',
    ['admin'],
    'GET',
    '/api/v1/admin-directory/learners',
  ],
  [
    'admin.directory.user.disable_reactivate.button',
    '/app/users/:userId',
    ['admin'],
    'POST',
    '/api/v1/admin-directory/users/:userKey/:action',
  ],
  [
    'admin.directory.user.edit.form',
    '/app/users/:userId',
    ['admin'],
    'PATCH',
    '/api/v1/admin-directory/users/:userKey',
  ],
  [
    'admin.directory.user.password_reset.button',
    '/app/users/:userId',
    ['admin'],
    'POST',
    '/api/v1/admin-directory/users/:userKey/password-reset',
  ],
  [
    'admin.directory.user.view.route',
    '/app/users/:userId',
    ['admin'],
    'GET',
    '/api/v1/admin-directory/users',
  ],
  ['admin.search.next_page.button', '/app/search', ['admin'], 'POST', '/api/v2.1/admin/search'],
  [
    'admin.search.open.button',
    '/app/search',
    ['admin'],
    'CLIENT',
    'apps/web/src/client/app/shell/AppShell.tsx',
  ],
  ['admin.search.query.form', '/app/search', ['admin'], 'POST', '/api/v2.1/admin/search'],
  [
    'admin.search.recent.clear.button',
    '/app/search',
    ['admin'],
    'CLIENT',
    'apps/web/src/client/app/admin/search/AdminGlobalSearch.tsx',
  ],
  [
    'admin.search.result.open.button',
    '/app/search',
    ['admin'],
    'POST',
    '/api/v2.1/admin/operations/resolve',
  ],
  [
    'auth.household_selector.switch.button',
    '/select-household',
    ['parent'],
    'POST',
    '/api/v2.1/account-context/household',
  ],
  [
    'auth.household_selector.view.route',
    '/select-household',
    ['parent'],
    'GET',
    '/select-household',
  ],
  ['auth.parent.logout.button', '/app/parent/students', ['parent'], 'POST', '/api/v1/auth/logout'],
  [
    'auth.role_selector.switch.button',
    '/select-role',
    ['admin', 'parent'],
    'POST',
    '/api/v2.1/account-context/role',
  ],
  ['auth.role_selector.view.route', '/select-role', ['admin', 'parent'], 'GET', '/select-role'],
  ['auth.student.logout.button', '/app/student', ['student'], 'POST', '/api/v1/auth/logout'],
  [
    'classes.attendance.admin.correct.form',
    '/app/classroom/attendance',
    ['admin'],
    'POST',
    '/api/app/classroom/attendance/admin-correction',
  ],
  [
    'classes.attendance.admin.view.route',
    '/app/classroom/attendance',
    ['admin'],
    'GET',
    '/api/app/classroom/attendance/admin',
  ],
  [
    'classes.open_detail.button',
    '/app/classroom/occurrences/:occurrenceId',
    ['admin'],
    'GET',
    '/api/v1/classes/:occurrenceKey',
  ],
  ['crm.contacts.create.form', '/app/contacts', ['admin'], 'POST', '/api/v1/crm/contacts'],
  [
    'crm.contacts.open.button',
    '/app/contacts/:contactId',
    ['admin'],
    'GET',
    '/api/v1/crm/contacts/:contactId',
  ],
  ['crm.contacts.search.form', '/app/contacts', ['admin'], 'POST', '/api/v1/crm/contacts/search'],
  [
    'crm.contacts.update.form',
    '/app/contacts/:contactId',
    ['admin'],
    'PATCH',
    '/api/v1/crm/contacts/:contactId',
  ],
  ['crm.contacts.view.route', '/app/contacts', ['admin'], 'GET', '/api/v1/crm/contacts'],
  [
    'live_class.question.ready.button',
    '/app/student',
    ['student'],
    'POST',
    '/api/v1/live-class/questions/:id/ready',
  ],
  [
    'live_class.question.submit.form',
    '/app/student',
    ['student'],
    'POST',
    '/api/v1/live-class/questions',
  ],
  [
    'portal.parent.class_detail.view.route',
    '/app/parent/classes/:occurrenceId',
    ['parent'],
    'GET',
    '/api/app/parent/summary',
  ],
  [
    'portal.parent.learner.select.button',
    '/app/parent/students',
    ['parent'],
    'CLIENT',
    'apps/web/src/client/features/portals/PortalFeatures.tsx',
  ],
  [
    'portal.parent.student_access.reset.button',
    '/app/parent/students',
    ['parent'],
    'POST',
    '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/reset',
  ],
  [
    'portal.parent.student_access.setup.form',
    '/app/parent/students',
    ['parent'],
    'POST',
    '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/setup',
  ],
  [
    'portal.parent.student_access.suspend.button',
    '/app/parent/students',
    ['parent'],
    'POST',
    '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/suspend',
  ],
  [
    'portal.student.class_detail.join.button',
    '/app/student/classes/:occurrenceId',
    ['student'],
    'POST',
    '/api/v1/portals/student/classes/:classKey/launch',
  ],
  [
    'portal.student.class_detail.view.route',
    '/app/student/classes/:occurrenceId',
    ['student'],
    'GET',
    '/api/v1/portals/student/dashboard',
  ],
  [
    'portal.student.classroom.question.form',
    '/app/student',
    ['student'],
    'POST',
    '/api/v1/classroom/questions',
  ],
  [
    'portal.student.library_detail.open.button',
    '/app/student/library/:contentId',
    ['student'],
    'POST',
    '/api/app/student/library/:contentId/bootstrap',
  ],
  [
    'portal.student.library_detail.renew.button',
    '/app/student/library/:contentId',
    ['student'],
    'POST',
    '/api/app/student/library/:contentId/renew',
  ],
  [
    'portal.student.library_detail.resume.form',
    '/app/student/library/:contentId',
    ['student'],
    'POST',
    '/api/app/student/library/:contentId/resume',
  ],
  [
    'portal.student.library_detail.view.route',
    '/app/student/library/:contentId',
    ['student'],
    'POST',
    '/api/app/student/library/search',
  ],
  [
    'portal.student.private_question.send.button',
    '/app/student',
    ['student'],
    'POST',
    '/api/v1/portals/student/questions',
  ],
  [
    'portal.student.view.route',
    '/app/student',
    ['student'],
    'GET',
    '/api/v1/portals/student/dashboard',
  ],
  [
    'public.cancellation_refund.view.route',
    '/cancellation-refund',
    ['public'],
    'GET',
    '/cancellation-refund',
  ],
  [
    'public.gallery.next.button',
    '/',
    ['public'],
    'CLIENT',
    'apps/web/src/client/public/public-entry.ts',
  ],
  [
    'public.gallery.previous.button',
    '/',
    ['public'],
    'CLIENT',
    'apps/web/src/client/public/public-entry.ts',
  ],
  [
    'public.gallery.select.button',
    '/',
    ['public'],
    'CLIENT',
    'apps/web/src/client/public/public-entry.ts',
  ],
  [
    'public.gallery.slideshow.toggle.button',
    '/',
    ['public'],
    'CLIENT',
    'apps/web/src/client/public/public-entry.ts',
  ],
  ['public.home.route', '/', ['public'], 'GET', '/'],
  ['public.login.route', '/login', ['public'], 'GET', '/login'],
  [
    'public.school-inquiry.submit.form',
    '/school',
    ['public'],
    'POST',
    '/api/v2.1/signup/school-inquiry',
  ],
  ['public.signup.route', '/signup', ['public'], 'GET', '/signup'],
  ['public.signup.submit.form', '/signup', ['public'], 'POST', '/api/v1/signup/family'],
  [
    'support.admin.assign.form',
    '/app/support',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/assign',
  ],
  [
    'support.admin.queue.view.route',
    '/app/support',
    ['admin'],
    'GET',
    '/api/v1/admin/support/v21/tickets',
  ],
  [
    'support.admin.reply.form',
    '/app/support',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/reply',
  ],
  [
    'support.admin.status.form',
    '/app/support',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/status',
  ],
  [
    'support.admin.ticket.assign.form',
    '/app/tickets/:ticketId',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/assign',
  ],
  [
    'support.admin.ticket.detail.view.route',
    '/app/tickets/:ticketId',
    ['admin'],
    'GET',
    '/api/v1/admin/support/v21/tickets/:ticketId',
  ],
  [
    'support.admin.ticket.open.button',
    '/app/tickets',
    ['admin'],
    'CLIENT',
    'apps/web/src/client/app/admin/support/AdminSupportWorkspace.tsx',
  ],
  [
    'support.admin.ticket.reply.form',
    '/app/tickets/:ticketId',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/reply',
  ],
  [
    'support.admin.ticket.status.form',
    '/app/tickets/:ticketId',
    ['admin'],
    'POST',
    '/api/v1/admin/support/v21/tickets/:ticketId/status',
  ],
  [
    'support.admin.ticket_queue.back.button',
    '/app/tickets/:ticketId',
    ['admin'],
    'CLIENT',
    'apps/web/src/client/app/admin/support/AdminSupportWorkspace.tsx',
  ],
  [
    'support.admin.ticket_queue.view.route',
    '/app/tickets',
    ['admin'],
    'GET',
    '/api/v1/admin/support/v21/tickets',
  ],
  ['support.admin.view.route', '/app/support', ['admin'], 'GET', '/app/support'],
  [
    'support.parent.receipt.view.route',
    '/app/parent/support/:ticketId',
    ['parent'],
    'GET',
    '/api/v1/support/v21/tickets/:ticketId',
  ],
  [
    'support.parent.submit.form',
    '/app/parent/support',
    ['parent'],
    'POST',
    '/api/v1/support/v21/tickets',
  ],
  ['support.parent.view.route', '/app/parent/support', ['parent'], 'GET', '/app/parent/support'],
  [
    'support.student.receipt.view.route',
    '/app/student/support/:ticketId',
    ['student'],
    'GET',
    '/api/v1/support/v21/tickets/:ticketId',
  ],
  [
    'support.student.submit.form',
    '/app/student/support',
    ['student'],
    'POST',
    '/api/v1/support/v21/tickets',
  ],
  [
    'support.student.view.route',
    '/app/student/support',
    ['student'],
    'GET',
    '/app/student/support',
  ],
] as const;

describe('v2.1 visible action registry', () => {
  const sourceText = readFileSync('ops/day-one/visible-action-registry.json', 'utf8');
  const registry = JSON.parse(sourceText) as Registry;

  it('is an exact deterministic projection of locked routes and raw source bytes', () => {
    expect(registry.schema_version).toBe('onetime.v2_1.visible_actions.v2');
    expect(registry.generated_by).toBe('I36');
    expect(registry.production_roles).toEqual(['admin', 'parent', 'student']);
    expect(registry.public_actor).toBe('public');
    expect(registry.readiness_states).toEqual(['ready', 'isolated', 'missing']);
    expect(registry.source_inputs.map(({ path }) => path)).toEqual(EXPECTED_SOURCE_INPUT_PATHS);
    expect(new Set(registry.source_inputs.map(({ path }) => path)).size).toBe(
      EXPECTED_SOURCE_INPUT_PATHS.length,
    );
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
    ).toHaveLength(88);
    expect(
      registry.canonical_routes.filter(({ readiness_state }) => readiness_state === 'isolated'),
    ).toHaveLength(5);
    expect(
      registry.canonical_routes.filter(({ readiness_state }) => readiness_state === 'missing'),
    ).toHaveLength(0);
    expect(sourceText.endsWith('\n')).toBe(true);
  });

  it('advertises actions only on canonical routes with ready local behavior', () => {
    const readyRoutes = registry.canonical_routes.filter(
      ({ readiness_state }) => readiness_state === 'ready',
    );
    const actionIds = registry.actions.map(({ action_id }) => action_id);
    const sourcePaths = new Set(registry.source_inputs.map(({ path }) => path));
    expect(actionIds).toEqual([...actionIds].sort());
    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(
      registry.actions.map((action) => [
        action.action_id,
        action.route,
        action.roles,
        action.handler.method,
        action.handler.path,
      ]),
    ).toEqual(EXPECTED_ACTION_BINDINGS);
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
      if (action.handler.method === 'CLIENT') {
        expect(sourcePaths.has(action.handler.path), action.action_id).toBe(true);
      }
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

  it('binds central Family and School signup to their exact production handlers', () => {
    const byId = new Map(registry.actions.map((action) => [action.action_id, action]));
    const publicEntry = execFileSync(
      'git',
      ['show', ':apps/web/src/client/public/public-entry.ts'],
      { encoding: 'utf8' },
    );
    const publicPageBuilder = execFileSync('git', ['show', ':scripts/build-public-pages.ts'], {
      encoding: 'utf8',
    });
    const supportFeature = execFileSync(
      'git',
      ['show', ':apps/web/src/client/app/support/SupportFeature.tsx'],
      { encoding: 'utf8' },
    );
    expect(byId.get('public.signup.submit.form')).toMatchObject({
      roles: ['public'],
      handler: { method: 'POST', path: '/api/v1/signup/family' },
    });
    expect(byId.get('portal.parent.student_access.reset.button')).toMatchObject({
      route: '/app/parent/students',
      roles: ['parent'],
    });
    expect(byId.get('public.school-inquiry.submit.form')).toMatchObject({
      route: '/school',
      roles: ['public'],
      handler: { method: 'POST', path: '/api/v2.1/signup/school-inquiry' },
      external_mutation: false,
    });
    expect(byId.get('public.gallery.select.button')).toMatchObject({
      route: '/',
      roles: ['public'],
      handler: { method: 'CLIENT', path: 'apps/web/src/client/public/public-entry.ts' },
      test_evidence: [
        'tests/e2e/landing-signup.spec.ts',
        'tests/unit/day-one/visible-action-registry.test.ts',
      ],
    });
    expect(byId.get('public.gallery.slideshow.toggle.button')).toMatchObject({
      route: '/',
      roles: ['public'],
      handler: { method: 'CLIENT', path: 'apps/web/src/client/public/public-entry.ts' },
      test_evidence: [
        'tests/e2e/landing-signup.spec.ts',
        'tests/unit/day-one/visible-action-registry.test.ts',
      ],
    });
    expect(publicPageBuilder).toContain('data-gallery-dot');
    expect(publicPageBuilder).toContain('data-gallery-toggle');
    expect(publicEntry).toContain("querySelectorAll<HTMLButtonElement>('[data-gallery-dot]')");
    expect(publicEntry).toContain("querySelector<HTMLButtonElement>('[data-gallery-toggle]')");
    expect(publicEntry).toContain(
      "button.addEventListener('click', () => showFromControl(buttonIndex))",
    );
    expect(publicEntry).toContain("toggle.addEventListener('click', () =>");
    expect(byId.get('support.student.submit.form')).toMatchObject({
      route: '/app/student/support',
      roles: ['student'],
      handler: { method: 'POST', path: '/api/v1/support/v21/tickets' },
      test_evidence: [
        'tests/integration/support/v21-support-lifecycle.test.ts',
        'tests/e2e/support.spec.ts',
      ],
    });
    expect(byId.get('support.student.receipt.view.route')).toMatchObject({
      route: '/app/student/support/:ticketId',
      roles: ['student'],
      handler: { method: 'GET', path: '/api/v1/support/v21/tickets/:ticketId' },
      test_evidence: [
        'tests/integration/support/v21-support-lifecycle.test.ts',
        'tests/e2e/support.spec.ts',
      ],
    });
    expect(byId.get('support.student.view.route')).toMatchObject({
      route: '/app/student/support',
      roles: ['student'],
      handler: { method: 'GET', path: '/app/student/support' },
      test_evidence: [
        'tests/integration/support/v21-support-lifecycle.test.ts',
        'tests/e2e/support.spec.ts',
      ],
    });
    expect(supportFeature).toContain(
      'href={`${basePath}/${encodeURIComponent(ticket.receipt_id)}`}',
    );
    expect(supportFeature).not.toContain('/app/support/receipts/');
    expect(supportFeature).toContain("basePath?: '/app/student/support' | '/app/parent/support'");
    expect(byId.get('support.parent.submit.form')).toMatchObject({
      route: '/app/parent/support',
      roles: ['parent'],
      handler: { method: 'POST', path: '/api/v1/support/v21/tickets' },
      external_mutation: false,
    });
    expect(byId.get('support.parent.receipt.view.route')).toMatchObject({
      route: '/app/parent/support/:ticketId',
      roles: ['parent'],
      handler: { method: 'GET', path: '/api/v1/support/v21/tickets/:ticketId' },
    });
    expect(byId.get('support.admin.assign.form')).toMatchObject({
      route: '/app/support',
      roles: ['admin'],
      handler: {
        method: 'POST',
        path: '/api/v1/admin/support/v21/tickets/:ticketId/assign',
      },
    });
    expect(byId.get('support.admin.queue.view.route')).toMatchObject({
      route: '/app/support',
      roles: ['admin'],
      handler: { method: 'GET', path: '/api/v1/admin/support/v21/tickets' },
    });
    expect(byId.get('support.admin.reply.form')).toMatchObject({
      route: '/app/support',
      roles: ['admin'],
      handler: {
        method: 'POST',
        path: '/api/v1/admin/support/v21/tickets/:ticketId/reply',
      },
    });
    expect(byId.get('support.admin.status.form')).toMatchObject({
      route: '/app/support',
      roles: ['admin'],
      handler: {
        method: 'POST',
        path: '/api/v1/admin/support/v21/tickets/:ticketId/status',
      },
    });
    expect(byId.get('support.admin.view.route')).toMatchObject({
      route: '/app/support',
      roles: ['admin'],
      handler: { method: 'GET', path: '/app/support' },
    });
    expect(byId.get('support.parent.view.route')).toMatchObject({
      route: '/app/parent/support',
      roles: ['parent'],
      handler: { method: 'GET', path: '/app/parent/support' },
    });
  });
});
