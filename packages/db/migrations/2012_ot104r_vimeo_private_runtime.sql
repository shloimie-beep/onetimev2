CREATE TABLE onetime.ot104r_vimeo_sources (
  source_key text PRIMARY KEY,
  account_key text NOT NULL CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnah_class'),
  content_id text NOT NULL,
  source_record_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_sha256 text NOT NULL,
  source_ref_digest text NOT NULL,
  title text NOT NULL,
  source_sha256 text NOT NULL,
  byte_length bigint CHECK (byte_length IS NULL OR byte_length >= 0),
  submitted_by_actor_id text NOT NULL,
  registration_mode text NOT NULL CHECK (registration_mode IN ('existing_private_video', 'controlled_upload')),
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  provider_video_id text,
  provider_upload_id text,
  privacy_state text NOT NULL CHECK (privacy_state IN ('private', 'unlisted', 'password', 'review_required')),
  processing_state text NOT NULL CHECK (processing_state IN (
    'registered',
    'upload_authorized',
    'uploading',
    'transcoding',
    'available',
    'transcript_ready',
    'failed',
    'retry_wait',
    'dead_lettered',
    'retired'
  )),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  width integer CHECK (width IS NULL OR width >= 0),
  height integer CHECK (height IS NULL OR height >= 0),
  text_track_id text,
  last_synced_revision text,
  sanitized_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sanitized_error_code text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_reconcile_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  terminal_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key),
  UNIQUE (account_key, product_key, content_id),
  UNIQUE (account_key, product_key, provider_video_id),
  UNIQUE (account_key, product_key, provider_upload_id)
);

CREATE INDEX ot104r_vimeo_sources_reconcile_idx
  ON onetime.ot104r_vimeo_sources(account_key, product_key, processing_state, next_reconcile_at, updated_at);

CREATE INDEX ot104r_vimeo_sources_video_idx
  ON onetime.ot104r_vimeo_sources(account_key, product_key, provider_video_id);

CREATE TABLE onetime.ot104r_vimeo_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  account_key text NOT NULL CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnah_class'),
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  raw_body_sha256 text NOT NULL,
  event_type text NOT NULL,
  normalized_event_key text NOT NULL,
  provider_video_id text,
  account_id_digest text,
  processing_state text NOT NULL CHECK (processing_state IN ('recorded', 'processed', 'ignored', 'rejected', 'conflict')),
  sanitized_error_code text,
  payload_minimized_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, normalized_event_key)
);

CREATE INDEX ot104r_vimeo_webhook_receipts_scope_idx
  ON onetime.ot104r_vimeo_webhook_receipts(account_key, product_key, received_at DESC);

CREATE TABLE onetime.ot104r_vimeo_text_tracks (
  track_key text PRIMARY KEY,
  source_key text NOT NULL REFERENCES onetime.ot104r_vimeo_sources(source_key),
  account_key text NOT NULL CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnah_class'),
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  provider_text_track_id text NOT NULL,
  language text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('captions', 'subtitles', 'transcript')),
  mime_type text NOT NULL,
  source_revision text NOT NULL,
  source_revision_sha256 text NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length >= 0 AND byte_length <= 1000000),
  body_sha256 text NOT NULL,
  normalized_text text NOT NULL,
  normalized_text_sha256 text NOT NULL,
  import_state text NOT NULL CHECK (import_state IN ('imported', 'rejected')),
  sanitized_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, provider_text_track_id, source_revision_sha256)
);

CREATE INDEX ot104r_vimeo_text_tracks_source_idx
  ON onetime.ot104r_vimeo_text_tracks(account_key, product_key, source_key, imported_at DESC);

CREATE TABLE onetime.ot104r_vimeo_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL UNIQUE,
  account_key text NOT NULL CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnah_class'),
  source_key text NOT NULL,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot104r_vimeo_audit_events_source_idx
  ON onetime.ot104r_vimeo_audit_events(account_key, product_key, source_key, created_at DESC);
