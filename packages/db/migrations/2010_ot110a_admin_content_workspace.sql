CREATE TABLE onetime.ot110a_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  label text NOT NULL,
  artifact_kind text NOT NULL CHECK (artifact_kind IN (
    'lesson_summary',
    'review_sheet',
    'worksheet',
    'newsletter_email',
    'social_caption',
    'short_clip_plan',
    'helper_knowledge',
    'classroom_resource'
  )),
  active_version_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, template_key)
);

CREATE INDEX ot110a_prompt_templates_scope_idx
  ON onetime.ot110a_prompt_templates(account_key, product_key, artifact_kind, updated_at DESC);

CREATE TABLE onetime.ot110a_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key text NOT NULL UNIQUE,
  template_key text NOT NULL REFERENCES onetime.ot110a_prompt_templates(template_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  parent_version_key text,
  prompt_text text NOT NULL,
  patch_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  checksum text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  author_user_key text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, template_key, version_number),
  UNIQUE (account_key, product_key, template_key, checksum)
);

CREATE INDEX ot110a_prompt_versions_template_idx
  ON onetime.ot110a_prompt_versions(account_key, product_key, template_key, version_number DESC);

CREATE TABLE onetime.ot110a_prompt_patch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  template_key text NOT NULL,
  parent_version_key text NOT NULL,
  candidate_version_key text NOT NULL,
  diff_json jsonb NOT NULL,
  reason text NOT NULL,
  author_user_key text NOT NULL,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot110a_prompt_patch_events_template_idx
  ON onetime.ot110a_prompt_patch_events(account_key, product_key, template_key, created_at DESC);

CREATE TABLE onetime.ot110a_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_run_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_key text NOT NULL,
  artifact_kind text NOT NULL,
  transcript_revision_key text,
  prompt_version_key text NOT NULL,
  prompt_version_checksum text NOT NULL,
  model_policy_id text NOT NULL,
  provider_mode text NOT NULL CHECK (provider_mode IN ('provider_off', 'sink', 'ready')),
  output_hash text NOT NULL,
  run_state text NOT NULL CHECK (run_state IN ('queued', 'completed', 'failed')),
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot110a_generation_runs_source_idx
  ON onetime.ot110a_generation_runs(account_key, product_key, source_key, created_at DESC);

CREATE TABLE onetime.ot110a_content_artifact_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_revision_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_key text NOT NULL,
  artifact_kind text NOT NULL CHECK (artifact_kind IN (
    'lesson_summary',
    'review_sheet',
    'worksheet',
    'newsletter_email',
    'social_caption',
    'short_clip_plan',
    'helper_knowledge',
    'classroom_resource'
  )),
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  prompt_version_key text,
  prompt_version_checksum text,
  transcript_revision_key text,
  generation_run_key text,
  model_policy_id text,
  output_hash text NOT NULL,
  body text NOT NULL,
  review_state text NOT NULL CHECK (review_state IN (
    'draft',
    'review_needed',
    'approved',
    'published',
    'rejected',
    'superseded'
  )),
  publication_targets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, source_key, artifact_kind, revision_number)
);

CREATE INDEX ot110a_content_artifacts_source_idx
  ON onetime.ot110a_content_artifact_revisions(account_key, product_key, source_key, updated_at DESC);

CREATE INDEX ot110a_content_artifacts_review_idx
  ON onetime.ot110a_content_artifact_revisions(account_key, product_key, review_state, updated_at DESC);

CREATE TABLE onetime.ot110a_content_admin_capability_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL,
  capability text NOT NULL CHECK (capability IN (
    'content.view',
    'transcript.review',
    'artifact.generate',
    'artifact.edit',
    'artifact.publish',
    'prompt.manage',
    'social.approve',
    'social.schedule',
    'content.revoke'
  )),
  granted_by_user_key text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (account_key, product_key, user_key, capability)
);

CREATE INDEX ot110a_content_capability_grants_user_idx
  ON onetime.ot110a_content_admin_capability_grants(account_key, product_key, user_key, active);

CREATE TABLE onetime.ot110a_content_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  scope_key text,
  actor_user_key text,
  action_type text NOT NULL,
  capability text CHECK (capability IN (
    'content.view',
    'transcript.review',
    'artifact.generate',
    'artifact.edit',
    'artifact.publish',
    'prompt.manage',
    'social.approve',
    'social.schedule',
    'content.revoke'
  )),
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot110a_content_activity_scope_idx
  ON onetime.ot110a_content_activity_events(account_key, product_key, scope_key, created_at DESC);

CREATE INDEX ot110a_content_activity_recent_idx
  ON onetime.ot110a_content_activity_events(account_key, product_key, created_at DESC);
