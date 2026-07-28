import type {
  CalendarOccurrence,
  CalendarRepository,
  CalendarRepositoryQuery,
} from '../../../contracts/src/calendar/index.ts';
import type { DbPool } from '../index.ts';

type OccurrenceRow = {
  occurrence_key: string;
  class_series_key: string;
  local_class_date: string | Date;
  starts_at: string | Date;
  scheduled_ends_at: string | Date;
  occurrence_state: string;
  title: string;
  household_ids: string[] | null;
  student_ids: string[] | null;
  attendance_summary: string | null;
  recording_available: boolean | null;
};

function iso(value: string | Date) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function localDate(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function status(value: string): CalendarOccurrence['status'] {
  if (
    value === 'scheduled' ||
    value === 'rescheduled' ||
    value === 'cancelled' ||
    value === 'completed'
  ) {
    return value;
  }
  return 'scheduled';
}

/**
 * Read-only calendar projection over the existing classroom tables. Tenant,
 * product, household, and student predicates remain inside the SQL boundary.
 */
export function createCalendarRepository(pool: DbPool): CalendarRepository {
  return {
    async listOccurrences(query) {
      const result = await pool.query<OccurrenceRow>(
        `SELECT occurrence.occurrence_key,
                occurrence.class_series_key,
                occurrence.local_class_date,
                occurrence.starts_at,
                occurrence.scheduled_ends_at,
                occurrence.occurrence_state,
                series.title,
                COALESCE(array_agg(DISTINCT entitlement.household_key)
                  FILTER (WHERE entitlement.household_key IS NOT NULL), '{}') AS household_ids,
                COALESCE(array_agg(DISTINCT entitlement.learner_key)
                  FILTER (WHERE entitlement.learner_key IS NOT NULL), '{}') AS student_ids,
                CASE WHEN occurrence.occurrence_state = 'completed'
                  THEN concat(
                    count(DISTINCT attendance.attendance_key)
                      FILTER (WHERE attendance.attendance_state = 'present'),
                    ' present'
                  )
                  ELSE NULL
                END AS attendance_summary,
                occurrence.recording_state = 'available' AS recording_available
           FROM onetime.class_occurrences occurrence
           JOIN onetime.class_series series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
      LEFT JOIN onetime.classroom_occurrence_learner_entitlements entitlement
             ON entitlement.account_key = occurrence.account_key
            AND entitlement.product_key = occurrence.product_key
            AND entitlement.occurrence_key = occurrence.occurrence_key
            AND entitlement.entitlement_state = 'active'
      LEFT JOIN onetime.class_attendance_marks attendance
             ON attendance.account_key = occurrence.account_key
            AND attendance.product_key = occurrence.product_key
            AND attendance.occurrence_key = occurrence.occurrence_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND occurrence.starts_at >= $3::timestamptz
            AND occurrence.starts_at < $4::timestamptz
            AND (
              $5::boolean
              OR entitlement.household_key = ANY($6::text[])
              OR entitlement.learner_key = ANY($7::text[])
            )
            AND ($8::text[] IS NULL OR occurrence.occurrence_state = ANY($8::text[]))
            AND ($9::text[] IS NULL OR occurrence.class_series_key = ANY($9::text[]))
       GROUP BY occurrence.occurrence_key, occurrence.class_series_key,
                occurrence.local_class_date, occurrence.starts_at,
                occurrence.scheduled_ends_at, occurrence.occurrence_state,
                occurrence.account_key, occurrence.product_key, series.title
       ORDER BY occurrence.starts_at, occurrence.occurrence_key`,
        [
          query.accountKey,
          query.productKey,
          query.rangeStart,
          query.rangeEnd,
          query.adminAccess,
          [...query.householdIds],
          [...query.studentIds],
          query.statuses ? [...query.statuses] : null,
          query.seriesIds ? [...query.seriesIds] : null,
        ],
      );
      return result.rows.map((row): CalendarOccurrence => ({
        id: row.occurrence_key,
        seriesId: row.class_series_key,
        localClassDate: localDate(row.local_class_date),
        startsAt: iso(row.starts_at),
        endsAt: iso(row.scheduled_ends_at),
        status: status(row.occurrence_state),
        title: row.title,
        householdIds: row.household_ids ?? [],
        studentIds: row.student_ids ?? [],
        ...(row.attendance_summary ? { attendanceSummary: row.attendance_summary } : {}),
        recordingAvailable: row.recording_available ?? false,
      }));
    },
  };
}

export function calendarRepositoryQueryFor(input: {
  accountKey: string;
  productKey: string;
  adminAccess: boolean;
  rangeStart: string;
  rangeEnd: string;
  householdIds: readonly string[];
  studentIds: readonly string[];
  statuses?: CalendarRepositoryQuery['statuses'];
  seriesIds?: CalendarRepositoryQuery['seriesIds'];
}): CalendarRepositoryQuery {
  return {
    accountKey: input.accountKey,
    productKey: input.productKey,
    adminAccess: input.adminAccess,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    householdIds: input.householdIds,
    studentIds: input.studentIds,
    ...(input.statuses ? { statuses: input.statuses } : {}),
    ...(input.seriesIds ? { seriesIds: input.seriesIds } : {}),
  };
}
