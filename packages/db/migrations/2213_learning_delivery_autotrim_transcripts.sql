ALTER TABLE onetime.learning_delivery_transcripts
  ADD COLUMN IF NOT EXISTS provider_model text,
  ADD COLUMN IF NOT EXISTS provider_model_version text,
  ADD COLUMN IF NOT EXISTS source_sha256 text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS corrected_transcript_version text,
  ADD COLUMN IF NOT EXISTS vocabulary_prompt_sha256 text,
  ADD COLUMN IF NOT EXISTS approved_torah_interpretation boolean NOT NULL DEFAULT false;

ALTER TABLE onetime.learning_delivery_transcripts
  DROP CONSTRAINT IF EXISTS learning_delivery_transcripts_approved_torah_interpretation_check;

ALTER TABLE onetime.learning_delivery_transcripts
  ADD CONSTRAINT learning_delivery_transcripts_approved_torah_interpretation_check
  CHECK (approved_torah_interpretation = false);

ALTER TABLE onetime.learning_delivery_trim_reviews
  ADD COLUMN IF NOT EXISTS requires_operator_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS confidence_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS safe_exception_code text,
  ADD COLUMN IF NOT EXISTS removed_start_ms integer NOT NULL DEFAULT 0 CHECK (removed_start_ms >= 0),
  ADD COLUMN IF NOT EXISTS removed_end_ms integer NOT NULL DEFAULT 0 CHECK (removed_end_ms >= 0),
  ADD COLUMN IF NOT EXISTS removed_percent numeric(6,5) NOT NULL DEFAULT 0 CHECK (removed_percent >= 0 AND removed_percent <= 1),
  ADD COLUMN IF NOT EXISTS opening_window_ms integer CHECK (opening_window_ms IS NULL OR opening_window_ms > 0),
  ADD COLUMN IF NOT EXISTS closing_window_ms integer CHECK (closing_window_ms IS NULL OR closing_window_ms > 0);

ALTER TABLE onetime.learning_delivery_trim_reviews
  DROP CONSTRAINT IF EXISTS learning_delivery_trim_reviews_reason_code_check;

ALTER TABLE onetime.learning_delivery_trim_reviews
  DROP CONSTRAINT IF EXISTS learning_delivery_trim_reviews_auto_cut_performed_check;

ALTER TABLE onetime.learning_delivery_trim_reviews
  ADD CONSTRAINT learning_delivery_trim_reviews_reason_code_check
  CHECK (reason_code IN (
    'leading_trailing_silence',
    'no_safe_trim_detected',
    'manual_operator_decision',
    'automatic_edge_trim',
    'safe_no_trim_exception'
  ));

ALTER TABLE onetime.learning_delivery_trim_reviews
  ADD CONSTRAINT learning_delivery_trim_reviews_automatic_decision_check
  CHECK (
    (auto_cut_performed = true
      AND requires_operator_approval = false
      AND decision_state = 'approved'
      AND reason_code = 'automatic_edge_trim')
    OR
    (auto_cut_performed = false)
  );

ALTER TABLE onetime.learning_delivery_trim_reviews
  ADD CONSTRAINT learning_delivery_trim_reviews_confidence_check
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
