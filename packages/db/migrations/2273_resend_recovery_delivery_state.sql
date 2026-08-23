ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_constraint_5;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_state_check;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  ADD CONSTRAINT account_lifecycle_delivery_outbox_state_check
  CHECK (state IN (
    'queued',
    'leased',
    'retry',
    'unknown',
    'sink_delivered',
    'provider_accepted',
    'provider_delivered',
    'delivered',
    'bounced',
    'complained',
    'failed',
    'provider_off',
    'dead_letter',
    'superseded',
    'expired',
    'cleared'
  ));

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_constraint_8;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_check;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  ADD CONSTRAINT account_lifecycle_delivery_outbox_payload_check
  CHECK (
    state IN (
      'sink_delivered',
      'provider_accepted',
      'provider_delivered',
      'dead_letter',
      'superseded',
      'expired',
      'cleared'
    )
    OR (nonce IS NOT NULL AND ciphertext IS NOT NULL AND auth_tag IS NOT NULL)
  );

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  ADD COLUMN provider_accepted_at timestamptz,
  ADD COLUMN final_delivery_state text
    CHECK (
      final_delivery_state IS NULL
      OR final_delivery_state IN ('delivered', 'bounced', 'complained', 'failed')
    ),
  ADD COLUMN final_state_at timestamptz,
  ADD COLUMN last_provider_event_at timestamptz;

CREATE INDEX account_lifecycle_delivery_outbox_provider_message_idx
  ON onetime.account_lifecycle_delivery_outbox(
    account_key,
    product_key,
    provider_message_ref_hash
  )
  WHERE provider_message_ref_hash IS NOT NULL;

SELECT 1;
