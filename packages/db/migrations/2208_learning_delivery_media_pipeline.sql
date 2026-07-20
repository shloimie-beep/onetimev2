CREATE TABLE IF NOT EXISTS onetime.learning_delivery_media_sources (
  source_key text PRIMARY KEY,
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  source_kind text NOT NULL CHECK (source_kind IN (
    'drive_recording',
    'uploaded_file',
    'zoom_cloud_recording',
    'private_vimeo_reference'
  )),
  source_ref_digest text NOT NULL,
  source_sha256 text NOT NULL,
  display_name text NOT NULL,
  byte_length bigint CHECK (byte_length IS NULL OR byte_length >= 0),
  media_state text NOT NULL DEFAULT 'discovered' CHECK (media_state IN (
    'discovered',
    'downloading',
    'probing',
    'transcribing',
    'transcript_ready',
    'trim_review',
    'rendering',
    'vimeo_uploading',
    'vimeo_processing',
    'content_review',
    'ready_to_publish',
    'published',
    'failed'
  )),
  current_media_key text,
  current_transcript_key text,
  current_trim_review_key text,
  current_vimeo_source_key text,
  current_content_version_key text,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_safe_error_code text,
  lease_owner text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  terminal_at timestamptz,
  UNIQUE (account_key, product_key, source_kind, source_ref_digest, source_sha256)
);

CREATE INDEX IF NOT EXISTS learning_delivery_media_sources_queue_idx
  ON onetime.learning_delivery_media_sources(account_key, product_key, media_state, next_attempt_at, updated_at);

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_probe_reports (
  probe_key text PRIMARY KEY,
  source_key text NOT NULL REFERENCES onetime.learning_delivery_media_sources(source_key),
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  width integer CHECK (width IS NULL OR width >= 0),
  height integer CHECK (height IS NULL OR height >= 0),
  video_codec text,
  audio_codec text,
  stream_count integer NOT NULL CHECK (stream_count >= 0),
  ffprobe_json_sha256 text NOT NULL,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, ffprobe_json_sha256)
);

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_transcripts (
  transcript_key text PRIMARY KEY,
  source_key text NOT NULL REFERENCES onetime.learning_delivery_media_sources(source_key),
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  transcript_source text NOT NULL CHECK (transcript_source IN (
    'openai_transcription',
    'vimeo_text_track',
    'manual_transcript'
  )),
  transcript_sha256 text NOT NULL,
  segment_count integer NOT NULL CHECK (segment_count >= 1),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  segments_json jsonb NOT NULL,
  webvtt_sha256 text,
  approval_state text NOT NULL DEFAULT 'unapproved' CHECK (approval_state IN (
    'unapproved',
    'approved',
    'rejected'
  )),
  approved_by_actor_id text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, transcript_sha256)
);

CREATE INDEX IF NOT EXISTS learning_delivery_transcripts_source_idx
  ON onetime.learning_delivery_transcripts(account_key, product_key, source_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_trim_reviews (
  trim_review_key text PRIMARY KEY,
  source_key text NOT NULL REFERENCES onetime.learning_delivery_media_sources(source_key),
  transcript_key text REFERENCES onetime.learning_delivery_transcripts(transcript_key),
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  proposed_start_ms integer NOT NULL CHECK (proposed_start_ms >= 0),
  proposed_end_ms integer NOT NULL CHECK (proposed_end_ms >= proposed_start_ms),
  reason_code text NOT NULL CHECK (reason_code IN (
    'leading_trailing_silence',
    'no_safe_trim_detected',
    'manual_operator_decision'
  )),
  decision_state text NOT NULL DEFAULT 'pending' CHECK (decision_state IN (
    'pending',
    'approved',
    'rejected',
    'superseded'
  )),
  decided_by_actor_id text,
  decided_at timestamptz,
  auto_cut_performed boolean NOT NULL DEFAULT false CHECK (auto_cut_performed = false),
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_delivery_trim_reviews_queue_idx
  ON onetime.learning_delivery_trim_reviews(account_key, product_key, decision_state, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_business_events (
  event_key text PRIMARY KEY,
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  event_type text NOT NULL CHECK (event_type IN (
    'recording.available',
    'class.reminder.requested'
  )),
  source_key text,
  class_occurrence_key text,
  payload_sha256 text NOT NULL,
  safe_payload_json jsonb NOT NULL,
  delivery_state text NOT NULL DEFAULT 'ready_for_highlevel' CHECK (delivery_state IN (
    'ready_for_highlevel',
    'claimed',
    'delivered',
    'retry_wait',
    'dead_lettered',
    'blocked'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CHECK ((safe_payload_json ->> 'raw_url_present') = 'false'),
  CHECK ((safe_payload_json ->> 'raw_transcript_present') = 'false'),
  CHECK ((safe_payload_json ->> 'student_credential_present') = 'false')
);

CREATE INDEX IF NOT EXISTS learning_delivery_business_events_queue_idx
  ON onetime.learning_delivery_business_events(account_key, product_key, delivery_state, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_state_events (
  audit_key text PRIMARY KEY,
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  source_key text,
  event_key text,
  actor_id text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('operator', 'service', 'system')),
  action text NOT NULL,
  previous_state text,
  next_state text,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_delivery_state_events_source_idx
  ON onetime.learning_delivery_state_events(account_key, product_key, source_key, created_at DESC);
