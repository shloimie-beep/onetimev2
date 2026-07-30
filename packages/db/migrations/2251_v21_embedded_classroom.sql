CREATE TABLE onetime.classroom_launch_grants_v21 (
  grant_id text PRIMARY KEY CHECK (grant_id <> ''),
  grant_key_digest text NOT NULL,
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  authenticated_session_id text NOT NULL CHECK (authenticated_session_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  registrant_id text NOT NULL CHECK (registrant_id <> ''),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  student_version bigint NOT NULL CHECK (student_version > 0),
  enrollment_version bigint NOT NULL CHECK (enrollment_version > 0),
  access_version bigint NOT NULL CHECK (access_version > 0),
  consent_version_digest text NOT NULL,
  registrant_version bigint NOT NULL CHECK (registrant_version > 0),
  occurrence_version bigint NOT NULL CHECK (occurrence_version > 0),
  version bigint NOT NULL CHECK (version > 0),
  UNIQUE (
    product,
    runtime_tier,
    verification_environment_id,
    grant_key_digest
  ),
  CHECK (length(grant_key_digest) = 64 AND grant_key_digest = lower(grant_key_digest)),
  CHECK (
    length(consent_version_digest) = 64
    AND consent_version_digest = lower(consent_version_digest)
  ),
  CHECK (expires_at = issued_at + interval '60 seconds'),
  CHECK (used_at IS NULL OR used_at BETWEEN issued_at AND expires_at),
  CHECK (used_at IS NULL OR revoked_at IS NULL),
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

CREATE TABLE onetime.live_student_classroom_sessions (
  live_session_id text PRIMARY KEY CHECK (live_session_id <> ''),
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  student_id text NOT NULL CHECK (student_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  authenticated_session_id text NOT NULL CHECK (authenticated_session_id <> ''),
  device_lineage_id text NOT NULL CHECK (device_lineage_id <> ''),
  state text NOT NULL CHECK (state IN ('active', 'revoked', 'expired')),
  lease_generation bigint NOT NULL CHECK (lease_generation > 0),
  last_heartbeat_at timestamptz NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by_admin_id text,
  revoke_audit_ref text,
  version bigint NOT NULL CHECK (version > 0),
  CHECK (lease_expires_at = last_heartbeat_at + interval '90 seconds'),
  CHECK (
    (state = 'revoked'
      AND revoked_at IS NOT NULL
      AND revoked_by_admin_id IS NOT NULL
      AND btrim(revoked_by_admin_id) <> ''
      AND revoke_audit_ref IS NOT NULL
      AND btrim(revoke_audit_ref) <> '')
    OR
    (state <> 'revoked'
      AND revoked_at IS NULL
      AND revoked_by_admin_id IS NULL
      AND revoke_audit_ref IS NULL)
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

CREATE TABLE onetime.classroom_attendance_events_v21 (
  attendance_event_id text PRIMARY KEY CHECK (attendance_event_id <> ''),
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  student_id text NOT NULL CHECK (student_id <> ''),
  source text NOT NULL CHECK (source IN (
    'zoom_provider',
    'embedded_client',
    'admin_correction'
  )),
  event_kind text NOT NULL CHECK (event_kind IN (
    'joined',
    'left',
    'manual_correction'
  )),
  observed_at timestamptz NOT NULL,
  connection_lineage_id text NOT NULL CHECK (connection_lineage_id <> ''),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  source_event_ref_digest text NOT NULL,
  provider_verified boolean NOT NULL,
  correction_intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  correction_reason text,
  correction_admin_id text,
  audit_ref text,
  UNIQUE (
    product,
    runtime_tier,
    verification_environment_id,
    idempotency_key
  ),
  CHECK (
    length(source_event_ref_digest) = 64
    AND source_event_ref_digest = lower(source_event_ref_digest)
  ),
  CHECK (
    (source = 'admin_correction'
      AND event_kind = 'manual_correction'
      AND correction_reason IS NOT NULL
      AND btrim(correction_reason) <> ''
      AND correction_admin_id IS NOT NULL
      AND btrim(correction_admin_id) <> ''
      AND audit_ref IS NOT NULL
      AND btrim(audit_ref) <> '')
    OR
    (source <> 'admin_correction'
      AND event_kind <> 'manual_correction'
      AND correction_reason IS NULL
      AND correction_admin_id IS NULL
      AND audit_ref IS NULL
      AND correction_intervals = '[]'::jsonb)
  ),
  CHECK (source = 'zoom_provider' OR provider_verified = false),
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

CREATE TABLE onetime.classroom_attendance_projection_v21 (
  product text NOT NULL CHECK (product = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  student_id text NOT NULL CHECK (student_id <> ''),
  first_joined_at timestamptz,
  last_left_at timestamptz,
  total_connected_minutes numeric(10, 3) NOT NULL CHECK (total_connected_minutes >= 0),
  attendance_percentage numeric(6, 3) NOT NULL CHECK (
    attendance_percentage BETWEEN 0 AND 100
  ),
  reconnect_count integer NOT NULL CHECK (reconnect_count >= 0),
  late boolean NOT NULL,
  reconciliation_state text NOT NULL CHECK (reconciliation_state IN (
    'provisional',
    'provider_verified',
    'provider_mismatch',
    'admin_corrected'
  )),
  manual_correction_reason text,
  correction_admin_id text,
  source_event_count bigint NOT NULL CHECK (source_event_count > 0),
  version bigint NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (
    product,
    runtime_tier,
    verification_environment_id,
    occurrence_id,
    student_id
  ),
  CHECK (last_left_at IS NULL OR first_joined_at IS NOT NULL),
  CHECK (last_left_at IS NULL OR last_left_at >= first_joined_at),
  CHECK (
    (reconciliation_state = 'admin_corrected'
      AND manual_correction_reason IS NOT NULL
      AND btrim(manual_correction_reason) <> ''
      AND correction_admin_id IS NOT NULL
      AND btrim(correction_admin_id) <> '')
    OR
    (reconciliation_state <> 'admin_corrected'
      AND manual_correction_reason IS NULL
      AND correction_admin_id IS NULL)
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

CREATE UNIQUE INDEX live_student_classroom_active_idx
  ON onetime.live_student_classroom_sessions(
    product,
    runtime_tier,
    verification_environment_id,
    student_id
  )
  WHERE state = 'active';

CREATE INDEX live_student_classroom_expiry_idx
  ON onetime.live_student_classroom_sessions(
    product,
    runtime_tier,
    verification_environment_id,
    state,
    lease_expires_at
  );

CREATE INDEX classroom_attendance_event_scope_idx
  ON onetime.classroom_attendance_events_v21(
    product,
    runtime_tier,
    verification_environment_id,
    occurrence_id,
    student_id,
    observed_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.classroom_launch_grants_v21
  ADD CONSTRAINT classroom_launch_grant_digest_hex_check
    CHECK (grant_key_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT classroom_launch_consent_digest_hex_check
    CHECK (consent_version_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.classroom_attendance_events_v21
  ADD CONSTRAINT classroom_attendance_source_digest_hex_check
    CHECK (source_event_ref_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.valid_attendance_correction_intervals(
  intervals jsonb
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  item jsonb;
  joined_at timestamptz;
  left_at timestamptz;
BEGIN
  IF intervals IS NULL
     OR jsonb_typeof(intervals) <> 'array'
     OR jsonb_array_length(intervals) = 0 THEN
    RETURN false;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(intervals)
  LOOP
    IF jsonb_typeof(item) <> 'object'
       OR item ->> 'joined_at' IS NULL
       OR item ->> 'left_at' IS NULL THEN
      RETURN false;
    END IF;
    BEGIN
      joined_at := (item ->> 'joined_at')::timestamptz;
      left_at := (item ->> 'left_at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
    IF left_at <= joined_at THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE onetime.classroom_attendance_events_v21
  ADD CONSTRAINT classroom_attendance_correction_intervals_check
    CHECK (
      (source = 'admin_correction'
        AND onetime.valid_attendance_correction_intervals(correction_intervals))
      OR
      (source <> 'admin_correction' AND correction_intervals = '[]'::jsonb)
    );

CREATE OR REPLACE FUNCTION onetime.reject_embedded_attendance_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'embedded classroom attendance events are append-only';
END;
$$;

CREATE TRIGGER classroom_attendance_events_v21_append_only
BEFORE UPDATE OR DELETE ON onetime.classroom_attendance_events_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_embedded_attendance_event_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_embedded_classroom_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'embedded classroom optimistic version conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_classroom_launch_grant_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'embedded classroom optimistic version conflict';
  END IF;
  IF NEW.grant_id IS DISTINCT FROM OLD.grant_id
     OR NEW.grant_key_digest IS DISTINCT FROM OLD.grant_key_digest
     OR NEW.product IS DISTINCT FROM OLD.product
     OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
     OR NEW.verification_environment_id
       IS DISTINCT FROM OLD.verification_environment_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.authenticated_session_id IS DISTINCT FROM OLD.authenticated_session_id
     OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
     OR NEW.registrant_id IS DISTINCT FROM OLD.registrant_id
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.student_version IS DISTINCT FROM OLD.student_version
     OR NEW.enrollment_version IS DISTINCT FROM OLD.enrollment_version
     OR NEW.access_version IS DISTINCT FROM OLD.access_version
     OR NEW.consent_version_digest IS DISTINCT FROM OLD.consent_version_digest
     OR NEW.registrant_version IS DISTINCT FROM OLD.registrant_version
     OR NEW.occurrence_version IS DISTINCT FROM OLD.occurrence_version THEN
    RAISE EXCEPTION 'embedded classroom launch grant evidence is immutable';
  END IF;
  IF OLD.used_at IS NOT NULL
     AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
    RAISE EXCEPTION 'consumed classroom launch grant cannot be reset';
  END IF;
  IF OLD.revoked_at IS NOT NULL
     AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'revoked classroom launch grant cannot be reset';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_live_classroom_session_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  generation_advanced boolean;
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'embedded classroom optimistic version conflict';
  END IF;
  IF NEW.product IS DISTINCT FROM OLD.product
     OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
     OR NEW.verification_environment_id
       IS DISTINCT FROM OLD.verification_environment_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'live classroom Student scope is immutable';
  END IF;
  IF OLD.state = 'revoked' THEN
    RAISE EXCEPTION 'revoked live classroom audit evidence is immutable';
  END IF;
  IF NEW.lease_generation < OLD.lease_generation
     OR NEW.lease_generation > OLD.lease_generation + 1 THEN
    RAISE EXCEPTION 'live classroom lease generation regression';
  END IF;
  IF NEW.last_heartbeat_at < OLD.last_heartbeat_at THEN
    RAISE EXCEPTION 'live classroom heartbeat regression';
  END IF;
  generation_advanced := NEW.lease_generation = OLD.lease_generation + 1;
  IF generation_advanced THEN
    IF NEW.state <> 'active'
       OR NEW.last_heartbeat_at < OLD.lease_expires_at
       OR NEW.last_heartbeat_at <= OLD.last_heartbeat_at
       OR NEW.revoked_at IS NOT NULL
       OR NEW.revoked_by_admin_id IS NOT NULL
       OR NEW.revoke_audit_ref IS NOT NULL THEN
      RAISE EXCEPTION 'invalid live classroom lease reacquisition';
    END IF;
  ELSE
    IF NEW.live_session_id IS DISTINCT FROM OLD.live_session_id
       OR NEW.household_id IS DISTINCT FROM OLD.household_id
       OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
       OR NEW.authenticated_session_id
         IS DISTINCT FROM OLD.authenticated_session_id
       OR NEW.device_lineage_id IS DISTINCT FROM OLD.device_lineage_id THEN
      RAISE EXCEPTION 'live classroom lineage changed without new generation';
    END IF;
    transition_allowed := NEW.state = OLD.state
      OR (OLD.state = 'active' AND NEW.state IN ('revoked', 'expired'));
    IF NOT transition_allowed THEN
      RAISE EXCEPTION 'live classroom session state regression';
    END IF;
    IF NEW.state = 'active'
       AND NEW.last_heartbeat_at <= OLD.last_heartbeat_at THEN
      RAISE EXCEPTION 'live classroom heartbeat did not advance';
    END IF;
    IF NEW.state = 'revoked'
       AND NEW.revoked_at < OLD.last_heartbeat_at THEN
      RAISE EXCEPTION 'live classroom revocation timestamp regressed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.enforce_attendance_projection_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  facts_changed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'embedded classroom optimistic version conflict';
  END IF;
  IF NEW.product IS DISTINCT FROM OLD.product
     OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
     OR NEW.verification_environment_id
       IS DISTINCT FROM OLD.verification_environment_id
     OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'attendance projection scope is immutable';
  END IF;
  IF NEW.source_event_count < OLD.source_event_count
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'attendance projection source evidence regressed';
  END IF;
  IF OLD.reconciliation_state = 'admin_corrected'
     AND NEW.reconciliation_state <> 'admin_corrected' THEN
    RAISE EXCEPTION 'attendance correction audit evidence cannot be cleared';
  END IF;
  IF OLD.reconciliation_state IN (
       'provider_verified', 'provider_mismatch', 'admin_corrected'
     )
     AND NEW.reconciliation_state = 'provisional' THEN
    RAISE EXCEPTION 'attendance reconciliation evidence cannot regress';
  END IF;
  facts_changed :=
    NEW.first_joined_at IS DISTINCT FROM OLD.first_joined_at
    OR NEW.last_left_at IS DISTINCT FROM OLD.last_left_at
    OR NEW.total_connected_minutes IS DISTINCT FROM OLD.total_connected_minutes
    OR NEW.attendance_percentage IS DISTINCT FROM OLD.attendance_percentage
    OR NEW.reconnect_count IS DISTINCT FROM OLD.reconnect_count
    OR NEW.late IS DISTINCT FROM OLD.late
    OR NEW.reconciliation_state IS DISTINCT FROM OLD.reconciliation_state
    OR NEW.manual_correction_reason IS DISTINCT FROM OLD.manual_correction_reason
    OR NEW.correction_admin_id IS DISTINCT FROM OLD.correction_admin_id;
  IF facts_changed
     AND NEW.source_event_count = OLD.source_event_count THEN
    RAISE EXCEPTION 'attendance projection changed without new source evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION onetime.validate_attendance_projection_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  matching_event_count bigint;
  verified_provider_count bigint;
  embedded_client_count bigint;
  matching_correction_count bigint;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (
      WHERE source = 'zoom_provider' AND provider_verified = TRUE
    ),
    count(*) FILTER (
      WHERE source = 'embedded_client'
    ),
    count(*) FILTER (
      WHERE source = 'admin_correction'
        AND correction_reason IS NOT DISTINCT FROM NEW.manual_correction_reason
        AND correction_admin_id IS NOT DISTINCT FROM NEW.correction_admin_id
    )
  INTO
    matching_event_count,
    verified_provider_count,
    embedded_client_count,
    matching_correction_count
  FROM onetime.classroom_attendance_events_v21
  WHERE product = NEW.product
    AND runtime_tier = NEW.runtime_tier
    AND verification_environment_id = NEW.verification_environment_id
    AND occurrence_id = NEW.occurrence_id
    AND student_id = NEW.student_id;

  IF NEW.source_event_count <= 0
     OR NEW.source_event_count <> matching_event_count THEN
    RAISE EXCEPTION 'attendance projection must bind every exact source event';
  END IF;
  IF NEW.reconciliation_state = 'provisional'
     AND (
       embedded_client_count = 0
       OR verified_provider_count <> 0
       OR matching_correction_count <> 0
     ) THEN
    RAISE EXCEPTION 'provisional attendance requires only embedded source evidence';
  END IF;
  IF NEW.reconciliation_state = 'provider_verified'
     AND (
       verified_provider_count = 0
       OR matching_correction_count <> 0
     ) THEN
    RAISE EXCEPTION 'provider-verified attendance requires provider source evidence';
  END IF;
  IF NEW.reconciliation_state = 'provider_mismatch'
     AND (
       verified_provider_count = 0
       OR embedded_client_count = 0
       OR matching_correction_count <> 0
     ) THEN
    RAISE EXCEPTION 'attendance mismatch requires provider and embedded source evidence';
  END IF;
  IF NEW.reconciliation_state = 'admin_corrected'
     AND matching_correction_count = 0 THEN
    RAISE EXCEPTION 'corrected attendance requires matching audited correction evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER classroom_launch_grants_v21_version_step
BEFORE UPDATE ON onetime.classroom_launch_grants_v21
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_classroom_launch_grant_update();

CREATE TRIGGER live_student_classroom_sessions_version_step
BEFORE UPDATE ON onetime.live_student_classroom_sessions
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_live_classroom_session_update();

CREATE TRIGGER classroom_attendance_projection_v21_version_step
BEFORE UPDATE ON onetime.classroom_attendance_projection_v21
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_attendance_projection_update();

CREATE TRIGGER classroom_attendance_projection_v21_evidence_guard
BEFORE INSERT OR UPDATE ON onetime.classroom_attendance_projection_v21
FOR EACH ROW EXECUTE FUNCTION onetime.validate_attendance_projection_evidence();
-- @postgres-only-end
