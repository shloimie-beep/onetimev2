CREATE TABLE onetime.content_ingest_upload_sessions (
  upload_session_key text NOT NULL CHECK (upload_session_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  session_state text NOT NULL CHECK (session_state IN (
    'initiated', 'uploading', 'completing', 'acceptance_unknown',
    'confirmed', 'aborted', 'failed', 'dead_lettered'
  )),
  declared_byte_count bigint NOT NULL CHECK (declared_byte_count BETWEEN 1 AND 5368709120),
  expires_at timestamptz NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, upload_session_key),
  UNIQUE (account_key, product_key, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK ((record_json ->> 'runtimeTier') IN ('isolated_staging', 'production')),
  CHECK ((record_json ->> 'verificationEnvironmentId') <> '')
);

CREATE TABLE onetime.content_ingest_upload_parts (
  account_key text NOT NULL,
  product_key text NOT NULL,
  upload_session_key text NOT NULL,
  part_number integer NOT NULL CHECK (part_number > 0),
  byte_offset bigint NOT NULL CHECK (byte_offset >= 0),
  byte_count bigint NOT NULL CHECK (byte_count BETWEEN 1 AND 67108864),
  part_sha256 text NOT NULL,
  provider_part_ref_digest text NOT NULL,
  record_json jsonb NOT NULL,
  PRIMARY KEY (account_key, product_key, upload_session_key, part_number),
  FOREIGN KEY (account_key, product_key, upload_session_key)
    REFERENCES onetime.content_ingest_upload_sessions(
      account_key,
      product_key,
      upload_session_key
    ) ON DELETE RESTRICT,
  CHECK (length(part_sha256) = 64 AND part_sha256 = lower(part_sha256)),
  CHECK (
    length(provider_part_ref_digest) = 64
    AND provider_part_ref_digest = lower(provider_part_ref_digest)
  )
);

CREATE TABLE onetime.content_sources_v21 (
  source_key text NOT NULL CHECK (source_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  source_sha256 text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('app_upload', 'drive')),
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN (
    'received', 'validating', 'processing', 'needs_review', 'approved',
    'publishing', 'published', 'failed', 'archived'
  )),
  object_version_id text NOT NULL CHECK (object_version_id <> ''),
  byte_count bigint NOT NULL CHECK (byte_count BETWEEN 1 AND 5368709120),
  original_preserved boolean NOT NULL DEFAULT true CHECK (original_preserved = true),
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, source_key),
  UNIQUE (account_key, product_key, source_sha256),
  CHECK (length(source_sha256) = 64 AND source_sha256 = lower(source_sha256)),
  CHECK ((record_json ->> 'captureMethod') = 'obs'),
  CHECK ((record_json ->> 'runtimeTier') IN ('isolated_staging', 'production')),
  CHECK ((record_json ->> 'verificationEnvironmentId') <> ''),
  CHECK ((record_json ->> 'checksumReadbackReceiptId') <> ''),
  CHECK ((record_json ->> 'originalPreserved') = 'true')
);

CREATE TABLE onetime.content_source_links_v21 (
  source_link_key text NOT NULL CHECK (source_link_key <> ''),
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_key text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('app_upload', 'drive')),
  provenance_ref_digest text NOT NULL,
  provider_change_marker text,
  record_json jsonb NOT NULL,
  PRIMARY KEY (account_key, product_key, source_link_key),
  FOREIGN KEY (account_key, product_key, source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  CHECK (
    length(provenance_ref_digest) = 64
    AND provenance_ref_digest = lower(provenance_ref_digest)
  )
);

CREATE TABLE onetime.content_drive_observations (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  drive_file_ref_digest text NOT NULL,
  parent_folder_ref_digest text NOT NULL,
  drive_state text NOT NULL CHECK (drive_state IN (
    'observing', 'stable', 'transferring', 'needs_review', 'quarantined',
    'processed', 'provider_off', 'retry_wait', 'dead_lettered'
  )),
  change_marker text NOT NULL CHECK (change_marker <> ''),
  byte_count bigint NOT NULL CHECK (byte_count > 0),
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, drive_file_ref_digest),
  CHECK (
    length(drive_file_ref_digest) = 64
    AND drive_file_ref_digest = lower(drive_file_ref_digest)
  ),
  CHECK (
    length(parent_folder_ref_digest) = 64
    AND parent_folder_ref_digest = lower(parent_folder_ref_digest)
  )
);

CREATE TABLE onetime.content_ingest_commands (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  operation text NOT NULL CHECK (operation <> ''),
  result_ref text NOT NULL CHECK (result_ref <> ''),
  result_version bigint NOT NULL CHECK (result_version > 0),
  record_json jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE INDEX content_ingest_upload_session_state_idx
  ON onetime.content_ingest_upload_sessions(
    account_key,
    product_key,
    session_state,
    expires_at
  );

CREATE INDEX content_sources_lifecycle_idx
  ON onetime.content_sources_v21(
    account_key,
    product_key,
    lifecycle_state,
    updated_at
  );

CREATE INDEX content_drive_observation_state_idx
  ON onetime.content_drive_observations(
    account_key,
    product_key,
    drive_state,
    updated_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.content_ingest_upload_sessions
  ADD CONSTRAINT content_ingest_session_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_ingest_upload_parts
  ADD CONSTRAINT content_ingest_part_sha_hex_check
    CHECK (part_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_ingest_part_provider_ref_hex_check
    CHECK (provider_part_ref_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_sources_v21
  ADD CONSTRAINT content_source_sha_hex_check
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_source_links_v21
  ADD CONSTRAINT content_source_link_ref_hex_check
    CHECK (provenance_ref_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_drive_observations
  ADD CONSTRAINT content_drive_file_ref_hex_check
    CHECK (drive_file_ref_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_drive_parent_ref_hex_check
    CHECK (parent_folder_ref_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_ingest_commands
  ADD CONSTRAINT content_ingest_command_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_content_ingest_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'content ingest evidence is append-only';
END;
$$;

CREATE TRIGGER content_ingest_parts_append_only
BEFORE UPDATE OR DELETE ON onetime.content_ingest_upload_parts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_ingest_immutable_mutation();

CREATE TRIGGER content_source_links_append_only
BEFORE UPDATE OR DELETE ON onetime.content_source_links_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_ingest_immutable_mutation();

CREATE TRIGGER content_ingest_commands_append_only
BEFORE UPDATE OR DELETE ON onetime.content_ingest_commands
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_ingest_immutable_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_content_ingest_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'content ingest optimistic version conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_ingest_sessions_version_step
BEFORE UPDATE ON onetime.content_ingest_upload_sessions
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_ingest_version_step();

CREATE TRIGGER content_sources_version_step
BEFORE UPDATE ON onetime.content_sources_v21
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_ingest_version_step();

CREATE TRIGGER content_drive_observations_version_step
BEFORE UPDATE ON onetime.content_drive_observations
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_ingest_version_step();
-- @postgres-only-end
