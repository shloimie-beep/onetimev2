CREATE TABLE onetime.content_publications (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  content_version_digest text NOT NULL,
  approval_projection_digest text,
  approval_projection_json jsonb,
  version bigint NOT NULL CHECK (version > 0),
  state text NOT NULL CHECK (state IN (
    'received', 'validating', 'processing', 'needs_review', 'approved',
    'publishing', 'published', 'failed', 'archived'
  )),
  publication_generation bigint NOT NULL DEFAULT 0
    CHECK (publication_generation >= 0),
  playback_grant_generation bigint NOT NULL DEFAULT 0
    CHECK (playback_grant_generation >= 0),
  pending_provider_operation_id text,
  pending_provider_request_hash text,
  occurred_at timestamptz NOT NULL,
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, content_id),
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  FOREIGN KEY (pending_provider_operation_id)
    REFERENCES onetime.provider_operation_binding(job_id) ON DELETE RESTRICT,
  CHECK (
    length(content_version_digest) = 64
    AND content_version_digest = lower(content_version_digest)
  ),
  CHECK (
    approval_projection_digest IS NULL
    OR (
      length(approval_projection_digest) = 64
      AND approval_projection_digest = lower(approval_projection_digest)
    )
  ),
  CHECK (
    pending_provider_request_hash IS NULL
    OR (
      length(pending_provider_request_hash) = 64
      AND pending_provider_request_hash = lower(pending_provider_request_hash)
    )
  ),
  CHECK (
    (state IN ('approved', 'publishing', 'published')
      AND approval_projection_digest IS NOT NULL
      AND approval_projection_json IS NOT NULL)
    OR state NOT IN ('approved', 'publishing', 'published')
  )
);

CREATE TABLE onetime.content_publication_receipts (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  operation text NOT NULL CHECK (operation IN (
    'approve', 'request_publish', 'record_published', 'record_revoked',
    'attach_occurrence', 'unpublish', 'archive', 'save_resume'
  )),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation >= 0),
  approval_projection_digest text NOT NULL,
  receipt_json jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key,
    product_key,
    operation,
    idempotency_key
  ),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE TABLE onetime.content_publication_outbox (
  intent_id text NOT NULL CHECK (intent_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  provider_operation_id text NOT NULL CHECK (provider_operation_id <> ''),
  provider text NOT NULL CHECK (provider = 'vimeo'),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL,
  approval_projection_json jsonb NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'publish_private', 'revoke_private'
  )),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'complete', 'canceled')),
  intent_json jsonb NOT NULL,
  provider_readback_digest text,
  provider_resource_ref_hash text,
  one_time_readback_digest text,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (account_key, product_key, intent_id),
  UNIQUE (account_key, product_key, operation, idempotency_key),
  FOREIGN KEY (provider_operation_id)
    REFERENCES onetime.provider_operation_binding(job_id) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  ),
  CHECK (
    provider_readback_digest IS NULL
    OR (
      length(provider_readback_digest) = 64
      AND provider_readback_digest = lower(provider_readback_digest)
    )
  ),
  CHECK (
    one_time_readback_digest IS NULL
    OR (
      length(one_time_readback_digest) = 64
      AND one_time_readback_digest = lower(one_time_readback_digest)
    )
  ),
  CHECK (
    provider_resource_ref_hash IS NULL
    OR (
      length(provider_resource_ref_hash) = 64
      AND provider_resource_ref_hash = lower(provider_resource_ref_hash)
    )
  ),
  CHECK (
    (state = 'complete'
      AND provider_readback_digest IS NOT NULL
      AND provider_resource_ref_hash IS NOT NULL
      AND one_time_readback_digest IS NOT NULL
      AND completed_at IS NOT NULL)
    OR
    (state <> 'complete'
      AND provider_readback_digest IS NULL
      AND provider_resource_ref_hash IS NULL
      AND one_time_readback_digest IS NULL
      AND completed_at IS NULL)
  )
);

CREATE TABLE onetime.governed_content_occurrences (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  occurrence_version bigint NOT NULL CHECK (occurrence_version > 0),
  canonical_series_id text NOT NULL CHECK (canonical_series_id <> ''),
  governance_state text NOT NULL CHECK (governance_state = 'governed'),
  active boolean NOT NULL DEFAULT true,
  relation_json jsonb NOT NULL,
  attached_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, occurrence_id),
  FOREIGN KEY (occurrence_id)
    REFERENCES onetime.class_occurrences(occurrence_key) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, canonical_series_id)
    REFERENCES onetime.class_series(
      account_key,
      product_key,
      class_series_key
    ) ON DELETE RESTRICT
);

CREATE TABLE onetime.student_content_publication_eligibility (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL,
  eligibility_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key,
    product_key,
    student_id,
    content_id,
    occurrence_id
  ),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, occurrence_id)
    REFERENCES onetime.governed_content_occurrences(
      account_key,
      product_key,
      occurrence_id
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE TABLE onetime.student_content_assignments (
  assignment_id text NOT NULL CHECK (assignment_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL,
  approval_projection_json jsonb NOT NULL,
  assignment_version bigint NOT NULL CHECK (assignment_version > 0),
  student_version bigint NOT NULL CHECK (student_version > 0),
  enrollment_version bigint NOT NULL CHECK (enrollment_version > 0),
  access_version bigint NOT NULL CHECK (access_version > 0),
  service_consent_version bigint NOT NULL CHECK (service_consent_version > 0),
  privacy_version bigint NOT NULL CHECK (privacy_version > 0),
  revocation_version bigint NOT NULL CHECK (revocation_version > 0),
  active boolean NOT NULL,
  revoked_at timestamptz,
  assignment_json jsonb NOT NULL,
  PRIMARY KEY (account_key, product_key, assignment_id),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, occurrence_id)
    REFERENCES onetime.governed_content_occurrences(
      account_key,
      product_key,
      occurrence_id
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  ),
  CHECK ((active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);

CREATE TABLE onetime.student_library_projections (
  projection_id text NOT NULL CHECK (projection_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  assignment_id text NOT NULL CHECK (assignment_id <> ''),
  assignment_version bigint NOT NULL CHECK (assignment_version > 0),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL,
  approval_projection_json jsonb NOT NULL,
  active boolean NOT NULL,
  projection_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, projection_id),
  FOREIGN KEY (account_key, product_key, assignment_id)
    REFERENCES onetime.student_content_assignments(
      account_key,
      product_key,
      assignment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE TABLE onetime.protected_recording_notices (
  notice_id text NOT NULL CHECK (notice_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('student', 'adult')),
  recipient_id text NOT NULL CHECK (recipient_id <> ''),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  source_version bigint NOT NULL CHECK (source_version > 0),
  approval_projection_digest text NOT NULL,
  delivery_state text NOT NULL CHECK (delivery_state IN (
    'pending', 'sent', 'suppressed', 'failed'
  )),
  notice_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, notice_id),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE TABLE onetime.student_content_playback_facts (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  assignment_id text NOT NULL CHECK (assignment_id <> ''),
  assignment_version bigint NOT NULL CHECK (assignment_version > 0),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL,
  facts_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, student_id, content_id),
  FOREIGN KEY (account_key, product_key, assignment_id)
    REFERENCES onetime.student_content_assignments(
      account_key,
      product_key,
      assignment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE TABLE onetime.student_content_resume (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_version bigint NOT NULL CHECK (publication_version > 0),
  position_ms bigint NOT NULL CHECK (position_ms >= 0),
  version bigint NOT NULL CHECK (version > 0),
  approval_projection_digest text NOT NULL,
  resume_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, student_id, content_id),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(
      account_key,
      product_key,
      content_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_version_id)
    REFERENCES onetime.content_processing_versions(
      account_key,
      product_key,
      content_version_key
    ) ON DELETE RESTRICT,
  CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  )
);

CREATE UNIQUE INDEX student_content_assignment_active_idx
  ON onetime.student_content_assignments(
    account_key,
    product_key,
    student_id,
    content_id
  )
  WHERE active = true;

CREATE UNIQUE INDEX student_library_projection_active_idx
  ON onetime.student_library_projections(
    account_key,
    product_key,
    student_id,
    content_id
  )
  WHERE active = true;

CREATE INDEX content_publication_state_idx
  ON onetime.content_publications(
    account_key,
    product_key,
    state,
    occurred_at DESC,
    content_id
  );

CREATE INDEX content_publication_outbox_pending_idx
  ON onetime.content_publication_outbox(
    account_key,
    product_key,
    state,
    created_at
  );

CREATE INDEX protected_recording_notice_delivery_idx
  ON onetime.protected_recording_notices(
    account_key,
    product_key,
    delivery_state,
    created_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.content_publications
  ADD CONSTRAINT content_publication_version_digest_hex_check
    CHECK (content_version_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_publication_approval_digest_hex_check
    CHECK (
      approval_projection_digest IS NULL
      OR approval_projection_digest ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT content_publication_pending_hash_hex_check
    CHECK (
      pending_provider_request_hash IS NULL
      OR pending_provider_request_hash ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE onetime.content_publication_receipts
  ADD CONSTRAINT content_publication_receipt_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_publication_receipt_approval_hex_check
    CHECK (approval_projection_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.content_publication_outbox
  ADD CONSTRAINT content_publication_outbox_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_publication_outbox_approval_hex_check
    CHECK (approval_projection_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT content_publication_outbox_provider_readback_hex_check
    CHECK (
      provider_readback_digest IS NULL
      OR provider_readback_digest ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT content_publication_outbox_provider_resource_hex_check
    CHECK (
      provider_resource_ref_hash IS NULL
      OR provider_resource_ref_hash ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT content_publication_outbox_local_readback_hex_check
    CHECK (
      one_time_readback_digest IS NULL
      OR one_time_readback_digest ~ '^[0-9a-f]{64}$'
    );

CREATE OR REPLACE FUNCTION onetime.validate_governed_content_occurrence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_projection jsonb;
  expected_attached_at timestamptz;
  expected_active boolean;
BEGIN
  SELECT jsonb_build_object(
           'accountKey', occurrence.account_key,
           'productKey', occurrence.product_key,
           'occurrenceId', occurrence.occurrence_key,
           'occurrenceVersion', occurrence.version,
           'canonicalSeriesId', series.class_series_key,
           'canonicalSeriesVersion', series.version,
           'occurrenceState', occurrence.occurrence_state,
           'seriesState', series.series_state,
           'isCanonical', series.is_canonical
         ),
         GREATEST(occurrence.updated_at, series.updated_at),
         series.series_state <> 'archived'
           AND occurrence.occurrence_state <> 'canceled'
    INTO expected_projection, expected_attached_at, expected_active
    FROM onetime.class_occurrences AS occurrence
    JOIN onetime.class_series AS series
      ON series.account_key = occurrence.account_key
     AND series.product_key = occurrence.product_key
     AND series.class_series_key = occurrence.class_series_key
   WHERE occurrence.account_key = NEW.account_key
     AND occurrence.product_key = NEW.product_key
     AND occurrence.occurrence_key = NEW.occurrence_id
     AND occurrence.version = NEW.occurrence_version
     AND series.class_series_key = NEW.canonical_series_id
     AND series.is_canonical = TRUE;
  IF expected_projection IS NULL
     OR NEW.governance_state <> 'governed'
     OR NEW.relation_json IS DISTINCT FROM expected_projection
     OR NEW.attached_at IS DISTINCT FROM expected_attached_at
     OR NEW.active IS DISTINCT FROM expected_active
     OR (
       TG_OP = 'UPDATE'
       AND NEW.occurrence_version < OLD.occurrence_version
     ) THEN
    RAISE EXCEPTION 'invalid governed content occurrence projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER governed_content_occurrence_guard
BEFORE INSERT OR UPDATE ON onetime.governed_content_occurrences
FOR EACH ROW EXECUTE FUNCTION onetime.validate_governed_content_occurrence();

CREATE OR REPLACE FUNCTION onetime.approved_publication_projection_digest(
  evidence jsonb
)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(
    sha256(
      convert_to(
        '{"accountKey":' || to_jsonb(evidence ->> 'accountKey')::text ||
        ',"productKey":' || to_jsonb(evidence ->> 'productKey')::text ||
        ',"contentVersionId":' ||
          to_jsonb(evidence ->> 'contentVersionId')::text ||
        ',"sourceId":' || to_jsonb(evidence ->> 'sourceId')::text ||
        ',"sourceSha256":' || to_jsonb(evidence ->> 'sourceSha256')::text ||
        ',"sourceObjectVersionId":' ||
          to_jsonb(evidence ->> 'sourceObjectVersionId')::text ||
        ',"participantSnapshotDigest":' ||
          to_jsonb(evidence ->> 'participantSnapshotDigest')::text ||
        ',"approvedByAdminId":' ||
          to_jsonb(evidence ->> 'approvedByAdminId')::text ||
        ',"approvedAt":' || to_jsonb(evidence ->> 'approvedAt')::text ||
        ',"artifacts":[' ||
          COALESCE(
            (
              SELECT string_agg(
                '{"artifactId":' ||
                  to_jsonb(artifact.value ->> 'artifactId')::text ||
                ',"kind":' || to_jsonb(artifact.value ->> 'kind')::text ||
                ',"revision":' || (artifact.value ->> 'revision') ||
                ',"payloadDigest":' ||
                  to_jsonb(artifact.value ->> 'payloadDigest')::text ||
                '}',
                ','
                ORDER BY artifact.ordinality
              )
                FROM jsonb_array_elements(evidence -> 'artifacts')
                  WITH ORDINALITY AS artifact(value, ordinality)
            ),
            ''
          ) ||
        ']' ||
        ',"approvedArtifactSetDigest":' ||
          to_jsonb(evidence ->> 'approvedArtifactSetDigest')::text ||
        ',"sourceEvidenceDigest":' ||
          to_jsonb(evidence ->> 'sourceEvidenceDigest')::text ||
        '}',
        'UTF8'
      )
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION onetime.valid_approved_publication_projection(
  evidence jsonb,
  expected_account_key text,
  expected_product_key text,
  expected_content_version_id text
)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  artifact jsonb;
  current_artifact_kind text;
  seen_kinds text[] := ARRAY[]::text[];
  approved_at timestamptz;
BEGIN
  IF evidence IS NULL
     OR jsonb_typeof(evidence) <> 'object'
     OR (
       SELECT count(*) FROM jsonb_object_keys(evidence)
     ) <> 13
     OR evidence ->> 'accountKey' IS DISTINCT FROM expected_account_key
     OR evidence ->> 'productKey' IS DISTINCT FROM expected_product_key
     OR evidence ->> 'contentVersionId'
       IS DISTINCT FROM expected_content_version_id
     OR COALESCE(btrim(evidence ->> 'sourceId'), '') = ''
     OR COALESCE(evidence ->> 'sourceSha256', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'sourceObjectVersionId'), '') = ''
     OR COALESCE(evidence ->> 'participantSnapshotDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'approvedByAdminId'), '') = ''
     OR COALESCE(evidence ->> 'approvedArtifactSetDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'sourceEvidenceDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'projectionDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(evidence -> 'artifacts') <> 'array'
     OR jsonb_array_length(evidence -> 'artifacts') <> 7 THEN
    RETURN false;
  END IF;
  BEGIN
    approved_at := (evidence ->> 'approvedAt')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  FOR artifact IN SELECT value FROM jsonb_array_elements(evidence -> 'artifacts')
  LOOP
    current_artifact_kind := artifact ->> 'kind';
    IF jsonb_typeof(artifact) <> 'object'
       OR (
         SELECT count(*) FROM jsonb_object_keys(artifact)
       ) <> 4
       OR COALESCE(btrim(artifact ->> 'artifactId'), '') = ''
       OR COALESCE(current_artifact_kind, '') NOT IN (
         'trim', 'compressed_video', 'transcript', 'captions',
         'review_material', 'worksheet', 'knowledge_artifact'
       )
       OR current_artifact_kind = ANY(seen_kinds)
       OR COALESCE(artifact ->> 'revision', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(artifact ->> 'payloadDigest', '') !~ '^[0-9a-f]{64}$'
       OR NOT EXISTS (
         SELECT 1
           FROM onetime.content_processing_artifacts AS persisted
          WHERE persisted.account_key = expected_account_key
            AND persisted.product_key = expected_product_key
            AND persisted.content_version_key = expected_content_version_id
            AND persisted.artifact_key = artifact ->> 'artifactId'
            AND persisted.artifact_kind = current_artifact_kind
            AND persisted.artifact_revision =
              (artifact ->> 'revision')::bigint
            AND persisted.payload_digest = artifact ->> 'payloadDigest'
            AND persisted.artifact_status = 'approved'
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.content_processing_artifacts AS newer
               WHERE newer.account_key = persisted.account_key
                 AND newer.product_key = persisted.product_key
                 AND newer.content_version_key = persisted.content_version_key
                 AND newer.artifact_kind = persisted.artifact_kind
                 AND newer.artifact_revision > persisted.artifact_revision
            )
       ) THEN
      RETURN false;
    END IF;
    seen_kinds := array_append(seen_kinds, current_artifact_kind);
  END LOOP;
  IF seen_kinds <> ARRAY[
       'captions', 'compressed_video', 'knowledge_artifact',
       'review_material', 'transcript', 'trim', 'worksheet'
     ]::text[]
     OR evidence ->> 'projectionDigest' IS DISTINCT FROM
       onetime.approved_publication_projection_digest(evidence) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
      FROM onetime.content_processing_versions AS version_row
      JOIN onetime.content_sources_v21 AS source_row
        ON source_row.account_key = version_row.account_key
       AND source_row.product_key = version_row.product_key
       AND source_row.source_key = version_row.source_key
       AND source_row.source_sha256 = version_row.source_sha256
       AND source_row.object_version_id = version_row.source_object_version_id
      JOIN onetime.content_processing_capture_evidence AS capture_row
        ON capture_row.account_key = version_row.account_key
       AND capture_row.product_key = version_row.product_key
       AND capture_row.source_key = version_row.source_key
       AND capture_row.linked_ingest_source_key = version_row.source_key
     WHERE version_row.account_key = expected_account_key
       AND version_row.product_key = expected_product_key
       AND version_row.content_version_key = expected_content_version_id
       AND version_row.processing_state = 'approved'
       AND version_row.source_key = evidence ->> 'sourceId'
       AND version_row.source_sha256 = evidence ->> 'sourceSha256'
       AND version_row.source_object_version_id =
         evidence ->> 'sourceObjectVersionId'
       AND capture_row.participant_snapshot_digest =
         evidence ->> 'participantSnapshotDigest'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'participantSnapshotDigest' =
           evidence ->> 'participantSnapshotDigest'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'approvedByAdminId' = evidence ->> 'approvedByAdminId'
       AND (
         version_row.record_json -> 'publicationApproval' ->> 'approvedAt'
       )::timestamptz = approved_at
       AND version_row.record_json -> 'publicationApproval'
         ->> 'approvedArtifactSetDigest' =
           evidence ->> 'approvedArtifactSetDigest'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'sourceEvidenceDigest' = evidence ->> 'sourceEvidenceDigest'
  );
END;
$$;

CREATE OR REPLACE FUNCTION onetime.matches_content_provider_operation(
  expected_product_key text,
  expected_provider_operation_id text,
  expected_operation text,
  expected_content_id text,
  expected_content_version_id text,
  expected_publication_generation bigint,
  expected_idempotency_key text,
  expected_request_hash text,
  expected_payload_digest text,
  expected_state text
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM onetime.job_outbox AS job
      JOIN onetime.provider_operation_binding AS binding
        ON binding.job_id = job.job_id
     WHERE job.job_id = expected_provider_operation_id
       AND job.product = expected_product_key
       AND job.provider = 'vimeo'
       AND job.operation_type = expected_operation
       AND job.aggregate_ref = expected_content_id
       AND job.payload_ref = expected_content_version_id
       AND job.source_version = expected_publication_generation
       AND (
         expected_idempotency_key IS NULL
         OR job.idempotency_key = expected_idempotency_key
       )
       AND job.canonical_request_hash = expected_request_hash
       AND job.payload_digest = expected_payload_digest
       AND job.compensation_for_job_id IS NULL
       AND job.state = expected_state
       AND job.unknown_effect = FALSE
       AND binding.effect_kind = 'mutation'
       AND binding.household_id IS NULL
       AND btrim(binding.registry_binding_key) <> ''
       AND binding.provider_account_ref_hash ~ '^[0-9a-f]{64}$'
  );
$$;

CREATE OR REPLACE FUNCTION onetime.matches_current_content_publication(
  expected_account_key text,
  expected_product_key text,
  expected_content_id text,
  expected_content_version_id text,
  expected_publication_generation bigint,
  expected_approval_projection_digest text
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM onetime.content_publications AS publication
     WHERE publication.account_key = expected_account_key
       AND publication.product_key = expected_product_key
       AND publication.content_id = expected_content_id
       AND publication.content_version_id = expected_content_version_id
       AND publication.publication_generation = expected_publication_generation
       AND publication.approval_projection_digest =
         expected_approval_projection_digest
  );
$$;

CREATE OR REPLACE FUNCTION onetime.matches_current_content_publication_evidence(
  expected_account_key text,
  expected_product_key text,
  expected_content_id text,
  expected_content_version_id text,
  expected_publication_generation bigint,
  expected_approval_projection_digest text,
  expected_approval_projection_json jsonb
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM onetime.content_publications AS publication
     WHERE publication.account_key = expected_account_key
       AND publication.product_key = expected_product_key
       AND publication.content_id = expected_content_id
       AND publication.content_version_id = expected_content_version_id
       AND publication.publication_generation = expected_publication_generation
       AND publication.approval_projection_digest =
         expected_approval_projection_digest
       AND publication.approval_projection_json =
         expected_approval_projection_json
  );
$$;

CREATE OR REPLACE FUNCTION onetime.bind_content_publication_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  evidence jsonb;
BEGIN
  IF NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.record_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.record_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR NEW.record_json ->> 'state' IS DISTINCT FROM NEW.state THEN
    RAISE EXCEPTION 'content publication record scope or version mismatch';
  END IF;
  evidence := NEW.record_json -> 'approval' -> 'evidence';
  NEW.approval_projection_json := evidence;
  NEW.approval_projection_digest := evidence ->> 'projectionDigest';
  NEW.content_version_id := NEW.record_json ->> 'contentVersionId';
  NEW.content_version_digest := NEW.record_json ->> 'contentVersionDigest';
  NEW.publication_generation := (
    NEW.record_json ->> 'publicationGeneration'
  )::bigint;
  NEW.playback_grant_generation := (
    NEW.record_json ->> 'playbackGrantGeneration'
  )::bigint;
  NEW.pending_provider_operation_id := NULLIF(
    NEW.record_json ->> 'pendingProviderOperationId',
    ''
  );
  NEW.pending_provider_request_hash := NULLIF(
    NEW.record_json ->> 'pendingProviderRequestHash',
    ''
  );
  NEW.occurred_at := (NEW.record_json ->> 'occurredAt')::timestamptz;
  IF COALESCE(NEW.content_version_id, '') = ''
     OR NEW.content_version_digest !~ '^[0-9a-f]{64}$'
     OR NEW.publication_generation < 0
     OR NEW.playback_grant_generation < 0
     OR (
       NEW.state IN ('approved', 'publishing', 'published')
       AND (
         jsonb_typeof(evidence) IS DISTINCT FROM 'object'
         OR evidence ->> 'accountKey' IS DISTINCT FROM NEW.account_key
         OR evidence ->> 'productKey' IS DISTINCT FROM NEW.product_key
         OR evidence ->> 'contentVersionId'
           IS DISTINCT FROM NEW.content_version_id
         OR COALESCE(evidence ->> 'projectionDigest', '')
           !~ '^[0-9a-f]{64}$'
         OR NOT onetime.valid_approved_publication_projection(
           evidence,
           NEW.account_key,
           NEW.product_key,
           NEW.content_version_id
         )
       )
     )
     OR (
       NEW.state = 'publishing'
       AND (
         NEW.pending_provider_operation_id IS NULL
         OR NEW.pending_provider_request_hash IS NULL
         OR NOT onetime.matches_content_provider_operation(
           NEW.product_key,
           NEW.pending_provider_operation_id,
           'publish_private',
           NEW.content_id,
           NEW.content_version_id,
           NEW.publication_generation,
           NULL,
           NEW.pending_provider_request_hash,
           NEW.approval_projection_digest,
           'not_started'
         )
       )
     )
     OR (
       NEW.state IN ('approved', 'archived')
       AND NEW.pending_provider_operation_id IS NOT NULL
       AND (
         NEW.pending_provider_request_hash IS NULL
         OR jsonb_typeof(evidence) IS DISTINCT FROM 'object'
         OR NOT onetime.valid_approved_publication_projection(
           evidence,
           NEW.account_key,
           NEW.product_key,
           NEW.content_version_id
         )
         OR NOT onetime.matches_content_provider_operation(
           NEW.product_key,
           NEW.pending_provider_operation_id,
           'revoke_private',
           NEW.content_id,
           NEW.content_version_id,
           NEW.publication_generation,
           NULL,
           NEW.pending_provider_request_hash,
           NEW.approval_projection_digest,
           'not_started'
         )
       )
     )
     OR (
       (NEW.pending_provider_operation_id IS NULL) <>
         (NEW.pending_provider_request_hash IS NULL)
     )
     OR (
       NEW.state NOT IN ('publishing', 'approved', 'archived')
       AND NEW.pending_provider_operation_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'invalid content publication projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_publication_projection_guard
BEFORE INSERT OR UPDATE ON onetime.content_publications
FOR EACH ROW EXECUTE FUNCTION onetime.bind_content_publication_projection();

CREATE OR REPLACE FUNCTION onetime.enforce_content_publication_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'content publication optimistic version conflict';
  END IF;
  IF NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.content_id IS DISTINCT FROM OLD.content_id
     OR NEW.content_version_id IS DISTINCT FROM OLD.content_version_id
     OR NEW.content_version_digest IS DISTINCT FROM OLD.content_version_digest
     OR (
       OLD.approval_projection_digest IS NOT NULL
       AND (
         NEW.approval_projection_digest
           IS DISTINCT FROM OLD.approval_projection_digest
         OR NEW.approval_projection_json
           IS DISTINCT FROM OLD.approval_projection_json
       )
     )
     OR NEW.publication_generation < OLD.publication_generation
     OR NEW.playback_grant_generation < OLD.playback_grant_generation THEN
    RAISE EXCEPTION 'content publication scope or approval evidence changed';
  END IF;
  transition_allowed := NEW.state = OLD.state
    OR CASE OLD.state
      WHEN 'received' THEN NEW.state IN ('validating', 'failed')
      WHEN 'validating' THEN NEW.state IN ('processing', 'needs_review', 'failed')
      WHEN 'processing' THEN NEW.state IN ('needs_review', 'failed')
      WHEN 'needs_review' THEN NEW.state IN ('approved', 'failed')
      WHEN 'approved' THEN NEW.state IN ('publishing', 'archived')
      WHEN 'publishing' THEN NEW.state IN ('published', 'failed', 'approved')
      WHEN 'published' THEN NEW.state IN ('approved', 'archived')
      WHEN 'failed' THEN NEW.state IN ('validating', 'processing', 'needs_review')
      ELSE false
    END;
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'illegal content publication state transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_publications_version_step
BEFORE UPDATE ON onetime.content_publications
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_publication_update();

CREATE OR REPLACE FUNCTION onetime.validate_content_publication_receipt()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_hash !~ '^[0-9a-f]{64}$'
     OR NEW.approval_projection_digest !~ '^[0-9a-f]{64}$'
     OR NEW.receipt_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.receipt_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.receipt_json ->> 'operation' IS DISTINCT FROM NEW.operation
     OR NEW.receipt_json ->> 'idempotencyKey'
       IS DISTINCT FROM NEW.idempotency_key
     OR NEW.receipt_json ->> 'requestHash' IS DISTINCT FROM NEW.request_hash
     OR NEW.receipt_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.receipt_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.receipt_json ->> 'publicationGeneration'
       IS DISTINCT FROM NEW.publication_generation::text
     OR NEW.receipt_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT onetime.matches_current_content_publication(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest
     ) THEN
    RAISE EXCEPTION 'invalid content publication receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_publication_receipt_guard
BEFORE INSERT ON onetime.content_publication_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.validate_content_publication_receipt();

CREATE OR REPLACE FUNCTION onetime.bind_content_publication_outbox()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.approval_projection_json := NEW.intent_json -> 'approvalEvidence';
  END IF;
  IF NEW.intent_json ->> 'intentId' IS DISTINCT FROM NEW.intent_id
     OR NEW.intent_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.intent_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.intent_json ->> 'providerOperationId'
       IS DISTINCT FROM NEW.provider_operation_id
     OR NEW.intent_json ->> 'provider' IS DISTINCT FROM NEW.provider
     OR NEW.intent_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.intent_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.intent_json ->> 'publicationGeneration'
       IS DISTINCT FROM NEW.publication_generation::text
     OR NEW.intent_json ->> 'operation' IS DISTINCT FROM NEW.operation
     OR NEW.intent_json ->> 'idempotencyKey'
       IS DISTINCT FROM NEW.idempotency_key
     OR NEW.intent_json ->> 'requestHash' IS DISTINCT FROM NEW.request_hash
     OR NEW.intent_json ->> 'state' IS DISTINCT FROM 'pending'
     OR NEW.approval_projection_json ->> 'projectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT onetime.valid_approved_publication_projection(
       NEW.approval_projection_json,
       NEW.account_key,
       NEW.product_key,
       NEW.content_version_id
     )
     OR NOT onetime.matches_current_content_publication_evidence(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest,
       NEW.approval_projection_json
     )
     OR NOT onetime.matches_content_provider_operation(
       NEW.product_key,
       NEW.provider_operation_id,
       NEW.operation,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.idempotency_key,
       NEW.request_hash,
       NEW.approval_projection_digest,
       CASE NEW.state
         WHEN 'pending' THEN 'not_started'
         WHEN 'complete' THEN 'complete'
         ELSE 'canceled'
       END
     )
     OR (
       NEW.state = 'complete'
       AND NOT EXISTS (
         SELECT 1
           FROM onetime.job_outbox AS job
           JOIN onetime.provider_operation_binding AS binding
             ON binding.job_id = job.job_id
           JOIN onetime.provider_readback_ledger AS readback
             ON readback.operation_id = job.job_id
            AND readback.operation_version = job.version
            AND readback.provider = job.provider
            AND readback.runtime_tier = job.runtime_tier
            AND readback.verification_environment_id =
              job.verification_environment_id
            AND readback.provider_account_ref_hash =
              binding.provider_account_ref_hash
            AND readback.reconciliation_digest =
              NEW.provider_readback_digest
            AND readback.provider_resource_ref_hash =
              NEW.provider_resource_ref_hash
            AND readback.product_key = job.product
          WHERE job.job_id = NEW.provider_operation_id
            AND job.state = 'complete'
            AND job.unknown_effect = FALSE
            AND readback.disposition = 'effect_exists'
       )
     ) THEN
    RAISE EXCEPTION 'invalid content publication outbox intent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_publication_outbox_guard
BEFORE INSERT OR UPDATE ON onetime.content_publication_outbox
FOR EACH ROW EXECUTE FUNCTION onetime.bind_content_publication_outbox();

CREATE OR REPLACE FUNCTION onetime.enforce_content_publication_outbox_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.intent_id IS DISTINCT FROM OLD.intent_id
     OR NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.provider_operation_id IS DISTINCT FROM OLD.provider_operation_id
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.content_id IS DISTINCT FROM OLD.content_id
     OR NEW.content_version_id IS DISTINCT FROM OLD.content_version_id
     OR NEW.publication_generation IS DISTINCT FROM OLD.publication_generation
     OR NEW.approval_projection_digest
       IS DISTINCT FROM OLD.approval_projection_digest
     OR NEW.approval_projection_json
       IS DISTINCT FROM OLD.approval_projection_json
     OR NEW.operation IS DISTINCT FROM OLD.operation
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR NEW.intent_json IS DISTINCT FROM OLD.intent_json
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'content publication outbox evidence is immutable';
  END IF;
  IF OLD.state <> 'pending'
     OR NEW.state NOT IN ('complete', 'canceled') THEN
    RAISE EXCEPTION 'illegal content publication outbox transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_publication_outbox_update_guard
BEFORE UPDATE ON onetime.content_publication_outbox
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_publication_outbox_update();

CREATE OR REPLACE FUNCTION onetime.bind_content_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.occurrence_id := NEW.assignment_json ->> 'occurrenceId';
  NEW.student_version := (NEW.assignment_json ->> 'studentVersion')::bigint;
  NEW.enrollment_version := (NEW.assignment_json ->> 'enrollmentVersion')::bigint;
  NEW.access_version := (NEW.assignment_json ->> 'accessVersion')::bigint;
  NEW.service_consent_version := (
    NEW.assignment_json ->> 'serviceAccountConsentVersion'
  )::bigint;
  NEW.privacy_version := (NEW.assignment_json ->> 'privacyVersion')::bigint;
  NEW.revocation_version := (
    NEW.assignment_json ->> 'revocationVersion'
  )::bigint;
  NEW.revoked_at := (
    NULLIF(NEW.assignment_json ->> 'revokedAt', '')
  )::timestamptz;
  NEW.approval_projection_json := NEW.assignment_json -> 'approvalEvidence';
  IF NEW.assignment_json ->> 'assignmentId' IS DISTINCT FROM NEW.assignment_id
     OR NEW.assignment_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.assignment_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.assignment_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.assignment_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.assignment_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.assignment_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.assignment_json ->> 'publicationGeneration'
       IS DISTINCT FROM NEW.publication_generation::text
     OR NEW.assignment_json ->> 'assignmentVersion'
       IS DISTINCT FROM NEW.assignment_version::text
     OR NEW.assignment_json ->> 'active' IS DISTINCT FROM lower(NEW.active::text)
     OR NEW.approval_projection_json ->> 'projectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT onetime.valid_approved_publication_projection(
       NEW.approval_projection_json,
       NEW.account_key,
       NEW.product_key,
       NEW.content_version_id
     )
     OR NOT onetime.matches_current_content_publication_evidence(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest,
       NEW.approval_projection_json
     )
     OR (
       NEW.active = TRUE
       AND NOT EXISTS (
         SELECT 1
           FROM onetime.student_content_publication_eligibility AS eligibility
          WHERE eligibility.account_key = NEW.account_key
            AND eligibility.product_key = NEW.product_key
            AND eligibility.student_id = NEW.student_id
            AND eligibility.household_id = NEW.household_id
            AND eligibility.content_id = NEW.content_id
            AND eligibility.content_version_id = NEW.content_version_id
            AND eligibility.occurrence_id = NEW.occurrence_id
            AND eligibility.publication_generation = NEW.publication_generation
            AND eligibility.approval_projection_digest =
              NEW.approval_projection_digest
            AND eligibility.eligibility_json ->> 'studentVersion' =
              NEW.student_version::text
            AND eligibility.eligibility_json ->> 'enrollmentVersion' =
              NEW.enrollment_version::text
            AND eligibility.eligibility_json ->> 'accessVersion' =
              NEW.access_version::text
            AND eligibility.eligibility_json
              ->> 'serviceAccountConsentVersion' =
                NEW.service_consent_version::text
            AND eligibility.eligibility_json ->> 'privacyVersion' =
              NEW.privacy_version::text
            AND eligibility.eligibility_json ->> 'revocationVersion' =
              NEW.revocation_version::text
            AND eligibility.eligibility_json ->> 'studentActive' = 'true'
            AND eligibility.eligibility_json ->> 'enrollmentActive' = 'true'
            AND eligibility.eligibility_json ->> 'accessState'
              IN ('active', 'grace')
            AND eligibility.eligibility_json
              ->> 'serviceAccountAccepted' = 'true'
            AND eligibility.eligibility_json ->> 'privacyReviewState' = 'clear'
            AND eligibility.eligibility_json ->> 'studentRevoked' = 'false'
            AND eligibility.eligibility_json ->> 'accountRevoked' = 'false'
            AND eligibility.eligibility_json ->> 'contentRevoked' = 'false'
            AND eligibility.eligibility_json
              ->> 'adultRecipientActive' = 'true'
       )
     ) THEN
    RAISE EXCEPTION 'invalid Student content assignment';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_content_assignment_guard
BEFORE INSERT OR UPDATE ON onetime.student_content_assignments
FOR EACH ROW EXECUTE FUNCTION onetime.bind_content_assignment();

CREATE OR REPLACE FUNCTION onetime.bind_student_library_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.assignment_version := (
    NEW.projection_json ->> 'assignmentVersion'
  )::bigint;
  NEW.approval_projection_json := NEW.projection_json -> 'approvalEvidence';
  IF NEW.projection_json ->> 'projectionId' IS DISTINCT FROM NEW.projection_id
     OR NEW.projection_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.projection_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.projection_json ->> 'assignmentId'
       IS DISTINCT FROM NEW.assignment_id
     OR NEW.projection_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.projection_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.projection_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.projection_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.projection_json ->> 'publicationGeneration'
       IS DISTINCT FROM NEW.publication_generation::text
     OR NEW.projection_json ->> 'active' IS DISTINCT FROM lower(NEW.active::text)
     OR COALESCE(NEW.projection_json ->> 'internalRoute', '')
       !~ '^/app/student/library/[A-Za-z0-9%._~-]+$'
     OR COALESCE(NEW.projection_json ->> 'internalRoute', '') ~* 'https?://'
     OR NEW.approval_projection_json ->> 'projectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT onetime.valid_approved_publication_projection(
       NEW.approval_projection_json,
       NEW.account_key,
       NEW.product_key,
       NEW.content_version_id
     )
     OR NOT onetime.matches_current_content_publication_evidence(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest,
       NEW.approval_projection_json
     )
     OR NOT EXISTS (
       SELECT 1
         FROM onetime.student_content_assignments AS assignment
        WHERE assignment.account_key = NEW.account_key
          AND assignment.product_key = NEW.product_key
          AND assignment.assignment_id = NEW.assignment_id
          AND assignment.assignment_version = NEW.assignment_version
          AND assignment.student_id = NEW.student_id
          AND assignment.household_id = NEW.household_id
          AND assignment.content_id = NEW.content_id
          AND assignment.content_version_id = NEW.content_version_id
          AND assignment.publication_generation = NEW.publication_generation
          AND assignment.approval_projection_digest =
            NEW.approval_projection_digest
          AND assignment.active = true
     ) THEN
    RAISE EXCEPTION 'invalid Student library projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_library_projection_guard
BEFORE INSERT OR UPDATE ON onetime.student_library_projections
FOR EACH ROW EXECUTE FUNCTION onetime.bind_student_library_projection();

CREATE OR REPLACE FUNCTION onetime.validate_content_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.eligibility_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.eligibility_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.eligibility_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.eligibility_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.eligibility_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.eligibility_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.eligibility_json ->> 'occurrenceId'
       IS DISTINCT FROM NEW.occurrence_id
     OR NEW.eligibility_json ->> 'publicationGeneration'
       IS DISTINCT FROM NEW.publication_generation::text
     OR NEW.eligibility_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR COALESCE(NEW.eligibility_json ->> 'studentVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.eligibility_json ->> 'enrollmentVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.eligibility_json ->> 'accessVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(
       NEW.eligibility_json ->> 'serviceAccountConsentVersion',
       ''
     ) !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.eligibility_json ->> 'privacyVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.eligibility_json ->> 'revocationVersion', '')
       !~ '^[1-9][0-9]*$'
     OR NOT onetime.matches_current_content_publication(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest
     ) THEN
    RAISE EXCEPTION 'invalid Student content publication eligibility';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_content_eligibility_guard
BEFORE INSERT OR UPDATE ON onetime.student_content_publication_eligibility
FOR EACH ROW EXECUTE FUNCTION onetime.validate_content_eligibility();

CREATE OR REPLACE FUNCTION onetime.validate_protected_recording_notice()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notice_json ->> 'noticeId' IS DISTINCT FROM NEW.notice_id
     OR NEW.notice_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.notice_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.notice_json ->> 'recipientKind' IS DISTINCT FROM NEW.recipient_kind
     OR NEW.notice_json ->> 'recipientId' IS DISTINCT FROM NEW.recipient_id
     OR NEW.notice_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.notice_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.notice_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.notice_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.notice_json ->> 'sourceVersion'
       IS DISTINCT FROM NEW.source_version::text
     OR NEW.notice_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NEW.notice_json ->> 'deliveryState' IS DISTINCT FROM NEW.delivery_state
     OR COALESCE(NEW.notice_json ->> 'actionPath', '') !~ '^/'
     OR COALESCE(NEW.notice_json ->> 'actionPath', '') ~* 'https?://'
     OR NOT EXISTS (
       SELECT 1
         FROM onetime.content_publications AS publication
        WHERE publication.account_key = NEW.account_key
          AND publication.product_key = NEW.product_key
          AND publication.content_id = NEW.content_id
          AND publication.content_version_id = NEW.content_version_id
          AND publication.version = NEW.source_version
          AND publication.approval_projection_digest =
            NEW.approval_projection_digest
     ) THEN
    RAISE EXCEPTION 'invalid protected recording notice';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protected_recording_notice_guard
BEFORE INSERT OR UPDATE ON onetime.protected_recording_notices
FOR EACH ROW EXECUTE FUNCTION onetime.validate_protected_recording_notice();

CREATE OR REPLACE FUNCTION onetime.enforce_protected_recording_notice_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notice_id IS DISTINCT FROM OLD.notice_id
     OR NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.recipient_kind IS DISTINCT FROM OLD.recipient_kind
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.content_id IS DISTINCT FROM OLD.content_id
     OR NEW.content_version_id IS DISTINCT FROM OLD.content_version_id
     OR NEW.source_version IS DISTINCT FROM OLD.source_version
     OR NEW.approval_projection_digest
       IS DISTINCT FROM OLD.approval_projection_digest
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.notice_json - 'deliveryState')
       IS DISTINCT FROM (OLD.notice_json - 'deliveryState') THEN
    RAISE EXCEPTION 'protected recording notice evidence is immutable';
  END IF;
  IF OLD.delivery_state <> 'pending'
     OR NEW.delivery_state NOT IN ('sent', 'suppressed', 'failed') THEN
    RAISE EXCEPTION 'illegal protected recording notice transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protected_recording_notice_update_guard
BEFORE UPDATE ON onetime.protected_recording_notices
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_protected_recording_notice_update();

CREATE OR REPLACE FUNCTION onetime.valid_student_playback_session(
  expected_account_key text,
  expected_product_key text,
  expected_student_id text,
  expected_household_id text,
  expected_session_id text,
  expected_session_security_version bigint
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM onetime.account_learner_identity_links AS identity_link
      JOIN onetime.account_users AS student_user
        ON student_user.user_key = identity_link.user_key
       AND student_user.account_key = identity_link.account_key
       AND student_user.product_key = identity_link.product_key
       AND student_user.role = 'student'
       AND student_user.status = 'active'
      JOIN onetime.user_sessions AS session
        ON session.user_key = student_user.user_key
       AND session.account_key = student_user.account_key
       AND session.product_key = student_user.product_key
       AND session.security_version = student_user.security_version
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND session.last_seen_at > now() - interval '7 days'
      JOIN onetime.portal_student_access_state AS student_access
        ON student_access.account_key = identity_link.account_key
       AND student_access.product_key = identity_link.product_key
       AND student_access.household_key = identity_link.household_key
       AND student_access.learner_key = identity_link.learner_key
       AND student_access.student_user_ref = identity_link.user_key
       AND student_access.status = 'active'
      JOIN onetime.portal_learners AS learner
        ON learner.account_key = identity_link.account_key
       AND learner.product_key = identity_link.product_key
       AND learner.household_key = identity_link.household_key
       AND learner.learner_key = identity_link.learner_key
       AND learner.learner_status = 'active'
      JOIN onetime.portal_households AS household
        ON household.account_key = identity_link.account_key
       AND household.product_key = identity_link.product_key
       AND household.household_key = identity_link.household_key
       AND household.status = 'active'
     WHERE identity_link.account_key = expected_account_key
       AND identity_link.product_key = expected_product_key
       AND identity_link.learner_key = expected_student_id
       AND identity_link.household_key = expected_household_id
       AND identity_link.link_state = 'active'
       AND session.session_key = expected_session_id
       AND session.security_version = expected_session_security_version
  );
$$;

CREATE OR REPLACE FUNCTION onetime.validate_student_playback_facts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(NEW.facts_json) <> 'object'
     OR (
       SELECT count(*) FROM jsonb_object_keys(NEW.facts_json)
     ) <> 24
     OR NEW.facts_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.facts_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.facts_json ->> 'assignmentId' IS DISTINCT FROM NEW.assignment_id
     OR NEW.facts_json ->> 'assignmentVersion'
       IS DISTINCT FROM NEW.assignment_version::text
     OR NEW.facts_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.facts_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.facts_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR COALESCE(btrim(NEW.facts_json ->> 'sessionId'), '') = ''
     OR COALESCE(NEW.facts_json ->> 'sessionVersion', '')
       !~ '^[1-9][0-9]*$'
     OR NEW.facts_json ->> 'sessionActive' IS DISTINCT FROM 'true'
     OR COALESCE(NEW.facts_json ->> 'studentVersion', '')
       !~ '^[1-9][0-9]*$'
     OR NEW.facts_json ->> 'studentActive' IS DISTINCT FROM 'true'
     OR COALESCE(NEW.facts_json ->> 'enrollmentVersion', '')
       !~ '^[1-9][0-9]*$'
     OR NEW.facts_json ->> 'enrollmentActive' IS DISTINCT FROM 'true'
     OR COALESCE(NEW.facts_json ->> 'accessVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.facts_json ->> 'accessState', '')
       NOT IN ('active', 'grace')
     OR COALESCE(
       NEW.facts_json ->> 'serviceAccountConsentVersion',
       ''
     ) !~ '^[1-9][0-9]*$'
     OR NEW.facts_json ->> 'serviceAccountAccepted' IS DISTINCT FROM 'true'
     OR COALESCE(NEW.facts_json ->> 'privacyVersion', '')
       !~ '^[1-9][0-9]*$'
     OR COALESCE(NEW.facts_json ->> 'revocationVersion', '')
       !~ '^[1-9][0-9]*$'
     OR NEW.facts_json ->> 'studentRevoked' IS DISTINCT FROM 'false'
     OR NEW.facts_json ->> 'accountRevoked' IS DISTINCT FROM 'false'
     OR NEW.facts_json ->> 'contentRevoked' IS DISTINCT FROM 'false'
     OR NEW.facts_json ->> 'privacyReviewState' IS DISTINCT FROM 'clear'
     OR NOT onetime.valid_student_playback_session(
       NEW.account_key,
       NEW.product_key,
       NEW.student_id,
       NEW.household_id,
       NEW.facts_json ->> 'sessionId',
       (NEW.facts_json ->> 'sessionVersion')::bigint
     )
     OR NOT onetime.matches_current_content_publication(
       NEW.account_key,
       NEW.product_key,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_generation,
       NEW.approval_projection_digest
     )
     OR NOT EXISTS (
       SELECT 1
         FROM onetime.student_content_assignments AS assignment
         JOIN onetime.student_content_publication_eligibility AS eligibility
           ON eligibility.account_key = assignment.account_key
          AND eligibility.product_key = assignment.product_key
          AND eligibility.student_id = assignment.student_id
          AND eligibility.household_id = assignment.household_id
          AND eligibility.content_id = assignment.content_id
          AND eligibility.content_version_id = assignment.content_version_id
          AND eligibility.occurrence_id = assignment.occurrence_id
          AND eligibility.publication_generation =
            assignment.publication_generation
          AND eligibility.approval_projection_digest =
            assignment.approval_projection_digest
        WHERE assignment.account_key = NEW.account_key
          AND assignment.product_key = NEW.product_key
          AND assignment.assignment_id = NEW.assignment_id
          AND assignment.assignment_version = NEW.assignment_version
          AND assignment.student_id = NEW.student_id
          AND assignment.household_id = NEW.household_id
          AND assignment.content_id = NEW.content_id
          AND assignment.content_version_id = NEW.content_version_id
          AND assignment.publication_generation = NEW.publication_generation
          AND assignment.approval_projection_digest =
            NEW.approval_projection_digest
          AND assignment.active = true
          AND assignment.student_version =
            (NEW.facts_json ->> 'studentVersion')::bigint
          AND assignment.enrollment_version =
            (NEW.facts_json ->> 'enrollmentVersion')::bigint
          AND assignment.access_version =
            (NEW.facts_json ->> 'accessVersion')::bigint
          AND assignment.service_consent_version =
            (NEW.facts_json ->> 'serviceAccountConsentVersion')::bigint
          AND assignment.privacy_version =
            (NEW.facts_json ->> 'privacyVersion')::bigint
          AND assignment.revocation_version =
            (NEW.facts_json ->> 'revocationVersion')::bigint
          AND eligibility.eligibility_json ->> 'studentVersion' =
            NEW.facts_json ->> 'studentVersion'
          AND eligibility.eligibility_json ->> 'studentActive' =
            NEW.facts_json ->> 'studentActive'
          AND eligibility.eligibility_json ->> 'enrollmentVersion' =
            NEW.facts_json ->> 'enrollmentVersion'
          AND eligibility.eligibility_json ->> 'enrollmentActive' =
            NEW.facts_json ->> 'enrollmentActive'
          AND eligibility.eligibility_json ->> 'accessVersion' =
            NEW.facts_json ->> 'accessVersion'
          AND eligibility.eligibility_json ->> 'accessState' =
            NEW.facts_json ->> 'accessState'
          AND eligibility.eligibility_json
            ->> 'serviceAccountConsentVersion' =
              NEW.facts_json ->> 'serviceAccountConsentVersion'
          AND eligibility.eligibility_json ->> 'serviceAccountAccepted' =
            NEW.facts_json ->> 'serviceAccountAccepted'
          AND eligibility.eligibility_json ->> 'privacyVersion' =
            NEW.facts_json ->> 'privacyVersion'
          AND eligibility.eligibility_json ->> 'revocationVersion' =
            NEW.facts_json ->> 'revocationVersion'
          AND eligibility.eligibility_json ->> 'studentRevoked' =
            NEW.facts_json ->> 'studentRevoked'
          AND eligibility.eligibility_json ->> 'accountRevoked' =
            NEW.facts_json ->> 'accountRevoked'
          AND eligibility.eligibility_json ->> 'contentRevoked' =
            NEW.facts_json ->> 'contentRevoked'
          AND eligibility.eligibility_json ->> 'privacyReviewState' =
            NEW.facts_json ->> 'privacyReviewState'
     ) THEN
    RAISE EXCEPTION 'invalid Student content playback facts';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Student content playback facts moved backward';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_content_playback_facts_guard
BEFORE INSERT OR UPDATE ON onetime.student_content_playback_facts
FOR EACH ROW EXECUTE FUNCTION onetime.validate_student_playback_facts();

CREATE OR REPLACE FUNCTION onetime.reject_content_publication_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'content publication evidence is append-only';
END;
$$;

CREATE TRIGGER content_publication_receipts_append_only
BEFORE UPDATE OR DELETE ON onetime.content_publication_receipts
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_publication_evidence_mutation();

CREATE TRIGGER governed_content_occurrences_no_delete
BEFORE DELETE ON onetime.governed_content_occurrences
FOR EACH ROW EXECUTE FUNCTION onetime.reject_content_publication_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.valid_content_resume_authorization(
  expected_account_key text,
  expected_product_key text,
  expected_student_id text,
  expected_household_id text,
  expected_content_id text,
  expected_content_version_id text,
  expected_publication_version bigint,
  expected_approval_projection_digest text
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM onetime.content_publications AS publication
      JOIN onetime.student_content_assignments AS assignment
        ON assignment.account_key = publication.account_key
       AND assignment.product_key = publication.product_key
       AND assignment.content_id = publication.content_id
       AND assignment.content_version_id = publication.content_version_id
       AND assignment.publication_generation =
         publication.publication_generation
       AND assignment.approval_projection_digest =
         publication.approval_projection_digest
       AND assignment.student_id = expected_student_id
       AND assignment.household_id = expected_household_id
       AND assignment.active = TRUE
      JOIN onetime.student_content_playback_facts AS facts
        ON facts.account_key = assignment.account_key
       AND facts.product_key = assignment.product_key
       AND facts.assignment_id = assignment.assignment_id
       AND facts.assignment_version = assignment.assignment_version
       AND facts.student_id = assignment.student_id
       AND facts.household_id = assignment.household_id
       AND facts.content_id = assignment.content_id
       AND facts.content_version_id = assignment.content_version_id
       AND facts.publication_generation = assignment.publication_generation
       AND facts.approval_projection_digest =
         assignment.approval_projection_digest
      JOIN onetime.student_content_publication_eligibility AS eligibility
        ON eligibility.account_key = assignment.account_key
       AND eligibility.product_key = assignment.product_key
       AND eligibility.student_id = assignment.student_id
       AND eligibility.household_id = assignment.household_id
       AND eligibility.content_id = assignment.content_id
       AND eligibility.content_version_id = assignment.content_version_id
       AND eligibility.occurrence_id = assignment.occurrence_id
       AND eligibility.publication_generation =
         assignment.publication_generation
       AND eligibility.approval_projection_digest =
         assignment.approval_projection_digest
     WHERE publication.account_key = expected_account_key
       AND publication.product_key = expected_product_key
       AND publication.content_id = expected_content_id
       AND publication.content_version_id = expected_content_version_id
       AND publication.version = expected_publication_version
       AND publication.state = 'published'
       AND publication.approval_projection_digest =
         expected_approval_projection_digest
       AND facts.facts_json ->> 'sessionActive' = 'true'
       AND facts.facts_json ->> 'studentActive' = 'true'
       AND facts.facts_json ->> 'enrollmentActive' = 'true'
       AND facts.facts_json ->> 'accessState' IN ('active', 'grace')
       AND facts.facts_json ->> 'serviceAccountAccepted' = 'true'
       AND facts.facts_json ->> 'privacyReviewState' = 'clear'
       AND facts.facts_json ->> 'studentRevoked' = 'false'
       AND facts.facts_json ->> 'accountRevoked' = 'false'
       AND facts.facts_json ->> 'contentRevoked' = 'false'
       AND onetime.valid_student_playback_session(
         assignment.account_key,
         assignment.product_key,
         assignment.student_id,
         assignment.household_id,
         facts.facts_json ->> 'sessionId',
         (facts.facts_json ->> 'sessionVersion')::bigint
       )
       AND eligibility.eligibility_json ->> 'studentVersion' =
         facts.facts_json ->> 'studentVersion'
       AND eligibility.eligibility_json ->> 'studentActive' = 'true'
       AND eligibility.eligibility_json ->> 'enrollmentVersion' =
         facts.facts_json ->> 'enrollmentVersion'
       AND eligibility.eligibility_json ->> 'enrollmentActive' = 'true'
       AND eligibility.eligibility_json ->> 'accessVersion' =
         facts.facts_json ->> 'accessVersion'
       AND eligibility.eligibility_json ->> 'accessState' =
         facts.facts_json ->> 'accessState'
       AND eligibility.eligibility_json
         ->> 'serviceAccountConsentVersion' =
           facts.facts_json ->> 'serviceAccountConsentVersion'
       AND eligibility.eligibility_json ->> 'serviceAccountAccepted' = 'true'
       AND eligibility.eligibility_json ->> 'privacyVersion' =
         facts.facts_json ->> 'privacyVersion'
       AND eligibility.eligibility_json ->> 'revocationVersion' =
         facts.facts_json ->> 'revocationVersion'
       AND eligibility.eligibility_json ->> 'privacyReviewState' = 'clear'
       AND eligibility.eligibility_json ->> 'studentRevoked' = 'false'
       AND eligibility.eligibility_json ->> 'accountRevoked' = 'false'
       AND eligibility.eligibility_json ->> 'contentRevoked' = 'false'
  );
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_content_resume_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'content resume optimistic version conflict';
  END IF;
  IF NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.content_id IS DISTINCT FROM OLD.content_id
     OR NEW.content_version_id IS DISTINCT FROM OLD.content_version_id
     OR NEW.approval_projection_digest
       IS DISTINCT FROM OLD.approval_projection_digest
     OR NEW.publication_version < OLD.publication_version
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'content resume scope or evidence changed';
  END IF;
  IF NEW.resume_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.resume_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.resume_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.resume_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.resume_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.resume_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.resume_json ->> 'publicationVersion'
       IS DISTINCT FROM NEW.publication_version::text
     OR NEW.resume_json ->> 'positionMs' IS DISTINCT FROM NEW.position_ms::text
     OR NEW.resume_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR NEW.resume_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT EXISTS (
       SELECT 1
         FROM onetime.content_publications AS publication
        WHERE publication.account_key = NEW.account_key
          AND publication.product_key = NEW.product_key
          AND publication.content_id = NEW.content_id
          AND publication.content_version_id = NEW.content_version_id
          AND publication.version = NEW.publication_version
          AND publication.approval_projection_digest =
            NEW.approval_projection_digest
     )
     OR NOT onetime.valid_content_resume_authorization(
       NEW.account_key,
       NEW.product_key,
       NEW.student_id,
       NEW.household_id,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_version,
       NEW.approval_projection_digest
     ) THEN
    RAISE EXCEPTION 'invalid content resume projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.validate_content_resume_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.resume_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.resume_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.resume_json ->> 'studentId' IS DISTINCT FROM NEW.student_id
     OR NEW.resume_json ->> 'householdId' IS DISTINCT FROM NEW.household_id
     OR NEW.resume_json ->> 'contentId' IS DISTINCT FROM NEW.content_id
     OR NEW.resume_json ->> 'contentVersionId'
       IS DISTINCT FROM NEW.content_version_id
     OR NEW.resume_json ->> 'publicationVersion'
       IS DISTINCT FROM NEW.publication_version::text
     OR NEW.resume_json ->> 'positionMs' IS DISTINCT FROM NEW.position_ms::text
     OR NEW.resume_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR NEW.resume_json ->> 'approvalProjectionDigest'
       IS DISTINCT FROM NEW.approval_projection_digest
     OR NOT EXISTS (
       SELECT 1
         FROM onetime.content_publications AS publication
        WHERE publication.account_key = NEW.account_key
          AND publication.product_key = NEW.product_key
          AND publication.content_id = NEW.content_id
          AND publication.content_version_id = NEW.content_version_id
          AND publication.version = NEW.publication_version
          AND publication.approval_projection_digest =
            NEW.approval_projection_digest
     )
     OR NOT onetime.valid_content_resume_authorization(
       NEW.account_key,
       NEW.product_key,
       NEW.student_id,
       NEW.household_id,
       NEW.content_id,
       NEW.content_version_id,
       NEW.publication_version,
       NEW.approval_projection_digest
     ) THEN
    RAISE EXCEPTION 'invalid content resume projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_content_resume_insert_guard
BEFORE INSERT ON onetime.student_content_resume
FOR EACH ROW EXECUTE FUNCTION onetime.validate_content_resume_insert();

CREATE TRIGGER student_content_resume_version_step
BEFORE UPDATE ON onetime.student_content_resume
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_content_resume_update();
-- @postgres-only-end
