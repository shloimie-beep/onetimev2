ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS is_operator_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operator_test_environment text;

CREATE TABLE onetime.zoom_class_occurrence_resources (
  resource_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  environment text NOT NULL
    CHECK (environment IN ('isolated_staging', 'production')),
  purpose text NOT NULL DEFAULT 'normal_class'
    CHECK (purpose IN ('normal_class', 'synthetic_acceptance')),
  resource_state text NOT NULL DEFAULT 'provisioning'
    CHECK (
      resource_state IN (
        'provisioning',
        'active',
        'provision_failed',
        'provision_unknown',
        'deleting',
        'deleted',
        'delete_unknown'
      )
    ),
  provider_meeting_ref_digest text,
  provider_meeting_ciphertext text,
  meeting_password_ciphertext text,
  meeting_topic text NOT NULL,
  meeting_starts_at timestamptz NOT NULL,
  meeting_duration_minutes integer NOT NULL
    CHECK (meeting_duration_minutes BETWEEN 1 AND 240),
  created_by_user_ref text NOT NULL,
  provision_idempotency_key text NOT NULL,
  delete_idempotency_key text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, occurrence_key)
);

CREATE INDEX zoom_class_occurrence_resources_scope_idx
  ON onetime.zoom_class_occurrence_resources(
    account_key, product_key, resource_state, meeting_starts_at, occurrence_key
  );

ALTER TABLE onetime.classroom_zoom_registrants
  ADD COLUMN registrant_token_ciphertext text,
  ADD COLUMN registration_email_digest text;

CREATE INDEX classroom_zoom_registrants_occurrence_state_idx
  ON onetime.classroom_zoom_registrants(
    account_key, product_key, occurrence_key, registration_state, learner_key
  );
