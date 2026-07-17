CREATE TABLE onetime.ot106_publication_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_content_id text NOT NULL,
  derivative_batch_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('draft', 'scheduled')),
  state text NOT NULL CHECK (state IN (
    'received',
    'validated',
    'awaiting_approval',
    'queued',
    'provider_draft_created',
    'scheduled',
    'sent',
    'retryable_failure',
    'dead_lettered',
    'canceled'
  )),
  due_at_utc timestamptz,
  approval_id text NOT NULL,
  approved_by_actor_id text NOT NULL,
  raw_body_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL,
  manifest_json jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  generation integer NOT NULL DEFAULT 0 CHECK (generation >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot106_publication_manifests_queue_idx
  ON onetime.ot106_publication_manifests(state, next_attempt_at, created_at);

CREATE INDEX ot106_publication_manifests_scope_idx
  ON onetime.ot106_publication_manifests(account_key, product_key, created_at DESC);

CREATE TABLE onetime.ot106_publication_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id text NOT NULL UNIQUE,
  manifest_id text NOT NULL REFERENCES onetime.ot106_publication_manifests(manifest_id) ON DELETE CASCADE,
  target_alias text NOT NULL,
  requested_platform text CHECK (requested_platform IS NULL OR requested_platform IN (
    'facebook',
    'instagram',
    'linkedin',
    'x',
    'youtube',
    'threads',
    'tiktok',
    'pinterest',
    'bluesky',
    'mastodon',
    'google_business'
  )),
  target_state text NOT NULL CHECK (target_state IN (
    'queued',
    'provider_draft_created',
    'scheduled',
    'sent',
    'retryable_failure',
    'dead_lettered',
    'canceled'
  )),
  organization_id text,
  channel_id text,
  provider_post_id text,
  last_error_code text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manifest_id, target_alias)
);

CREATE INDEX ot106_publication_targets_manifest_idx
  ON onetime.ot106_publication_targets(manifest_id, target_state);

CREATE TABLE onetime.ot106_publication_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL UNIQUE,
  manifest_id text NOT NULL REFERENCES onetime.ot106_publication_manifests(manifest_id) ON DELETE CASCADE,
  derivative_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  url text NOT NULL,
  mime_type text NOT NULL,
  sha256 text NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length >= 1),
  subject_classification text NOT NULL CHECK (subject_classification IN ('no_people', 'rabbi_only', 'graphics_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manifest_id, derivative_id),
  UNIQUE (manifest_id, sha256)
);

CREATE TABLE onetime.ot106_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text NOT NULL UNIQUE,
  manifest_id text NOT NULL REFERENCES onetime.ot106_publication_manifests(manifest_id) ON DELETE CASCADE,
  target_id text NOT NULL REFERENCES onetime.ot106_publication_targets(target_id) ON DELETE CASCADE,
  target_alias text NOT NULL,
  provider text NOT NULL CHECK (provider = 'buffer'),
  operation text NOT NULL CHECK (operation IN ('draft', 'scheduled')),
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  http_status integer,
  retryable boolean NOT NULL,
  retry_after_seconds integer,
  sanitized_code text NOT NULL,
  response_sha256 text,
  provider_post_id text,
  external_write_performed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_id, attempt_number)
);

CREATE INDEX ot106_provider_attempts_manifest_idx
  ON onetime.ot106_provider_attempts(manifest_id, target_alias, created_at DESC);

CREATE TABLE onetime.ot106_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL UNIQUE,
  manifest_id text NOT NULL,
  target_alias text,
  actor_id text NOT NULL,
  action text NOT NULL,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ot106_audit_events_manifest_idx
  ON onetime.ot106_audit_events(manifest_id, created_at DESC);
