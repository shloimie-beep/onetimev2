CREATE TABLE onetime.account_activation_mfa_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  handoff_hash text NOT NULL UNIQUE,
  mfa_enrollment_token_hash text,
  purpose text NOT NULL DEFAULT 'owner_admin_post_activation_mfa' CHECK (
    purpose = 'owner_admin_post_activation_mfa'
  ),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX account_activation_mfa_handoffs_active_idx
  ON onetime.account_activation_mfa_handoffs(account_key, product_key, handoff_hash, expires_at)
  WHERE consumed_at IS NULL;
