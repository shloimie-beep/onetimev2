ALTER TABLE onetime.class_series
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS teacher_name text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version >= 1);

ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN IF NOT EXISTS is_operator_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operator_test_environment text;

ALTER TABLE onetime.class_occurrences
  ADD CONSTRAINT class_occurrences_operator_test_scope_check
  CHECK (
    (is_operator_test = false AND operator_test_environment IS NULL)
    OR
    (is_operator_test = true AND operator_test_environment IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS class_occurrence_enrollment_household_idx
  ON onetime.classroom_occurrence_learner_entitlements(
    account_key,
    product_key,
    household_key,
    learner_key,
    entitlement_state,
    occurrence_key
  );

CREATE INDEX IF NOT EXISTS content_entitlements_learner_item_idx
  ON onetime.content_item_entitlements(
    account_key,
    product_key,
    learner_key,
    content_item_key,
    entitlement_state
  )
  WHERE learner_key IS NOT NULL;
