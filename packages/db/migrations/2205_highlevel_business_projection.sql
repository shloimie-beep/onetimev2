CREATE TABLE IF NOT EXISTS onetime.highlevel_parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  parent_user_key text NOT NULL,
  household_key text NOT NULL,
  ghl_contact_id text NOT NULL,
  ghl_opportunity_id text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (
    sync_status IN ('pending', 'synced', 'sync_conflict', 'error', 'disabled')
  ),
  last_successful_sync_at timestamptz,
  last_error_code text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, parent_user_key),
  UNIQUE (account_key, product_key, household_key),
  UNIQUE (account_key, product_key, ghl_contact_id)
);

CREATE INDEX IF NOT EXISTS highlevel_parent_links_contact_idx
  ON onetime.highlevel_parent_links(account_key, product_key, ghl_contact_id);

CREATE INDEX IF NOT EXISTS highlevel_parent_links_sync_idx
  ON onetime.highlevel_parent_links(account_key, product_key, sync_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS onetime.highlevel_outbox_events (
  event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_type text NOT NULL,
  local_object_key text NOT NULL,
  payload_digest text NOT NULL,
  protected_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_flight', 'succeeded', 'retry', 'dead_letter', 'disabled')
  ),
  idempotency_key text NOT NULL,
  provider_result_reference_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS highlevel_outbox_pending_idx
  ON onetime.highlevel_outbox_events(account_key, product_key, status, next_attempt_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS highlevel_outbox_local_object_idx
  ON onetime.highlevel_outbox_events(account_key, product_key, local_object_key);

CREATE TABLE IF NOT EXISTS onetime.highlevel_event_inbox (
  provider_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  ghl_contact_id text,
  ghl_subscription_id text,
  ghl_transaction_id text,
  ghl_opportunity_id text,
  payload_digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  disposition text NOT NULL DEFAULT 'queued' CHECK (
    disposition IN ('queued', 'processed', 'ignored', 'manual_review', 'error')
  ),
  dedupe_state text NOT NULL DEFAULT 'first_seen' CHECK (
    dedupe_state IN ('first_seen', 'duplicate')
  ),
  replay_state text NOT NULL DEFAULT 'not_replayed' CHECK (
    replay_state IN ('not_replayed', 'replayed')
  ),
  out_of_order_state text NOT NULL DEFAULT 'not_detected' CHECK (
    out_of_order_state IN ('not_detected', 'detected')
  ),
  minimized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS highlevel_event_inbox_contact_idx
  ON onetime.highlevel_event_inbox(ghl_contact_id, received_at DESC)
  WHERE ghl_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS highlevel_event_inbox_subscription_idx
  ON onetime.highlevel_event_inbox(ghl_subscription_id, received_at DESC)
  WHERE ghl_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS highlevel_event_inbox_processing_idx
  ON onetime.highlevel_event_inbox(disposition, received_at);

CREATE TABLE IF NOT EXISTS onetime.highlevel_entitlement_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  ghl_contact_id text,
  ghl_subscription_id text,
  status text NOT NULL CHECK (status IN ('active', 'grace', 'complimentary', 'inactive')),
  reason text NOT NULL,
  effective_at timestamptz NOT NULL,
  grace_until timestamptz,
  current_period_end timestamptz,
  complimentary_until timestamptz,
  last_billing_event text,
  last_reconciled_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, household_key)
);

CREATE INDEX IF NOT EXISTS highlevel_entitlement_status_idx
  ON onetime.highlevel_entitlement_projection(account_key, product_key, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS highlevel_entitlement_contact_idx
  ON onetime.highlevel_entitlement_projection(account_key, product_key, ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS highlevel_entitlement_subscription_idx
  ON onetime.highlevel_entitlement_projection(account_key, product_key, ghl_subscription_id)
  WHERE ghl_subscription_id IS NOT NULL;
