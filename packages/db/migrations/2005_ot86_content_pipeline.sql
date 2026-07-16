CREATE TABLE onetime.ot86_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  source_record_id text NOT NULL,
  source_kind text NOT NULL,
  original_name text,
  source_sha256 text NOT NULL,
  byte_length bigint CHECK (byte_length IS NULL OR byte_length >= 0),
  origin_service text NOT NULL,
  submitting_actor_id text NOT NULL,
  aggregate_state text NOT NULL DEFAULT 'received'
    CHECK (aggregate_state IN (
      'received',
      'uploading',
      'transcribing',
      'processing',
      'review_needed',
      'approved',
      'published',
      'failed',
      'corrected',
      'retired'
    )),
  retry_target_state text
    CHECK (retry_target_state IS NULL OR retry_target_state IN (
      'received',
      'uploading',
      'transcribing',
      'processing',
      'retired'
    )),
  attempt_number integer NOT NULL DEFAULT 0 CHECK (attempt_number >= 0),
  last_reason text,
  current_version_id text,
  published_version_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_kind, source_record_id, source_sha256),
  UNIQUE (tenant_id, content_id)
);

CREATE INDEX ot86_content_items_state_idx
  ON onetime.ot86_content_items(tenant_id, aggregate_state, updated_at DESC);

CREATE TABLE onetime.ot86_content_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  previous_state text,
  next_state text NOT NULL,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  idempotency_key text,
  attempt_number integer NOT NULL CHECK (attempt_number >= 0),
  source_sha256 text NOT NULL,
  result_sha256 text,
  sanitized_error_code text,
  authorization_decision_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot86_content_state_events_content_idx
  ON onetime.ot86_content_state_events(tenant_id, content_id, created_at DESC);

CREATE TABLE onetime.ot86_vimeo_provider_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  provider_video_id text,
  provider_upload_id text,
  reference_mode text NOT NULL CHECK (reference_mode IN ('automated_upload', 'manual_approved_reference')),
  upload_idempotency_key text NOT NULL,
  readiness_state text NOT NULL CHECK (readiness_state IN ('unconfigured', 'auth_invalid', 'permission_missing', 'ready', 'degraded', 'manual_review')),
  validation_state text NOT NULL CHECK (validation_state IN ('pending', 'validated', 'failed')),
  actor_id text NOT NULL,
  sanitized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_video_id),
  UNIQUE (tenant_id, content_id, upload_idempotency_key)
);

CREATE TABLE onetime.ot86_provider_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'vimeo' CHECK (provider = 'vimeo'),
  provider_event_id text NOT NULL,
  raw_body_sha256 text NOT NULL,
  normalized_event_type text NOT NULL,
  normalized_event_key text NOT NULL,
  account_id_digest text,
  processing_state text NOT NULL DEFAULT 'recorded'
    CHECK (processing_state IN ('recorded', 'processed', 'rejected', 'conflict')),
  sanitized_error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id),
  UNIQUE (provider, normalized_event_key)
);

CREATE TABLE onetime.ot86_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  supersedes_version_id text,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  version_state text NOT NULL DEFAULT 'review_needed'
    CHECK (version_state IN ('review_needed', 'approved', 'published', 'corrected', 'retired')),
  normalized_version_sha256 text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifacts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  search_documents_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  contains_learner_name boolean NOT NULL DEFAULT false,
  contains_learner_voice boolean NOT NULL DEFAULT false,
  contains_learner_face boolean NOT NULL DEFAULT false,
  contains_learner_question boolean NOT NULL DEFAULT false,
  contains_private_data boolean NOT NULL DEFAULT false,
  approved_for_student_kb boolean NOT NULL DEFAULT false,
  approved_for_social boolean NOT NULL DEFAULT false,
  approval_id text,
  approved_by_actor_id text,
  approved_at timestamptz,
  policy_version text,
  immutable_after_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_id, version_id),
  UNIQUE (tenant_id, content_id, normalized_version_sha256),
  FOREIGN KEY (tenant_id, content_id) REFERENCES onetime.ot86_content_items(tenant_id, content_id)
);

CREATE INDEX ot86_content_versions_current_idx
  ON onetime.ot86_content_versions(tenant_id, content_id, version_state, revision_number DESC);

CREATE TABLE onetime.ot86_publication_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  idempotency_key text NOT NULL,
  payload_sha256 text NOT NULL,
  payload_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_lettered')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, tenant_id, content_id, version_id, sequence)
);

CREATE INDEX ot86_publication_outbox_pending_idx
  ON onetime.ot86_publication_outbox(status, next_attempt_at, created_at);

CREATE TABLE onetime.ot86_publication_inbox_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL,
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  action text NOT NULL CHECK (action IN ('publish', 'correct', 'revoke', 'retire')),
  key_id text NOT NULL,
  raw_body_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL,
  raw_manifest jsonb NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('accepted', 'duplicate', 'conflict', 'rejected')),
  processing_state text NOT NULL DEFAULT 'queued'
    CHECK (processing_state IN ('queued', 'applied', 'waiting_sequence', 'rejected', 'conflict')),
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE (tenant_id, content_id, sequence),
  UNIQUE (idempotency_key)
);

CREATE INDEX ot86_publication_inbox_queue_idx
  ON onetime.ot86_publication_inbox_receipts(processing_state, received_at);

CREATE TABLE onetime.ot86_published_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  supersedes_version_id text,
  sequence integer NOT NULL CHECK (sequence >= 1),
  action text NOT NULL CHECK (action IN ('publish', 'correct', 'revoke', 'retire')),
  canonical_path text,
  source_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL,
  approval_json jsonb NOT NULL,
  privacy_json jsonb NOT NULL,
  active_state text NOT NULL CHECK (active_state IN ('active', 'corrected', 'revoked', 'retired')),
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_id, version_id),
  UNIQUE (tenant_id, content_id, sequence)
);

CREATE INDEX ot86_published_versions_active_idx
  ON onetime.ot86_published_content_versions(tenant_id, active_state, published_at DESC);

CREATE INDEX ot86_published_versions_content_idx
  ON onetime.ot86_published_content_versions(tenant_id, content_id, active_state);

CREATE TABLE onetime.ot86_published_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  section_id text NOT NULL,
  title text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms >= 0),
  canonical_path text NOT NULL,
  deep_link text NOT NULL,
  text_sha256 text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, version_id, section_id),
  FOREIGN KEY (tenant_id, content_id, version_id)
    REFERENCES onetime.ot86_published_content_versions(tenant_id, content_id, version_id)
);

CREATE INDEX ot86_published_sections_content_idx
  ON onetime.ot86_published_sections(tenant_id, content_id, version_id, ordinal);

CREATE INDEX ot86_published_sections_deep_link_idx
  ON onetime.ot86_published_sections(tenant_id, section_id, active);

CREATE TABLE onetime.ot86_published_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  artifact_id text NOT NULL,
  kind text NOT NULL,
  uri text NOT NULL,
  mime_type text NOT NULL,
  sha256 text NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, version_id, artifact_id),
  FOREIGN KEY (tenant_id, content_id, version_id)
    REFERENCES onetime.ot86_published_content_versions(tenant_id, content_id, version_id)
);

CREATE TABLE onetime.ot86_search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  section_id text NOT NULL,
  document_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  token_count integer NOT NULL CHECK (token_count >= 1),
  document_sha256 text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version_id, section_id, document_sha256),
  UNIQUE (tenant_id, version_id, document_id),
  FOREIGN KEY (tenant_id, content_id, version_id)
    REFERENCES onetime.ot86_published_content_versions(tenant_id, content_id, version_id)
);

CREATE INDEX ot86_search_documents_lookup_idx
  ON onetime.ot86_search_documents(tenant_id, active, content_id, version_id);

CREATE TABLE onetime.ot86_retrieval_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  principal_id text NOT NULL,
  entitlement_scope text NOT NULL,
  authorization_decision_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('answered', 'abstained', 'denied')),
  safe_reason_code text NOT NULL,
  selected_citation_count integer NOT NULL DEFAULT 0 CHECK (selected_citation_count >= 0),
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
