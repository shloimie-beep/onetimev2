CREATE TABLE onetime.telegram_bot_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  account_key text NOT NULL,
  product_key text NOT NULL,
  token_fingerprint_hash text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_key, environment),
  UNIQUE (bot_key, environment, token_fingerprint_hash)
);

CREATE TABLE onetime.telegram_identity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  provider_user_ref_hash text NOT NULL,
  canonical_user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  membership_key text NOT NULL,
  security_version integer NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);

CREATE UNIQUE INDEX telegram_identity_one_active_mapping_idx
  ON onetime.telegram_identity_mappings(bot_key, environment, provider_user_ref_hash)
  WHERE status = 'active';

CREATE INDEX telegram_identity_actor_lookup_idx
  ON onetime.telegram_identity_mappings(account_key, product_key, canonical_user_key)
  WHERE status = 'active';

CREATE TABLE onetime.telegram_update_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  update_id bigint NOT NULL,
  payload_ciphertext text NOT NULL,
  payload_digest text NOT NULL,
  payload_classification text NOT NULL CHECK (payload_classification IN ('normalized_update')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'retry', 'completed', 'dead_letter', 'unsupported')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment),
  UNIQUE (bot_key, update_id)
);

CREATE INDEX telegram_update_inbox_queue_idx
  ON onetime.telegram_update_inbox(bot_key, environment, status, next_attempt_at, created_at);

CREATE INDEX telegram_update_inbox_lease_reclaim_idx
  ON onetime.telegram_update_inbox(bot_key, environment, status, lease_expires_at)
  WHERE status = 'leased';

CREATE TABLE onetime.telegram_command_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  capability text NOT NULL CHECK (
    capability IN (
      'product_status',
      'upcoming_classes',
      'content_pipeline_status',
      'contact_lookup',
      'task_lookup',
      'task_create',
      'task_update'
    )
  ),
  idempotency_key text NOT NULL,
  action_digest text NOT NULL,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'previewed', 'completed', 'failed', 'dead_letter')),
  terminal_disposition text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (bot_key, environment, account_key, product_key, actor_user_key, idempotency_key),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment),
  FOREIGN KEY (actor_user_key) REFERENCES onetime.account_users(user_key)
);

CREATE TABLE onetime.telegram_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  provider_user_ref_hash text NOT NULL,
  chat_ref_hash text NOT NULL,
  actor_user_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  capability text NOT NULL CHECK (capability IN ('task_create', 'task_update')),
  action_digest text NOT NULL,
  entity_version integer,
  security_version integer NOT NULL,
  idempotency_key text NOT NULL,
  payload_ciphertext text NOT NULL,
  payload_digest text NOT NULL,
  payload_classification text NOT NULL CHECK (payload_classification IN ('confirmation_payload')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment),
  FOREIGN KEY (actor_user_key) REFERENCES onetime.account_users(user_key),
  CHECK (consumed_at IS NULL OR cancelled_at IS NULL)
);

CREATE UNIQUE INDEX telegram_confirmations_one_open_action_idx
  ON onetime.telegram_confirmations(bot_key, environment, actor_user_key, action_digest)
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX telegram_confirmations_expiry_idx
  ON onetime.telegram_confirmations(bot_key, environment, expires_at)
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE onetime.telegram_consumer_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  token_fingerprint_hash text NOT NULL,
  owner_id text NOT NULL,
  generation integer NOT NULL DEFAULT 1 CHECK (generation >= 1),
  active boolean NOT NULL DEFAULT true,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);

CREATE UNIQUE INDEX telegram_consumer_one_active_owner_idx
  ON onetime.telegram_consumer_leases(bot_key, environment, token_fingerprint_hash)
  WHERE active;

CREATE TABLE onetime.telegram_operation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  account_key text,
  product_key text,
  actor_user_key text,
  capability text,
  correlation_key text NOT NULL,
  outcome text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);

CREATE INDEX telegram_operation_audit_safe_lookup_idx
  ON onetime.telegram_operation_audit(bot_key, environment, account_key, product_key, actor_user_key, created_at DESC);

CREATE TABLE onetime.telegram_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dead_letter_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  inbox_key text REFERENCES onetime.telegram_update_inbox(inbox_key),
  execution_key text REFERENCES onetime.telegram_command_executions(execution_key),
  reason_code text NOT NULL,
  manual_review_state text NOT NULL DEFAULT 'needs_review'
    CHECK (manual_review_state IN ('needs_review', 'reviewed', 'archived')),
  sanitized_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);

CREATE TABLE onetime.telegram_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  actor_user_key text,
  chat_ref_hash text,
  capability text,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  UNIQUE (bucket_key, window_start),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);
