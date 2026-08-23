ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS production_basic_live_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_basic_live_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_basic_meeting_ref_digest text;

ALTER TABLE onetime.class_occurrences
  DROP CONSTRAINT IF EXISTS class_occurrences_production_basic_live_receipt_check,
  ADD CONSTRAINT class_occurrences_production_basic_live_receipt_check CHECK (
    (
      production_basic_live_confirmed_at IS NULL
      AND production_basic_live_expires_at IS NULL
      AND production_basic_meeting_ref_digest IS NULL
    )
    OR (
      production_basic_live_confirmed_at IS NOT NULL
      AND production_basic_live_expires_at > production_basic_live_confirmed_at
      AND production_basic_live_expires_at
        <= production_basic_live_confirmed_at + interval '2 hours'
      AND production_basic_meeting_ref_digest IS NOT NULL
      AND length(production_basic_meeting_ref_digest) = 64
      AND production_basic_meeting_ref_digest = lower(production_basic_meeting_ref_digest)
    )
  );

CREATE INDEX IF NOT EXISTS class_occurrences_production_basic_live_idx
  ON onetime.class_occurrences (
    account_key,
    product_key,
    production_basic_live_expires_at DESC,
    occurrence_key
  )
  WHERE production_basic_live_expires_at IS NOT NULL;

SELECT 1;
