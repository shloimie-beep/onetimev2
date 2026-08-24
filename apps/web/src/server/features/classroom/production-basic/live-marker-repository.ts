import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { householdHasLearningAccess } from '../../../../../../../packages/domain/src/billing/portal-access.ts';
import {
  localDateKey,
  localPartsFor,
  ONE_TIME_CLASS_TIME_ZONE,
} from '../../../../../../../packages/domain/src/classes/schedule.ts';
import type { LearnerClassAccessAdapter } from '../../../../../../../packages/domain/src/portals/services.ts';
import {
  PRODUCTION_BASIC_LIVE_MARKER_TTL_MS,
  type ProductionBasicHostLiveMarker,
} from './service.ts';

export function createProductionBasicHostLiveMarker(pool: DbPool): ProductionBasicHostLiveMarker {
  return {
    async confirm({ scope, meeting_ref_digest, confirmed_at }) {
      const expiresAt = new Date(confirmed_at.getTime() + PRODUCTION_BASIC_LIVE_MARKER_TTL_MS);
      const localClassDate = jerusalemLocalDate(confirmed_at);
      const result = await pool.query(
        `UPDATE onetime.class_occurrences
            SET production_basic_live_confirmed_at = CASE
                  WHEN production_basic_meeting_ref_digest = $5
                   AND production_basic_live_expires_at > $3
                    THEN production_basic_live_confirmed_at
                  ELSE $3
                END,
                production_basic_live_expires_at = CASE
                  WHEN production_basic_meeting_ref_digest = $5
                   AND production_basic_live_expires_at > $3
                    THEN production_basic_live_expires_at
                  ELSE $6
                END,
                production_basic_meeting_ref_digest = $5,
                version = CASE
                  WHEN production_basic_meeting_ref_digest = $5
                   AND production_basic_live_expires_at > $3
                    THEN version
                  ELSE version + 1
                END,
                updated_at = CASE
                  WHEN production_basic_meeting_ref_digest = $5
                   AND production_basic_live_expires_at > $3
                    THEN updated_at
                  ELSE $3
                END
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = (
           SELECT candidate.occurrence_key
             FROM onetime.class_occurrences AS candidate
             JOIN onetime.class_series AS series
               ON series.account_key = candidate.account_key
              AND series.product_key = candidate.product_key
              AND series.class_series_key = candidate.class_series_key
            WHERE candidate.account_key = $1
              AND candidate.product_key = $2
              AND series.is_canonical = true
              AND series.status = 'active'
              AND series.series_state = 'active'
              AND candidate.local_class_date = $4::date
              AND candidate.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            ORDER BY candidate.starts_at, candidate.occurrence_key
            LIMIT 1
         )
        RETURNING occurrence_key`,
        [
          scope.account_key,
          scope.product_key,
          confirmed_at,
          localClassDate,
          meeting_ref_digest,
          expiresAt,
        ],
      );
      return (result.rowCount ?? 0) === 1;
    },
    async clear({ scope, meeting_ref_digest, cleared_at }) {
      const localClassDate = jerusalemLocalDate(cleared_at);
      await pool.query(
        `UPDATE onetime.class_occurrences
            SET production_basic_live_confirmed_at = NULL,
                production_basic_live_expires_at = NULL,
                production_basic_meeting_ref_digest = NULL,
                version = version + 1,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND local_class_date = $5::date
            AND production_basic_meeting_ref_digest = $3
            AND production_basic_live_confirmed_at <= $4
            AND occurrence_key = (
              SELECT candidate.occurrence_key
                FROM onetime.class_occurrences AS candidate
                JOIN onetime.class_series AS series
                  ON series.account_key = candidate.account_key
                 AND series.product_key = candidate.product_key
                 AND series.class_series_key = candidate.class_series_key
               WHERE candidate.account_key = $1
                 AND candidate.product_key = $2
                 AND candidate.local_class_date = $5::date
                 AND series.is_canonical = true
                 AND series.status = 'active'
                 AND series.series_state = 'active'
               ORDER BY candidate.starts_at, candidate.occurrence_key
               LIMIT 1
            )`,
        [scope.account_key, scope.product_key, meeting_ref_digest, cleared_at, localClassDate],
      );
    },
    async currentForStudent({ scope, learner_key, meeting_ref_digest, observed_at }) {
      const result = await pool.query(
        `SELECT 1
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.portal_learners AS learner
             ON learner.account_key = occurrence.account_key
            AND learner.product_key = occurrence.product_key
            AND learner.learner_key = $3
            AND learner.learner_status = 'active'
           LEFT JOIN onetime.classroom_occurrence_learner_entitlements AS legacy_entitlement
             ON legacy_entitlement.account_key = occurrence.account_key
            AND legacy_entitlement.product_key = occurrence.product_key
            AND legacy_entitlement.occurrence_key = occurrence.occurrence_key
            AND legacy_entitlement.household_key = learner.household_key
            AND legacy_entitlement.learner_key = learner.learner_key
            AND legacy_entitlement.entitlement_state = 'active'
           LEFT JOIN onetime.class_series_enrollments AS canonical_enrollment
             ON canonical_enrollment.account_key = occurrence.account_key
            AND canonical_enrollment.product_key = occurrence.product_key
            AND canonical_enrollment.class_series_key = occurrence.class_series_key
            AND canonical_enrollment.learner_key = learner.learner_key
           LEFT JOIN onetime.account_access_projections AS account_access
             ON account_access.account_key = learner.account_key
            AND account_access.product_key = learner.product_key
            AND account_access.household_key = learner.household_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
            AND (
              (
                canonical_enrollment.enrollment_key IS NOT NULL
                AND canonical_enrollment.household_key = learner.household_key
                AND canonical_enrollment.enrollment_state = 'active'
                AND canonical_enrollment.effective_at <= $5
                AND canonical_enrollment.revoked_at IS NULL
                AND account_access.state IN ('active', 'grace', 'scheduled_end')
                AND account_access.effective_at <= $5
                AND (account_access.expires_at IS NULL OR account_access.expires_at > $5)
              )
              OR (
                canonical_enrollment.enrollment_key IS NULL
                AND legacy_entitlement.occurrence_entitlement_key IS NOT NULL
              )
            )
            AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            AND occurrence.production_basic_meeting_ref_digest = $4
            AND occurrence.production_basic_live_confirmed_at <= $5
            AND occurrence.production_basic_live_expires_at > $5
            AND occurrence.production_basic_live_expires_at
              <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
          LIMIT 1`,
        [scope.account_key, scope.product_key, learner_key, meeting_ref_digest, observed_at],
      );
      return (result.rowCount ?? 0) === 1;
    },
    async currentForParent({
      scope,
      participant_id,
      household_id,
      meeting_ref_digest,
      observed_at,
    }) {
      const result = await pool.query(
        `SELECT 1
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.parent_learning_class_entitlements AS entitlement
             ON entitlement.account_key = occurrence.account_key
            AND entitlement.product_key = occurrence.product_key
            AND entitlement.class_series_key = occurrence.class_series_key
           JOIN onetime.parent_learning_participants AS participant
             ON participant.participant_id = entitlement.participant_id
            AND participant.household_id = entitlement.household_id
            AND participant.product_key = entitlement.product_key
            AND participant.state = 'active'
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND entitlement.participant_id = $3
            AND entitlement.household_id = $4
            AND entitlement.entitlement_state = 'active'
            AND entitlement.effective_at <= $6
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
            AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            AND occurrence.production_basic_meeting_ref_digest = $5
            AND occurrence.production_basic_live_confirmed_at <= $6
            AND occurrence.production_basic_live_expires_at > $6
            AND occurrence.production_basic_live_expires_at
              <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
          LIMIT 1`,
        [
          scope.account_key,
          scope.product_key,
          participant_id,
          household_id,
          meeting_ref_digest,
          observed_at,
        ],
      );
      return (result.rowCount ?? 0) === 1;
    },
  };
}

export function jerusalemLocalDate(value: Date): string {
  return localDateKey(localPartsFor(value, ONE_TIME_CLASS_TIME_ZONE));
}

export function createProductionBasicLiveClassAccessAdapter(input: {
  base: LearnerClassAccessAdapter;
  pool: DbPool;
  meeting_ref_digest: string | null;
  binding_ready?: (() => Promise<boolean>) | undefined;
  household_has_learning_access?: typeof householdHasLearningAccess | undefined;
  clock?: (() => Date) | undefined;
}): LearnerClassAccessAdapter {
  const clock = input.clock ?? (() => new Date());
  return {
    async upcomingForLearner(args) {
      const scheduled = await input.base.upcomingForLearner(args);
      const studentScoped =
        args.actor.actor_role === 'student' &&
        args.actor.student_learner?.learner_key === args.learner.learner_key;
      if (!studentScoped || !input.meeting_ref_digest) return scheduled;
      const withoutUnconfirmedLive = scheduled.map((occurrence) =>
        occurrence.status === 'live'
          ? { ...occurrence, status: 'upcoming' as const, launch_action: null }
          : occurrence,
      );
      if (input.binding_ready && !(await input.binding_ready())) return withoutUnconfirmedLive;

      const now = clock();
      const householdAccess = input.household_has_learning_access ?? householdHasLearningAccess;
      if (
        scheduled.length === 0 &&
        !(await householdAccess({
          pool: input.pool,
          accountKey: args.actor.account_key,
          productKey: args.actor.product_key,
          householdKey: args.learner.household_key,
          now,
        }))
      ) {
        return withoutUnconfirmedLive;
      }

      const result = await input.pool.query(
        `SELECT occurrence.occurrence_key,
                series.title,
                occurrence.starts_at
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.portal_learners AS learner
             ON learner.account_key = occurrence.account_key
            AND learner.product_key = occurrence.product_key
            AND learner.household_key = $3
            AND learner.learner_key = $4
            AND learner.learner_status = 'active'
           LEFT JOIN onetime.classroom_occurrence_learner_entitlements AS legacy_entitlement
             ON legacy_entitlement.account_key = occurrence.account_key
            AND legacy_entitlement.product_key = occurrence.product_key
            AND legacy_entitlement.occurrence_key = occurrence.occurrence_key
            AND legacy_entitlement.household_key = learner.household_key
            AND legacy_entitlement.learner_key = learner.learner_key
            AND legacy_entitlement.entitlement_state = 'active'
           LEFT JOIN onetime.class_series_enrollments AS canonical_enrollment
             ON canonical_enrollment.account_key = occurrence.account_key
            AND canonical_enrollment.product_key = occurrence.product_key
            AND canonical_enrollment.class_series_key = occurrence.class_series_key
            AND canonical_enrollment.learner_key = learner.learner_key
           LEFT JOIN onetime.account_access_projections AS account_access
             ON account_access.account_key = learner.account_key
            AND account_access.product_key = learner.product_key
            AND account_access.household_key = learner.household_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
            AND (
              (
                canonical_enrollment.enrollment_key IS NOT NULL
                AND canonical_enrollment.household_key = learner.household_key
                AND canonical_enrollment.enrollment_state = 'active'
                AND canonical_enrollment.effective_at <= $6
                AND canonical_enrollment.revoked_at IS NULL
                AND account_access.state IN ('active', 'grace', 'scheduled_end')
                AND account_access.effective_at <= $6
                AND (account_access.expires_at IS NULL OR account_access.expires_at > $6)
              )
              OR (
                canonical_enrollment.enrollment_key IS NULL
                AND legacy_entitlement.occurrence_entitlement_key IS NOT NULL
              )
            )
            AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            AND occurrence.production_basic_meeting_ref_digest = $5
            AND occurrence.production_basic_live_confirmed_at <= $6
            AND occurrence.production_basic_live_expires_at > $6
            AND occurrence.production_basic_live_expires_at
              <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
          ORDER BY occurrence.production_basic_live_confirmed_at DESC, occurrence.occurrence_key
          LIMIT 1`,
        [
          args.actor.account_key,
          args.actor.product_key,
          args.learner.household_key,
          args.learner.learner_key,
          input.meeting_ref_digest,
          now,
        ],
      );

      const liveOccurrence = result.rows[0];
      const liveOccurrenceKey = liveOccurrence?.occurrence_key;
      if (typeof liveOccurrenceKey !== 'string') return withoutUnconfirmedLive;
      if (scheduled.some((occurrence) => occurrence.class_key === liveOccurrenceKey)) {
        return withoutUnconfirmedLive.map((occurrence) =>
          occurrence.class_key === liveOccurrenceKey
            ? { ...occurrence, status: 'live' as const, launch_action: null }
            : occurrence,
        );
      }

      const liveTitle = liveOccurrence?.title;
      const rawStartsAt = liveOccurrence?.starts_at;
      const liveStartsAt =
        rawStartsAt instanceof Date
          ? rawStartsAt
          : typeof rawStartsAt === 'string' || typeof rawStartsAt === 'number'
            ? new Date(rawStartsAt)
            : null;
      if (typeof liveTitle !== 'string' || !liveStartsAt || Number.isNaN(liveStartsAt.getTime())) {
        return withoutUnconfirmedLive;
      }
      return [
        {
          class_key: liveOccurrenceKey,
          title: liveTitle,
          starts_at: liveStartsAt.toISOString(),
          status: 'live' as const,
          launch_action: null,
        },
        ...withoutUnconfirmedLive,
      ];
    },
    protectedLaunch: (args) => input.base.protectedLaunch(args),
  };
}
