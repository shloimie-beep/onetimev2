import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import type { LearnerClassAccessAdapter } from '../../../../../../../packages/domain/src/portals/services.ts';
import {
  PRODUCTION_BASIC_LIVE_MARKER_TTL_MS,
  type ProductionBasicHostLiveMarker,
} from './service.ts';

export function createProductionBasicHostLiveMarker(pool: DbPool): ProductionBasicHostLiveMarker {
  return {
    async confirm({ scope, meeting_ref_digest, confirmed_at }) {
      const expiresAt = new Date(confirmed_at.getTime() + PRODUCTION_BASIC_LIVE_MARKER_TTL_MS);
      const result = await pool.query(
        `WITH candidate AS (
           SELECT occurrence.occurrence_key
             FROM onetime.class_occurrences AS occurrence
             JOIN onetime.class_series AS series
               ON series.account_key = occurrence.account_key
              AND series.product_key = occurrence.product_key
              AND series.class_series_key = occurrence.class_series_key
            WHERE occurrence.account_key = $1
              AND occurrence.product_key = $2
              AND series.is_canonical = true
              AND series.status = 'active'
              AND series.series_state = 'active'
              AND occurrence.local_class_date = ($3::timestamptz AT TIME ZONE 'Asia/Jerusalem')::date
              AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            ORDER BY occurrence.starts_at, occurrence.occurrence_key
            LIMIT 1
         )
         UPDATE onetime.class_occurrences AS occurrence
            SET production_basic_live_confirmed_at = CASE
                  WHEN occurrence.production_basic_meeting_ref_digest = $4
                   AND occurrence.production_basic_live_expires_at > $3
                    THEN occurrence.production_basic_live_confirmed_at
                  ELSE $3
                END,
                production_basic_live_expires_at = CASE
                  WHEN occurrence.production_basic_meeting_ref_digest = $4
                   AND occurrence.production_basic_live_expires_at > $3
                    THEN occurrence.production_basic_live_expires_at
                  ELSE $5
                END,
                production_basic_meeting_ref_digest = $4,
                version = CASE
                  WHEN occurrence.production_basic_meeting_ref_digest = $4
                   AND occurrence.production_basic_live_expires_at > $3
                    THEN occurrence.version
                  ELSE occurrence.version + 1
                END,
                updated_at = CASE
                  WHEN occurrence.production_basic_meeting_ref_digest = $4
                   AND occurrence.production_basic_live_expires_at > $3
                    THEN occurrence.updated_at
                  ELSE $3
                END
           FROM candidate
          WHERE occurrence.occurrence_key = candidate.occurrence_key
        RETURNING occurrence.occurrence_key`,
        [scope.account_key, scope.product_key, confirmed_at, meeting_ref_digest, expiresAt],
      );
      return (result.rowCount ?? 0) === 1;
    },
    async currentForStudent({ scope, learner_key, meeting_ref_digest, observed_at }) {
      const result = await pool.query(
        `SELECT 1
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.classroom_occurrence_learner_entitlements AS entitlement
             ON entitlement.account_key = occurrence.account_key
            AND entitlement.product_key = occurrence.product_key
            AND entitlement.occurrence_key = occurrence.occurrence_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND entitlement.learner_key = $3
            AND entitlement.entitlement_state = 'active'
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
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
    async clear({ scope, meeting_ref_digest, cleared_at }) {
      await pool.query(
        `UPDATE onetime.class_occurrences AS occurrence
            SET production_basic_live_confirmed_at = NULL,
                production_basic_live_expires_at = NULL,
                production_basic_meeting_ref_digest = NULL,
                version = occurrence.version + 1,
                updated_at = $4
           FROM onetime.class_series AS series
          WHERE series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
            AND occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
            AND occurrence.local_class_date = ($4::timestamptz AT TIME ZONE 'Asia/Jerusalem')::date
            AND occurrence.production_basic_meeting_ref_digest = $3
            AND occurrence.production_basic_live_confirmed_at <= $4`,
        [scope.account_key, scope.product_key, meeting_ref_digest, cleared_at],
      );
    },
  };
}

export function createProductionBasicLiveClassAccessAdapter(input: {
  base: LearnerClassAccessAdapter;
  pool: DbPool;
  meeting_ref_digest: string | null;
  binding_ready?: (() => Promise<boolean>) | undefined;
  clock?: (() => Date) | undefined;
}): LearnerClassAccessAdapter {
  const clock = input.clock ?? (() => new Date());
  return {
    async upcomingForLearner(args) {
      const scheduled = await input.base.upcomingForLearner(args);
      if (
        args.actor.actor_role !== 'student' ||
        !args.actor.student_learner ||
        args.actor.student_learner.learner_key !== args.learner.learner_key ||
        !input.meeting_ref_digest ||
        scheduled.length === 0 ||
        (input.binding_ready && !(await input.binding_ready()))
      ) {
        return scheduled;
      }
      const now = clock();
      const result = await input.pool.query(
        `SELECT occurrence.occurrence_key
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.classroom_occurrence_learner_entitlements AS entitlement
             ON entitlement.account_key = occurrence.account_key
            AND entitlement.product_key = occurrence.product_key
            AND entitlement.occurrence_key = occurrence.occurrence_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND entitlement.household_key = $3
            AND entitlement.learner_key = $4
            AND entitlement.entitlement_state = 'active'
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
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
      const liveOccurrenceKey = result.rows[0]?.occurrence_key;
      if (typeof liveOccurrenceKey !== 'string') return scheduled;
      return scheduled.map((occurrence) =>
        occurrence.class_key === liveOccurrenceKey
          ? { ...occurrence, status: 'live' as const, launch_action: null }
          : occurrence,
      );
    },
    protectedLaunch: (args) => input.base.protectedLaunch(args),
  };
}
