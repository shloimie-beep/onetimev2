ALTER TABLE onetime.outbox_events
  ADD COLUMN provider_operation_state text NOT NULL DEFAULT 'not_started'
    CHECK (provider_operation_state IN (
      'not_started',
      'in_flight',
      'accepted',
      'rejected',
      'acceptance_unknown'
    )),
  ADD COLUMN provider_operation_provider text,
  ADD COLUMN provider_operation_idempotency_key text,
  ADD COLUMN provider_acceptance_ref_hash text,
  ADD COLUMN provider_operation_dispatched_at timestamptz,
  ADD COLUMN provider_operation_accepted_at timestamptz,
  ADD COLUMN provider_operation_updated_at timestamptz,
  ADD CONSTRAINT outbox_events_provider_operation_identity_check CHECK (
    (
      provider_operation_state = 'not_started'
      AND provider_operation_provider IS NULL
      AND provider_operation_idempotency_key IS NULL
    )
    OR (
      provider_operation_state <> 'not_started'
      AND provider_operation_provider IS NOT NULL
      AND provider_operation_idempotency_key IS NOT NULL
    )
  ),
  ADD CONSTRAINT outbox_events_provider_acceptance_check CHECK (
    (
      provider_operation_state = 'accepted'
      AND provider_acceptance_ref_hash IS NOT NULL
      AND provider_operation_accepted_at IS NOT NULL
    )
    OR (
      provider_operation_state <> 'accepted'
      AND provider_acceptance_ref_hash IS NULL
      AND provider_operation_accepted_at IS NULL
    )
  );

CREATE UNIQUE INDEX outbox_events_provider_operation_key_uq
  ON onetime.outbox_events(
    account_key,
    product_key,
    provider_operation_provider,
    provider_operation_idempotency_key
  )
  WHERE provider_operation_idempotency_key IS NOT NULL;

CREATE INDEX outbox_events_provider_acceptance_unknown_idx
  ON onetime.outbox_events(account_key, product_key, provider_operation_updated_at, created_at)
  WHERE provider_operation_state = 'acceptance_unknown';
