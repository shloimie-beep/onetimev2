CREATE TABLE onetime.ot109_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  account_key text NOT NULL DEFAULT 'rabbi_sheller_provider'
    CHECK (account_key = 'rabbi_sheller_provider'),
  product_key text NOT NULL DEFAULT 'one_time_mishnah_class'
    CHECK (product_key = 'one_time_mishnah_class'),
  idempotency_key text NOT NULL UNIQUE,
  request_sha256 text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN (
    'uploaded_file',
    'protected_drive_file',
    'private_vimeo_reference'
  )),
  source_ref_digest text NOT NULL,
  source_sha256 text NOT NULL,
  original_name text,
  byte_length bigint CHECK (byte_length IS NULL OR byte_length >= 0),
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'source_registered' CHECK (state IN (
    'source_registered',
    'awaiting_media_intake',
    'media_intake_processing',
    'vimeo_reference_accepted',
    'transcoding',
    'awaiting_transcript',
    'transcript_processing',
    'transcript_ready_unapproved',
    'derivatives_generated',
    'human_review_required',
    'approved_for_library',
    'approved_for_helper',
    'approved_for_social',
    'published',
    'retryable_failure',
    'blocked',
    'dead_lettered'
  )),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  safe_reason_code text,
  current_media_key text,
  current_transcript_key text,
  current_version_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, source_kind, source_ref_digest, source_sha256)
);

CREATE INDEX ot109_sources_queue_idx
  ON onetime.ot109_sources(state, updated_at ASC, source_key);

CREATE TABLE onetime.ot109_media_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_key text NOT NULL UNIQUE,
  source_key text NOT NULL REFERENCES onetime.ot109_sources(source_key),
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  provider_ref_digest text NOT NULL,
  reference_mode text NOT NULL CHECK (reference_mode IN (
    'automated_upload',
    'manual_private_reference'
  )),
  processing_state text NOT NULL CHECK (processing_state IN (
    'accepted',
    'transcoding',
    'ready',
    'failed'
  )),
  sanitized_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, provider, provider_ref_digest)
);

CREATE TABLE onetime.ot109_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_key text NOT NULL UNIQUE,
  source_key text NOT NULL REFERENCES onetime.ot109_sources(source_key),
  media_key text REFERENCES onetime.ot109_media_refs(media_key),
  transcript_source text NOT NULL CHECK (transcript_source IN (
    'approved_vimeo_text_track',
    'provider_transcription',
    'manual_transcript'
  )),
  transcript_sha256 text NOT NULL,
  segment_count integer NOT NULL CHECK (segment_count >= 1),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  segments_json jsonb NOT NULL,
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

CREATE TABLE onetime.ot109_derivative_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key text NOT NULL UNIQUE,
  source_key text NOT NULL REFERENCES onetime.ot109_sources(source_key),
  transcript_key text NOT NULL REFERENCES onetime.ot109_transcripts(transcript_key),
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  draft_sha256 text NOT NULL,
  draft_json jsonb NOT NULL,
  version_state text NOT NULL DEFAULT 'human_review_required' CHECK (version_state IN (
    'draft_generated',
    'human_review_required',
    'partially_approved',
    'published',
    'superseded',
    'rejected'
  )),
  contains_learner_name boolean NOT NULL DEFAULT false CHECK (contains_learner_name = false),
  contains_learner_voice boolean NOT NULL DEFAULT false CHECK (contains_learner_voice = false),
  contains_learner_face boolean NOT NULL DEFAULT false CHECK (contains_learner_face = false),
  contains_learner_question boolean NOT NULL DEFAULT false CHECK (contains_learner_question = false),
  contains_private_data boolean NOT NULL DEFAULT false CHECK (contains_private_data = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, revision_number),
  UNIQUE (source_key, draft_sha256)
);

CREATE INDEX ot109_derivative_versions_review_idx
  ON onetime.ot109_derivative_versions(version_state, updated_at DESC);

CREATE TABLE onetime.ot109_artifact_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_key text NOT NULL UNIQUE,
  version_key text NOT NULL REFERENCES onetime.ot109_derivative_versions(version_key),
  artifact_kind text NOT NULL CHECK (artifact_kind IN (
    'library',
    'helper',
    'social',
    'review_sheet',
    'classroom_resource'
  )),
  artifact_sha256 text NOT NULL,
  decision_state text NOT NULL DEFAULT 'pending' CHECK (decision_state IN (
    'pending',
    'approved',
    'rejected',
    'regenerate_requested'
  )),
  decided_by_actor_id text,
  decided_at timestamptz,
  reason_code text,
  redacted_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_key, artifact_kind)
);

CREATE INDEX ot109_artifact_reviews_decision_idx
  ON onetime.ot109_artifact_reviews(decision_state, updated_at DESC);

CREATE TABLE onetime.ot109_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_key text NOT NULL UNIQUE,
  source_key text NOT NULL REFERENCES onetime.ot109_sources(source_key),
  version_key text NOT NULL REFERENCES onetime.ot109_derivative_versions(version_key),
  artifact_kind text NOT NULL CHECK (artifact_kind IN (
    'library',
    'helper',
    'social',
    'review_sheet',
    'classroom_resource'
  )),
  artifact_sha256 text NOT NULL,
  channel text NOT NULL CHECK (channel IN (
    'one_time_library',
    'student_helper_knowledge',
    'social_manifest',
    'classroom_resource'
  )),
  payload_sha256 text NOT NULL,
  payload_json jsonb NOT NULL,
  active_state text NOT NULL DEFAULT 'active' CHECK (active_state IN (
    'active',
    'revoked',
    'unpublished'
  )),
  published_by_actor_id text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_actor_id text,
  revoked_at timestamptz,
  safe_reason_code text,
  UNIQUE (version_key, artifact_kind, artifact_sha256)
);

CREATE INDEX ot109_publications_active_idx
  ON onetime.ot109_publications(channel, active_state, published_at DESC);

CREATE TABLE onetime.ot109_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  source_key text NOT NULL,
  version_key text,
  artifact_kind text,
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

CREATE INDEX ot109_state_events_source_idx
  ON onetime.ot109_state_events(source_key, created_at DESC);
