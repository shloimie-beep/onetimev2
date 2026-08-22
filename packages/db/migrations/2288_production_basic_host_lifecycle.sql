CREATE TABLE IF NOT EXISTS onetime.production_basic_host_lifecycles (
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  meeting_ref_digest text NOT NULL,
  lifecycle_context_digest text NOT NULL,
  actor_ref_digest text NOT NULL,
  lifecycle_state text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, occurrence_key),
  CONSTRAINT production_basic_host_lifecycles_digest_check CHECK (
    length(meeting_ref_digest) = 64
    AND meeting_ref_digest = lower(meeting_ref_digest)
    AND length(lifecycle_context_digest) = 64
    AND lifecycle_context_digest = lower(lifecycle_context_digest)
    AND length(actor_ref_digest) = 64
    AND actor_ref_digest = lower(actor_ref_digest)
  ),
  CONSTRAINT production_basic_host_lifecycles_state_check CHECK (
    lifecycle_state IN ('live', 'end_requested', 'unknown_effect', 'provider_ended', 'cleanup_pending', 'ended')
  )
);

CREATE INDEX IF NOT EXISTS production_basic_host_lifecycles_current_idx
  ON onetime.production_basic_host_lifecycles (
    account_key,
    product_key,
    meeting_ref_digest,
    expires_at DESC
  );

SELECT 1;
