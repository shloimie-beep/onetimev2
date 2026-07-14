import express, { type Request } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PortalActorContext } from '../../packages/contracts/src/portals/index.ts';
import { PortalServiceError } from '../../packages/domain/src/portals/services.ts';
import {
  createParentPortalRouter,
  createStudentPortalRouter,
} from '../../apps/web/src/server/features/portals/routers.ts';

let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let createLearnerCalls: number;
let lastStudentLaunchActor: PortalActorContext | null;

const parentActor = actor('parent');
const studentActor: PortalActorContext = {
  ...actor('student'),
  capabilities: ['student:dashboard:read', 'student:class:launch', 'student:support:preview'],
  student_learner: {
    learner_key: 'learner_student_self',
    household_key: 'household_alpha',
    access_state_key: 'student_access_self',
  },
};

beforeEach(async () => {
  createLearnerCalls = 0;
  lastStudentLaunchActor = null;
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use((req, _res, next) => {
    (req as Request & { traceId?: string }).traceId = 'trace_ot52_router';
    next();
  });
  app.use(
    '/api/v1/portals/parent',
    createParentPortalRouter({
      resolveActor,
      verifyCsrf,
      service: parentService(),
    }),
  );
  app.use(
    '/api/v1/portals/student',
    createStudentPortalRouter({
      resolveActor,
      verifyCsrf,
      service: studentService(),
    }),
  );
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('missing test address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('OT-52P portal routers', () => {
  it('denies anonymous requests and applies no-store headers', async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/dashboard`,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'UNAUTHENTICATED',
    });
  });

  it('maps wrong role or product sessions to privacy-safe forbidden responses', async () => {
    const owner = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/dashboard`,
      { headers: { 'x-actor': 'owner' } },
    );
    expect(owner.status).toBe(403);
    expect(await owner.json()).toMatchObject({ success: false, code: 'FORBIDDEN' });

    const wrongProduct = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/dashboard`,
      { headers: { 'x-actor': 'wrong-product' } },
    );
    expect(wrongProduct.status).toBe(403);
    expect(await wrongProduct.json()).toMatchObject({ success: false, code: 'FORBIDDEN' });
  });

  it('requires CSRF before authenticated writes reach the service', async () => {
    const blocked = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/learners`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-actor': 'parent' },
        body: JSON.stringify({
          idempotency_key: 'router-create-blocked',
          display_name: 'Blocked Learner',
        }),
      },
    );
    expect(blocked.status).toBe(403);
    expect(createLearnerCalls).toBe(0);

    const created = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/learners`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-actor': 'parent',
          'x-csrf-token': 'valid-csrf',
        },
        body: JSON.stringify({
          idempotency_key: 'router-create-allowed',
          display_name: 'Allowed Learner',
        }),
      },
    );
    expect(created.status).toBe(201);
    expect(createLearnerCalls).toBe(1);
    expect(await created.json()).toMatchObject({
      success: true,
      data: { learner_key: 'learner_router_created' },
    });
  });

  it('keeps student launch scoped to the actor subject and omits raw provider URLs', async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/portals/student/classes/class_week_001/launch`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-actor': 'student',
          'x-csrf-token': 'valid-csrf',
        },
        body: JSON.stringify({ learner_key: 'learner_sibling_attempt' }),
      },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(lastStudentLaunchActor?.student_learner?.learner_key).toBe('learner_student_self');
    expect(JSON.stringify(json)).not.toContain('learner_sibling_attempt');
    expect(JSON.stringify(json)).not.toMatch(/https?:\/\/|zoom|meet/i);
    expect(json).toMatchObject({
      success: true,
      data: {
        kind: 'class_launch',
        href: '/api/v1/portals/actions/class-launch',
      },
    });
  });
});

async function resolveActor(req: Request): Promise<PortalActorContext | null> {
  const requested = req.header('x-actor');
  if (!requested) return null;
  if (requested === 'parent') return parentActor;
  if (requested === 'student') return studentActor;
  if (requested === 'wrong-product') {
    return { ...parentActor, product_key: 'wrong_product' };
  }
  return { ...parentActor, actor_role: 'owner', actor_user_ref: 'owner_user' };
}

function verifyCsrf(req: Request) {
  return req.header('x-csrf-token') === 'valid-csrf';
}

function parentService() {
  return {
    dashboard: async (requestActor: PortalActorContext) => {
      ensureParent(requestActor);
      return parentDashboard();
    },
    createLearner: async (requestActor: PortalActorContext) => {
      ensureParent(requestActor);
      createLearnerCalls += 1;
      return learner('learner_router_created', 'Allowed Learner');
    },
    updateLearner: async () => learner('learner_router_created', 'Allowed Learner'),
    archiveLearner: async () => learner('learner_router_created', 'Allowed Learner'),
    restoreLearner: async () => learner('learner_router_created', 'Allowed Learner'),
    studentAccessOperation: async () => ({
      access_state_key: 'student_access_router',
      learner_key: 'learner_router_created',
      status: 'setup_requested',
      student_user_ref: null,
      last_operation_type: 'setup',
      last_operation_at: '2026-07-14T09:00:00.000Z',
      version: 2,
    }),
    protectedClassLaunch: async () => action(),
    learnerMaterials: async () => ({
      learner: learner('learner_router_created', 'Allowed Learner'),
      library: [],
      review_sheets: [],
      progress: {
        attendance_count: 0,
        watch_minutes: 0,
        completed_items: 0,
        last_activity_at: null,
      },
      rewards: { learner_key: 'learner_router_created', balance: 0, event_count: 0 },
      updates: [],
    }),
    helperQuery: async () => ({ answer: 'Scoped answer', source_refs: ['source_ref_1'] }),
    supportPreview: async () => ({
      preview_key: 'support_preview_router',
      subject: 'Question',
      body: 'Message',
      external_send_performed: false,
    }),
  };
}

function studentService() {
  return {
    dashboard: async () => ({
      learner: learner('learner_student_self', 'Student Learner'),
      upcoming_classes: [],
      library_items: [],
      progress: {
        attendance_count: 0,
        watch_minutes: 0,
        completed_items: 0,
        last_activity_at: null,
      },
      rewards: { learner_key: 'learner_student_self', balance: 0, event_count: 0 },
      updates: [],
      helper: { available: false, reason: 'Unavailable', scope_label: 'Portal helper' },
    }),
    protectedClassLaunch: async (requestActor: PortalActorContext) => {
      lastStudentLaunchActor = requestActor;
      return action();
    },
    helperQuery: async () => ({ answer: 'Scoped answer', source_refs: ['source_ref_1'] }),
    supportPreview: async () => ({
      preview_key: 'support_preview_router',
      subject: 'Question',
      body: 'Message',
      external_send_performed: false,
    }),
  };
}

function ensureParent(requestActor: PortalActorContext) {
  if (
    requestActor.actor_role !== 'parent' ||
    requestActor.product_key !== 'one_time_mishnah_class'
  ) {
    throw new PortalServiceError('FORBIDDEN', 'This portal action requires a parent session.');
  }
}

function parentDashboard() {
  return {
    household: {
      household_key: 'household_alpha',
      display_name: 'Alpha Family',
      active_learner_count: 1,
      max_active_learners: 3,
      consent_status: 'not_required',
      learner_limit_reached: false,
      version: 1,
    },
    learners: [learner('learner_router_created', 'Allowed Learner')],
    student_access: [
      {
        access_state_key: 'student_access_router',
        learner_key: 'learner_router_created',
        status: 'not_configured',
        student_user_ref: null,
        last_operation_type: null,
        last_operation_at: null,
        version: 1,
      },
    ],
    upcoming_classes: { learner_router_created: [] },
    rewards: {
      learner_router_created: { learner_key: 'learner_router_created', balance: 0, event_count: 0 },
    },
    updates: { learner_router_created: [] },
    helper: { available: false, reason: 'Unavailable', scope_label: 'Portal helper' },
    billing: { enabled: false, summary_label: null },
  };
}

function learner(learnerKey: string, displayName: string) {
  return {
    learner_key: learnerKey,
    household_key: 'household_alpha',
    display_name: displayName,
    hebrew_name: null,
    grade_label: null,
    learner_status: 'active',
    version: 1,
    created_at: '2026-07-14T08:00:00.000Z',
    updated_at: '2026-07-14T08:00:00.000Z',
  };
}

function action() {
  return {
    action_key: 'class_launch_router_action',
    label: 'Join class',
    kind: 'class_launch',
    method: 'POST',
    href: '/api/v1/portals/actions/class-launch',
    launch_token_ref: 'class_launch_ref',
    expires_at: '2026-07-14T09:00:00.000Z',
  };
}

function actor(role: PortalActorContext['actor_role']): PortalActorContext {
  return {
    account_key: 'acct_onetime_test',
    product_key: 'one_time_mishnah_class',
    actor_user_ref: `${role}_user`,
    actor_role: role,
    session_key: `${role}_session`,
    capabilities: [
      'parent:household:read',
      'parent:learner:create',
      'parent:learner:update',
      'parent:learner:archive',
      'parent:student-access:manage',
      'parent:class:launch',
      'parent:support:preview',
      'rewards:read',
      'rewards:write',
    ],
    authorized_households: [
      {
        household_key: 'household_alpha',
        relationship_key: 'relationship_alpha',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
    student_learner: null,
  };
}
