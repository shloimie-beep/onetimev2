ALTER TABLE onetime.billing_offer_prices
  DROP CONSTRAINT IF EXISTS billing_offer_prices_synthetic_check;

ALTER TABLE onetime.billing_offer_prices
  DROP CONSTRAINT IF EXISTS billing_offer_prices_constraint_7;

ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_redirect_url_check;

ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_redirect_url_ot72_check;

ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_status_check;

ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_constraint_6;

ALTER TABLE onetime.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_constraint_7;

ALTER TABLE onetime.billing_checkout_sessions
  ADD COLUMN IF NOT EXISTS request_fingerprint text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

ALTER TABLE onetime.billing_checkout_sessions
  ADD CONSTRAINT billing_checkout_sessions_redirect_url_check
  CHECK (
    redirect_url LIKE '/app/billing/fixture-%'
    OR redirect_url LIKE '/app/billing/checkout/redirect/%'
    OR redirect_url LIKE '/app/billing/portal/redirect/%'
    OR redirect_url = '/app/billing/checkout/pending'
  );

ALTER TABLE onetime.billing_checkout_sessions
  ADD CONSTRAINT billing_checkout_sessions_status_check
  CHECK (
    status IN (
      'requested',
      'started',
      'created',
      'session_created',
      'completed',
      'expired',
      'canceled',
      'manual_review'
    )
  );

ALTER TABLE onetime.billing_subscription_projections
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latest_invoice_ref text,
  ADD COLUMN IF NOT EXISTS collection_state text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS projection_version integer NOT NULL DEFAULT 1;

ALTER TABLE onetime.billing_subscription_projections
  ADD CONSTRAINT billing_subscription_latest_invoice_not_live_check
  CHECK (latest_invoice_ref IS NULL OR lower(latest_invoice_ref) NOT LIKE '%live%');

ALTER TABLE onetime.billing_subscription_projections
  ADD CONSTRAINT billing_subscription_collection_state_check
  CHECK (collection_state IN ('paid', 'payment_failed', 'payment_action_required', 'unknown'));

ALTER TABLE onetime.billing_invoice_summaries
  DROP CONSTRAINT IF EXISTS billing_invoice_summaries_status_check;

ALTER TABLE onetime.billing_invoice_summaries
  DROP CONSTRAINT IF EXISTS billing_invoice_summaries_constraint_6;

ALTER TABLE onetime.billing_invoice_summaries
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_state text NOT NULL DEFAULT 'none';

ALTER TABLE onetime.billing_invoice_summaries
  ADD CONSTRAINT billing_invoice_summaries_status_check
  CHECK (
    status IN (
      'draft',
      'open',
      'paid',
      'void',
      'uncollectible',
      'payment_failed',
      'payment_action_required',
      'refunded',
      'disputed',
      'unknown'
    )
  );

ALTER TABLE onetime.billing_invoice_summaries
  ADD CONSTRAINT billing_invoice_refund_amount_check
  CHECK (refunded_amount_cents >= 0);

ALTER TABLE onetime.billing_invoice_summaries
  ADD CONSTRAINT billing_invoice_dispute_state_check
  CHECK (dispute_state IN ('none', 'created', 'won', 'lost', 'closed'));

ALTER TABLE onetime.billing_entitlement_projections
  DROP CONSTRAINT IF EXISTS billing_entitlement_projections_grants_access_check;

ALTER TABLE onetime.billing_entitlement_projections
  DROP CONSTRAINT IF EXISTS billing_entitlement_projections_constraint_4;

ALTER TABLE onetime.billing_entitlement_projections
  DROP CONSTRAINT IF EXISTS billing_entitlement_projections_constraint_5;

CREATE TABLE onetime.billing_redirect_vault (
  redirect_key text PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'stripe'),
  mode text NOT NULL CHECK (mode = 'test'),
  provider_url text NOT NULL CHECK (
    provider_url LIKE 'https://checkout.stripe.com/%'
    OR provider_url LIKE 'https://billing.stripe.com/%'
  ),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_redirect_vault_expiry_idx
  ON onetime.billing_redirect_vault(expires_at)
  WHERE consumed_at IS NULL;
