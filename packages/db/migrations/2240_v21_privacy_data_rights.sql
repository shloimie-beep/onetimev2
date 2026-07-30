CREATE TABLE onetime.privacy_consent_event (
  consent_event_id text PRIMARY KEY CHECK (consent_event_id <> ''),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key <> ''),
  canonical_request_hash text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('parent_account_owner', 'adult_self_student')),
  actor_account_or_credential_id text NOT NULL,
  actor_adult_id text NOT NULL,
  household_id text NOT NULL,
  student_id text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('self', 'dependent')),
  parent_authority_attested boolean NOT NULL,
  scope text NOT NULL CHECK (scope IN ('service_account', 'recording_participation', 'member_recognition')),
  choice text NOT NULL CHECK (choice IN ('granted', 'declined', 'withdrawn')),
  policy_versions jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  request_correlation_id text NOT NULL,
  network_evidence_digest text NOT NULL,
  supersedes_consent_event_id text REFERENCES onetime.privacy_consent_event(consent_event_id),
  reason_code text NOT NULL,
  CHECK (length(canonical_request_hash) = 64 AND canonical_request_hash = lower(canonical_request_hash)),
  CHECK (length(network_evidence_digest) = 64 AND network_evidence_digest = lower(network_evidence_digest)),
  CHECK (parent_authority_attested = (relationship = 'dependent')),
  CHECK (relationship <> 'dependent' OR actor_kind = 'parent_account_owner'),
  CHECK (actor_kind <> 'adult_self_student' OR (relationship = 'self' AND scope <> 'service_account'))
);

CREATE TABLE onetime.recording_participant_snapshot (
  snapshot_id text PRIMARY KEY CHECK (snapshot_id <> ''),
  occurrence_id text NOT NULL,
  student_id text NOT NULL,
  household_id text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('self', 'dependent')),
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  audit_ref text NOT NULL,
  UNIQUE (occurrence_id, student_id)
);

CREATE TABLE onetime.data_rights_request (
  request_id text PRIMARY KEY CHECK (request_id <> ''),
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('export', 'correction', 'closure', 'erasure', 'consent_withdrawal')),
  subject_json jsonb NOT NULL,
  requester_kind text NOT NULL CHECK (requester_kind IN ('account_owner', 'adult_self_student', 'privacy_admin')),
  requester_ref text NOT NULL,
  requester_household_id text,
  relationship_evidence text CHECK (relationship_evidence IS NULL OR relationship_evidence IN ('self', 'dependent')),
  recent_password_session_id text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'received', 'identity_verified', 'approved', 'executing', 'provider_pending',
    'completed', 'denied', 'failed', 'canceled'
  )),
  visible_status text CHECK (
    visible_status IS NULL
    OR visible_status IN ('requested', 'processing', 'completed', 'partially_excepted', 'failed')
  ),
  requested_categories text[] NOT NULL,
  excluded_categories text[] NOT NULL DEFAULT '{}'::text[],
  legal_exception_codes text[] NOT NULL DEFAULT '{}'::text[],
  provider_cascades jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependent_review_required boolean NOT NULL DEFAULT false,
  dependent_review_completed boolean NOT NULL DEFAULT false,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  terminal_reason_code text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  audit_refs text[] NOT NULL DEFAULT '{}'::text[],
  UNIQUE (product, runtime_tier, verification_environment_id, request_id),
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
  CHECK (dependent_review_completed = false OR dependent_review_required = true),
  CHECK (
    (state IN ('received', 'identity_verified', 'approved') AND visible_status = 'requested')
    OR (state = 'executing' AND visible_status = 'processing')
    OR (state = 'provider_pending' AND visible_status = 'partially_excepted')
    OR (state = 'completed' AND visible_status IN ('completed', 'partially_excepted'))
    OR (state IN ('denied', 'failed') AND visible_status = 'failed')
    OR (state = 'canceled' AND visible_status IS NULL)
  )
);

CREATE TABLE onetime.export_download_grant (
  grant_id text PRIMARY KEY CHECK (grant_id <> ''),
  request_id text NOT NULL,
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  subject_binding_hash text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  initiating_session_id text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (product, runtime_tier, verification_environment_id, grant_id),
  FOREIGN KEY (product, runtime_tier, verification_environment_id, request_id)
    REFERENCES onetime.data_rights_request(
      product,
      runtime_tier,
      verification_environment_id,
      request_id
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
  CHECK (expires_at = issued_at + interval '15 minutes'),
  CHECK (length(subject_binding_hash) = 64 AND subject_binding_hash = lower(subject_binding_hash)),
  CHECK (length(token_hash) = 64 AND token_hash = lower(token_hash)),
  CHECK (used_at IS NULL OR revoked_at IS NULL),
  CHECK (used_at IS NULL OR used_at >= issued_at),
  CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);

CREATE TABLE onetime.privacy_retention_work (
  work_id text PRIMARY KEY CHECK (work_id <> ''),
  request_id text NOT NULL,
  subject_binding_hash text NOT NULL,
  category text NOT NULL,
  due_at timestamptz NOT NULL,
  legal_hold_codes text[] NOT NULL DEFAULT '{}'::text[],
  provider_outbox_intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  purge_record_digest text,
  state text NOT NULL CHECK (state IN ('due', 'planned', 'provider_pending', 'complete', 'failed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product text NOT NULL DEFAULT 'one_time_mishnayos' CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  UNIQUE (product, runtime_tier, verification_environment_id, work_id),
  FOREIGN KEY (product, runtime_tier, verification_environment_id, request_id)
    REFERENCES onetime.data_rights_request(
      product,
      runtime_tier,
      verification_environment_id,
      request_id
    ),
  CHECK (length(subject_binding_hash) = 64 AND subject_binding_hash = lower(subject_binding_hash)),
  CHECK (
    purge_record_digest IS NULL
    OR (length(purge_record_digest) = 64 AND purge_record_digest = lower(purge_record_digest))
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

CREATE INDEX privacy_retention_work_due_idx
  ON onetime.privacy_retention_work(product, runtime_tier, verification_environment_id, state, due_at);

CREATE TABLE onetime.purge_ledger_receipt (
  ledger_event_id text PRIMARY KEY CHECK (ledger_event_id <> ''),
  request_id text NOT NULL,
  record_digest text NOT NULL,
  primary_object_version_hash text NOT NULL,
  replica_object_version_hash text NOT NULL,
  replication_completed_at timestamptz NOT NULL,
  CHECK (length(record_digest) = 64 AND record_digest = lower(record_digest)),
  CHECK (
    length(primary_object_version_hash) = 64
    AND primary_object_version_hash = lower(primary_object_version_hash)
  ),
  CHECK (
    length(replica_object_version_hash) = 64
    AND replica_object_version_hash = lower(replica_object_version_hash)
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.privacy_consent_event
  ADD CONSTRAINT privacy_consent_request_hash_hex_check
    CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT privacy_consent_network_digest_hex_check
    CHECK (network_evidence_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.export_download_grant
  ADD CONSTRAINT export_download_subject_hash_hex_check
    CHECK (subject_binding_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT export_download_token_hash_hex_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.privacy_retention_work
  ADD CONSTRAINT privacy_retention_subject_hash_hex_check
    CHECK (subject_binding_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT privacy_retention_purge_digest_hex_check
    CHECK (purge_record_digest IS NULL OR purge_record_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.purge_ledger_receipt
  ADD CONSTRAINT purge_ledger_record_digest_hex_check
    CHECK (record_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT purge_ledger_primary_version_hex_check
    CHECK (primary_object_version_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT purge_ledger_replica_version_hex_check
    CHECK (replica_object_version_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_privacy_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'privacy evidence is append-only';
END;
$$;

CREATE TRIGGER privacy_consent_event_append_only
BEFORE UPDATE OR DELETE ON onetime.privacy_consent_event
FOR EACH ROW EXECUTE FUNCTION onetime.reject_privacy_append_only_mutation();
CREATE TRIGGER recording_snapshot_append_only
BEFORE UPDATE OR DELETE ON onetime.recording_participant_snapshot
FOR EACH ROW EXECUTE FUNCTION onetime.reject_privacy_append_only_mutation();
CREATE TRIGGER purge_ledger_receipt_append_only
BEFORE UPDATE OR DELETE ON onetime.purge_ledger_receipt
FOR EACH ROW EXECUTE FUNCTION onetime.reject_privacy_append_only_mutation();
-- @postgres-only-end
