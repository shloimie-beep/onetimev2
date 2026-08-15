CREATE TABLE onetime.production_basic_attendance_sessions (
  attendance_session_key_digest text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  occurrence_key text NOT NULL,
  learner_key text NOT NULL,
  authenticated_session_key text NOT NULL CHECK (authenticated_session_key <> ''),
  connection_lineage_id text NOT NULL,
  meeting_ref_digest text NOT NULL,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  joined_observed_at timestamptz,
  left_observed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  CHECK (scheduled_end_at > scheduled_start_at),
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '4 hours'),
  CHECK (
    length(attendance_session_key_digest) = 64
    AND attendance_session_key_digest = lower(attendance_session_key_digest)
  ),
  CHECK (
    length(connection_lineage_id) = 64
    AND connection_lineage_id = lower(connection_lineage_id)
  ),
  CHECK (
    length(meeting_ref_digest) = 64
    AND meeting_ref_digest = lower(meeting_ref_digest)
  ),
  CHECK (joined_observed_at IS NULL OR joined_observed_at >= issued_at),
  CHECK (left_observed_at IS NULL OR joined_observed_at IS NOT NULL),
  CHECK (left_observed_at IS NULL OR left_observed_at >= joined_observed_at),
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

CREATE INDEX production_basic_attendance_actor_idx
  ON onetime.production_basic_attendance_sessions (
    account_key,
    product_key,
    learner_key,
    authenticated_session_key,
    expires_at DESC
  );

CREATE INDEX production_basic_attendance_expiry_idx
  ON onetime.production_basic_attendance_sessions (expires_at, attendance_session_key_digest);

SELECT 1;
