CREATE TABLE onetime.provider_operation_binding (
  job_id text PRIMARY KEY,
  registry_binding_key text NOT NULL CHECK (registry_binding_key <> ''),
  provider_account_ref_hash text NOT NULL,
  effect_kind text NOT NULL CHECK (effect_kind <> ''),
  household_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (job_id) REFERENCES onetime.job_outbox(job_id) ON DELETE RESTRICT,
  CHECK (
    length(provider_account_ref_hash) = 64
    AND provider_account_ref_hash = lower(provider_account_ref_hash)
  )
);

CREATE INDEX provider_operation_binding_household_idx
  ON onetime.provider_operation_binding(household_id, effect_kind);

CREATE TABLE onetime.adult_ghl_identity_link (
  adult_id text PRIMARY KEY,
  normalized_email_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('unlinked', 'linked', 'identity_review')),
  verified_contact_ref_hash text,
  candidate_contact_ref_hashes text[] NOT NULL DEFAULT '{}'::text[],
  quarantined_outbox_intent_ids text[] NOT NULL DEFAULT '{}'::text[],
  suppression_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (length(normalized_email_hash) = 64 AND normalized_email_hash = lower(normalized_email_hash)),
  CHECK (
    verified_contact_ref_hash IS NULL
    OR (
      length(verified_contact_ref_hash) = 64
      AND verified_contact_ref_hash = lower(verified_contact_ref_hash)
    )
  ),
  CHECK (
    (state = 'linked' AND verified_contact_ref_hash IS NOT NULL)
    OR state <> 'linked'
  ),
  CHECK (
    (state = 'identity_review' AND cardinality(candidate_contact_ref_hashes) > 1)
    OR state <> 'identity_review'
  )
);

CREATE TABLE onetime.household_provider_mapping (
  household_id text NOT NULL,
  owner_adult_id text NOT NULL,
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  billing_program text NOT NULL CHECK (billing_program <> ''),
  ghl_household_record_ref_hash text,
  projected_owner_contact_ref_hash text,
  stripe_customer_ref_hash text,
  service_reminders_enabled boolean NOT NULL DEFAULT false,
  lifecycle_state text NOT NULL CHECK (lifecycle_state <> ''),
  access_projection text NOT NULL CHECK (access_projection <> ''),
  reconciliation_state text NOT NULL
    CHECK (reconciliation_state IN ('in_sync', 'reconciliation_hold')),
  transfer_target_contact_ref_hash text,
  provider_revision bigint NOT NULL DEFAULT 0 CHECK (provider_revision >= 0),
  last_readback_digest text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    runtime_tier,
    verification_environment_id,
    household_id,
    billing_program
  ),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
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
  ),
  CHECK (
    ghl_household_record_ref_hash IS NULL
    OR (
      length(ghl_household_record_ref_hash) = 64
      AND ghl_household_record_ref_hash = lower(ghl_household_record_ref_hash)
    )
  ),
  CHECK (
    stripe_customer_ref_hash IS NULL
    OR (
      length(stripe_customer_ref_hash) = 64
      AND stripe_customer_ref_hash = lower(stripe_customer_ref_hash)
    )
  ),
  CHECK (
    last_readback_digest IS NULL
    OR (
      length(last_readback_digest) = 64
      AND last_readback_digest = lower(last_readback_digest)
    )
  )
);

CREATE UNIQUE INDEX household_provider_mapping_ghl_ref_idx
  ON onetime.household_provider_mapping(
    runtime_tier,
    verification_environment_id,
    ghl_household_record_ref_hash
  )
  WHERE ghl_household_record_ref_hash IS NOT NULL;

CREATE UNIQUE INDEX household_provider_mapping_stripe_ref_idx
  ON onetime.household_provider_mapping(
    runtime_tier,
    verification_environment_id,
    stripe_customer_ref_hash
  )
  WHERE stripe_customer_ref_hash IS NOT NULL;

CREATE INDEX household_provider_mapping_owner_idx
  ON onetime.household_provider_mapping(
    runtime_tier,
    verification_environment_id,
    owner_adult_id,
    billing_program
  );

CREATE TABLE onetime.provider_readback_ledger (
  operation_id text NOT NULL CHECK (operation_id <> ''),
  operation_version bigint NOT NULL CHECK (operation_version > 0),
  provider text NOT NULL CHECK (provider <> ''),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  provider_account_ref_hash text NOT NULL,
  disposition text NOT NULL
    CHECK (
      disposition IN (
        'effect_exists',
        'effect_absent_retry_safe',
        'permanently_rejected',
        'still_unknown'
      )
    ),
  provider_resource_ref_hash text,
  reconciliation_digest text NOT NULL,
  observed_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  PRIMARY KEY (operation_id, operation_version, reconciliation_digest),
  FOREIGN KEY (operation_id) REFERENCES onetime.job_outbox(job_id),
  CHECK (
    length(provider_account_ref_hash) = 64
    AND provider_account_ref_hash = lower(provider_account_ref_hash)
  ),
  CHECK (
    provider_resource_ref_hash IS NULL
    OR (
      length(provider_resource_ref_hash) = 64
      AND provider_resource_ref_hash = lower(provider_resource_ref_hash)
    )
  ),
  CHECK (
    length(reconciliation_digest) = 64
    AND reconciliation_digest = lower(reconciliation_digest)
  ),
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

CREATE INDEX provider_readback_ledger_scope_idx
  ON onetime.provider_readback_ledger(
    product_key,
    runtime_tier,
    verification_environment_id,
    provider,
    observed_at DESC
  );

CREATE INDEX job_outbox_provider_reconciliation_idx
  ON onetime.job_outbox(
    product,
    runtime_tier,
    verification_environment_id,
    provider,
    state,
    updated_at
  )
  WHERE state IN ('acceptance_unknown', 'accepted', 'complete', 'rejected', 'dead_letter');

-- @postgres-only-begin
CREATE OR REPLACE FUNCTION onetime.fill_adult_ghl_identity_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT product_key, runtime_tier, verification_environment_id
    INTO NEW.product_key, NEW.runtime_tier, NEW.verification_environment_id
    FROM onetime.v21_adult_identities
   WHERE adult_id = NEW.adult_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER adult_ghl_identity_scope_guard
BEFORE INSERT ON onetime.adult_ghl_identity_link
FOR EACH ROW EXECUTE FUNCTION onetime.fill_adult_ghl_identity_scope();

CREATE OR REPLACE FUNCTION onetime.reject_provider_readback_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'provider readback ledger is append-only';
END;
$$;

CREATE TRIGGER provider_readback_append_only
BEFORE UPDATE OR DELETE ON onetime.provider_readback_ledger
FOR EACH ROW EXECUTE FUNCTION onetime.reject_provider_readback_mutation();
-- @postgres-only-end
