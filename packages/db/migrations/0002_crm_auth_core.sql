CREATE TABLE onetime.account_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  email_normalized text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'crm_agent', 'viewer')),
  password_hash text NOT NULL,
  password_updated_at timestamptz NOT NULL DEFAULT now(),
  mfa_capable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, email_normalized)
);

CREATE TABLE onetime.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text NOT NULL REFERENCES onetime.account_users(user_key),
  token_hash text NOT NULL UNIQUE,
  csrf_token_hash text NOT NULL,
  user_agent_hash text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  rotated_from_session_key text
);

CREATE INDEX user_sessions_active_idx
  ON onetime.user_sessions(account_key, product_key, token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE onetime.auth_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  user_key text,
  event_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  reason text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onetime.contacts
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN lead_status text NOT NULL DEFAULT 'new' CHECK (lead_status IN ('new', 'in_review', 'contacted', 'scheduled', 'closed', 'archived')),
  ADD COLUMN assigned_user_key text,
  ADD COLUMN internal_note text NOT NULL DEFAULT '',
  ADD COLUMN offer_version text,
  ADD COLUMN content_version text,
  ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN archived_at timestamptz;

UPDATE onetime.contacts AS contacts
   SET offer_version = leads.offer_version,
       content_version = leads.content_version,
       lead_status = leads.status,
       last_activity_at = leads.created_at
  FROM onetime.signup_leads AS leads
 WHERE leads.contact_key = contacts.contact_key;

CREATE INDEX contacts_crm_list_idx
  ON onetime.contacts(account_key, product_key, updated_at DESC, contact_key DESC);

CREATE INDEX contacts_crm_name_idx
  ON onetime.contacts(account_key, product_key, display_name, contact_key);

CREATE INDEX contacts_crm_status_idx
  ON onetime.contacts(account_key, product_key, lead_status, updated_at DESC);

CREATE INDEX contacts_crm_classification_idx
  ON onetime.contacts(account_key, product_key, family_school_classification, updated_at DESC);
