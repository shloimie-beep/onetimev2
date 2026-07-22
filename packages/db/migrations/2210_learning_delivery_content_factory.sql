CREATE TABLE onetime.learning_delivery_content_factory_items (
  source_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('drive', 'local_drop')),
  source_ref_digest text NOT NULL,
  source_sha256 text NOT NULL,
  display_name text NOT NULL,
  mime_type text NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length > 0),
  factory_state text NOT NULL CHECK (factory_state IN (
    'incoming', 'processing', 'transcribed', 'rendered', 'uploaded',
    'needs_review', 'approved', 'published', 'failed'
  )),
  original_duration_ms integer NOT NULL CHECK (original_duration_ms >= 0),
  prepared_duration_ms integer NOT NULL CHECK (prepared_duration_ms >= 0),
  trim_start_ms integer NOT NULL CHECK (trim_start_ms >= 0),
  trim_end_ms integer NOT NULL CHECK (trim_end_ms >= trim_start_ms),
  removed_start_ms integer NOT NULL DEFAULT 0 CHECK (removed_start_ms >= 0),
  removed_end_ms integer NOT NULL DEFAULT 0 CHECK (removed_end_ms >= 0),
  trim_confidence numeric(5,4) NOT NULL CHECK (trim_confidence >= 0 AND trim_confidence <= 1),
  safe_duration boolean NOT NULL DEFAULT true,
  middle_cut_performed boolean NOT NULL DEFAULT false CHECK (middle_cut_performed = false),
  transcript_segments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  normalized_transcript text NOT NULL,
  transcript_sha256 text NOT NULL,
  webvtt text NOT NULL,
  webvtt_sha256 text NOT NULL,
  transcription_provider text NOT NULL DEFAULT 'openai' CHECK (transcription_provider = 'openai'),
  transcription_model text NOT NULL,
  transcription_language text NOT NULL,
  transcript_review_state text NOT NULL DEFAULT 'draft'
    CHECK (transcript_review_state IN ('draft', 'approved', 'rejected')),
  draft_json jsonb NOT NULL,
  provider_video_id text,
  provider_embed_url text,
  provider_text_track_id text,
  vimeo_privacy text NOT NULL CHECK (vimeo_privacy IN (
    'private', 'unlisted', 'password', 'review_required'
  )),
  captions_active boolean NOT NULL DEFAULT false,
  progress_state text NOT NULL DEFAULT 'not_started'
    CHECK (progress_state IN ('not_started', 'in_progress', 'completed')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_safe_error_code text,
  approved_by_user_key text,
  approved_at timestamptz,
  published_by_user_key text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, source_sha256),
  CHECK (provider_embed_url IS NULL OR provider_embed_url LIKE 'https://player.vimeo.com/%'),
  CHECK (factory_state <> 'published' OR (
    transcript_review_state = 'approved'
    AND approved_at IS NOT NULL
    AND published_at IS NOT NULL
    AND provider_video_id IS NOT NULL
    AND provider_embed_url IS NOT NULL
    AND captions_active = true
  ))
);

CREATE INDEX learning_delivery_content_factory_queue_idx
  ON onetime.learning_delivery_content_factory_items(
    account_key, product_key, factory_state, updated_at DESC
  );

CREATE TABLE onetime.learning_delivery_content_factory_events (
  event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_key text NOT NULL REFERENCES onetime.learning_delivery_content_factory_items(source_key),
  actor_user_key text,
  action text NOT NULL,
  previous_state text,
  next_state text,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX learning_delivery_content_factory_events_source_idx
  ON onetime.learning_delivery_content_factory_events(
    account_key, product_key, source_key, created_at DESC
  );
