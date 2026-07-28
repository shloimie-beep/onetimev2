/**
 * P15 does not own the shared migrations directory. This contract records the
 * schema delta that the migration steward must apply before repository wiring.
 */
export const CALENDAR_SCHEMA_CONTRACT = {
  version: 'P15-CALENDAR-SCHEMA-001',
  existingTables: [
    'onetime.class_series',
    'onetime.class_occurrences',
    'onetime.classroom_occurrence_learner_entitlements',
    'onetime.classroom_recordings',
  ],
  requiredSeriesColumns: {
    recurrence_weekdays: 'smallint[] NOT NULL',
    recurrence_starts_on: 'date NOT NULL',
    recurrence_ends_on: 'date NULL',
    duration_minutes: 'integer NOT NULL',
    series_state: "text NOT NULL CHECK (series_state IN ('draft','active','inactive'))",
    version: 'integer NOT NULL DEFAULT 1',
  },
  requiredOccurrenceConstraint:
    'UNIQUE (account_key, product_key, class_series_key, local_class_date)',
  requiredIndexes: [
    '(account_key, product_key, starts_at)',
    '(account_key, product_key, class_series_key, local_class_date)',
  ],
} as const;
