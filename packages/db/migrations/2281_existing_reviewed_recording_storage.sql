-- @postgres-only-begin
-- Keep the historical participant-snapshot column exclusive to OBS evidence.
-- The launch exception stores its independently reviewed-source digest in a
-- separate field, rather than placing it in a misleading OBS-named column.
ALTER TABLE onetime.content_processing_capture_evidence
  ALTER COLUMN participant_snapshot_digest DROP NOT NULL,
  ADD COLUMN source_review_digest text;

ALTER TABLE onetime.content_processing_capture_evidence
  ADD CONSTRAINT content_processing_source_review_digest_check
  CHECK (
    (
      evidence_version = 'OT-OBS-CAPTURE-1'
      AND participant_snapshot_digest ~ '^[0-9a-f]{64}$'
      AND source_review_digest IS NULL
    )
    OR (
      evidence_version = 'OT-EXISTING-REVIEWED-RECORDING-1'
      AND participant_snapshot_digest IS NULL
      AND source_review_digest ~ '^[0-9a-f]{64}$'
    )
  );
-- @postgres-only-end
SELECT 1;
