ALTER TABLE onetime.billing_verified_events
  ADD COLUMN processing_state text NOT NULL DEFAULT 'pending'
    CHECK (processing_state IN ('pending', 'processing', 'completed')),
  ADD COLUMN processing_claim_key text,
  ADD COLUMN processing_lease_until timestamptz,
  ADD COLUMN processed_at timestamptz;

UPDATE onetime.billing_verified_events
   SET processing_state = 'completed',
       processed_at = created_at
 WHERE event_key IN (
   SELECT DISTINCT attempt.event_key
     FROM onetime.billing_event_processing_attempts AS attempt
 );

ALTER TABLE onetime.billing_verified_events
  ADD CONSTRAINT billing_verified_event_processing_state_check CHECK (
    (
      processing_state = 'pending'
      AND processing_claim_key IS NULL
      AND processing_lease_until IS NULL
      AND processed_at IS NULL
    )
    OR (
      processing_state = 'processing'
      AND processing_claim_key IS NOT NULL
      AND processing_lease_until IS NOT NULL
      AND processed_at IS NULL
    )
    OR (
      processing_state = 'completed'
      AND processing_claim_key IS NULL
      AND processing_lease_until IS NULL
      AND processed_at IS NOT NULL
    )
  );

CREATE INDEX billing_verified_event_processing_recovery_idx
  ON onetime.billing_verified_events(processing_state, processing_lease_until, created_at)
  WHERE processing_state <> 'completed';

-- @postgres-only-begin
COMMENT ON COLUMN onetime.billing_verified_events.processing_state IS
  'Local projection lifecycle only. A completed state is written after the exact signed Stripe TEST event has finished application projection; provider replay may reclaim pending or expired processing rows.';
-- @postgres-only-end
