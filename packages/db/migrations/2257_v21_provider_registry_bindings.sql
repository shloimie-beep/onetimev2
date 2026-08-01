CREATE TABLE onetime.provider_registry_binding_v21 (
  registry_binding_key text NOT NULL CHECK (btrim(registry_binding_key) <> ''),
  provider text NOT NULL CHECK (provider IN (
    'highlevel', 'stripe', 'resend', 'zoom', 'vimeo', 'drive', 'openai', 'telegram', 's3'
  )),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (btrim(verification_environment_id) <> ''),
  provider_account_ref_hash text NOT NULL,
  allowed_operation_types text[] NOT NULL CHECK (cardinality(allowed_operation_types) > 0),
  mutation_policy text NOT NULL CHECK (
    mutation_policy IN ('allowed', 'orchestration_only', 'prohibited')
  ),
  active boolean NOT NULL DEFAULT false,
  registry_evidence_digest text NOT NULL,
  provider_readback_evidence_digest text NOT NULL,
  observed_at timestamptz NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    registry_binding_key, product_key, runtime_tier, verification_environment_id
  ),
  CHECK (length(provider_account_ref_hash) = 64 AND provider_account_ref_hash = lower(provider_account_ref_hash)),
  CHECK (length(registry_evidence_digest) = 64 AND registry_evidence_digest = lower(registry_evidence_digest)),
  CHECK (
    length(provider_readback_evidence_digest) = 64
    AND provider_readback_evidence_digest = lower(provider_readback_evidence_digest)
  ),
  CHECK (updated_at >= created_at),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  ),
  CHECK (provider <> 'stripe' OR mutation_policy = 'prohibited')
);

CREATE INDEX provider_registry_binding_active_scope_idx
  ON onetime.provider_registry_binding_v21(
    product_key, runtime_tier, verification_environment_id, provider, observed_at DESC
  )
  WHERE active = true;

-- @postgres-only-begin
ALTER TABLE onetime.provider_registry_binding_v21
  ADD CONSTRAINT provider_registry_binding_account_hash_hex_check
    CHECK (provider_account_ref_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT provider_registry_binding_registry_digest_hex_check
    CHECK (registry_evidence_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT provider_registry_binding_readback_digest_hex_check
    CHECK (provider_readback_evidence_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.guard_provider_registry_binding_v21()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'provider registry binding deletion is prohibited';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.registry_binding_key <> OLD.registry_binding_key
      OR NEW.provider <> OLD.provider
      OR NEW.product_key <> OLD.product_key
      OR NEW.runtime_tier <> OLD.runtime_tier
      OR NEW.verification_environment_id <> OLD.verification_environment_id
      OR NEW.version <> OLD.version + 1
      OR NEW.updated_at <= OLD.updated_at
    THEN
      RAISE EXCEPTION 'provider registry binding update fence violated';
    END IF;
  ELSIF NEW.version <> 1 THEN
    RAISE EXCEPTION 'provider registry binding initial version must be one';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_registry_binding_v21_guard
BEFORE INSERT OR UPDATE OR DELETE ON onetime.provider_registry_binding_v21
FOR EACH ROW EXECUTE FUNCTION onetime.guard_provider_registry_binding_v21();
-- @postgres-only-end
