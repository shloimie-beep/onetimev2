CREATE TABLE onetime.student_notifications (
  notification_id text PRIMARY KEY CHECK (notification_id <> ''),
  recipient_student_id text NOT NULL CHECK (recipient_student_id <> ''),
  scope_json jsonb NOT NULL,
  category text NOT NULL CHECK (category IN ('class_reminder', 'class_changed', 'class_canceled')),
  event_type text NOT NULL CHECK (event_type <> ''),
  source_family text NOT NULL CHECK (source_family <> ''),
  source_entity_id text NOT NULL CHECK (source_entity_id <> ''),
  source_version bigint NOT NULL CHECK (source_version > 0),
  current_for_source boolean NOT NULL DEFAULT true,
  dedupe_key text NOT NULL UNIQUE CHECK (dedupe_key <> ''),
  title text NOT NULL CHECK (title <> ''),
  body text NOT NULL CHECK (body <> ''),
  action_json jsonb,
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  retain_until timestamptz,
  read_at timestamptz,
  expired_at timestamptz,
  archived_at timestamptz,
  superseded_at timestamptz
);

CREATE INDEX student_notifications_center_idx
  ON onetime.student_notifications(recipient_student_id, created_at DESC);
CREATE UNIQUE INDEX student_notifications_source_version_idx
  ON onetime.student_notifications(recipient_student_id, source_entity_id, event_type, source_version);
CREATE UNIQUE INDEX student_notifications_current_source_idx
  ON onetime.student_notifications(recipient_student_id, source_family, source_entity_id)
  WHERE current_for_source = true;

CREATE TABLE onetime.student_notification_preferences (
  recipient_student_id text PRIMARY KEY,
  sound_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
