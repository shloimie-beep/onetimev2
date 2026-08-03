CREATE TABLE onetime.ghl_identity_sync_operation (
  operation_id text PRIMARY KEY,
  local_commit_id text NOT NULL,
  adult_id text NOT NULL,
  household_id text NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'active_legacy', 'former_canceled', 'opted_in_lead', 'suppressed', 'review'
  )),
  link_state text NOT NULL CHECK (link_state IN ('unlinked', 'linked', 'identity_review')),
  review_id text,
  intent_count integer NOT NULL CHECK (intent_count >= 0),
  safe_error_code text,
  retry_count bigint NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    operation_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ),
  FOREIGN KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
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
  CHECK (link_state <> 'identity_review' OR review_id IS NOT NULL)
);

CREATE TABLE onetime.ghl_household_identity_projection (
  household_id text PRIMARY KEY,
  adult_id text NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('family', 'school', 'complimentary')),
  lifecycle_state text NOT NULL,
  access_projection text NOT NULL CHECK (
    access_projection IN ('free', 'active', 'grace', 'inactive', 'none')
  ),
  stripe_customer_ref_hash text,
  service_reminders_enabled boolean NOT NULL DEFAULT false,
  source_evidence_digest text NOT NULL,
  policy_consent_evidence_digest text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    household_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ),
  FOREIGN KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
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
    stripe_customer_ref_hash IS NULL
    OR (
      length(stripe_customer_ref_hash) = 64
      AND stripe_customer_ref_hash = lower(stripe_customer_ref_hash)
    )
  ),
  CHECK (length(source_evidence_digest) = 64 AND source_evidence_digest = lower(source_evidence_digest)),
  CHECK (
    length(policy_consent_evidence_digest) = 64
    AND policy_consent_evidence_digest = lower(policy_consent_evidence_digest)
  )
);

CREATE TABLE onetime.ghl_identity_review_case (
  review_id text PRIMARY KEY,
  adult_id text NOT NULL,
  household_id text NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  candidate_contact_ref_hashes text[] NOT NULL,
  quarantined_intent_ids text[] NOT NULL,
  safe_reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    review_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ),
  FOREIGN KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
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
  CHECK (safe_reason IN (
    'provider_email_disagreement', 'multiple_exact_email_matches', 'classification_review'
  ))
);

CREATE INDEX ghl_identity_sync_retry_idx
  ON onetime.ghl_identity_sync_operation(
    product_key,
    runtime_tier,
    verification_environment_id,
    safe_error_code,
    retry_count,
    updated_at
  )
  WHERE safe_error_code IS NOT NULL;

-- @postgres-only-begin
ALTER TABLE onetime.ghl_identity_sync_operation
  ADD CONSTRAINT ghl_identity_sync_operation_review_scope_fk
  FOREIGN KEY (
    review_id,
    product_key,
    runtime_tier,
    verification_environment_id
  )
  REFERENCES onetime.ghl_identity_review_case(
    review_id,
    product_key,
    runtime_tier,
    verification_environment_id
  )
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION onetime.lower_hex_sha256_array(values_to_check text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    bool_and(
      candidate.value_to_check IS NOT NULL
      AND candidate.value_to_check ~ '^[0-9a-f]{64}$'
    ),
    true
  )
  FROM unnest(values_to_check) AS candidate(value_to_check)
$$;

ALTER TABLE onetime.ghl_identity_review_case
  ADD CONSTRAINT ghl_review_candidate_hashes_hex_check
    CHECK (onetime.lower_hex_sha256_array(candidate_contact_ref_hashes));

ALTER TABLE onetime.ghl_household_identity_projection
  ADD CONSTRAINT ghl_household_stripe_hash_hex_check
    CHECK (stripe_customer_ref_hash IS NULL OR stripe_customer_ref_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ghl_household_source_digest_hex_check
    CHECK (source_evidence_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ghl_household_policy_digest_hex_check
    CHECK (policy_consent_evidence_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.fill_ghl_identity_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  household_product text;
  household_tier text;
  household_environment text;
  adult_binding_count integer;
BEGIN
  SELECT product_key, runtime_tier, verification_environment_id
    INTO household_product, household_tier, household_environment
  FROM onetime.v21_households
  WHERE household_id = NEW.household_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GHL identity household binding is absent';
  END IF;

  SELECT count(*)
    INTO adult_binding_count
  FROM onetime.v21_adult_identities
  WHERE adult_id = NEW.adult_id
    AND product_key = household_product
    AND runtime_tier = household_tier
    AND verification_environment_id = household_environment;

  IF adult_binding_count <> 1 THEN
    RAISE EXCEPTION 'GHL identity adult and household scopes do not match';
  END IF;

  IF (NEW.product_key IS NOT NULL AND NEW.product_key <> household_product)
    OR (NEW.runtime_tier IS NOT NULL AND NEW.runtime_tier <> household_tier)
    OR (
      NEW.verification_environment_id IS NOT NULL
      AND NEW.verification_environment_id <> household_environment
    )
  THEN
    RAISE EXCEPTION 'GHL identity supplied scope does not match its household binding';
  END IF;

  NEW.product_key := household_product;
  NEW.runtime_tier := household_tier;
  NEW.verification_environment_id := household_environment;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ghl_identity_sync_scope_guard
BEFORE INSERT ON onetime.ghl_identity_sync_operation
FOR EACH ROW EXECUTE FUNCTION onetime.fill_ghl_identity_scope();

CREATE TRIGGER ghl_household_projection_scope_guard
BEFORE INSERT ON onetime.ghl_household_identity_projection
FOR EACH ROW EXECUTE FUNCTION onetime.fill_ghl_identity_scope();

CREATE TRIGGER ghl_identity_review_scope_guard
BEFORE INSERT ON onetime.ghl_identity_review_case
FOR EACH ROW EXECUTE FUNCTION onetime.fill_ghl_identity_scope();

CREATE OR REPLACE FUNCTION onetime.reject_ghl_identity_binding_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.adult_id IS DISTINCT FROM OLD.adult_id
    OR NEW.household_id IS DISTINCT FROM OLD.household_id
    OR NEW.product_key IS DISTINCT FROM OLD.product_key
    OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
    OR NEW.verification_environment_id IS DISTINCT FROM OLD.verification_environment_id
  THEN
    RAISE EXCEPTION 'GHL identity household binding is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ghl_identity_sync_binding_immutable
BEFORE UPDATE ON onetime.ghl_identity_sync_operation
FOR EACH ROW EXECUTE FUNCTION onetime.reject_ghl_identity_binding_mutation();

CREATE TRIGGER ghl_household_projection_binding_immutable
BEFORE UPDATE ON onetime.ghl_household_identity_projection
FOR EACH ROW EXECUTE FUNCTION onetime.reject_ghl_identity_binding_mutation();

CREATE TRIGGER ghl_identity_review_binding_immutable
BEFORE UPDATE ON onetime.ghl_identity_review_case
FOR EACH ROW EXECUTE FUNCTION onetime.reject_ghl_identity_binding_mutation();
-- @postgres-only-end
