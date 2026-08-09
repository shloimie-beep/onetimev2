CREATE TABLE onetime.billing_access_episode_authority (
  authority_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  billing_episode text NOT NULL CHECK (billing_episode <> ''),
  source_kind text NOT NULL CHECK (source_kind IN ('highlevel_signed_event', 'stripe_direct')),
  first_event_id text NOT NULL CHECK (first_event_id <> ''),
  latest_event_id text NOT NULL CHECK (latest_event_id <> ''),
  provider_customer_ref_hash text,
  provider_subscription_ref_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, household_key, billing_episode),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
    ON DELETE RESTRICT,
  CHECK (provider_customer_ref_hash IS NOT NULL OR provider_subscription_ref_hash IS NOT NULL)
);

CREATE TABLE onetime.billing_access_episode_events (
  event_key text PRIMARY KEY,
  event_id text NOT NULL UNIQUE CHECK (event_id <> ''),
  authority_key text NOT NULL
    REFERENCES onetime.billing_access_episode_authority(authority_key) ON DELETE RESTRICT,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  billing_episode text NOT NULL CHECK (billing_episode <> ''),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  verified_state text NOT NULL CHECK (
    verified_state IN ('active', 'grace', 'inactive', 'canceled')
  ),
  effective_at timestamptz NOT NULL,
  event_digest text NOT NULL,
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  source_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
    ON DELETE RESTRICT
);

-- @postgres-only-begin
ALTER TABLE onetime.billing_access_episode_authority
  ADD CONSTRAINT billing_access_authority_key_hash_check CHECK (
    authority_key ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_access_authority_customer_hash_check CHECK (
    provider_customer_ref_hash IS NULL
    OR provider_customer_ref_hash ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_access_authority_subscription_hash_check CHECK (
    provider_subscription_ref_hash IS NULL
    OR provider_subscription_ref_hash ~ '^[a-f0-9]{64}$'
  );

ALTER TABLE onetime.billing_access_episode_events
  ADD CONSTRAINT billing_access_event_key_hash_check CHECK (
    event_key ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_access_event_digest_hash_check CHECK (
    event_digest ~ '^[a-f0-9]{64}$'
  );

CREATE OR REPLACE FUNCTION onetime.reject_billing_access_episode_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'billing_access_episode_events are append-only';
END;
$$;

CREATE TRIGGER billing_access_episode_events_append_only
BEFORE UPDATE OR DELETE ON onetime.billing_access_episode_events
FOR EACH ROW EXECUTE FUNCTION onetime.reject_billing_access_episode_event_mutation();

COMMENT ON TABLE onetime.billing_access_episode_authority IS
  'One authoritative ingestion source per adult-household billing episode. Provider references are hashed; direct Stripe runtime remains disabled.';
COMMENT ON TABLE onetime.billing_access_episode_events IS
  'Append-only accepted signed GHL access-event evidence. It stores no payment history, Student identity, or raw provider identifier.';
-- @postgres-only-end

CREATE INDEX billing_access_episode_authority_scope_idx
  ON onetime.billing_access_episode_authority(
    account_key,
    product_key,
    household_key,
    updated_at DESC
  );

CREATE INDEX billing_access_episode_events_scope_idx
  ON onetime.billing_access_episode_events(
    account_key,
    product_key,
    household_key,
    source_updated_at DESC
  );
