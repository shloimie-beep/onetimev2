CREATE TABLE onetime.school_inquiries_v21 (
  lead_id text PRIMARY KEY CHECK (lead_id <> ''),
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  operation text NOT NULL DEFAULT 'public_school_inquiry'
    CHECK (operation = 'public_school_inquiry'),
  normalized_email text NOT NULL CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND normalized_email LIKE '%@%'
  ),
  canonical_request_digest text NOT NULL,
  school_name text NOT NULL CHECK (school_name <> ''),
  contact_first_name text NOT NULL CHECK (contact_first_name <> ''),
  contact_last_name text NOT NULL CHECK (contact_last_name <> ''),
  phone text,
  note text,
  adult_contact_kind text NOT NULL DEFAULT 'adult' CHECK (adult_contact_kind = 'adult'),
  sales_state text NOT NULL DEFAULT 'pending_manual_follow_up'
    CHECK (sales_state = 'pending_manual_follow_up'),
  acknowledgment_intent_id text NOT NULL UNIQUE CHECK (acknowledgment_intent_id <> ''),
  receipt_json jsonb NOT NULL,
  product_account_created boolean NOT NULL DEFAULT false
    CHECK (product_account_created = false),
  parent_login_created boolean NOT NULL DEFAULT false CHECK (parent_login_created = false),
  passwordless_claim_created boolean NOT NULL DEFAULT false
    CHECK (passwordless_claim_created = false),
  household_created boolean NOT NULL DEFAULT false CHECK (household_created = false),
  student_accounts_created integer NOT NULL DEFAULT 0 CHECK (student_accounts_created = 0),
  subscription_created boolean NOT NULL DEFAULT false CHECK (subscription_created = false),
  product_access_granted boolean NOT NULL DEFAULT false CHECK (product_access_granted = false),
  nurture_enrolled boolean NOT NULL DEFAULT false CHECK (nurture_enrolled = false),
  provider_identity_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, runtime_tier, verification_environment_id, normalized_email),
  UNIQUE (
    product,
    runtime_tier,
    verification_environment_id,
    operation,
    normalized_email,
    canonical_request_digest
  ),
  CHECK (provider_identity_ref IS NULL),
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

CREATE TABLE onetime.school_inquiry_acknowledgments_v21 (
  intent_id text PRIMARY KEY CHECK (intent_id <> ''),
  lead_id text NOT NULL UNIQUE,
  product text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  normalized_email text NOT NULL,
  normalized_email_hash text NOT NULL,
  kind text NOT NULL DEFAULT 'school_inquiry_acknowledgment'
    CHECK (kind = 'school_inquiry_acknowledgment'),
  workflow_id text NOT NULL DEFAULT 'OT-01' CHECK (workflow_id = 'OT-01'),
  template_id text NOT NULL DEFAULT 'OT-01.school_acknowledgment'
    CHECK (template_id = 'OT-01.school_acknowledgment'),
  template_version text NOT NULL DEFAULT '2.1.0' CHECK (template_version = '2.1.0'),
  sender_key text NOT NULL DEFAULT 'office' CHECK (sender_key = 'office'),
  rendered_subject text NOT NULL DEFAULT 'We received your One Time school inquiry'
    CHECK (rendered_subject = 'We received your One Time school inquiry'),
  content_digest text NOT NULL DEFAULT
    'ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb'
    CHECK (
      content_digest =
      'ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb'
    ),
  delivery_state text NOT NULL DEFAULT 'pending' CHECK (delivery_state = 'pending'),
  local_commit_required boolean NOT NULL DEFAULT true CHECK (local_commit_required = true),
  notification_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lead_id) REFERENCES onetime.school_inquiries_v21(lead_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    product,
    runtime_tier,
    verification_environment_id,
    normalized_email
  ) REFERENCES onetime.school_inquiries_v21(
    product,
    runtime_tier,
    verification_environment_id,
    normalized_email
  ) ON DELETE RESTRICT,
  CHECK (
    length(normalized_email_hash) = 64
    AND normalized_email_hash = lower(normalized_email_hash)
  )
);

CREATE TABLE onetime.approved_school_configurations_v21 (
  approved_school_id text NOT NULL CHECK (approved_school_id <> ''),
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  operation text NOT NULL DEFAULT 'admin_approved_school_configuration'
    CHECK (operation = 'admin_approved_school_configuration'),
  approval_state text NOT NULL DEFAULT 'approved' CHECK (approval_state = 'approved'),
  adult_account_manager_id text NOT NULL,
  household_id text NOT NULL,
  seat_allowance integer NOT NULL CHECK (seat_allowance > 0),
  price_minor_units bigint NOT NULL CHECK (price_minor_units >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  billing_starts_at timestamptz NOT NULL,
  terms_reference text NOT NULL CHECK (terms_reference <> ''),
  configuration_version bigint NOT NULL CHECK (configuration_version > 0),
  account_model text NOT NULL DEFAULT 'parent_student' CHECK (account_model = 'parent_student'),
  adult_account_manager_role text NOT NULL DEFAULT 'parent'
    CHECK (adult_account_manager_role = 'parent'),
  student_account_role text NOT NULL DEFAULT 'student'
    CHECK (student_account_role = 'student'),
  school_role_created boolean NOT NULL DEFAULT false CHECK (school_role_created = false),
  school_portal_created boolean NOT NULL DEFAULT false CHECK (school_portal_created = false),
  bulk_roster_created boolean NOT NULL DEFAULT false CHECK (bulk_roster_created = false),
  automated_nurture_created boolean NOT NULL DEFAULT false
    CHECK (automated_nurture_created = false),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    product,
    runtime_tier,
    verification_environment_id,
    approved_school_id
  ),
  FOREIGN KEY (
    adult_account_manager_id,
    product,
    runtime_tier,
    verification_environment_id
  ) REFERENCES onetime.v21_adult_identities(
    adult_id,
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

CREATE INDEX school_inquiry_manual_followup_idx
  ON onetime.school_inquiries_v21(
    product,
    runtime_tier,
    verification_environment_id,
    sales_state,
    created_at
  );

CREATE INDEX approved_school_account_manager_idx
  ON onetime.approved_school_configurations_v21(
    product,
    runtime_tier,
    verification_environment_id,
    adult_account_manager_id,
    household_id
  );

-- @postgres-only-begin
ALTER TABLE onetime.school_inquiries_v21
  ADD CONSTRAINT school_inquiry_request_digest_hex_check
    CHECK (canonical_request_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.school_inquiry_acknowledgments_v21
  ADD CONSTRAINT school_inquiry_email_hash_hex_check
    CHECK (normalized_email_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT school_inquiry_content_digest_hex_check
    CHECK (content_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_school_inquiry_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'school inquiry evidence is append-only';
END;
$$;

CREATE TRIGGER school_inquiries_append_only
BEFORE UPDATE OR DELETE ON onetime.school_inquiries_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_school_inquiry_evidence_mutation();

CREATE TRIGGER school_inquiry_acknowledgments_append_only
BEFORE UPDATE OR DELETE ON onetime.school_inquiry_acknowledgments_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_school_inquiry_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_approved_school_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.configuration_version <> OLD.configuration_version + 1 THEN
    RAISE EXCEPTION 'approved school optimistic version conflict';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER approved_school_configuration_version_step
BEFORE UPDATE ON onetime.approved_school_configurations_v21
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_approved_school_version_step();
-- @postgres-only-end
