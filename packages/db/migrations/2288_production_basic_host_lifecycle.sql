CREATE TABLE IF NOT EXISTS onetime.production_basic_host_lifecycles (
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  meeting_ref_digest text NOT NULL,
  provider_meeting_instance_digest text,
  lifecycle_context_digest text NOT NULL,
  actor_ref_digest text NOT NULL,
  session_ref_digest text NOT NULL,
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
    AND length(session_ref_digest) = 64
    AND session_ref_digest = lower(session_ref_digest)
    AND (
      provider_meeting_instance_digest IS NULL
      OR (
        length(provider_meeting_instance_digest) = 64
        AND provider_meeting_instance_digest = lower(provider_meeting_instance_digest)
      )
    )
  ),
  CONSTRAINT production_basic_host_lifecycles_state_check CHECK (
    lifecycle_state IN ('live', 'end_requested', 'unknown_effect', 'provider_ended', 'cleanup_pending', 'ended')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS production_basic_host_lifecycles_instance_uq
  ON onetime.production_basic_host_lifecycles (
    account_key,
    product_key,
    meeting_ref_digest,
    provider_meeting_instance_digest
  )
  WHERE provider_meeting_instance_digest IS NOT NULL;

CREATE INDEX IF NOT EXISTS production_basic_host_lifecycles_current_idx
  ON onetime.production_basic_host_lifecycles (
    account_key,
    product_key,
    meeting_ref_digest,
    expires_at DESC
  );

CREATE TABLE IF NOT EXISTS onetime.production_basic_zoom_lifecycle_events (
  provider_event_key_digest text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_ref_digest text NOT NULL,
  provider_host_ref_digest text NOT NULL,
  meeting_ref_digest text NOT NULL,
  meeting_instance_digest text NOT NULL,
  occurrence_key text,
  event_type text NOT NULL,
  provider_event_at timestamptz NOT NULL,
  meeting_started_at timestamptz NOT NULL,
  meeting_ended_at timestamptz,
  correlation_state text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_basic_zoom_lifecycle_events_occurrence_fk
    FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  CONSTRAINT production_basic_zoom_lifecycle_events_digest_check CHECK (
    length(provider_event_key_digest) = 64
    AND provider_event_key_digest = lower(provider_event_key_digest)
    AND length(provider_account_ref_digest) = 64
    AND provider_account_ref_digest = lower(provider_account_ref_digest)
    AND length(provider_host_ref_digest) = 64
    AND provider_host_ref_digest = lower(provider_host_ref_digest)
    AND length(meeting_ref_digest) = 64
    AND meeting_ref_digest = lower(meeting_ref_digest)
    AND length(meeting_instance_digest) = 64
    AND meeting_instance_digest = lower(meeting_instance_digest)
  ),
  CONSTRAINT production_basic_zoom_lifecycle_events_type_check CHECK (
    event_type IN ('meeting_started', 'meeting_ended')
  ),
  CONSTRAINT production_basic_zoom_lifecycle_events_state_check CHECK (
    correlation_state IN ('pending', 'correlated')
  ),
  CONSTRAINT production_basic_zoom_lifecycle_events_time_check CHECK (
    meeting_ended_at IS NULL OR meeting_ended_at >= meeting_started_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS production_basic_zoom_lifecycle_events_semantic_uq
  ON onetime.production_basic_zoom_lifecycle_events (
    account_key,
    product_key,
    event_type,
    meeting_instance_digest,
    provider_event_at
  );

CREATE INDEX IF NOT EXISTS production_basic_zoom_lifecycle_events_correlation_idx
  ON onetime.production_basic_zoom_lifecycle_events (
    account_key,
    product_key,
    meeting_ref_digest,
    occurrence_key,
    meeting_instance_digest,
    event_type,
    provider_event_at
  );

SELECT 1;
