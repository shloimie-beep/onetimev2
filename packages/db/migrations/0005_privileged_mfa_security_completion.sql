ALTER TABLE onetime.account_users
  ADD COLUMN credential_version integer NOT NULL DEFAULT 1,
  ADD COLUMN session_version integer NOT NULL DEFAULT 1;

ALTER TABLE onetime.user_sessions
  ADD COLUMN credential_version integer NOT NULL DEFAULT 1,
  ADD COLUMN session_version integer NOT NULL DEFAULT 1,
  ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN auth_assurance text NOT NULL DEFAULT 'password_only'
    CHECK (auth_assurance IN ('password_only', 'mfa'));

CREATE INDEX user_sessions_user_family_idx
  ON onetime.user_sessions(account_key, product_key, user_key, revoked_at, expires_at);

ALTER TABLE onetime.contacts
  ADD COLUMN public_id text;

UPDATE onetime.contacts
   SET public_id = 'contact_' || CAST(gen_random_uuid() AS text)
 WHERE public_id IS NULL;

ALTER TABLE onetime.contacts
  ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE onetime.contacts
  ALTER COLUMN public_id SET DEFAULT ('contact_' || CAST(gen_random_uuid() AS text));

CREATE UNIQUE INDEX contacts_public_id_idx
  ON onetime.contacts(account_key, product_key, public_id);

CREATE TABLE onetime.auth_pre_auth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('mfa_challenge', 'mfa_enrollment')),
  pending_secret_ciphertext text,
  pending_secret_key_version text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent_hash text,
  ip_hash text
);

CREATE INDEX auth_pre_auth_active_idx
  ON onetime.auth_pre_auth_transactions(account_key, product_key, token_hash, expires_at)
  WHERE used_at IS NULL;

CREATE TABLE onetime.user_mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  factor_type text NOT NULL CHECK (factor_type = 'totp'),
  secret_ciphertext text NOT NULL,
  secret_key_version text NOT NULL,
  label text NOT NULL,
  last_accepted_counter bigint,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  replaced_by_factor_key text
);

CREATE UNIQUE INDEX user_mfa_one_active_factor_idx
  ON onetime.user_mfa_factors(account_key, product_key, user_key)
  WHERE status = 'active';

CREATE TABLE onetime.user_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX user_mfa_recovery_active_code_idx
  ON onetime.user_mfa_recovery_codes(account_key, product_key, user_key, code_hash)
  WHERE status = 'active';

CREATE TABLE onetime.mfa_throttle_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_bucket_hash text NOT NULL,
  ip_bucket_hash text NOT NULL,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, user_bucket_hash, ip_bucket_hash)
);

CREATE INDEX mfa_throttle_locked_idx
  ON onetime.mfa_throttle_buckets(account_key, product_key, locked_until)
  WHERE locked_until IS NOT NULL;

CREATE TABLE onetime.crm_create_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_key, idempotency_key)
);

CREATE INDEX contacts_search_scope_idx
  ON onetime.contacts(account_key, product_key, lower(display_name), public_id)
  WHERE archived_at IS NULL;
