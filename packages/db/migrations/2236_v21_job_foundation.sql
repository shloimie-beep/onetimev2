CREATE TABLE onetime.job_command_idempotency (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  actor_ref text NOT NULL CHECK (actor_ref <> ''),
  operation_scope text NOT NULL CHECK (operation_scope <> ''),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  canonical_request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  resulting_version bigint NOT NULL CHECK (resulting_version > 0),
  outbox_job_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, runtime_tier, actor_ref, operation_scope, idempotency_key),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
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

CREATE TABLE onetime.job_outbox (
  job_id text PRIMARY KEY CHECK (job_id <> ''),
  operation_type text NOT NULL CHECK (operation_type <> ''),
  aggregate_ref text NOT NULL CHECK (aggregate_ref <> ''),
  source_version bigint NOT NULL CHECK (source_version > 0),
  provider text NOT NULL CHECK (provider <> ''),
  product text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  canonical_request_hash text NOT NULL,
  payload_ref text NOT NULL CHECK (payload_ref <> ''),
  payload_digest text NOT NULL,
  compensation_for_job_id text,
  state text NOT NULL DEFAULT 'not_started'
    CHECK (
      state IN (
        'not_started',
        'leased',
        'in_flight',
        'accepted',
        'retry_wait',
        'acceptance_unknown',
        'rejected',
        'dead_letter',
        'complete',
        'canceled'
      )
    ),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recovery_generation bigint NOT NULL DEFAULT 0 CHECK (recovery_generation >= 0),
  dispatch_attempts integer NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  lifetime_dispatch_attempts bigint NOT NULL DEFAULT 0 CHECK (lifetime_dispatch_attempts >= 0),
  reconciliation_attempts integer NOT NULL DEFAULT 0 CHECK (reconciliation_attempts >= 0),
  lease_owner text,
  lease_generation bigint NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  next_attempt_at timestamptz,
  unknown_effect boolean NOT NULL DEFAULT false,
  provider_acceptance_digest text,
  reconciliation_digest text,
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, runtime_tier, verification_environment_id, idempotency_key),
  FOREIGN KEY (compensation_for_job_id) REFERENCES onetime.job_outbox(job_id),
  CHECK (compensation_for_job_id IS NULL OR compensation_for_job_id <> job_id),
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
  CHECK (length(payload_digest) = 64 AND payload_digest = lower(payload_digest)),
  CHECK (
    provider_acceptance_digest IS NULL
    OR (
      length(provider_acceptance_digest) = 64
      AND provider_acceptance_digest = lower(provider_acceptance_digest)
    )
  ),
  CHECK (
    reconciliation_digest IS NULL
    OR (
      length(reconciliation_digest) = 64
      AND reconciliation_digest = lower(reconciliation_digest)
    )
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
    (lease_owner IS NULL AND lease_expires_at IS NULL AND last_heartbeat_at IS NULL)
    OR
    (lease_owner IS NOT NULL AND lease_generation > 0 AND lease_expires_at IS NOT NULL)
  ),
  CHECK (state <> 'acceptance_unknown' OR unknown_effect = true),
  CHECK (unknown_effect = false OR state IN ('acceptance_unknown', 'dead_letter'))
);

CREATE INDEX job_outbox_due_idx
  ON onetime.job_outbox(
    product,
    runtime_tier,
    verification_environment_id,
    operation_type,
    state,
    next_attempt_at
  )
  WHERE unknown_effect = false
    AND state IN ('not_started', 'retry_wait');

CREATE INDEX job_outbox_acceptance_unknown_idx
  ON onetime.job_outbox(
    product,
    runtime_tier,
    verification_environment_id,
    updated_at,
    job_id
  )
  WHERE unknown_effect = true;

CREATE INDEX job_outbox_aggregate_version_idx
  ON onetime.job_outbox(aggregate_ref, source_version);

CREATE INDEX job_outbox_compensation_idx
  ON onetime.job_outbox(compensation_for_job_id)
  WHERE compensation_for_job_id IS NOT NULL;
