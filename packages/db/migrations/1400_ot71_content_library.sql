CREATE TABLE onetime.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text,
  title text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('video', 'sheet', 'source', 'review')),
  lifecycle_state text NOT NULL DEFAULT 'received'
    CHECK (lifecycle_state IN (
      'received',
      'transcribing',
      'processing',
      'review_needed',
      'published',
      'failed',
      'superseded'
    )),
  latest_revision_number integer NOT NULL DEFAULT 0 CHECK (latest_revision_number >= 0),
  latest_revision_key text,
  published_revision_key text,
  retention_state text NOT NULL DEFAULT 'active'
    CHECK (retention_state IN ('active', 'retention_hold', 'redacted', 'purged')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, content_item_key)
);

CREATE INDEX content_items_scope_idx
  ON onetime.content_items(account_key, product_key, updated_at DESC, content_item_key);

CREATE INDEX content_items_occurrence_idx
  ON onetime.content_items(account_key, product_key, occurrence_key, lifecycle_state)
  WHERE occurrence_key IS NOT NULL;

CREATE INDEX content_items_published_idx
  ON onetime.content_items(account_key, product_key, item_type, published_at DESC)
  WHERE published_revision_key IS NOT NULL AND retention_state = 'active';

CREATE TABLE onetime.content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_item_key text NOT NULL,
  outcome_event_key text NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  lifecycle_state text NOT NULL
    CHECK (lifecycle_state IN (
      'received',
      'transcribing',
      'processing',
      'review_needed',
      'published',
      'failed',
      'superseded'
    )),
  transcript_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_sheet_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  playback_descriptor jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_event_ref_digest text,
  source_ref_digest text,
  raw_provider_target_present boolean NOT NULL DEFAULT false CHECK (raw_provider_target_present = false),
  supersedes_revision_key text,
  received_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  failed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key),
  FOREIGN KEY (supersedes_revision_key) REFERENCES onetime.content_revisions(revision_key),
  UNIQUE (account_key, product_key, content_item_key, revision_number),
  UNIQUE (account_key, product_key, outcome_event_key)
);

CREATE INDEX content_revisions_item_idx
  ON onetime.content_revisions(account_key, product_key, content_item_key, revision_number DESC);

CREATE INDEX content_revisions_outcome_idx
  ON onetime.content_revisions(account_key, product_key, outcome_event_key);

CREATE TABLE onetime.content_item_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_item_key text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all_active_learners', 'household', 'learner')),
  household_key text,
  learner_key text,
  entitlement_state text NOT NULL DEFAULT 'active' CHECK (entitlement_state IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key),
  UNIQUE (account_key, product_key, entitlement_key)
);

CREATE INDEX content_entitlements_item_idx
  ON onetime.content_item_entitlements(account_key, product_key, content_item_key, entitlement_state);

CREATE INDEX content_entitlements_learner_idx
  ON onetime.content_item_entitlements(account_key, product_key, learner_key, entitlement_state)
  WHERE learner_key IS NOT NULL;

CREATE INDEX content_entitlements_household_idx
  ON onetime.content_item_entitlements(account_key, product_key, household_key, entitlement_state)
  WHERE household_key IS NOT NULL;

CREATE TABLE onetime.content_outcome_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE TABLE onetime.content_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_item_key text,
  revision_key text,
  actor_user_key text,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_audit_events_item_idx
  ON onetime.content_audit_events(account_key, product_key, content_item_key, created_at DESC);

CREATE TABLE onetime.content_redaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redaction_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_item_key text NOT NULL,
  revision_key text NOT NULL,
  redaction_count integer NOT NULL CHECK (redaction_count >= 0),
  redacted_metadata_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key),
  FOREIGN KEY (revision_key) REFERENCES onetime.content_revisions(revision_key)
);

CREATE INDEX content_redaction_events_item_idx
  ON onetime.content_redaction_events(account_key, product_key, content_item_key, created_at DESC);

CREATE TABLE onetime.content_retention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_item_key text NOT NULL,
  retention_action text NOT NULL CHECK (retention_action IN ('hold', 'release', 'redact', 'purge')),
  retention_state text NOT NULL CHECK (retention_state IN ('active', 'retention_hold', 'redacted', 'purged')),
  reason text NOT NULL,
  actor_user_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key)
);

CREATE INDEX content_retention_events_item_idx
  ON onetime.content_retention_events(account_key, product_key, content_item_key, created_at DESC);
