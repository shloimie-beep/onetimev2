CREATE TABLE onetime.learning_question_projection (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  question_key text NOT NULL CHECK (question_key <> ''),
  learner_key text NOT NULL CHECK (learner_key <> ''),
  household_key text NOT NULL CHECK (household_key <> ''),
  class_key text NOT NULL CHECK (class_key <> ''),
  private_body text NOT NULL CHECK (btrim(private_body) <> ''),
  private_answer text CHECK (private_answer IS NULL OR btrim(private_answer) <> ''),
  question_state text NOT NULL CHECK (question_state IN (
    'submitted', 'answered_private', 'approved_for_class', 'published', 'closed', 'declined'
  )),
  version bigint NOT NULL CHECK (version > 0),
  submitted_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id, question_key
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, learner_key, household_key, class_key
  ),
  CHECK (updated_at >= submitted_at),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  )
);

CREATE TABLE onetime.learning_question_transition_ledger (
  account_key text NOT NULL,
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  transition_event_id text NOT NULL CHECK (transition_event_id <> ''),
  question_key text NOT NULL,
  learner_key text NOT NULL,
  household_key text NOT NULL,
  class_key text NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  actor_key text NOT NULL CHECK (actor_key <> ''),
  event_source text NOT NULL CHECK (event_source IN (
    'authenticated_student_submit', 'admin_transition', 'admin_correction'
  )),
  audit_ref text NOT NULL CHECK (btrim(audit_ref) <> ''),
  from_state text CHECK (from_state IS NULL OR from_state IN (
    'submitted', 'answered_private', 'approved_for_class', 'published', 'closed', 'declined'
  )),
  to_state text NOT NULL CHECK (to_state IN (
    'submitted', 'answered_private', 'approved_for_class', 'published', 'closed', 'declined'
  )),
  reason text CHECK (reason IS NULL OR btrim(reason) <> ''),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id, transition_event_id
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id, idempotency_key
  ),
  FOREIGN KEY (
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, learner_key, household_key, class_key
  ) REFERENCES onetime.learning_question_projection(
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, learner_key, household_key, class_key
  ) ON DELETE RESTRICT,
  CHECK (transition_event_id = idempotency_key || ':transition'),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK (
    (event_source = 'authenticated_student_submit'
      AND from_state IS NULL AND to_state = 'submitted' AND reason IS NULL)
    OR
    (event_source = 'admin_transition' AND from_state IS NOT NULL)
    OR
    (event_source = 'admin_correction'
      AND from_state IS NOT NULL AND from_state = to_state AND reason IS NOT NULL)
  )
);

CREATE TABLE onetime.learning_question_recognition_ledger (
  account_key text NOT NULL,
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  recognition_event_id text NOT NULL CHECK (recognition_event_id <> ''),
  question_key text NOT NULL,
  learner_key text NOT NULL,
  household_key text NOT NULL,
  class_key text NOT NULL,
  recognition_sequence bigint NOT NULL CHECK (recognition_sequence > 0),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  actor_key text NOT NULL CHECK (actor_key <> ''),
  event_source text NOT NULL CHECK (event_source IN ('admin_transition', 'admin_correction')),
  audit_ref text NOT NULL CHECK (btrim(audit_ref) <> ''),
  action text NOT NULL CHECK (action IN (
    'qualified', 'correction_enabled', 'correction_disabled'
  )),
  eligible boolean NOT NULL,
  reason text CHECK (reason IS NULL OR btrim(reason) <> ''),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id, recognition_event_id
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id, idempotency_key
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, recognition_sequence
  ),
  FOREIGN KEY (
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, learner_key, household_key, class_key
  ) REFERENCES onetime.learning_question_projection(
    account_key, product_key, runtime_tier, verification_environment_id,
    question_key, learner_key, household_key, class_key
  ) ON DELETE RESTRICT,
  CHECK (recognition_event_id = idempotency_key || ':recognition'),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK (
    (action = 'qualified' AND event_source = 'admin_transition'
      AND eligible = true AND reason IS NULL)
    OR
    (action = 'correction_enabled' AND event_source = 'admin_correction'
      AND eligible = true AND reason IS NOT NULL)
    OR
    (action = 'correction_disabled' AND event_source = 'admin_correction'
      AND eligible = false AND reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX learning_question_first_qualification_idx
  ON onetime.learning_question_recognition_ledger(
    account_key, product_key, runtime_tier, verification_environment_id, question_key
  ) WHERE action = 'qualified';

CREATE TABLE onetime.learning_announcements (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  announcement_key text NOT NULL CHECK (announcement_key <> ''),
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL CHECK (btrim(body) <> ''),
  audience_kind text NOT NULL CHECK (audience_kind IN ('program', 'class', 'parent', 'student')),
  audience_key text,
  audience_class_key text,
  published_by text NOT NULL CHECK (published_by <> ''),
  published_at timestamptz NOT NULL,
  expires_at timestamptz,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id, announcement_key
  ),
  CHECK (expires_at IS NULL OR expires_at > published_at),
  CHECK (
    (audience_kind = 'program' AND audience_key IS NULL AND audience_class_key IS NULL)
    OR
    (audience_kind = 'class' AND audience_key = audience_class_key
      AND audience_key IS NOT NULL AND audience_key <> '')
    OR
    (audience_kind IN ('parent', 'student')
      AND audience_key IS NOT NULL AND audience_key <> ''
      AND audience_class_key IS NOT NULL AND audience_class_key <> '')
  ),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  )
);

CREATE TABLE onetime.learning_announcement_reads (
  account_key text NOT NULL,
  product_key text NOT NULL,
  runtime_tier text NOT NULL,
  verification_environment_id text NOT NULL,
  announcement_key text NOT NULL,
  principal_key text NOT NULL CHECK (principal_key <> ''),
  read_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id,
    announcement_key, principal_key
  ),
  FOREIGN KEY (
    account_key, product_key, runtime_tier, verification_environment_id, announcement_key
  ) REFERENCES onetime.learning_announcements(
    account_key, product_key, runtime_tier, verification_environment_id, announcement_key
  ) ON DELETE RESTRICT
);

CREATE TABLE onetime.learning_review_completions (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  review_event_id text NOT NULL CHECK (review_event_id <> ''),
  review_item_key text NOT NULL CHECK (review_item_key <> ''),
  class_key text NOT NULL CHECK (class_key <> ''),
  learner_key text NOT NULL CHECK (learner_key <> ''),
  household_key text NOT NULL CHECK (household_key <> ''),
  admin_published boolean NOT NULL CHECK (admin_published = true),
  event_action text NOT NULL CHECK (event_action IN ('completed', 'revoked', 'restored')),
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  completed_by text NOT NULL CHECK (completed_by <> ''),
  completion_source text NOT NULL CHECK (completion_source IN (
    'authenticated_submit', 'authenticated_mark_complete', 'admin_correction'
  )),
  reason text CHECK (reason IS NULL OR btrim(reason) <> ''),
  audit_ref text NOT NULL CHECK (btrim(audit_ref) <> ''),
  publication_audit_ref text NOT NULL CHECK (btrim(publication_audit_ref) <> ''),
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id, review_event_id
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id, idempotency_key
  ),
  UNIQUE (
    account_key, product_key, runtime_tier, verification_environment_id,
    review_item_key, learner_key, class_key, household_key, event_sequence
  ),
  CHECK (review_event_id = idempotency_key || ':review'),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  CHECK (
    (event_action = 'completed'
      AND completion_source IN ('authenticated_submit', 'authenticated_mark_complete')
      AND reason IS NULL)
    OR
    (event_action IN ('revoked', 'restored')
      AND completion_source = 'admin_correction' AND reason IS NOT NULL)
  ),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  )
);

CREATE TABLE onetime.learning_badge_award_projection (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  learner_key text NOT NULL CHECK (learner_key <> ''),
  class_key text NOT NULL CHECK (class_key <> ''),
  badge_family text NOT NULL CHECK (badge_family IN (
    'consistency', 'curious_learner', 'review_ready'
  )),
  badge_level text NOT NULL CHECK (badge_level IN ('I', 'II', 'III')),
  threshold integer NOT NULL CHECK (threshold > 0),
  qualifying_count integer NOT NULL CHECK (qualifying_count >= 0),
  source_keys jsonb NOT NULL CHECK (jsonb_typeof(source_keys) = 'array'),
  source_digest text NOT NULL,
  award_state text NOT NULL CHECK (award_state IN ('unawarded', 'awarded', 'revoked')),
  rule_version text NOT NULL CHECK (btrim(rule_version) <> ''),
  source_audit_refs jsonb NOT NULL CHECK (jsonb_typeof(source_audit_refs) = 'array'),
  awarded_at timestamptz,
  revoked_at timestamptz,
  recalculated_at timestamptz NOT NULL,
  correction_audit_ref text,
  correction_reason text,
  corrected_by_admin_id text,
  version bigint NOT NULL CHECK (version > 0),
  PRIMARY KEY (
    account_key, product_key, runtime_tier, verification_environment_id,
    learner_key, class_key, badge_family, badge_level
  ),
  CHECK (length(source_digest) = 64 AND source_digest = lower(source_digest)),
  CHECK (
    (badge_family = 'consistency' AND (
      (badge_level = 'I' AND threshold = 5)
      OR (badge_level = 'II' AND threshold = 20)
      OR (badge_level = 'III' AND threshold = 60)
    ))
    OR
    (badge_family = 'curious_learner' AND (
      (badge_level = 'I' AND threshold = 1)
      OR (badge_level = 'II' AND threshold = 5)
      OR (badge_level = 'III' AND threshold = 15)
    ))
    OR
    (badge_family = 'review_ready' AND (
      (badge_level = 'I' AND threshold = 1)
      OR (badge_level = 'II' AND threshold = 4)
      OR (badge_level = 'III' AND threshold = 12)
    ))
  ),
  CHECK (
    (award_state = 'unawarded'
      AND qualifying_count < threshold AND awarded_at IS NULL AND revoked_at IS NULL
      AND correction_audit_ref IS NULL AND correction_reason IS NULL
      AND corrected_by_admin_id IS NULL)
    OR
    (award_state = 'awarded'
      AND qualifying_count >= threshold AND awarded_at IS NOT NULL AND revoked_at IS NULL)
    OR
    (award_state = 'revoked'
      AND awarded_at IS NOT NULL AND revoked_at IS NOT NULL
      AND correction_audit_ref IS NOT NULL AND btrim(correction_audit_ref) <> ''
      AND correction_reason IS NOT NULL AND btrim(correction_reason) <> ''
      AND corrected_by_admin_id IS NOT NULL AND btrim(corrected_by_admin_id) <> '')
  ),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  )
);

CREATE INDEX learning_question_class_idx
  ON onetime.learning_question_projection(
    account_key, product_key, runtime_tier, verification_environment_id,
    class_key, submitted_at
  );

CREATE INDEX learning_announcement_scope_idx
  ON onetime.learning_announcements(
    account_key, product_key, runtime_tier, verification_environment_id, published_at
  );

CREATE INDEX learning_review_latest_idx
  ON onetime.learning_review_completions(
    account_key, product_key, runtime_tier, verification_environment_id,
    review_item_key, learner_key, class_key, household_key, event_sequence DESC
  );

-- @postgres-only-begin
ALTER TABLE onetime.learning_question_transition_ledger
  ADD CONSTRAINT learning_question_transition_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.learning_question_recognition_ledger
  ADD CONSTRAINT learning_question_recognition_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.learning_review_completions
  ADD CONSTRAINT learning_review_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.learning_badge_award_projection
  ADD CONSTRAINT learning_badge_source_digest_hex_check
    CHECK (source_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_learning_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'learning engagement ledger is append-only';
END;
$$;

CREATE TRIGGER learning_question_transition_append_only
BEFORE UPDATE OR DELETE ON onetime.learning_question_transition_ledger
FOR EACH ROW EXECUTE FUNCTION onetime.reject_learning_ledger_mutation();

CREATE TRIGGER learning_question_recognition_append_only
BEFORE UPDATE OR DELETE ON onetime.learning_question_recognition_ledger
FOR EACH ROW EXECUTE FUNCTION onetime.reject_learning_ledger_mutation();

CREATE TRIGGER learning_review_completion_append_only
BEFORE UPDATE OR DELETE ON onetime.learning_review_completions
FOR EACH ROW EXECUTE FUNCTION onetime.reject_learning_ledger_mutation();

CREATE TRIGGER learning_announcement_read_append_only
BEFORE UPDATE OR DELETE ON onetime.learning_announcement_reads
FOR EACH ROW EXECUTE FUNCTION onetime.reject_learning_ledger_mutation();

CREATE OR REPLACE FUNCTION onetime.enforce_learning_question_projection_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transition_allowed boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'learning question optimistic version conflict';
  END IF;
  IF NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
     OR NEW.verification_environment_id IS DISTINCT FROM OLD.verification_environment_id
     OR NEW.question_key IS DISTINCT FROM OLD.question_key
     OR NEW.learner_key IS DISTINCT FROM OLD.learner_key
     OR NEW.household_key IS DISTINCT FROM OLD.household_key
     OR NEW.class_key IS DISTINCT FROM OLD.class_key
     OR NEW.private_body IS DISTINCT FROM OLD.private_body
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'learning question identity and submission evidence are immutable';
  END IF;
  transition_allowed := NEW.question_state = OLD.question_state
    OR (OLD.question_state = 'submitted'
      AND NEW.question_state IN ('answered_private', 'approved_for_class', 'closed', 'declined'))
    OR (OLD.question_state = 'answered_private'
      AND NEW.question_state IN ('approved_for_class', 'closed', 'declined'))
    OR (OLD.question_state = 'approved_for_class'
      AND NEW.question_state IN ('answered_private', 'published', 'closed', 'declined'))
    OR (OLD.question_state = 'published'
      AND NEW.question_state IN ('approved_for_class', 'closed'));
  IF NOT transition_allowed OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'invalid learning question transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_question_projection_version_guard
BEFORE UPDATE ON onetime.learning_question_projection
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_learning_question_projection_update();

CREATE OR REPLACE FUNCTION onetime.enforce_learning_recognition_sequence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_sequence bigint;
BEGIN
  PERFORM 1 FROM onetime.learning_question_projection
   WHERE account_key = NEW.account_key
     AND product_key = NEW.product_key
     AND runtime_tier = NEW.runtime_tier
     AND verification_environment_id = NEW.verification_environment_id
     AND question_key = NEW.question_key
   FOR UPDATE;
  SELECT COALESCE(MAX(recognition_sequence), 0) + 1
    INTO expected_sequence
    FROM onetime.learning_question_recognition_ledger
   WHERE account_key = NEW.account_key
     AND product_key = NEW.product_key
     AND runtime_tier = NEW.runtime_tier
     AND verification_environment_id = NEW.verification_environment_id
     AND question_key = NEW.question_key;
  IF NEW.recognition_sequence <> expected_sequence THEN
    RAISE EXCEPTION 'learning recognition sequence must append monotonically';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_question_recognition_sequence_guard
BEFORE INSERT ON onetime.learning_question_recognition_ledger
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_learning_recognition_sequence();

CREATE OR REPLACE FUNCTION onetime.enforce_learning_review_sequence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_sequence bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.account_key || ':' || NEW.product_key || ':' || NEW.runtime_tier || ':' ||
    NEW.verification_environment_id || ':' || NEW.review_item_key || ':' || NEW.learner_key,
    0
  ));
  SELECT COALESCE(MAX(event_sequence), 0) + 1
    INTO expected_sequence
    FROM onetime.learning_review_completions
   WHERE account_key = NEW.account_key
     AND product_key = NEW.product_key
     AND runtime_tier = NEW.runtime_tier
     AND verification_environment_id = NEW.verification_environment_id
     AND review_item_key = NEW.review_item_key
     AND learner_key = NEW.learner_key;
  IF NEW.event_sequence <> expected_sequence THEN
    RAISE EXCEPTION 'learning review sequence must append monotonically';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_review_completion_sequence_guard
BEFORE INSERT ON onetime.learning_review_completions
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_learning_review_sequence();

CREATE OR REPLACE FUNCTION onetime.validate_learning_announcement_audience()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.audience_kind = 'class' AND NOT EXISTS (
    SELECT 1 FROM onetime.class_series
     WHERE account_key = NEW.account_key AND product_key = NEW.product_key
       AND class_series_key = NEW.audience_class_key
  ) THEN
    RAISE EXCEPTION 'learning announcement class is not canonical';
  END IF;
  IF NEW.audience_kind = 'student' AND NOT EXISTS (
    SELECT 1 FROM onetime.class_series_enrollments
     WHERE account_key = NEW.account_key AND product_key = NEW.product_key
       AND class_series_key = NEW.audience_class_key
       AND learner_key = NEW.audience_key AND enrollment_state = 'active'
  ) THEN
    RAISE EXCEPTION 'learning Student announcement target is not roster verified';
  END IF;
  IF NEW.audience_kind = 'parent' AND NOT EXISTS (
    SELECT 1 FROM onetime.class_series_enrollments
     WHERE account_key = NEW.account_key AND product_key = NEW.product_key
       AND class_series_key = NEW.audience_class_key
       AND household_key = NEW.audience_key AND enrollment_state = 'active'
  ) THEN
    RAISE EXCEPTION 'learning Parent announcement target is not roster verified';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_announcement_audience_guard
BEFORE INSERT ON onetime.learning_announcements
FOR EACH ROW EXECUTE FUNCTION onetime.validate_learning_announcement_audience();

CREATE OR REPLACE FUNCTION onetime.enforce_learning_badge_projection_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  facts_unchanged boolean;
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'learning badge optimistic version conflict';
  END IF;
  IF NEW.account_key IS DISTINCT FROM OLD.account_key
     OR NEW.product_key IS DISTINCT FROM OLD.product_key
     OR NEW.runtime_tier IS DISTINCT FROM OLD.runtime_tier
     OR NEW.verification_environment_id IS DISTINCT FROM OLD.verification_environment_id
     OR NEW.learner_key IS DISTINCT FROM OLD.learner_key
     OR NEW.class_key IS DISTINCT FROM OLD.class_key
     OR NEW.badge_family IS DISTINCT FROM OLD.badge_family
     OR NEW.badge_level IS DISTINCT FROM OLD.badge_level
     OR NEW.rule_version IS DISTINCT FROM OLD.rule_version THEN
    RAISE EXCEPTION 'learning badge scope and rule identity are immutable';
  END IF;
  facts_unchanged := NEW.threshold IS NOT DISTINCT FROM OLD.threshold
    AND NEW.qualifying_count IS NOT DISTINCT FROM OLD.qualifying_count
    AND NEW.source_keys IS NOT DISTINCT FROM OLD.source_keys
    AND NEW.source_digest IS NOT DISTINCT FROM OLD.source_digest
    AND NEW.award_state IS NOT DISTINCT FROM OLD.award_state
    AND NEW.source_audit_refs IS NOT DISTINCT FROM OLD.source_audit_refs
    AND NEW.awarded_at IS NOT DISTINCT FROM OLD.awarded_at
    AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at
    AND NEW.correction_audit_ref IS NOT DISTINCT FROM OLD.correction_audit_ref
    AND NEW.correction_reason IS NOT DISTINCT FROM OLD.correction_reason
    AND NEW.corrected_by_admin_id IS NOT DISTINCT FROM OLD.corrected_by_admin_id;
  IF facts_unchanged THEN
    RAISE EXCEPTION 'exact learning badge recalculation replay must write nothing';
  END IF;
  IF OLD.award_state = 'awarded' AND NEW.award_state = 'unawarded' THEN
    RAISE EXCEPTION 'ordinary learning badge recalculation cannot revoke an award';
  END IF;
  IF NEW.award_state = 'revoked'
     AND (NEW.correction_audit_ref IS NULL OR NEW.correction_reason IS NULL
       OR NEW.corrected_by_admin_id IS NULL) THEN
    RAISE EXCEPTION 'learning badge revocation requires audited Admin correction';
  END IF;
  IF OLD.award_state = 'revoked' AND NEW.award_state = 'awarded'
     AND (NEW.correction_audit_ref IS NULL OR NEW.correction_reason IS NULL
       OR NEW.corrected_by_admin_id IS NULL) THEN
    RAISE EXCEPTION 'learning badge restoration requires audited Admin correction';
  END IF;
  IF OLD.awarded_at IS NOT NULL AND NEW.awarded_at IS DISTINCT FROM OLD.awarded_at THEN
    RAISE EXCEPTION 'learning badge first award time is immutable';
  END IF;
  IF NEW.recalculated_at < OLD.recalculated_at THEN
    RAISE EXCEPTION 'learning badge recalculation time regressed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_badge_projection_version_guard
BEFORE UPDATE ON onetime.learning_badge_award_projection
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_learning_badge_projection_update();
-- @postgres-only-end
