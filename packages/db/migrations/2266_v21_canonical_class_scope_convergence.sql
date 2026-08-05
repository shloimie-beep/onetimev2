-- Converge the historical class product scope onto the normative v2.1 product
-- without rewriting legacy occurrences or their provider/audit history.
-- @postgres-only-begin
WITH source_series AS (
  SELECT DISTINCT ON (account_key)
         account_key,
         title,
         teacher_profile_key
    FROM onetime.class_series
   WHERE product_key <> 'one_time_mishnayos'
     AND class_series_key = 'class_series_one_time_daily'
   ORDER BY account_key, is_canonical DESC, updated_at DESC
)
INSERT INTO onetime.class_series AS existing (
  class_series_key,
  account_key,
  product_key,
  title,
  timezone,
  local_start_time,
  reminder_local_time,
  reminder_minutes_before,
  status,
  series_state,
  is_canonical,
  recurrence_weekdays,
  recurrence_starts_on,
  recurrence_ends_on,
  duration_minutes,
  teacher_profile_key,
  embedded_classroom_required,
  recording_enabled,
  version
)
SELECT 'class_series_one_time_daily',
       source.account_key,
       'one_time_mishnayos',
       source.title,
       'Asia/Jerusalem',
       time '19:00',
       time '18:30',
       30,
       'active',
       'active',
       true,
       ARRAY[1,2,3,4,7]::smallint[],
       DATE '2026-08-16',
       NULL,
       60,
       COALESCE(source.teacher_profile_key, 'unassigned'),
       true,
       true,
       1
  FROM source_series AS source
ON CONFLICT (account_key, product_key, class_series_key)
DO UPDATE SET timezone = EXCLUDED.timezone,
              local_start_time = EXCLUDED.local_start_time,
              reminder_local_time = EXCLUDED.reminder_local_time,
              reminder_minutes_before = EXCLUDED.reminder_minutes_before,
              status = EXCLUDED.status,
              series_state = EXCLUDED.series_state,
              is_canonical = EXCLUDED.is_canonical,
              recurrence_weekdays = EXCLUDED.recurrence_weekdays,
              recurrence_starts_on = EXCLUDED.recurrence_starts_on,
              recurrence_ends_on = EXCLUDED.recurrence_ends_on,
              duration_minutes = EXCLUDED.duration_minutes,
              embedded_classroom_required = EXCLUDED.embedded_classroom_required,
              recording_enabled = EXCLUDED.recording_enabled,
              version = existing.version + 1,
              updated_at = statement_timestamp();

UPDATE onetime.class_series
   SET is_canonical = false,
       version = version + 1,
       updated_at = statement_timestamp()
 WHERE product_key <> 'one_time_mishnayos'
   AND class_series_key = 'class_series_one_time_daily'
   AND is_canonical = true;

WITH canonical_dates AS (
  SELECT series.account_key,
         series.product_key,
         series.class_series_key,
         generated.local_class_date,
         (generated.local_class_date + time '19:00') AT TIME ZONE 'Asia/Jerusalem' AS starts_at
    FROM onetime.class_series AS series
    CROSS JOIN LATERAL (
      SELECT candidate::date AS local_class_date
        FROM generate_series(
          DATE '2026-08-16',
          DATE '2026-08-16' + 89,
          interval '1 day'
        ) AS candidate
       WHERE extract(isodow FROM candidate)::smallint = ANY(series.recurrence_weekdays)
    ) AS generated
   WHERE series.product_key = 'one_time_mishnayos'
     AND series.is_canonical = true
     AND series.status = 'active'
     AND series.series_state = 'active'
)
INSERT INTO onetime.class_occurrences AS existing (
  occurrence_key,
  account_key,
  product_key,
  class_series_key,
  local_class_date,
  starts_at,
  reminder_due_at,
  joinable_until,
  occurrence_state,
  reminder_state,
  join_opens_at,
  join_closes_at,
  scheduled_ends_at,
  duration_minutes,
  timezone_snapshot,
  schedule_version,
  version
)
SELECT 'v21-class-occurrence-' || substr(md5(
         canonical.account_key || ':' || canonical.product_key || ':' ||
         canonical.class_series_key || ':' || canonical.local_class_date::text
       ), 1, 32),
       canonical.account_key,
       canonical.product_key,
       canonical.class_series_key,
       canonical.local_class_date,
       canonical.starts_at,
       canonical.starts_at - interval '30 minutes',
       canonical.starts_at + interval '75 minutes',
       'scheduled',
       'not_required',
       canonical.starts_at - interval '10 minutes',
       canonical.starts_at + interval '75 minutes',
       canonical.starts_at + interval '60 minutes',
       60,
       'Asia/Jerusalem',
       1,
       1
  FROM canonical_dates AS canonical
ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
DO UPDATE SET starts_at = EXCLUDED.starts_at,
              reminder_due_at = EXCLUDED.reminder_due_at,
              joinable_until = EXCLUDED.joinable_until,
              join_opens_at = EXCLUDED.join_opens_at,
              join_closes_at = EXCLUDED.join_closes_at,
              scheduled_ends_at = EXCLUDED.scheduled_ends_at,
              duration_minutes = EXCLUDED.duration_minutes,
              timezone_snapshot = EXCLUDED.timezone_snapshot,
              schedule_version = existing.schedule_version + 1,
              version = existing.version + 1,
              updated_at = statement_timestamp()
WHERE existing.occurrence_state IN ('scheduled', 'preparing', 'ready', 'canceled')
  AND NOT EXISTS (
    SELECT 1 FROM onetime.class_attendance_marks AS mark
     WHERE mark.occurrence_key = existing.occurrence_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM onetime.classroom_attendance_events AS attendance
     WHERE attendance.occurrence_key = existing.occurrence_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM onetime.classroom_attendance_events_v21 AS attendance
     WHERE attendance.occurrence_id = existing.occurrence_key
  );

INSERT INTO onetime.class_series_enrollments AS existing
  (enrollment_key, account_key, product_key, class_series_key, learner_key,
   household_key, enrollment_state, source, effective_at, revoked_at,
   idempotency_key, audit_ref, version)
SELECT 'family-class-' || substr(md5(
         series.account_key || ':' || series.class_series_key || ':' || enrollment.enrollment_id
       ), 1, 32),
       series.account_key,
       series.product_key,
       series.class_series_key,
       enrollment.student_id,
       enrollment.household_id,
       enrollment.state,
       'parent_household_v21',
       enrollment.updated_at,
       CASE WHEN enrollment.state = 'revoked' THEN enrollment.updated_at ELSE NULL END,
       'parent-v21-class-enrollment:' || enrollment.student_id,
       'parent-household:' || enrollment.enrollment_id,
       1
  FROM onetime.admin_canonical_student_enrollments AS enrollment
  JOIN onetime.class_series AS series
    ON series.product_key = enrollment.product_key
   AND series.is_canonical = true
 WHERE enrollment.runtime_tier = 'production'
   AND enrollment.verification_environment_id IN ('production_operator_canary', 'production_broad')
   AND series.status = 'active'
   AND series.series_state = 'active'
ON CONFLICT (account_key, product_key, class_series_key, learner_key)
DO UPDATE SET enrollment_state = EXCLUDED.enrollment_state,
              effective_at = EXCLUDED.effective_at,
              revoked_at = EXCLUDED.revoked_at,
              source = EXCLUDED.source,
              audit_ref = EXCLUDED.audit_ref,
              version = existing.version + 1;
-- @postgres-only-end

SELECT 1;
