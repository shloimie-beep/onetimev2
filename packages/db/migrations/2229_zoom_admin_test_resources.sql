CREATE TABLE onetime.zoom_admin_test_resources (
  resource_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  connection_state text NOT NULL DEFAULT 'not_checked'
    CHECK (connection_state IN ('not_checked', 'connected', 'unavailable')),
  connection_checked_at timestamptz,
  resource_state text NOT NULL DEFAULT 'none'
    CHECK (
      resource_state IN (
        'none',
        'creating',
        'active',
        'create_failed',
        'create_unknown',
        'deleting',
        'deleted',
        'delete_unknown'
      )
    ),
  provider_meeting_ref_digest text,
  provider_meeting_ciphertext text,
  meeting_topic text,
  meeting_starts_at timestamptz,
  meeting_duration_minutes integer
    CHECK (meeting_duration_minutes IS NULL OR meeting_duration_minutes BETWEEN 1 AND 120),
  created_by_user_ref text,
  create_idempotency_key text,
  registrant_state text NOT NULL DEFAULT 'none'
    CHECK (
      registrant_state IN (
        'none',
        'registering',
        'registered',
        'registration_failed',
        'registration_unknown'
      )
    ),
  provider_registrant_ref_digest text,
  register_idempotency_key text,
  delete_idempotency_key text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key)
);

CREATE INDEX zoom_admin_test_resources_state_idx
  ON onetime.zoom_admin_test_resources(account_key, product_key, resource_state, updated_at DESC);
