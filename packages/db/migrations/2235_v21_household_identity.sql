CREATE TABLE onetime.v21_adult_identities (
  adult_id text PRIMARY KEY CHECK (adult_id <> ''),
  normalized_email text NOT NULL CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND normalized_email LIKE '%@%'
  ),
  display_name text NOT NULL CHECK (display_name <> ''),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (adult_id, product_key, runtime_tier, verification_environment_id),
  UNIQUE (product_key, runtime_tier, verification_environment_id, normalized_email),
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
    (state = 'archived' AND archived_at IS NOT NULL)
    OR (state = 'active' AND archived_at IS NULL)
  )
);

CREATE TABLE onetime.v21_human_accounts (
  human_account_id text PRIMARY KEY CHECK (human_account_id <> ''),
  adult_id text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'invited'
    CHECK (state IN ('invited', 'active', 'disabled', 'archived')),
  security_version bigint NOT NULL DEFAULT 1 CHECK (security_version > 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (human_account_id, adult_id),
  UNIQUE (human_account_id, product_key, runtime_tier, verification_environment_id),
  FOREIGN KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
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
    (state = 'archived' AND archived_at IS NOT NULL)
    OR (state <> 'archived' AND archived_at IS NULL)
  )
);

CREATE TABLE onetime.v21_human_account_role_memberships (
  membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  human_account_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'parent')),
  granted_at timestamptz NOT NULL,
  granted_reason text NOT NULL CHECK (granted_reason <> ''),
  granted_by_human_account_id text,
  revoked_at timestamptz,
  revoked_reason text,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  FOREIGN KEY (human_account_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_human_accounts(
      human_account_id,
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
    (revoked_at IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX v21_human_account_active_role_idx
  ON onetime.v21_human_account_role_memberships(human_account_id, role)
  WHERE revoked_at IS NULL;

CREATE TABLE onetime.v21_households (
  household_id text PRIMARY KEY CHECK (household_id <> ''),
  owner_adult_id text NOT NULL,
  owner_human_account_id text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('family', 'school')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  seat_limit integer NOT NULL CHECK (seat_limit > 0),
  active_seat_count integer NOT NULL DEFAULT 0
    CHECK (active_seat_count >= 0 AND active_seat_count <= seat_limit),
  billing_account_ref text,
  access_aggregate_ref text NOT NULL CHECK (access_aggregate_ref <> ''),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (household_id, product_key, runtime_tier, verification_environment_id),
  FOREIGN KEY (owner_human_account_id, owner_adult_id)
    REFERENCES onetime.v21_human_accounts(human_account_id, adult_id),
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
    (state = 'archived' AND archived_at IS NOT NULL)
    OR (state = 'active' AND archived_at IS NULL)
  )
);

CREATE INDEX v21_households_owner_idx
  ON onetime.v21_households(
    product_key,
    runtime_tier,
    verification_environment_id,
    owner_human_account_id,
    state
  );

CREATE TABLE onetime.v21_student_profiles (
  student_id text PRIMARY KEY CHECK (student_id <> ''),
  household_id text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('self', 'dependent')),
  self_adult_id text,
  display_name text NOT NULL CHECK (display_name <> ''),
  credential_history_ref text NOT NULL CHECK (credential_history_ref <> ''),
  relationship_history_ref text NOT NULL CHECK (relationship_history_ref <> ''),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, product_key, runtime_tier, verification_environment_id),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (
    (relationship = 'self' AND self_adult_id IS NOT NULL)
    OR (relationship = 'dependent' AND self_adult_id IS NULL)
  )
);

CREATE INDEX v21_student_profiles_household_idx
  ON onetime.v21_student_profiles(
    product_key,
    runtime_tier,
    verification_environment_id,
    household_id,
    state
  );

CREATE TABLE onetime.v21_adult_sessions (
  session_id text PRIMARY KEY CHECK (session_id <> ''),
  human_account_id text NOT NULL,
  active_role text NOT NULL CHECK (active_role IN ('admin', 'parent')),
  active_household_id text,
  access_token_digest text NOT NULL,
  refresh_token_digest text NOT NULL,
  security_version bigint NOT NULL CHECK (security_version > 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (human_account_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_human_accounts(
      human_account_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  FOREIGN KEY (active_household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (active_household_id IS NULL OR active_role = 'parent'),
  CHECK (idle_expires_at <= absolute_expires_at),
  CHECK (
    (revoked_at IS NULL AND revoke_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)
  )
);

CREATE TABLE onetime.v21_household_ownership_transfers (
  transfer_id text PRIMARY KEY CHECK (transfer_id <> ''),
  household_id text NOT NULL,
  outgoing_adult_id text NOT NULL,
  replacement_adult_id text,
  replacement_normalized_email text NOT NULL,
  acceptance_token_digest text NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'accepted', 'expired', 'canceled', 'failed')),
  requested_by_human_account_id text NOT NULL,
  accepted_by_adult_id text,
  accepted_at timestamptz,
  acceptance_request_hash text,
  canonical_request_hash text NOT NULL,
  service_account_policy_version text NOT NULL,
  recording_participation_policy_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, replacement_adult_id),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (replacement_normalized_email = lower(btrim(replacement_normalized_email))),
  CHECK (expires_at <= created_at + interval '7 days'),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
  CHECK (
    (state = 'accepted'
      AND replacement_adult_id IS NOT NULL
      AND accepted_by_adult_id = replacement_adult_id
      AND accepted_at IS NOT NULL
      AND acceptance_request_hash IS NOT NULL)
    OR
    (state <> 'accepted' AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX v21_household_pending_transfer_idx
  ON onetime.v21_household_ownership_transfers(household_id)
  WHERE state = 'pending';

CREATE TABLE onetime.v21_transfer_dependent_attestations (
  transfer_id text NOT NULL,
  student_id text NOT NULL,
  replacement_adult_id text NOT NULL,
  authority_confirmed boolean NOT NULL CHECK (authority_confirmed = true),
  service_account_policy_version text NOT NULL,
  recording_participation_policy_version text NOT NULL,
  recorded_at timestamptz NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  PRIMARY KEY (transfer_id, student_id),
  FOREIGN KEY (transfer_id, replacement_adult_id)
    REFERENCES onetime.v21_household_ownership_transfers(transfer_id, replacement_adult_id),
  FOREIGN KEY (student_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_student_profiles(
      student_id,
      product_key,
      runtime_tier,
      verification_environment_id
    )
);

CREATE TABLE onetime.v21_account_action_tokens (
  action_token_id text PRIMARY KEY CHECK (action_token_id <> ''),
  human_account_id text NOT NULL,
  action_kind text NOT NULL,
  token_digest text NOT NULL,
  canonical_request_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (human_account_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_human_accounts(
      human_account_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
  CHECK (used_at IS NULL OR revoked_at IS NULL)
);

CREATE UNIQUE INDEX v21_account_action_token_digest_idx
  ON onetime.v21_account_action_tokens(token_digest);

CREATE TABLE onetime.v21_billing_portal_sessions (
  billing_session_id text PRIMARY KEY CHECK (billing_session_id <> ''),
  household_id text NOT NULL,
  billing_reference_digest text NOT NULL,
  state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued', 'used', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    )
);

CREATE UNIQUE INDEX v21_billing_portal_reference_idx
  ON onetime.v21_billing_portal_sessions(billing_reference_digest);

CREATE TABLE onetime.v21_provider_reassociation_intents (
  intent_id text PRIMARY KEY CHECK (intent_id <> ''),
  household_id text NOT NULL,
  previous_adult_id text NOT NULL,
  replacement_adult_id text NOT NULL,
  canonical_request_hash text NOT NULL,
  changes_financial_identity boolean NOT NULL DEFAULT false
    CHECK (changes_financial_identity = false),
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'processing', 'complete', 'failed')),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, canonical_request_hash),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash))
);

CREATE INDEX v21_provider_reassociation_due_idx
  ON onetime.v21_provider_reassociation_intents(
    product_key,
    runtime_tier,
    verification_environment_id,
    state,
    created_at
  );

CREATE TABLE onetime.v21_account_audit_events (
  audit_event_id text PRIMARY KEY CHECK (audit_event_id <> ''),
  event_type text NOT NULL CHECK (event_type <> ''),
  household_id text NOT NULL,
  actor_account_id text NOT NULL,
  outgoing_adult_id text NOT NULL,
  replacement_adult_id text NOT NULL,
  canonical_request_hash text NOT NULL,
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  UNIQUE (event_type, canonical_request_hash),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash))
);

CREATE INDEX v21_account_audit_household_idx
  ON onetime.v21_account_audit_events(
    product_key,
    runtime_tier,
    verification_environment_id,
    household_id,
    occurred_at DESC
  );

-- @postgres-only-begin
CREATE OR REPLACE FUNCTION onetime.v21_fill_account_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  scope_product text;
  scope_tier text;
  scope_environment text;
BEGIN
  IF TG_TABLE_NAME = 'v21_human_account_role_memberships' THEN
    SELECT product_key, runtime_tier, verification_environment_id
      INTO scope_product, scope_tier, scope_environment
      FROM onetime.v21_human_accounts
     WHERE human_account_id = NEW.human_account_id;
  ELSE
    SELECT product_key, runtime_tier, verification_environment_id
      INTO scope_product, scope_tier, scope_environment
      FROM onetime.v21_households
     WHERE household_id = NEW.household_id;
  END IF;
  NEW.product_key := scope_product;
  NEW.runtime_tier := scope_tier;
  NEW.verification_environment_id := scope_environment;
  RETURN NEW;
END;
$$;

CREATE TRIGGER v21_membership_fill_scope
BEFORE INSERT ON onetime.v21_human_account_role_memberships
FOR EACH ROW EXECUTE FUNCTION onetime.v21_fill_account_scope();

CREATE TRIGGER v21_reassociation_fill_scope
BEFORE INSERT ON onetime.v21_provider_reassociation_intents
FOR EACH ROW EXECUTE FUNCTION onetime.v21_fill_account_scope();

CREATE TRIGGER v21_account_audit_fill_scope
BEFORE INSERT ON onetime.v21_account_audit_events
FOR EACH ROW EXECUTE FUNCTION onetime.v21_fill_account_scope();

CREATE OR REPLACE FUNCTION onetime.v21_enforce_self_student_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.relationship = 'self' AND NOT EXISTS (
    SELECT 1
      FROM onetime.v21_households
     WHERE household_id = NEW.household_id
       AND owner_adult_id = NEW.self_adult_id
       AND product_key = NEW.product_key
       AND runtime_tier = NEW.runtime_tier
       AND verification_environment_id = NEW.verification_environment_id
  ) THEN
    RAISE EXCEPTION 'self Student must match the household owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER v21_student_owner_guard
BEFORE INSERT OR UPDATE OF household_id, relationship, self_adult_id
ON onetime.v21_student_profiles
FOR EACH ROW EXECUTE FUNCTION onetime.v21_enforce_self_student_owner();

CREATE OR REPLACE FUNCTION onetime.v21_reject_account_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'v21 account audit events are append-only';
END;
$$;

CREATE TRIGGER v21_account_audit_append_only
BEFORE UPDATE OR DELETE ON onetime.v21_account_audit_events
FOR EACH ROW EXECUTE FUNCTION onetime.v21_reject_account_audit_mutation();
-- @postgres-only-end
