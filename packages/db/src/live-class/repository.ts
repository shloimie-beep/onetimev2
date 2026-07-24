import type {
  LiveClassControlCommand,
  LiveClassObsScene,
  LiveClassParticipant,
  LiveClassQuestion,
  LiveClassStageState,
} from '../../../contracts/src/live-class/index.ts';
import {
  CLASSROOM_POLICY_VERSION,
  type LiveClassCommandInsert,
  LIVE_CLASS_STAGE_SURFACE_LABEL,
  type LiveClassLearnerRecord,
  type LiveClassRepository,
  type LiveClassSessionRecord,
  zoomCustomerKey,
} from '../../../domain/src/index.ts';
import {
  ONE_TIME_CLASS_SERIES_KEY,
  ONE_TIME_CLASS_TITLE,
} from '../../../domain/src/classes/service.ts';
import { stableKey } from '../../../domain/src/lead/normalize.ts';
import { PortalServiceError } from '../../../domain/src/portals/services.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export function createLiveClassRepository(pool: DbPool): LiveClassRepository {
  return {
    ensureLiveSession: (args) => ensureLiveSession(pool, args),
    ensureFakeDemo: (args) => ensureFakeDemo(pool, args),
    getLearner: (args) => getLearner(pool, args),
    submitQuestion: (args) => submitQuestion(pool, args),
    listQuestions: (args) => listQuestions(pool, args),
    listOwnQuestions: (args) => listOwnQuestions(pool, args),
    getQuestion: (args) => getQuestion(pool, args),
    getParticipantByCustomerKey: (args) => getParticipantByCustomerKey(pool, args),
    getParticipantByKey: (args) => getParticipantByKey(pool, args),
    listParticipants: (args) => listParticipants(pool, args),
    upsertParticipant: (args) => upsertParticipant(pool, args),
    selectQuestion: (args) => selectQuestion(pool, args),
    markStudentReady: (args) => markStudentReady(pool, args),
    markQuestionLive: (args) => markQuestionLive(pool, args),
    completeQuestion: (args) => completeQuestion(pool, args),
    setStage: (args) => setStage(pool, args),
    getStage: (args) => getStage(pool, args),
    enqueueCommand: (args) => enqueueCommand(pool, args),
    listPendingCommands: (args) => listPendingCommands(pool, args),
    listPendingZoomCommands: (args) => listPendingZoomCommands(pool, args),
    reportCommand: (args) => reportCommand(pool, args),
    recordAudit: (args) => recordAudit(pool, args),
  };
}

async function ensureLiveSession(
  pool: DbPool,
  args: Parameters<LiveClassRepository['ensureLiveSession']>[0],
): Promise<LiveClassSessionRecord> {
  return inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.class_series
         (class_series_key, account_key, product_key, title, timezone, local_start_time,
          reminder_local_time)
       VALUES ($1, $2, $3, $4, 'Asia/Jerusalem', '19:00', '18:30')
       ON CONFLICT (account_key, product_key, class_series_key)
       DO UPDATE SET updated_at = now()`,
      [
        ONE_TIME_CLASS_SERIES_KEY,
        args.actor.account_key,
        args.actor.product_key,
        ONE_TIME_CLASS_TITLE,
      ],
    );

    let occurrence = await getOccurrence(client, args.actor, args.occurrence_key);
    if (!occurrence && !args.occurrence_key) {
      const localDate = localDateJerusalem(args.now);
      const startsAt = new Date(`${localDate}T16:00:00.000Z`);
      const occurrenceKey = stableKey('class_occurrence', [
        args.actor.account_key,
        args.actor.product_key,
        ONE_TIME_CLASS_SERIES_KEY,
        localDate,
      ]);
      await client.query(
        `INSERT INTO onetime.class_occurrences
           (occurrence_key, account_key, product_key, class_series_key, local_class_date,
            starts_at, reminder_due_at, joinable_until, join_opens_at, scheduled_ends_at,
            join_closes_at, duration_minutes, timezone_snapshot, classroom_policy_version,
            occurrence_state, reminder_state, access_state)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, 60,
            'Asia/Jerusalem', $12, 'live', 'pending', 'ready')
         ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
         DO UPDATE SET access_state = 'ready', occurrence_state = 'live', updated_at = now()`,
        [
          occurrenceKey,
          args.actor.account_key,
          args.actor.product_key,
          ONE_TIME_CLASS_SERIES_KEY,
          localDate,
          startsAt,
          new Date(startsAt.getTime() - 30 * 60_000),
          new Date(startsAt.getTime() + 75 * 60_000),
          new Date(startsAt.getTime() - 15 * 60_000),
          new Date(startsAt.getTime() + 60 * 60_000),
          new Date(startsAt.getTime() + 75 * 60_000),
          CLASSROOM_POLICY_VERSION,
        ],
      );
      occurrence = await getOccurrence(client, args.actor, occurrenceKey);
    }
    if (!occurrence && args.occurrence_key) {
      throw new PortalServiceError('NOT_FOUND', 'The live class occurrence was not found.');
    }
    if (!occurrence) {
      throw new Error('Failed to create live class occurrence.');
    }

    const stageSession = stableKey('live_stage', [
      args.actor.account_key,
      args.actor.product_key,
      occurrence.occurrence_key,
    ]);
    await client.query(
      `INSERT INTO onetime.live_class_stage_sessions
         (stage_session_key, account_key, product_key, occurrence_key, stage_secret_digest,
          expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_key, product_key, occurrence_key)
       DO UPDATE SET expires_at = EXCLUDED.expires_at, updated_at = now()`,
      [
        stageSession,
        args.actor.account_key,
        args.actor.product_key,
        occurrence.occurrence_key,
        stableKey('live_stage_secret_digest', [stageSession]),
        args.expires_at,
      ],
    );
    return {
      occurrence_key: occurrence.occurrence_key,
      class_label: occurrence.title,
      stage_session: stageSession,
    };
  });
}

async function ensureFakeDemo(
  pool: DbPool,
  args: Parameters<LiveClassRepository['ensureFakeDemo']>[0],
) {
  await inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES
         ('live_demo_household_1', $1, $2, 'Live Demo 1'),
         ('live_demo_household_2', $1, $2, 'Live Demo 2'),
         ('live_demo_household_3', $1, $2, 'Live Demo 3')
       ON CONFLICT (account_key, product_key, household_key)
       DO NOTHING`,
      [args.actor.account_key, args.actor.product_key],
    );
    await client.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, grade_label)
       VALUES
         ('live_demo_learner_1', $1, $2, 'live_demo_household_1', 'Student 1', 'Demo'),
         ('live_demo_learner_2', $1, $2, 'live_demo_household_2', 'Student 2', 'Demo'),
         ('live_demo_learner_3', $1, $2, 'live_demo_household_3', 'Student 3', 'Demo')
       ON CONFLICT (account_key, product_key, learner_key)
       DO NOTHING`,
      [args.actor.account_key, args.actor.product_key],
    );

    for (const item of demoQuestions(args.occurrence_key, args.class_label)) {
      await client.query(
        `INSERT INTO onetime.live_class_questions
           (question_key, account_key, product_key, household_key, learner_key, occurrence_key,
            approved_display_name, question_body_digest, question_preview, status, readiness,
            mic_ready, video_ready, customer_key, class_label, selected_at, student_ready_at,
            idempotency_key, request_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (account_key, product_key, learner_key, occurrence_key, idempotency_key)
         DO UPDATE SET
           customer_key = EXCLUDED.customer_key,
           updated_at = now(),
           revision = onetime.live_class_questions.revision + 1
         WHERE onetime.live_class_questions.customer_key <> EXCLUDED.customer_key`,
        [
          item.question_key,
          args.actor.account_key,
          args.actor.product_key,
          item.household_key,
          item.learner_key,
          args.occurrence_key,
          item.approved_display_name,
          item.question_body_digest,
          item.question_preview,
          item.status,
          item.readiness,
          item.status === 'student_ready',
          item.status === 'student_ready',
          item.customer_key,
          item.class_label,
          item.status === 'student_ready' ? args.now : null,
          item.status === 'student_ready' ? args.now : null,
          item.idempotency_key,
          item.request_hash,
        ],
      );
      await client.query(
        `DELETE FROM onetime.live_class_participants
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3
            AND learner_key = $4
            AND customer_key <> $5`,
        [
          args.actor.account_key,
          args.actor.product_key,
          args.occurrence_key,
          item.learner_key,
          item.customer_key,
        ],
      );
      await upsertParticipant(client, {
        actor: args.actor,
        occurrence_key: args.occurrence_key,
        participant_key: stableKey('zoom_participant', [args.occurrence_key, item.customer_key]),
        learner_key: item.learner_key,
        customer_key: item.customer_key,
        approved_display_name: item.approved_display_name,
        join_state: item.join_state,
        audio_state: item.audio_state,
        video_state: item.video_state,
        active_speaker: false,
        spotlighted: false,
      });
    }
    const selectedDemo = demoQuestions(args.occurrence_key, args.class_label).find(
      (item) => item.status === 'student_ready',
    );
    if (selectedDemo) {
      await client.query(
        `UPDATE onetime.live_class_stage_sessions
            SET current_question_key = COALESCE(current_question_key, $4),
                current_scene = CASE WHEN current_question_key IS NULL THEN 'OT - Slides' ELSE current_scene END,
                updated_at = now()
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3`,
        [
          args.actor.account_key,
          args.actor.product_key,
          args.occurrence_key,
          selectedDemo.question_key,
        ],
      );
    }
  });
}

async function getLearner(
  pool: DbPool,
  args: Parameters<LiveClassRepository['getLearner']>[0],
): Promise<LiveClassLearnerRecord | null> {
  const result = await pool.query(
    `SELECT household_key, learner_key, display_name
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND learner_status = 'active'
      LIMIT 1`,
    [args.actor.account_key, args.actor.product_key, args.learner_key],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    display_name: String(row.display_name),
  };
}

async function submitQuestion(
  pool: DbPool,
  args: Parameters<LiveClassRepository['submitQuestion']>[0],
) {
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.live_class_questions
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
          AND occurrence_key = $4
          AND idempotency_key = $5
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.learner.learner_key,
        args.occurrence_key,
        args.idempotency_key,
      ],
    );
    const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
    if (existingRow) {
      if (String(existingRow.request_hash) !== args.request_hash) {
        throw new PortalServiceError(
          'IDEMPOTENCY_CONFLICT',
          'This live question key was already used for different information.',
        );
      }
      return { question: mapQuestion(existingRow), replay: true };
    }
    const inserted = await client.query(
      `INSERT INTO onetime.live_class_questions
         (question_key, account_key, product_key, household_key, learner_key, occurrence_key,
          approved_display_name, question_body_ciphertext, question_body_digest, question_preview,
          customer_key, class_label, idempotency_key, request_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        args.question_key,
        args.actor.account_key,
        args.actor.product_key,
        args.learner.household_key,
        args.learner.learner_key,
        args.occurrence_key,
        args.approved_display_name,
        args.question_body_ciphertext,
        args.question_body_digest,
        args.question_preview,
        args.customer_key,
        args.class_label,
        args.idempotency_key,
        args.request_hash,
      ],
    );
    return { question: mapQuestion(inserted.rows[0] as Record<string, unknown>), replay: false };
  });
}

async function listQuestions(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['listQuestions']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_questions
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
      ORDER BY
        CASE status
          WHEN 'live' THEN 1
          WHEN 'student_ready' THEN 2
          WHEN 'selected' THEN 3
          WHEN 'submitted' THEN 4
          ELSE 5
        END,
        created_at DESC`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key],
  );
  return result.rows.map((row) => mapQuestion(row as Record<string, unknown>));
}

async function listOwnQuestions(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['listOwnQuestions']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_questions
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND occurrence_key = $4
      ORDER BY created_at DESC
      LIMIT 20`,
    [args.actor.account_key, args.actor.product_key, args.learner_key, args.occurrence_key],
  );
  return result.rows.map((row) => mapQuestion(row as Record<string, unknown>));
}

async function getQuestion(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['getQuestion']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_questions
      WHERE account_key = $1
        AND product_key = $2
        AND question_key = $3
      LIMIT 1`,
    [args.actor.account_key, args.actor.product_key, args.question_key],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapQuestion(row) : null;
}

async function getParticipantByCustomerKey(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['getParticipantByCustomerKey']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_participants
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND customer_key = $4
      LIMIT 1`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key, args.customer_key],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapParticipant(row) : null;
}

async function getParticipantByKey(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['getParticipantByKey']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_participants
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND participant_key = $4
      LIMIT 1`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key, args.participant_key],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapParticipant(row) : null;
}

async function listParticipants(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['listParticipants']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_participants
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
      ORDER BY updated_at DESC, participant_key`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key],
  );
  return result.rows.map((row) => mapParticipant(row as Record<string, unknown>));
}

async function upsertParticipant(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['upsertParticipant']>[0],
) {
  const result = await target.query(
    `INSERT INTO onetime.live_class_participants
       (participant_key, account_key, product_key, occurrence_key, learner_key, customer_key,
        participant_id_digest, approved_display_name, join_state, audio_state, video_state,
        active_speaker, spotlighted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (account_key, product_key, occurrence_key, customer_key)
     DO UPDATE SET
       learner_key = EXCLUDED.learner_key,
       participant_id_digest = COALESCE(EXCLUDED.participant_id_digest,
         onetime.live_class_participants.participant_id_digest),
       approved_display_name = EXCLUDED.approved_display_name,
       join_state = EXCLUDED.join_state,
       audio_state = EXCLUDED.audio_state,
       video_state = EXCLUDED.video_state,
       active_speaker = EXCLUDED.active_speaker,
       spotlighted = EXCLUDED.spotlighted,
       event_revision = onetime.live_class_participants.event_revision + 1,
       updated_at = now()
     RETURNING *`,
    [
      args.participant_key,
      args.actor.account_key,
      args.actor.product_key,
      args.occurrence_key,
      args.learner_key,
      args.customer_key,
      args.participant_id_digest ?? null,
      args.approved_display_name,
      args.join_state,
      args.audio_state,
      args.video_state,
      args.active_speaker,
      args.spotlighted,
    ],
  );
  return mapParticipant(result.rows[0] as Record<string, unknown>);
}

async function selectQuestion(
  pool: DbPool,
  args: Parameters<LiveClassRepository['selectQuestion']>[0],
) {
  return inTransaction(pool, async (client) => {
    const row = await lockQuestion(client, args.actor, args.question_key);
    if (isTerminalStatus(String(row.status))) {
      throw new PortalServiceError('VALIDATION_ERROR', 'That question is already closed.');
    }
    await client.query(
      `UPDATE onetime.live_class_questions
          SET status = 'submitted',
              readiness = 'pending',
              mic_ready = false,
              video_ready = false,
              updated_at = now(),
              revision = revision + 1
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
          AND question_key <> $4
          AND status IN ('selected', 'student_ready', 'live')`,
      [
        args.actor.account_key,
        args.actor.product_key,
        String(row.occurrence_key),
        args.question_key,
      ],
    );
    const updated = await client.query(
      `UPDATE onetime.live_class_questions
          SET status = 'selected',
              readiness = 'pending',
              mic_ready = false,
              video_ready = false,
              selected_at = COALESCE(selected_at, $4),
              selected_by_user_ref = $5,
              revision = revision + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
       RETURNING *`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.question_key,
        args.now,
        args.actor.actor_user_ref,
      ],
    );
    return mapQuestion(updated.rows[0] as Record<string, unknown>);
  });
}

async function markStudentReady(
  pool: DbPool,
  args: Parameters<LiveClassRepository['markStudentReady']>[0],
) {
  return inTransaction(pool, async (client) => {
    const row = await lockQuestion(client, args.actor, args.question_key);
    if (String(row.learner_key) !== args.actor.student_learner?.learner_key) {
      throw new PortalServiceError('FORBIDDEN', 'This student cannot ready that question.');
    }
    if (String(row.status) !== 'selected' && String(row.status) !== 'student_ready') {
      throw new PortalServiceError('VALIDATION_ERROR', 'The Rabbi must select the question first.');
    }
    const updated = await client.query(
      `UPDATE onetime.live_class_questions
          SET status = CASE WHEN $4 THEN 'student_ready' ELSE 'selected' END,
              readiness = CASE WHEN $4 THEN 'ready' ELSE 'declined' END,
              mic_ready = $5,
              video_ready = $6,
              student_ready_at = CASE WHEN $4 THEN COALESCE(student_ready_at, $7) ELSE student_ready_at END,
              revision = revision + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
       RETURNING *`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.question_key,
        args.ready,
        args.mic_ready,
        args.video_ready,
        args.now,
      ],
    );
    return mapQuestion(updated.rows[0] as Record<string, unknown>);
  });
}

async function markQuestionLive(
  pool: DbPool,
  args: Parameters<LiveClassRepository['markQuestionLive']>[0],
) {
  return inTransaction(pool, async (client) => {
    const row = await lockQuestion(client, args.actor, args.question_key);
    if (String(row.status) !== 'student_ready') {
      throw new PortalServiceError('VALIDATION_ERROR', 'The student is not ready yet.');
    }
    const updated = await client.query(
      `UPDATE onetime.live_class_questions
          SET status = 'live',
              live_at = COALESCE(live_at, $4),
              revision = revision + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
       RETURNING *`,
      [args.actor.account_key, args.actor.product_key, args.question_key, args.now],
    );
    return mapQuestion(updated.rows[0] as Record<string, unknown>);
  });
}

async function completeQuestion(
  pool: DbPool,
  args: Parameters<LiveClassRepository['completeQuestion']>[0],
) {
  return inTransaction(pool, async (client) => {
    await lockQuestion(client, args.actor, args.question_key);
    const updated = await client.query(
      `UPDATE onetime.live_class_questions
          SET status = $4,
              completed_at = COALESCE(completed_at, $5),
              completed_by_user_ref = $6,
              revision = revision + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
       RETURNING *`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.question_key,
        args.resolution,
        args.now,
        args.actor.actor_user_ref,
      ],
    );
    return mapQuestion(updated.rows[0] as Record<string, unknown>);
  });
}

async function setStage(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['setStage']>[0],
) {
  await target.query(
    `UPDATE onetime.live_class_stage_sessions
        SET current_question_key = $4,
            current_scene = $5,
            stage_state = $6,
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3`,
    [
      args.actor.account_key,
      args.actor.product_key,
      args.occurrence_key,
      args.question_key,
      args.scene,
      args.state,
    ],
  );
}

async function getStage(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['getStage']>[0],
): Promise<LiveClassStageState | null> {
  const stageResult = await target.query(
    `SELECT *
       FROM onetime.live_class_stage_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND stage_session_key = $3
        AND expires_at > now()
      LIMIT 1`,
    [args.actor.account_key, args.actor.product_key, args.stage_session],
  );
  const stageRow = stageResult.rows[0] as Record<string, unknown> | undefined;
  if (!stageRow) return null;
  const selectedQuestion = stageRow.current_question_key
    ? await getQuestion(target, {
        actor: args.actor,
        question_key: String(stageRow.current_question_key),
      })
    : null;
  const selectedParticipant = selectedQuestion
    ? await getParticipantByCustomerKey(target, {
        actor: args.actor,
        occurrence_key: selectedQuestion.occurrence_key,
        customer_key: selectedQuestion.customer_key,
      })
    : null;
  return {
    stage_session: String(stageRow.stage_session_key),
    occurrence_key: String(stageRow.occurrence_key),
    surface_label: LIVE_CLASS_STAGE_SURFACE_LABEL,
    class_label: selectedQuestion?.class_label ?? ONE_TIME_CLASS_TITLE,
    current_scene: stageRow.current_scene as LiveClassObsScene,
    selected_question: selectedQuestion,
    selected_participant: selectedParticipant,
    mic_ready: selectedQuestion?.mic_ready ?? false,
    video_ready: selectedQuestion?.video_ready ?? false,
    private_portal_visible: false,
  };
}

async function enqueueCommand(
  pool: DbPool,
  args: Parameters<LiveClassRepository['enqueueCommand']>[0],
) {
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.live_class_control_commands
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
          AND command_type = $4
          AND idempotency_key = $5
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.command.occurrence_key,
        args.command.command_type,
        args.command.idempotency_key,
      ],
    );
    const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
    if (existingRow) {
      if (String(existingRow.request_hash) !== args.command.request_hash) {
        throw new PortalServiceError(
          'IDEMPOTENCY_CONFLICT',
          'This live command key was already used for different information.',
        );
      }
      return { command: mapCommand(existingRow), replay: true };
    }
    const inserted = await client.query(
      `INSERT INTO onetime.live_class_control_commands
         (command_key, account_key, product_key, occurrence_key, command_type, target_question_key,
          target_participant_key, obs_scene, idempotency_key, request_hash, nonce, signature,
          expires_at, created_by_user_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      commandParams(args.actor, args.command),
    );
    return { command: mapCommand(inserted.rows[0] as Record<string, unknown>), replay: false };
  });
}

async function listPendingCommands(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['listPendingCommands']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_control_commands
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND command_status = 'queued'
        AND command_type = 'obs_switch_scene'
        AND expires_at > $4
      ORDER BY created_at ASC
      LIMIT 20`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key, args.now],
  );
  return result.rows.map((row) => mapCommand(row as Record<string, unknown>));
}

async function listPendingZoomCommands(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['listPendingZoomCommands']>[0],
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_control_commands
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND command_status = 'queued'
        AND command_type IN ('ask_unmute','mute','spotlight_replace','spotlight_remove','stop_video')
        AND expires_at > $4
      ORDER BY created_at ASC
      LIMIT 20`,
    [args.actor.account_key, args.actor.product_key, args.occurrence_key, args.now],
  );
  return result.rows.map((row) => mapCommand(row as Record<string, unknown>));
}

async function reportCommand(
  pool: DbPool,
  args: Parameters<LiveClassRepository['reportCommand']>[0],
) {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT *
         FROM onetime.live_class_control_commands
        WHERE account_key = $1
          AND product_key = $2
          AND command_key = $3
          AND nonce = $4
          AND signature = $5
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.payload.command_key,
        args.payload.nonce,
        args.payload.signature,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row || String(row.command_status) !== 'queued') return null;
    if (new Date(String(row.expires_at)).getTime() <= args.now.getTime()) {
      await client.query(
        `UPDATE onetime.live_class_control_commands
            SET command_status = 'expired', updated_at = now()
          WHERE command_key = $1`,
        [args.payload.command_key],
      );
      return null;
    }
    const updated = await client.query(
      `UPDATE onetime.live_class_control_commands
          SET command_status = $2,
              executed_at = CASE WHEN $2 = 'executed' THEN $3 ELSE executed_at END,
              result_json = $4::jsonb,
              updated_at = now()
        WHERE command_key = $1
      RETURNING *`,
      [
        args.payload.command_key,
        args.payload.status,
        args.now,
        JSON.stringify({ result: args.payload.result ?? '' }),
      ],
    );
    return mapCommand(updated.rows[0] as Record<string, unknown>);
  });
}

async function recordAudit(
  target: DbPool | Queryable,
  args: Parameters<LiveClassRepository['recordAudit']>[0],
) {
  await target.query(
    `INSERT INTO onetime.live_class_audit_events
       (audit_key, account_key, product_key, actor_user_ref, actor_role, occurrence_key,
        learner_key, question_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      stableKey('live_audit', [
        args.actor.account_key,
        args.actor.product_key,
        args.actor.actor_user_ref,
        args.event_type,
        new Date().toISOString(),
      ]),
      args.actor.account_key,
      args.actor.product_key,
      args.actor.actor_user_ref,
      args.actor.actor_role,
      args.occurrence_key ?? null,
      args.learner_key ?? null,
      args.question_key ?? null,
      args.event_type,
      JSON.stringify(args.metadata ?? {}),
    ],
  );
}

async function lockQuestion(
  target: Queryable,
  actor: { account_key: string; product_key: string },
  questionKey: string,
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.live_class_questions
      WHERE account_key = $1
        AND product_key = $2
        AND question_key = $3
      FOR UPDATE`,
    [actor.account_key, actor.product_key, questionKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PortalServiceError('NOT_FOUND', 'The live question was not found.');
  return row;
}

async function getOccurrence(
  target: Queryable,
  actor: { account_key: string; product_key: string },
  occurrenceKey?: string | undefined,
) {
  if (!occurrenceKey) return null;
  const result = await target.query(
    `SELECT occurrences.occurrence_key, series.title
       FROM onetime.class_occurrences AS occurrences
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE occurrences.account_key = $1
        AND occurrences.product_key = $2
        AND occurrences.occurrence_key = $3
      LIMIT 1`,
    [actor.account_key, actor.product_key, occurrenceKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? { occurrence_key: String(row.occurrence_key), title: String(row.title) } : null;
}

function demoQuestions(occurrenceKey: string, classLabel: string) {
  return [
    {
      question_key: stableKey('live_question', [occurrenceKey, 'demo-1']),
      household_key: 'live_demo_household_1',
      learner_key: 'live_demo_learner_1',
      approved_display_name: 'Student 1',
      question_preview: 'Can the Rabbi explain why this Mishnah uses that example?',
      status: 'student_ready',
      readiness: 'ready',
      join_state: 'joined' as const,
      audio_state: 'muted' as const,
      video_state: 'on' as const,
      idempotency_key: 'live-demo-question-1',
    },
    {
      question_key: stableKey('live_question', [occurrenceKey, 'demo-2']),
      household_key: 'live_demo_household_2',
      learner_key: 'live_demo_learner_2',
      approved_display_name: 'Student 2',
      question_preview: 'What is the practical difference between the two opinions?',
      status: 'submitted',
      readiness: 'pending',
      join_state: 'joined' as const,
      audio_state: 'muted' as const,
      video_state: 'off' as const,
      idempotency_key: 'live-demo-question-2',
    },
    {
      question_key: stableKey('live_question', [occurrenceKey, 'demo-3']),
      household_key: 'live_demo_household_3',
      learner_key: 'live_demo_learner_3',
      approved_display_name: 'Student 3',
      question_preview: 'Where do we see this idea again later in the perek?',
      status: 'submitted',
      readiness: 'pending',
      join_state: 'left' as const,
      audio_state: 'muted' as const,
      video_state: 'off' as const,
      idempotency_key: 'live-demo-question-3',
    },
  ].map((item) => ({
    ...item,
    occurrence_key: occurrenceKey,
    class_label: classLabel,
    customer_key: zoomCustomerKey([occurrenceKey, item.learner_key]),
    question_body_digest: stableKey('live_question_digest', [occurrenceKey, item.question_preview]),
    request_hash: stableKey('live_question_request', [occurrenceKey, item.idempotency_key]),
  }));
}

function commandParams(
  actor: { account_key: string; product_key: string },
  command: LiveClassCommandInsert,
) {
  return [
    command.command_key,
    actor.account_key,
    actor.product_key,
    command.occurrence_key,
    command.command_type,
    command.target_question_key,
    command.target_participant_key,
    command.obs_scene,
    command.idempotency_key,
    command.request_hash,
    command.nonce,
    command.signature,
    command.expires_at,
    command.created_by_user_ref,
  ];
}

function mapQuestion(row: Record<string, unknown>): LiveClassQuestion {
  return {
    question_key: String(row.question_key),
    occurrence_key: String(row.occurrence_key),
    learner_key: String(row.learner_key),
    approved_display_name: String(row.approved_display_name),
    question_preview: String(row.question_preview),
    status: row.status as LiveClassQuestion['status'],
    readiness: row.readiness as LiveClassQuestion['readiness'],
    mic_ready: Boolean(row.mic_ready),
    video_ready: Boolean(row.video_ready),
    customer_key: String(row.customer_key),
    class_label: nullableString(row.class_label),
    selected_at: nullableIso(row.selected_at),
    student_ready_at: nullableIso(row.student_ready_at),
    live_at: nullableIso(row.live_at),
    completed_at: nullableIso(row.completed_at),
    revision: Number(row.revision ?? 1),
  };
}

function mapParticipant(row: Record<string, unknown>): LiveClassParticipant {
  return {
    participant_key: String(row.participant_key),
    learner_key: nullableString(row.learner_key),
    approved_display_name: String(row.approved_display_name),
    customer_key: String(row.customer_key),
    join_state: row.join_state as LiveClassParticipant['join_state'],
    audio_state: row.audio_state as LiveClassParticipant['audio_state'],
    video_state: row.video_state as LiveClassParticipant['video_state'],
    active_speaker: Boolean(row.active_speaker),
    spotlighted: Boolean(row.spotlighted),
    updated_at: toIso(row.updated_at),
  };
}

function mapCommand(row: Record<string, unknown>): LiveClassControlCommand {
  return {
    command_key: String(row.command_key),
    occurrence_key: String(row.occurrence_key),
    command_type: row.command_type as LiveClassControlCommand['command_type'],
    command_status: row.command_status as LiveClassControlCommand['command_status'],
    target_question_key: nullableString(row.target_question_key),
    target_participant_key: nullableString(row.target_participant_key),
    obs_scene: nullableString(row.obs_scene) as LiveClassObsScene | null,
    nonce: String(row.nonce),
    signature: String(row.signature),
    expires_at: toIso(row.expires_at),
    created_at: toIso(row.created_at),
  };
}

function isTerminalStatus(status: string) {
  return ['answered', 'approved_for_board', 'kept_private', 'rejected'].includes(status);
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function nullableIso(value: unknown) {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

function localDateJerusalem(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
