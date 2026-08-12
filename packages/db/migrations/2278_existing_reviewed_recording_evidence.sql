-- @postgres-only-begin
-- The source row and domain validation carry the full typed evidence. This
-- table retains only the protected, append-only evidence record and must not
-- force a historical recording to impersonate an OBS occurrence capture.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT constraint_row.conname
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'onetime'
       AND relation.relname = 'content_processing_capture_evidence'
       AND constraint_row.contype = 'c'
       AND (
         pg_get_constraintdef(constraint_row.oid) LIKE '%evidence_version = ''OT-OBS-CAPTURE-1''%'
         OR pg_get_constraintdef(constraint_row.oid) LIKE '%captureMethod%'
         OR pg_get_constraintdef(constraint_row.oid) LIKE '%zoomCloudRecordingDisabled%'
         OR pg_get_constraintdef(constraint_row.oid) LIKE '%controlledEncryptedDevice%'
       )
  LOOP
    EXECUTE format(
      'ALTER TABLE onetime.content_processing_capture_evidence DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END;
$$;

ALTER TABLE onetime.content_processing_capture_evidence
  ADD CONSTRAINT content_processing_source_evidence_kind_check
  CHECK (
    (
      evidence_version = 'OT-OBS-CAPTURE-1'
      AND record_json ->> 'captureMethod' = 'obs'
      AND record_json ->> 'zoomCloudRecordingDisabled' = 'true'
      AND record_json ->> 'controlledEncryptedDevice' = 'true'
    )
    OR (
      evidence_version = 'OT-EXISTING-REVIEWED-RECORDING-1'
      AND record_json ->> 'captureMethod' = 'existing_reviewed_recording'
      AND record_json -> 'attestation' ->> 'rightsToProcessAndPrivatelyPublish' = 'true'
      AND record_json -> 'attestation' ->> 'noUnreviewedChildData' = 'true'
      AND record_json -> 'attestation' ->> 'childDataDisposition'
        IN ('none_present', 'redactions_complete')
    )
  );
-- @postgres-only-end
SELECT 1;
