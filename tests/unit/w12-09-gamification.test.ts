import { beforeEach, describe, expect, it } from 'vitest';
import type { PortalActorContext } from '../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createGamificationRepository } from '../../packages/db/src/gamification/repository.ts';
import { createGamificationService } from '../../packages/domain/src/index.ts';

let pool: DbPool;
let service: ReturnType<typeof createGamificationService>;

const accountKey = 'acct_w12_09';
const productKey = 'one_time_mishnah_class';

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  await seed();
  service = createGamificationService({
    repository: createGamificationRepository(pool),
    clock: () => new Date('2026-07-17T12:00:00.000Z'),
  });
});

describe('W12-09 One Time student gamification', () => {
  it('records only meaningful learning points and replays identical requests idempotently', async () => {
    const first = await service.recordLearningEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      reason_code: 'mishnah_completed',
      idempotency_key: 'event-mishnah-alpha-001',
      source_ref: 'mishnah-berachos-1-1',
      occurred_at: '2026-07-16T10:00:00.000Z',
    });
    const replay = await service.recordLearningEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      reason_code: 'mishnah_completed',
      idempotency_key: 'event-mishnah-alpha-001',
      source_ref: 'mishnah-berachos-1-1',
      occurred_at: '2026-07-16T10:00:00.000Z',
    });

    expect(replay.event_key).toBe(first.event_key);
    await expect(
      service.recordLearningEvent(ownerActor(), {
        learner_key: 'learner_alpha',
        reason_code: 'review_completed',
        idempotency_key: 'event-mishnah-alpha-001',
        source_ref: 'review-sheet-1',
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      service.recordLearningEvent(ownerActor(), {
        learner_key: 'learner_alpha',
        reason_code: 'attendance_present',
        idempotency_key: 'event-click-alpha-001',
        source_ref: 'click-button',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('builds private student summaries from attendance, content, review, questions, and rewards', async () => {
    await service.recordLearningEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      reason_code: 'review_completed',
      idempotency_key: 'event-review-alpha-001',
      occurred_at: '2026-07-15T10:00:00.000Z',
    });
    await service.recordLearningEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      reason_code: 'retention_review',
      idempotency_key: 'event-retention-alpha-001',
      occurred_at: '2026-07-16T10:00:00.000Z',
    });
    const summary = await service.summaryForLearner(studentActor('learner_alpha'), 'learner_alpha');

    expect(summary.learning_points).toBe(7);
    expect(summary.progress.classes_attended).toBe(2);
    expect(summary.progress.review_items_total).toBe(2);
    expect(summary.progress.retention_percent).toBe(50);
    expect(summary.guardrails).toMatchObject({
      no_public_rankings: true,
      no_random_rewards: true,
      meaningful_learning_only: true,
      student_scope: 'self_only',
    });
    expect(JSON.stringify(summary)).not.toContain('learner_beta');
  });

  it('keeps parents in household scope and prevents sibling/cross-household exposure', async () => {
    const goal = await service.createParentRewardGoal(parentActor('household_alpha'), {
      learner_key: 'learner_alpha',
      title: 'Choose Shabbos dessert',
      description: 'Family-defined reward for steady review.',
      points_required: 25,
      idempotency_key: 'parent-goal-alpha-001',
    });
    expect(goal.reward_goal_key).toMatch(/^parent_reward_/);

    await expect(
      service.createParentRewardGoal(parentActor('household_beta'), {
        learner_key: 'learner_alpha',
        title: 'Cross household reward',
        points_required: 10,
        idempotency_key: 'parent-goal-cross-001',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.summaryForLearner(studentActor('learner_alpha'), 'learner_beta'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('creates administrator reversals with audit history and no double reversal', async () => {
    const event = await service.recordLearningEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      reason_code: 'attendance_present',
      idempotency_key: 'event-attendance-alpha-001',
    });
    const correction = await service.reverseEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      corrected_event_key: event.event_key,
      reason: 'Attendance was entered for the wrong learner.',
      idempotency_key: 'reverse-attendance-alpha-001',
    });
    const replay = await service.reverseEvent(ownerActor(), {
      learner_key: 'learner_alpha',
      corrected_event_key: event.event_key,
      reason: 'Attendance was entered for the wrong learner.',
      idempotency_key: 'reverse-attendance-alpha-001',
    });

    expect(replay.correction_key).toBe(correction.correction_key);
    const summary = await service.summaryForLearner(ownerActor(), 'learner_alpha');
    expect(summary.learning_points).toBe(0);
    expect(summary.accomplishments.some((entry) => entry.points_delta < 0)).toBe(true);
    const dashboard = await service.adminDashboard(ownerActor());
    expect(dashboard.correction_audit).toHaveLength(1);

    await expect(
      service.reverseEvent(ownerActor(), {
        learner_key: 'learner_alpha',
        corrected_event_key: event.event_key,
        reason: 'Second reversal attempt.',
        idempotency_key: 'reverse-attendance-alpha-002',
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});

function ownerActor(): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: 'owner_user',
    actor_role: 'owner',
    session_key: 'session_owner',
    capabilities: [
      'rewards:read',
      'rewards:write',
      'gamification:read',
      'gamification:write',
      'gamification:admin',
    ],
    authorized_households: [],
    student_learner: null,
  };
}

function parentActor(householdKey: string): PortalActorContext {
  return {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: `parent_user_${householdKey}`,
    actor_role: 'parent',
    session_key: `session_parent_${householdKey}`,
    capabilities: ['gamification:read', 'gamification:write', 'rewards:read'],
    authorized_households: [
      {
        household_key: householdKey,
        relationship_key: `relationship_${householdKey}`,
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
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
    capabilities: ['gamification:read', 'rewards:read', 'student:dashboard:read'],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: learnerKey === 'learner_alpha' ? 'household_alpha' : 'household_beta',
      access_state_key: `student_access_${learnerKey}`,
    },
  };
}

async function seed() {
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
     (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref, status)
     VALUES
       ('student_access_learner_alpha',$1,$2,'household_alpha','learner_alpha','student_user_learner_alpha','active'),
       ('student_access_learner_beta',$1,$2,'household_beta','learner_beta','student_user_learner_beta','active')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_series
     (class_series_key, account_key, product_key, title, timezone, local_start_time, reminder_local_time)
     VALUES ('series_w12_09',$1,$2,'W12-09 Mishnayos','Asia/Jerusalem','18:00','17:30')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
     (occurrence_key, account_key, product_key, class_series_key, local_class_date,
      starts_at, scheduled_ends_at, join_opens_at, join_closes_at,
      reminder_due_at, joinable_until, occurrence_state)
     VALUES
       ('occurrence_1',$1,$2,'series_w12_09','2026-07-15','2026-07-15T18:00:00Z',
        '2026-07-15T19:00:00Z','2026-07-15T17:50:00Z','2026-07-15T19:15:00Z',
        '2026-07-15T17:30:00Z','2026-07-15T19:00:00Z','completed'),
       ('occurrence_2',$1,$2,'series_w12_09','2026-07-16','2026-07-16T18:00:00Z',
        '2026-07-16T19:00:00Z','2026-07-16T17:50:00Z','2026-07-16T19:15:00Z',
        '2026-07-16T17:30:00Z','2026-07-16T19:00:00Z','completed')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_attendance_marks
     (attendance_key, account_key, product_key, occurrence_key, learner_key, attendance_state, source, recorded_at)
     VALUES
       ('attendance_alpha_1',$1,$2,'occurrence_1','learner_alpha','present','owner_admin','2026-07-15T18:05:00Z'),
       ('attendance_alpha_2',$1,$2,'occurrence_2','learner_alpha','present','owner_admin','2026-07-16T18:05:00Z')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
     (content_item_key, account_key, product_key, title, item_type, lifecycle_state,
      latest_revision_number, published_revision_key, retention_state, published_at)
     VALUES
       ('review_sheet_1',$1,$2,'Review Sheet 1','review','published',1,'revision_1','active','2026-07-15T20:00:00Z'),
       ('review_sheet_2',$1,$2,'Review Sheet 2','sheet','published',1,'revision_2','active','2026-07-16T20:00:00Z')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_questions
     (question_key, account_key, product_key, household_key, learner_key, submitted_by_user_ref,
      question_text, question_status, answer_preview, answered_at, idempotency_key, request_hash)
     VALUES
       ('question_alpha_1',$1,$2,'household_alpha','learner_alpha','student_user_learner_alpha',
        'What should I review?', 'answered', 'Review the opening Mishnah.', '2026-07-16T21:00:00Z',
        'question-alpha-1','hash-question-alpha-1')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_class_milestones
     (class_milestone_key, account_key, product_key, class_series_key, title, description,
      progress_current, progress_target, status)
     VALUES
       ('class_milestone_1',$1,$2,'series_w12_09','First two classes',
        'The class completed its first two meetings.',2,2,'earned')`,
    [accountKey, productKey],
  );
}
