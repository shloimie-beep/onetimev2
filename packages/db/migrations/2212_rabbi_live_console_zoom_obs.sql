CREATE TABLE onetime.live_class_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  source_question_key text,
  approved_display_name text NOT NULL,
  question_body_ciphertext text,
  question_body_digest text NOT NULL,
  question_preview text NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (
      status IN (
        'submitted',
        'selected',
        'student_ready',
        'live',
        'answered',
        'approved_for_board',
        'kept_private',
        'rejected'
      )
    ),
  readiness text NOT NULL DEFAULT 'pending' CHECK (readiness IN ('pending', 'ready', 'declined')),
  mic_ready boolean NOT NULL DEFAULT false,
  video_ready boolean NOT NULL DEFAULT false,
  customer_key text NOT NULL,
  class_label text,
  selected_at timestamptz,
  selected_by_user_ref text,
  student_ready_at timestamptz,
  live_at timestamptz,
  completed_at timestamptz,
  completed_by_user_ref text,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, learner_key, occurrence_key, idempotency_key)
);

CREATE INDEX live_class_questions_console_idx
  ON onetime.live_class_questions(account_key, product_key, occurrence_key, status, created_at DESC);

CREATE INDEX live_class_questions_learner_idx
  ON onetime.live_class_questions(account_key, product_key, learner_key, occurrence_key, created_at DESC);

CREATE TABLE onetime.live_class_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  learner_key text,
  customer_key text NOT NULL,
  provider text NOT NULL DEFAULT 'zoom' CHECK (provider = 'zoom'),
  participant_id_digest text,
  approved_display_name text NOT NULL,
  join_state text NOT NULL DEFAULT 'unknown' CHECK (join_state IN ('unknown', 'waiting', 'joined', 'left')),
  audio_state text NOT NULL DEFAULT 'unknown' CHECK (audio_state IN ('unknown', 'muted', 'unmuted')),
  video_state text NOT NULL DEFAULT 'unknown' CHECK (video_state IN ('unknown', 'off', 'on')),
  active_speaker boolean NOT NULL DEFAULT false,
  spotlighted boolean NOT NULL DEFAULT false,
  event_revision integer NOT NULL DEFAULT 1 CHECK (event_revision >= 1),
  last_event_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, occurrence_key, customer_key)
);

CREATE INDEX live_class_participants_roster_idx
  ON onetime.live_class_participants(account_key, product_key, occurrence_key, updated_at DESC);

CREATE TABLE onetime.live_class_stage_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_session_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  stage_secret_digest text NOT NULL,
  surface_label text NOT NULL DEFAULT 'One Time Zoom Stage Host',
  current_question_key text,
  current_scene text NOT NULL DEFAULT 'OT - Slides'
    CHECK (current_scene IN ('OT - Slides', 'OT - Featured Student', 'OT - Break')),
  stage_state text NOT NULL DEFAULT 'slides'
    CHECK (stage_state IN ('slides', 'student_featured', 'break', 'reset')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (current_question_key) REFERENCES onetime.live_class_questions(question_key),
  UNIQUE (account_key, product_key, occurrence_key)
);

CREATE INDEX live_class_stage_sessions_scope_idx
  ON onetime.live_class_stage_sessions(account_key, product_key, occurrence_key, updated_at DESC);

CREATE TABLE onetime.live_class_control_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  command_type text NOT NULL
    CHECK (
      command_type IN (
        'ask_unmute',
        'mute',
        'spotlight_replace',
        'spotlight_remove',
        'stop_video',
        'feature_student',
        'done',
        'emergency_reset',
        'obs_switch_scene'
      )
    ),
  command_status text NOT NULL DEFAULT 'queued'
    CHECK (command_status IN ('queued', 'claimed', 'executed', 'failed', 'rejected', 'expired')),
  target_question_key text,
  target_participant_key text,
  obs_scene text CHECK (obs_scene IS NULL OR obs_scene IN ('OT - Slides', 'OT - Featured Student', 'OT - Break')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  nonce text NOT NULL,
  signature text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  executed_at timestamptz,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (target_question_key) REFERENCES onetime.live_class_questions(question_key),
  FOREIGN KEY (target_participant_key) REFERENCES onetime.live_class_participants(participant_key),
  UNIQUE (account_key, product_key, occurrence_key, command_type, idempotency_key)
);

CREATE INDEX live_class_control_commands_pending_idx
  ON onetime.live_class_control_commands(account_key, product_key, occurrence_key, command_status, expires_at, created_at);

CREATE UNIQUE INDEX live_class_control_commands_nonce_idx
  ON onetime.live_class_control_commands(account_key, product_key, nonce);

CREATE TABLE onetime.live_class_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_ref text NOT NULL,
  actor_role text NOT NULL,
  occurrence_key text,
  learner_key text,
  question_key text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_class_audit_events_scope_idx
  ON onetime.live_class_audit_events(account_key, product_key, occurrence_key, created_at DESC);
