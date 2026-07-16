CREATE TABLE onetime.auth_email_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  challenge_token_hash text NOT NULL UNIQUE,
  link_token_hash text NOT NULL UNIQUE,
  code_hash text NOT NULL,
  destination_ref text NOT NULL,
  security_version integer NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  superseded_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX auth_email_challenges_active_idx
  ON onetime.auth_email_challenges(account_key, product_key, user_key, expires_at)
  WHERE consumed_at IS NULL AND superseded_at IS NULL;

CREATE INDEX auth_email_challenges_destination_idx
  ON onetime.auth_email_challenges(account_key, product_key, destination_ref, created_at);

CREATE TABLE onetime.auth_email_challenge_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  challenge_key text NOT NULL REFERENCES onetime.auth_email_challenges(challenge_key),
  purpose text NOT NULL DEFAULT 'owner_admin_login_step_up' CHECK (
    purpose = 'owner_admin_login_step_up'
  ),
  channel text NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
  transport_mode text NOT NULL DEFAULT 'sink' CHECK (transport_mode IN ('sink', 'provider')),
  destination_ref text NOT NULL,
  key_id text NOT NULL,
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  nonce text,
  ciphertext text,
  auth_tag text,
  encrypted_payload_expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN (
    'queued',
    'leased',
    'retry',
    'sink_delivered',
    'provider_delivered',
    'provider_off',
    'dead_letter',
    'superseded',
    'expired',
    'cleared'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text NOT NULL,
  provider_message_ref_hash text,
  last_error_code text,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (account_key, product_key, purpose, idempotency_key),
  CHECK (
    state IN ('sink_delivered', 'provider_delivered', 'superseded', 'expired', 'cleared')
    OR (nonce IS NOT NULL AND ciphertext IS NOT NULL AND auth_tag IS NOT NULL)
  )
);

CREATE INDEX auth_email_challenge_delivery_claim_idx
  ON onetime.auth_email_challenge_delivery_outbox(
    account_key,
    product_key,
    transport_mode,
    state,
    next_attempt_at,
    created_at
  )
  WHERE state IN ('queued', 'retry', 'leased');

CREATE INDEX auth_email_challenge_delivery_challenge_idx
  ON onetime.auth_email_challenge_delivery_outbox(account_key, product_key, challenge_key);

CREATE INDEX auth_email_challenge_delivery_destination_idx
  ON onetime.auth_email_challenge_delivery_outbox(account_key, product_key, purpose, destination_ref)
  WHERE state IN ('queued', 'leased', 'retry', 'provider_off');

CREATE TABLE onetime.auth_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  token_hash text NOT NULL UNIQUE,
  user_agent_hash text,
  ip_hash text,
  security_version integer NOT NULL,
  trusted_until timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX auth_trusted_devices_user_active_idx
  ON onetime.auth_trusted_devices(account_key, product_key, user_key, trusted_until)
  WHERE revoked_at IS NULL;
