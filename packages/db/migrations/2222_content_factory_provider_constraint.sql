-- Forward-only repair for PostgreSQL's 63-byte identifier truncation.
-- 2214's generated OpenAI-only constraint and 2221's explicit replacement
-- truncate to different names, so both can coexist on PostgreSQL.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory__transcription_provider_check;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_transcription_provider_;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_transcription_provider_check;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_constraint_12;

ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD CONSTRAINT learning_delivery_cf_provider_check
  CHECK (transcription_provider IN ('openai', 'synthetic'));
