ALTER TABLE onetime.account_users
  ADD COLUMN security_version integer NOT NULL DEFAULT 1,
  ADD COLUMN security_policy_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE onetime.user_sessions
  ADD COLUMN security_version integer NOT NULL DEFAULT 1,
  ADD COLUMN assurance_method text NOT NULL DEFAULT 'password',
  ADD COLUMN assurance_at timestamptz,
  ADD COLUMN context_policy text NOT NULL DEFAULT 'user_agent_exact_ip_audit_only';

CREATE INDEX user_sessions_user_active_idx
  ON onetime.user_sessions(account_key, product_key, user_key, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE onetime.rate_limit_buckets (
  budget_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  scope text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_buckets_expiry_idx
  ON onetime.rate_limit_buckets(expires_at);

CREATE TABLE onetime.mfa_factors (
  factor_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  factor_type text NOT NULL CHECK (factor_type IN ('totp')),
  secret_ciphertext text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  last_used_step bigint,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mfa_factors_user_active_idx
  ON onetime.mfa_factors(account_key, product_key, user_key, status);

CREATE TABLE onetime.mfa_enrollment_tokens (
  token_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  token_hash text NOT NULL UNIQUE,
  factor_key text REFERENCES onetime.mfa_factors(factor_key),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.mfa_challenges (
  challenge_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  challenge_hash text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.mfa_recovery_codes (
  code_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  code_hash text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onetime.idempotency_records
  ADD COLUMN response_status integer NOT NULL DEFAULT 200,
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

CREATE INDEX idempotency_records_expiry_idx
  ON onetime.idempotency_records(expires_at);

ALTER TABLE onetime.contacts
  ADD COLUMN public_contact_id text,
  ADD COLUMN legacy_contact_key text,
  ADD COLUMN identity_version integer NOT NULL DEFAULT 1;

-- @postgres-only-begin
UPDATE onetime.contacts
   SET public_contact_id = id::text,
       legacy_contact_key = contact_key
 WHERE public_contact_id IS NULL;

ALTER TABLE onetime.contacts
  ALTER COLUMN public_contact_id SET NOT NULL;

CREATE UNIQUE INDEX contacts_public_contact_id_idx
  ON onetime.contacts(account_key, product_key, public_contact_id);

CREATE INDEX contacts_search_name_idx
  ON onetime.contacts(account_key, product_key, lower(display_name), public_contact_id);

CREATE INDEX contacts_search_email_idx
  ON onetime.contacts(account_key, product_key, lower(email_normalized), public_contact_id);

CREATE INDEX contacts_assignee_idx
  ON onetime.contacts(account_key, product_key, assigned_user_key, updated_at DESC);

UPDATE onetime.contacts
   SET offer_version = authoritative.offer_version,
       content_version = authoritative.content_version,
       lead_status = COALESCE(authoritative.status, lead_status),
       last_activity_at = COALESCE(authoritative.created_at, last_activity_at)
  FROM (
    SELECT candidate.contact_key AS authoritative_contact_key,
           candidate.offer_version,
           candidate.content_version,
           candidate.status,
           candidate.created_at
      FROM onetime.signup_leads AS candidate
     WHERE NOT EXISTS (
       SELECT 1
         FROM onetime.signup_leads AS newer
        WHERE newer.contact_key = candidate.contact_key
          AND (
            newer.created_at > candidate.created_at
            OR (
              newer.created_at = candidate.created_at
              AND newer.signup_key > candidate.signup_key
            )
          )
     )
  ) AS authoritative
 WHERE authoritative.authoritative_contact_key = contact_key;
-- @postgres-only-end
