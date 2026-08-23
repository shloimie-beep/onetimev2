-- @postgres-only-begin
-- Preserve the governed OBS proof exactly, then add the separately typed
-- launch exception. Existing reviewed recordings have no occurrence relation,
-- participant snapshot, capture notice, or operator-device evidence.
ALTER FUNCTION onetime.approved_publication_projection_digest(jsonb)
  RENAME TO approved_publication_projection_digest_obs;

ALTER FUNCTION onetime.valid_approved_publication_projection(
  jsonb, text, text, text, text
) RENAME TO valid_approved_publication_projection_obs;

CREATE FUNCTION onetime.approved_publication_projection_digest(
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
          ',"mishnahReferences":' || COALESCE(evidence -> 'mishnahReferences', '[]'::jsonb)::text ||
          ',"occurredAt":' || to_jsonb(evidence ->> 'occurredAt')::text ||
          ',"durationMs":' || (evidence ->> 'durationMs') ||
          ',"approvedByAdminId":' || to_jsonb(evidence ->> 'approvedByAdminId')::text ||
          ',"approvedAt":' || to_jsonb(evidence ->> 'approvedAt')::text ||
          ',"artifacts":' || COALESCE(evidence -> 'artifacts', '[]'::jsonb)::text ||
          ',"approvedArtifactSetDigest":' || to_jsonb(evidence ->> 'approvedArtifactSetDigest')::text ||
          ',"sourceEvidenceDigest":' || to_jsonb(evidence ->> 'sourceEvidenceDigest')::text ||
          '}',
          'UTF8'
        )
      ),
      'hex'
    )
  END;
$$;

CREATE FUNCTION onetime.valid_approved_publication_projection(
  evidence jsonb,
  expected_account_key text,
  expected_product_key text,
  expected_content_id text,
  expected_content_version_id text
)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  approved_at timestamptz;
  reviewed_at timestamptz;
  artifact jsonb;
  seen_kinds text[] := ARRAY[]::text[];
BEGIN
  IF evidence ->> 'reviewKind' IS DISTINCT FROM 'existing_reviewed_recording' THEN
    RETURN onetime.valid_approved_publication_projection_obs(
      evidence, expected_account_key, expected_product_key, expected_content_id,
      expected_content_version_id
    );
  END IF;
  IF evidence IS NULL
     OR jsonb_typeof(evidence) <> 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(evidence)) <> 25
     OR NOT evidence ?& ARRAY[
       'accountKey', 'productKey', 'contentId', 'contentVersionId',
       'contentVersionDigest', 'sourceId', 'sourceSha256', 'sourceObjectVersionId',
       'reviewKind', 'reviewedSourceDigest', 'reviewedByAdminId', 'reviewedAt',
       'approvalEvidenceDigest', 'title', 'englishTranscriptText', 'classTopic',
       'mishnahReferences', 'occurredAt', 'durationMs', 'approvedByAdminId',
       'approvedAt', 'artifacts', 'approvedArtifactSetDigest',
       'sourceEvidenceDigest', 'projectionDigest'
     ]
     OR evidence ->> 'accountKey' IS DISTINCT FROM expected_account_key
     OR evidence ->> 'productKey' IS DISTINCT FROM expected_product_key
     OR evidence ->> 'contentId' IS DISTINCT FROM expected_content_id
     OR evidence ->> 'contentVersionId' IS DISTINCT FROM expected_content_version_id
     OR COALESCE(evidence ->> 'contentVersionDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'sourceSha256', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'reviewedSourceDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'approvalEvidenceDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'approvedArtifactSetDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'sourceEvidenceDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'projectionDigest', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'sourceId'), '') = ''
     OR COALESCE(btrim(evidence ->> 'sourceObjectVersionId'), '') = ''
     OR COALESCE(btrim(evidence ->> 'reviewedByAdminId'), '') = ''
     OR COALESCE(btrim(evidence ->> 'approvedByAdminId'), '') = ''
     OR COALESCE(btrim(evidence ->> 'title'), '') = ''
     OR COALESCE(btrim(evidence ->> 'englishTranscriptText'), '') = ''
     OR COALESCE(btrim(evidence ->> 'classTopic'), '') = ''
     OR jsonb_typeof(evidence -> 'mishnahReferences') <> 'array'
     OR jsonb_typeof(evidence -> 'artifacts') <> 'array'
     OR jsonb_array_length(evidence -> 'artifacts') <> 7
     OR COALESCE(evidence ->> 'durationMs', '') !~ '^[1-9][0-9]*$' THEN
    RETURN false;
  END IF;
  BEGIN
    reviewed_at := (evidence ->> 'reviewedAt')::timestamptz;
    approved_at := (evidence ->> 'approvedAt')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF approved_at < reviewed_at
     OR evidence ->> 'projectionDigest' IS DISTINCT FROM
          onetime.approved_publication_projection_digest(evidence) THEN
    RETURN false;
  END IF;
  FOR artifact IN SELECT value FROM jsonb_array_elements(evidence -> 'artifacts')
  LOOP
    IF jsonb_typeof(artifact) <> 'object'
       OR artifact ->> 'kind' NOT IN (
         'trim', 'compressed_video', 'transcript', 'captions',
         'review_material', 'worksheet', 'knowledge_artifact'
       )
       OR artifact ->> 'kind' = ANY(seen_kinds)
       OR COALESCE(artifact ->> 'artifactId', '') = ''
       OR COALESCE(artifact ->> 'revision', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(artifact ->> 'payloadDigest', '') !~ '^[0-9a-f]{64}$' THEN
      RETURN false;
    END IF;
    seen_kinds := array_append(seen_kinds, artifact ->> 'kind');
  END LOOP;
  IF seen_kinds <> ARRAY[
       'captions', 'compressed_video', 'knowledge_artifact',
       'review_material', 'transcript', 'trim', 'worksheet'
     ]::text[] THEN
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
     WHERE version_row.account_key = expected_account_key
       AND version_row.product_key = expected_product_key
       AND version_row.content_version_key = expected_content_version_id
       AND version_row.processing_state = 'approved'
       AND source_row.record_json ->> 'captureMethod' = 'existing_reviewed_recording'
       AND version_row.source_key = evidence ->> 'sourceId'
       AND version_row.source_sha256 = evidence ->> 'sourceSha256'
       AND version_row.source_object_version_id = evidence ->> 'sourceObjectVersionId'
       AND capture_row.record_json ->> 'evidenceVersion' =
         'OT-EXISTING-REVIEWED-RECORDING-1'
       AND capture_row.record_json ->> 'reviewedSourceDigest' =
         evidence ->> 'reviewedSourceDigest'
       AND version_row.record_json -> 'publicationApproval' ->> 'evidenceVersion' =
         'OT-EXISTING-REVIEWED-RECORDING-APPROVAL-1'
       AND version_row.record_json -> 'publicationApproval' ->> 'reviewedSourceDigest' =
         evidence ->> 'reviewedSourceDigest'
       AND version_row.record_json -> 'publicationApproval' ->> 'approvedByAdminId' =
         evidence ->> 'approvedByAdminId'
       AND version_row.record_json -> 'publicationApproval' ->> 'approvedArtifactSetDigest' =
         evidence ->> 'approvedArtifactSetDigest'
       AND version_row.record_json -> 'publicationApproval' ->> 'sourceEvidenceDigest' =
         evidence ->> 'sourceEvidenceDigest'
  );
END;
$$;
-- @postgres-only-end
SELECT 1;
