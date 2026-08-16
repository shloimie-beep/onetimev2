CREATE TABLE onetime.parent_learning_participants (
  participant_id text PRIMARY KEY CHECK (participant_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  adult_id text NOT NULL CHECK (adult_id <> ''),
  human_account_id text NOT NULL CHECK (human_account_id <> ''),
  participant_kind text NOT NULL DEFAULT 'parent'
    CHECK (participant_kind = 'parent'),
  learner_ordinal smallint NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (participant_id, household_id, product_key, runtime_tier, verification_environment_id),
  UNIQUE (household_id, product_key, runtime_tier, verification_environment_id),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id, product_key, runtime_tier, verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (human_account_id, adult_id)
    REFERENCES onetime.v21_human_accounts(human_account_id, adult_id) ON DELETE RESTRICT,
  FOREIGN KEY (human_account_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_human_accounts(
      human_account_id, product_key, runtime_tier, verification_environment_id
    ) ON DELETE RESTRICT,
  CHECK (learner_ordinal = 1),
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only', 'production_operator_canary', 'production_broad'
      ))
  ),
  CHECK (
    (state = 'active' AND archived_at IS NULL)
    OR (state = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE TABLE onetime.parent_learning_class_entitlements (
  entitlement_id text PRIMARY KEY CHECK (entitlement_id <> ''),
  participant_id text NOT NULL CHECK (participant_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  class_series_key text NOT NULL CHECK (class_series_key <> ''),
  entitlement_state text NOT NULL DEFAULT 'active'
    CHECK (entitlement_state IN ('active', 'revoked')),
  source text NOT NULL CHECK (source IN (
    'public_family_signup', 'existing_family_backfill', 'admin_repair'
  )),
  effective_at timestamptz NOT NULL,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (participant_id, account_key, product_key, class_series_key),
  FOREIGN KEY (
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.parent_learning_participants(
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key)
    ON DELETE RESTRICT,
  CHECK (
    (entitlement_state = 'active' AND revoked_at IS NULL)
    OR (entitlement_state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX parent_learning_one_active_class_idx
  ON onetime.parent_learning_class_entitlements(participant_id)
  WHERE entitlement_state = 'active';

CREATE TABLE onetime.parent_learning_attendance_events (
  attendance_event_id text PRIMARY KEY CHECK (attendance_event_id <> ''),
  participant_id text NOT NULL CHECK (participant_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  actor_kind text NOT NULL DEFAULT 'parent' CHECK (actor_kind = 'parent'),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  class_series_key text NOT NULL CHECK (class_series_key <> ''),
  occurrence_id text NOT NULL CHECK (occurrence_id <> ''),
  event_kind text NOT NULL CHECK (event_kind IN ('joined', 'left')),
  source text NOT NULL CHECK (source IN ('embedded_client', 'zoom_provider')),
  connection_lineage_id text NOT NULL CHECK (connection_lineage_id <> ''),
  source_event_ref_digest text NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  UNIQUE (participant_id, idempotency_key),
  FOREIGN KEY (
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.parent_learning_participants(
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (occurrence_id)
    REFERENCES onetime.class_occurrences(occurrence_key) ON DELETE RESTRICT,
  CHECK (length(source_event_ref_digest) = 64 AND source_event_ref_digest = lower(source_event_ref_digest)),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE INDEX parent_learning_attendance_scope_idx
  ON onetime.parent_learning_attendance_events(
    participant_id, occurrence_id, observed_at
  );

CREATE TABLE onetime.parent_learning_content_progress_events (
  progress_event_id text PRIMARY KEY CHECK (progress_event_id <> ''),
  participant_id text NOT NULL CHECK (participant_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  actor_kind text NOT NULL DEFAULT 'parent' CHECK (actor_kind = 'parent'),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  class_series_key text NOT NULL CHECK (class_series_key <> ''),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  position_ms bigint NOT NULL CHECK (position_ms >= 0),
  duration_ms bigint NOT NULL CHECK (duration_ms > 0),
  completed boolean NOT NULL,
  completed_at timestamptz,
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  UNIQUE (participant_id, idempotency_key),
  FOREIGN KEY (
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.parent_learning_participants(
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_items(account_key, product_key, content_item_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (content_version_id)
    REFERENCES onetime.content_revisions(revision_key) ON DELETE RESTRICT,
  CHECK (position_ms <= duration_ms),
  CHECK (
    (completed = true AND position_ms = duration_ms AND completed_at IS NOT NULL)
    OR (completed = false AND completed_at IS NULL)
  ),
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE INDEX parent_learning_content_progress_scope_idx
  ON onetime.parent_learning_content_progress_events(
    participant_id, content_id, observed_at DESC
  );

CREATE TABLE onetime.parent_learning_questions (
  question_id text PRIMARY KEY CHECK (question_id <> ''),
  participant_id text NOT NULL CHECK (participant_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  actor_kind text NOT NULL DEFAULT 'parent' CHECK (actor_kind = 'parent'),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  class_series_key text NOT NULL CHECK (class_series_key <> ''),
  private_body text NOT NULL CHECK (btrim(private_body) <> '' AND length(private_body) <= 4000),
  question_state text NOT NULL DEFAULT 'submitted' CHECK (question_state = 'submitted'),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL,
  submitted_at timestamptz NOT NULL,
  UNIQUE (participant_id, idempotency_key),
  FOREIGN KEY (
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) REFERENCES onetime.parent_learning_participants(
    participant_id, household_id, product_key, runtime_tier, verification_environment_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, class_series_key)
    REFERENCES onetime.class_series(account_key, product_key, class_series_key)
    ON DELETE RESTRICT,
  CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash))
);

CREATE INDEX parent_learning_question_scope_idx
  ON onetime.parent_learning_questions(
    participant_id, class_series_key, submitted_at DESC
  );

-- @postgres-only-begin
ALTER TABLE onetime.parent_learning_attendance_events
  ADD CONSTRAINT parent_learning_attendance_source_digest_hex_check
    CHECK (source_event_ref_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT parent_learning_attendance_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.parent_learning_content_progress_events
  ADD CONSTRAINT parent_learning_content_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.parent_learning_questions
  ADD CONSTRAINT parent_learning_question_request_hash_hex_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.enforce_parent_learning_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.v21_households AS household
     WHERE household.household_id = NEW.household_id
       AND household.owner_adult_id = NEW.adult_id
       AND household.owner_human_account_id = NEW.human_account_id
       AND household.product_key = NEW.product_key
       AND household.runtime_tier = NEW.runtime_tier
       AND household.verification_environment_id = NEW.verification_environment_id
       AND household.classification = 'family'
  ) THEN
    RAISE EXCEPTION 'Parent learning participant must be the Family household owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_learning_owner_guard
BEFORE INSERT OR UPDATE OF household_id, adult_id, human_account_id,
  product_key, runtime_tier, verification_environment_id
ON onetime.parent_learning_participants
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_parent_learning_owner();

CREATE OR REPLACE FUNCTION onetime.enforce_parent_learning_canonical_entitlement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.parent_learning_participants AS participant
      JOIN onetime.class_series AS series
        ON series.account_key = NEW.account_key
       AND series.product_key = NEW.product_key
       AND series.class_series_key = NEW.class_series_key
       AND series.is_canonical = true
       AND series.status = 'active'
       AND series.series_state = 'active'
     WHERE participant.participant_id = NEW.participant_id
       AND participant.household_id = NEW.household_id
       AND participant.product_key = NEW.product_key
       AND participant.runtime_tier = NEW.runtime_tier
       AND participant.verification_environment_id = NEW.verification_environment_id
       AND participant.participant_kind = 'parent'
  ) THEN
    RAISE EXCEPTION 'Parent learning entitlement must target the canonical class';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_learning_entitlement_guard
BEFORE INSERT OR UPDATE OF participant_id, household_id, account_key,
  product_key, runtime_tier, verification_environment_id, class_series_key
ON onetime.parent_learning_class_entitlements
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_parent_learning_canonical_entitlement();

CREATE OR REPLACE FUNCTION onetime.enforce_parent_learning_content_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.content_items AS item
      JOIN onetime.content_revisions AS revision
        ON revision.account_key = item.account_key
       AND revision.product_key = item.product_key
       AND revision.content_item_key = item.content_item_key
       AND revision.revision_key = item.published_revision_key
       AND revision.lifecycle_state = 'published'
     WHERE item.account_key = NEW.account_key
       AND item.product_key = NEW.product_key
       AND item.content_item_key = NEW.content_id
       AND item.published_revision_key = NEW.content_version_id
       AND item.lifecycle_state = 'published'
       AND item.retention_state = 'active'
       AND item.published_at IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM onetime.parent_learning_class_entitlements AS entitlement
          WHERE entitlement.participant_id = NEW.participant_id
            AND entitlement.household_id = NEW.household_id
            AND entitlement.account_key = NEW.account_key
            AND entitlement.product_key = NEW.product_key
            AND entitlement.runtime_tier = NEW.runtime_tier
            AND entitlement.verification_environment_id = NEW.verification_environment_id
            AND entitlement.class_series_key = NEW.class_series_key
            AND entitlement.entitlement_state = 'active'
            AND (
              item.occurrence_key IS NULL
              OR EXISTS (
                SELECT 1
                  FROM onetime.class_occurrences AS occurrence
                 WHERE occurrence.account_key = item.account_key
                   AND occurrence.product_key = item.product_key
                   AND occurrence.occurrence_key = item.occurrence_key
                   AND occurrence.class_series_key = entitlement.class_series_key
              )
            )
       )
       AND EXISTS (
         SELECT 1
           FROM onetime.content_item_entitlements AS content_entitlement
          WHERE content_entitlement.account_key = item.account_key
            AND content_entitlement.product_key = item.product_key
            AND content_entitlement.content_item_key = item.content_item_key
            AND content_entitlement.entitlement_state = 'active'
            AND (
              content_entitlement.audience = 'all_active_learners'
              OR (
                content_entitlement.audience = 'household'
                AND content_entitlement.household_key = NEW.household_id
              )
            )
       )
  ) THEN
    RAISE EXCEPTION 'Parent learning progress must target the current published content version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_learning_content_scope_guard
BEFORE INSERT ON onetime.parent_learning_content_progress_events
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_parent_learning_content_scope();

CREATE OR REPLACE FUNCTION onetime.enforce_parent_learning_attendance_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.parent_learning_class_entitlements AS entitlement
      JOIN onetime.class_occurrences AS occurrence
        ON occurrence.account_key = entitlement.account_key
       AND occurrence.product_key = entitlement.product_key
       AND occurrence.class_series_key = entitlement.class_series_key
       AND occurrence.occurrence_key = NEW.occurrence_id
     WHERE entitlement.participant_id = NEW.participant_id
       AND entitlement.household_id = NEW.household_id
       AND entitlement.account_key = NEW.account_key
       AND entitlement.product_key = NEW.product_key
       AND entitlement.runtime_tier = NEW.runtime_tier
       AND entitlement.verification_environment_id = NEW.verification_environment_id
       AND entitlement.class_series_key = NEW.class_series_key
       AND entitlement.entitlement_state = 'active'
  ) THEN
    RAISE EXCEPTION 'Parent attendance must target the active entitled class';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_learning_attendance_scope_guard
BEFORE INSERT ON onetime.parent_learning_attendance_events
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_parent_learning_attendance_scope();

CREATE OR REPLACE FUNCTION onetime.enforce_parent_learning_question_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.parent_learning_class_entitlements AS entitlement
     WHERE entitlement.participant_id = NEW.participant_id
       AND entitlement.household_id = NEW.household_id
       AND entitlement.account_key = NEW.account_key
       AND entitlement.product_key = NEW.product_key
       AND entitlement.runtime_tier = NEW.runtime_tier
       AND entitlement.verification_environment_id = NEW.verification_environment_id
       AND entitlement.class_series_key = NEW.class_series_key
       AND entitlement.entitlement_state = 'active'
  ) THEN
    RAISE EXCEPTION 'Parent question must target the active entitled class';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_learning_question_scope_guard
BEFORE INSERT ON onetime.parent_learning_questions
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_parent_learning_question_scope();

CREATE OR REPLACE FUNCTION onetime.reject_parent_learning_fact_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Parent learning activity facts are append-only';
END;
$$;

CREATE TRIGGER parent_learning_attendance_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_learning_attendance_events
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_learning_fact_mutation();

CREATE TRIGGER parent_learning_content_progress_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_learning_content_progress_events
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_learning_fact_mutation();

CREATE TRIGGER parent_learning_question_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_learning_questions
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_learning_fact_mutation();

INSERT INTO onetime.parent_learning_participants
  (participant_id, household_id, adult_id, human_account_id,
   participant_kind, learner_ordinal, state, version, product_key,
   runtime_tier, verification_environment_id, created_at, updated_at)
SELECT 'parent:' || household.household_id,
       household.household_id,
       household.owner_adult_id,
       household.owner_human_account_id,
       'parent',
       1,
       'active',
       1,
       household.product_key,
       household.runtime_tier,
       household.verification_environment_id,
       household.created_at,
       statement_timestamp()
  FROM onetime.v21_households AS household
  JOIN onetime.v21_adult_identities AS adult
    ON adult.adult_id = household.owner_adult_id
   AND adult.product_key = household.product_key
   AND adult.runtime_tier = household.runtime_tier
   AND adult.verification_environment_id = household.verification_environment_id
   AND adult.state = 'active'
  JOIN onetime.v21_human_accounts AS account
    ON account.human_account_id = household.owner_human_account_id
   AND account.adult_id = household.owner_adult_id
   AND account.product_key = household.product_key
   AND account.runtime_tier = household.runtime_tier
   AND account.verification_environment_id = household.verification_environment_id
   AND account.state = 'active'
  JOIN onetime.v21_human_account_role_memberships AS membership
    ON membership.human_account_id = account.human_account_id
   AND membership.role = 'parent'
   AND membership.revoked_at IS NULL
   AND membership.product_key = household.product_key
   AND membership.runtime_tier = household.runtime_tier
   AND membership.verification_environment_id = household.verification_environment_id
 WHERE household.classification = 'family'
   AND household.state = 'active'
ON CONFLICT (household_id, product_key, runtime_tier, verification_environment_id)
DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM onetime.parent_learning_participants AS participant
      JOIN onetime.contacts AS contact
        ON contact.contact_key = 'contact_' || participant.adult_id
       AND contact.product_key = participant.product_key
      JOIN onetime.portal_households AS portal
        ON portal.household_key = participant.household_id
       AND portal.product_key = participant.product_key
       AND portal.status = 'active'
     WHERE participant.state = 'active'
       AND contact.account_key <> portal.account_key
  ) THEN
    RAISE EXCEPTION 'active Family Parent has conflicting canonical account scope';
  END IF;
END;
$$;

WITH singleton_canonical_scope AS (
  SELECT product_key,
         min(account_key) AS account_key
    FROM onetime.class_series
   WHERE is_canonical = true
     AND status = 'active'
     AND series_state = 'active'
   GROUP BY product_key
  HAVING count(*) = 1
),
resolved_scope AS (
  SELECT participant.participant_id,
         participant.household_id,
         participant.product_key,
         participant.runtime_tier,
         participant.verification_environment_id,
         COALESCE(contact.account_key, portal.account_key, singleton.account_key) AS account_key,
         participant.created_at
    FROM onetime.parent_learning_participants AS participant
    LEFT JOIN onetime.contacts AS contact
      ON contact.contact_key = 'contact_' || participant.adult_id
     AND contact.product_key = participant.product_key
    LEFT JOIN onetime.portal_households AS portal
      ON portal.household_key = participant.household_id
     AND portal.product_key = participant.product_key
     AND portal.status = 'active'
    LEFT JOIN singleton_canonical_scope AS singleton
      ON singleton.product_key = participant.product_key
   WHERE participant.state = 'active'
)
INSERT INTO onetime.parent_learning_class_entitlements
  (entitlement_id, participant_id, household_id, account_key, product_key,
   runtime_tier, verification_environment_id, class_series_key,
   entitlement_state, source, effective_at, version)
SELECT 'parent-entitlement:' || substr(md5(
         scope.participant_id || ':' || series.account_key || ':' || series.class_series_key
       ), 1, 32),
       scope.participant_id,
       scope.household_id,
       series.account_key,
       scope.product_key,
       scope.runtime_tier,
       scope.verification_environment_id,
       series.class_series_key,
       'active',
       'existing_family_backfill',
       scope.created_at,
       1
  FROM resolved_scope AS scope
  JOIN onetime.class_series AS series
    ON series.account_key = scope.account_key
   AND series.product_key = scope.product_key
   AND series.is_canonical = true
   AND series.status = 'active'
   AND series.series_state = 'active'
ON CONFLICT (participant_id, account_key, product_key, class_series_key)
DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM onetime.parent_learning_participants AS participant
     WHERE participant.state = 'active'
       AND (
         SELECT count(*)
           FROM onetime.parent_learning_class_entitlements AS entitlement
          WHERE entitlement.participant_id = participant.participant_id
            AND entitlement.entitlement_state = 'active'
       ) <> 1
  ) THEN
    RAISE EXCEPTION 'active Parent learning participant lacks one canonical class entitlement';
  END IF;
END;
$$;
-- @postgres-only-end

SELECT 1;
