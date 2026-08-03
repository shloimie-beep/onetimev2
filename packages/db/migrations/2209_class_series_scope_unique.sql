ALTER TABLE onetime.class_series
  DROP CONSTRAINT IF EXISTS class_series_class_series_key_key;

DROP INDEX IF EXISTS onetime.class_series_class_series_key_key;
