ALTER TABLE onetime.outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_channel_check;

ALTER TABLE onetime.outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_constraint_1;

ALTER TABLE onetime.outbox_events
  ADD CONSTRAINT outbox_events_channel_check
  CHECK (channel IN ('email', 'whatsapp', 'internal_email', 'highlevel'));

CREATE INDEX IF NOT EXISTS outbox_events_highlevel_pending_idx
  ON onetime.outbox_events(account_key, product_key, transport_mode, status, next_attempt_at, created_at)
  WHERE channel = 'highlevel' AND status IN ('pending', 'retry', 'processing');

ALTER TABLE onetime.outbox_events
  ADD COLUMN transport_authorization_state text NOT NULL DEFAULT 'held'
    CHECK (transport_authorization_state IN (
      'held', 'authorized', 'processing', 'completed', 'uncertain', 'revoked'
    )),
  ADD COLUMN transport_authorization_run_id text,
  ADD COLUMN transport_authorization_allowlist_hash text,
  ADD COLUMN transport_claim_token text,
  ADD COLUMN transport_lease_expires_at timestamptz;

CREATE TABLE onetime.highlevel_canary_runs (
  account_key text NOT NULL,
  product_key text NOT NULL,
  run_id text NOT NULL,
  transport_mode text NOT NULL CHECK (transport_mode IN ('mock', 'provider')),
  allowlist_hash text NOT NULL,
  budget integer NOT NULL CHECK (budget > 0),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'closed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, run_id)
);

CREATE TABLE onetime.highlevel_canary_run_allowlist (
  account_key text NOT NULL,
  product_key text NOT NULL,
  run_id text NOT NULL,
  delivery_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, run_id, delivery_key),
  FOREIGN KEY (account_key, product_key, run_id)
    REFERENCES onetime.highlevel_canary_runs(account_key, product_key, run_id),
  FOREIGN KEY (delivery_key) REFERENCES onetime.outbox_events(delivery_key)
);

CREATE TABLE onetime.highlevel_provider_operation_receipts (
  operation_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  delivery_key text NOT NULL,
  run_id text NOT NULL,
  operation_name text NOT NULL CHECK (operation_name IN ('contact_upsert', 'add_tags')),
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'uncertain')),
  claim_token text NOT NULL,
  provider_contact_id text,
  lease_expires_at timestamptz,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL,
  UNIQUE (account_key, product_key, delivery_key, operation_name),
  FOREIGN KEY (delivery_key) REFERENCES onetime.outbox_events(delivery_key)
);

CREATE INDEX highlevel_provider_operation_receipts_lease_idx
  ON onetime.highlevel_provider_operation_receipts(account_key, product_key, status, lease_expires_at)
  WHERE status = 'started';

CREATE TABLE onetime.highlevel_contact_preferences (
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  email_dnd boolean NOT NULL DEFAULT false,
  whatsapp_dnd boolean NOT NULL DEFAULT false,
  all_dnd boolean NOT NULL DEFAULT false,
  source_action_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE TABLE onetime.highlevel_action_receipts (
  receipt_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  action_name text NOT NULL,
  contact_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('processing', 'succeeded', 'rejected')),
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX highlevel_action_receipts_contact_idx
  ON onetime.highlevel_action_receipts(account_key, product_key, contact_key, created_at DESC);

CREATE INDEX highlevel_action_receipts_lease_idx
  ON onetime.highlevel_action_receipts(account_key, product_key, status, lease_expires_at)
  WHERE status IN ('processing', 'rejected');

CREATE TABLE onetime.highlevel_action_nonces (
  key_id text NOT NULL,
  nonce text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (key_id, nonce)
);

CREATE INDEX highlevel_action_nonces_expiry_idx
  ON onetime.highlevel_action_nonces(expires_at);
