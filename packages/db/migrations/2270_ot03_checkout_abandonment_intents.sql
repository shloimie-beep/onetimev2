CREATE TABLE onetime.billing_checkout_abandonment_intents (
  intent_key text PRIMARY KEY,
  checkout_request_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  adult_id text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'adult_household'
    CHECK (subject_kind = 'adult_household'),
  workflow_key text NOT NULL DEFAULT 'OT-03'
    CHECK (workflow_key = 'OT-03'),
  event_type text NOT NULL DEFAULT 'billing.checkout_abandonment_checkpoint.v1'
    CHECK (event_type = 'billing.checkout_abandonment_checkpoint.v1'),
  trigger text NOT NULL DEFAULT
    'checkout started and not completed within the registered wait window'
    CHECK (
      trigger = 'checkout started and not completed within the registered wait window'
    ),
  checkpoint text NOT NULL CHECK (checkpoint IN ('after_2h', 'after_24h')),
  checkpoint_hours integer NOT NULL CHECK (checkpoint_hours IN (2, 24)),
  source_event_digest text NOT NULL,
  episode_key text NOT NULL,
  checkout_started_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  local_episode_evidence boolean NOT NULL DEFAULT true
    CHECK (local_episode_evidence = true),
  local_commit_readback boolean NOT NULL DEFAULT true
    CHECK (local_commit_readback = true),
  student_contact_allowed boolean NOT NULL DEFAULT false
    CHECK (student_contact_allowed = false),
  provider_financial_mutation boolean NOT NULL DEFAULT false
    CHECK (provider_financial_mutation = false),
  provider_access_mutation boolean NOT NULL DEFAULT false
    CHECK (provider_access_mutation = false),
  binding_state text NOT NULL DEFAULT 'pending_external_binding'
    CHECK (binding_state = 'pending_external_binding'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_request_key, checkpoint),
  FOREIGN KEY (checkout_request_key)
    REFERENCES onetime.billing_checkout_sessions(checkout_request_key) ON DELETE RESTRICT,
  FOREIGN KEY (adult_id)
    REFERENCES onetime.v21_adult_identities(adult_id) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
    ON DELETE RESTRICT,
  CHECK (
    (checkpoint = 'after_2h' AND checkpoint_hours = 2)
    OR (checkpoint = 'after_24h' AND checkpoint_hours = 24)
  ),
  CHECK (due_at >= checkout_started_at),
  CHECK (observed_at >= due_at)
);

CREATE INDEX billing_checkout_abandonment_binding_idx
  ON onetime.billing_checkout_abandonment_intents(
    binding_state,
    observed_at,
    checkout_request_key
  )
  WHERE binding_state = 'pending_external_binding';

-- @postgres-only-begin
ALTER TABLE onetime.billing_checkout_abandonment_intents
  ADD CONSTRAINT billing_checkout_abandonment_intent_hash_check CHECK (
    length(intent_key) = 64
    AND intent_key = lower(intent_key)
    AND intent_key ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_checkout_abandonment_source_hash_check CHECK (
    length(source_event_digest) = 64
    AND source_event_digest = lower(source_event_digest)
    AND source_event_digest ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT billing_checkout_abandonment_episode_hash_check CHECK (
    length(episode_key) = 64
    AND episode_key = lower(episode_key)
    AND episode_key ~ '^[a-f0-9]{64}$'
  );

CREATE OR REPLACE FUNCTION onetime.reject_billing_checkout_abandonment_intent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'billing_checkout_abandonment_intents are append-only';
END;
$$;

CREATE TRIGGER billing_checkout_abandonment_intents_append_only
BEFORE UPDATE OR DELETE ON onetime.billing_checkout_abandonment_intents
FOR EACH ROW EXECUTE FUNCTION onetime.reject_billing_checkout_abandonment_intent_mutation();

COMMENT ON TABLE onetime.billing_checkout_abandonment_intents IS
  'Adult-household local OT-03 checkpoints only. No provider workflow ID, Student contact, payment/access authority, tag write, or provider effect is stored or executed here.';
-- @postgres-only-end
