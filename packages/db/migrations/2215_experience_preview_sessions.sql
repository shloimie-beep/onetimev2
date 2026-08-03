CREATE TABLE onetime.experience_preview_scenarios (
  scenario_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  class_series_key text NOT NULL,
  occurrence_key text NOT NULL,
  content_item_key text NOT NULL,
  content_revision_key text NOT NULL,
  lesson_key text NOT NULL,
  provisioner_marker text NOT NULL,
  eligibility_state text NOT NULL DEFAULT 'active'
    CHECK (eligibility_state IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key),
  FOREIGN KEY (content_revision_key) REFERENCES onetime.content_revisions(revision_key),
  FOREIGN KEY (lesson_key) REFERENCES onetime.classroom_lesson_publications(lesson_key),
  UNIQUE (account_key, product_key, scenario_key)
);

CREATE TABLE onetime.experience_preview_fictional_identities (
  identity_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  scenario_key text NOT NULL REFERENCES onetime.experience_preview_scenarios(scenario_key),
  role_id text NOT NULL CHECK (role_id IN ('student_1', 'student_2', 'student_3')),
  household_key text NOT NULL,
  learner_key text NOT NULL,
  access_state_key text NOT NULL,
  expected_normalized_username text NOT NULL,
  provisioner_marker text NOT NULL,
  eligibility_state text NOT NULL DEFAULT 'active'
    CHECK (eligibility_state IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (access_state_key) REFERENCES onetime.portal_student_access_state(access_state_key),
  UNIQUE (account_key, product_key, role_id),
  UNIQUE (account_key, product_key, learner_key)
);

CREATE TABLE onetime.experience_preview_review_questions (
  question_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  scenario_key text NOT NULL REFERENCES onetime.experience_preview_scenarios(scenario_key),
  content_revision_key text NOT NULL REFERENCES onetime.content_revisions(revision_key),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 12),
  prompt text NOT NULL,
  approval_state text NOT NULL CHECK (approval_state IN ('draft', 'approved', 'rejected')),
  approved_by_actor_ref text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, scenario_key, position)
);

CREATE TABLE onetime.experience_preview_exchanges (
  exchange_digest text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  admin_user_ref text NOT NULL,
  admin_session_key text NOT NULL,
  role_id text NOT NULL CHECK (role_id IN ('student_1', 'student_2', 'student_3')),
  fictional_learner_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (admin_session_key) REFERENCES onetime.user_sessions(session_key),
  FOREIGN KEY (account_key, product_key, fictional_learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  CHECK (expires_at > created_at)
);

CREATE INDEX experience_preview_exchanges_expiry_idx
  ON onetime.experience_preview_exchanges(account_key, product_key, expires_at, consumed_at);

CREATE TABLE onetime.experience_preview_sessions (
  preview_session_key text PRIMARY KEY,
  preview_token_digest text NOT NULL UNIQUE,
  route_handle_digest text NOT NULL UNIQUE,
  exchange_digest text NOT NULL UNIQUE
    REFERENCES onetime.experience_preview_exchanges(exchange_digest),
  account_key text NOT NULL,
  product_key text NOT NULL,
  admin_user_ref text NOT NULL,
  admin_session_key text NOT NULL,
  role_id text NOT NULL CHECK (role_id IN ('student_1', 'student_2', 'student_3')),
  fictional_learner_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (admin_session_key) REFERENCES onetime.user_sessions(session_key),
  FOREIGN KEY (account_key, product_key, fictional_learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  CHECK (expires_at > created_at)
);

CREATE INDEX experience_preview_sessions_active_idx
  ON onetime.experience_preview_sessions(account_key, product_key, expires_at, revoked_at);
