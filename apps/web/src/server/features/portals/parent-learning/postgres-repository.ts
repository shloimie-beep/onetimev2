import { createHash } from 'node:crypto';
import {
  PARENT_LEARNING_ERROR_CODES,
  type ParentAttendanceWrite,
  type ParentContentProgressWrite,
  type ParentLearningMutationOperation,
  type ParentLearningMutationReceipt,
  type ParentLearningContentProgressTarget,
  type ParentLearningLibraryItem,
  type ParentLearningNextClass,
  type ParentLearningPrincipal,
  type ParentLearningRecord,
  type ParentLearningRepository,
  type ParentQuestionWrite,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { ParentLearningError } from '../../../../../../../packages/domain/src/portals/parent-learning/index.ts';

type Row = Record<string, unknown>;

const GOVERNED_CONTENT_DURATION_SQL = `COALESCE(
  CASE
    WHEN factory.source_key IS NOT NULL
      AND factory.prepared_duration_ms BETWEEN 1 AND 9007199254740991
      THEN factory.prepared_duration_ms::bigint
    ELSE NULL
  END,
  CASE
    WHEN source.source_key IS NOT NULL
      AND source.duration_ms BETWEEN 1 AND 9007199254740991
      THEN source.duration_ms::bigint
    ELSE NULL
  END
)`;

export type ParentLearningPostgresOptions = {
  accountKey: string;
  productionBasicMeetingRefDigest?: string | null;
  clock?: () => Date;
};

export function createPostgresParentLearningRepository(
  pool: DbPool,
  options: ParentLearningPostgresOptions,
): ParentLearningRepository {
  const accountKey = required(options.accountKey, 'Parent learning account scope');
  const productionBasicMeetingRefDigest = optionalDigest(
    options.productionBasicMeetingRefDigest,
    'production-basic meeting reference',
  );
  const clock = options.clock ?? (() => new Date());

  return {
    async loadOwnedParticipant(principal) {
      const observedAt = clock();
      const result = await pool.query(
        `SELECT participant.participant_id,
                participant.adult_id,
                participant.human_account_id,
                participant.household_id,
                participant.state AS participant_state,
                participant.learner_ordinal,
                adult.display_name,
                (SELECT count(*)::int
                   FROM onetime.v21_student_profiles AS child_student
                  WHERE child_student.household_id = household.household_id
                    AND child_student.product_key = household.product_key
                    AND child_student.runtime_tier = household.runtime_tier
                    AND child_student.verification_environment_id =
                        household.verification_environment_id
                    AND child_student.relationship = 'dependent'
                    AND child_student.state = 'active') AS active_seat_count,
                entitlement.account_key,
                entitlement.class_series_key,
                entitlement.effective_at,
                series.title AS class_title,
                next_occurrence.occurrence_key AS next_occurrence_id,
                next_occurrence.starts_at AS next_starts_at,
                next_occurrence.scheduled_ends_at AS next_ends_at,
                next_occurrence.join_opens_at AS next_join_opens_at,
                 next_occurrence.join_closes_at AS next_join_closes_at,
                 next_occurrence.occurrence_state AS next_state,
                 next_occurrence.production_basic_live_confirmed_at AS next_live_confirmed_at,
                 next_occurrence.production_basic_live_expires_at AS next_live_expires_at,
                 next_occurrence.production_basic_meeting_ref_digest AS next_live_meeting_ref_digest,
                (SELECT count(DISTINCT attendance.occurrence_id)::int
                   FROM onetime.parent_learning_attendance_events AS attendance
                  WHERE attendance.participant_id = participant.participant_id
                    AND attendance.event_kind = 'joined') AS attended_occurrence_count,
                (SELECT count(DISTINCT progress.content_id)::int
                   FROM onetime.parent_learning_content_progress_events AS progress
                  WHERE progress.participant_id = participant.participant_id) AS started_content_count,
                (SELECT count(DISTINCT progress.content_id)::int
                   FROM onetime.parent_learning_content_progress_events AS progress
                  WHERE progress.participant_id = participant.participant_id
                    AND progress.completed = true) AS completed_content_count,
                (SELECT count(*)::int
                   FROM onetime.parent_learning_questions AS question
                  WHERE question.participant_id = participant.participant_id) AS submitted_question_count
           FROM onetime.parent_learning_participants AS participant
           JOIN onetime.v21_households AS household
             ON household.household_id = participant.household_id
            AND household.owner_adult_id = participant.adult_id
            AND household.owner_human_account_id = participant.human_account_id
            AND household.product_key = participant.product_key
            AND household.runtime_tier = participant.runtime_tier
            AND household.verification_environment_id = participant.verification_environment_id
            AND household.classification = 'family'
            AND household.state = 'active'
           JOIN onetime.v21_adult_identities AS adult
             ON adult.adult_id = participant.adult_id
            AND adult.product_key = participant.product_key
            AND adult.runtime_tier = participant.runtime_tier
            AND adult.verification_environment_id = participant.verification_environment_id
            AND adult.state = 'active'
           JOIN onetime.canonical_aggregate_states AS access
             ON access.aggregate_kind = 'access'
            AND access.aggregate_key = participant.household_id
            AND access.product_key = participant.product_key
            AND access.runtime_tier = participant.runtime_tier
            AND access.verification_environment_id = participant.verification_environment_id
            AND access.current_state IN ('free', 'active', 'grace')
            AND access.archived_at IS NULL
           JOIN onetime.v21_human_accounts AS account
             ON account.human_account_id = participant.human_account_id
            AND account.adult_id = participant.adult_id
            AND account.product_key = participant.product_key
            AND account.runtime_tier = participant.runtime_tier
            AND account.verification_environment_id = participant.verification_environment_id
            AND account.state = 'active'
           JOIN onetime.v21_human_account_role_memberships AS membership
             ON membership.human_account_id = participant.human_account_id
            AND membership.role = 'parent'
            AND membership.revoked_at IS NULL
            AND membership.product_key = participant.product_key
            AND membership.runtime_tier = participant.runtime_tier
            AND membership.verification_environment_id = participant.verification_environment_id
           JOIN onetime.v21_adult_sessions AS session
             ON session.session_id = $5
            AND session.human_account_id = participant.human_account_id
            AND session.active_role = 'parent'
            AND session.active_household_id = participant.household_id
            AND session.product_key = participant.product_key
            AND session.runtime_tier = participant.runtime_tier
            AND session.verification_environment_id = participant.verification_environment_id
            AND session.revoked_at IS NULL
            AND session.idle_expires_at > $6::timestamptz
            AND session.absolute_expires_at > $6::timestamptz
           JOIN onetime.parent_learning_class_entitlements AS entitlement
             ON entitlement.participant_id = participant.participant_id
            AND entitlement.household_id = participant.household_id
            AND entitlement.product_key = participant.product_key
            AND entitlement.runtime_tier = participant.runtime_tier
            AND entitlement.verification_environment_id = participant.verification_environment_id
            AND entitlement.account_key = $1
            AND entitlement.entitlement_state = 'active'
           JOIN onetime.class_series AS series
             ON series.account_key = entitlement.account_key
            AND series.product_key = entitlement.product_key
            AND series.class_series_key = entitlement.class_series_key
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
           LEFT JOIN LATERAL (
             SELECT occurrence.occurrence_key,
                    occurrence.starts_at,
                    occurrence.scheduled_ends_at,
                    occurrence.join_opens_at,
                     occurrence.join_closes_at,
                     occurrence.occurrence_state,
                     occurrence.production_basic_live_confirmed_at,
                     occurrence.production_basic_live_expires_at,
                     occurrence.production_basic_meeting_ref_digest
               FROM onetime.class_occurrences AS occurrence
              WHERE occurrence.account_key = entitlement.account_key
                AND occurrence.product_key = entitlement.product_key
                AND occurrence.class_series_key = entitlement.class_series_key
                AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
                 AND (
                   occurrence.join_closes_at > $6::timestamptz
                   OR (
                     $7::text IS NOT NULL
                     AND occurrence.production_basic_meeting_ref_digest = $7
                     AND occurrence.production_basic_live_confirmed_at <= $6::timestamptz
                     AND occurrence.production_basic_live_expires_at > $6::timestamptz
                     AND occurrence.production_basic_live_expires_at
                       <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
                   )
                 )
               ORDER BY
                 CASE
                   WHEN $7::text IS NOT NULL
                    AND occurrence.production_basic_meeting_ref_digest = $7
                    AND occurrence.production_basic_live_confirmed_at <= $6::timestamptz
                    AND occurrence.production_basic_live_expires_at > $6::timestamptz
                    AND occurrence.production_basic_live_expires_at
                      <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
                     THEN 0
                   ELSE 1
                 END,
                 occurrence.starts_at,
                 occurrence.occurrence_key
              LIMIT 1
           ) AS next_occurrence ON true
          WHERE participant.participant_id <> ''
            AND participant.participant_kind = 'parent'
            AND participant.learner_ordinal = 1
            AND participant.state = 'active'
            AND participant.adult_id = $2
            AND participant.human_account_id = $3
            AND participant.household_id = $4
          LIMIT 1`,
        [
          accountKey,
          principal.adult_id,
          principal.human_account_id,
          principal.household_id,
          principal.session_id,
          observedAt.toISOString(),
          productionBasicMeetingRefDigest,
        ],
      );
      if ((result.rowCount ?? 0) === 0) return null;
      if (result.rowCount !== 1) invariant('A Parent resolved to multiple learning participants.');
      const row = result.rows[0] as Row;
      const libraryItems = await loadEntitledLibraryItems(pool, {
        accountKey,
        principal,
        participantId: text(row.participant_id, 'Parent participant'),
        observedAt,
      });
      return parentLearningRecord(row, libraryItems, observedAt, productionBasicMeetingRefDigest);
    },

    async loadContentOpenTarget(input) {
      const items = await loadEntitledLibraryItems(pool, {
        accountKey,
        principal: input.principal,
        participantId: input.participant_id,
        observedAt: clock(),
        contentId: input.content_id,
      });
      if (items.length === 0) return null;
      if (items.length !== 1) invariant('Parent content resolved more than once.');
      return {
        content_id: items[0]!.content_id,
        item_type: items[0]!.item_type,
      };
    },

    loadContentProgressTarget: (input) =>
      loadContentProgressTarget(pool, {
        accountKey,
        principal: input.principal,
        participantId: input.participant_id,
        contentId: input.content_id,
        contentVersionId: input.content_version_id,
        observedAt: clock(),
      }),

    recordAttendance: (input) => recordAttendance(pool, accountKey, input),
    recordContentProgress: (input) => recordContentProgress(pool, accountKey, input),
    submitQuestion: (input) => submitQuestion(pool, accountKey, input),
  };
}

async function loadContentProgressTarget(
  pool: DbPool,
  input: {
    accountKey: string;
    principal: ParentLearningPrincipal;
    participantId: string;
    contentId: string;
    contentVersionId: string;
    observedAt: Date;
  },
): Promise<ParentLearningContentProgressTarget | null> {
  const result = await pool.query(
    `SELECT item.content_item_key AS governed_content_id,
            item.published_revision_key AS governed_content_version_id,
            ${GOVERNED_CONTENT_DURATION_SQL} AS governed_duration_ms
       FROM onetime.parent_learning_participants AS participant
       JOIN onetime.v21_households AS household
         ON household.household_id = participant.household_id
        AND household.owner_adult_id = participant.adult_id
        AND household.owner_human_account_id = participant.human_account_id
        AND household.product_key = participant.product_key
        AND household.runtime_tier = participant.runtime_tier
        AND household.verification_environment_id = participant.verification_environment_id
        AND household.classification = 'family'
        AND household.state = 'active'
        AND household.archived_at IS NULL
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = participant.household_id
        AND access.product_key = participant.product_key
        AND access.runtime_tier = participant.runtime_tier
        AND access.verification_environment_id = participant.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace')
        AND access.archived_at IS NULL
       JOIN onetime.parent_learning_class_entitlements AS entitlement
         ON entitlement.participant_id = participant.participant_id
        AND entitlement.household_id = participant.household_id
        AND entitlement.product_key = participant.product_key
        AND entitlement.runtime_tier = participant.runtime_tier
        AND entitlement.verification_environment_id = participant.verification_environment_id
        AND entitlement.account_key = $1
        AND entitlement.entitlement_state = 'active'
        AND entitlement.effective_at <= $7::timestamptz
        AND entitlement.revoked_at IS NULL
       JOIN onetime.class_series AS series
         ON series.account_key = entitlement.account_key
        AND series.product_key = entitlement.product_key
        AND series.class_series_key = entitlement.class_series_key
        AND series.is_canonical = true
        AND series.status = 'active'
        AND series.series_state = 'active'
       JOIN onetime.v21_adult_sessions AS session
         ON session.session_id = $6
        AND session.human_account_id = participant.human_account_id
        AND session.active_role = 'parent'
        AND session.active_household_id = participant.household_id
        AND session.product_key = participant.product_key
        AND session.runtime_tier = participant.runtime_tier
        AND session.verification_environment_id = participant.verification_environment_id
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $7::timestamptz
        AND session.absolute_expires_at > $7::timestamptz
       JOIN onetime.content_items AS item
         ON item.account_key = entitlement.account_key
        AND item.product_key = entitlement.product_key
        AND item.content_item_key = $8
        AND item.published_revision_key = $9
        AND item.lifecycle_state = 'published'
        AND item.retention_state = 'active'
        AND item.item_type = 'video'
        AND item.published_at IS NOT NULL
       JOIN onetime.content_revisions AS revision
         ON revision.account_key = item.account_key
        AND revision.product_key = item.product_key
        AND revision.content_item_key = item.content_item_key
        AND revision.revision_key = item.published_revision_key
        AND revision.lifecycle_state = 'published'
       LEFT JOIN onetime.learning_delivery_content_factory_items AS factory
         ON factory.account_key = item.account_key
        AND factory.product_key = item.product_key
        AND factory.source_key = item.content_item_key
        AND factory.factory_state = 'published'
        AND factory.processing_mode = 'vimeo'
        AND factory.provider_video_id IS NOT NULL
        AND factory.captions_active = true
       LEFT JOIN onetime.ot104r_vimeo_sources AS source
         ON source.source_key = item.content_item_key
        AND source.processing_state IN ('available', 'transcript_ready')
        AND source.privacy_state = 'private'
      WHERE participant.participant_id = $2
        AND participant.adult_id = $3
        AND participant.human_account_id = $4
        AND participant.household_id = $5
        AND participant.participant_kind = 'parent'
        AND participant.learner_ordinal = 1
        AND participant.state = 'active'
        AND participant.archived_at IS NULL
        AND ${GOVERNED_CONTENT_DURATION_SQL} IS NOT NULL
        AND EXISTS (
          SELECT 1
            FROM onetime.content_item_entitlements AS content_entitlement
           WHERE content_entitlement.account_key = item.account_key
             AND content_entitlement.product_key = item.product_key
             AND content_entitlement.content_item_key = item.content_item_key
             AND content_entitlement.entitlement_state = 'active'
             AND content_entitlement.revoked_at IS NULL
             AND (
               content_entitlement.audience = 'all_active_learners'
               OR (
                 content_entitlement.audience = 'household'
                 AND content_entitlement.household_key = participant.household_id
               )
             )
        )
        AND (
          item.occurrence_key IS NULL
          OR EXISTS (
            SELECT 1
              FROM onetime.class_occurrences AS occurrence
             WHERE occurrence.account_key = item.account_key
               AND occurrence.product_key = item.product_key
               AND occurrence.occurrence_key = item.occurrence_key
               AND occurrence.class_series_key = entitlement.class_series_key
          )
        )
      LIMIT 2`,
    [
      input.accountKey,
      input.participantId,
      input.principal.adult_id,
      input.principal.human_account_id,
      input.principal.household_id,
      input.principal.session_id,
      input.observedAt.toISOString(),
      input.contentId,
      input.contentVersionId,
    ],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  if (result.rowCount !== 1) invariant('Parent progress content resolved more than once.');
  const row = result.rows[0] as Row;
  return {
    content_id: text(row.governed_content_id, 'governed content'),
    content_version_id: text(row.governed_content_version_id, 'governed content version'),
    duration_ms: positiveInteger(row.governed_duration_ms, 'governed content duration'),
  };
}

async function loadEntitledLibraryItems(
  pool: DbPool,
  input: {
    accountKey: string;
    principal: ParentLearningPrincipal;
    participantId: string;
    observedAt: Date;
    contentId?: string;
  },
): Promise<ParentLearningLibraryItem[]> {
  const result = await pool.query(
    `SELECT item.content_item_key AS content_id,
            item.published_revision_key AS content_version_id,
            item.title,
            item.item_type,
            item.published_at,
            progress.position_ms,
            progress.duration_ms,
            progress.completed,
            progress.observed_at AS progress_updated_at
       FROM onetime.parent_learning_participants AS participant
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = participant.household_id
        AND access.product_key = participant.product_key
        AND access.runtime_tier = participant.runtime_tier
        AND access.verification_environment_id = participant.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace')
        AND access.archived_at IS NULL
       JOIN onetime.parent_learning_class_entitlements AS parent_entitlement
         ON parent_entitlement.participant_id = participant.participant_id
        AND parent_entitlement.household_id = participant.household_id
        AND parent_entitlement.product_key = participant.product_key
        AND parent_entitlement.runtime_tier = participant.runtime_tier
        AND parent_entitlement.verification_environment_id = participant.verification_environment_id
        AND parent_entitlement.account_key = $1
        AND parent_entitlement.entitlement_state = 'active'
       JOIN onetime.v21_adult_sessions AS session
         ON session.session_id = $6
        AND session.human_account_id = participant.human_account_id
        AND session.active_role = 'parent'
        AND session.active_household_id = participant.household_id
        AND session.product_key = participant.product_key
        AND session.runtime_tier = participant.runtime_tier
        AND session.verification_environment_id = participant.verification_environment_id
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $7::timestamptz
        AND session.absolute_expires_at > $7::timestamptz
       JOIN onetime.content_items AS item
         ON item.account_key = parent_entitlement.account_key
        AND item.product_key = parent_entitlement.product_key
        AND item.lifecycle_state = 'published'
        AND item.retention_state = 'active'
        AND item.item_type = 'video'
        AND item.published_revision_key IS NOT NULL
        AND item.published_at IS NOT NULL
       LEFT JOIN LATERAL (
         SELECT event.position_ms,
                event.duration_ms,
                event.completed,
                event.observed_at
           FROM onetime.parent_learning_content_progress_events AS event
          WHERE event.participant_id = participant.participant_id
            AND event.content_id = item.content_item_key
            AND event.content_version_id = item.published_revision_key
          ORDER BY event.observed_at DESC, event.progress_event_id DESC
          LIMIT 1
       ) AS progress ON true
      WHERE participant.participant_id = $2
        AND participant.adult_id = $3
        AND participant.human_account_id = $4
        AND participant.household_id = $5
        AND participant.participant_kind = 'parent'
        AND participant.learner_ordinal = 1
        AND participant.state = 'active'
        AND ($8::text IS NULL OR item.content_item_key = $8)
        AND EXISTS (
          SELECT 1
            FROM onetime.content_item_entitlements AS content_entitlement
           WHERE content_entitlement.account_key = item.account_key
             AND content_entitlement.product_key = item.product_key
             AND content_entitlement.content_item_key = item.content_item_key
             AND content_entitlement.entitlement_state = 'active'
             AND (
               content_entitlement.audience = 'all_active_learners'
               OR (
                 content_entitlement.audience = 'household'
                 AND content_entitlement.household_key = participant.household_id
               )
             )
        )
        AND (
          item.occurrence_key IS NULL
          OR EXISTS (
            SELECT 1
              FROM onetime.class_occurrences AS occurrence
             WHERE occurrence.account_key = item.account_key
               AND occurrence.product_key = item.product_key
               AND occurrence.occurrence_key = item.occurrence_key
               AND occurrence.class_series_key = parent_entitlement.class_series_key
          )
        )
      ORDER BY item.published_at DESC, item.content_item_key
      LIMIT 25`,
    [
      input.accountKey,
      input.participantId,
      input.principal.adult_id,
      input.principal.human_account_id,
      input.principal.household_id,
      input.principal.session_id,
      input.observedAt.toISOString(),
      input.contentId ?? null,
    ],
  );
  return result.rows.map((row) => parentLearningLibraryItem(row as Row));
}

async function recordAttendance(
  pool: DbPool,
  accountKey: string,
  input: { principal: ParentLearningPrincipal; write: ParentAttendanceWrite },
): Promise<ParentLearningMutationReceipt> {
  const entityId = stableId(
    'parent-attendance',
    input.write.participant_id,
    input.write.context.idempotency_key,
  );
  const result = await pool.query(
    `INSERT INTO onetime.parent_learning_attendance_events
       (attendance_event_id, participant_id, household_id, actor_kind,
        account_key, product_key, runtime_tier, verification_environment_id,
        class_series_key, occurrence_id, event_kind, source,
        connection_lineage_id, source_event_ref_digest, idempotency_key,
        request_hash, observed_at)
     SELECT $1, participant.participant_id, participant.household_id, 'parent',
            entitlement.account_key, participant.product_key, participant.runtime_tier,
            participant.verification_environment_id, entitlement.class_series_key,
            occurrence.occurrence_key, $9, 'embedded_client', $10, $11, $12, $13, $14
       FROM onetime.parent_learning_participants AS participant
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = participant.household_id
        AND access.product_key = participant.product_key
        AND access.runtime_tier = participant.runtime_tier
        AND access.verification_environment_id = participant.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace')
        AND access.archived_at IS NULL
       JOIN onetime.parent_learning_class_entitlements AS entitlement
         ON entitlement.participant_id = participant.participant_id
        AND entitlement.household_id = participant.household_id
        AND entitlement.product_key = participant.product_key
        AND entitlement.runtime_tier = participant.runtime_tier
        AND entitlement.verification_environment_id = participant.verification_environment_id
        AND entitlement.account_key = $7
        AND entitlement.entitlement_state = 'active'
       JOIN onetime.class_occurrences AS occurrence
         ON occurrence.account_key = entitlement.account_key
        AND occurrence.product_key = entitlement.product_key
        AND occurrence.class_series_key = entitlement.class_series_key
        AND occurrence.occurrence_key = $8
       JOIN onetime.v21_adult_sessions AS session
         ON session.session_id = $6
        AND session.human_account_id = participant.human_account_id
        AND session.active_role = 'parent'
        AND session.active_household_id = participant.household_id
        AND session.product_key = participant.product_key
        AND session.runtime_tier = participant.runtime_tier
        AND session.verification_environment_id = participant.verification_environment_id
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $14::timestamptz
        AND session.absolute_expires_at > $14::timestamptz
      WHERE participant.participant_id = $2
        AND participant.adult_id = $3
        AND participant.human_account_id = $4
        AND participant.household_id = $5
        AND participant.participant_kind = 'parent'
        AND participant.state = 'active'
        AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
        AND occurrence.join_opens_at <= $14::timestamptz
        AND occurrence.join_closes_at > $14::timestamptz
        AND (
          $9 = 'joined'
          OR EXISTS (
            SELECT 1
              FROM onetime.parent_learning_attendance_events AS joined
             WHERE joined.participant_id = participant.participant_id
               AND joined.occurrence_id = occurrence.occurrence_key
               AND joined.connection_lineage_id = $10
               AND joined.event_kind = 'joined'
               AND joined.observed_at <= $14::timestamptz
          )
        )
     ON CONFLICT (participant_id, idempotency_key) DO NOTHING
     RETURNING attendance_event_id AS entity_id`,
    [
      entityId,
      input.write.participant_id,
      input.principal.adult_id,
      input.principal.human_account_id,
      input.principal.household_id,
      input.principal.session_id,
      accountKey,
      input.write.occurrence_id,
      input.write.event_kind,
      input.write.connection_lineage_id,
      input.write.source_event_ref_digest,
      input.write.context.idempotency_key,
      input.write.context.canonical_request_hash,
      input.write.context.occurred_at,
    ],
  );
  return insertedOrReplay(pool, {
    result,
    table: 'parent_learning_attendance_events',
    entityColumn: 'attendance_event_id',
    operation: 'attendance_recorded',
    participantId: input.write.participant_id,
    context: input.write.context,
  });
}

async function recordContentProgress(
  pool: DbPool,
  accountKey: string,
  input: { principal: ParentLearningPrincipal; write: ParentContentProgressWrite },
): Promise<ParentLearningMutationReceipt> {
  const entityId = stableId(
    'parent-progress',
    input.write.participant_id,
    input.write.context.idempotency_key,
  );
  const result = await pool.query(
    `WITH authorized_target AS (
       SELECT participant.participant_id,
              participant.household_id,
              participant.product_key,
              participant.runtime_tier,
              participant.verification_environment_id,
              entitlement.account_key,
              entitlement.class_series_key,
              item.content_item_key,
              item.published_revision_key,
              ${GOVERNED_CONTENT_DURATION_SQL} AS governed_duration
         FROM onetime.parent_learning_participants AS participant
         JOIN onetime.v21_households AS household
           ON household.household_id = participant.household_id
          AND household.owner_adult_id = participant.adult_id
          AND household.owner_human_account_id = participant.human_account_id
          AND household.product_key = participant.product_key
          AND household.runtime_tier = participant.runtime_tier
          AND household.verification_environment_id = participant.verification_environment_id
          AND household.classification = 'family'
          AND household.state = 'active'
          AND household.archived_at IS NULL
         JOIN onetime.canonical_aggregate_states AS access
           ON access.aggregate_kind = 'access'
          AND access.aggregate_key = participant.household_id
          AND access.product_key = participant.product_key
          AND access.runtime_tier = participant.runtime_tier
          AND access.verification_environment_id = participant.verification_environment_id
          AND access.current_state IN ('free', 'active', 'grace')
          AND access.archived_at IS NULL
         JOIN onetime.parent_learning_class_entitlements AS entitlement
           ON entitlement.participant_id = participant.participant_id
          AND entitlement.household_id = participant.household_id
          AND entitlement.product_key = participant.product_key
          AND entitlement.runtime_tier = participant.runtime_tier
          AND entitlement.verification_environment_id = participant.verification_environment_id
          AND entitlement.account_key = $7
          AND entitlement.entitlement_state = 'active'
          AND entitlement.effective_at <= $14::timestamptz
          AND entitlement.revoked_at IS NULL
         JOIN onetime.class_series AS series
           ON series.account_key = entitlement.account_key
          AND series.product_key = entitlement.product_key
          AND series.class_series_key = entitlement.class_series_key
          AND series.is_canonical = true
          AND series.status = 'active'
          AND series.series_state = 'active'
         JOIN onetime.v21_adult_sessions AS session
           ON session.session_id = $6
          AND session.human_account_id = participant.human_account_id
          AND session.active_role = 'parent'
          AND session.active_household_id = participant.household_id
          AND session.product_key = participant.product_key
          AND session.runtime_tier = participant.runtime_tier
          AND session.verification_environment_id = participant.verification_environment_id
          AND session.revoked_at IS NULL
          AND session.idle_expires_at > $14::timestamptz
          AND session.absolute_expires_at > $14::timestamptz
         JOIN onetime.content_items AS item
           ON item.account_key = entitlement.account_key
          AND item.product_key = entitlement.product_key
          AND item.content_item_key = $8
          AND item.published_revision_key = $9
          AND item.lifecycle_state = 'published'
          AND item.retention_state = 'active'
          AND item.item_type = 'video'
          AND item.published_at IS NOT NULL
         JOIN onetime.content_revisions AS revision
           ON revision.account_key = item.account_key
          AND revision.product_key = item.product_key
          AND revision.content_item_key = item.content_item_key
          AND revision.revision_key = item.published_revision_key
          AND revision.lifecycle_state = 'published'
         LEFT JOIN onetime.learning_delivery_content_factory_items AS factory
           ON factory.account_key = item.account_key
          AND factory.product_key = item.product_key
          AND factory.source_key = item.content_item_key
          AND factory.factory_state = 'published'
          AND factory.processing_mode = 'vimeo'
          AND factory.provider_video_id IS NOT NULL
          AND factory.captions_active = true
         LEFT JOIN onetime.ot104r_vimeo_sources AS source
           ON source.source_key = item.content_item_key
          AND source.processing_state IN ('available', 'transcript_ready')
          AND source.privacy_state = 'private'
        WHERE participant.participant_id = $2
          AND participant.adult_id = $3
          AND participant.human_account_id = $4
          AND participant.household_id = $5
          AND participant.participant_kind = 'parent'
          AND participant.learner_ordinal = 1
          AND participant.state = 'active'
          AND participant.archived_at IS NULL
          AND EXISTS (
            SELECT 1
              FROM onetime.content_item_entitlements AS content_entitlement
             WHERE content_entitlement.account_key = item.account_key
               AND content_entitlement.product_key = item.product_key
               AND content_entitlement.content_item_key = item.content_item_key
               AND content_entitlement.entitlement_state = 'active'
               AND content_entitlement.revoked_at IS NULL
               AND (
                 content_entitlement.audience = 'all_active_learners'
                 OR (
                   content_entitlement.audience = 'household'
                   AND content_entitlement.household_key = participant.household_id
                 )
               )
          )
          AND (
            item.occurrence_key IS NULL
            OR EXISTS (
              SELECT 1
                FROM onetime.class_occurrences AS occurrence
               WHERE occurrence.account_key = item.account_key
                 AND occurrence.product_key = item.product_key
                 AND occurrence.occurrence_key = item.occurrence_key
                 AND occurrence.class_series_key = entitlement.class_series_key
            )
          )
     )
     INSERT INTO onetime.parent_learning_content_progress_events
       (progress_event_id, participant_id, household_id, actor_kind,
        account_key, product_key, runtime_tier, verification_environment_id,
        class_series_key, content_id, content_version_id, position_ms,
        duration_ms, completed, completed_at, idempotency_key, request_hash,
        observed_at)
     SELECT $1, target.participant_id, target.household_id, 'parent',
            target.account_key, target.product_key, target.runtime_tier,
            target.verification_environment_id, target.class_series_key,
            target.content_item_key, target.published_revision_key, $10,
            target.governed_duration, ($10 = target.governed_duration),
            CASE WHEN $10 = target.governed_duration THEN $14::timestamptz ELSE NULL END,
            $12, $13, $14::timestamptz
       FROM authorized_target AS target
      WHERE target.governed_duration = $11
        AND $10 BETWEEN 0 AND target.governed_duration
     ON CONFLICT (participant_id, idempotency_key) DO NOTHING
     RETURNING progress_event_id AS entity_id`,
    [
      entityId,
      input.write.participant_id,
      input.principal.adult_id,
      input.principal.human_account_id,
      input.principal.household_id,
      input.principal.session_id,
      accountKey,
      input.write.content_id,
      input.write.content_version_id,
      input.write.position_ms,
      input.write.duration_ms,
      input.write.context.idempotency_key,
      input.write.context.canonical_request_hash,
      input.write.context.occurred_at,
    ],
  );
  return insertedOrReplay(pool, {
    result,
    table: 'parent_learning_content_progress_events',
    entityColumn: 'progress_event_id',
    operation: 'content_progress_recorded',
    participantId: input.write.participant_id,
    context: input.write.context,
  });
}

async function submitQuestion(
  pool: DbPool,
  accountKey: string,
  input: { principal: ParentLearningPrincipal; write: ParentQuestionWrite },
): Promise<ParentLearningMutationReceipt> {
  const entityId = stableId(
    'parent-question',
    input.write.participant_id,
    input.write.context.idempotency_key,
  );
  const result = await pool.query(
    `INSERT INTO onetime.parent_learning_questions
       (question_id, participant_id, household_id, actor_kind, account_key,
        product_key, runtime_tier, verification_environment_id,
        class_series_key, private_body, question_state, idempotency_key,
        request_hash, submitted_at)
     SELECT $1, participant.participant_id, participant.household_id, 'parent',
            entitlement.account_key, participant.product_key, participant.runtime_tier,
            participant.verification_environment_id, entitlement.class_series_key,
            $9, 'submitted', $10, $11, $12
       FROM onetime.parent_learning_participants AS participant
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = participant.household_id
        AND access.product_key = participant.product_key
        AND access.runtime_tier = participant.runtime_tier
        AND access.verification_environment_id = participant.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace')
        AND access.archived_at IS NULL
       JOIN onetime.parent_learning_class_entitlements AS entitlement
         ON entitlement.participant_id = participant.participant_id
        AND entitlement.household_id = participant.household_id
        AND entitlement.product_key = participant.product_key
        AND entitlement.runtime_tier = participant.runtime_tier
        AND entitlement.verification_environment_id = participant.verification_environment_id
        AND entitlement.account_key = $7
        AND entitlement.class_series_key = $8
        AND entitlement.entitlement_state = 'active'
       JOIN onetime.v21_adult_sessions AS session
         ON session.session_id = $6
        AND session.human_account_id = participant.human_account_id
        AND session.active_role = 'parent'
        AND session.active_household_id = participant.household_id
        AND session.product_key = participant.product_key
        AND session.runtime_tier = participant.runtime_tier
        AND session.verification_environment_id = participant.verification_environment_id
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $12::timestamptz
        AND session.absolute_expires_at > $12::timestamptz
      WHERE participant.participant_id = $2
        AND participant.adult_id = $3
        AND participant.human_account_id = $4
        AND participant.household_id = $5
        AND participant.participant_kind = 'parent'
        AND participant.state = 'active'
     ON CONFLICT (participant_id, idempotency_key) DO NOTHING
     RETURNING question_id AS entity_id`,
    [
      entityId,
      input.write.participant_id,
      input.principal.adult_id,
      input.principal.human_account_id,
      input.principal.household_id,
      input.principal.session_id,
      accountKey,
      input.write.class_series_key,
      input.write.private_body,
      input.write.context.idempotency_key,
      input.write.context.canonical_request_hash,
      input.write.context.occurred_at,
    ],
  );
  return insertedOrReplay(pool, {
    result,
    table: 'parent_learning_questions',
    entityColumn: 'question_id',
    operation: 'question_submitted',
    participantId: input.write.participant_id,
    context: input.write.context,
  });
}

async function insertedOrReplay(
  pool: DbPool,
  input: {
    result: { rowCount: number | null; rows: unknown[] };
    table:
      | 'parent_learning_attendance_events'
      | 'parent_learning_content_progress_events'
      | 'parent_learning_questions';
    entityColumn: 'attendance_event_id' | 'progress_event_id' | 'question_id';
    operation: ParentLearningMutationOperation;
    participantId: string;
    context: { idempotency_key: string; canonical_request_hash: string };
  },
): Promise<ParentLearningMutationReceipt> {
  if (input.result.rowCount === 1) {
    return {
      disposition: 'committed',
      operation: input.operation,
      entity_id: text((input.result.rows[0] as Row | undefined)?.entity_id, 'activity entity'),
    };
  }
  if ((input.result.rowCount ?? 0) !== 0) invariant('A Parent activity insert was not singular.');
  const replay = await pool.query(
    `SELECT ${input.entityColumn} AS entity_id, request_hash
       FROM onetime.${input.table}
      WHERE participant_id = $1
        AND idempotency_key = $2
      LIMIT 1`,
    [input.participantId, input.context.idempotency_key],
  );
  if (replay.rowCount !== 1) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.targetUnavailable,
      'This Parent learning target is unavailable.',
    );
  }
  const row = replay.rows[0] as Row;
  if (text(row.request_hash, 'request hash') !== input.context.canonical_request_hash) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.idempotencyConflict,
      'This Parent learning request key was already used for different input.',
    );
  }
  return {
    disposition: 'replayed',
    operation: input.operation,
    entity_id: text(row.entity_id, 'activity entity'),
  };
}

function parentLearningRecord(
  row: Row,
  libraryItems: ParentLearningLibraryItem[],
  observedAt: Date,
  productionBasicMeetingRefDigest: string | null,
): ParentLearningRecord {
  return {
    participant_id: text(row.participant_id, 'Parent participant'),
    adult_id: text(row.adult_id, 'adult'),
    human_account_id: text(row.human_account_id, 'HumanAccount'),
    household_id: text(row.household_id, 'household'),
    display_name: text(row.display_name, 'Parent display name'),
    state: exact(row.participant_state, 'active'),
    learner_ordinal: exactInteger(row.learner_ordinal, 1),
    active_child_student_count: nonNegativeInteger(
      row.active_seat_count,
      'active child Student count',
    ),
    entitlement: {
      account_key: text(row.account_key, 'class account'),
      class_series_key: text(row.class_series_key, 'class series'),
      class_title: text(row.class_title, 'class title'),
      effective_at: instant(row.effective_at, 'class entitlement time'),
    },
    next_class: nextClass(row, observedAt, productionBasicMeetingRefDigest),
    library_items: libraryItems,
    activity: {
      attended_occurrence_count: nonNegativeInteger(
        row.attended_occurrence_count,
        'attendance count',
      ),
      started_content_count: nonNegativeInteger(row.started_content_count, 'started content count'),
      completed_content_count: nonNegativeInteger(
        row.completed_content_count,
        'completed content count',
      ),
      submitted_question_count: nonNegativeInteger(row.submitted_question_count, 'question count'),
    },
  };
}

function nextClass(
  row: Row,
  observedAt: Date,
  productionBasicMeetingRefDigest: string | null,
): ParentLearningNextClass | null {
  if (row.next_occurrence_id === null || row.next_occurrence_id === undefined) return null;
  const occurrenceId = text(row.next_occurrence_id, 'next occurrence');
  const liveConfirmedAt = nullableInstant(row.next_live_confirmed_at);
  const liveExpiresAt = nullableInstant(row.next_live_expires_at);
  const liveCurrent = Boolean(
    productionBasicMeetingRefDigest &&
    row.next_live_meeting_ref_digest === productionBasicMeetingRefDigest &&
    liveConfirmedAt &&
    liveExpiresAt &&
    Date.parse(liveConfirmedAt) <= observedAt.getTime() &&
    Date.parse(liveExpiresAt) > observedAt.getTime() &&
    Date.parse(liveExpiresAt) - Date.parse(liveConfirmedAt) <= 2 * 60 * 60_000,
  );
  return {
    occurrence_id: occurrenceId,
    title: text(row.class_title, 'class title'),
    starts_at: instant(row.next_starts_at, 'next class start'),
    ends_at: instant(row.next_ends_at, 'next class end'),
    join_opens_at: instant(row.next_join_opens_at, 'next class join opening'),
    join_closes_at: instant(row.next_join_closes_at, 'next class join closing'),
    state: liveCurrent ? 'live' : exact(row.next_state, 'scheduled', 'preparing', 'ready', 'live'),
    launch_action:
      liveCurrent && liveExpiresAt
        ? {
            action_key: stableId('parent-production-basic-launch', occurrenceId),
            label: 'Join class',
            kind: 'class_launch',
            method: 'POST',
            href: '/api/v1/portals/parent/classroom/production-basic/launch',
            launch_token_ref: null,
            expires_at: liveExpiresAt,
          }
        : null,
  };
}

function parentLearningLibraryItem(row: Row): ParentLearningLibraryItem {
  const contentId = text(row.content_id, 'content');
  const progressUpdatedAt = nullableInstant(row.progress_updated_at);
  const itemType = exact(row.item_type, 'video');
  return {
    content_id: contentId,
    content_version_id: text(row.content_version_id, 'content version'),
    title: text(row.title, 'content title'),
    item_type: itemType,
    published_at: instant(row.published_at, 'content publication time'),
    progress: progressUpdatedAt
      ? {
          position_ms: nonNegativeInteger(row.position_ms, 'content position'),
          duration_ms: positiveInteger(row.duration_ms, 'content duration'),
          completed: exactBoolean(row.completed, 'content completion'),
          updated_at: progressUpdatedAt,
        }
      : null,
    open_action: {
      action_key: stableId('parent-content-open', contentId),
      label: 'Play video',
      kind: 'content_open',
      method: 'GET',
      href: `/api/v1/portals/parent/learning/content/${encodeURIComponent(contentId)}/open`,
      launch_token_ref: null,
      expires_at: null,
    },
  };
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}:${createHash('sha256').update(parts.join('\u0000'), 'utf8').digest('hex').slice(0, 40)}`;
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalDigest(value: string | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (!/^[0-9a-f]{64}$/u.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}

function text(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) invariant(`${label} is unavailable.`);
  return value;
}

function instant(value: unknown, label: string) {
  const parsed = value instanceof Date ? value : new Date(text(value, label));
  if (Number.isNaN(parsed.getTime())) invariant(`${label} is invalid.`);
  return parsed.toISOString();
}

function nullableInstant(value: unknown) {
  if (value === null || value === undefined) return null;
  return instant(value, 'timestamp');
}

function nonNegativeInteger(value: unknown, label: string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) invariant(`${label} is invalid.`);
  return parsed;
}

function positiveInteger(value: unknown, label: string) {
  const parsed = nonNegativeInteger(value, label);
  if (parsed <= 0) invariant(`${label} is invalid.`);
  return parsed;
}

function exactBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') invariant(`${label} is invalid.`);
  return value;
}

function exactInteger<const T extends number>(value: unknown, expected: T): T {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (parsed !== expected) invariant('The Parent learner ordinal is invalid.');
  return expected;
}

function exact<const T extends readonly string[]>(value: unknown, ...allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    invariant('Parent learning persistence returned an invalid state.');
  }
  return value as T[number];
}

function invariant(message: string): never {
  throw new ParentLearningError(PARENT_LEARNING_ERROR_CODES.persistenceInvariant, message);
}
