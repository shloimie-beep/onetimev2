import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import type {
  PortalActorContext,
  ProtectedActionDescriptor,
} from '../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createGamificationRepository } from '../../packages/db/src/gamification/repository.ts';
import { createPortalRepository } from '../../packages/db/src/portals/repository.ts';
import { createGamificationService } from '../../packages/domain/src/gamification/service.ts';
import { createAccountLifecycleCredentialAdapter } from '../../packages/domain/src/portals/account-lifecycle-adapter.ts';
import { createAccountUser } from '../../packages/domain/src/auth/service.ts';
import {
  createParentPortalService,
  type PortalServiceDeps,
} from '../../packages/domain/src/portals/services.ts';

let pool: DbPool;
let parentUserKey: string;

const accountKey = 'rabbi_sheller_provider';
const productKey = 'one_time_mishnah_class';
const householdKey = 'household_learning_product';
const lifecycleConfig = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  ONE_TIME_ACCOUNT_KEY: accountKey,
  ONE_TIME_PRODUCT_KEY: productKey,
});

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

describe('Window B learning product portals', () => {
  it('sets up credentials and queues a secure Student reset to the adult Parent', async () => {
    await seedHousehold();
    const service = createParentPortalService(portalDeps());
    const learner = await service.createLearner(parentActor(), householdKey, {
      idempotency_key: 'learner-credential-create',
      display_name: 'Chaim Learner',
    });

    const setup = await service.studentAccessOperation(
      parentActor(),
      householdKey,
      learner.learner_key,
      'setup',
      {
        idempotency_key: 'student-credential-setup',
        username: 'Chaim_7',
        password: 'Torah12345',
      },
    );

    expect(setup.status).toBe('active');
    expect(setup.username_display).toBe('chaim_7');
    expect(setup.credential_status).toBe('parent_managed');
    expect(setup.student_user_ref).toMatch(/^student_user_/);
    expect(JSON.stringify(setup)).not.toContain('Torah12345');

    const stored = await pool.query(
      `SELECT normalized_username, password_hash_ref, password_version
         FROM onetime.portal_student_access_state
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3`,
      [accountKey, productKey, learner.learner_key],
    );
    expect(stored.rows[0]).toMatchObject({
      normalized_username: 'chaim_7',
      password_version: 1,
    });
    expect(String(stored.rows[0]?.password_hash_ref)).toMatch(/^scrypt:v1:/);
    expect(String(stored.rows[0]?.password_hash_ref)).not.toContain('Torah12345');

    const reset = await service.studentAccessOperation(
      parentActor(),
      householdKey,
      learner.learner_key,
      'reset',
      {
        idempotency_key: 'student-credential-reset',
      },
    );

    expect(reset.status).toBe('reset_requested');
    expect(reset.username_display).toBe('chaim_7');
    expect(reset.credential_status).toBe('reset_required');
    expect(reset.password_version).toBe(1);
    expect(reset.last_reset_at).toBeNull();

    const resetToken = await pool.query(
      `SELECT email_normalized, token_hash, metadata
         FROM onetime.account_lifecycle_tokens
        WHERE account_key = $1
          AND product_key = $2
          AND token_type = 'student_reset'
          AND learner_key = $3`,
      [accountKey, productKey, learner.learner_key],
    );
    expect(resetToken.rows[0]).toMatchObject({
      email_normalized: 'learning.parent@example.test',
    });
    expect(String(resetToken.rows[0]?.token_hash)).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(resetToken.rows[0])).not.toContain('Mishnah12345');

    const audit = await pool.query(
      `SELECT operation_type, username_digest, password_hash_ref_digest
         FROM onetime.portal_student_credential_audit
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
        ORDER BY created_at ASC`,
      [accountKey, productKey, learner.learner_key],
    );
    expect(audit.rows.map((row) => row.operation_type).sort()).toEqual(['reset', 'setup']);
    expect(audit.rows.some((row) => String(row.password_hash_ref_digest).length === 64)).toBe(true);
  });

  it('blocks reserved student usernames before credential adapters run', async () => {
    await seedHousehold();
    const service = createParentPortalService(portalDeps());
    const learner = await service.createLearner(parentActor(), householdKey, {
      idempotency_key: 'learner-reserved-create',
      display_name: 'Reserved Learner',
    });

    await expect(
      service.studentAccessOperation(parentActor(), householdKey, learner.learner_key, 'setup', {
        idempotency_key: 'student-reserved-setup',
        username: 'Admin',
        password: 'Torah12345',
      }),
    ).rejects.toMatchObject({ code: 'USERNAME_UNAVAILABLE' });
  });

  it('publishes an authenticated all-time class leaderboard with Window B point policy', async () => {
    await seedLeaderboard();
    const service = createGamificationService({
      repository: createGamificationRepository(pool),
      clock: () => new Date('2026-07-20T12:00:00.000Z'),
    });
    const owner = ownerActor();
    const events = [
      ['attendance_present', 'event-alpha-attended'],
      ['lesson_completed', 'event-alpha-lesson'],
      ['worksheet_completed', 'event-alpha-worksheet'],
      ['question_approved', 'event-alpha-question'],
      ['excellent_question', 'event-alpha-excellent'],
      ['consistency_bonus', 'event-alpha-consistency'],
    ] as const;
    for (const [reason_code, idempotency_key] of events) {
      await service.recordLearningEvent(owner, {
        learner_key: 'learner_alpha',
        reason_code,
        idempotency_key,
      });
    }
    await service.recordLearningEvent(owner, {
      learner_key: 'learner_beta',
      reason_code: 'lesson_completed',
      idempotency_key: 'event-beta-lesson',
    });

    const board = await service.classLeaderboard(studentActor('learner_alpha'));

    expect(board).toMatchObject({
      scope: 'authenticated_class_only',
      time_basis: 'all_time_no_reset',
      published: true,
      actual_names_visible: true,
      negative_labels_present: false,
      ai_judgment_present: false,
    });
    expect(board.entries[0]).toMatchObject({
      learner_key: 'learner_alpha',
      display_name: 'Alpha Learner',
      points: 38,
      attendance_count: 1,
      completed_lessons: 1,
      approved_questions: 2,
      excellent_questions: 1,
      consistency_bonus_count: 1,
      own_entry: true,
    });
    expect(board.entries.map((entry) => entry.display_name)).toContain('Beta Learner');
  });

  it('keeps the student question class picker off native select controls', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'apps/web/src/client/features/portals/PortalFeatures.tsx'),
      'utf8',
    );
    expect(source).not.toContain('<select');
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain('ClassPicker');
  });
});

function portalDeps(): PortalServiceDeps {
  return {
    repository: createPortalRepository(pool),
    classAccess: {
      upcomingForLearner: async () => [],
      protectedLaunch: async () => safeAction(),
    },
    contentAccess: {
      publishedLibraryForLearner: async () => [],
      reviewSheetsForLearner: async () => [],
    },
    progress: {
      progressForLearner: async () => ({
        attendance_count: 0,
        watch_minutes: 0,
        completed_items: 0,
        last_activity_at: null,
      }),
    },
    credentialLifecycle: createAccountLifecycleCredentialAdapter({
      pool,
      config: lifecycleConfig,
    }),
  };
}

function safeAction(): ProtectedActionDescriptor {
  return {
    action_key: 'action_learning_product_safe',
    label: 'Protected action',
    kind: 'class_launch',
    method: 'POST',
    href: '/api/v1/portals/student/classes/class_learning/launch',
    launch_token_ref: 'launch_ref_safe',
    expires_at: null,
  };
}

function parentActor(): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: parentUserKey,
    actor_role: 'parent',
    session_key: 'session_parent_learning_product',
    capabilities: [
      'parent:household:read',
      'parent:learner:create',
      'parent:student-access:manage',
      'gamification:read',
      'parent:leaderboard:read',
    ],
    authorized_households: [
      {
        household_key: householdKey,
        relationship_key: 'relationship_learning_product',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
    student_learner: null,
  };
}

function ownerActor(): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: 'owner_learning_product',
    actor_role: 'owner',
    session_key: 'session_owner_learning_product',
    capabilities: ['gamification:read', 'gamification:write', 'gamification:admin'],
    authorized_households: [],
    student_learner: null,
  };
}

function studentActor(learnerKey: string): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: `student_user_${learnerKey}`,
    actor_role: 'student',
    session_key: `session_student_${learnerKey}`,
    capabilities: ['student:dashboard:read', 'student:leaderboard:read', 'gamification:read'],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: learnerKey === 'learner_alpha' ? 'household_alpha' : 'household_beta',
      access_state_key: `student_access_${learnerKey}`,
    },
  };
}

async function seedHousehold() {
  parentUserKey = await createAccountUser({
    pool,
    config: lifecycleConfig,
    email: 'learning.parent@example.test',
    password: 'LearningParent!234',
    displayName: 'Learning Parent',
    role: 'parent',
  });
  await pool.query(
    `INSERT INTO onetime.portal_households
     (household_key, account_key, product_key, display_name)
     VALUES ($1,$2,$3,'Learning Product Family')`,
    [householdKey, accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.contacts
     (contact_key, account_key, product_key, display_name, family_school_classification,
      family_or_school, location_text, timezone, email_normalized, reminder_preference, source)
     VALUES
     ('contact_learning_parent',$1,$2,'Learning Parent','family',
      'Learning Product Family','Jerusalem','Asia/Jerusalem',
      'learning.parent@example.test','none','test')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
     (relationship_key, account_key, product_key, household_key, guardian_user_ref,
      relationship_label, authority)
     VALUES
     ('relationship_learning_product',$1,$2,$3,$4,'Parent','primary_guardian')`,
    [accountKey, productKey, householdKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.adult_household_contact_links
     (link_key, account_key, product_key, contact_key, household_key,
      highlevel_location_id, sync_state)
     VALUES
     ('adult_link_learning_product',$1,$2,'contact_learning_parent',$3,
      'location_learning_product','sync_pending')`,
    [accountKey, productKey, householdKey],
  );
}

async function seedLeaderboard() {
  await pool.query(
    `INSERT INTO onetime.portal_households
     (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha',$1,$2,'Alpha Family'),
       ('household_beta',$1,$2,'Beta Family')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
     (learner_key, account_key, product_key, household_key, display_name, grade_label)
     VALUES
       ('learner_alpha',$1,$2,'household_alpha','Alpha Learner','Grade 5'),
       ('learner_beta',$1,$2,'household_beta','Beta Learner','Grade 6')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
     (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
      status, username_display, normalized_username, credential_status)
     VALUES
       ('student_access_learner_alpha',$1,$2,'household_alpha','learner_alpha',
        'student_user_learner_alpha','active','alpha','alpha','parent_managed'),
       ('student_access_learner_beta',$1,$2,'household_beta','learner_beta',
        'student_user_learner_beta','active','beta','beta','parent_managed')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_series
     (class_series_key, account_key, product_key, title, timezone, local_start_time, reminder_local_time)
     VALUES ('class_series_one_time_daily',$1,$2,'Daily One Time Mishnayos','Asia/Jerusalem','19:00','18:30')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
     (occurrence_key, account_key, product_key, class_series_key, local_class_date,
      starts_at, scheduled_ends_at, join_opens_at, join_closes_at,
      reminder_due_at, joinable_until, occurrence_state)
     VALUES
       ('occurrence_learning_product',$1,$2,'class_series_one_time_daily','2026-07-20',
        '2026-07-20T16:00:00Z','2026-07-20T17:00:00Z','2026-07-20T15:50:00Z',
        '2026-07-20T17:15:00Z','2026-07-20T15:30:00Z','2026-07-20T17:30:00Z','completed')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_leaderboard_publication_controls
     (board_key, account_key, product_key, class_series_key, title, publication_state,
      controlled_by_actor_ref)
     VALUES
       ('leaderboard_learning_product',$1,$2,'class_series_one_time_daily',
        'Daily One Time Mishnayos','published','rabbi_sheller_admin')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_attendance_marks
     (attendance_key, account_key, product_key, occurrence_key, learner_key, attendance_state,
      source, recorded_at)
     VALUES
       ('attendance_alpha_learning',$1,$2,'occurrence_learning_product','learner_alpha',
        'present','owner_admin','2026-07-20T16:05:00Z')`,
    [accountKey, productKey],
  );
}
