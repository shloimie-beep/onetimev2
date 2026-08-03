CREATE TABLE onetime.zoom_preparations (
  preparation_key text NOT NULL CHECK (preparation_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  occurrence_key text NOT NULL,
  schedule_version bigint NOT NULL CHECK (schedule_version > 0),
  roster_version bigint NOT NULL CHECK (roster_version > 0),
  preparation_state text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, preparation_key),
  CHECK (occurrence_key <> ''),
  CHECK (preparation_state IN (
    'draft', 'validating', 'preview_ready', 'confirmed', 'provisioning',
    'ready_to_notify', 'notifying', 'partial_failure', 'failed',
    'acceptance_unknown', 'invalidated', 'canceled', 'complete'
  ))
);

CREATE TABLE onetime.zoom_roster_snapshots (
  roster_snapshot_key text NOT NULL CHECK (roster_snapshot_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  occurrence_key text NOT NULL,
  schedule_version bigint NOT NULL CHECK (schedule_version > 0),
  roster_version bigint NOT NULL CHECK (roster_version > 0),
  roster_digest text NOT NULL,
  record_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, roster_snapshot_key),
  CHECK (occurrence_key <> ''),
  CHECK (
    length(roster_digest) = 64
    AND roster_digest = lower(roster_digest)
  )
);

CREATE TABLE onetime.zoom_classroom_resources (
  classroom_resource_key text NOT NULL CHECK (classroom_resource_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  occurrence_key text NOT NULL,
  resource_state text NOT NULL,
  provider_meeting_ref_digest text,
  provider_account_ref_hash text NOT NULL,
  registry_binding_key text NOT NULL,
  source_schedule_version bigint NOT NULL CHECK (source_schedule_version > 0),
  source_roster_version bigint NOT NULL CHECK (source_roster_version > 0),
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, classroom_resource_key),
  CHECK ((record_json ->> 'purpose') = 'normal_class'),
  CHECK ((record_json ->> 'provider') = 'zoom'),
  CHECK (
    length(provider_account_ref_hash) = 64
    AND provider_account_ref_hash = lower(provider_account_ref_hash)
  ),
  CHECK (
    provider_meeting_ref_digest IS NULL
    OR (
      length(provider_meeting_ref_digest) = 64
      AND provider_meeting_ref_digest = lower(provider_meeting_ref_digest)
    )
  )
);

CREATE TABLE onetime.zoom_student_registrants (
  registrant_key text NOT NULL CHECK (registrant_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  occurrence_key text NOT NULL,
  student_key text NOT NULL,
  household_key text NOT NULL,
  registrant_state text NOT NULL,
  provider_registrant_ref_digest text,
  technical_alias_digest text NOT NULL,
  source_student_version bigint NOT NULL CHECK (source_student_version > 0),
  source_enrollment_version bigint NOT NULL CHECK (source_enrollment_version > 0),
  source_roster_version bigint NOT NULL CHECK (source_roster_version > 0),
  version bigint NOT NULL CHECK (version > 0),
  record_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, registrant_key),
  CHECK (
    length(technical_alias_digest) = 64
    AND technical_alias_digest = lower(technical_alias_digest)
  ),
  CHECK (
    provider_registrant_ref_digest IS NULL
    OR (
      length(provider_registrant_ref_digest) = 64
      AND provider_registrant_ref_digest = lower(provider_registrant_ref_digest)
    )
  )
);

CREATE TABLE onetime.zoom_preparation_commands (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('prepare_preview', 'confirm_preparation')),
  result_ref text NOT NULL CHECK (result_ref <> ''),
  result_version bigint NOT NULL CHECK (result_version > 0),
  record_json jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, idempotency_key),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE INDEX zoom_preparations_state_idx
  ON onetime.zoom_preparations(account_key, product_key, updated_at);

CREATE INDEX zoom_registrants_occurrence_idx
  ON onetime.zoom_student_registrants(
    account_key,
    product_key,
    occurrence_key,
    student_key
  );

-- @postgres-only-begin
ALTER TABLE onetime.zoom_classroom_resources
  ADD CONSTRAINT zoom_resource_account_ref_hex_check
    CHECK (provider_account_ref_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT zoom_resource_meeting_ref_hex_check
    CHECK (
      provider_meeting_ref_digest IS NULL
      OR provider_meeting_ref_digest ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE onetime.zoom_roster_snapshots
  ADD CONSTRAINT zoom_roster_digest_hex_check
    CHECK (roster_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.zoom_student_registrants
  ADD CONSTRAINT zoom_registrant_alias_hex_check
    CHECK (technical_alias_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT zoom_registrant_provider_ref_hex_check
    CHECK (
      provider_registrant_ref_digest IS NULL
      OR provider_registrant_ref_digest ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE onetime.zoom_preparation_commands
  ADD CONSTRAINT zoom_preparation_command_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.bind_zoom_preparation_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.occurrence_key := NEW.record_json ->> 'occurrenceId';
  NEW.schedule_version := (NEW.record_json ->> 'scheduleVersion')::bigint;
  NEW.roster_version := (NEW.record_json ->> 'rosterVersion')::bigint;
  NEW.preparation_state := NEW.record_json ->> 'state';
  IF NEW.occurrence_key IS NULL
     OR NEW.occurrence_key = ''
     OR NEW.record_json ->> 'id' IS DISTINCT FROM NEW.preparation_key
     OR NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.record_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR NEW.schedule_version IS NULL
     OR NEW.schedule_version <= 0
     OR NEW.roster_version IS NULL
     OR NEW.roster_version <= 0 THEN
    RAISE EXCEPTION 'invalid zoom preparation scope';
  END IF;
  IF NEW.preparation_state IS NULL
     OR NEW.preparation_state NOT IN (
       'draft', 'validating', 'preview_ready', 'confirmed', 'provisioning',
       'ready_to_notify', 'notifying', 'partial_failure', 'failed',
       'acceptance_unknown', 'invalidated', 'canceled', 'complete'
     ) THEN
    RAISE EXCEPTION 'invalid zoom preparation state';
  END IF;
  IF NEW.preparation_state IN (
       'preview_ready', 'confirmed', 'provisioning', 'ready_to_notify',
       'notifying', 'partial_failure', 'acceptance_unknown', 'complete'
     )
     AND (
       jsonb_typeof(NEW.record_json -> 'preview') IS DISTINCT FROM 'object'
       OR NEW.record_json -> 'preview' ->> 'occurrenceId'
         IS DISTINCT FROM NEW.occurrence_key
       OR NEW.record_json -> 'preview' ->> 'scheduleVersion'
         IS DISTINCT FROM NEW.schedule_version::text
       OR COALESCE(NEW.record_json -> 'preview' ->> 'occurrenceVersion', '')
         !~ '^[1-9][0-9]*$'
       OR COALESCE(NEW.record_json -> 'preview' ->> 'rosterSnapshotId', '') = ''
       OR COALESCE(NEW.record_json -> 'preview' ->> 'rosterDigest', '')
         !~ '^[0-9a-f]{64}$'
       OR COALESCE(NEW.record_json -> 'preview' ->> 'digest', '')
         !~ '^[0-9a-f]{64}$'
     ) THEN
    RAISE EXCEPTION 'invalid zoom preparation preview evidence';
  END IF;
  IF NEW.preparation_state IN (
       'confirmed', 'provisioning', 'ready_to_notify', 'notifying',
       'partial_failure', 'acceptance_unknown', 'complete'
     )
     AND (
       COALESCE(NEW.record_json ->> 'confirmedPreviewDigest', '')
         !~ '^[0-9a-f]{64}$'
       OR NEW.record_json ->> 'confirmedPreviewDigest'
         IS DISTINCT FROM NEW.record_json -> 'preview' ->> 'digest'
       OR COALESCE(btrim(NEW.record_json ->> 'confirmedByAdminId'), '') = ''
     ) THEN
    RAISE EXCEPTION 'invalid zoom preparation confirmation evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_preparation_record_guard
BEFORE INSERT OR UPDATE ON onetime.zoom_preparations
FOR EACH ROW EXECUTE FUNCTION onetime.bind_zoom_preparation_record();

CREATE OR REPLACE FUNCTION onetime.valid_zoom_roster_entries(
  entries jsonb,
  expected_account_key text,
  expected_product_key text
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  item jsonb;
  student_key text;
  seen_student_keys text[] := ARRAY[]::text[];
  included_count integer := 0;
BEGIN
  IF entries IS NULL
     OR jsonb_typeof(entries) <> 'array'
     OR jsonb_array_length(entries) = 0 THEN
    RETURN false;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(entries)
  LOOP
    student_key := item ->> 'studentId';
    IF jsonb_typeof(item) <> 'object'
       OR COALESCE(btrim(student_key), '') = ''
       OR student_key = ANY(seen_student_keys)
       OR COALESCE(btrim(item ->> 'householdId'), '') = ''
       OR item ->> 'accountKey' IS DISTINCT FROM expected_account_key
       OR item ->> 'productKey' IS DISTINCT FROM expected_product_key
       OR COALESCE(item ->> 'decision', '') NOT IN ('included', 'excluded')
       OR COALESCE(item ->> 'safeReason', '') NOT IN (
         'eligible', 'student_inactive', 'enrollment_inactive',
         'series_mismatch', 'household_access_inactive',
         'service_account_consent_missing',
         'recording_participation_consent_missing'
       )
       OR COALESCE(btrim(item ->> 'approvedClassroomName'), '') = ''
       OR COALESCE(item ->> 'studentVersion', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(item ->> 'enrollmentVersion', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(item ->> 'householdAccessVersion', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(item ->> 'serviceAccountConsentVersion', '')
         !~ '^[1-9][0-9]*$'
       OR COALESCE(item ->> 'recordingParticipationConsentVersion', '')
         !~ '^[1-9][0-9]*$'
       OR COALESCE(item ->> 'memberRecognitionConsentVersion', '')
         !~ '^[1-9][0-9]*$'
       OR (
         item ->> 'decision' = 'included'
         AND item ->> 'safeReason' <> 'eligible'
       )
       OR (
         item ->> 'decision' = 'excluded'
         AND item ->> 'safeReason' = 'eligible'
       ) THEN
      RETURN false;
    END IF;
    seen_student_keys := array_append(seen_student_keys, student_key);
    IF item ->> 'decision' = 'included' THEN
      included_count := included_count + 1;
    END IF;
  END LOOP;
  RETURN included_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.bind_zoom_roster_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.occurrence_key := NEW.record_json ->> 'occurrenceId';
  NEW.schedule_version := (NEW.record_json ->> 'scheduleVersion')::bigint;
  NEW.roster_version := (NEW.record_json ->> 'rosterVersion')::bigint;
  NEW.roster_digest := NEW.record_json ->> 'digest';
  IF NEW.occurrence_key IS NULL
     OR NEW.occurrence_key = ''
     OR NEW.record_json ->> 'id' IS DISTINCT FROM NEW.roster_snapshot_key
     OR NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.schedule_version IS NULL
     OR NEW.schedule_version <= 0
     OR NEW.roster_version IS NULL
     OR NEW.roster_version <= 0
     OR NEW.roster_digest IS NULL
     OR length(NEW.roster_digest) <> 64
     OR NEW.roster_digest <> lower(NEW.roster_digest)
     OR NEW.roster_digest !~ '^[0-9a-f]{64}$'
     OR NOT onetime.valid_zoom_roster_entries(
       NEW.record_json -> 'entries',
       NEW.account_key,
       NEW.product_key
     ) THEN
    RAISE EXCEPTION 'invalid zoom roster snapshot scope';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_roster_record_guard
BEFORE INSERT ON onetime.zoom_roster_snapshots
FOR EACH ROW EXECUTE FUNCTION onetime.bind_zoom_roster_record();

CREATE OR REPLACE FUNCTION onetime.bind_zoom_resource_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.occurrence_key := NEW.record_json ->> 'occurrenceId';
  NEW.resource_state := NEW.record_json ->> 'state';
  NEW.provider_meeting_ref_digest := NULLIF(
    NEW.record_json ->> 'providerMeetingRefDigest',
    ''
  );
  NEW.provider_account_ref_hash := NEW.record_json ->> 'providerAccountRefHash';
  NEW.registry_binding_key := NEW.record_json ->> 'registryBindingKey';
  NEW.source_schedule_version := (
    NEW.record_json ->> 'sourceScheduleVersion'
  )::bigint;
  NEW.source_roster_version := (
    NEW.record_json ->> 'sourceRosterVersion'
  )::bigint;
  IF NEW.occurrence_key IS NULL
     OR NEW.occurrence_key = ''
     OR NEW.record_json ->> 'id' IS DISTINCT FROM NEW.classroom_resource_key
     OR NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.record_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR (NEW.record_json ->> 'purpose') IS DISTINCT FROM 'normal_class'
     OR (NEW.record_json ->> 'provider') IS DISTINCT FROM 'zoom'
     OR NEW.resource_state IS NULL
     OR NEW.resource_state NOT IN (
       'not_provisioned', 'provisioning', 'active', 'failed',
       'acceptance_unknown', 'closed', 'deleted'
     )
     OR NEW.provider_account_ref_hash IS NULL
     OR length(NEW.provider_account_ref_hash) <> 64
     OR NEW.provider_account_ref_hash <> lower(NEW.provider_account_ref_hash)
     OR NEW.registry_binding_key IS NULL
     OR NEW.registry_binding_key = ''
     OR NEW.source_schedule_version IS NULL
     OR NEW.source_schedule_version <= 0
     OR NEW.source_roster_version IS NULL
     OR NEW.source_roster_version <= 0 THEN
    RAISE EXCEPTION 'invalid zoom classroom resource';
  END IF;
  IF NEW.provider_meeting_ref_digest IS NOT NULL
     AND (
       length(NEW.provider_meeting_ref_digest) <> 64
       OR NEW.provider_meeting_ref_digest <> lower(NEW.provider_meeting_ref_digest)
     ) THEN
    RAISE EXCEPTION 'invalid protected meeting reference';
  END IF;
  IF NEW.resource_state = 'active'
     AND NEW.provider_meeting_ref_digest IS NULL THEN
    RAISE EXCEPTION 'active zoom classroom requires verified provider evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_resource_record_guard
BEFORE INSERT OR UPDATE ON onetime.zoom_classroom_resources
FOR EACH ROW EXECUTE FUNCTION onetime.bind_zoom_resource_record();

CREATE OR REPLACE FUNCTION onetime.bind_zoom_registrant_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.occurrence_key := NEW.record_json ->> 'occurrenceId';
  NEW.student_key := NEW.record_json ->> 'studentId';
  NEW.household_key := NEW.record_json ->> 'householdId';
  NEW.registrant_state := NEW.record_json ->> 'state';
  NEW.provider_registrant_ref_digest := NULLIF(
    NEW.record_json ->> 'providerRegistrantRefDigest',
    ''
  );
  NEW.technical_alias_digest := NEW.record_json ->> 'technicalAliasDigest';
  NEW.source_student_version := (
    NEW.record_json ->> 'sourceStudentVersion'
  )::bigint;
  NEW.source_enrollment_version := (
    NEW.record_json ->> 'sourceEnrollmentVersion'
  )::bigint;
  NEW.source_roster_version := (
    NEW.record_json ->> 'sourceRosterVersion'
  )::bigint;
  IF NEW.occurrence_key IS NULL
     OR NEW.occurrence_key = ''
     OR NEW.record_json ->> 'id' IS DISTINCT FROM NEW.registrant_key
     OR NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.record_json ->> 'version' IS DISTINCT FROM NEW.version::text
     OR NEW.student_key IS NULL
     OR NEW.student_key = ''
     OR NEW.household_key IS NULL
     OR NEW.household_key = ''
     OR NEW.registrant_state IS NULL
     OR NEW.registrant_state NOT IN (
       'pending', 'provisioning', 'active', 'failed',
       'acceptance_unknown', 'revoked'
     )
     OR NEW.technical_alias_digest IS NULL
     OR length(NEW.technical_alias_digest) <> 64
     OR NEW.technical_alias_digest <> lower(NEW.technical_alias_digest)
     OR NEW.source_student_version IS NULL
     OR NEW.source_student_version <= 0
     OR NEW.source_enrollment_version IS NULL
     OR NEW.source_enrollment_version <= 0
     OR NEW.source_roster_version IS NULL
     OR NEW.source_roster_version <= 0 THEN
    RAISE EXCEPTION 'invalid zoom Student registrant';
  END IF;
  IF NEW.provider_registrant_ref_digest IS NOT NULL
     AND (
       length(NEW.provider_registrant_ref_digest) <> 64
       OR NEW.provider_registrant_ref_digest <> lower(
         NEW.provider_registrant_ref_digest
       )
     ) THEN
    RAISE EXCEPTION 'invalid protected registrant reference';
  END IF;
  IF NEW.registrant_state = 'active'
     AND NEW.provider_registrant_ref_digest IS NULL THEN
    RAISE EXCEPTION 'active zoom registrant requires verified provider evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_registrant_record_guard
BEFORE INSERT OR UPDATE ON onetime.zoom_student_registrants
FOR EACH ROW EXECUTE FUNCTION onetime.bind_zoom_registrant_record();

CREATE OR REPLACE FUNCTION onetime.validate_zoom_preparation_command()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_hash !~ '^[0-9a-f]{64}$'
     OR NEW.record_json ->> 'accountKey' IS DISTINCT FROM NEW.account_key
     OR NEW.record_json ->> 'productKey' IS DISTINCT FROM NEW.product_key
     OR NEW.record_json ->> 'idempotencyKey' IS DISTINCT FROM NEW.idempotency_key
     OR NEW.record_json ->> 'requestHash' IS DISTINCT FROM NEW.request_hash
     OR NEW.record_json ->> 'operation' IS DISTINCT FROM NEW.operation
     OR NEW.record_json ->> 'resultRef' IS DISTINCT FROM NEW.result_ref
     OR NEW.record_json ->> 'resultVersion' IS DISTINCT FROM NEW.result_version::text
     OR (NEW.record_json ->> 'committedAt')::timestamptz
       IS DISTINCT FROM NEW.committed_at THEN
    RAISE EXCEPTION 'invalid zoom preparation command receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_preparation_command_guard
BEFORE INSERT ON onetime.zoom_preparation_commands
FOR EACH ROW EXECUTE FUNCTION onetime.validate_zoom_preparation_command();

CREATE UNIQUE INDEX zoom_preparation_scope_version_idx
  ON onetime.zoom_preparations(
    account_key,
    product_key,
    occurrence_key,
    schedule_version,
    roster_version
  );

CREATE UNIQUE INDEX zoom_roster_scope_version_idx
  ON onetime.zoom_roster_snapshots(
    account_key,
    product_key,
    occurrence_key,
    schedule_version,
    roster_version
  );

CREATE UNIQUE INDEX zoom_current_resource_idx
  ON onetime.zoom_classroom_resources(account_key, product_key, occurrence_key)
  WHERE resource_state NOT IN ('closed', 'deleted');

CREATE UNIQUE INDEX zoom_current_registrant_idx
  ON onetime.zoom_student_registrants(
    account_key,
    product_key,
    occurrence_key,
    student_key
  )
  WHERE registrant_state <> 'revoked';

CREATE OR REPLACE FUNCTION onetime.reject_zoom_preparation_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'zoom preparation evidence is append-only';
END;
$$;

CREATE TRIGGER zoom_roster_snapshots_append_only
BEFORE UPDATE OR DELETE ON onetime.zoom_roster_snapshots
FOR EACH ROW EXECUTE FUNCTION onetime.reject_zoom_preparation_evidence_mutation();

CREATE TRIGGER zoom_preparation_commands_append_only
BEFORE UPDATE OR DELETE ON onetime.zoom_preparation_commands
FOR EACH ROW EXECUTE FUNCTION onetime.reject_zoom_preparation_evidence_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_zoom_preparation_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'zoom preparation optimistic version conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_zoom_preparation_saga_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'zoom preparation optimistic version conflict';
  END IF;
  IF NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
     OR NEW.schedule_version IS DISTINCT FROM OLD.schedule_version
     OR NEW.roster_version IS DISTINCT FROM OLD.roster_version THEN
    RAISE EXCEPTION 'zoom preparation scope is immutable';
  END IF;
  IF OLD.record_json -> 'preview' IS NOT NULL
     AND NEW.record_json -> 'preview' IS DISTINCT FROM OLD.record_json -> 'preview' THEN
    RAISE EXCEPTION 'zoom preparation preview evidence is immutable';
  END IF;
  IF OLD.record_json ->> 'confirmedPreviewDigest' IS NOT NULL
     AND (
       NEW.record_json ->> 'confirmedPreviewDigest'
         IS DISTINCT FROM OLD.record_json ->> 'confirmedPreviewDigest'
       OR NEW.record_json ->> 'confirmedByAdminId'
         IS DISTINCT FROM OLD.record_json ->> 'confirmedByAdminId'
     ) THEN
    RAISE EXCEPTION 'zoom preparation confirmation evidence is immutable';
  END IF;
  IF NEW.preparation_state = 'confirmed' THEN
    IF NEW.record_json ->> 'confirmedPreviewDigest' IS NULL
       OR length(NEW.record_json ->> 'confirmedPreviewDigest') <> 64
       OR NEW.record_json ->> 'confirmedPreviewDigest' !~ '^[0-9a-f]{64}$'
       OR NEW.record_json ->> 'confirmedPreviewDigest' <> lower(
         NEW.record_json ->> 'confirmedPreviewDigest'
       )
       OR NEW.record_json ->> 'confirmedByAdminId' IS NULL
       OR btrim(NEW.record_json ->> 'confirmedByAdminId') = ''
       OR NEW.record_json -> 'preview' ->> 'digest' IS NULL
       OR NEW.record_json -> 'preview' ->> 'digest'
         IS DISTINCT FROM NEW.record_json ->> 'confirmedPreviewDigest' THEN
      RAISE EXCEPTION 'invalid zoom preparation confirmation evidence';
    END IF;
  END IF;
  transition_allowed := NEW.preparation_state = OLD.preparation_state
    OR CASE OLD.preparation_state
      WHEN 'draft' THEN NEW.preparation_state IN (
        'validating', 'preview_ready', 'failed', 'invalidated', 'canceled'
      )
      WHEN 'validating' THEN NEW.preparation_state IN (
        'preview_ready', 'failed', 'invalidated', 'canceled'
      )
      WHEN 'preview_ready' THEN NEW.preparation_state IN (
        'confirmed', 'failed', 'invalidated', 'canceled'
      )
      WHEN 'confirmed' THEN NEW.preparation_state IN (
        'provisioning', 'failed', 'invalidated', 'canceled'
      )
      WHEN 'provisioning' THEN NEW.preparation_state IN (
        'ready_to_notify', 'partial_failure', 'failed',
        'acceptance_unknown', 'invalidated', 'canceled'
      )
      WHEN 'ready_to_notify' THEN NEW.preparation_state IN (
        'notifying', 'complete', 'partial_failure', 'failed',
        'invalidated', 'canceled'
      )
      WHEN 'notifying' THEN NEW.preparation_state IN (
        'complete', 'partial_failure', 'failed',
        'acceptance_unknown', 'invalidated', 'canceled'
      )
      WHEN 'partial_failure' THEN NEW.preparation_state IN (
        'provisioning', 'notifying', 'failed',
        'acceptance_unknown', 'invalidated', 'canceled'
      )
      WHEN 'failed' THEN NEW.preparation_state IN (
        'validating', 'provisioning', 'notifying', 'invalidated', 'canceled'
      )
      ELSE false
    END;
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'illegal zoom preparation state transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_preparations_version_step
BEFORE UPDATE ON onetime.zoom_preparations
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_zoom_preparation_saga_update();

CREATE OR REPLACE FUNCTION onetime.enforce_zoom_resource_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'zoom preparation optimistic version conflict';
  END IF;
  IF NEW.classroom_resource_key IS DISTINCT FROM OLD.classroom_resource_key
     OR NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
     OR NEW.provider_account_ref_hash IS DISTINCT FROM OLD.provider_account_ref_hash
     OR NEW.registry_binding_key IS DISTINCT FROM OLD.registry_binding_key
     OR NEW.source_schedule_version IS DISTINCT FROM OLD.source_schedule_version
     OR NEW.source_roster_version IS DISTINCT FROM OLD.source_roster_version
     OR NEW.record_json ->> 'purpose' IS DISTINCT FROM OLD.record_json ->> 'purpose'
     OR NEW.record_json ->> 'provider' IS DISTINCT FROM OLD.record_json ->> 'provider'
     OR NEW.record_json ->> 'scope' IS DISTINCT FROM OLD.record_json ->> 'scope' THEN
    RAISE EXCEPTION 'zoom classroom resource scope or source evidence is immutable';
  END IF;
  IF OLD.provider_meeting_ref_digest IS NOT NULL
     AND NEW.provider_meeting_ref_digest
       IS DISTINCT FROM OLD.provider_meeting_ref_digest THEN
    RAISE EXCEPTION 'zoom classroom provider evidence is immutable';
  END IF;
  IF NEW.resource_state = 'active'
     AND NEW.provider_meeting_ref_digest IS NULL THEN
    RAISE EXCEPTION 'active zoom classroom requires verified provider evidence';
  END IF;
  transition_allowed := NEW.resource_state = OLD.resource_state
    OR CASE OLD.resource_state
      WHEN 'not_provisioned' THEN NEW.resource_state = 'provisioning'
      WHEN 'provisioning' THEN NEW.resource_state IN (
        'active', 'failed', 'acceptance_unknown'
      )
      WHEN 'failed' THEN NEW.resource_state = 'provisioning'
      WHEN 'active' THEN NEW.resource_state IN ('closed', 'deleted')
      WHEN 'closed' THEN NEW.resource_state = 'deleted'
      ELSE false
    END;
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'illegal zoom classroom resource state transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_zoom_registrant_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'zoom preparation optimistic version conflict';
  END IF;
  IF NEW.registrant_key IS DISTINCT FROM OLD.registrant_key
     OR NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
     OR NEW.student_key IS DISTINCT FROM OLD.student_key
     OR NEW.household_key IS DISTINCT FROM OLD.household_key
     OR NEW.technical_alias_digest IS DISTINCT FROM OLD.technical_alias_digest
     OR NEW.source_student_version IS DISTINCT FROM OLD.source_student_version
     OR NEW.source_enrollment_version IS DISTINCT FROM OLD.source_enrollment_version
     OR NEW.source_roster_version IS DISTINCT FROM OLD.source_roster_version
     OR NEW.record_json ->> 'classroomResourceId'
       IS DISTINCT FROM OLD.record_json ->> 'classroomResourceId'
     OR NEW.record_json ->> 'provisioningIdempotencyKey'
       IS DISTINCT FROM OLD.record_json ->> 'provisioningIdempotencyKey' THEN
    RAISE EXCEPTION 'zoom registrant scope or source evidence is immutable';
  END IF;
  IF OLD.provider_registrant_ref_digest IS NOT NULL
     AND NEW.provider_registrant_ref_digest
       IS DISTINCT FROM OLD.provider_registrant_ref_digest THEN
    RAISE EXCEPTION 'zoom registrant provider evidence is immutable';
  END IF;
  IF NEW.registrant_state = 'active'
     AND NEW.provider_registrant_ref_digest IS NULL THEN
    RAISE EXCEPTION 'active zoom registrant requires verified provider evidence';
  END IF;
  transition_allowed := NEW.registrant_state = OLD.registrant_state
    OR CASE OLD.registrant_state
      WHEN 'pending' THEN NEW.registrant_state IN ('provisioning', 'revoked')
      WHEN 'provisioning' THEN NEW.registrant_state IN (
        'active', 'failed', 'acceptance_unknown', 'revoked'
      )
      WHEN 'failed' THEN NEW.registrant_state IN ('provisioning', 'revoked')
      WHEN 'active' THEN NEW.registrant_state = 'revoked'
      ELSE false
    END;
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'illegal zoom registrant state transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zoom_resources_version_step
BEFORE UPDATE ON onetime.zoom_classroom_resources
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_zoom_resource_update();

CREATE TRIGGER zoom_registrants_version_step
BEFORE UPDATE ON onetime.zoom_student_registrants
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_zoom_registrant_update();
-- @postgres-only-end
