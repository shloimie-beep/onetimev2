CREATE TABLE onetime.class_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_series_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  title text NOT NULL,
  timezone text NOT NULL,
  local_start_time time NOT NULL,
  reminder_local_time time NOT NULL,
  reminder_minutes_before integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, class_series_key)
);

CREATE INDEX class_series_scope_idx
  ON onetime.class_series(account_key, product_key, status, updated_at DESC);

CREATE TABLE onetime.class_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text NOT NULL,
  local_class_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  reminder_due_at timestamptz NOT NULL,
  joinable_until timestamptz NOT NULL,
  occurrence_state text NOT NULL DEFAULT 'scheduled'
    CHECK (occurrence_state IN ('scheduled', 'live', 'completed', 'cancelled')),
  acknowledgement_state text NOT NULL DEFAULT 'not_required'
    CHECK (acknowledgement_state IN ('not_required', 'pending', 'satisfied', 'skipped')),
  reminder_state text NOT NULL DEFAULT 'not_required'
    CHECK (reminder_state IN ('not_required', 'pending', 'satisfied', 'skipped')),
  access_state text NOT NULL DEFAULT 'provider_unavailable'
    CHECK (access_state IN ('provider_unavailable', 'pending', 'ready', 'expired')),
  attendance_state text NOT NULL DEFAULT 'not_started'
    CHECK (attendance_state IN ('not_started', 'open', 'closed')),
  delivery_state text NOT NULL DEFAULT 'not_required'
    CHECK (delivery_state IN ('not_required', 'pending', 'satisfied', 'failed')),
  recording_state text NOT NULL DEFAULT 'not_expected'
    CHECK (recording_state IN ('not_expected', 'pending', 'available', 'unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key),
  UNIQUE (account_key, product_key, class_series_key, local_class_date)
);

CREATE INDEX class_occurrences_scope_idx
  ON onetime.class_occurrences(account_key, product_key, starts_at, occurrence_key);

CREATE INDEX class_occurrences_readiness_idx
  ON onetime.class_occurrences(account_key, product_key, access_state, starts_at);

CREATE TABLE onetime.class_fulfillment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  contact_key text,
  signup_key text,
  intent_type text NOT NULL CHECK (intent_type IN ('acknowledgement', 'class_reminder', 'protected_launch')),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'internal_email', 'portal')),
  fulfillment_state text NOT NULL DEFAULT 'queued'
    CHECK (fulfillment_state IN ('queued', 'satisfied', 'suppressed', 'skipped', 'provider_unavailable')),
  delivery_key text,
  reminder_due_at timestamptz,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (contact_key) REFERENCES onetime.contacts(contact_key),
  FOREIGN KEY (signup_key) REFERENCES onetime.signup_leads(signup_key),
  UNIQUE (account_key, product_key, occurrence_key, signup_key, intent_type, channel)
);

CREATE INDEX class_fulfillment_intents_occurrence_idx
  ON onetime.class_fulfillment_intents(account_key, product_key, occurrence_key, fulfillment_state);

CREATE INDEX class_fulfillment_intents_delivery_idx
  ON onetime.class_fulfillment_intents(delivery_key)
  WHERE delivery_key IS NOT NULL;

CREATE TABLE onetime.class_attendance_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  learner_key text NOT NULL,
  attendance_state text NOT NULL CHECK (attendance_state IN ('not_started', 'present', 'absent', 'excused')),
  source text NOT NULL CHECK (source IN ('system', 'owner_admin', 'portal')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, occurrence_key, learner_key)
);

CREATE INDEX class_attendance_marks_learner_idx
  ON onetime.class_attendance_marks(account_key, product_key, learner_key, recorded_at DESC);

CREATE TABLE onetime.class_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  learner_key text,
  actor_ref text NOT NULL,
  access_state text NOT NULL DEFAULT 'provider_unavailable'
    CHECK (access_state IN ('provider_unavailable', 'issued', 'expired', 'denied')),
  descriptor_ref text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key)
);

CREATE INDEX class_access_requests_occurrence_idx
  ON onetime.class_access_requests(account_key, product_key, occurrence_key, created_at DESC);

CREATE INDEX outbox_events_ot71_class_reminder_sink_claim_idx
  ON onetime.outbox_events (
    account_key,
    product_key,
    transport_mode,
    event_type,
    channel,
    status,
    next_attempt_at,
    created_at,
    id
  )
  WHERE transport_mode = 'sink'
    AND status IN ('pending', 'processing')
    AND (
      (event_type = 'family_class_reminder_email.v1' AND channel = 'email')
      OR
      (event_type = 'family_class_reminder_whatsapp.v1' AND channel = 'whatsapp')
    );
