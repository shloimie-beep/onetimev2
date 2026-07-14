CREATE TABLE onetime.portal_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, household_key)
);

CREATE INDEX portal_households_scope_idx
  ON onetime.portal_households(account_key, product_key, status, updated_at DESC);

CREATE TABLE onetime.portal_guardian_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  guardian_user_ref text NOT NULL,
  relationship_label text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('primary_guardian', 'guardian', 'support_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  UNIQUE (account_key, product_key, household_key, relationship_key),
  UNIQUE (account_key, product_key, household_key, guardian_user_ref)
);

CREATE INDEX portal_guardian_actor_idx
  ON onetime.portal_guardian_relationships(account_key, product_key, guardian_user_ref, status);

CREATE TABLE onetime.portal_learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  display_name text NOT NULL,
  hebrew_name text,
  grade_label text,
  learner_status text NOT NULL DEFAULT 'active' CHECK (learner_status IN ('active', 'archived', 'suspended')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  suspended_at timestamptz,
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  UNIQUE (account_key, product_key, learner_key)
);

CREATE INDEX portal_learners_household_idx
  ON onetime.portal_learners(account_key, product_key, household_key, learner_status, updated_at DESC);

CREATE TABLE onetime.portal_student_access_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_state_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  student_user_ref text,
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured', 'setup_requested', 'active', 'reset_requested', 'suspended', 'disabled')),
  last_operation_type text CHECK (
    last_operation_type IS NULL OR last_operation_type IN ('setup', 'reset', 'suspend', 'restore')
  ),
  last_operation_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
);

CREATE UNIQUE INDEX portal_student_access_one_active_learner_idx
  ON onetime.portal_student_access_state(account_key, product_key, learner_key)
  WHERE status = 'active';

CREATE UNIQUE INDEX portal_student_access_one_active_identity_idx
  ON onetime.portal_student_access_state(account_key, product_key, student_user_ref)
  WHERE status = 'active' AND student_user_ref IS NOT NULL;

CREATE INDEX portal_student_access_scope_idx
  ON onetime.portal_student_access_state(account_key, product_key, learner_key, status);

CREATE TABLE onetime.portal_guardian_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  relationship_key text NOT NULL,
  consent_type text NOT NULL,
  policy_version text NOT NULL,
  consent_text_digest text NOT NULL,
  consent_status text NOT NULL DEFAULT 'granted' CHECK (consent_status IN ('granted', 'revoked')),
  recorded_by_user_ref text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  FOREIGN KEY (account_key, product_key, household_key, relationship_key)
    REFERENCES onetime.portal_guardian_relationships(account_key, product_key, household_key, relationship_key)
);

CREATE INDEX portal_guardian_consents_current_idx
  ON onetime.portal_guardian_consents(account_key, product_key, household_key, consent_type, recorded_at DESC);

CREATE TABLE onetime.portal_student_access_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('setup', 'reset', 'suspend', 'restore')),
  requested_by_user_ref text NOT NULL,
  adapter_operation_ref_digest text NOT NULL,
  proof_digest text,
  proof_expires_at timestamptz,
  proof_consumed_at timestamptz,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, learner_key, operation_type, idempotency_key)
);

CREATE INDEX portal_student_access_operations_learner_idx
  ON onetime.portal_student_access_operations(account_key, product_key, learner_key, created_at DESC);

CREATE TABLE onetime.portal_reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  reason_code text NOT NULL,
  reason_label text NOT NULL,
  actor_ref text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('admin', 'parent_capability', 'system')),
  correction_of_event_key text REFERENCES onetime.portal_reward_events(reward_event_key),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, learner_key, idempotency_key)
);

CREATE INDEX portal_reward_events_learner_idx
  ON onetime.portal_reward_events(account_key, product_key, learner_key, occurred_at DESC);

CREATE TABLE onetime.portal_administrative_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('parent', 'student', 'both')),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key)
);

CREATE INDEX portal_administrative_updates_learner_idx
  ON onetime.portal_administrative_updates(account_key, product_key, learner_key, audience, published_at DESC);

CREATE TABLE onetime.portal_update_read_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  update_key text NOT NULL REFERENCES onetime.portal_administrative_updates(update_key),
  actor_user_ref text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, update_key, actor_user_ref)
);

CREATE TABLE onetime.portal_audit_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_ref text NOT NULL,
  actor_role text NOT NULL,
  household_key text,
  learner_key text,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_audit_actions_scope_idx
  ON onetime.portal_audit_actions(account_key, product_key, action_type, created_at DESC);

CREATE TABLE onetime.portal_mutation_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_ref text NOT NULL,
  operation_scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_ref, operation_scope, idempotency_key)
);
