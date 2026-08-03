import { createHash, randomUUID } from 'node:crypto';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';
import type {
  ClassMilestone,
  GamificationCorrectionAudit,
  GamificationCorrectionPayload,
  GamificationLearningEventPayload,
  GamificationReasonCode,
  ParentRewardGoal,
  ParentRewardGoalPayload,
} from '../../../contracts/src/gamification/index.ts';
import { gamificationReasonCodeSchema } from '../../../contracts/src/gamification/index.ts';
import type {
  ClassLeaderboardSummary,
  LearnerProfile,
  PortalActorContext,
} from '../../../contracts/src/portals/index.ts';
import {
  PortalServiceError,
  type GamificationEventRow,
  type GamificationLearnerSnapshot,
  type GamificationRepository,
} from '../../../domain/src/index.ts';

const GAMIFICATION_REASON_CODES = new Set<string>(gamificationReasonCodeSchema.options);

export function createGamificationRepository(pool: DbPool): GamificationRepository {
  return {
    loadLearnerSnapshot: (args) => loadLearnerSnapshot(pool, args.actor, args.learner_key),
    recordLearningEvent: (args) =>
      recordLearningEvent(pool, {
        actor: args.actor,
        payload: args.payload,
        pointsDelta: args.points_delta,
        reasonLabel: args.reason_label,
        requestFingerprint: args.request_fingerprint,
      }),
    createParentRewardGoal: (args) =>
      createParentRewardGoal(pool, {
        actor: args.actor,
        payload: args.payload,
        requestFingerprint: args.request_fingerprint,
      }),
    reverseEvent: (args) =>
      reverseEvent(pool, {
        actor: args.actor,
        payload: args.payload,
        requestFingerprint: args.request_fingerprint,
      }),
    loadAdminDashboard: (args) => loadAdminDashboard(pool, args.actor),
    loadClassLeaderboard: (args) => loadClassLeaderboard(pool, args.actor),
  };
}

async function loadLearnerSnapshot(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
): Promise<GamificationLearnerSnapshot | null> {
  const learner = await findLearner(target, actor, learnerKey);
  if (!learner) return null;
  assertActorCanReadLearner(actor, learner);
  const [
    rewardEvents,
    attendanceDates,
    classTotal,
    reviewItemsTotal,
    answeredQuestions,
    parentRewards,
    classMilestones,
  ] = await Promise.all([
    listRewardEvents(target, actor, learnerKey),
    listAttendanceDates(target, actor, learnerKey),
    countClassTotal(target, actor),
    countReviewItems(target, actor),
    countAnsweredQuestions(target, actor, learnerKey),
    listParentRewards(target, actor, learnerKey),
    listClassMilestones(target, actor),
  ]);
  return {
    learner,
    reward_events: rewardEvents,
    attendance_dates: attendanceDates,
    class_total: classTotal,
    review_items_total: reviewItemsTotal,
    answered_questions: answeredQuestions,
    parent_rewards: parentRewards,
    class_milestones: classMilestones,
  };
}

async function recordLearningEvent(
  pool: DbPool,
  args: {
    actor: PortalActorContext;
    payload: GamificationLearningEventPayload;
    pointsDelta: number;
    reasonLabel: string;
    requestFingerprint: string;
  },
) {
  return inTransaction(pool, async (client) => {
    const scope = `gamification.event:${args.payload.learner_key}`;
    const replay = await readIdempotency<GamificationEventRow>(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
    );
    if (replay) return replay;
    const learner = await lockLearner(client, args.actor, args.payload.learner_key);
    assertActorCanAdminLearner(args.actor, learner);
    const inserted = await client.query(
      `INSERT INTO onetime.portal_reward_events
       (reward_event_key, account_key, product_key, household_key, learner_key,
        points_delta, reason_code, reason_label, actor_ref, source_type,
        correction_of_event_key, idempotency_key, request_hash, metadata, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'admin',NULL,$10,$11,$12::jsonb,
               COALESCE($13::timestamptz, now()))
       RETURNING reward_event_key, learner_key, points_delta, reason_code, reason_label,
                 actor_ref, source_type, correction_of_event_key, occurred_at`,
      [
        `reward_${randomUUID()}`,
        args.actor.account_key,
        args.actor.product_key,
        learner.household_key,
        args.payload.learner_key,
        args.pointsDelta,
        args.payload.reason_code,
        args.reasonLabel,
        args.actor.actor_user_ref,
        args.payload.idempotency_key,
        args.requestFingerprint,
        JSON.stringify({ source_ref: args.payload.source_ref ?? null }),
        args.payload.occurred_at ?? null,
      ],
    );
    const event = mapRewardEvent(inserted.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
      event,
    );
    await recordAudit(client, {
      action_type: 'gamification_event_recorded',
      actor: args.actor,
      household_key: learner.household_key,
      learner_key: args.payload.learner_key,
      metadata: {
        reward_event_key: event.reward_event_key,
        reason_code: args.payload.reason_code,
        points_delta: args.pointsDelta,
      },
    });
    return event;
  });
}

async function createParentRewardGoal(
  pool: DbPool,
  args: {
    actor: PortalActorContext;
    payload: ParentRewardGoalPayload;
    requestFingerprint: string;
  },
) {
  return inTransaction(pool, async (client) => {
    const scope = `gamification.parent-reward:${args.payload.learner_key}`;
    const replay = await readIdempotency<ParentRewardGoal>(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
    );
    if (replay) return replay;
    const learner = await lockLearner(client, args.actor, args.payload.learner_key);
    assertActorCanReadLearner(args.actor, learner);
    if (args.actor.actor_role !== 'parent') {
      throw new PortalServiceError('FORBIDDEN', 'Parent rewards require a parent session.');
    }
    const inserted = await client.query(
      `INSERT INTO onetime.portal_parent_reward_goals
       (reward_goal_key, account_key, product_key, household_key, learner_key, title,
        description, points_required, created_by_parent_ref, idempotency_key, request_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING reward_goal_key, learner_key, title, description, points_required, status,
                 created_by_parent_ref, earned_at, fulfilled_at`,
      [
        `parent_reward_${randomUUID()}`,
        args.actor.account_key,
        args.actor.product_key,
        learner.household_key,
        args.payload.learner_key,
        args.payload.title,
        args.payload.description ?? null,
        args.payload.points_required,
        args.actor.actor_user_ref,
        args.payload.idempotency_key,
        args.requestFingerprint,
      ],
    );
    const reward = mapParentReward(inserted.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
      reward,
    );
    await recordAudit(client, {
      action_type: 'parent_reward_goal_created',
      actor: args.actor,
      household_key: learner.household_key,
      learner_key: args.payload.learner_key,
      metadata: {
        reward_goal_key: reward.reward_goal_key,
        points_required: reward.points_required,
      },
    });
    return reward;
  });
}

async function reverseEvent(
  pool: DbPool,
  args: {
    actor: PortalActorContext;
    payload: GamificationCorrectionPayload;
    requestFingerprint: string;
  },
) {
  return inTransaction(pool, async (client) => {
    const scope = `gamification.reverse:${args.payload.learner_key}`;
    const replay = await readIdempotency<GamificationCorrectionAudit>(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
    );
    if (replay) return replay;
    const learner = await lockLearner(client, args.actor, args.payload.learner_key);
    assertActorCanAdminLearner(args.actor, learner);
    const originalResult = await client.query(
      `SELECT reward_event_key, learner_key, points_delta, reason_code, reason_label,
              actor_ref, source_type, correction_of_event_key, occurred_at
         FROM onetime.portal_reward_events
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
          AND reward_event_key = $4
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.payload.learner_key,
        args.payload.corrected_event_key,
      ],
    );
    const original = originalResult.rows[0] as Record<string, unknown> | undefined;
    if (!original) {
      throw new PortalServiceError('NOT_FOUND', 'The reward event was not found.');
    }
    const originalPoints = Number(original.points_delta);
    if (originalPoints <= 0 || original.correction_of_event_key) {
      throw new PortalServiceError(
        'VALIDATION_ERROR',
        'Only positive learning events can be reversed.',
      );
    }
    const existingCorrection = await client.query(
      `SELECT correction_key
         FROM onetime.portal_gamification_corrections
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
          AND corrected_event_key = $4
        LIMIT 1`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.payload.learner_key,
        args.payload.corrected_event_key,
      ],
    );
    if (existingCorrection.rowCount) {
      throw new PortalServiceError('VERSION_CONFLICT', 'That event has already been reversed.');
    }
    const reversal = await client.query(
      `INSERT INTO onetime.portal_reward_events
       (reward_event_key, account_key, product_key, household_key, learner_key,
        points_delta, reason_code, reason_label, actor_ref, source_type,
        correction_of_event_key, idempotency_key, request_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'admin_correction','Administrator correction',$7,'admin',
               $8,$9,$10,$11::jsonb)
       RETURNING reward_event_key`,
      [
        `reward_${randomUUID()}`,
        args.actor.account_key,
        args.actor.product_key,
        learner.household_key,
        args.payload.learner_key,
        -Math.abs(originalPoints),
        args.actor.actor_user_ref,
        args.payload.corrected_event_key,
        args.payload.idempotency_key,
        args.requestFingerprint,
        JSON.stringify({ reason: args.payload.reason }),
      ],
    );
    const reversalKey = String((reversal.rows[0] as Record<string, unknown>).reward_event_key);
    const insertedCorrection = await client.query(
      `INSERT INTO onetime.portal_gamification_corrections
       (correction_key, account_key, product_key, household_key, learner_key,
        corrected_event_key, reversal_event_key, reason, actor_ref, idempotency_key, request_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING correction_key, learner_key, corrected_event_key, reversal_event_key,
                 reason, actor_ref, created_at`,
      [
        `gamification_correction_${randomUUID()}`,
        args.actor.account_key,
        args.actor.product_key,
        learner.household_key,
        args.payload.learner_key,
        args.payload.corrected_event_key,
        reversalKey,
        args.payload.reason,
        args.actor.actor_user_ref,
        args.payload.idempotency_key,
        args.requestFingerprint,
      ],
    );
    const correction = mapCorrection(insertedCorrection.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      args.actor,
      scope,
      args.payload.idempotency_key,
      args.requestFingerprint,
      correction,
    );
    await recordAudit(client, {
      action_type: 'gamification_event_reversed',
      actor: args.actor,
      household_key: learner.household_key,
      learner_key: args.payload.learner_key,
      metadata: {
        corrected_event_key: args.payload.corrected_event_key,
        reversal_event_key: reversalKey,
      },
    });
    return correction;
  });
}

async function loadAdminDashboard(pool: DbPool, actor: PortalActorContext) {
  assertActorCanAdminLearner(actor, {
    learner_key: 'admin_scope_probe',
    household_key: 'admin_scope_probe',
  });
  const learnerRows = await pool.query(
    `SELECT learner_key
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND learner_status = 'active'
      ORDER BY updated_at DESC, learner_key ASC
      LIMIT 200`,
    [actor.account_key, actor.product_key],
  );
  const snapshots = (
    await Promise.all(
      learnerRows.rows.map((row) => loadLearnerSnapshot(pool, actor, String(row.learner_key))),
    )
  ).filter((snapshot): snapshot is GamificationLearnerSnapshot => Boolean(snapshot));
  return {
    generated_at: new Date().toISOString(),
    snapshots,
    class_milestones: await listClassMilestones(pool, actor),
    correction_audit: await listCorrections(pool, actor),
  };
}

async function loadClassLeaderboard(
  target: DbPool | Queryable,
  actor: PortalActorContext,
): Promise<ClassLeaderboardSummary> {
  assertActorCanReadClassBoard(actor);
  const control = await target.query(
    `SELECT board_key, class_series_key, title, publication_state, updated_at
       FROM onetime.classroom_leaderboard_publication_controls
      WHERE account_key = $1
        AND product_key = $2
      ORDER BY updated_at DESC, board_key DESC
      LIMIT 1`,
    [actor.account_key, actor.product_key],
  );
  const controlRow = control.rows[0] as Record<string, unknown> | undefined;
  const published = controlRow?.publication_state === 'published';
  const entries =
    published || actor.actor_role === 'owner' || actor.actor_role === 'admin'
      ? await loadClassLeaderboardEntries(target, actor)
      : [];
  return {
    board_key: controlRow ? String(controlRow.board_key) : 'leaderboard_one_time_daily',
    class_series_key: controlRow
      ? String(controlRow.class_series_key)
      : 'class_series_one_time_daily',
    title: controlRow ? String(controlRow.title) : 'Daily One Time Mishnayos',
    scope: 'authenticated_class_only',
    time_basis: 'all_time_no_reset',
    published,
    actual_names_visible: true,
    negative_labels_present: false,
    ai_judgment_present: false,
    corrected_by_rabbi_audit_available: true,
    updated_at: toNullableIso(controlRow?.updated_at),
    entries,
  };
}

async function loadClassLeaderboardEntries(
  target: DbPool | Queryable,
  actor: PortalActorContext,
): Promise<ClassLeaderboardSummary['entries']> {
  const result = await target.query(
    `WITH event_totals AS (
       SELECT learner_key,
              COALESCE(sum(points_delta), 0)::int AS points,
              COALESCE(sum(CASE WHEN reason_code IN ('lesson_completed', 'mishnah_completed') AND points_delta > 0 THEN 1 ELSE 0 END), 0)::int AS completed_lessons,
              COALESCE(sum(CASE WHEN reason_code IN ('question_approved', 'excellent_question') AND points_delta > 0 THEN 1 ELSE 0 END), 0)::int AS approved_questions,
              COALESCE(sum(CASE WHEN reason_code = 'excellent_question' AND points_delta > 0 THEN 1 ELSE 0 END), 0)::int AS excellent_questions,
              COALESCE(sum(CASE WHEN reason_code = 'consistency_bonus' AND points_delta > 0 THEN 1 ELSE 0 END), 0)::int AS consistency_bonus_count,
              max(occurred_at) AS last_activity_at
         FROM onetime.portal_reward_events
        WHERE account_key = $1
          AND product_key = $2
        GROUP BY learner_key
     ),
     attendance_totals AS (
       SELECT learner_key,
              count(DISTINCT occurrence_key)::int AS attendance_count,
              max(recorded_at) AS last_attendance_at
         FROM onetime.class_attendance_marks
        WHERE account_key = $1
          AND product_key = $2
          AND attendance_state = 'present'
        GROUP BY learner_key
     )
     SELECT learners.learner_key,
            learners.display_name,
            COALESCE(event_totals.points, 0)::int AS points,
            COALESCE(attendance_totals.attendance_count, 0)::int AS attendance_count,
            COALESCE(event_totals.completed_lessons, 0)::int AS completed_lessons,
            COALESCE(event_totals.approved_questions, 0)::int AS approved_questions,
            COALESCE(event_totals.excellent_questions, 0)::int AS excellent_questions,
            COALESCE(event_totals.consistency_bonus_count, 0)::int AS consistency_bonus_count,
            COALESCE(event_totals.last_activity_at, attendance_totals.last_attendance_at) AS last_activity_at
       FROM onetime.portal_learners AS learners
       JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = learners.account_key
        AND access_state.product_key = learners.product_key
        AND access_state.learner_key = learners.learner_key
        AND access_state.status = 'active'
       LEFT JOIN event_totals
         ON event_totals.learner_key = learners.learner_key
       LEFT JOIN attendance_totals
         ON attendance_totals.learner_key = learners.learner_key
      WHERE learners.account_key = $1
        AND learners.product_key = $2
        AND learners.learner_status = 'active'
      ORDER BY COALESCE(event_totals.points, 0) DESC,
               COALESCE(event_totals.last_activity_at, attendance_totals.last_attendance_at) DESC NULLS LAST,
               learners.display_name ASC
      LIMIT 50`,
    [actor.account_key, actor.product_key],
  );
  return result.rows.map((row) => {
    const learnerKey = String(row.learner_key);
    return {
      learner_key: learnerKey,
      display_name: String(row.display_name),
      points: Math.max(0, Number(row.points)),
      attendance_count: Number(row.attendance_count),
      completed_lessons: Number(row.completed_lessons),
      approved_questions: Number(row.approved_questions),
      excellent_questions: Number(row.excellent_questions),
      consistency_bonus_count: Number(row.consistency_bonus_count),
      last_activity_at: toNullableIso(row.last_activity_at),
      ...(actor.actor_role === 'student'
        ? { own_entry: actor.student_learner?.learner_key === learnerKey }
        : {}),
    };
  });
}

async function findLearner(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await target.query(
    `SELECT learner_key, household_key, display_name, hebrew_name, grade_label,
            learner_status, version, created_at, updated_at
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapLearner(row) : null;
}

async function lockLearner(
  client: Queryable,
  actor: PortalActorContext,
  learnerKey: string,
): Promise<LearnerProfile> {
  const result = await client.query(
    `SELECT learner_key, household_key, display_name, hebrew_name, grade_label,
            learner_status, version, created_at, updated_at
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      FOR UPDATE`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
  return mapLearner(row);
}

async function listRewardEvents(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await target.query(
    `SELECT reward_event_key, learner_key, points_delta, reason_code, reason_label,
            actor_ref, source_type, correction_of_event_key, occurred_at
       FROM onetime.portal_reward_events
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      ORDER BY occurred_at DESC, reward_event_key DESC
      LIMIT 80`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  return result.rows
    .map((row) => mapRewardEvent(row as Record<string, unknown>))
    .filter((event) => GAMIFICATION_REASON_CODES.has(event.reason_code));
}

async function listAttendanceDates(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await target.query(
    `SELECT recorded_at
       FROM onetime.class_attendance_marks
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND attendance_state = 'present'
      ORDER BY recorded_at ASC`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  return result.rows.map((row) => toIso((row as Record<string, unknown>).recorded_at));
}

async function countClassTotal(target: DbPool | Queryable, actor: PortalActorContext) {
  const result = await target.query(
    `SELECT count(*)::int AS count
       FROM onetime.class_occurrences
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_state <> 'cancelled'`,
    [actor.account_key, actor.product_key],
  );
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

async function countReviewItems(target: DbPool | Queryable, actor: PortalActorContext) {
  const result = await target.query(
    `SELECT count(*)::int AS count
       FROM onetime.content_items
      WHERE account_key = $1
        AND product_key = $2
        AND item_type IN ('sheet', 'review')
        AND retention_state = 'active'
        AND (lifecycle_state = 'published' OR published_revision_key IS NOT NULL)`,
    [actor.account_key, actor.product_key],
  );
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

async function countAnsweredQuestions(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await target.query(
    `SELECT count(*)::int AS count
       FROM onetime.portal_student_questions
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND question_status = 'answered'`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

async function listParentRewards(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await target.query(
    `SELECT reward_goal_key, learner_key, title, description, points_required, status,
            created_by_parent_ref, earned_at, fulfilled_at
       FROM onetime.portal_parent_reward_goals
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND status <> 'archived'
      ORDER BY created_at DESC, reward_goal_key DESC
      LIMIT 20`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  return result.rows.map((row) => mapParentReward(row as Record<string, unknown>));
}

async function listClassMilestones(target: DbPool | Queryable, actor: PortalActorContext) {
  const result = await target.query(
    `SELECT class_milestone_key, title, description, progress_current, progress_target,
            status, earned_at
       FROM onetime.portal_class_milestones
      WHERE account_key = $1
        AND product_key = $2
      ORDER BY updated_at DESC, class_milestone_key DESC
      LIMIT 40`,
    [actor.account_key, actor.product_key],
  );
  return result.rows.map((row) => mapClassMilestone(row as Record<string, unknown>));
}

async function listCorrections(target: DbPool | Queryable, actor: PortalActorContext) {
  const result = await target.query(
    `SELECT correction_key, learner_key, corrected_event_key, reversal_event_key,
            reason, actor_ref, created_at
       FROM onetime.portal_gamification_corrections
      WHERE account_key = $1
        AND product_key = $2
      ORDER BY created_at DESC, correction_key DESC
      LIMIT 100`,
    [actor.account_key, actor.product_key],
  );
  return result.rows.map((row) => mapCorrection(row as Record<string, unknown>));
}

async function readIdempotency<T>(
  client: Queryable,
  actor: PortalActorContext,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
) {
  const existing = await client.query(
    `SELECT request_hash, response_json
       FROM onetime.portal_mutation_idempotency_records
      WHERE account_key = $1
        AND product_key = $2
        AND actor_user_ref = $3
        AND operation_scope = $4
        AND idempotency_key = $5
      FOR UPDATE`,
    [actor.account_key, actor.product_key, actor.actor_user_ref, operationScope, idempotencyKey],
  );
  const row = existing.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.request_hash) !== requestHash) {
    throw new PortalServiceError(
      'IDEMPOTENCY_CONFLICT',
      'This request key was already used for different information.',
    );
  }
  return row.response_json as T;
}

async function writeIdempotency(
  client: Queryable,
  actor: PortalActorContext,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
  response: unknown,
) {
  await client.query(
    `INSERT INTO onetime.portal_mutation_idempotency_records
     (account_key, product_key, actor_user_ref, operation_scope, idempotency_key, request_hash, response_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (account_key, product_key, actor_user_ref, operation_scope, idempotency_key)
     DO NOTHING`,
    [
      actor.account_key,
      actor.product_key,
      actor.actor_user_ref,
      operationScope,
      idempotencyKey,
      requestHash,
      JSON.stringify(response),
    ],
  );
}

async function recordAudit(
  target: Queryable,
  record: {
    action_type: string;
    actor: PortalActorContext;
    household_key?: string;
    learner_key?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await target.query(
    `INSERT INTO onetime.portal_audit_actions
     (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
      learner_key, action_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      `portal_audit_${randomUUID()}`,
      record.actor.account_key,
      record.actor.product_key,
      record.actor.actor_user_ref,
      record.actor.actor_role,
      record.household_key ?? null,
      record.learner_key ?? null,
      record.action_type,
      JSON.stringify(record.metadata ?? {}),
    ],
  );
}

function assertActorCanReadLearner(
  actor: PortalActorContext,
  learner: Pick<LearnerProfile, 'learner_key' | 'household_key'>,
) {
  if (actor.actor_role === 'student') {
    if (actor.student_learner?.learner_key !== learner.learner_key) {
      throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
    }
    return;
  }
  if (actor.actor_role === 'parent') {
    const authorized = actor.authorized_households.some(
      (subject) =>
        subject.household_key === learner.household_key && subject.authority !== 'support_only',
    );
    if (!authorized) {
      throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
    }
    return;
  }
  if (actor.actor_role === 'owner' || actor.actor_role === 'admin') return;
  throw new PortalServiceError('FORBIDDEN', 'This session cannot view learning progress.');
}

function assertActorCanReadClassBoard(actor: PortalActorContext) {
  if (actor.actor_role === 'student' && actor.student_learner) return;
  if (actor.actor_role === 'parent' && actor.authorized_households.length > 0) return;
  if (actor.actor_role === 'owner' || actor.actor_role === 'admin') return;
  throw new PortalServiceError('FORBIDDEN', 'Class leaderboard requires a portal session.');
}

function assertActorCanAdminLearner(
  actor: PortalActorContext,
  _learner: Pick<LearnerProfile, 'learner_key' | 'household_key'>,
) {
  if (actor.actor_role === 'owner' || actor.actor_role === 'admin') return;
  throw new PortalServiceError('FORBIDDEN', 'Gamification administration requires owner/admin.');
}

function mapLearner(row: Record<string, unknown>): LearnerProfile {
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    display_name: String(row.display_name),
    hebrew_name: nullableString(row.hebrew_name),
    grade_label: nullableString(row.grade_label),
    learner_status: row.learner_status as LearnerProfile['learner_status'],
    version: Number(row.version),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function mapRewardEvent(row: Record<string, unknown>): GamificationEventRow {
  return {
    reward_event_key: String(row.reward_event_key),
    learner_key: String(row.learner_key),
    points_delta: Number(row.points_delta),
    reason_code: row.reason_code as GamificationReasonCode,
    reason_label: String(row.reason_label),
    actor_ref: String(row.actor_ref),
    source_type: row.source_type as GamificationEventRow['source_type'],
    correction_of_event_key: nullableString(row.correction_of_event_key),
    occurred_at: toIso(row.occurred_at),
  };
}

function mapParentReward(row: Record<string, unknown>): ParentRewardGoal {
  return {
    reward_goal_key: String(row.reward_goal_key),
    learner_key: String(row.learner_key),
    title: String(row.title),
    description: nullableString(row.description),
    points_required: Number(row.points_required),
    status: row.status as ParentRewardGoal['status'],
    created_by_parent_ref: String(row.created_by_parent_ref),
    earned_at: toNullableIso(row.earned_at),
    fulfilled_at: toNullableIso(row.fulfilled_at),
  };
}

function mapClassMilestone(row: Record<string, unknown>): ClassMilestone {
  return {
    class_milestone_key: String(row.class_milestone_key),
    title: String(row.title),
    description: String(row.description),
    progress_current: Number(row.progress_current),
    progress_target: Number(row.progress_target),
    status: row.status as ClassMilestone['status'],
    earned_at: toNullableIso(row.earned_at),
  };
}

function mapCorrection(row: Record<string, unknown>): GamificationCorrectionAudit {
  return {
    correction_key: String(row.correction_key),
    learner_key: String(row.learner_key),
    corrected_event_key: String(row.corrected_event_key),
    reversal_event_key: String(row.reversal_event_key),
    reason: String(row.reason),
    actor_ref: String(row.actor_ref),
    created_at: toIso(row.created_at),
  };
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function toNullableIso(value: unknown) {
  return value ? toIso(value) : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function gamificationDigestForTests(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
