CREATE TABLE onetime.ot86b_social_event_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  origin text NOT NULL CHECK (origin = 'ot86a-content-pipeline'),
  event_type text NOT NULL CHECK (event_type = 'content.approved_for_social'),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  key_id text NOT NULL,
  raw_body_sha256 text NOT NULL,
  payload_sha256 text NOT NULL,
  raw_event jsonb NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('accepted', 'duplicate', 'quarantined', 'rejected')),
  processing_state text NOT NULL DEFAULT 'queued'
    CHECK (processing_state IN ('queued', 'source_recorded', 'draft_job_created', 'applied', 'quarantined', 'rejected', 'conflict')),
  sanitized_reason_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE (tenant_id, content_id, version_id, sequence)
);

CREATE INDEX ot86b_social_event_inbox_queue_idx
  ON onetime.ot86b_social_event_inbox(processing_state, received_at);

CREATE TABLE onetime.ot86b_social_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  event_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  canonical_title text NOT NULL,
  canonical_url text NOT NULL,
  summary text NOT NULL,
  approved_excerpts_json jsonb NOT NULL,
  media_json jsonb NOT NULL,
  privacy_json jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  source_state text NOT NULL DEFAULT 'accepted'
    CHECK (source_state IN ('accepted', 'quarantined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot86b_social_sources_tenant_idx
  ON onetime.ot86b_social_sources(tenant_id, created_at DESC);

CREATE TABLE onetime.ot86b_social_draft_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  source_id text NOT NULL REFERENCES onetime.ot86b_social_sources(source_id),
  tenant_id text NOT NULL,
  job_state text NOT NULL DEFAULT 'pending'
    CHECK (job_state IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot86b_social_draft_jobs_queue_idx
  ON onetime.ot86b_social_draft_jobs(job_state, created_at);

CREATE TABLE onetime.ot86b_social_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id text NOT NULL UNIQUE,
  source_id text NOT NULL REFERENCES onetime.ot86b_social_sources(source_id),
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'x')),
  workflow_state text NOT NULL CHECK (workflow_state IN (
    'draft_generated',
    'review_needed',
    'approved',
    'scheduled',
    'publishing',
    'published',
    'failed',
    'correction_needed',
    'retraction_requested',
    'retracted',
    'retraction_manual_required',
    'cancelled'
  )),
  current_revision_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, platform)
);

CREATE INDEX ot86b_social_drafts_list_idx
  ON onetime.ot86b_social_drafts(tenant_id, workflow_state, updated_at DESC, draft_id);

CREATE TABLE onetime.ot86b_social_draft_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id text NOT NULL REFERENCES onetime.ot86b_social_drafts(draft_id),
  revision_id text NOT NULL UNIQUE,
  supersedes_revision_id text,
  source_event_id text NOT NULL,
  tenant_id text NOT NULL,
  content_id text NOT NULL,
  version_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'x')),
  renderer_version text NOT NULL,
  text text NOT NULL,
  hashtags_json jsonb NOT NULL,
  media_json jsonb NOT NULL,
  source_excerpt_ids_json jsonb NOT NULL,
  privacy_json jsonb NOT NULL,
  warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision_sha256 text NOT NULL,
  created_by_actor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, revision_sha256)
);

CREATE INDEX ot86b_social_draft_revisions_draft_idx
  ON onetime.ot86b_social_draft_revisions(draft_id, created_at DESC);

CREATE TABLE onetime.ot86b_social_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  draft_id text NOT NULL REFERENCES onetime.ot86b_social_drafts(draft_id),
  revision_id text NOT NULL,
  approved_by_actor_id text NOT NULL,
  approved_at timestamptz NOT NULL,
  policy_version text NOT NULL,
  approved_revision_sha256 text NOT NULL,
  ordered_media_sha256_json jsonb NOT NULL,
  destination_snapshot_json jsonb NOT NULL,
  scheduled_for timestamptz NOT NULL,
  timezone text NOT NULL,
  privacy_json jsonb NOT NULL,
  approval_state text NOT NULL DEFAULT 'active'
    CHECK (approval_state IN ('active', 'invalidated', 'cancelled')),
  invalidated_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot86b_social_approvals_draft_idx
  ON onetime.ot86b_social_approvals(tenant_id, draft_id, approval_state);

CREATE TABLE onetime.ot86b_social_destination_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  draft_id text NOT NULL,
  approval_id text NOT NULL REFERENCES onetime.ot86b_social_approvals(approval_id),
  provider text NOT NULL CHECK (provider = 'buffer'),
  organization_id text NOT NULL,
  destination_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'x')),
  capability_version text NOT NULL,
  timezone text NOT NULL,
  binding_state text NOT NULL DEFAULT 'active' CHECK (binding_state IN ('active', 'invalidated', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (approval_id, destination_id)
);

CREATE TABLE onetime.ot86b_social_publish_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  draft_id text NOT NULL,
  revision_id text NOT NULL,
  revision_sha256 text NOT NULL,
  approval_id text NOT NULL,
  provider text NOT NULL CHECK (provider = 'buffer'),
  organization_id text NOT NULL,
  destination_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'x')),
  capability_version text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  timezone text NOT NULL,
  command_json jsonb NOT NULL,
  command_state text NOT NULL DEFAULT 'scheduled'
    CHECK (command_state IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled', 'retraction_requested', 'retracted', 'retraction_manual_required')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_post_id text,
  provider_update_id text,
  sanitized_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (approval_id, destination_id)
);

CREATE INDEX ot86b_social_publish_commands_due_idx
  ON onetime.ot86b_social_publish_commands(command_state, scheduled_for, id);

CREATE TABLE onetime.ot86b_social_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text NOT NULL UNIQUE,
  command_id text NOT NULL REFERENCES onetime.ot86b_social_publish_commands(command_id),
  tenant_id text NOT NULL,
  provider text NOT NULL CHECK (provider = 'buffer'),
  operation text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  provider_post_id text,
  provider_update_id text,
  response_status text NOT NULL,
  sanitized_code text NOT NULL,
  response_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_id, operation, attempt_number)
);

CREATE TABLE onetime.ot86b_social_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  draft_id text,
  revision_id text,
  command_id text,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  previous_state text,
  next_state text,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  authorization_decision_id text,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot86b_social_audit_events_scope_idx
  ON onetime.ot86b_social_audit_events(tenant_id, draft_id, created_at DESC);
