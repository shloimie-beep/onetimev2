-- Forward-only successor for the immutable 2252 publication projection contract.
SELECT 1;
-- @postgres-only-begin
CREATE OR REPLACE FUNCTION onetime.approved_publication_projection_digest(
  evidence jsonb
)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(
    sha256(
      convert_to(
        '{"accountKey":' || to_jsonb(evidence ->> 'accountKey')::text ||
        ',"productKey":' || to_jsonb(evidence ->> 'productKey')::text ||
        ',"contentId":' || to_jsonb(evidence ->> 'contentId')::text ||
        ',"contentVersionId":' ||
          to_jsonb(evidence ->> 'contentVersionId')::text ||
        ',"contentVersionDigest":' ||
          to_jsonb(evidence ->> 'contentVersionDigest')::text ||
        ',"sourceId":' || to_jsonb(evidence ->> 'sourceId')::text ||
        ',"sourceSha256":' || to_jsonb(evidence ->> 'sourceSha256')::text ||
        ',"sourceObjectVersionId":' ||
          to_jsonb(evidence ->> 'sourceObjectVersionId')::text ||
        ',"participantSetVersion":' ||
          to_jsonb(evidence ->> 'participantSetVersion')::text ||
        ',"participantSnapshotDigest":' ||
          to_jsonb(evidence ->> 'participantSnapshotDigest')::text ||
        ',"participantReviewState":' ||
          to_jsonb(evidence ->> 'participantReviewState')::text ||
        ',"unresolvedParticipantCount":' ||
          (evidence ->> 'unresolvedParticipantCount') ||
        ',"requiredRedactionCount":' ||
          (evidence ->> 'requiredRedactionCount') ||
        ',"completedRedactionCount":' ||
          (evidence ->> 'completedRedactionCount') ||
        ',"redactionReviewDigest":' ||
          to_jsonb(evidence ->> 'redactionReviewDigest')::text ||
        ',"title":' || to_jsonb(evidence ->> 'title')::text ||
        ',"englishTranscriptText":' ||
          to_jsonb(evidence ->> 'englishTranscriptText')::text ||
        ',"classTopic":' || to_jsonb(evidence ->> 'classTopic')::text ||
        ',"mishnahReferences":[' ||
          COALESCE(
            (
              SELECT string_agg(reference.value::text, ',' ORDER BY reference.ordinality)
                FROM jsonb_array_elements(evidence -> 'mishnahReferences')
                  WITH ORDINALITY AS reference(value, ordinality)
            ),
            ''
          ) ||
        ']' ||
        ',"occurredAt":' || to_jsonb(evidence ->> 'occurredAt')::text ||
        ',"durationMs":' || (evidence ->> 'durationMs') ||
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
                ',"model":' || (artifact.value -> 'model')::text ||
                ',"operationVersion":' ||
                  (artifact.value -> 'operationVersion')::text ||
                ',"promptVersion":' ||
                  (artifact.value -> 'promptVersion')::text ||
                ',"schemaVersion":' ||
                  (artifact.value -> 'schemaVersion')::text ||
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
  expected_content_id text,
  expected_content_version_id text
)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  artifact jsonb;
  expected_artifact_revision bigint;
  current_artifact_kind text;
  seen_kinds text[] := ARRAY[]::text[];
  approved_at timestamptz;
  occurred_at timestamptz;
  duration_ms numeric;
  unresolved_participant_count numeric;
  required_redaction_count numeric;
  completed_redaction_count numeric;
BEGIN
  IF evidence IS NULL
     OR jsonb_typeof(evidence) <> 'object'
     OR (
       SELECT count(*) FROM jsonb_object_keys(evidence)
     ) <> 27
     OR NOT evidence ?& ARRAY[
       'accountKey', 'productKey', 'contentId', 'contentVersionId',
       'contentVersionDigest', 'sourceId', 'sourceSha256',
       'sourceObjectVersionId', 'participantSetVersion',
       'participantSnapshotDigest', 'participantReviewState',
       'unresolvedParticipantCount', 'requiredRedactionCount',
       'completedRedactionCount', 'redactionReviewDigest', 'title',
       'englishTranscriptText', 'classTopic', 'mishnahReferences',
       'occurredAt', 'durationMs', 'approvedByAdminId', 'approvedAt',
       'artifacts', 'approvedArtifactSetDigest', 'sourceEvidenceDigest',
       'projectionDigest'
     ]
     OR evidence ->> 'accountKey' IS DISTINCT FROM expected_account_key
     OR evidence ->> 'productKey' IS DISTINCT FROM expected_product_key
     OR evidence ->> 'contentId' IS DISTINCT FROM expected_content_id
     OR evidence ->> 'contentVersionId'
       IS DISTINCT FROM expected_content_version_id
     OR COALESCE(evidence ->> 'contentVersionDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'sourceId'), '') = ''
     OR COALESCE(evidence ->> 'sourceSha256', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'sourceObjectVersionId'), '') = ''
     OR COALESCE(evidence ->> 'participantSetVersion', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(evidence ->> 'participantSnapshotDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR evidence ->> 'participantReviewState' IS DISTINCT FROM 'complete'
     OR jsonb_typeof(evidence -> 'unresolvedParticipantCount') <> 'number'
     OR COALESCE(evidence ->> 'unresolvedParticipantCount', '') !~ '^[0-9]+$'
     OR jsonb_typeof(evidence -> 'requiredRedactionCount') <> 'number'
     OR COALESCE(evidence ->> 'requiredRedactionCount', '') !~ '^[0-9]+$'
     OR jsonb_typeof(evidence -> 'completedRedactionCount') <> 'number'
     OR COALESCE(evidence ->> 'completedRedactionCount', '') !~ '^[0-9]+$'
     OR COALESCE(evidence ->> 'redactionReviewDigest', '')
       !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(evidence ->> 'title'), '') = ''
     OR evidence ->> 'title' IS DISTINCT FROM btrim(evidence ->> 'title')
     OR COALESCE(btrim(evidence ->> 'englishTranscriptText'), '') = ''
     OR COALESCE(btrim(evidence ->> 'classTopic'), '') = ''
     OR evidence ->> 'classTopic' IS DISTINCT FROM btrim(evidence ->> 'classTopic')
     OR jsonb_typeof(evidence -> 'mishnahReferences') <> 'array'
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(evidence -> 'mishnahReferences') AS reference(value)
        WHERE jsonb_typeof(reference.value) <> 'string'
           OR COALESCE(btrim(reference.value #>> '{}'), '') = ''
           OR reference.value #>> '{}' IS DISTINCT FROM
             btrim(reference.value #>> '{}')
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements_text(evidence -> 'mishnahReferences')
           AS reference(value)
        GROUP BY reference.value
       HAVING count(*) > 1
     )
     OR COALESCE(evidence ->> 'occurredAt', '')
       !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
     OR jsonb_typeof(evidence -> 'durationMs') <> 'number'
     OR COALESCE(evidence ->> 'durationMs', '') !~ '^[1-9][0-9]*$'
     OR COALESCE(btrim(evidence ->> 'approvedByAdminId'), '') = ''
     OR COALESCE(evidence ->> 'approvedAt', '')
       !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
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
    occurred_at := (evidence ->> 'occurredAt')::timestamptz;
    duration_ms := (evidence ->> 'durationMs')::numeric;
    unresolved_participant_count :=
      (evidence ->> 'unresolvedParticipantCount')::numeric;
    required_redaction_count :=
      (evidence ->> 'requiredRedactionCount')::numeric;
    completed_redaction_count :=
      (evidence ->> 'completedRedactionCount')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF approved_at < occurred_at
     OR duration_ms <= 0
     OR unresolved_participant_count <> 0
     OR required_redaction_count < 0
     OR completed_redaction_count <> required_redaction_count THEN
    RETURN false;
  END IF;

  FOR artifact IN SELECT value FROM jsonb_array_elements(evidence -> 'artifacts')
  LOOP
    current_artifact_kind := artifact ->> 'kind';
    BEGIN
      expected_artifact_revision := (artifact ->> 'revision')::bigint;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
    IF jsonb_typeof(artifact) <> 'object'
       OR (
         SELECT count(*) FROM jsonb_object_keys(artifact)
       ) <> 8
       OR NOT artifact ?& ARRAY[
         'artifactId', 'kind', 'revision', 'payloadDigest', 'model',
         'operationVersion', 'promptVersion', 'schemaVersion'
       ]
       OR COALESCE(btrim(artifact ->> 'artifactId'), '') = ''
       OR COALESCE(current_artifact_kind, '') NOT IN (
         'trim', 'compressed_video', 'transcript', 'captions',
         'review_material', 'worksheet', 'knowledge_artifact'
       )
       OR current_artifact_kind = ANY(seen_kinds)
       OR jsonb_typeof(artifact -> 'revision') <> 'number'
       OR COALESCE(artifact ->> 'revision', '') !~ '^[1-9][0-9]*$'
       OR expected_artifact_revision < 1
       OR COALESCE(artifact ->> 'payloadDigest', '') !~ '^[0-9a-f]{64}$'
       OR NOT (
         jsonb_typeof(artifact -> 'model') = 'null'
         OR (
           jsonb_typeof(artifact -> 'model') = 'string'
           AND COALESCE(btrim(artifact ->> 'model'), '') <> ''
         )
       )
       OR NOT (
         jsonb_typeof(artifact -> 'operationVersion') = 'null'
         OR (
           jsonb_typeof(artifact -> 'operationVersion') = 'string'
           AND COALESCE(btrim(artifact ->> 'operationVersion'), '') <> ''
         )
       )
       OR NOT (
         jsonb_typeof(artifact -> 'promptVersion') = 'null'
         OR (
           jsonb_typeof(artifact -> 'promptVersion') = 'string'
           AND COALESCE(btrim(artifact ->> 'promptVersion'), '') <> ''
         )
       )
       OR NOT (
         jsonb_typeof(artifact -> 'schemaVersion') = 'null'
         OR (
           jsonb_typeof(artifact -> 'schemaVersion') = 'string'
           AND COALESCE(btrim(artifact ->> 'schemaVersion'), '') <> ''
         )
       )
       OR NOT EXISTS (
         SELECT 1
           FROM onetime.content_processing_artifacts AS persisted
          WHERE persisted.account_key = expected_account_key
            AND persisted.product_key = expected_product_key
            AND persisted.content_version_key = expected_content_version_id
            AND persisted.artifact_key = artifact ->> 'artifactId'
            AND persisted.artifact_kind = current_artifact_kind
            AND persisted.artifact_revision = expected_artifact_revision
            AND persisted.payload_digest = artifact ->> 'payloadDigest'
            AND persisted.source_key = evidence ->> 'sourceId'
            AND persisted.source_sha256 = evidence ->> 'sourceSha256'
            AND persisted.source_object_version_id =
              evidence ->> 'sourceObjectVersionId'
            AND persisted.artifact_status = 'approved'
            AND persisted.record_json ->> 'accountKey' = expected_account_key
            AND persisted.record_json ->> 'productKey' = expected_product_key
            AND persisted.record_json ->> 'contentVersionId' =
              expected_content_version_id
            AND persisted.record_json ->> 'approvedByAdminId' =
              evidence ->> 'approvedByAdminId'
            AND persisted.record_json ->> 'approvedAt' =
              evidence ->> 'approvedAt'
            AND COALESCE(persisted.record_json -> 'model', 'null'::jsonb) =
              artifact -> 'model'
            AND COALESCE(
              persisted.record_json -> 'operationVersion',
              'null'::jsonb
            ) = artifact -> 'operationVersion'
            AND COALESCE(
              persisted.record_json -> 'promptVersion',
              'null'::jsonb
            ) = artifact -> 'promptVersion'
            AND COALESCE(
              persisted.record_json -> 'schemaVersion',
              'null'::jsonb
            ) = artifact -> 'schemaVersion'
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
       AND version_row.record_json ->> 'contentId' = expected_content_id
       AND version_row.record_json -> 'publicationApproval'
         ->> 'contentVersionDigest' = evidence ->> 'contentVersionDigest'
       AND version_row.source_key = evidence ->> 'sourceId'
       AND version_row.source_sha256 = evidence ->> 'sourceSha256'
       AND version_row.source_object_version_id =
         evidence ->> 'sourceObjectVersionId'
       AND source_row.record_json ->> 'id' = evidence ->> 'sourceId'
       AND source_row.record_json ->> 'sha256' = evidence ->> 'sourceSha256'
       AND source_row.record_json ->> 'objectVersionId' =
         evidence ->> 'sourceObjectVersionId'
       AND capture_row.participant_snapshot_digest =
         evidence ->> 'participantSnapshotDigest'
       AND capture_row.record_json ->> 'sourceId' = evidence ->> 'sourceId'
       AND capture_row.record_json ->> 'linkedIngestSourceId' =
         evidence ->> 'sourceId'
       AND capture_row.record_json ->> 'consentedParticipantSnapshotDigest' =
         evidence ->> 'participantSnapshotDigest'
       AND capture_row.record_json ->> 'capturedAt' =
         evidence ->> 'occurredAt'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'participantSnapshotDigest' =
           evidence ->> 'participantSnapshotDigest'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'approvedByAdminId' = evidence ->> 'approvedByAdminId'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'approvedAt' = evidence ->> 'approvedAt'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'approvedArtifactSetDigest' =
           evidence ->> 'approvedArtifactSetDigest'
       AND version_row.record_json -> 'publicationApproval'
         ->> 'sourceEvidenceDigest' = evidence ->> 'sourceEvidenceDigest'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'participantSetVersion' =
           evidence ->> 'participantSetVersion'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'participantSnapshotDigest' =
           evidence ->> 'participantSnapshotDigest'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'participantReviewState' =
           evidence ->> 'participantReviewState'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'unresolvedParticipantCount' =
           evidence ->> 'unresolvedParticipantCount'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'requiredRedactionCount' =
           evidence ->> 'requiredRedactionCount'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'completedRedactionCount' =
           evidence ->> 'completedRedactionCount'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'redactionReviewDigest' =
           evidence ->> 'redactionReviewDigest'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'reviewedByAdminId' =
           evidence ->> 'approvedByAdminId'
       AND version_row.record_json -> 'publicationApproval'
         -> 'participantReview' ->> 'reviewedAt' =
           evidence ->> 'approvedAt'
       AND EXISTS (
         SELECT 1
           FROM onetime.content_processing_artifacts AS review_artifact
          WHERE review_artifact.account_key = expected_account_key
            AND review_artifact.product_key = expected_product_key
            AND review_artifact.content_version_key =
              expected_content_version_id
            AND review_artifact.artifact_kind = 'review_material'
            AND review_artifact.artifact_status = 'approved'
            AND review_artifact.record_json -> 'payload' ->> 'title' =
              evidence ->> 'title'
            AND review_artifact.record_json -> 'payload' ->> 'classTopic' =
              evidence ->> 'classTopic'
            AND review_artifact.record_json -> 'payload'
              -> 'mishnahReferences' = evidence -> 'mishnahReferences'
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.content_processing_artifacts AS newer_review
               WHERE newer_review.account_key = review_artifact.account_key
                 AND newer_review.product_key = review_artifact.product_key
                 AND newer_review.content_version_key =
                   review_artifact.content_version_key
                 AND newer_review.artifact_kind = review_artifact.artifact_kind
                 AND newer_review.artifact_revision >
                   review_artifact.artifact_revision
            )
       )
       AND EXISTS (
         SELECT 1
           FROM onetime.content_processing_artifacts AS transcript_artifact
          WHERE transcript_artifact.account_key = expected_account_key
            AND transcript_artifact.product_key = expected_product_key
            AND transcript_artifact.content_version_key =
              expected_content_version_id
            AND transcript_artifact.artifact_kind = 'transcript'
            AND transcript_artifact.artifact_status = 'approved'
            AND (
              SELECT string_agg(
                segment.value ->> 'text',
                E'\n'
                ORDER BY segment.ordinality
              )
                FROM jsonb_array_elements(
                  transcript_artifact.record_json -> 'payload' -> 'segments'
                ) WITH ORDINALITY AS segment(value, ordinality)
            ) = evidence ->> 'englishTranscriptText'
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.content_processing_artifacts AS newer_transcript
               WHERE newer_transcript.account_key =
                   transcript_artifact.account_key
                 AND newer_transcript.product_key =
                   transcript_artifact.product_key
                 AND newer_transcript.content_version_key =
                   transcript_artifact.content_version_key
                 AND newer_transcript.artifact_kind =
                   transcript_artifact.artifact_kind
                 AND newer_transcript.artifact_revision >
                   transcript_artifact.artifact_revision
            )
       )
       AND EXISTS (
         SELECT 1
           FROM onetime.content_processing_artifacts AS video_artifact
          WHERE video_artifact.account_key = expected_account_key
            AND video_artifact.product_key = expected_product_key
            AND video_artifact.content_version_key =
              expected_content_version_id
            AND video_artifact.artifact_kind = 'compressed_video'
            AND video_artifact.artifact_status = 'approved'
            AND video_artifact.record_json -> 'payload' ->> 'durationMs' =
              evidence ->> 'durationMs'
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.content_processing_artifacts AS newer_video
               WHERE newer_video.account_key = video_artifact.account_key
                 AND newer_video.product_key = video_artifact.product_key
                 AND newer_video.content_version_key =
                   video_artifact.content_version_key
                 AND newer_video.artifact_kind = video_artifact.artifact_kind
                 AND newer_video.artifact_revision >
                   video_artifact.artifact_revision
            )
       )
  );
END;
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
         OR evidence ->> 'contentId' IS DISTINCT FROM NEW.content_id
         OR evidence ->> 'contentVersionId'
           IS DISTINCT FROM NEW.content_version_id
         OR evidence ->> 'contentVersionDigest'
           IS DISTINCT FROM NEW.content_version_digest
         OR evidence ->> 'participantSetVersion'
           IS DISTINCT FROM NEW.record_json ->> 'participantSetVersion'
         OR evidence ->> 'participantSnapshotDigest'
           IS DISTINCT FROM NEW.record_json ->> 'participantSnapshotDigest'
         OR evidence ->> 'participantReviewState'
           IS DISTINCT FROM NEW.record_json ->> 'participantReviewState'
         OR evidence ->> 'unresolvedParticipantCount'
           IS DISTINCT FROM NEW.record_json ->> 'unresolvedParticipantCount'
         OR evidence ->> 'requiredRedactionCount'
           IS DISTINCT FROM NEW.record_json ->> 'requiredRedactionCount'
         OR evidence ->> 'completedRedactionCount'
           IS DISTINCT FROM NEW.record_json ->> 'completedRedactionCount'
         OR evidence ->> 'redactionReviewDigest'
           IS DISTINCT FROM NEW.record_json ->> 'redactionReviewDigest'
         OR evidence ->> 'title' IS DISTINCT FROM NEW.record_json ->> 'title'
         OR evidence ->> 'englishTranscriptText'
           IS DISTINCT FROM NEW.record_json ->> 'englishTranscriptText'
         OR evidence ->> 'classTopic'
           IS DISTINCT FROM NEW.record_json ->> 'classTopic'
         OR evidence -> 'mishnahReferences'
           IS DISTINCT FROM NEW.record_json -> 'mishnahReferences'
         OR evidence ->> 'occurredAt'
           IS DISTINCT FROM NEW.record_json ->> 'occurredAt'
         OR evidence ->> 'durationMs'
           IS DISTINCT FROM NEW.record_json ->> 'durationMs'
         OR COALESCE(evidence ->> 'projectionDigest', '')
           !~ '^[0-9a-f]{64}$'
         OR NOT onetime.valid_approved_publication_projection(
           evidence,
           NEW.account_key,
           NEW.product_key,
           NEW.content_id,
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
           NEW.content_id,
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
       NEW.content_id,
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
       NEW.content_id,
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
       NEW.content_id,
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
-- @postgres-only-end
