ALTER TABLE onetime.class_series
  ADD COLUMN IF NOT EXISTS recurrence_weekdays smallint[] NOT NULL DEFAULT ARRAY[1]::smallint[],
  ADD COLUMN IF NOT EXISTS recurrence_starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS recurrence_ends_on date,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS series_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE onetime.class_series
   SET series_state = CASE
         WHEN status = 'active' THEN 'active'
         ELSE 'inactive'
       END,
       duration_minutes = CASE
         WHEN duration_minutes > 0 THEN duration_minutes
         ELSE 60
       END,
       version = CASE
         WHEN version > 0 THEN version
         ELSE 1
       END;

ALTER TABLE onetime.class_series
  DROP CONSTRAINT IF EXISTS class_series_series_state_check,
  DROP CONSTRAINT IF EXISTS class_series_recurrence_window_check,
  DROP CONSTRAINT IF EXISTS class_series_duration_minutes_check,
  DROP CONSTRAINT IF EXISTS class_series_version_check,
  ADD CONSTRAINT class_series_series_state_check
    CHECK (series_state IN ('draft', 'active', 'inactive')),
  ADD CONSTRAINT class_series_recurrence_window_check
    CHECK (recurrence_ends_on IS NULL OR recurrence_ends_on >= recurrence_starts_on),
  ADD CONSTRAINT class_series_duration_minutes_check
    CHECK (duration_minutes BETWEEN 1 AND 1440),
  ADD CONSTRAINT class_series_version_check
    CHECK (version > 0);

ALTER TABLE onetime.class_occurrences
  DROP CONSTRAINT IF EXISTS class_occurrences_occurrence_state_check,
  ADD CONSTRAINT class_occurrences_occurrence_state_check
    CHECK (
      occurrence_state IN (
        'scheduled',
        'rescheduled',
        'live',
        'completed',
        'cancelled'
      )
    );

CREATE INDEX class_series_recurrence_window_idx
  ON onetime.class_series(
    account_key,
    product_key,
    series_state,
    recurrence_starts_on,
    recurrence_ends_on
  );

-- @postgres-only-begin
UPDATE onetime.class_series AS series
   SET recurrence_starts_on = COALESCE(
         (
           SELECT min(occurrence.local_class_date)
             FROM onetime.class_occurrences AS occurrence
            WHERE occurrence.account_key = series.account_key
              AND occurrence.product_key = series.product_key
              AND occurrence.class_series_key = series.class_series_key
         ),
         series.recurrence_starts_on
       ),
       recurrence_weekdays = COALESCE(
         (
           SELECT array_agg(day_value ORDER BY day_value)::smallint[]
             FROM (
               SELECT DISTINCT extract(isodow FROM occurrence.local_class_date)::smallint AS day_value
                 FROM onetime.class_occurrences AS occurrence
                WHERE occurrence.account_key = series.account_key
                  AND occurrence.product_key = series.product_key
                  AND occurrence.class_series_key = series.class_series_key
             ) AS recurrence_days
         ),
         series.recurrence_weekdays
       );

ALTER TABLE onetime.class_series
  ADD CONSTRAINT class_series_recurrence_weekdays_check
  CHECK (
    cardinality(recurrence_weekdays) BETWEEN 1 AND 7
    AND recurrence_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
  );

CREATE OR REPLACE FUNCTION onetime.reject_draft_series_occurrence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM onetime.class_series
     WHERE account_key = NEW.account_key
       AND product_key = NEW.product_key
       AND class_series_key = NEW.class_series_key
       AND series_state = 'draft'
  ) THEN
    RAISE EXCEPTION 'draft class series cannot produce an occurrence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER class_occurrence_draft_series_guard
BEFORE INSERT OR UPDATE OF account_key, product_key, class_series_key
ON onetime.class_occurrences
FOR EACH ROW EXECUTE FUNCTION onetime.reject_draft_series_occurrence();
-- @postgres-only-end
