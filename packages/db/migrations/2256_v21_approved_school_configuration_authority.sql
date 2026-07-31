CREATE TABLE onetime.approved_school_configuration_quarantine_v21 (
  quarantine_id text NOT NULL CHECK (quarantine_id <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  approved_school_id text,
  household_id text NOT NULL CHECK (household_id <> ''),
  evidence_source text NOT NULL CHECK (evidence_source IN (
    'admin_school_seat_allowances', 'approved_school_configurations_v21'
  )),
  quarantine_reason text NOT NULL CHECK (btrim(quarantine_reason) <> ''),
  predecessor_evidence jsonb NOT NULL CHECK (jsonb_typeof(predecessor_evidence) = 'object'),
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (
    product_key, runtime_tier, verification_environment_id, quarantine_id
  )
);

CREATE TABLE onetime.approved_school_configuration_quarantine_resolutions_v21 (
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  quarantine_id text NOT NULL,
  resolved_by_human_account_id text NOT NULL CHECK (resolved_by_human_account_id <> ''),
  resolution_reason text NOT NULL CHECK (btrim(resolution_reason) <> ''),
  resolution_audit_ref text NOT NULL CHECK (btrim(resolution_audit_ref) <> ''),
  canonical_request_hash text NOT NULL,
  resolved_at timestamptz NOT NULL,
  PRIMARY KEY (
    product_key, runtime_tier, verification_environment_id, quarantine_id
  ),
  FOREIGN KEY (
    product_key, runtime_tier, verification_environment_id, quarantine_id
  ) REFERENCES onetime.approved_school_configuration_quarantine_v21(
    product_key, runtime_tier, verification_environment_id, quarantine_id
  ) ON DELETE RESTRICT,
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash))
);

CREATE TABLE onetime.approved_school_configuration_authority_v21 (
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  approved_school_id text NOT NULL CHECK (approved_school_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  adult_account_manager_id text NOT NULL CHECK (adult_account_manager_id <> ''),
  seat_allowance integer NOT NULL CHECK (seat_allowance > 0),
  price_minor_units bigint NOT NULL CHECK (price_minor_units >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  billing_starts_at timestamptz NOT NULL,
  terms_reference text NOT NULL CHECK (btrim(terms_reference) <> ''),
  immutable_contract_reference text NOT NULL CHECK (btrim(immutable_contract_reference) <> ''),
  authorization_reason text NOT NULL CHECK (btrim(authorization_reason) <> ''),
  authorized_by_human_account_id text NOT NULL CHECK (authorized_by_human_account_id <> ''),
  authorized_at timestamptz NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  canonical_request_hash text NOT NULL,
  expected_prior_version bigint NOT NULL CHECK (expected_prior_version >= 0),
  configuration_version bigint NOT NULL CHECK (configuration_version > 0),
  audit_ref text NOT NULL CHECK (btrim(audit_ref) <> ''),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (
    product_key, runtime_tier, verification_environment_id, approved_school_id
  ),
  UNIQUE (
    product_key, runtime_tier, verification_environment_id, household_id
  ),
  UNIQUE (
    product_key, runtime_tier, verification_environment_id, idempotency_key
  ),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (
    adult_account_manager_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.v21_adult_identities(
    adult_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (
    authorized_by_human_account_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.v21_human_accounts(
    human_account_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
  CHECK (updated_at >= created_at),
  CHECK (
    (configuration_version = 1 AND expected_prior_version = 0)
    OR configuration_version = expected_prior_version + 1
  ),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  )
);

CREATE TABLE onetime.approved_school_configuration_history_v21 (
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  approved_school_id text NOT NULL,
  household_id text NOT NULL,
  adult_account_manager_id text NOT NULL,
  seat_allowance integer NOT NULL,
  price_minor_units bigint NOT NULL,
  currency text NOT NULL,
  billing_starts_at timestamptz NOT NULL,
  terms_reference text NOT NULL,
  immutable_contract_reference text NOT NULL,
  authorization_reason text NOT NULL,
  authorized_by_human_account_id text NOT NULL,
  authorized_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  canonical_request_hash text NOT NULL,
  expected_prior_version bigint NOT NULL,
  configuration_version bigint NOT NULL,
  audit_ref text NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (
    product_key, runtime_tier, verification_environment_id,
    approved_school_id, configuration_version
  ),
  UNIQUE (
    product_key, runtime_tier, verification_environment_id, idempotency_key
  )
);

INSERT INTO onetime.approved_school_configuration_quarantine_v21 (
  quarantine_id, product_key, runtime_tier, verification_environment_id,
  approved_school_id, household_id, evidence_source, quarantine_reason,
  predecessor_evidence, observed_at
)
SELECT
  'approved:' || approved_school_id,
  product,
  runtime_tier,
  verification_environment_id,
  approved_school_id,
  household_id,
  'approved_school_configurations_v21',
  'predecessor lacks immutable contract, authorization, idempotency, request-hash, and audit lineage',
  jsonb_build_object(
    'adult_account_manager_id', adult_account_manager_id,
    'seat_allowance', seat_allowance,
    'price_minor_units', price_minor_units,
    'currency', currency,
    'billing_starts_at', billing_starts_at,
    'terms_reference', terms_reference,
    'configuration_version', configuration_version
  ),
  now()
FROM onetime.approved_school_configurations_v21;

INSERT INTO onetime.approved_school_configuration_quarantine_v21 (
  quarantine_id, product_key, runtime_tier, verification_environment_id,
  approved_school_id, household_id, evidence_source, quarantine_reason,
  predecessor_evidence, observed_at
)
SELECT
  'allowance:' || household_id,
  product_key,
  runtime_tier,
  verification_environment_id,
  NULL,
  household_id,
  'admin_school_seat_allowances',
  'predecessor lacks approved-School identity, manager, price, billing, terms, request-hash, and version lineage',
  jsonb_build_object(
    'seat_limit', seat_limit,
    'contract_reference', contract_reference,
    'reason', reason,
    'authorized_at', authorized_at
  ),
  now()
FROM onetime.admin_school_seat_allowances;

CREATE INDEX approved_school_configuration_manager_idx
  ON onetime.approved_school_configuration_authority_v21(
    product_key, runtime_tier, verification_environment_id,
    adult_account_manager_id, household_id
  );

CREATE INDEX approved_school_configuration_quarantine_scope_idx
  ON onetime.approved_school_configuration_quarantine_v21(
    product_key, runtime_tier, verification_environment_id, household_id
  );

-- @postgres-only-begin
ALTER TABLE onetime.approved_school_configuration_authority_v21
  ADD CONSTRAINT approved_school_authority_request_hash_hex_check
    CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.approved_school_configuration_quarantine_resolutions_v21
  ADD CONSTRAINT approved_school_resolution_request_hash_hex_check
    CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_legacy_school_configuration_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'legacy approved-School configuration is compatibility evidence only';
END;
$$;

CREATE TRIGGER admin_school_allowance_compatibility_only
BEFORE INSERT OR UPDATE OR DELETE ON onetime.admin_school_seat_allowances
FOR EACH ROW EXECUTE FUNCTION onetime.reject_legacy_school_configuration_write();

CREATE TRIGGER approved_school_configuration_compatibility_only
BEFORE INSERT OR UPDATE OR DELETE ON onetime.approved_school_configurations_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_legacy_school_configuration_write();

CREATE OR REPLACE FUNCTION onetime.reject_approved_school_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'approved-School configuration evidence is append-only';
END;
$$;

CREATE TRIGGER approved_school_configuration_history_append_only
BEFORE UPDATE OR DELETE ON onetime.approved_school_configuration_history_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_approved_school_evidence_mutation();

CREATE TRIGGER approved_school_configuration_quarantine_append_only
BEFORE UPDATE OR DELETE ON onetime.approved_school_configuration_quarantine_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_approved_school_evidence_mutation();

CREATE TRIGGER approved_school_configuration_resolution_append_only
BEFORE UPDATE OR DELETE ON onetime.approved_school_configuration_quarantine_resolutions_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_approved_school_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.validate_approved_school_quarantine_resolution()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1
    FROM onetime.v21_human_accounts AS account
    JOIN onetime.v21_human_account_role_memberships AS membership
      ON membership.human_account_id = account.human_account_id
     AND membership.product_key = account.product_key
     AND membership.runtime_tier = account.runtime_tier
     AND membership.verification_environment_id = account.verification_environment_id
     AND membership.role = 'admin'
     AND membership.revoked_at IS NULL
   WHERE account.human_account_id = NEW.resolved_by_human_account_id
     AND account.product_key = NEW.product_key
     AND account.runtime_tier = NEW.runtime_tier
     AND account.verification_environment_id = NEW.verification_environment_id
     AND account.state = 'active'
   FOR KEY SHARE OF account, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved-School quarantine resolution requires an active scoped Admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approved_school_quarantine_resolution_admin_guard
BEFORE INSERT ON onetime.approved_school_configuration_quarantine_resolutions_v21
FOR EACH ROW EXECUTE FUNCTION onetime.validate_approved_school_quarantine_resolution();

CREATE OR REPLACE FUNCTION onetime.enforce_approved_school_authority()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1
    FROM onetime.v21_households AS household
   WHERE household.household_id = NEW.household_id
     AND household.product_key = NEW.product_key
     AND household.runtime_tier = NEW.runtime_tier
     AND household.verification_environment_id = NEW.verification_environment_id
     AND household.classification = 'school'
     AND household.state = 'active'
   FOR UPDATE OF household;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved-School authority requires an active exact-scope School household';
  END IF;

  PERFORM 1
    FROM onetime.v21_households AS household
    JOIN onetime.v21_adult_identities AS adult
      ON adult.adult_id = household.owner_adult_id
     AND adult.product_key = household.product_key
     AND adult.runtime_tier = household.runtime_tier
     AND adult.verification_environment_id = household.verification_environment_id
    JOIN onetime.v21_human_accounts AS account
      ON account.adult_id = adult.adult_id
     AND account.human_account_id = household.owner_human_account_id
     AND account.product_key = household.product_key
     AND account.runtime_tier = household.runtime_tier
     AND account.verification_environment_id = household.verification_environment_id
    JOIN onetime.v21_human_account_role_memberships AS membership
      ON membership.human_account_id = account.human_account_id
     AND membership.product_key = account.product_key
     AND membership.runtime_tier = account.runtime_tier
     AND membership.verification_environment_id = account.verification_environment_id
     AND membership.role = 'parent'
     AND membership.revoked_at IS NULL
   WHERE household.household_id = NEW.household_id
     AND household.product_key = NEW.product_key
     AND household.runtime_tier = NEW.runtime_tier
     AND household.verification_environment_id = NEW.verification_environment_id
     AND adult.adult_id = NEW.adult_account_manager_id
     AND adult.state = 'active'
     AND account.state = 'active'
   FOR KEY SHARE OF adult, account, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved-School manager must be the active scoped Parent account manager';
  END IF;

  PERFORM 1
    FROM onetime.v21_human_accounts AS account
    JOIN onetime.v21_human_account_role_memberships AS membership
      ON membership.human_account_id = account.human_account_id
     AND membership.product_key = account.product_key
     AND membership.runtime_tier = account.runtime_tier
     AND membership.verification_environment_id = account.verification_environment_id
     AND membership.role = 'admin'
     AND membership.revoked_at IS NULL
   WHERE account.human_account_id = NEW.authorized_by_human_account_id
     AND account.product_key = NEW.product_key
     AND account.runtime_tier = NEW.runtime_tier
     AND account.verification_environment_id = NEW.verification_environment_id
     AND account.state = 'active'
   FOR KEY SHARE OF account, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved-School authority requires an active scoped Admin authorizer';
  END IF;

  PERFORM 1 FROM onetime.admin_school_seat_allowances
   WHERE household_id = NEW.household_id
     AND product_key = NEW.product_key
     AND runtime_tier = NEW.runtime_tier
     AND verification_environment_id = NEW.verification_environment_id
   FOR KEY SHARE;
  PERFORM 1 FROM onetime.approved_school_configurations_v21
   WHERE approved_school_id = NEW.approved_school_id
     AND product = NEW.product_key
     AND runtime_tier = NEW.runtime_tier
     AND verification_environment_id = NEW.verification_environment_id
   FOR KEY SHARE;

  IF EXISTS (
    SELECT 1
      FROM onetime.approved_school_configuration_quarantine_v21 AS quarantine
      LEFT JOIN onetime.approved_school_configuration_quarantine_resolutions_v21 AS resolution
        ON resolution.product_key = quarantine.product_key
       AND resolution.runtime_tier = quarantine.runtime_tier
       AND resolution.verification_environment_id = quarantine.verification_environment_id
       AND resolution.quarantine_id = quarantine.quarantine_id
     WHERE quarantine.product_key = NEW.product_key
       AND quarantine.runtime_tier = NEW.runtime_tier
       AND quarantine.verification_environment_id = NEW.verification_environment_id
       AND quarantine.household_id = NEW.household_id
       AND resolution.quarantine_id IS NULL
  ) THEN
    RAISE EXCEPTION 'approved-School predecessor evidence is quarantined and unresolved';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.expected_prior_version <> 0 OR NEW.configuration_version <> 1 THEN
      RAISE EXCEPTION 'approved-School create requires expected version zero and version one';
    END IF;
    NEW.created_at := NEW.authorized_at;
  ELSE
    IF NEW.product_key IS DISTINCT FROM OLD.product_key
       OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
       OR NEW.verification_environment_id IS DISTINCT FROM OLD.verification_environment_id
       OR NEW.approved_school_id IS DISTINCT FROM OLD.approved_school_id
       OR NEW.household_id IS DISTINCT FROM OLD.household_id
       OR NEW.immutable_contract_reference IS DISTINCT FROM OLD.immutable_contract_reference
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'approved-School scope and immutable contract identity cannot change';
    END IF;
    IF NEW.expected_prior_version <> OLD.configuration_version
       OR NEW.configuration_version <> OLD.configuration_version + 1 THEN
      RAISE EXCEPTION 'approved-School optimistic version conflict';
    END IF;
    IF NEW.updated_at < OLD.updated_at OR NEW.authorized_at < OLD.authorized_at THEN
      RAISE EXCEPTION 'approved-School evidence time regressed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approved_school_configuration_authority_guard
BEFORE INSERT OR UPDATE ON onetime.approved_school_configuration_authority_v21
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_approved_school_authority();

CREATE TRIGGER approved_school_configuration_authority_no_delete
BEFORE DELETE ON onetime.approved_school_configuration_authority_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_approved_school_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.append_approved_school_configuration_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO onetime.approved_school_configuration_history_v21 (
    product_key, runtime_tier, verification_environment_id,
    approved_school_id, household_id, adult_account_manager_id,
    seat_allowance, price_minor_units, currency, billing_starts_at,
    terms_reference, immutable_contract_reference, authorization_reason,
    authorized_by_human_account_id, authorized_at, idempotency_key,
    canonical_request_hash, expected_prior_version, configuration_version,
    audit_ref, committed_at
  ) VALUES (
    NEW.product_key, NEW.runtime_tier, NEW.verification_environment_id,
    NEW.approved_school_id, NEW.household_id, NEW.adult_account_manager_id,
    NEW.seat_allowance, NEW.price_minor_units, NEW.currency, NEW.billing_starts_at,
    NEW.terms_reference, NEW.immutable_contract_reference, NEW.authorization_reason,
    NEW.authorized_by_human_account_id, NEW.authorized_at, NEW.idempotency_key,
    NEW.canonical_request_hash, NEW.expected_prior_version, NEW.configuration_version,
    NEW.audit_ref, NEW.updated_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER approved_school_configuration_history_append
AFTER INSERT OR UPDATE ON onetime.approved_school_configuration_authority_v21
FOR EACH ROW EXECUTE FUNCTION onetime.append_approved_school_configuration_history();
-- @postgres-only-end
