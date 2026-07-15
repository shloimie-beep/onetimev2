ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_redirect_url_check;

ALTER TABLE onetime.billing_checkout_sessions
  ADD CONSTRAINT billing_checkout_sessions_redirect_url_ot72_check
  CHECK (
    redirect_url LIKE '/app/billing/fixture-%'
    OR redirect_url LIKE '/app/billing/checkout/redirect/%'
    OR redirect_url LIKE '/app/billing/portal/redirect/%'
  );

CREATE TABLE onetime.provider_event_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider text NOT NULL CHECK (
    provider IN ('stripe', 'resend', 'one_time_wapi', 'zoom', 'vimeo', 'one_time_telegram', 'bna_oversight')
  ),
  environment text NOT NULL CHECK (environment IN ('fixture', 'test', 'staging', 'production')),
  provider_event_ref_hash text NOT NULL CHECK (provider_event_ref_hash = lower(provider_event_ref_hash)),
  event_type text NOT NULL,
  canonical_state text NOT NULL CHECK (
    canonical_state IN (
      'queued_locally',
      'sink_processed',
      'provider_accepted',
      'delivered',
      'failed',
      'bounced',
      'complained',
      'suppressed',
      'expired',
      'dead_lettered',
      'unavailable'
    )
  ),
  provider_created_at timestamptz,
  payload_digest text NOT NULL CHECK (payload_digest = lower(payload_digest)),
  object_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, environment, provider_event_ref_hash, event_type)
);

CREATE INDEX provider_event_ledger_scope_idx
  ON onetime.provider_event_ledger(account_key, product_key, provider, canonical_state, created_at DESC);

CREATE TABLE onetime.provider_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider text NOT NULL CHECK (
    provider IN ('stripe', 'resend', 'one_time_wapi', 'zoom', 'vimeo', 'one_time_telegram', 'bna_oversight')
  ),
  environment text NOT NULL CHECK (environment IN ('fixture', 'test', 'staging', 'production')),
  readiness_state text NOT NULL CHECK (
    readiness_state IN ('not_configured', 'configured', 'authenticated', 'canary_verified', 'live', 'unavailable')
  ),
  capability_names text[] NOT NULL DEFAULT '{}',
  safe_fingerprint text,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX provider_readiness_scope_idx
  ON onetime.provider_readiness_snapshots(account_key, product_key, provider, observed_at DESC);

CREATE TABLE onetime.oversight_outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  source_sha text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'deployment_source_health',
      'migration_readiness',
      'worker_readiness',
      'provider_readiness',
      'operational_counts',
      'repair_reason_codes'
    )
  ),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'retry', 'dead_lettered')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  produced_at timestamptz NOT NULL,
  stale_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oversight_outbox_claim_idx
  ON onetime.oversight_outbox_events(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry');

