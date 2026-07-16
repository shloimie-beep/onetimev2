ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS join_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS join_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS timezone_snapshot text NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN IF NOT EXISTS schedule_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS classroom_policy_version text NOT NULL DEFAULT 'ot88-classroom-v1',
  ADD COLUMN IF NOT EXISTS superseded_by_occurrence_key text;

UPDATE onetime.class_occurrences
   SET join_opens_at = COALESCE(join_opens_at, starts_at - interval '15 minutes'),
       scheduled_ends_at = COALESCE(scheduled_ends_at, starts_at + interval '60 minutes'),
       join_closes_at = COALESCE(join_closes_at, joinable_until),
       timezone_snapshot = COALESCE(timezone_snapshot, 'Asia/Jerusalem'),
       classroom_policy_version = COALESCE(classroom_policy_version, 'ot88-classroom-v1')
 WHERE join_opens_at IS NULL
    OR join_closes_at IS NULL
    OR scheduled_ends_at IS NULL
    OR timezone_snapshot IS NULL
    OR classroom_policy_version IS NULL;

CREATE TABLE onetime.classroom_household_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  entitlement_state text NOT NULL DEFAULT 'active'
    CHECK (entitlement_state IN ('active', 'suspended', 'revoked')),
  max_named_learners integer NOT NULL DEFAULT 3 CHECK (max_named_learners = 3),
  source text NOT NULL DEFAULT 'fixture_subscription',
  policy_version text NOT NULL DEFAULT 'ot88-classroom-entitlement-v1',
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  UNIQUE (account_key, product_key, household_key)
);

CREATE INDEX classroom_household_entitlements_scope_idx
  ON onetime.classroom_household_entitlements(account_key, product_key, household_key, entitlement_state);

CREATE TABLE onetime.classroom_launch_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_key text NOT NULL UNIQUE,
  secret_digest text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  actor_user_ref text NOT NULL,
  session_key_digest text NOT NULL,
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'consumed', 'expired', 'revoked')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  provider_mode text NOT NULL CHECK (provider_mode IN ('sink', 'real')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, actor_user_ref, occurrence_key, learner_key, idempotency_key)
);

CREATE INDEX classroom_launch_grants_consume_idx
  ON onetime.classroom_launch_grants(account_key, product_key, grant_key, status, expires_at);

CREATE TABLE onetime.classroom_attendance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  grant_key text NOT NULL,
  selected_view text NOT NULL CHECK (selected_view IN ('client', 'component')),
  status text NOT NULL DEFAULT 'bootstrap_issued'
    CHECK (status IN ('bootstrap_issued', 'joining', 'joined', 'left', 'failed')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 8),
  provider_mode text NOT NULL CHECK (provider_mode IN ('sink', 'real')),
  provider_meeting_ref_digest text NOT NULL,
  provider_registrant_ref_digest text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (grant_key) REFERENCES onetime.classroom_launch_grants(grant_key),
  UNIQUE (account_key, product_key, grant_key)
);

CREATE INDEX classroom_attendance_attempts_learner_idx
  ON onetime.classroom_attendance_attempts(account_key, product_key, learner_key, occurrence_key, started_at DESC);

CREATE TABLE onetime.classroom_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  attempt_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('bootstrap_loaded', 'sdk_join_started', 'sdk_joined', 'sdk_left', 'retry')),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (attempt_key) REFERENCES onetime.classroom_attendance_attempts(attempt_key),
  UNIQUE (account_key, product_key, attempt_key, idempotency_key)
);

CREATE TABLE onetime.classroom_student_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'featured', 'answered', 'dismissed')),
  body_ciphertext text NOT NULL,
  body_digest text NOT NULL,
  excerpt_redacted text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  submitted_by_user_ref text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  selected_at timestamptz,
  selected_by_user_ref text,
  selection_revision integer NOT NULL DEFAULT 0,
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, learner_key, occurrence_key, idempotency_key)
);

CREATE INDEX classroom_student_questions_occurrence_idx
  ON onetime.classroom_student_questions(account_key, product_key, occurrence_key, status, submitted_at DESC);

CREATE TABLE onetime.classroom_question_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_action_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  question_key text NOT NULL,
  occurrence_key text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('feature_next', 'mark_answered', 'dismiss')),
  actor_user_ref text NOT NULL,
  actor_role text NOT NULL,
  idempotency_key text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_key) REFERENCES onetime.classroom_student_questions(question_key),
  UNIQUE (account_key, product_key, question_key, action_type, idempotency_key)
);

CREATE TABLE onetime.classroom_reminder_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('portal', 'email', 'whatsapp')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent_sink', 'suppressed', 'retry', 'dead_letter')),
  idempotency_key text NOT NULL,
  due_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, learner_key, occurrence_key, channel)
);

CREATE INDEX classroom_reminder_intents_due_idx
  ON onetime.classroom_reminder_intents(account_key, product_key, status, next_attempt_at, created_at);

CREATE TABLE onetime.classroom_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_ref text NOT NULL,
  actor_role text NOT NULL,
  household_key text,
  learner_key text,
  occurrence_key text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX classroom_audit_events_scope_idx
  ON onetime.classroom_audit_events(account_key, product_key, occurrence_key, created_at DESC);
