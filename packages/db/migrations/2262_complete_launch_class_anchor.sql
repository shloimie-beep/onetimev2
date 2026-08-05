-- Reconcile the persisted canonical class to the locked production anchor.
-- Future/pre-anchor runtime work is revoked, while attended history is never
-- rewritten. The source series remains the durable recurrence authority.
-- @postgres-only-begin
CREATE TABLE onetime.class_launch_timing_correction_receipts (
  correction_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text NOT NULL,
  occurrence_key text,
  previous_state jsonb NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (
    correction_key,
    account_key,
    product_key,
    class_series_key,
    occurrence_key
  ),
  CHECK (correction_key = 'complete-launch-class-anchor-2026-08-05')
);

INSERT INTO onetime.class_launch_timing_correction_receipts (
  correction_key,
  account_key,
  product_key,
  class_series_key,
  occurrence_key,
  previous_state
)
SELECT
  'complete-launch-class-anchor-2026-08-05',
  series.account_key,
  series.product_key,
  series.class_series_key,
  '',
  jsonb_build_object(
    'timezone', series.timezone,
    'localStartTime', series.local_start_time,
    'reminderLocalTime', series.reminder_local_time,
    'durationMinutes', series.duration_minutes,
    'weekdays', series.recurrence_weekdays,
    'startsOn', series.recurrence_starts_on,
    'status', series.status,
    'seriesState', series.series_state,
    'version', series.version
  )
FROM onetime.class_series AS series
WHERE series.is_canonical = true;

UPDATE onetime.class_series
SET timezone = 'Asia/Jerusalem',
    local_start_time = time '19:00',
    reminder_local_time = time '18:30',
    reminder_minutes_before = 30,
    duration_minutes = 60,
    recurrence_weekdays = ARRAY[1,2,3,4,7]::smallint[],
    recurrence_starts_on = DATE '2026-08-16',
    recurrence_ends_on = NULL,
    status = 'active',
    series_state = 'active',
    embedded_classroom_required = true,
    recording_enabled = true,
    version = version + 1,
    updated_at = statement_timestamp()
WHERE is_canonical = true;

INSERT INTO onetime.class_launch_timing_correction_receipts (
  correction_key,
  account_key,
  product_key,
  class_series_key,
  occurrence_key,
  previous_state
)
SELECT
  'complete-launch-class-anchor-2026-08-05',
  occurrence.account_key,
  occurrence.product_key,
  occurrence.class_series_key,
  occurrence.occurrence_key,
  jsonb_build_object(
    'localClassDate', occurrence.local_class_date,
    'startsAt', occurrence.starts_at,
    'occurrenceState', occurrence.occurrence_state,
    'accessState', occurrence.access_state,
    'scheduleVersion', occurrence.schedule_version,
    'version', occurrence.version
  )
FROM onetime.class_occurrences AS occurrence
JOIN onetime.class_series AS series
  ON series.account_key = occurrence.account_key
 AND series.product_key = occurrence.product_key
 AND series.class_series_key = occurrence.class_series_key
WHERE series.is_canonical = true
  AND occurrence.local_class_date < DATE '2026-08-16'
  AND NOT EXISTS (
    SELECT 1
    FROM onetime.class_attendance_marks AS mark
    WHERE mark.occurrence_key = occurrence.occurrence_key
  )
  AND NOT EXISTS (
    SELECT 1
    FROM onetime.classroom_attendance_events AS attendance
    WHERE attendance.occurrence_key = occurrence.occurrence_key
  )
  AND NOT EXISTS (
    SELECT 1
    FROM onetime.classroom_attendance_events_v21 AS attendance
    WHERE attendance.occurrence_id = occurrence.occurrence_key
  );

WITH safe_pre_anchor AS (
  SELECT occurrence.occurrence_key
  FROM onetime.class_occurrences AS occurrence
  JOIN onetime.class_series AS series
    ON series.account_key = occurrence.account_key
   AND series.product_key = occurrence.product_key
   AND series.class_series_key = occurrence.class_series_key
  WHERE series.is_canonical = true
    AND occurrence.local_class_date < DATE '2026-08-16'
    AND NOT EXISTS (
      SELECT 1 FROM onetime.class_attendance_marks AS mark
      WHERE mark.occurrence_key = occurrence.occurrence_key
    )
    AND NOT EXISTS (
      SELECT 1 FROM onetime.classroom_attendance_events AS attendance
      WHERE attendance.occurrence_key = occurrence.occurrence_key
    )
    AND NOT EXISTS (
      SELECT 1 FROM onetime.classroom_attendance_events_v21 AS attendance
      WHERE attendance.occurrence_id = occurrence.occurrence_key
    )
)
UPDATE onetime.classroom_launch_grants AS launch
SET status = 'revoked'
FROM safe_pre_anchor
WHERE launch.occurrence_key = safe_pre_anchor.occurrence_key
  AND launch.status = 'issued';

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.classroom_launch_grants_v21 AS launch
SET revoked_at = statement_timestamp(),
    version = version + 1
FROM safe_pre_anchor
WHERE launch.occurrence_id = safe_pre_anchor.occurrence_key
  AND launch.used_at IS NULL
  AND launch.revoked_at IS NULL;

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.live_student_classroom_sessions AS session
SET state = 'revoked',
    revoked_at = GREATEST(statement_timestamp(), session.last_heartbeat_at),
    revoked_by_admin_id = 'complete-launch-migration',
    revoke_audit_ref = 'migration:2262_complete_launch_class_anchor',
    version = version + 1
FROM safe_pre_anchor
WHERE session.occurrence_id = safe_pre_anchor.occurrence_key
  AND session.state = 'active';

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.zoom_class_occurrence_resources AS resource
SET resource_state = 'deleting',
    delete_idempotency_key = COALESCE(
      resource.delete_idempotency_key,
      'migration-2262-' || resource.resource_key
    ),
    updated_at = statement_timestamp()
FROM safe_pre_anchor
WHERE resource.occurrence_key = safe_pre_anchor.occurrence_key
  AND resource.resource_state IN (
    'provisioning', 'active', 'provision_failed', 'provision_unknown', 'delete_unknown'
  );

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.zoom_preparations AS preparation
SET preparation_state = 'canceled',
    version = preparation.version + 1,
    record_json = jsonb_set(
      jsonb_set(preparation.record_json, '{state}', '"canceled"'::jsonb),
      '{version}',
      to_jsonb(preparation.version + 1)
    ),
    updated_at = statement_timestamp()
FROM safe_pre_anchor
WHERE preparation.occurrence_key = safe_pre_anchor.occurrence_key
  AND preparation.preparation_state IN (
    'draft', 'validating', 'preview_ready', 'confirmed', 'provisioning',
    'ready_to_notify', 'notifying', 'partial_failure', 'failed'
  );

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.zoom_student_registrants AS registrant
SET registrant_state = 'revoked',
    version = registrant.version + 1,
    record_json = jsonb_set(
      jsonb_set(registrant.record_json, '{state}', '"revoked"'::jsonb),
      '{version}',
      to_jsonb(registrant.version + 1)
    ),
    updated_at = statement_timestamp()
FROM safe_pre_anchor
WHERE registrant.occurrence_key = safe_pre_anchor.occurrence_key
  AND registrant.registrant_state IN ('pending', 'provisioning', 'active', 'failed');

WITH safe_pre_anchor AS (
  SELECT receipt.occurrence_key
  FROM onetime.class_launch_timing_correction_receipts AS receipt
  WHERE receipt.correction_key = 'complete-launch-class-anchor-2026-08-05'
    AND receipt.occurrence_key <> ''
)
UPDATE onetime.class_occurrences AS occurrence
SET occurrence_state = 'canceled',
    access_state = 'expired',
    schedule_version = occurrence.schedule_version + 1,
    version = occurrence.version + 1,
    updated_at = statement_timestamp()
FROM safe_pre_anchor
WHERE occurrence.occurrence_key = safe_pre_anchor.occurrence_key
  AND occurrence.occurrence_state <> 'completed';

WITH canonical_dates AS (
  SELECT
    series.account_key,
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
  WHERE series.is_canonical = true
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
SELECT
  canonical.class_series_key || ':' || to_char(canonical.local_class_date, 'YYYY-MM-DD'),
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
DO UPDATE SET
  starts_at = EXCLUDED.starts_at,
  reminder_due_at = EXCLUDED.reminder_due_at,
  joinable_until = EXCLUDED.joinable_until,
  occurrence_state = 'scheduled',
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

CREATE OR REPLACE FUNCTION onetime.reject_class_launch_timing_correction_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'class launch timing correction evidence is append-only';
END;
$$;

CREATE TRIGGER class_launch_timing_corrections_append_only
BEFORE UPDATE OR DELETE ON onetime.class_launch_timing_correction_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_class_launch_timing_correction_mutation();
-- @postgres-only-end

SELECT 1;
