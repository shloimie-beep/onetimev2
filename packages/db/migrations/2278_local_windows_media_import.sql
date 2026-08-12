ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_account_key_product_key_source_sha256_key;

-- PostgreSQL truncates the generated name of the original three-column UNIQUE constraint.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_fact_account_key_product_key_sour_key;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_transcription_provider_check;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_cf_provider_check;

ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD CONSTRAINT learning_delivery_content_factory_items_transcription_provider_check
  CHECK (transcription_provider IN ('openai', 'synthetic', 'off'));

CREATE UNIQUE INDEX IF NOT EXISTS content_factory_items_source_occurrence_unique_idx
  ON onetime.learning_delivery_content_factory_items(
    account_key, product_key, source_sha256, occurrence_key
  ) WHERE occurrence_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_factory_items_legacy_source_unique_idx
  ON onetime.learning_delivery_content_factory_items(
    account_key, product_key, source_sha256
  ) WHERE occurrence_key IS NULL;

CREATE TABLE IF NOT EXISTS onetime.local_media_signed_request_nonces (
  account_key text NOT NULL,
  product_key text NOT NULL,
  nonce text NOT NULL,
  request_digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, nonce),
  CHECK (length(request_digest) = 64 AND request_digest = lower(request_digest))
);

CREATE INDEX IF NOT EXISTS local_media_signed_request_nonces_received_idx
  ON onetime.local_media_signed_request_nonces(received_at);
