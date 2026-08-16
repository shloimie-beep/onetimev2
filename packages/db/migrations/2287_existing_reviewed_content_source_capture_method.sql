-- @postgres-only-begin
-- Migration 2278 added the governed existing-reviewed-recording evidence type,
-- while the original content-source JSON check still admitted OBS only. Replace
-- only that obsolete check; all source identity, checksum, preservation,
-- lifecycle, versioning, and append-only constraints remain unchanged.
DO $$
DECLARE
  constraint_name text;
  replaced_count integer := 0;
BEGIN
  FOR constraint_name IN
    SELECT constraint_row.conname
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'onetime'
       AND relation.relname = 'content_sources_v21'
       AND constraint_row.contype = 'c'
       AND pg_get_constraintdef(constraint_row.oid)
         LIKE '%record_json%captureMethod%obs%'
  LOOP
    EXECUTE format(
      'ALTER TABLE onetime.content_sources_v21 DROP CONSTRAINT %I',
      constraint_name
    );
    replaced_count := replaced_count + 1;
  END LOOP;

  IF replaced_count <> 1 THEN
    RAISE EXCEPTION
      'expected exactly one OBS-only content source capture-method constraint, found %',
      replaced_count;
  END IF;
END;
$$;

ALTER TABLE onetime.content_sources_v21
  ADD CONSTRAINT content_source_capture_method_check
  CHECK (
    record_json ->> 'captureMethod' IS NOT NULL
    AND record_json ->> 'captureMethod' IN (
      'obs', 'existing_reviewed_recording'
    )
  );

-- Migration 2279 delegated the OBS projection unchanged, but serialized the
-- existing-reviewed artifact and reference arrays through jsonb::text. JSONB
-- intentionally normalizes object-key order and whitespace, while the domain
-- digest uses compact, contract-ordered JSON. Rebuild only those two arrays in
-- the domain's locked order so native PostgreSQL and the domain agree.
CREATE OR REPLACE FUNCTION onetime.compact_existing_reviewed_projection_references(
  evidence jsonb
)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT COALESCE(
    '[' || string_agg(to_jsonb(item.value #>> '{}')::text, ',' ORDER BY item.ordinality) || ']',
    '[]'
  )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(evidence -> 'mishnahReferences') = 'array'
          THEN evidence -> 'mishnahReferences'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS item(value, ordinality);
$$;

CREATE OR REPLACE FUNCTION onetime.compact_existing_reviewed_projection_artifacts(
  evidence jsonb
)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT COALESCE(
    '[' || string_agg(
      '{"artifactId":' || to_jsonb(item.value ->> 'artifactId')::text ||
      ',"kind":' || to_jsonb(item.value ->> 'kind')::text ||
      ',"revision":' || COALESCE(item.value ->> 'revision', 'null') ||
      ',"payloadDigest":' || to_jsonb(item.value ->> 'payloadDigest')::text ||
      ',"model":' || COALESCE((item.value -> 'model')::text, 'null') ||
      ',"operationVersion":' ||
        COALESCE((item.value -> 'operationVersion')::text, 'null') ||
      ',"promptVersion":' ||
        COALESCE((item.value -> 'promptVersion')::text, 'null') ||
      ',"schemaVersion":' ||
        COALESCE((item.value -> 'schemaVersion')::text, 'null') ||
      '}',
      ',' ORDER BY item.ordinality
    ) || ']',
    '[]'
  )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(evidence -> 'artifacts') = 'array'
          THEN evidence -> 'artifacts'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS item(value, ordinality);
$$;

CREATE OR REPLACE FUNCTION onetime.approved_publication_projection_digest(
  evidence jsonb
)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN evidence ->> 'reviewKind' IS DISTINCT FROM 'existing_reviewed_recording'
      THEN onetime.approved_publication_projection_digest_obs(evidence)
    ELSE encode(
      sha256(
        convert_to(
          '{"accountKey":' || to_jsonb(evidence ->> 'accountKey')::text ||
          ',"productKey":' || to_jsonb(evidence ->> 'productKey')::text ||
          ',"contentId":' || to_jsonb(evidence ->> 'contentId')::text ||
          ',"contentVersionId":' || to_jsonb(evidence ->> 'contentVersionId')::text ||
          ',"contentVersionDigest":' || to_jsonb(evidence ->> 'contentVersionDigest')::text ||
          ',"sourceId":' || to_jsonb(evidence ->> 'sourceId')::text ||
          ',"sourceSha256":' || to_jsonb(evidence ->> 'sourceSha256')::text ||
          ',"sourceObjectVersionId":' || to_jsonb(evidence ->> 'sourceObjectVersionId')::text ||
          ',"reviewKind":"existing_reviewed_recording"' ||
          ',"reviewedSourceDigest":' || to_jsonb(evidence ->> 'reviewedSourceDigest')::text ||
          ',"reviewedByAdminId":' || to_jsonb(evidence ->> 'reviewedByAdminId')::text ||
          ',"reviewedAt":' || to_jsonb(evidence ->> 'reviewedAt')::text ||
          ',"approvalEvidenceDigest":' || to_jsonb(evidence ->> 'approvalEvidenceDigest')::text ||
          ',"title":' || to_jsonb(evidence ->> 'title')::text ||
          ',"englishTranscriptText":' || to_jsonb(evidence ->> 'englishTranscriptText')::text ||
          ',"classTopic":' || to_jsonb(evidence ->> 'classTopic')::text ||
          ',"mishnahReferences":' ||
            onetime.compact_existing_reviewed_projection_references(evidence) ||
          ',"occurredAt":' || to_jsonb(evidence ->> 'occurredAt')::text ||
          ',"durationMs":' || COALESCE(evidence ->> 'durationMs', 'null') ||
          ',"approvedByAdminId":' || to_jsonb(evidence ->> 'approvedByAdminId')::text ||
          ',"approvedAt":' || to_jsonb(evidence ->> 'approvedAt')::text ||
          ',"artifacts":' ||
            onetime.compact_existing_reviewed_projection_artifacts(evidence) ||
          ',"approvedArtifactSetDigest":' ||
            to_jsonb(evidence ->> 'approvedArtifactSetDigest')::text ||
          ',"sourceEvidenceDigest":' ||
            to_jsonb(evidence ->> 'sourceEvidenceDigest')::text ||
          '}',
          'UTF8'
        )
      ),
      'hex'
    )
  END;
$$;

-- A binding authorization is invocation-scoped evidence, not a reusable
-- feature flag. The phrase digest is the primary key so two concurrent
-- controllers cannot consume the same authorization for different work.
CREATE TABLE IF NOT EXISTS onetime.parent_welcome_binding_authorizations_v21 (
  authorization_phrase_sha256 text PRIMARY KEY,
  operation_id text NOT NULL UNIQUE,
  manifest_digest text NOT NULL,
  authorization_binding_sha256 text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  consumed_at timestamptz NOT NULL,
  CONSTRAINT parent_welcome_binding_authorization_phrase_sha_check
    CHECK (authorization_phrase_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parent_welcome_binding_operation_id_check
    CHECK (operation_id ~ '^pwb_[0-9a-f]{32}$'),
  CONSTRAINT parent_welcome_binding_manifest_digest_check
    CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parent_welcome_binding_authorization_digest_check
    CHECK (authorization_binding_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parent_welcome_binding_product_check
    CHECK (product_key = 'one_time_mishnayos'),
  CONSTRAINT parent_welcome_binding_tier_check
    CHECK (runtime_tier IN ('isolated_staging', 'production'))
);

-- This row is inserted in the same transaction as the publication and exact
-- asset bindings. Its presence is the only authority for an idempotent replay.
CREATE TABLE IF NOT EXISTS onetime.parent_welcome_binding_operation_results_v21 (
  operation_id text PRIMARY KEY
    REFERENCES onetime.parent_welcome_binding_authorizations_v21(operation_id),
  manifest_digest text NOT NULL,
  result_digest text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT parent_welcome_binding_result_operation_id_check
    CHECK (operation_id ~ '^pwb_[0-9a-f]{32}$'),
  CONSTRAINT parent_welcome_binding_result_manifest_digest_check
    CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parent_welcome_binding_result_digest_check
    CHECK (result_digest ~ '^[0-9a-f]{64}$')
);

CREATE OR REPLACE FUNCTION onetime.reject_parent_welcome_binding_evidence_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'parent welcome binding evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS parent_welcome_binding_authorization_append_only
  ON onetime.parent_welcome_binding_authorizations_v21;
CREATE TRIGGER parent_welcome_binding_authorization_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_welcome_binding_authorizations_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_welcome_binding_evidence_append_only_mutation();

DROP TRIGGER IF EXISTS parent_welcome_binding_result_append_only
  ON onetime.parent_welcome_binding_operation_results_v21;
CREATE TRIGGER parent_welcome_binding_result_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_welcome_binding_operation_results_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_welcome_binding_evidence_append_only_mutation();
-- @postgres-only-end
SELECT 1;
