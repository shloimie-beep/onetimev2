CREATE SCHEMA IF NOT EXISTS onetime;

CREATE TABLE onetime.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  display_name text NOT NULL,
  family_school_classification text NOT NULL CHECK (family_school_classification IN ('family', 'school')),
  family_or_school text NOT NULL,
  location_text text NOT NULL,
  timezone text NOT NULL,
  email_normalized text NOT NULL,
  phone_normalized text,
  reminder_preference text NOT NULL CHECK (reminder_preference IN ('email', 'whatsapp', 'both', 'none')),
  consent_policy_version text,
  consent_recorded_at timestamptz,
  suppression_state text NOT NULL DEFAULT 'active',
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, email_normalized)
);

CREATE UNIQUE INDEX contacts_phone_identity_idx
  ON onetime.contacts(account_key, product_key, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE TABLE onetime.signup_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_key text NOT NULL UNIQUE,
  contact_key text NOT NULL REFERENCES onetime.contacts(contact_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  offer_version text NOT NULL,
  content_version text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('family', 'school')),
  status text NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_key, offer_version, content_version)
);

CREATE TABLE onetime.idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE TABLE onetime.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  signup_key text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  signup_key text,
  event_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'internal_email')),
  transport_mode text NOT NULL DEFAULT 'sink',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
