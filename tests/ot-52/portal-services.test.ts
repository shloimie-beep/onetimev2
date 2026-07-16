import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PortalActorContext,
  ProtectedActionDescriptor,
} from '../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createPortalRepository } from '../../packages/db/src/portals/repository.ts';
import {
  createParentPortalService,
  createRewardService,
  createStudentPortalService,
  type CredentialLifecycleResult,
  type PortalServiceDeps,
  type StudentAccessOperationType,
} from '../../packages/domain/src/portals/services.ts';

let pool: DbPool;
let deps: PortalServiceDeps;
let parentService: ReturnType<typeof createParentPortalService>;
let studentService: ReturnType<typeof createStudentPortalService>;
let rewardService: ReturnType<typeof createRewardService>;

const accountKey = 'acct_onetime_test';
const productKey = 'one_time_mishnah_class';
const householdKey = 'household_alpha';
const otherHouseholdKey = 'household_beta';

const parentActor: PortalActorContext = {
  account_key: accountKey,
  product_key: productKey,
  actor_user_ref: 'parent_user_alpha',
  actor_role: 'parent',
  session_key: 'session_parent_alpha',
  capabilities: [
    'parent:household:read',
    'parent:learner:create',
    'parent:learner:update',
    'parent:learner:archive',
    'parent:student-access:manage',
    'parent:class:launch',
    'parent:content:open',
    'parent:support:preview',
    'rewards:read',
    'rewards:write',
    'helper:query',
  ],
  authorized_households: [
    {
      household_key: householdKey,
      relationship_key: 'relationship_alpha',
      relationship_label: 'Parent',
      authority: 'primary_guardian',
    },
  ],
  student_learner: null,
};

const otherParentActor: PortalActorContext = {
  ...parentActor,
  actor_user_ref: 'parent_user_beta',
  session_key: 'session_parent_beta',
  authorized_households: [
    {
      household_key: otherHouseholdKey,
      relationship_key: 'relationship_beta',
      relationship_label: 'Parent',
      authority: 'primary_guardian',
    },
  ],
};

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  await seedHouseholds(pool);
  const repository = createPortalRepository(pool);
  deps = {
    repository,
    classAccess: safeClassAdapter(),
    contentAccess: {
      publishedLibraryForLearner: async ({ learner }) => [
        {
          item_key: `library_${learner.learner_key}`,
          title: 'Weekly recording',
          item_type: 'video',
          status: 'published',
          open_action: safeAction('content_open', 'Open recording'),
        },
      ],
      reviewSheetsForLearner: async ({ learner }) => [
        {
          item_key: `review_${learner.learner_key}`,
          title: 'Review sheet',
          item_type: 'review',
          status: 'published',
          open_action: safeAction('review_sheet_open', 'Open review'),
        },
      ],
    },
    progress: {
      progressForLearner: async () => ({
        attendance_count: 2,
        watch_minutes: 45,
        completed_items: 1,
        last_activity_at: '2026-07-14T08:00:00.000Z',
      }),
    },
    credentialLifecycle: credentialAdapter(),
  };
  parentService = createParentPortalService(deps);
  studentService = createStudentPortalService(deps);
  rewardService = createRewardService(repository);
});

describe('OT-52P parent and student portal services', () => {
  it('enforces the three active learner limit and lets archived learners stop counting', async () => {
    const learner1 = await createLearner('Alpha', 'learner-create-001');
    const learner2 = await createLearner('Beta', 'learner-create-002');
    const learner3 = await createLearner('Gamma', 'learner-create-003');

    await expect(createLearner('Delta', 'learner-create-004')).rejects.toMatchObject({
      code: 'LEARNER_LIMIT_REACHED',
    });

    const archived = await parentService.archiveLearner(
      parentActor,
      householdKey,
      learner1.learner_key,
      {
        idempotency_key: 'archive-learner-001',
        version: learner1.version,
      },
    );
    expect(archived.learner_status).toBe('archived');

    const learner4 = await createLearner('Delta', 'learner-create-005');
    expect(learner4.learner_status).toBe('active');

    await expect(
      parentService.restoreLearner(parentActor, householdKey, learner1.learner_key, {
        idempotency_key: 'restore-learner-001',
        version: archived.version,
      }),
    ).rejects.toMatchObject({ code: 'LEARNER_LIMIT_REACHED' });

    const dashboard = await parentService.dashboard(parentActor, householdKey);
    expect(dashboard.learners.map((learner) => learner.learner_key).sort()).toEqual(
      [
        learner1.learner_key,
        learner2.learner_key,
        learner3.learner_key,
        learner4.learner_key,
      ].sort(),
    );
    expect(
      dashboard.learners.find((learner) => learner.learner_key === learner1.learner_key)
        ?.learner_status,
    ).toBe('archived');
    expect(dashboard.household.active_learner_count).toBe(3);
  });

  it('rejects cross-household IDs and owner/admin sessions without silently becoming parents', async () => {
    const betaLearner = await parentService.createLearner(otherParentActor, otherHouseholdKey, {
      idempotency_key: 'beta-learner-create',
      display_name: 'Other Household Learner',
    });

    await expect(parentService.dashboard(parentActor, otherHouseholdKey)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      parentService.updateLearner(parentActor, householdKey, betaLearner.learner_key, {
        idempotency_key: 'cross-household-update',
        version: betaLearner.version,
        display_name: 'Should Not Update',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      rewardService.award(parentActor, {
        learner_key: betaLearner.learner_key,
        points_delta: 1,
        reason_code: 'cross_household',
        reason_label: 'Cross household',
        idempotency_key: 'cross-household-reward',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      parentService.dashboard(
        { ...parentActor, actor_role: 'owner', actor_user_ref: 'owner_user' },
        householdKey,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('derives student scope only from the authenticated learner subject', async () => {
    const alpha = await createLearner('Alpha Student', 'student-scope-alpha');
    const beta = await parentService.createLearner(otherParentActor, otherHouseholdKey, {
      idempotency_key: 'student-scope-beta',
      display_name: 'Beta Student',
    });
    const studentActor = studentActorFor(alpha.learner_key);

    const dashboard = await studentService.dashboard(studentActor);
    expect(dashboard.learner.learner_key).toBe(alpha.learner_key);
    expect(JSON.stringify(dashboard)).not.toContain(beta.learner_key);

    const launch = await studentService.protectedClassLaunch(studentActor, 'class_week_001');
    expect(launch.href).toMatch(/^\/api\/v1\/portals\//);
    expect(JSON.stringify(launch)).not.toMatch(/https?:\/\/|zoom|meet/i);
  });

  it('submits private student questions idempotently without exposing them to parents', async () => {
    const learner = await createLearner('Question Learner', 'question-learner-create');
    const studentActor = studentActorFor(learner.learner_key);
    const submitted = await studentService.submitQuestion(studentActor, {
      idempotency_key: 'student-question-001',
      question: 'What is the main point of the Mishnah?',
      class_key: 'class_week_001',
    });
    const replay = await studentService.submitQuestion(studentActor, {
      idempotency_key: 'student-question-001',
      question: 'What is the main point of the Mishnah?',
      class_key: 'class_week_001',
    });

    expect(replay.question_key).toBe(submitted.question_key);
    expect(
      (await studentService.questions(studentActor)).map((entry) => entry.question_key),
    ).toEqual([submitted.question_key]);
    await expect(
      deps.repository.listStudentQuestions({
        actor: parentActor,
        learner_key: learner.learner_key,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      studentService.submitQuestion(studentActorFor('learner_sibling_attempt'), {
        idempotency_key: 'student-question-sibling',
        question: 'Sibling attempt',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('opens protected content only after learner entitlement checks', async () => {
    const learner = await createLearner('Content Learner', 'content-learner-create');
    const studentActor = studentActorFor(learner.learner_key);
    const opened = await studentService.protectedContentOpen(
      studentActor,
      `library_${learner.learner_key}`,
    );

    expect(opened).toMatchObject({ kind: 'content_open', href: null });
    expect(JSON.stringify(opened)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);
    await expect(
      studentService.protectedContentOpen(studentActor, 'library_learner_sibling'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps rewards immutable, idempotent, and unavailable to student actors', async () => {
    const learner = await createLearner('Reward Learner', 'reward-learner-create');
    const first = await rewardService.award(parentActor, {
      learner_key: learner.learner_key,
      points_delta: 5,
      reason_code: 'attendance',
      reason_label: 'Attended live class',
      idempotency_key: 'reward-event-001',
    });
    const replay = await rewardService.award(parentActor, {
      learner_key: learner.learner_key,
      points_delta: 5,
      reason_code: 'attendance',
      reason_label: 'Attended live class',
      idempotency_key: 'reward-event-001',
    });
    const correction = await rewardService.award(parentActor, {
      learner_key: learner.learner_key,
      points_delta: -2,
      reason_code: 'correction',
      reason_label: 'Manual correction',
      idempotency_key: 'reward-event-002',
      correction_of_event_key: first.reward_event_key,
    });

    expect(replay.reward_event_key).toBe(first.reward_event_key);
    expect(correction.correction_of_event_key).toBe(first.reward_event_key);
    await expect(
      rewardService.award(studentActorFor(learner.learner_key), {
        learner_key: learner.learner_key,
        points_delta: 1,
        reason_code: 'student_write',
        reason_label: 'Student write',
        idempotency_key: 'reward-event-003',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const balance = await deps.repository.getRewardBalance({
      actor: parentActor,
      learner_key: learner.learner_key,
    });
    expect(balance).toMatchObject({ balance: 3, event_count: 2 });
  });

  it('records credential lifecycle operations as digests and rejects adapter material leaks', async () => {
    const learner = await createLearner('Access Learner', 'access-learner-create');
    const state = await parentService.studentAccessOperation(
      parentActor,
      householdKey,
      learner.learner_key,
      'setup',
      { idempotency_key: 'student-access-setup-001' },
    );
    const replay = await parentService.studentAccessOperation(
      parentActor,
      householdKey,
      learner.learner_key,
      'setup',
      { idempotency_key: 'student-access-setup-001' },
    );

    expect(state.status).toBe('setup_requested');
    expect(replay).toEqual(state);

    const revoked = await parentService.studentAccessOperation(
      parentActor,
      householdKey,
      learner.learner_key,
      'revoke_sessions',
      { idempotency_key: 'student-access-revoke-sessions-001' },
    );
    expect(revoked.status).toBe('active');
    expect(revoked.last_operation_type).toBe('revoke_sessions');

    const operationRows = await pool.query(
      `SELECT operation_type, adapter_operation_ref_digest, proof_digest
         FROM onetime.portal_student_access_operations
        WHERE learner_key = $1
        ORDER BY created_at ASC`,
      [learner.learner_key],
    );
    expect(operationRows.rows).toHaveLength(2);
    expect(operationRows.rows.map((row) => row.operation_type)).toEqual([
      'setup',
      'revoke_sessions',
    ]);
    expect(operationRows.rows[0].adapter_operation_ref_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(operationRows.rows[0].adapter_operation_ref_digest).not.toBe('op_setup_1');
    expect(JSON.stringify(operationRows.rows)).not.toContain('op_setup_1');

    const auditRows = await pool.query(
      `SELECT metadata
         FROM onetime.portal_audit_actions
        WHERE action_type = 'student_access_setup'
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    expect(JSON.stringify(auditRows.rows)).not.toContain('op_setup_1');

    const leakyService = createParentPortalService({
      ...deps,
      credentialLifecycle: credentialAdapter({
        setup: { operation_ref: 'hash_material', status: 'setup_requested' },
      }),
    });
    await expect(
      leakyService.studentAccessOperation(parentActor, householdKey, learner.learner_key, 'setup', {
        idempotency_key: 'student-access-setup-002',
      }),
    ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });

  it('keeps the scoped helper unavailable until an adapter is wired', async () => {
    const learner = await createLearner('Helper Learner', 'helper-learner-create');
    const dashboard = await parentService.dashboard(parentActor, householdKey);
    const studentDashboard = await studentService.dashboard(studentActorFor(learner.learner_key));

    expect(dashboard.helper).toMatchObject({ available: false });
    expect(studentDashboard.helper).toMatchObject({ available: false });
    await expect(
      parentService.helperQuery(parentActor, householdKey, {
        idempotency_key: 'helper-query-001',
        question: 'What is due?',
      }),
    ).rejects.toMatchObject({ code: 'ADAPTER_UNAVAILABLE' });
  });

  it('blocks adapter-supplied raw provider URLs before serialization', async () => {
    const learner = await createLearner('URL Learner', 'url-learner-create');
    const rawUrlStudentService = createStudentPortalService({
      ...deps,
      classAccess: {
        ...safeClassAdapter(),
        protectedLaunch: async () => ({
          action_key: 'launch_action_raw',
          label: 'Join class',
          kind: 'class_launch',
          method: 'POST',
          href: 'https://provider.example.test/private-room',
          launch_token_ref: null,
          expires_at: null,
        }),
      },
    });

    await expect(
      rawUrlStudentService.protectedClassLaunch(studentActorFor(learner.learner_key), 'class_raw'),
    ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });
});

async function seedHouseholds(target: DbPool) {
  await target.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ($1, $2, $3, 'Alpha Family'),
       ($4, $2, $3, 'Beta Family')`,
    [householdKey, accountKey, productKey, otherHouseholdKey],
  );
  await target.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('relationship_alpha', $1, $2, $3, 'parent_user_alpha', 'Parent', 'primary_guardian'),
       ('relationship_beta', $1, $2, $4, 'parent_user_beta', 'Parent', 'primary_guardian')`,
    [accountKey, productKey, householdKey, otherHouseholdKey],
  );
}

async function createLearner(displayName: string, idempotencyKey: string) {
  return parentService.createLearner(parentActor, householdKey, {
    idempotency_key: idempotencyKey,
    display_name: displayName,
  });
}

function studentActorFor(learnerKey: string): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: `student_user_${learnerKey}`,
    actor_role: 'student',
    session_key: `session_student_${learnerKey}`,
    capabilities: [
      'student:dashboard:read',
      'student:class:launch',
      'student:content:open',
      'student:question:create',
      'student:support:preview',
      'rewards:read',
      'helper:query',
    ],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: householdKey,
      access_state_key: `student_access_${learnerKey}`,
    },
  };
}

function safeAction(
  kind: ProtectedActionDescriptor['kind'],
  label: string,
): ProtectedActionDescriptor {
  return {
    action_key: `${kind}_action`,
    label,
    kind,
    method: 'POST',
    href: `/api/v1/portals/actions/${kind}`,
    launch_token_ref: `${kind}_ref`,
    expires_at: '2026-07-14T09:00:00.000Z',
  };
}

function safeClassAdapter(): PortalServiceDeps['classAccess'] {
  return {
    upcomingForLearner: async () => [
      {
        class_key: 'class_week_001',
        title: 'Weekly Mishnah',
        starts_at: '2026-07-15T18:00:00.000Z',
        status: 'upcoming',
        launch_action: safeAction('class_launch', 'Join class'),
      },
    ],
    protectedLaunch: async () => safeAction('class_launch', 'Join class'),
  };
}

function credentialAdapter(overrides?: {
  setup?: Partial<CredentialLifecycleResult>;
}): PortalServiceDeps['credentialLifecycle'] {
  const result = (operationType: StudentAccessOperationType) => ({
    operation_ref: `op_${operationType}_1`,
    status: statusForOperation(operationType),
    expires_at:
      operationType === 'setup' || operationType === 'reset' ? '2026-07-14T10:00:00.000Z' : null,
    delivery_hint: operationType === 'setup' ? 'Guardian delivery pending' : null,
    ...(operationType === 'setup' ? overrides?.setup : {}),
  });
  return {
    requestSetup: async () => result('setup'),
    requestReset: async () => result('reset'),
    requestSuspend: async () => result('suspend'),
    requestRestore: async () => result('restore'),
    requestRevokeSessions: async () => result('revoke_sessions'),
  };
}

function statusForOperation(
  operationType: StudentAccessOperationType,
): CredentialLifecycleResult['status'] {
  if (operationType === 'setup') return 'setup_requested';
  if (operationType === 'reset') return 'reset_requested';
  if (operationType === 'suspend') return 'suspended';
  if (operationType === 'revoke_sessions') return 'active';
  return 'active';
}
