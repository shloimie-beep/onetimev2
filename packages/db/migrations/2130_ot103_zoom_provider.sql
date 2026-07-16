CREATE TABLE onetime.classroom_zoom_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  provider_meeting_ref_digest text NOT NULL,
  provider_occurrence_id text NOT NULL,
  provider_meeting_uuid_digest text,
  local_class_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  provider_state text NOT NULL DEFAULT 'staged'
    CHECK (provider_state IN ('staged', 'registered', 'unavailable', 'deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, occurrence_key),
  UNIQUE (account_key, product_key, provider_meeting_ref_digest, provider_occurrence_id)
);

CREATE TABLE onetime.classroom_zoom_registrants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  occurrence_key text NOT NULL,
  provider_meeting_ref_digest text NOT NULL,
  provider_occurrence_id text NOT NULL,
  provider_registrant_ref_digest text NOT NULL,
  registrant_token_ref text NOT NULL,
  join_url_digest text NOT NULL,
  registration_state text NOT NULL DEFAULT 'registered'
    CHECK (registration_state IN ('registered', 'cancelled', 'denied', 'unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, learner_key, occurrence_key),
  UNIQUE (account_key, product_key, provider_meeting_ref_digest, provider_occurrence_id,
          provider_registrant_ref_digest)
);

CREATE TABLE onetime.classroom_zoom_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_type text NOT NULL,
  meeting_id_digest text,
  meeting_uuid_digest text,
  provider_occurrence_id text,
  provider_registrant_ref_digest text,
  participant_user_ref_digest text,
  attendance_state text NOT NULL DEFAULT 'unknown'
    CHECK (attendance_state IN ('joined', 'left', 'waiting', 'unknown')),
  occurred_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (account_key, product_key, event_key)
);

CREATE TABLE onetime.classroom_zoom_attendance_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  meeting_uuid_digest text NOT NULL,
  provider_occurrence_id text NOT NULL,
  provider_registrant_ref_digest text NOT NULL,
  attendance_state text NOT NULL
    CHECK (attendance_state IN ('joined', 'left', 'waiting', 'unknown')),
  last_event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, meeting_uuid_digest, provider_occurrence_id,
          provider_registrant_ref_digest)
);

CREATE INDEX classroom_zoom_webhook_events_scope_idx
  ON onetime.classroom_zoom_webhook_events(account_key, product_key, meeting_uuid_digest,
                                           provider_occurrence_id, processed_at DESC);
