-- A bounded, append-only correction source for a historical canonical free
-- period whose original Family-signup evidence is absent. This table is not a
-- signup substitute: it deliberately contains no consent, request, receipt,
-- outbox, or provider evidence.
CREATE TABLE onetime.family_signup_access_source_correction_receipts (
  correction_receipt_key text PRIMARY KEY CHECK (correction_receipt_key <> ''),
  household_id text NOT NULL,
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  source_transition_key text NOT NULL UNIQUE,
  source_effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  correction_state text NOT NULL DEFAULT 'active' CHECK (correction_state = 'active'),
  controller_authorization_reference text NOT NULL
    CHECK (controller_authorization_reference <> ''),
  request_digest text NOT NULL
    CHECK (length(request_digest) = 64 AND request_digest = lower(request_digest)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    household_id,
    product,
    runtime_tier,
    verification_environment_id,
    source_transition_key
  ),
  FOREIGN KEY (
    household_id,
    product,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_households(
    household_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (source_transition_key)
    REFERENCES onetime.canonical_state_transition_events(transition_key)
    ON DELETE RESTRICT,
  CHECK (expires_at > source_effective_at),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only',
        'production_operator_canary',
        'production_broad'
      ))
  )
);

CREATE INDEX family_signup_access_source_correction_lookup_idx
  ON onetime.family_signup_access_source_correction_receipts(
    household_id,
    product,
    runtime_tier,
    verification_environment_id,
    correction_state,
    expires_at
  );

-- @postgres-only-begin
CREATE TRIGGER family_signup_access_source_corrections_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_access_source_correction_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();
-- @postgres-only-end
