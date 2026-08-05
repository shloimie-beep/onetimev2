-- Durable production consumer state for the append-only Family-signup outbox.
-- Provider effects are advanced one step at a time. An expired workflow
-- submission is quarantined as acceptance-unknown rather than replayed, which
-- protects the one-confirmation-email invariant across worker restarts.
CREATE TABLE onetime.family_signup_ghl_dispatches (
  intent_id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending', 'processing', 'retry', 'identity_review',
    'acceptance_unknown', 'complete'
  )),
  current_step text NOT NULL DEFAULT 'contact_upsert' CHECK (current_step IN (
    'contact_upsert', 'household_opportunity_upsert', 'workflow_enrollment', 'complete'
  )),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token text,
  lease_expires_at timestamptz,
  provider_contact_id text,
  provider_opportunity_id text,
  safe_error_code text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (intent_id)
    REFERENCES onetime.family_signup_outbox(intent_id) ON DELETE RESTRICT,
  CHECK (
    (state = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (state <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (current_step <> 'complete' OR state = 'complete'),
  CHECK (
    current_step = 'contact_upsert'
    OR provider_contact_id IS NOT NULL
  ),
  CHECK (
    current_step IN ('contact_upsert', 'household_opportunity_upsert')
    OR provider_opportunity_id IS NOT NULL
  )
);

CREATE INDEX family_signup_ghl_dispatch_claim_idx
  ON onetime.family_signup_ghl_dispatches(state, next_attempt_at, updated_at)
  WHERE state IN ('pending', 'retry', 'processing');

CREATE TABLE onetime.family_signup_ghl_effect_receipts (
  intent_id text NOT NULL,
  effect_kind text NOT NULL CHECK (effect_kind IN (
    'contact_upsert', 'household_opportunity_upsert', 'workflow_enrollment'
  )),
  operation_key text NOT NULL UNIQUE,
  provider_resource_ref_hash text NOT NULL,
  provider_response_digest text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (intent_id, effect_kind),
  FOREIGN KEY (intent_id)
    REFERENCES onetime.family_signup_outbox(intent_id) ON DELETE RESTRICT,
  CHECK (
    length(provider_resource_ref_hash) = 64
    AND provider_resource_ref_hash = lower(provider_resource_ref_hash)
  ),
  CHECK (
    length(provider_response_digest) = 64
    AND provider_response_digest = lower(provider_response_digest)
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.family_signup_ghl_effect_receipts
  ADD CONSTRAINT family_signup_ghl_resource_hash_hex_check
    CHECK (provider_resource_ref_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT family_signup_ghl_response_digest_hex_check
    CHECK (provider_response_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_family_signup_ghl_effect_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Family-signup HighLevel effect receipts are append-only';
END;
$$;

CREATE TRIGGER family_signup_ghl_effect_receipts_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_ghl_effect_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_ghl_effect_receipt_mutation();
-- @postgres-only-end

SELECT 1;
