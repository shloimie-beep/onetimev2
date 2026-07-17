CREATE TABLE onetime.portal_student_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  submitted_by_user_ref text NOT NULL,
  class_key text,
  question_text text NOT NULL,
  question_status text NOT NULL DEFAULT 'submitted'
    CHECK (question_status IN ('submitted', 'in_review', 'answered', 'archived')),
  answer_preview text,
  answered_at timestamptz,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, learner_key, idempotency_key)
);

CREATE INDEX portal_student_questions_learner_idx
  ON onetime.portal_student_questions(account_key, product_key, learner_key, created_at DESC);

CREATE INDEX portal_student_questions_staff_review_idx
  ON onetime.portal_student_questions(account_key, product_key, question_status, created_at DESC);
