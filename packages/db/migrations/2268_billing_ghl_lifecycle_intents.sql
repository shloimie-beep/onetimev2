CREATE TABLE onetime.billing_ghl_lifecycle_intents (
  transition_key text PRIMARY KEY,
  transition_sequence bigserial NOT NULL,
  entitlement_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'adult_household'
    CHECK (subject_kind = 'adult_household'),
  workflow_key text CHECK (
    workflow_key IS NULL OR workflow_key IN ('OT-04', 'OT-05', 'OT-06', 'OT-13')
  ),
  event_type text NOT NULL CHECK (
    event_type IN (
      'billing.payment_active.v1',
      'billing.payment_failed_grace.v1',
      'billing.subscription_canceled.v1',
      'billing.refund_or_chargeback.v1',
      'billing.lifecycle_checkpoint.v1'
    )
  ),
  trigger text,
  source_event_id text NOT NULL,
  source_event_digest text NOT NULL,
  episode_key text NOT NULL,
  episode_discriminator text NOT NULL CHECK (episode_discriminator <> ''),
  projection_status text NOT NULL CHECK (
    projection_status IN (
      'pending',
      'billing_eligible',
      'active',
      'suspended',
      'scheduled_end',
      'revoked',
      'manual_review'
    )
  ),
  projection_reason text NOT NULL CHECK (projection_reason <> ''),
  projection_grants_access boolean NOT NULL,
  policy_version text NOT NULL CHECK (policy_version <> ''),
  effective_at timestamptz NOT NULL,
  signed_billing_projection boolean NOT NULL DEFAULT true
    CHECK (signed_billing_projection = true),
  local_commit_readback boolean NOT NULL DEFAULT true
    CHECK (local_commit_readback = true),
  student_contact_allowed boolean NOT NULL DEFAULT false
    CHECK (student_contact_allowed = false),
  provider_financial_mutation boolean NOT NULL DEFAULT false
    CHECK (provider_financial_mutation = false),
  provider_access_mutation boolean NOT NULL DEFAULT false
    CHECK (provider_access_mutation = false),
  binding_state text NOT NULL CHECK (
    binding_state IN ('pending_external_binding', 'not_applicable')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entitlement_key, transition_sequence),
  UNIQUE (entitlement_key, episode_key),
  FOREIGN KEY (source_event_id)
    REFERENCES onetime.billing_verified_events(event_key) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
    ON DELETE RESTRICT,
  CHECK (
    (
      workflow_key IS NULL
      AND trigger IS NULL
      AND event_type = 'billing.lifecycle_checkpoint.v1'
      AND binding_state = 'not_applicable'
    )
    OR (
      workflow_key IS NOT NULL
      AND trigger IS NOT NULL
      AND event_type <> 'billing.lifecycle_checkpoint.v1'
      AND binding_state = 'pending_external_binding'
    )
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.billing_ghl_lifecycle_intents
  ADD CONSTRAINT billing_ghl_lifecycle_transition_hash_check CHECK (
    length(transition_key) = 64
    AND transition_key = lower(transition_key)
    AND transition_key ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_ghl_lifecycle_source_hash_check CHECK (
    length(source_event_digest) = 64
    AND source_event_digest = lower(source_event_digest)
    AND source_event_digest ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_ghl_lifecycle_episode_hash_check CHECK (
    length(episode_key) = 64
    AND episode_key = lower(episode_key)
    AND episode_key ~ '^[a-f0-9]{64}$'
  );
-- @postgres-only-end

CREATE INDEX billing_ghl_lifecycle_latest_idx
  ON onetime.billing_ghl_lifecycle_intents(
    entitlement_key,
    transition_sequence DESC
  );

CREATE INDEX billing_ghl_lifecycle_external_binding_idx
  ON onetime.billing_ghl_lifecycle_intents(
    binding_state,
    workflow_key,
    created_at
  )
  WHERE binding_state = 'pending_external_binding';

-- @postgres-only-begin
CREATE OR REPLACE FUNCTION onetime.reject_billing_ghl_lifecycle_intent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'billing_ghl_lifecycle_intents are append-only';
END;
$$;

CREATE TRIGGER billing_ghl_lifecycle_intents_append_only
BEFORE UPDATE OR DELETE ON onetime.billing_ghl_lifecycle_intents
FOR EACH ROW EXECUTE FUNCTION onetime.reject_billing_ghl_lifecycle_intent_mutation();
-- @postgres-only-end

-- @postgres-only-begin
COMMENT ON TABLE onetime.billing_ghl_lifecycle_intents IS
  'Adult-household, signed Stripe TEST lifecycle source events. No provider workflow ID, Student contact, payment authority, access authority, tag write, or provider effect is stored or executed here.';
-- @postgres-only-end
