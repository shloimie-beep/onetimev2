CREATE TABLE onetime.login_throttle_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  email_bucket_hash text NOT NULL,
  ip_bucket_hash text NOT NULL,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, email_bucket_hash, ip_bucket_hash)
);

CREATE INDEX login_throttle_locked_idx
  ON onetime.login_throttle_buckets(account_key, product_key, locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX contacts_assignee_scope_idx
  ON onetime.contacts(account_key, product_key, assigned_user_key, updated_at DESC)
  WHERE assigned_user_key IS NOT NULL;

CREATE INDEX account_users_assignment_scope_idx
  ON onetime.account_users(account_key, product_key, user_key, status);
