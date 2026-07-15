CREATE TABLE onetime.billing_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL CHECK (lower(provider_account_ref) NOT LIKE '%live%'),
  status text NOT NULL CHECK (status IN ('active', 'disabled', 'manual_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, mode, provider_account_ref)
);

CREATE TABLE onetime.billing_offer_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  offer_key text NOT NULL,
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL CHECK (lower(provider_account_ref) NOT LIKE '%live%'),
  provider_price_ref text NOT NULL CHECK (lower(provider_price_ref) NOT LIKE '%live%'),
  currency text NOT NULL CHECK (currency = lower(currency)),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic = true),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, offer_key, provider, mode, provider_account_ref, provider_price_ref),
  FOREIGN KEY (provider, mode, provider_account_ref)
    REFERENCES onetime.billing_provider_accounts(provider, mode, provider_account_ref)
);

CREATE TABLE onetime.billing_principal_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL CHECK (lower(provider_account_ref) NOT LIKE '%live%'),
  provider_customer_ref text NOT NULL CHECK (lower(provider_customer_ref) NOT LIKE '%live%'),
  status text NOT NULL CHECK (status IN ('active', 'archived', 'manual_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  FOREIGN KEY (provider, mode, provider_account_ref)
    REFERENCES onetime.billing_provider_accounts(provider, mode, provider_account_ref)
);

CREATE UNIQUE INDEX billing_customer_one_active_principal_idx
  ON onetime.billing_principal_customers(account_key, product_key, principal_key, provider, mode)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX billing_customer_one_active_provider_ref_idx
  ON onetime.billing_principal_customers(account_key, product_key, provider, mode, provider_customer_ref)
  WHERE archived_at IS NULL;

CREATE TABLE onetime.billing_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  offer_key text NOT NULL,
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL,
  provider_price_ref text NOT NULL,
  provider_customer_ref text NOT NULL,
  provider_checkout_session_ref text NOT NULL CHECK (lower(provider_checkout_session_ref) NOT LIKE '%live%'),
  provider_subscription_ref text CHECK (provider_subscription_ref IS NULL OR lower(provider_subscription_ref) NOT LIKE '%live%'),
  idempotency_key text NOT NULL,
  redirect_url text NOT NULL CHECK (redirect_url LIKE '/app/billing/fixture-%'),
  status text NOT NULL CHECK (status IN ('requested', 'created', 'expired', 'manual_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, principal_key, offer_key, idempotency_key),
  UNIQUE (provider, mode, provider_account_ref, provider_checkout_session_ref),
  FOREIGN KEY (account_key, product_key, offer_key, provider, mode, provider_account_ref, provider_price_ref)
    REFERENCES onetime.billing_offer_prices(account_key, product_key, offer_key, provider, mode, provider_account_ref, provider_price_ref)
);

CREATE TABLE onetime.billing_subscription_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL,
  provider_customer_ref text NOT NULL,
  provider_subscription_ref text NOT NULL CHECK (lower(provider_subscription_ref) NOT LIKE '%live%'),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'disputed', 'refunded', 'unknown')),
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  provider_updated_at timestamptz NOT NULL,
  source_event_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, provider, mode, provider_subscription_ref)
);

CREATE TABLE onetime.billing_invoice_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL,
  provider_invoice_ref text NOT NULL CHECK (lower(provider_invoice_ref) NOT LIKE '%live%'),
  provider_subscription_ref text CHECK (provider_subscription_ref IS NULL OR lower(provider_subscription_ref) NOT LIKE '%live%'),
  status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'payment_failed', 'unknown')),
  currency text NOT NULL CHECK (currency = lower(currency)),
  amount_due_cents integer NOT NULL CHECK (amount_due_cents >= 0),
  amount_paid_cents integer NOT NULL CHECK (amount_paid_cents >= 0),
  issued_at timestamptz,
  source_event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, provider, mode, provider_invoice_ref),
  CHECK (lower(provider_invoice_ref) NOT LIKE 'http://%' AND lower(provider_invoice_ref) NOT LIKE 'https://%')
);

CREATE TABLE onetime.billing_verified_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_created_at timestamptz NOT NULL,
  livemode boolean NOT NULL DEFAULT false CHECK (livemode = false),
  raw_body_digest text NOT NULL CHECK (raw_body_digest = lower(raw_body_digest)),
  payload_digest text NOT NULL CHECK (payload_digest = lower(payload_digest)),
  object_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, mode, provider_account_ref, provider_event_id)
);

CREATE INDEX billing_verified_events_lookup_idx
  ON onetime.billing_verified_events(provider, mode, provider_account_ref, provider_event_id);

CREATE TABLE onetime.billing_event_processing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE,
  event_key text NOT NULL REFERENCES onetime.billing_verified_events(event_key),
  disposition text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.billing_reconciliation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_account_ref text NOT NULL,
  idempotency_key text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'succeeded', 'failed', 'retry_exhausted', 'manual_review')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, principal_key, idempotency_key)
);

CREATE TABLE onetime.billing_entitlement_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text NOT NULL CHECK (principal_key <> ''),
  principal_type text NOT NULL CHECK (principal_type IN ('account_user', 'contact', 'opaque')),
  status text NOT NULL CHECK (status IN ('pending', 'billing_eligible', 'active', 'suspended', 'scheduled_end', 'revoked', 'manual_review')),
  policy_version text NOT NULL,
  source text NOT NULL CHECK (source <> ''),
  reason text NOT NULL,
  effective_at timestamptz NOT NULL,
  evaluated_at timestamptz NOT NULL,
  grants_access boolean NOT NULL DEFAULT false CHECK (grants_access = false),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_entitlement_scope_idx
  ON onetime.billing_entitlement_projections(account_key, product_key, principal_key, status);

CREATE TABLE onetime.billing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  principal_key text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_audit_scope_idx
  ON onetime.billing_audit_events(account_key, product_key, principal_key, created_at DESC);
