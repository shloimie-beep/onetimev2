ALTER TABLE onetime.class_series
  ADD COLUMN IF NOT EXISTS is_canonical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN IF NOT EXISTS local_start_time time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS teacher_profile_key text,
  ADD COLUMN IF NOT EXISTS embedded_classroom_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE onetime.class_series
  DROP CONSTRAINT IF EXISTS class_series_series_state_check;

UPDATE onetime.class_series
   SET series_state = CASE status
         WHEN 'paused' THEN 'paused'
         WHEN 'archived' THEN 'archived'
         ELSE 'active'
       END,
       version = version + 1
 WHERE series_state = 'inactive';

ALTER TABLE onetime.class_series
  ADD CONSTRAINT class_series_series_state_check
    CHECK (series_state IN ('draft', 'active', 'paused', 'archived')),
  ADD CONSTRAINT class_series_timezone_check
    CHECK (timezone = 'Asia/Jerusalem');

CREATE UNIQUE INDEX class_series_canonical_idx
  ON onetime.class_series(account_key, product_key)
  WHERE is_canonical = true;

ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS scheduled_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS join_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS join_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE onetime.class_occurrences
   SET scheduled_ends_at = COALESCE(scheduled_ends_at, starts_at + interval '60 minutes'),
       join_opens_at = COALESCE(join_opens_at, starts_at - interval '10 minutes'),
       join_closes_at = COALESCE(join_closes_at, starts_at + interval '75 minutes');

ALTER TABLE onetime.class_occurrences
  DROP CONSTRAINT IF EXISTS class_occurrences_occurrence_state_check;

UPDATE onetime.class_occurrences
   SET occurrence_state = CASE occurrence_state
         WHEN 'rescheduled' THEN 'scheduled'
         WHEN 'cancelled' THEN 'canceled'
         ELSE occurrence_state
       END,
       schedule_version = CASE
         WHEN occurrence_state = 'rescheduled' THEN schedule_version + 1
         ELSE schedule_version
       END,
       version = version + 1
 WHERE occurrence_state IN ('rescheduled', 'cancelled');

ALTER TABLE onetime.class_occurrences
  ALTER COLUMN scheduled_ends_at SET NOT NULL,
  ALTER COLUMN join_opens_at SET NOT NULL,
  ALTER COLUMN join_closes_at SET NOT NULL,
  DROP CONSTRAINT IF EXISTS class_occurrences_version_check,
  DROP CONSTRAINT IF EXISTS class_occurrences_schedule_version_check,
  DROP CONSTRAINT IF EXISTS class_occurrences_schedule_window_check,
  ADD CONSTRAINT class_occurrences_occurrence_state_check
    CHECK (occurrence_state IN ('scheduled', 'preparing', 'ready', 'live', 'completed', 'canceled')),
  ADD CONSTRAINT class_occurrences_version_check CHECK (version > 0),
  ADD CONSTRAINT class_occurrences_schedule_version_check CHECK (schedule_version > 0),
  ADD CONSTRAINT class_occurrences_schedule_window_check CHECK (
    scheduled_ends_at > starts_at
    AND join_opens_at < starts_at
    AND join_closes_at >= scheduled_ends_at
  );

CREATE TABLE onetime.class_series_enrollments (
  enrollment_key text PRIMARY KEY CHECK (enrollment_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  class_series_key text NOT NULL,
  learner_key text NOT NULL CHECK (learner_key <> ''),
  household_key text NOT NULL CHECK (household_key <> ''),
  enrollment_state text NOT NULL CHECK (enrollment_state IN ('active', 'revoked')),
  source text NOT NULL CHECK (source <> ''),
  effective_at timestamptz NOT NULL,
  revoked_at timestamptz,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  audit_ref text NOT NULL CHECK (audit_ref <> ''),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (account_key, product_key, class_series_key, learner_key),
  UNIQUE (account_key, product_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key),
  CHECK (
    (enrollment_state = 'active' AND revoked_at IS NULL)
    OR (enrollment_state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX class_series_enrollments_household_idx
  ON onetime.class_series_enrollments(account_key, product_key, household_key, enrollment_state);

CREATE TABLE onetime.classroom_core_commands (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  operation text NOT NULL CHECK (operation <> ''),
  result_version bigint NOT NULL CHECK (result_version > 0),
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

-- @postgres-only-begin
UPDATE onetime.class_series
   SET is_canonical = false;

WITH canonical_candidate AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY account_key, product_key
           ORDER BY
             CASE series_state
               WHEN 'active' THEN 0
               WHEN 'paused' THEN 1
               WHEN 'archived' THEN 2
               WHEN 'draft' THEN 3
               ELSE 4
             END,
             CASE
               WHEN timezone = 'Asia/Jerusalem'
                AND local_start_time = '19:00'
                AND recurrence_weekdays = ARRAY[1,2,3,4,7]::smallint[]
               THEN 0
               ELSE 1
             END,
             created_at,
             class_series_key
         ) AS candidate_rank
    FROM onetime.class_series
)
UPDATE onetime.class_series AS series
   SET is_canonical = true,
       timezone = 'Asia/Jerusalem',
       local_start_time = '19:00',
       duration_minutes = 60,
       recurrence_weekdays = ARRAY[1,2,3,4,7]::smallint[],
       teacher_profile_key = COALESCE(series.teacher_profile_key, series.teacher_name, 'unassigned'),
       embedded_classroom_required = true,
       recording_enabled = true,
       version = series.version + 1,
       updated_at = now()
  FROM canonical_candidate
 WHERE series.ctid = canonical_candidate.ctid
   AND canonical_candidate.candidate_rank = 1;

WITH missing_scope AS (
  SELECT scope.account_key,
         scope.product_key,
         row_number() OVER (ORDER BY scope.account_key, scope.product_key) AS scope_rank
    FROM (
      SELECT DISTINCT account_key, product_key
        FROM onetime.portal_households
      UNION
      SELECT DISTINCT account_key, product_key
        FROM onetime.class_series
    ) AS scope
   WHERE NOT EXISTS (
     SELECT 1
       FROM onetime.class_series AS canonical
      WHERE canonical.account_key = scope.account_key
        AND canonical.product_key = scope.product_key
        AND canonical.is_canonical = true
   )
)
INSERT INTO onetime.class_series (
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
  duration_minutes,
  teacher_profile_key,
  embedded_classroom_required,
  recording_enabled,
  version,
  created_at,
  updated_at
)
SELECT CASE
         WHEN scope_rank = 1
          AND NOT EXISTS (
            SELECT 1
              FROM onetime.class_series
             WHERE class_series_key = 'canonical-class'
          )
         THEN 'canonical-class'
         ELSE 'canonical-class-' || substr(md5(account_key || ':' || product_key), 1, 24)
       END,
       account_key,
       product_key,
       'Canonical Sunday-Thursday Class',
       'Asia/Jerusalem',
       '19:00',
       '18:30',
       30,
       'active',
       'active',
       true,
       ARRAY[1,2,3,4,7]::smallint[],
       CURRENT_DATE,
       60,
       'unassigned',
       true,
       true,
       1,
       now(),
       now()
  FROM missing_scope;

CREATE OR REPLACE FUNCTION onetime.enforce_canonical_class_series()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_count integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT count(*)
      INTO canonical_count
      FROM onetime.class_series
     WHERE account_key = OLD.account_key
       AND product_key = OLD.product_key
       AND is_canonical = true;
    IF canonical_count <> 1 THEN
      RAISE EXCEPTION 'class series scope must retain exactly one canonical series';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE'
     AND (
       TG_OP = 'INSERT'
       OR NEW.account_key IS DISTINCT FROM OLD.account_key
       OR NEW.product_key IS DISTINCT FROM OLD.product_key
     ) THEN
    SELECT count(*)
      INTO canonical_count
      FROM onetime.class_series
     WHERE account_key = NEW.account_key
       AND product_key = NEW.product_key
       AND is_canonical = true;
    IF canonical_count <> 1 THEN
      RAISE EXCEPTION 'class series scope must contain exactly one canonical series';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER class_series_canonical_exists_guard
AFTER INSERT OR UPDATE OR DELETE ON onetime.class_series
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_canonical_class_series();
-- @postgres-only-end
