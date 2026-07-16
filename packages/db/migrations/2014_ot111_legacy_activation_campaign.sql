ALTER TABLE onetime.legacy_audience_import_rows
  ADD COLUMN IF NOT EXISTS new_system_activated boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS onetime.legacy_activation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  segment_code text NOT NULL CHECK (
    segment_code IN ('active_legacy_family_users', 'other_family_leads', 'school_leads')
  ),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  template_kind text NOT NULL CHECK (
    template_kind IN ('activation_migration', 'launch_signup', 'school_follow_up')
  ),
  template_revision text NOT NULL,
  batch_size integer NOT NULL CHECK (batch_size > 0 AND batch_size <= 250),
  schedule_not_before timestamptz,
  status text NOT NULL DEFAULT 'previewed' CHECK (
    status IN ('previewed', 'approved', 'running', 'paused', 'cancelled', 'completed', 'blocked')
  ),
  snapshot_hash text NOT NULL,
  source_request_hash text NOT NULL,
  source_digest text NOT NULL,
  snapshot_expires_at timestamptz NOT NULL,
  snapshot_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_payload jsonb NOT NULL,
  idempotency_key text NOT NULL,
  approval_idempotency_key text,
  approval_fingerprint text,
  approved_by_user_key text,
  approved_at timestamptz,
  approval_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key),
  UNIQUE (account_key, product_key, campaign_key, approval_idempotency_key)
);

CREATE INDEX IF NOT EXISTS legacy_activation_campaigns_scope_idx
  ON onetime.legacy_activation_campaigns(account_key, product_key, created_at DESC);

CREATE INDEX IF NOT EXISTS legacy_activation_campaigns_batch_idx
  ON onetime.legacy_activation_campaigns(account_key, product_key, batch_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_activation_campaign_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key text NOT NULL UNIQUE,
  campaign_key text NOT NULL REFERENCES onetime.legacy_activation_campaigns(campaign_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  identity_ref text NOT NULL,
  row_key text REFERENCES onetime.legacy_audience_import_rows(row_key),
  contact_key text,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  template_revision text NOT NULL,
  delivery_state text NOT NULL DEFAULT 'queued' CHECK (
    delivery_state IN (
      'queued',
      'provider_accepted',
      'delivered',
      'bounced',
      'complained',
      'suppressed',
      'failed',
      'dead_lettered',
      'cancelled'
    )
  ),
  destination_ref text,
  lifecycle_intent_ref text,
  provider_message_ref_hash text,
  idempotency_key text NOT NULL,
  last_error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_key, identity_ref, channel, template_revision),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_activation_intents_state_idx
  ON onetime.legacy_activation_campaign_intents(account_key, product_key, delivery_state, created_at);

CREATE TABLE IF NOT EXISTS onetime.legacy_activation_campaign_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  campaign_key text REFERENCES onetime.legacy_activation_campaigns(campaign_key),
  batch_key text REFERENCES onetime.legacy_audience_import_batches(batch_key),
  actor_user_key text NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'preview_recorded',
      'preview_replayed',
      'approval_recorded',
      'approval_replayed',
      'send_intents_recorded',
      'send_intents_blocked',
      'paused',
      'resumed',
      'cancelled'
    )
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_activation_audit_campaign_idx
  ON onetime.legacy_activation_campaign_audit_events(account_key, product_key, campaign_key, created_at DESC);
