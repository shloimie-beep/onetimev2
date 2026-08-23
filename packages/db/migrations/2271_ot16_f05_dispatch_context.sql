-- Durable, adult-only payload authority for OT-16 jobs. Provider identifiers
-- remain outside this table; the F05 handler reopens the active F06 binding and
-- resolves the exact provider identity only at the mutation boundary.
CREATE TABLE onetime.ot16_f05_dispatch_context (
  operation_id text PRIMARY KEY,
  job_id text NOT NULL UNIQUE,
  adult_id text NOT NULL,
  household_id text NOT NULL,
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  expiry_at timestamptz NOT NULL,
  checkpoint_days integer NOT NULL CHECK (checkpoint_days IN (14, 7, 3, 1, 0)),
  sender_key text NOT NULL CHECK (sender_key = 'office'),
  transport text NOT NULL CHECK (transport = 'GHL'),
  subject text NOT NULL CHECK (subject <> ''),
  body text NOT NULL CHECK (body <> ''),
  cta_label text NOT NULL CHECK (cta_label = 'Complete Checkout'),
  content_digest text NOT NULL,
  safe_provider_reference text NOT NULL,
  request_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (operation_id)
    REFERENCES onetime.communication_decision(operation_id) ON DELETE RESTRICT,
  FOREIGN KEY (job_id)
    REFERENCES onetime.job_outbox(job_id) ON DELETE RESTRICT,
  FOREIGN KEY (adult_id, product, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
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
  CHECK (length(operation_id) = 64 AND operation_id = lower(operation_id)),
  CHECK (length(job_id) = 64 AND job_id = lower(job_id)),
  CHECK (length(content_digest) = 64 AND content_digest = lower(content_digest)),
  CHECK (
    length(safe_provider_reference) = 64
    AND safe_provider_reference = lower(safe_provider_reference)
  ),
  CHECK (length(request_digest) = 64 AND request_digest = lower(request_digest)),
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

CREATE INDEX ot16_f05_dispatch_context_scope_idx
  ON onetime.ot16_f05_dispatch_context(
    product,
    runtime_tier,
    verification_environment_id,
    created_at,
    operation_id
  );

-- @postgres-only-begin
ALTER TABLE onetime.ot16_f05_dispatch_context
  ADD CONSTRAINT ot16_f05_operation_id_hex_check
    CHECK (operation_id ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ot16_f05_job_id_hex_check
    CHECK (job_id ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ot16_f05_content_digest_hex_check
    CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ot16_f05_provider_reference_hex_check
    CHECK (safe_provider_reference ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ot16_f05_request_digest_hex_check
    CHECK (request_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_ot16_f05_context_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OT-16 F05 dispatch context is append-only';
END;
$$;

CREATE TRIGGER ot16_f05_dispatch_context_append_only
BEFORE UPDATE OR DELETE ON onetime.ot16_f05_dispatch_context
FOR EACH ROW EXECUTE FUNCTION onetime.reject_ot16_f05_context_mutation();
-- @postgres-only-end

SELECT 1;
