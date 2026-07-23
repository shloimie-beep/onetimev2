-- Forward-only repair for the unnamed 2214 publication check.
-- PostgreSQL assigned that second unnamed CHECK the generated `..._check1`
-- identifier, so 2221's attempted `..._check` removal did not reach it.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_check1;

-- pg-mem has used these ordinal aliases for the same 2214 check.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_constraint_18;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_cf_publish_ready_check;

-- Durable playback stores an opaque provider asset ID and serves it only through
-- a first-party authorization route. A raw Vimeo embed URL is never required.
ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD CONSTRAINT learning_delivery_cf_publish_ready_check
  CHECK (
    factory_state <> 'published'
    OR (
      transcript_review_state = 'approved'
      AND approved_at IS NOT NULL
      AND published_at IS NOT NULL
      AND provider_video_id IS NOT NULL
      AND captions_active = true
    )
  );
