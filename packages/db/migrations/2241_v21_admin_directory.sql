ALTER TABLE onetime.v21_student_profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS normalized_username text,
  ADD COLUMN IF NOT EXISTS credential_hash text,
  ADD COLUMN IF NOT EXISTS credential_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS credential_state text NOT NULL DEFAULT 'active';

UPDATE onetime.v21_student_profiles
   SET username = COALESCE(username, 'student_' || md5(student_id)),
       normalized_username = COALESCE(normalized_username, 'student_' || md5(student_id));

ALTER TABLE onetime.v21_households
  ADD CONSTRAINT v21_household_owner_scope_unique
  UNIQUE (
    household_id,
    owner_adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  );

CREATE UNIQUE INDEX v21_student_profiles_normalized_username_idx
  ON onetime.v21_student_profiles(product_key, runtime_tier, verification_environment_id, normalized_username)
  WHERE normalized_username IS NOT NULL;

CREATE TABLE onetime.admin_school_seat_allowances (
  household_id text NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  seat_limit integer NOT NULL CHECK (seat_limit > 0),
  contract_reference text NOT NULL,
  reason text NOT NULL,
  authorized_at timestamptz NOT NULL,
  PRIMARY KEY (household_id, product_key, runtime_tier, verification_environment_id),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(household_id, product_key, runtime_tier, verification_environment_id),
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

CREATE TABLE onetime.admin_service_account_acceptances (
  acceptance_id text NOT NULL,
  household_id text NOT NULL,
  student_id text NOT NULL,
  accepted_by_adult_id text NOT NULL,
  accepted_service_account_version text NOT NULL,
  canonical_request_hash text NOT NULL,
  immutable_evidence_reference text NOT NULL,
  accepted_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, acceptance_id),
  UNIQUE (
    product_key,
    runtime_tier,
    verification_environment_id,
    acceptance_id,
    household_id,
    student_id
  ),
  UNIQUE (
    product_key,
    runtime_tier,
    verification_environment_id,
    household_id,
    student_id,
    accepted_service_account_version
  ),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (student_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_student_profiles(
      student_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (accepted_by_adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (
    household_id,
    accepted_by_adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_households(
    household_id,
    owner_adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ),
  CHECK (
    length(canonical_request_hash) = 64
    AND canonical_request_hash = lower(canonical_request_hash)
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

CREATE TABLE onetime.admin_canonical_student_enrollments (
  enrollment_id text NOT NULL,
  household_id text NOT NULL,
  student_id text NOT NULL,
  service_account_acceptance_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'revoked')),
  version bigint NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, enrollment_id),
  UNIQUE (product_key, runtime_tier, verification_environment_id, student_id),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (student_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_student_profiles(
      student_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (
    product_key,
    runtime_tier,
    verification_environment_id,
    service_account_acceptance_id,
    household_id,
    student_id
  ) REFERENCES onetime.admin_service_account_acceptances(
    product_key,
    runtime_tier,
    verification_environment_id,
    acceptance_id,
    household_id,
    student_id
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

CREATE TABLE onetime.admin_access_revocation_readbacks (
  readback_id text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('adult', 'student', 'household')),
  subject_id text NOT NULL,
  complete boolean NOT NULL CHECK (complete = true),
  active_session_ids_revoked text[] NOT NULL,
  classroom_grant_ids_revoked text[] NOT NULL,
  playback_grant_ids_revoked text[] NOT NULL,
  enrollment_ids_revoked text[] NOT NULL,
  revoked_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, readback_id),
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

CREATE TABLE onetime.admin_student_credential_resets (
  reset_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial_activation', 'reset')),
  student_id text NOT NULL,
  credential_id text NOT NULL,
  replacement_credential_hash text NOT NULL,
  credential_version bigint NOT NULL CHECK (credential_version > 0),
  revocation_readback_id text,
  disclose_existing_password boolean NOT NULL DEFAULT false CHECK (disclose_existing_password = false),
  created_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, reset_id),
  CHECK (
    replacement_credential_hash LIKE 'argon2id-v1$v=19$m=19456,t=2,p=1$%$%'
    AND length(replacement_credential_hash) = 99
  ),
  CHECK (
    (kind = 'initial_activation' AND revocation_readback_id IS NULL)
    OR (kind = 'reset' AND revocation_readback_id IS NOT NULL)
  ),
  UNIQUE (product_key, runtime_tier, verification_environment_id, student_id, credential_version),
  FOREIGN KEY (student_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_student_profiles(
      student_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (
    product_key,
    runtime_tier,
    verification_environment_id,
    revocation_readback_id
  ) REFERENCES onetime.admin_access_revocation_readbacks(
    product_key,
    runtime_tier,
    verification_environment_id,
    readback_id
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

ALTER TABLE onetime.v21_household_ownership_transfers
  ADD CONSTRAINT v21_household_ownership_transfer_scope_unique
  UNIQUE (transfer_id, household_id, product_key, runtime_tier, verification_environment_id);

CREATE TABLE onetime.admin_ownership_transfer_effect_inventories (
  inventory_id text NOT NULL,
  transfer_id text NOT NULL,
  household_id text NOT NULL,
  outgoing_human_account_id text NOT NULL,
  replacement_human_account_id text NOT NULL,
  outgoing_sessions jsonb NOT NULL,
  replacement_sessions jsonb NOT NULL,
  billing_session_ids text[] NOT NULL,
  grant_ids text[] NOT NULL,
  setup_or_reset_token_ids text[] NOT NULL,
  effect_authority_ids text[] NOT NULL,
  complete boolean NOT NULL CHECK (complete = true),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, inventory_id),
  UNIQUE (product_key, runtime_tier, verification_environment_id, transfer_id),
  UNIQUE (
    product_key,
    runtime_tier,
    verification_environment_id,
    inventory_id,
    transfer_id,
    household_id,
    outgoing_human_account_id,
    replacement_human_account_id
  ),
  FOREIGN KEY (transfer_id, household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_household_ownership_transfers(
      transfer_id, household_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
    ),
  FOREIGN KEY (
    outgoing_human_account_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.v21_human_accounts(
    human_account_id, product_key, runtime_tier, verification_environment_id
  ),
  FOREIGN KEY (
    replacement_human_account_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.v21_human_accounts(
    human_account_id, product_key, runtime_tier, verification_environment_id
  ),
  CHECK (outgoing_human_account_id <> replacement_human_account_id),
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

CREATE TABLE onetime.admin_ownership_transfer_effect_readbacks (
  readback_id text NOT NULL,
  inventory_id text NOT NULL,
  transfer_id text NOT NULL,
  household_id text NOT NULL,
  outgoing_human_account_id text NOT NULL,
  replacement_human_account_id text NOT NULL,
  outgoing_session_ids_revoked text[] NOT NULL,
  replacement_session_ids_revoked text[] NOT NULL,
  billing_session_ids_revoked text[] NOT NULL,
  grant_ids_revoked text[] NOT NULL,
  setup_or_reset_token_ids_invalidated text[] NOT NULL,
  effect_authority_ids_revoked text[] NOT NULL,
  complete boolean NOT NULL CHECK (complete = true),
  revoked_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, readback_id),
  UNIQUE (product_key, runtime_tier, verification_environment_id, inventory_id),
  FOREIGN KEY (
    product_key,
    runtime_tier,
    verification_environment_id,
    inventory_id,
    transfer_id,
    household_id,
    outgoing_human_account_id,
    replacement_human_account_id
  ) REFERENCES onetime.admin_ownership_transfer_effect_inventories(
    product_key,
    runtime_tier,
    verification_environment_id,
    inventory_id,
    transfer_id,
    household_id,
    outgoing_human_account_id,
    replacement_human_account_id
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

CREATE TABLE onetime.admin_directory_receipts (
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'adult_upsert', 'adult_transition', 'household_upsert', 'household_transition',
    'student_upsert', 'student_transition', 'student_credential_reset', 'ownership_transfer',
    'school_allowance_upsert'
  )),
  result_ref text NOT NULL,
  result_version bigint NOT NULL CHECK (result_version > 0),
  committed_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
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

CREATE TABLE onetime.admin_directory_audit_events (
  event_id text NOT NULL,
  actor_human_account_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'adult_upsert', 'adult_transition', 'household_upsert', 'household_transition',
    'student_upsert', 'student_transition', 'student_credential_reset', 'ownership_transfer',
    'school_allowance_upsert'
  )),
  target_ref text NOT NULL,
  household_id text,
  request_hash text NOT NULL,
  occurred_at timestamptz NOT NULL,
  contains_sensitive_data boolean NOT NULL DEFAULT false CHECK (contains_sensitive_data = false),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (product_key, runtime_tier, verification_environment_id, event_id),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  FOREIGN KEY (
    actor_human_account_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.v21_human_accounts(
    human_account_id, product_key, runtime_tier, verification_environment_id
  ),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
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

-- @postgres-only-begin
ALTER TABLE onetime.admin_ownership_transfer_effect_inventories
  ADD CONSTRAINT admin_transfer_session_inventories_array_check
  CHECK (
    jsonb_typeof(outgoing_sessions) = 'array'
    AND jsonb_typeof(replacement_sessions) = 'array'
  );

ALTER TABLE onetime.admin_service_account_acceptances
  ADD CONSTRAINT admin_service_acceptance_hash_hex_check
  CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.admin_student_credential_resets
  ADD CONSTRAINT admin_credential_reset_current_hash_check
  CHECK (
    replacement_credential_hash
      ~ '^argon2id-v1\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$'
    AND replacement_credential_hash !~* '(password|secret|bearer)'
  );

ALTER TABLE onetime.admin_directory_receipts
  ADD CONSTRAINT admin_directory_receipt_hash_hex_check
  CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.admin_directory_audit_events
  ADD CONSTRAINT admin_directory_audit_hash_hex_check
  CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.v21_households
  ADD CONSTRAINT v21_family_household_three_seats_check
  CHECK (classification <> 'family' OR seat_limit = 3);

ALTER TABLE onetime.v21_student_profiles
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN normalized_username SET NOT NULL,
  ADD CONSTRAINT v21_student_credential_state_check
    CHECK (credential_state IN ('active', 'reset_required', 'disabled')),
  ADD CONSTRAINT v21_student_credential_hash_check
  CHECK (
    credential_hash IS NULL
    OR (
      credential_hash
        ~ '^argon2id-v1\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$'
      AND credential_hash !~* '(password|secret|bearer)'
    )
  ),
  ADD CONSTRAINT v21_student_normalized_username_check
  CHECK (
    normalized_username = lower(btrim(normalized_username))
    AND normalized_username ~ '^[a-z0-9._-]{3,64}$'
    AND normalized_username NOT LIKE '%@%'
  );

CREATE OR REPLACE FUNCTION onetime.enforce_admin_service_account_acceptance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.v21_households AS household
      JOIN onetime.v21_adult_identities AS adult
        ON adult.adult_id = household.owner_adult_id
       AND adult.product_key = household.product_key
       AND adult.runtime_tier = household.runtime_tier
       AND adult.verification_environment_id = household.verification_environment_id
      JOIN onetime.v21_human_accounts AS account
        ON account.human_account_id = household.owner_human_account_id
       AND account.adult_id = adult.adult_id
       AND account.product_key = household.product_key
       AND account.runtime_tier = household.runtime_tier
       AND account.verification_environment_id = household.verification_environment_id
      JOIN onetime.v21_human_account_role_memberships AS membership
        ON membership.human_account_id = account.human_account_id
       AND membership.product_key = household.product_key
       AND membership.runtime_tier = household.runtime_tier
       AND membership.verification_environment_id = household.verification_environment_id
       AND membership.role = 'parent'
       AND membership.revoked_at IS NULL
      JOIN onetime.v21_student_profiles AS student
        ON student.student_id = NEW.student_id
       AND student.household_id = household.household_id
       AND student.product_key = household.product_key
       AND student.runtime_tier = household.runtime_tier
       AND student.verification_environment_id = household.verification_environment_id
     WHERE household.household_id = NEW.household_id
       AND household.owner_adult_id = NEW.accepted_by_adult_id
       AND household.product_key = NEW.product_key
       AND household.runtime_tier = NEW.runtime_tier
       AND household.verification_environment_id = NEW.verification_environment_id
       AND household.state = 'active'
       AND adult.state = 'active'
       AND account.state = 'active'
       AND student.state = 'active'
  ) THEN
    RAISE EXCEPTION 'service account acceptance requires the active scoped Parent owner';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_service_account_acceptance_owner_guard
BEFORE INSERT OR UPDATE ON onetime.admin_service_account_acceptances
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_admin_service_account_acceptance();

CREATE OR REPLACE FUNCTION onetime.enforce_admin_school_allowance_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.v21_households
     WHERE household_id = NEW.household_id
       AND product_key = NEW.product_key
       AND runtime_tier = NEW.runtime_tier
       AND verification_environment_id = NEW.verification_environment_id
       AND classification = 'school'
  ) THEN
    RAISE EXCEPTION 'school seat allowance requires the exact scoped School household';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_school_allowance_scope_guard
BEFORE INSERT ON onetime.admin_school_seat_allowances
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_admin_school_allowance_scope();

CREATE OR REPLACE FUNCTION onetime.reject_admin_directory_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin directory evidence is append-only';
END;
$$;
CREATE TRIGGER admin_directory_audit_append_only
BEFORE UPDATE OR DELETE ON onetime.admin_directory_audit_events
FOR EACH ROW EXECUTE FUNCTION onetime.reject_admin_directory_evidence_mutation();
CREATE TRIGGER admin_school_allowance_append_only
BEFORE UPDATE OR DELETE ON onetime.admin_school_seat_allowances
FOR EACH ROW EXECUTE FUNCTION onetime.reject_admin_directory_evidence_mutation();
-- @postgres-only-end
