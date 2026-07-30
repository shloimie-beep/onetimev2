CREATE TABLE onetime.content_processing_versions (
  content_version_key text NOT NULL CHECK (content_version_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  source_key text NOT NULL,
  source_sha256 text NOT NULL,
  source_object_version_id text NOT NULL CHECK (source_object_version_id <> ''),
  processing_state text NOT NULL CHECK (processing_state IN (
    'validating', 'transcoding', 'transcribing', 'drafting',
    'needs_review', 'approved', 'failed', 'dead_lettered'
  )),
  retry_state text NOT NULL CHECK (retry_state IN ('ready', 'retry_wait', 'dead_lettered')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 8),
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, content_version_key),
  FOREIGN KEY (account_key, product_key, source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  CHECK (length(source_sha256) = 64 AND source_sha256 = lower(source_sha256)),
  CHECK ((record_json ->> 'runtimeTier') IN ('isolated_staging', 'production'))
);

CREATE TABLE onetime.content_processing_artifacts (
  artifact_key text NOT NULL CHECK (artifact_key <> ''),
  account_key text NOT NULL,
  product_key text NOT NULL,
  content_version_key text NOT NULL,
  artifact_kind text NOT NULL CHECK (artifact_kind IN (
    'trim', 'compressed_video', 'transcript', 'captions',
    'review_material', 'worksheet', 'knowledge_artifact'
  )),
  artifact_revision bigint NOT NULL CHECK (artifact_revision > 0),
  source_key text NOT NULL,
  source_sha256 text NOT NULL,
  source_object_version_id text NOT NULL CHECK (source_object_version_id <> ''),
  artifact_status text NOT NULL DEFAULT 'draft' CHECK (artifact_status IN ('draft', 'approved')),
  payload_digest text NOT NULL,
  record_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, artifact_key),
  UNIQUE (
    account_key,
    product_key,
    content_version_key,
    artifact_kind,
    artifact_revision
  ),
  FOREIGN KEY (account_key, product_key, content_version_key)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  CHECK (length(source_sha256) = 64 AND source_sha256 = lower(source_sha256)),
  CHECK (length(payload_digest) = 64 AND payload_digest = lower(payload_digest))
);

CREATE TABLE onetime.content_processing_commands (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('process_source', 'edit_artifact', 'approve_version')),
  result_ref text NOT NULL CHECK (result_ref <> ''),
  result_version bigint NOT NULL CHECK (result_version > 0),
  record_json jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE TABLE onetime.content_processing_capture_evidence (
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_key text NOT NULL,
  evidence_version text NOT NULL CHECK (evidence_version = 'OT-OBS-CAPTURE-1'),
  participant_snapshot_digest text NOT NULL,
  checksum_readback_receipt_key text NOT NULL CHECK (checksum_readback_receipt_key <> ''),
  linked_ingest_source_key text NOT NULL,
  record_json jsonb NOT NULL,
  captured_at timestamptz NOT NULL,
  upload_confirmed_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, source_key),
  FOREIGN KEY (account_key, product_key, source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, linked_ingest_source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  CHECK (
    length(participant_snapshot_digest) = 64
    AND participant_snapshot_digest = lower(participant_snapshot_digest)
  ),
  CHECK (upload_confirmed_at >= captured_at),
  CHECK ((record_json ->> 'captureMethod') = 'obs'),
  CHECK ((record_json ->> 'zoomCloudRecordingDisabled') = 'true'),
  CHECK ((record_json ->> 'controlledEncryptedDevice') = 'true')
);

CREATE INDEX content_processing_state_idx
  ON onetime.content_processing_versions(
    account_key,
    product_key,
    processing_state,
    retry_state,
    updated_at
  );

CREATE INDEX content_processing_artifact_version_idx
  ON onetime.content_processing_artifacts(
    account_key,
    product_key,
    content_version_key,
    artifact_status,
    artifact_kind,
    artifact_revision
  );

-- @postgres-only-begin
ALTER TABLE onetime.content_processing_versions
  ADD CONSTRAINT content_processing_source_sha_hex_check
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_processing_artifacts
  ADD CONSTRAINT content_processing_artifact_source_sha_hex_check
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_processing_payload_digest_hex_check
    CHECK (payload_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_processing_commands
  ADD CONSTRAINT content_processing_command_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_processing_capture_evidence
  ADD CONSTRAINT content_processing_participant_digest_hex_check
    CHECK (participant_snapshot_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_content_processing_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'content processing evidence is append-only';
END;
$$;

CREATE TRIGGER content_processing_artifacts_append_only
BEFORE UPDATE OR DELETE ON onetime.content_processing_artifacts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_processing_immutable_mutation();

CREATE TRIGGER content_processing_commands_append_only
BEFORE UPDATE OR DELETE ON onetime.content_processing_commands
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_processing_immutable_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_content_processing_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'content processing optimistic version conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_processing_versions_version_step
BEFORE UPDATE ON onetime.content_processing_versions
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_processing_version_step();
-- @postgres-only-end
