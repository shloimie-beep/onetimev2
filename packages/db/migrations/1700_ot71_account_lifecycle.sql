ALTER TABLE onetime.account_users
  DROP CONSTRAINT IF EXISTS account_users_role_check;

ALTER TABLE onetime.account_users
  DROP CONSTRAINT IF EXISTS account_users_constraint_1;

ALTER TABLE onetime.account_users
  ADD CONSTRAINT account_users_role_check
  CHECK (role IN ('owner', 'admin', 'crm_agent', 'viewer', 'parent', 'student'));

CREATE TABLE onetime.account_lifecycle_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  token_type text NOT NULL CHECK (token_type IN (
    'owner_admin_invitation',
    'parent_activation',
    'student_setup',
    'student_reset',
    'password_reset'
  )),
  token_hash text NOT NULL UNIQUE,
  email_normalized text,
  display_name text,
  target_role text NOT NULL CHECK (target_role IN ('owner', 'admin', 'parent', 'student')),
  subject_user_key text,
  household_key text,
  relationship_key text,
  learner_key text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by_user_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (subject_user_key) REFERENCES onetime.account_users(user_key),
  FOREIGN KEY (created_by_user_key) REFERENCES onetime.account_users(user_key)
);

CREATE INDEX account_lifecycle_tokens_lookup_idx
  ON onetime.account_lifecycle_tokens(account_key, product_key, token_type, expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX account_lifecycle_tokens_subject_idx
  ON onetime.account_lifecycle_tokens(account_key, product_key, subject_user_key, created_at DESC)
  WHERE subject_user_key IS NOT NULL;

CREATE TABLE onetime.account_lifecycle_delivery_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  token_key text NOT NULL REFERENCES onetime.account_lifecycle_tokens(token_key),
  intent_type text NOT NULL CHECK (intent_type IN (
    'owner_admin_invitation',
    'parent_activation',
    'student_setup',
    'student_reset',
    'password_reset'
  )),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  recipient_email text,
  delivery_state text NOT NULL DEFAULT 'sink_queued'
    CHECK (delivery_state IN ('sink_queued', 'sink_delivered', 'suppressed', 'revoked')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (account_key, product_key, intent_type, idempotency_key)
);

CREATE INDEX account_lifecycle_delivery_sink_idx
  ON onetime.account_lifecycle_delivery_intents(account_key, product_key, delivery_state, created_at);

CREATE TABLE onetime.account_lifecycle_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  operation_scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_key, operation_scope, idempotency_key)
);

CREATE TABLE onetime.account_lifecycle_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text,
  subject_user_key text,
  token_key text,
  action_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_lifecycle_audit_subject_idx
  ON onetime.account_lifecycle_audit_events(account_key, product_key, subject_user_key, created_at DESC)
  WHERE subject_user_key IS NOT NULL;

CREATE TABLE onetime.account_lifecycle_session_invalidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invalidation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  reason text NOT NULL,
  revoked_session_count integer NOT NULL DEFAULT 0 CHECK (revoked_session_count >= 0),
  security_version_after integer NOT NULL,
  actor_user_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_lifecycle_session_invalidations_user_idx
  ON onetime.account_lifecycle_session_invalidations(account_key, product_key, user_key, created_at DESC);

CREATE TABLE onetime.account_learner_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  link_state text NOT NULL DEFAULT 'active' CHECK (link_state IN ('active', 'suspended', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  disabled_at timestamptz,
  UNIQUE (account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, user_key)
);

CREATE INDEX account_learner_identity_links_household_idx
  ON onetime.account_learner_identity_links(account_key, product_key, household_key, link_state);
