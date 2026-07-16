import { createHash, randomUUID } from 'node:crypto';
import type { ActionGatewayEventV1 } from '../../../contracts/src/index.ts';
import type { ClassroomAttendanceEventPayload } from '../../../contracts/src/classroom/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import {
  CLASSROOM_POLICY_VERSION,
  type ClassroomEligibility,
  type ClassroomLaunchGrantRecord,
  type ClassroomOccurrenceRecord,
  type ClassroomRepository,
} from '../../../domain/src/classroom/service.ts';
import {
  ONE_TIME_CLASS_SERIES_KEY,
  ONE_TIME_CLASS_TITLE,
} from '../../../domain/src/classes/service.ts';
import { stableKey } from '../../../domain/src/lead/normalize.ts';
import { PortalServiceError } from '../../../domain/src/portals/services.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export function createClassroomRepository(pool: DbPool): ClassroomRepository {
  return {
    ensureDailyOccurrence: (args) => ensureDailyOccurrence(pool, args),
    getOccurrence: (args) => getOccurrence(pool, args.actor, args.occurrence_key),
    getLearnerEligibility: (args) => getLearnerEligibility(pool, args.actor, args.learner_key),
    issueLaunchGrant: (args) => issueLaunchGrant(pool, args),
    consumeLaunchGrant: (args) => consumeLaunchGrant(pool, args),
    upsertAttendanceAttempt: (args) => upsertAttendanceAttempt(pool, args),
    recordAttendanceEvent: (args) => recordAttendanceEvent(pool, args.actor, args.payload),
    submitQuestion: (args) => submitQuestion(pool, args),
    listOwnQuestions: (args) => listOwnQuestions(pool, args),
    moderateQuestion: (args) => moderateQuestion(pool, args),
    enqueueActionGatewayEvent: (args) =>
      enqueueActionGatewayEvent(pool, args.event, args.actor_principal_id, args.actor_role),
    scheduleDueReminders: (args) => scheduleDueReminders(pool, args),
    recordAudit: (args) => recordAudit(pool, args),
  };
}

async function ensureDailyOccurrence(
  pool: DbPool,
  args: Parameters<ClassroomRepository['ensureDailyOccurrence']>[0],
) {
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

    const startsAt = args.window.startsAt;
    const reminderDueAt = args.window.reminderDueAt;
    const scheduledEndsAt = new Date(startsAt.getTime() + args.durationMinutes * 60_000);
    const joinOpensAt = new Date(startsAt.getTime() - args.joinOpenOffsetMinutes * 60_000);
    const joinClosesAt = new Date(scheduledEndsAt.getTime() + args.joinCloseOffsetMinutes * 60_000);
    const occurrenceKey = stableKey('class_occurrence', [
      args.actor.account_key,
      args.actor.product_key,
      ONE_TIME_CLASS_SERIES_KEY,
      args.window.localDate,
    ]);
    await client.query(
      `INSERT INTO onetime.class_occurrences
         (occurrence_key, account_key, product_key, class_series_key, local_class_date,
          starts_at, reminder_due_at, joinable_until, join_opens_at, scheduled_ends_at,
          join_closes_at, duration_minutes, timezone_snapshot, classroom_policy_version,
          occurrence_state, reminder_state, access_state)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, 'Asia/Jerusalem',
          $13, 'scheduled', 'pending', 'ready')
       ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
       DO NOTHING`,
      [
        occurrenceKey,
        args.actor.account_key,
        args.actor.product_key,
        ONE_TIME_CLASS_SERIES_KEY,
        args.window.localDate,
        startsAt,
        reminderDueAt,
        joinClosesAt,
        joinOpensAt,
        scheduledEndsAt,
        joinClosesAt,
        args.durationMinutes,
        CLASSROOM_POLICY_VERSION,
      ],
    );
    const occurrence = await getOccurrence(client, args.actor, occurrenceKey);
    if (!occurrence) throw new Error('Failed to create classroom occurrence.');
    return occurrence;
  });
}

async function getOccurrence(
  target: DbPool | Queryable,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  occurrenceKey: string,
): Promise<ClassroomOccurrenceRecord | null> {
  const result = await target.query(
    `SELECT occurrences.*, series.title, series.timezone
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
  return row ? mapOccurrence(row) : null;
}

async function getLearnerEligibility(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
): Promise<ClassroomEligibility | null> {
  const result = await target.query(
    `SELECT learners.account_key, learners.product_key, learners.household_key,
            learners.learner_key, learners.display_name, learners.learner_status,
            households.status AS household_status,
            access_state.status AS student_access_status,
            entitlement.entitlement_state
       FROM onetime.portal_learners AS learners
       JOIN onetime.portal_households AS households
         ON households.account_key = learners.account_key
        AND households.product_key = learners.product_key
        AND households.household_key = learners.household_key
       LEFT JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = learners.account_key
        AND access_state.product_key = learners.product_key
        AND access_state.learner_key = learners.learner_key
       LEFT JOIN onetime.classroom_household_entitlements AS entitlement
         ON entitlement.account_key = learners.account_key
        AND entitlement.product_key = learners.product_key
        AND entitlement.household_key = learners.household_key
      WHERE learners.account_key = $1
        AND learners.product_key = $2
        AND learners.learner_key = $3
      ORDER BY access_state.created_at DESC NULLS LAST
      LIMIT 1`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const [activeCount, consent] = await Promise.all([
    target.query(
      `SELECT count(*)::int AS active_learner_count
         FROM onetime.portal_learners
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND learner_status = 'active'`,
      [actor.account_key, actor.product_key, String(row.household_key)],
    ),
    target.query(
      `SELECT consent_status
         FROM onetime.portal_guardian_consents
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND consent_type = 'classroom_join'
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [actor.account_key, actor.product_key, String(row.household_key)],
    ),
  ]);
  return mapEligibility({
    ...row,
    active_learner_count: activeCount.rows[0]?.active_learner_count ?? 0,
    consent_status: consent.rows[0]?.consent_status ?? 'not_required',
  });
}

async function issueLaunchGrant(
  pool: DbPool,
  args: Parameters<ClassroomRepository['issueLaunchGrant']>[0],
) {
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.classroom_launch_grants
        WHERE account_key = $1
          AND product_key = $2
          AND actor_user_ref = $3
          AND occurrence_key = $4
          AND learner_key = $5
          AND idempotency_key = $6
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.actor.actor_user_ref,
        args.occurrence.occurrence_key,
        args.eligibility.learner_key,
        args.idempotency_key,
      ],
    );
    const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
    if (existingRow) {
      if (String(existingRow.request_hash) !== args.request_hash) {
        throw new PortalServiceError(
          'IDEMPOTENCY_CONFLICT',
          'This classroom request key was already used for different information.',
        );
      }
      const status = String(existingRow.status);
      if (status === 'revoked') {
        throw new PortalServiceError('FORBIDDEN', 'The classroom launch reference is revoked.');
      }
      if (status === 'consumed') {
        throw new PortalServiceError(
          'LAUNCH_EXPIRED',
          'That classroom launch was already used. Return to the student portal to rejoin.',
        );
      }
      if (status === 'expired' || new Date(String(existingRow.expires_at)) <= args.now) {
        await client.query(
          `UPDATE onetime.classroom_launch_grants
              SET status = 'expired'
            WHERE grant_key = $1
              AND status = 'issued'`,
          [String(existingRow.grant_key)],
        );
        throw new PortalServiceError(
          'LAUNCH_EXPIRED',
          'That classroom launch expired. Return to the student portal to rejoin.',
        );
      }
      return mapGrant(existingRow);
    }

    const inserted = await client.query(
      `INSERT INTO onetime.classroom_launch_grants
         (grant_key, secret_digest, account_key, product_key, household_key, learner_key,
          occurrence_key, actor_user_ref, session_key_digest, idempotency_key, request_hash,
          provider_mode, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        args.grant_key,
        args.secret_digest,
        args.actor.account_key,
        args.actor.product_key,
        args.eligibility.household_key,
        args.eligibility.learner_key,
        args.occurrence.occurrence_key,
        args.actor.actor_user_ref,
        args.session_key_digest,
        args.idempotency_key,
        args.request_hash,
        args.provider_mode,
        args.expires_at,
      ],
    );
    return mapGrant(inserted.rows[0] as Record<string, unknown>);
  });
}

async function consumeLaunchGrant(
  pool: DbPool,
  args: Parameters<ClassroomRepository['consumeLaunchGrant']>[0],
) {
  return inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.classroom_launch_grants
          SET status = 'expired'
        WHERE account_key = $1
          AND product_key = $2
          AND grant_key = $3
          AND status = 'issued'
          AND expires_at <= $4`,
      [args.actor.account_key, args.actor.product_key, args.grant_key, args.now],
    );
    const consumed = await client.query(
      `UPDATE onetime.classroom_launch_grants
          SET status = 'consumed',
              consumed_at = COALESCE(consumed_at, now())
        WHERE account_key = $1
          AND product_key = $2
          AND grant_key = $3
          AND secret_digest = $4
          AND actor_user_ref = $5
          AND session_key_digest = $6
          AND status = 'issued'
          AND expires_at > $7
        RETURNING *`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.grant_key,
        args.secret_digest,
        args.actor.actor_user_ref,
        args.session_key_digest,
        args.now,
      ],
    );
    if (consumed.rows[0]) return mapGrant(consumed.rows[0] as Record<string, unknown>);
    const current = await client.query(
      `SELECT *
         FROM onetime.classroom_launch_grants
        WHERE account_key = $1
          AND product_key = $2
          AND grant_key = $3
        LIMIT 1`,
      [args.actor.account_key, args.actor.product_key, args.grant_key],
    );
    const currentRow = current.rows[0] as Record<string, unknown> | undefined;
    if (!currentRow) return null;
    if (
      String(currentRow.secret_digest) !== args.secret_digest ||
      String(currentRow.actor_user_ref) !== args.actor.actor_user_ref ||
      String(currentRow.session_key_digest) !== args.session_key_digest
    ) {
      return null;
    }
    const status = String(currentRow.status);
    if (status === 'consumed' || status === 'expired') {
      throw new PortalServiceError(
        'LAUNCH_EXPIRED',
        'That classroom launch expired. Return to the student portal to rejoin.',
      );
    }
    if (status === 'revoked') {
      throw new PortalServiceError('FORBIDDEN', 'The classroom launch reference is revoked.');
    }
    return null;
  });
}

async function upsertAttendanceAttempt(
  pool: DbPool,
  args: Parameters<ClassroomRepository['upsertAttendanceAttempt']>[0],
) {
  const attemptKey = stableKey('classroom_attempt', [args.grant.grant_key]);
  const result = await pool.query(
    `INSERT INTO onetime.classroom_attendance_attempts
       (attempt_key, account_key, product_key, household_key, learner_key, occurrence_key,
        grant_key, selected_view, provider_mode, provider_meeting_ref_digest,
        provider_registrant_ref_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (account_key, product_key, grant_key)
     DO UPDATE SET selected_view = EXCLUDED.selected_view, updated_at = now()
     RETURNING attempt_key, selected_view`,
    [
      attemptKey,
      args.grant.account_key,
      args.grant.product_key,
      args.grant.household_key,
      args.grant.learner_key,
      args.grant.occurrence_key,
      args.grant.grant_key,
      args.selected_view,
      args.grant.provider_mode,
      args.provider_meeting_ref_digest,
      args.provider_registrant_ref_digest,
    ],
  );
  const row = result.rows[0] as Record<string, unknown>;
  return {
    attempt_key: String(row.attempt_key),
    selected_view: row.selected_view as 'client' | 'component',
  };
}

async function recordAttendanceEvent(
  pool: DbPool,
  actor: PortalActorContext,
  payload: ClassroomAttendanceEventPayload,
) {
  await inTransaction(pool, async (client) => {
    const attempt = await client.query(
      `SELECT attempts.*
         FROM onetime.classroom_attendance_attempts AS attempts
         JOIN onetime.classroom_launch_grants AS grants
           ON grants.grant_key = attempts.grant_key
        WHERE attempts.account_key = $1
          AND attempts.product_key = $2
          AND attempts.attempt_key = $3
          AND grants.actor_user_ref = $4
        FOR UPDATE`,
      [actor.account_key, actor.product_key, payload.attempt_key, actor.actor_user_ref],
    );
    const row = attempt.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new PortalServiceError('NOT_FOUND', 'The classroom attendance attempt was not found.');
    }
    await client.query(
      `INSERT INTO onetime.classroom_attendance_events
         (attendance_event_key, account_key, product_key, attempt_key, learner_key,
          occurrence_key, event_type, idempotency_key, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (account_key, product_key, attempt_key, idempotency_key)
       DO NOTHING`,
      [
        stableKey('classroom_attendance_event', [String(row.attempt_key), payload.idempotency_key]),
        actor.account_key,
        actor.product_key,
        String(row.attempt_key),
        String(row.learner_key),
        String(row.occurrence_key),
        payload.event_type,
        payload.idempotency_key,
        JSON.stringify({ client_state: payload.client_state ?? null }),
      ],
    );
    await client.query(
      `UPDATE onetime.classroom_attendance_attempts
          SET status = $4,
              retry_count = CASE WHEN $4 = 'joining' THEN retry_count ELSE retry_count END,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND attempt_key = $3`,
      [
        actor.account_key,
        actor.product_key,
        payload.attempt_key,
        statusForAttendanceEvent(payload.event_type),
      ],
    );
  });
}

async function submitQuestion(
  pool: DbPool,
  args: Parameters<ClassroomRepository['submitQuestion']>[0],
) {
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.classroom_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
          AND occurrence_key = $4
          AND idempotency_key = $5
        FOR UPDATE`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.eligibility.learner_key,
        args.occurrence.occurrence_key,
        args.idempotency_key,
      ],
    );
    const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
    if (existingRow) {
      if (String(existingRow.request_hash) !== args.request_hash) {
        throw new PortalServiceError(
          'IDEMPOTENCY_CONFLICT',
          'This question request key was already used for different information.',
        );
      }
      return { question: mapQuestion(existingRow), replay: true };
    }
    const inserted = await client.query(
      `INSERT INTO onetime.classroom_student_questions
         (question_key, account_key, product_key, household_key, learner_key, occurrence_key,
          body_ciphertext, body_digest, excerpt_redacted, idempotency_key, request_hash,
          submitted_by_user_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        args.question_key,
        args.actor.account_key,
        args.actor.product_key,
        args.eligibility.household_key,
        args.eligibility.learner_key,
        args.occurrence.occurrence_key,
        args.body_ciphertext,
        args.body_digest,
        args.excerpt_redacted,
        args.idempotency_key,
        args.request_hash,
        args.actor.actor_user_ref,
      ],
    );
    return { question: mapQuestion(inserted.rows[0] as Record<string, unknown>), replay: false };
  });
}

async function listOwnQuestions(
  pool: DbPool,
  args: Parameters<ClassroomRepository['listOwnQuestions']>[0],
) {
  const result = await pool.query(
    `SELECT *
       FROM onetime.classroom_student_questions
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
        AND occurrence_key = $4
      ORDER BY submitted_at DESC, question_key DESC
      LIMIT 20`,
    [args.actor.account_key, args.actor.product_key, args.learner_key, args.occurrence_key],
  );
  return result.rows.map((row) => mapQuestion(row as Record<string, unknown>));
}

async function moderateQuestion(
  pool: DbPool,
  args: Parameters<ClassroomRepository['moderateQuestion']>[0],
) {
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT questions.*
         FROM onetime.classroom_question_moderation_actions AS actions
         JOIN onetime.classroom_student_questions AS questions
           ON questions.question_key = actions.question_key
        WHERE actions.question_key = $1
          AND actions.action_type = $2
          AND actions.idempotency_key = $3
        LIMIT 1`,
      [args.question_key, args.action_type, args.idempotency_key],
    );
    if (existing.rows[0]) return mapQuestion(existing.rows[0] as Record<string, unknown>);

    const locked = await client.query(
      `SELECT *
         FROM onetime.classroom_student_questions
        WHERE question_key = $1
        FOR UPDATE`,
      [args.question_key],
    );
    const row = locked.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new PortalServiceError('NOT_FOUND', 'The classroom question was not found.');
    const nextStatus =
      args.action_type === 'feature_next'
        ? 'featured'
        : args.action_type === 'mark_answered'
          ? 'answered'
          : 'dismissed';
    const updated = await client.query(
      `UPDATE onetime.classroom_student_questions
          SET status = $2,
              selected_at = CASE WHEN $2 = 'featured' THEN COALESCE(selected_at, now()) ELSE selected_at END,
              selected_by_user_ref = CASE WHEN $2 = 'featured' THEN $3 ELSE selected_by_user_ref END,
              selection_revision = CASE WHEN $2 = 'featured' THEN selection_revision + 1 ELSE selection_revision END
        WHERE question_key = $1
        RETURNING *`,
      [args.question_key, nextStatus, args.actor_user_ref],
    );
    const question = mapQuestion(updated.rows[0] as Record<string, unknown>);
    await client.query(
      `INSERT INTO onetime.classroom_question_moderation_actions
         (moderation_action_key, account_key, product_key, question_key, occurrence_key,
          action_type, actor_user_ref, actor_role, idempotency_key, result_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (account_key, product_key, question_key, action_type, idempotency_key)
       DO NOTHING`,
      [
        stableKey('classroom_question_action', [
          args.question_key,
          args.action_type,
          args.idempotency_key,
        ]),
        String(row.account_key),
        String(row.product_key),
        args.question_key,
        String(row.occurrence_key),
        args.action_type,
        args.actor_user_ref,
        args.actor_role,
        args.idempotency_key,
        JSON.stringify({ status: question.status }),
      ],
    );
    return question;
  });
}

async function enqueueActionGatewayEvent(
  pool: DbPool,
  event: ActionGatewayEventV1,
  actorPrincipalId: string,
  actorRole: string,
) {
  const result = await pool.query(
    `INSERT INTO onetime.action_gateway_event_outbox
       (event_id, event_type, source, subject, account_key, product_key, actor_principal_id,
        actor_role, transport, correlation_id, causation_id, idempotency_key, event_json,
        event_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
     ON CONFLICT (account_key, product_key, event_type, idempotency_key)
     DO NOTHING`,
    [
      event.id,
      event.type,
      event.source,
      event.subject,
      event.scope.account_id,
      event.scope.product_id,
      actorPrincipalId,
      actorRole,
      event.actor.transport,
      event.correlation_id,
      event.causation_id ?? null,
      event.idempotency_key,
      JSON.stringify(event),
      digest(JSON.stringify(event)),
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

async function scheduleDueReminders(
  pool: DbPool,
  args: Parameters<ClassroomRepository['scheduleDueReminders']>[0],
) {
  if (args.now < new Date(args.occurrence.reminder_due_at)) return { queued: 0, suppressed: 0 };
  const candidates = await pool.query(
    `SELECT learners.household_key,
            learners.learner_key,
            COALESCE(preferences.preference_state, 'opted_in') AS preference_state,
            COALESCE(preferences.suppression_state, 'active') AS suppression_state,
            consent.consent_status
       FROM onetime.portal_learners AS learners
       JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = learners.account_key
        AND access_state.product_key = learners.product_key
        AND access_state.learner_key = learners.learner_key
        AND access_state.status = 'active'
       JOIN onetime.classroom_household_entitlements AS entitlement
         ON entitlement.account_key = learners.account_key
        AND entitlement.product_key = learners.product_key
        AND entitlement.household_key = learners.household_key
        AND entitlement.entitlement_state = 'active'
       LEFT JOIN onetime.classroom_reminder_preferences AS preferences
         ON preferences.account_key = learners.account_key
        AND preferences.product_key = learners.product_key
        AND preferences.learner_key = learners.learner_key
        AND preferences.channel = 'portal'
       LEFT JOIN onetime.portal_guardian_consents AS consent
         ON consent.account_key = learners.account_key
        AND consent.product_key = learners.product_key
        AND consent.household_key = learners.household_key
        AND consent.consent_type = 'classroom_join'
        AND consent.superseded_at IS NULL
      WHERE learners.account_key = $1
        AND learners.product_key = $2
        AND learners.learner_status = 'active'`,
    [args.actor.account_key, args.actor.product_key],
  );
  let queued = 0;
  let suppressed = 0;
  for (const row of candidates.rows as Array<Record<string, unknown>>) {
    const consentStatus = String(row.consent_status ?? 'not_required');
    const preferenceState = String(row.preference_state);
    const suppressionState = String(row.suppression_state);
    const consentAllowsReminder = consentStatus === 'not_required' || consentStatus === 'granted';
    if (!consentAllowsReminder || preferenceState !== 'opted_in' || suppressionState !== 'active') {
      suppressed += 1;
      continue;
    }
    const result = await pool.query(
      `INSERT INTO onetime.classroom_reminder_intents
         (reminder_key, account_key, product_key, household_key, learner_key, occurrence_key,
          channel, idempotency_key, due_at, next_attempt_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'portal',$7,$8,$9,$10::jsonb)
       ON CONFLICT (account_key, product_key, learner_key, occurrence_key, channel)
       DO NOTHING`,
      [
        stableKey('classroom_reminder', [
          String(row.learner_key),
          args.occurrence.occurrence_key,
          'portal',
        ]),
        args.actor.account_key,
        args.actor.product_key,
        String(row.household_key),
        String(row.learner_key),
        args.occurrence.occurrence_key,
        stableKey('classroom_reminder_idem', [
          String(row.learner_key),
          args.occurrence.occurrence_key,
          'portal',
        ]),
        args.occurrence.reminder_due_at,
        args.now,
        JSON.stringify({
          external_send_performed: false,
          reminder_delivery_port: 'sink',
          consent_status: consentStatus,
          preference_state: preferenceState,
          suppression_state: suppressionState,
        }),
      ],
    );
    queued += result.rowCount ?? 0;
  }
  return { queued, suppressed };
}

async function recordAudit(
  target: DbPool | Queryable,
  args: Parameters<ClassroomRepository['recordAudit']>[0],
) {
  await target.query(
    `INSERT INTO onetime.classroom_audit_events
       (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
        learner_key, occurrence_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      `classroom_audit_${randomUUID()}`,
      args.actor.account_key,
      args.actor.product_key,
      args.actor.actor_user_ref,
      args.actor.actor_role,
      args.household_key ?? null,
      args.learner_key ?? null,
      args.occurrence_key ?? null,
      args.event_type,
      JSON.stringify(args.metadata ?? {}),
    ],
  );
}

function mapOccurrence(row: Record<string, unknown>): ClassroomOccurrenceRecord {
  const startsAt = toIso(row.starts_at);
  const joinClosesAt = toNullableIso(row.join_closes_at) ?? toIso(row.joinable_until);
  return {
    occurrence_key: String(row.occurrence_key),
    class_series_key: String(row.class_series_key),
    title: String(row.title),
    local_class_date: localDateFromRow(row.local_class_date),
    timezone: 'Asia/Jerusalem',
    starts_at: startsAt,
    reminder_due_at: toIso(row.reminder_due_at),
    join_opens_at:
      toNullableIso(row.join_opens_at) ??
      new Date(new Date(startsAt).getTime() - 15 * 60_000).toISOString(),
    scheduled_ends_at:
      toNullableIso(row.scheduled_ends_at) ??
      new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString(),
    join_closes_at: joinClosesAt,
    occurrence_state: row.occurrence_state as ClassroomOccurrenceRecord['occurrence_state'],
    access_state: String(row.access_state),
  };
}

function mapEligibility(row: Record<string, unknown>): ClassroomEligibility {
  const consent = String(row.consent_status ?? 'not_required');
  return {
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    display_name: String(row.display_name),
    learner_status: row.learner_status as ClassroomEligibility['learner_status'],
    household_status: row.household_status as ClassroomEligibility['household_status'],
    student_access_status: nullableString(row.student_access_status),
    entitlement_state: nullableString(
      row.entitlement_state,
    ) as ClassroomEligibility['entitlement_state'],
    consent_status:
      consent === 'granted' || consent === 'revoked'
        ? consent
        : consent === 'missing'
          ? 'missing'
          : 'not_required',
    active_learner_count: Number(row.active_learner_count ?? 0),
  };
}

function mapGrant(row: Record<string, unknown>): ClassroomLaunchGrantRecord {
  return {
    grant_key: String(row.grant_key),
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    occurrence_key: String(row.occurrence_key),
    actor_user_ref: String(row.actor_user_ref),
    session_key_digest: String(row.session_key_digest),
    status: row.status as ClassroomLaunchGrantRecord['status'],
    idempotency_key: String(row.idempotency_key),
    provider_mode: row.provider_mode as ClassroomLaunchGrantRecord['provider_mode'],
    expires_at: toIso(row.expires_at),
    consumed_at: toNullableIso(row.consumed_at),
  };
}

function mapQuestion(row: Record<string, unknown>) {
  return {
    question_key: String(row.question_key),
    occurrence_key: String(row.occurrence_key),
    learner_key: String(row.learner_key),
    status: row.status as 'new' | 'featured' | 'answered' | 'dismissed',
    excerpt_redacted: String(row.excerpt_redacted),
    submitted_at: toIso(row.submitted_at),
    selected_at: toNullableIso(row.selected_at),
  };
}

function statusForAttendanceEvent(eventType: ClassroomAttendanceEventPayload['event_type']) {
  if (eventType === 'sdk_joined') return 'joined';
  if (eventType === 'sdk_left') return 'left';
  if (eventType === 'retry' || eventType === 'sdk_join_started') return 'joining';
  return 'bootstrap_issued';
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

function localDateFromRow(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
