CREATE TABLE onetime.v21_adult_credentials (
  human_account_id text PRIMARY KEY,
  adult_id text NOT NULL UNIQUE,
  credential_kind text NOT NULL DEFAULT 'adult_email_password'
    CHECK (credential_kind = 'adult_email_password'),
  password_hash text NOT NULL CHECK (
    length(password_hash) >= 16
    AND (
      password_hash LIKE 'argon2id%'
      OR password_hash LIKE '$argon2id%'
    )
  ),
  credential_state text NOT NULL DEFAULT 'active'
    CHECK (credential_state IN ('active', 'reset_required', 'disabled')),
  credential_version bigint NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    human_account_id,
    adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ),
  FOREIGN KEY (
    human_account_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_human_accounts(
    human_account_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (human_account_id, adult_id)
    REFERENCES onetime.v21_human_accounts(human_account_id, adult_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_adult_identities(
    adult_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) ON DELETE RESTRICT,
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

CREATE UNIQUE INDEX v21_households_signup_owner_binding_idx
  ON onetime.v21_households(
    household_id,
    owner_adult_id,
    owner_human_account_id,
    product_key,
    runtime_tier,
    verification_environment_id
  );

CREATE TABLE onetime.family_signup_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 43 AND 128),
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  operation text NOT NULL DEFAULT 'public_family_signup'
    CHECK (operation = 'public_family_signup'),
  canonical_request_digest text NOT NULL,
  adult_id text NOT NULL,
  human_account_id text NOT NULL,
  household_id text NOT NULL,
  household_timezone text NOT NULL CHECK (
    household_timezone IN ('UTC', 'Etc/UTC')
    OR household_timezone LIKE '%/%'
  ),
  terms_accepted boolean NOT NULL CHECK (terms_accepted = true),
  privacy_accepted boolean NOT NULL CHECK (privacy_accepted = true),
  general_marketing_consent boolean NOT NULL,
  parent_newsletter_consent boolean NOT NULL,
  committed_at timestamptz NOT NULL,
  UNIQUE (
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ),
  FOREIGN KEY (adult_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (human_account_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_human_accounts(
      human_account_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (household_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (
    household_id,
    adult_id,
    human_account_id,
    product,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_households(
    household_id,
    owner_adult_id,
    owner_human_account_id,
    product_key,
    runtime_tier,
    verification_environment_id
  ) ON DELETE RESTRICT,
  CHECK (
    length(canonical_request_digest) = 64
    AND canonical_request_digest = lower(canonical_request_digest)
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

CREATE TABLE onetime.family_signup_access_projections (
  household_id text NOT NULL,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  access_branch text NOT NULL CHECK (access_branch IN (
    'immediate_free', 'inactive_checkout', 'inactive_identity_review'
  )),
  access_state text NOT NULL CHECK (access_state IN ('free', 'inactive')),
  seat_limit integer NOT NULL DEFAULT 3 CHECK (seat_limit = 3),
  active_seat_count integer NOT NULL DEFAULT 0 CHECK (active_seat_count = 0),
  free_access_expires_at timestamptz,
  checkout_required boolean NOT NULL,
  checkout_blocked_by_identity_review boolean NOT NULL,
  rolling_trial_granted boolean NOT NULL DEFAULT false CHECK (rolling_trial_granted = false),
  card_collected boolean NOT NULL DEFAULT false CHECK (card_collected = false),
  signup_committed_at timestamptz NOT NULL,
  PRIMARY KEY (product, runtime_tier, verification_environment_id, household_id),
  FOREIGN KEY (household_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  CHECK (
    (
      access_branch = 'immediate_free'
      AND access_state = 'free'
      AND signup_committed_at < timestamptz '2026-09-13T16:24:00.000Z'
      AND free_access_expires_at = timestamptz '2026-09-13T16:24:00.000Z'
      AND checkout_required = false
      AND checkout_blocked_by_identity_review = false
    )
    OR (
      access_branch = 'inactive_checkout'
      AND access_state = 'inactive'
      AND signup_committed_at >= timestamptz '2026-09-13T16:24:00.000Z'
      AND free_access_expires_at IS NULL
      AND checkout_required = true
      AND checkout_blocked_by_identity_review = false
    )
    OR (
      access_branch = 'inactive_identity_review'
      AND access_state = 'inactive'
      AND signup_committed_at >= timestamptz '2026-09-13T16:24:00.000Z'
      AND free_access_expires_at IS NULL
      AND checkout_required = false
      AND checkout_blocked_by_identity_review = true
    )
  )
);

CREATE TABLE onetime.family_signup_consents (
  idempotency_key text NOT NULL,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  operation text NOT NULL,
  canonical_request_digest text NOT NULL,
  adult_id text NOT NULL,
  consent_scope text NOT NULL CHECK (consent_scope IN (
    'general_marketing', 'parent_newsletter'
  )),
  choice boolean NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (idempotency_key, consent_scope),
  FOREIGN KEY (
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) REFERENCES onetime.family_signup_requests(
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) ON DELETE RESTRICT,
  FOREIGN KEY (adult_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT
);

CREATE TABLE onetime.family_signup_receipts (
  idempotency_key text PRIMARY KEY,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  operation text NOT NULL,
  canonical_request_digest text NOT NULL,
  adult_id text NOT NULL,
  human_account_id text NOT NULL,
  household_id text NOT NULL,
  result_json jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  FOREIGN KEY (
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) REFERENCES onetime.family_signup_requests(
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) ON DELETE RESTRICT,
  CHECK ((result_json ->> 'provider_effects_completed_inline') = '0')
);

CREATE TABLE onetime.family_signup_outbox (
  intent_id text PRIMARY KEY CHECK (intent_id <> ''),
  idempotency_key text NOT NULL,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  operation text NOT NULL,
  canonical_request_digest text NOT NULL,
  kind text NOT NULL DEFAULT 'ghl_adult_and_household_sync'
    CHECK (kind = 'ghl_adult_and_household_sync'),
  adult_id text NOT NULL,
  household_id text NOT NULL,
  normalized_email_hash text NOT NULL,
  general_marketing_consent boolean NOT NULL,
  parent_newsletter_consent boolean NOT NULL,
  dispatch_state text NOT NULL CHECK (dispatch_state IN ('ready', 'identity_review')),
  preserve_adult_suppression boolean NOT NULL DEFAULT true
    CHECK (preserve_adult_suppression = true),
  local_commit_required boolean NOT NULL DEFAULT true CHECK (local_commit_required = true),
  intent_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) REFERENCES onetime.family_signup_requests(
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    idempotency_key,
    canonical_request_digest
  ) ON DELETE RESTRICT,
  FOREIGN KEY (household_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  CHECK (
    length(normalized_email_hash) = 64
    AND normalized_email_hash = lower(normalized_email_hash)
  )
);

CREATE INDEX family_signup_outbox_dispatch_idx
  ON onetime.family_signup_outbox(
    product,
    runtime_tier,
    verification_environment_id,
    dispatch_state,
    created_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.family_signup_requests
  ADD CONSTRAINT family_signup_request_digest_hex_check
    CHECK (canonical_request_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.family_signup_outbox
  ADD CONSTRAINT family_signup_email_hash_hex_check
    CHECK (normalized_email_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.validate_family_signup_timezone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_timezone_names WHERE name = NEW.household_timezone
  ) THEN
    RAISE EXCEPTION 'family signup timezone must be an IANA identifier';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER family_signup_timezone_check
BEFORE INSERT OR UPDATE ON onetime.family_signup_requests
FOR EACH ROW EXECUTE FUNCTION onetime.validate_family_signup_timezone();

CREATE OR REPLACE FUNCTION onetime.reject_family_signup_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'family signup evidence is append-only';
END;
$$;

CREATE TRIGGER family_signup_requests_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_requests
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE TRIGGER family_signup_access_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_access_projections
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE TRIGGER family_signup_consents_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_consents
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE TRIGGER family_signup_receipts_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE TRIGGER family_signup_outbox_append_only
BEFORE UPDATE OR DELETE ON onetime.family_signup_outbox
FOR EACH ROW EXECUTE FUNCTION onetime.reject_family_signup_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_adult_credential_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.credential_version <> OLD.credential_version + 1 THEN
    RAISE EXCEPTION 'adult credential optimistic version conflict';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER v21_adult_credentials_version_step
BEFORE UPDATE ON onetime.v21_adult_credentials
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_adult_credential_version_step();
-- @postgres-only-end
