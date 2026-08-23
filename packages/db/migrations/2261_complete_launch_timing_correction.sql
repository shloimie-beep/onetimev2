-- Correct the configured complete-launch boundary without rewriting the
-- historical signup receipts that prove what the service returned at commit
-- time. The projection correction is narrowly evidenced before the guarded
-- rows are updated, and append-only protection is restored in this transaction.
-- @postgres-only-begin
CREATE TABLE onetime.family_signup_access_timing_correction_receipts (
  correction_key text NOT NULL,
  household_id text NOT NULL,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  previous_free_access_expires_at timestamptz NOT NULL,
  corrected_free_access_expires_at timestamptz NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (
    correction_key,
    product,
    runtime_tier,
    verification_environment_id,
    household_id
  ),
  CHECK (correction_key = 'complete-launch-2026-08-05'),
  CHECK (
    previous_free_access_expires_at = timestamptz '2026-09-13T16:24:00.000Z'
    AND corrected_free_access_expires_at = timestamptz '2026-09-11T15:00:00.000Z'
  )
);

INSERT INTO onetime.family_signup_access_timing_correction_receipts (
  correction_key,
  household_id,
  product,
  runtime_tier,
  verification_environment_id,
  previous_free_access_expires_at,
  corrected_free_access_expires_at
)
SELECT
  'complete-launch-2026-08-05',
  projection.household_id,
  projection.product,
  projection.runtime_tier,
  projection.verification_environment_id,
  projection.free_access_expires_at,
  timestamptz '2026-09-11T15:00:00.000Z'
FROM onetime.family_signup_access_projections AS projection
WHERE projection.access_branch = 'immediate_free'
  AND projection.access_state = 'free'
  AND projection.free_access_expires_at = timestamptz '2026-09-13T16:24:00.000Z';

DROP TRIGGER IF EXISTS family_signup_access_append_only
  ON onetime.family_signup_access_projections;

UPDATE onetime.family_signup_access_projections
SET free_access_expires_at = timestamptz '2026-09-11T15:00:00.000Z'
WHERE access_branch = 'immediate_free'
  AND access_state = 'free'
  AND free_access_expires_at = timestamptz '2026-09-13T16:24:00.000Z';

CREATE TRIGGER family_signup_access_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_access_projections
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE TRIGGER family_signup_access_timing_corrections_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_access_timing_correction_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();
-- @postgres-only-end

SELECT 1;
