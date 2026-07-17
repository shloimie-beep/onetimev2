CREATE TABLE onetime.portal_parent_reward_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_goal_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  title text NOT NULL,
  description text,
  points_required integer NOT NULL CHECK (points_required > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'earned', 'fulfilled', 'paused', 'archived')),
  created_by_parent_ref text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  earned_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  UNIQUE (account_key, product_key, learner_key, idempotency_key)
);

CREATE INDEX portal_parent_reward_goals_learner_idx
  ON onetime.portal_parent_reward_goals(account_key, product_key, learner_key, status, created_at DESC);

CREATE TABLE onetime.portal_class_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_milestone_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text,
  title text NOT NULL,
  description text NOT NULL,
  progress_current integer NOT NULL DEFAULT 0 CHECK (progress_current >= 0),
  progress_target integer NOT NULL CHECK (progress_target > 0),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('earned', 'in_progress', 'locked')),
  earned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_class_milestones_scope_idx
  ON onetime.portal_class_milestones(account_key, product_key, status, updated_at DESC);

CREATE TABLE onetime.portal_gamification_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  corrected_event_key text NOT NULL REFERENCES onetime.portal_reward_events(reward_event_key),
  reversal_event_key text NOT NULL REFERENCES onetime.portal_reward_events(reward_event_key),
  reason text NOT NULL,
  actor_ref text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, learner_key, idempotency_key)
);

CREATE INDEX portal_gamification_corrections_learner_idx
  ON onetime.portal_gamification_corrections(account_key, product_key, learner_key, created_at DESC);
