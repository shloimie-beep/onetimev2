ALTER TABLE onetime.learning_delivery_content_factory_intakes
  ADD COLUMN IF NOT EXISTS occurrence_key text,
  ADD COLUMN IF NOT EXISTS storage_locator text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_fingerprint text,
  ADD COLUMN IF NOT EXISTS audit_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE onetime.learning_delivery_content_factory_intakes
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_intakes_occurrence_key_fkey;

ALTER TABLE onetime.learning_delivery_content_factory_intakes
  ADD CONSTRAINT learning_delivery_content_factory_intakes_occurrence_key_fkey
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key);

CREATE UNIQUE INDEX IF NOT EXISTS content_factory_intakes_idempotency_idx
  ON onetime.learning_delivery_content_factory_intakes(account_key, product_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_factory_intakes_occurrence_idx
  ON onetime.learning_delivery_content_factory_intakes(
    account_key, product_key, occurrence_key, created_at DESC
  ) WHERE occurrence_key IS NOT NULL;

ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD COLUMN IF NOT EXISTS occurrence_key text,
  ADD COLUMN IF NOT EXISTS processing_mode text NOT NULL DEFAULT 'vimeo'
    CHECK (processing_mode IN ('synthetic', 'vimeo')),
  ADD COLUMN IF NOT EXISTS unpublished_by_user_key text,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_occurrence_key_fkey;

ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD CONSTRAINT learning_delivery_content_factory_items_occurrence_key_fkey
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key);

-- 2214 required a raw Vimeo embed URL for publication. The durable path stores only an
-- opaque provider identifier and renders playback behind a first-party authorization route.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_check;

-- pg-mem assigns ordinal names to the same 2214 checks; production PostgreSQL ignores these.
ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_constraint_18;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_transcription_provider_check;

ALTER TABLE onetime.learning_delivery_content_factory_items
  DROP CONSTRAINT IF EXISTS learning_delivery_content_factory_items_constraint_12;

ALTER TABLE onetime.learning_delivery_content_factory_items
  ADD CONSTRAINT learning_delivery_content_factory_items_transcription_provider_check
  CHECK (transcription_provider IN ('openai', 'synthetic'));

CREATE INDEX IF NOT EXISTS content_factory_items_occurrence_idx
  ON onetime.learning_delivery_content_factory_items(
    account_key, product_key, occurrence_key, factory_state, updated_at DESC
  ) WHERE occurrence_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS onetime.classroom_occurrence_learner_entitlements (
  occurrence_entitlement_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  entitlement_state text NOT NULL DEFAULT 'active'
    CHECK (entitlement_state IN ('active', 'revoked')),
  source text NOT NULL CHECK (source IN ('operator', 'enrollment_projection', 'isolated_acceptance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  UNIQUE (account_key, product_key, occurrence_key, learner_key)
);

CREATE INDEX IF NOT EXISTS occurrence_learner_entitlements_scope_idx
  ON onetime.classroom_occurrence_learner_entitlements(
    account_key, product_key, occurrence_key, entitlement_state, learner_key
  );

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_content_factory_jobs (
  job_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  intake_key text NOT NULL,
  occurrence_key text NOT NULL,
  idempotency_key text NOT NULL,
  job_state text NOT NULL DEFAULT 'queued'
    CHECK (job_state IN ('queued', 'leased', 'retry_wait', 'completed', 'dead_letter')),
  current_stage text NOT NULL DEFAULT 'inspecting'
    CHECK (current_stage IN (
      'inspecting', 'trimming', 'transcribing', 'drafting', 'uploading', 'review', 'completed'
    )),
  lease_owner_digest text,
  lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_safe_error_code text,
  private_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_key text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (intake_key) REFERENCES onetime.learning_delivery_content_factory_intakes(intake_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, intake_key),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS content_factory_jobs_claim_idx
  ON onetime.learning_delivery_content_factory_jobs(
    account_key, product_key, job_state, next_attempt_at, lease_expires_at, created_at
  );

CREATE TABLE IF NOT EXISTS onetime.learning_delivery_content_factory_stage_results (
  stage_result_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  job_key text NOT NULL,
  stage text NOT NULL CHECK (stage IN (
    'inspecting', 'trimming', 'transcribing', 'drafting', 'uploading', 'review'
  )),
  result_digest text NOT NULL,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (job_key) REFERENCES onetime.learning_delivery_content_factory_jobs(job_key),
  UNIQUE (account_key, product_key, job_key, stage)
);

CREATE INDEX IF NOT EXISTS content_factory_stage_results_job_idx
  ON onetime.learning_delivery_content_factory_stage_results(
    account_key, product_key, job_key, completed_at
  );
