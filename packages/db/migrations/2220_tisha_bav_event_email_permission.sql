CREATE TABLE IF NOT EXISTS onetime.event_email_permission_events (
  permission_event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  registration_key text NOT NULL REFERENCES onetime.event_registrations(registration_key),
  email_normalized text NOT NULL,
  permission_scope text NOT NULL CHECK (permission_scope = 'event_service_email'),
  action text NOT NULL CHECK (action IN (
    'granted',
    'withdrawn',
    'suppressed',
    'unsubscribed',
    'complained',
    'hard_bounced'
  )),
  disclosure_version text NOT NULL,
  source text NOT NULL,
  idempotency_key text NOT NULL,
  reason_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, event_code, idempotency_key)
);

CREATE INDEX IF NOT EXISTS event_email_permission_events_identity_idx
  ON onetime.event_email_permission_events(
    account_key,
    product_key,
    event_code,
    email_normalized,
    recorded_at DESC
  );

CREATE TABLE IF NOT EXISTS onetime.event_email_permissions (
  permission_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  registration_key text NOT NULL REFERENCES onetime.event_registrations(registration_key),
  email_normalized text NOT NULL,
  permission_scope text NOT NULL CHECK (permission_scope = 'event_service_email'),
  status text NOT NULL CHECK (status IN (
    'granted',
    'withdrawn',
    'suppressed',
    'unsubscribed',
    'complained',
    'hard_bounced'
  )),
  disclosure_version text NOT NULL,
  source text NOT NULL,
  granted_at timestamptz,
  denied_at timestamptz,
  deny_reason text,
  latest_permission_event_key text NOT NULL
    REFERENCES onetime.event_email_permission_events(permission_event_key),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, event_code, email_normalized)
);

CREATE INDEX IF NOT EXISTS event_email_permissions_delivery_idx
  ON onetime.event_email_permissions(account_key, product_key, event_code, status);

ALTER TABLE onetime.event_delivery_events
  ADD COLUMN IF NOT EXISTS lease_owner_hash text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
