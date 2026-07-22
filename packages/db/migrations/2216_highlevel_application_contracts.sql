ALTER TABLE onetime.outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_channel_check;

ALTER TABLE onetime.outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_constraint_1;

ALTER TABLE onetime.outbox_events
  ADD CONSTRAINT outbox_events_channel_check
  CHECK (channel IN ('email', 'whatsapp', 'internal_email', 'highlevel'));

CREATE INDEX IF NOT EXISTS outbox_events_highlevel_pending_idx
  ON onetime.outbox_events(account_key, product_key, status, next_attempt_at, created_at)
  WHERE channel = 'highlevel' AND status IN ('pending', 'retry');

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
