ALTER TABLE onetime.whatsapp_outbox_messages
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  ADD COLUMN provider_message_ref_ciphertext text,
  ADD COLUMN provider_message_ref_iv text,
  ADD COLUMN provider_message_ref_tag text,
  ADD COLUMN provider_response_status integer,
  ADD COLUMN provider_retry_after_ms integer;

CREATE INDEX whatsapp_outbox_lease_reclaim_idx
  ON onetime.whatsapp_outbox_messages(account_key, product_key, lease_expires_at, outbox_message_key)
  WHERE status = 'sending';

CREATE INDEX whatsapp_outbox_provider_ref_hash_idx
  ON onetime.whatsapp_outbox_messages(account_key, product_key, provider_account_key, provider_message_ref_hash)
  WHERE provider_message_ref_hash IS NOT NULL;

ALTER TABLE onetime.whatsapp_delivery_events
  ADD COLUMN provider_status_event_key text,
  ADD COLUMN provider_response_status integer;

CREATE UNIQUE INDEX whatsapp_delivery_status_event_key_idx
  ON onetime.whatsapp_delivery_events(provider_status_event_key)
  WHERE provider_status_event_key IS NOT NULL;
