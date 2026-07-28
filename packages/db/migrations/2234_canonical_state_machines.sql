CREATE TABLE onetime.canonical_aggregate_states (
  aggregate_kind text NOT NULL,
  aggregate_key text NOT NULL CHECK (aggregate_key <> ''),
  current_state text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL
    CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL
    CHECK (
      verification_environment_id IN (
        'ci',
        'provider_sandbox',
        'persistent_staging',
        'production_read_only',
        'production_operator_canary',
        'production_broad'
      )
    ),
  last_transition_key text NOT NULL UNIQUE,
  created_by_actor_kind text NOT NULL
    CHECK (created_by_actor_kind IN ('system', 'admin', 'parent', 'student', 'worker', 'reconciler')),
  created_by_actor_key text NOT NULL CHECK (created_by_actor_key <> ''),
  last_mutated_by_actor_kind text NOT NULL
    CHECK (last_mutated_by_actor_kind IN ('system', 'admin', 'parent', 'student', 'worker', 'reconciler')),
  last_mutated_by_actor_key text NOT NULL CHECK (last_mutated_by_actor_key <> ''),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aggregate_kind, aggregate_key),
  CHECK (
    (
      runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging')
    )
    OR (
      runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only',
        'production_operator_canary',
        'production_broad'
      )
    )
  ),
  CHECK (
    (aggregate_kind = 'human_account' AND current_state IN ('invited', 'active', 'disabled', 'archived'))
    OR (aggregate_kind = 'student' AND current_state IN ('active', 'archived'))
    OR (aggregate_kind = 'access' AND current_state IN ('free', 'active', 'grace', 'inactive'))
    OR (
      aggregate_kind = 'class_occurrence'
      AND current_state IN ('scheduled', 'preparing', 'ready', 'live', 'completed', 'canceled')
    )
    OR (
      aggregate_kind = 'content'
      AND current_state IN (
        'received',
        'validating',
        'processing',
        'needs_review',
        'approved',
        'publishing',
        'published',
        'failed',
        'archived'
      )
    )
    OR (
      aggregate_kind = 'student_question'
      AND current_state IN (
        'submitted',
        'answered_private',
        'approved_for_class',
        'published',
        'closed',
        'declined'
      )
    )
    OR (
      aggregate_kind = 'support'
      AND current_state IN ('open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed')
    )
    OR (
      aggregate_kind = 'billing_operation'
      AND current_state IN (
        'not_started',
        'leased',
        'in_flight',
        'accepted',
        'complete',
        'rejected',
        'retry_wait',
        'acceptance_unknown',
        'dead_letter',
        'canceled'
      )
    )
  ),
  CHECK (
    (current_state = 'archived' AND archived_at IS NOT NULL)
    OR (current_state <> 'archived' AND archived_at IS NULL)
  )
);

CREATE TABLE onetime.canonical_state_transition_events (
  transition_key text PRIMARY KEY CHECK (transition_key <> ''),
  aggregate_kind text NOT NULL,
  aggregate_key text NOT NULL CHECK (aggregate_key <> ''),
  previous_state text,
  next_state text NOT NULL,
  expected_version bigint NOT NULL CHECK (expected_version >= 0),
  resulting_version bigint NOT NULL CHECK (resulting_version = expected_version + 1),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL
    CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  actor_kind text NOT NULL
    CHECK (actor_kind IN ('system', 'admin', 'parent', 'student', 'worker', 'reconciler')),
  actor_key text NOT NULL CHECK (actor_key <> ''),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  canonical_request_hash text NOT NULL,
  content_failure_origin text
    CHECK (content_failure_origin IS NULL OR content_failure_origin IN ('validating', 'processing', 'publishing')),
  access_cause text
    CHECK (
      access_cause IS NULL
      OR access_cause IN (
        'free_period',
        'verified_paid_or_contract',
        'free_expired',
        'verified_renewal_failure',
        'verified_recovery',
        'grace_expired',
        'paid_or_contract_ended',
        'verified_reactivation',
        'household_archived',
        'administrative_block'
      )
    ),
  provider_dispatch_attempts integer CHECK (provider_dispatch_attempts IS NULL OR provider_dispatch_attempts >= 0),
  provider_reconciliation_attempts integer
    CHECK (provider_reconciliation_attempts IS NULL OR provider_reconciliation_attempts >= 0),
  provider_recovery_generation integer
    CHECK (provider_recovery_generation IS NULL OR provider_recovery_generation >= 0),
  current_lease_generation bigint
    CHECK (current_lease_generation IS NULL OR current_lease_generation > 0),
  presented_lease_generation bigint
    CHECK (presented_lease_generation IS NULL OR presented_lease_generation > 0),
  provider_request_occurred boolean,
  unknown_effect boolean,
  reconciliation_outcome text
    CHECK (
      reconciliation_outcome IS NULL
      OR reconciliation_outcome IN (
        'effect_exists_accepted',
        'effect_exists_complete',
        'effect_absent_retry_safe',
        'effect_permanently_rejected',
        'attempts_exhausted'
      )
    ),
  reconciliation_digest text,
  admin_recovery_authorized boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aggregate_kind, aggregate_key, idempotency_key),
  CHECK ((previous_state IS NULL) = (expected_version = 0)),
  CHECK (
    (
      runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging')
    )
    OR (
      runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only',
        'production_operator_canary',
        'production_broad'
      )
    )
  ),
  CHECK (
    aggregate_kind = 'billing_operation'
    OR (
      provider_dispatch_attempts IS NULL
      AND provider_reconciliation_attempts IS NULL
      AND provider_recovery_generation IS NULL
      AND current_lease_generation IS NULL
      AND presented_lease_generation IS NULL
      AND provider_request_occurred IS NULL
      AND unknown_effect IS NULL
      AND reconciliation_outcome IS NULL
      AND reconciliation_digest IS NULL
      AND admin_recovery_authorized IS NULL
    )
  ),
  CHECK (
    aggregate_kind <> 'billing_operation'
    OR (
      provider_dispatch_attempts IS NOT NULL
      AND provider_reconciliation_attempts IS NOT NULL
      AND provider_recovery_generation IS NOT NULL
      AND provider_request_occurred IS NOT NULL
      AND unknown_effect IS NOT NULL
    )
  ),
  CHECK (
    (aggregate_kind = 'content' AND access_cause IS NULL)
    OR (aggregate_kind = 'access' AND content_failure_origin IS NULL)
    OR (aggregate_kind NOT IN ('content', 'access') AND content_failure_origin IS NULL AND access_cause IS NULL)
  )
);

CREATE INDEX canonical_state_transition_scope_idx
  ON onetime.canonical_state_transition_events(
    aggregate_kind,
    aggregate_key,
    resulting_version DESC,
    created_at DESC
  );

CREATE INDEX canonical_billing_reconciliation_idx
  ON onetime.canonical_aggregate_states(updated_at, aggregate_key)
  WHERE aggregate_kind = 'billing_operation'
    AND current_state IN ('acceptance_unknown', 'accepted', 'retry_wait', 'dead_letter');

-- @postgres-only-begin
ALTER TABLE onetime.canonical_state_transition_events
  ADD CONSTRAINT canonical_state_transition_request_hash_shape_check
  CHECK (
    length(canonical_request_hash) = 64
    AND canonical_request_hash = lower(canonical_request_hash)
    AND canonical_request_hash ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT canonical_state_transition_reconciliation_digest_shape_check
  CHECK (
    reconciliation_digest IS NULL
    OR (
      length(reconciliation_digest) = 64
      AND reconciliation_digest = lower(reconciliation_digest)
      AND reconciliation_digest ~ '^[a-f0-9]{64}$'
    )
  );

CREATE OR REPLACE FUNCTION onetime.canonical_state_value_is_valid(
  p_kind text,
  p_state text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'human_account' THEN p_state IN ('invited', 'active', 'disabled', 'archived')
    WHEN 'student' THEN p_state IN ('active', 'archived')
    WHEN 'access' THEN p_state IN ('free', 'active', 'grace', 'inactive')
    WHEN 'class_occurrence' THEN p_state IN ('scheduled', 'preparing', 'ready', 'live', 'completed', 'canceled')
    WHEN 'content' THEN p_state IN (
      'received', 'validating', 'processing', 'needs_review', 'approved',
      'publishing', 'published', 'failed', 'archived'
    )
    WHEN 'student_question' THEN p_state IN (
      'submitted', 'answered_private', 'approved_for_class', 'published', 'closed', 'declined'
    )
    WHEN 'support' THEN p_state IN ('open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed')
    WHEN 'billing_operation' THEN p_state IN (
      'not_started', 'leased', 'in_flight', 'accepted', 'complete',
      'rejected', 'retry_wait', 'acceptance_unknown', 'dead_letter', 'canceled'
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION onetime.canonical_state_transition_is_allowed(
  p_kind text,
  p_previous text,
  p_next text,
  p_content_failure_origin text,
  p_access_cause text,
  p_dispatch_attempts integer,
  p_reconciliation_attempts integer,
  p_recovery_generation integer,
  p_current_lease_generation bigint,
  p_presented_lease_generation bigint,
  p_provider_request_occurred boolean,
  p_unknown_effect boolean,
  p_reconciliation_outcome text,
  p_reconciliation_digest text,
  p_admin_recovery_authorized boolean
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF NOT onetime.canonical_state_value_is_valid(p_kind, p_next)
    OR (p_previous IS NOT NULL AND NOT onetime.canonical_state_value_is_valid(p_kind, p_previous))
    OR p_previous = p_next THEN
    RETURN false;
  END IF;

  IF p_kind = 'human_account' THEN
    RETURN
      (p_previous IS NULL AND p_next IN ('active', 'invited'))
      OR (p_previous = 'invited' AND p_next IN ('active', 'archived'))
      OR (p_previous = 'active' AND p_next IN ('disabled', 'archived'))
      OR (p_previous = 'disabled' AND p_next IN ('active', 'archived'));
  ELSIF p_kind = 'student' THEN
    RETURN
      (p_previous IS NULL AND p_next = 'active')
      OR (p_previous = 'active' AND p_next = 'archived')
      OR (p_previous = 'archived' AND p_next = 'active');
  ELSIF p_kind = 'access' THEN
    RETURN
      (p_previous IS NULL AND (
        (p_next = 'free' AND p_access_cause = 'free_period')
        OR (p_next = 'inactive' AND p_access_cause IN ('household_archived', 'administrative_block'))
      ))
      OR (p_previous = 'free' AND (
        (p_next = 'active' AND p_access_cause = 'verified_paid_or_contract')
        OR (p_next = 'inactive' AND p_access_cause IN ('free_expired', 'household_archived', 'administrative_block'))
      ))
      OR (p_previous = 'active' AND (
        (p_next = 'grace' AND p_access_cause = 'verified_renewal_failure')
        OR (p_next = 'inactive' AND p_access_cause IN ('paid_or_contract_ended', 'household_archived', 'administrative_block'))
      ))
      OR (p_previous = 'grace' AND (
        (p_next = 'active' AND p_access_cause = 'verified_recovery')
        OR (p_next = 'inactive' AND p_access_cause IN ('grace_expired', 'household_archived', 'administrative_block'))
      ))
      OR (p_previous = 'inactive' AND (
        (p_next = 'free' AND p_access_cause = 'free_period')
        OR (p_next = 'active' AND p_access_cause IN ('verified_reactivation', 'verified_paid_or_contract'))
      ));
  ELSIF p_kind = 'class_occurrence' THEN
    RETURN
      (p_previous IS NULL AND p_next = 'scheduled')
      OR (p_previous = 'scheduled' AND p_next IN ('preparing', 'canceled'))
      OR (p_previous = 'preparing' AND p_next IN ('ready', 'canceled'))
      OR (p_previous = 'ready' AND p_next IN ('live', 'canceled'))
      OR (p_previous = 'live' AND p_next = 'completed')
      OR (p_previous = 'canceled' AND p_next = 'scheduled');
  ELSIF p_kind = 'content' THEN
    RETURN
      (p_previous IS NULL AND p_next = 'received' AND p_content_failure_origin IS NULL)
      OR (p_previous = 'received' AND p_next IN ('validating', 'archived') AND p_content_failure_origin IS NULL)
      OR (p_previous = 'validating' AND (
        (p_next = 'processing' AND p_content_failure_origin IS NULL)
        OR (p_next = 'failed' AND p_content_failure_origin = 'validating')
      ))
      OR (p_previous = 'processing' AND (
        (p_next = 'needs_review' AND p_content_failure_origin IS NULL)
        OR (p_next = 'failed' AND p_content_failure_origin = 'processing')
      ))
      OR (p_previous = 'needs_review' AND p_next IN ('approved', 'archived') AND p_content_failure_origin IS NULL)
      OR (p_previous = 'approved' AND p_next IN ('publishing', 'archived') AND p_content_failure_origin IS NULL)
      OR (p_previous = 'publishing' AND (
        (p_next = 'published' AND p_content_failure_origin IS NULL)
        OR (p_next = 'failed' AND p_content_failure_origin = 'publishing')
      ))
      OR (p_previous = 'published' AND p_next IN ('approved', 'archived') AND p_content_failure_origin IS NULL)
      OR (p_previous = 'failed' AND p_next = p_content_failure_origin)
      OR (p_previous = 'failed' AND p_next = 'archived' AND p_content_failure_origin IS NULL);
  ELSIF p_kind = 'student_question' THEN
    RETURN
      (p_previous IS NULL AND p_next = 'submitted')
      OR (p_previous = 'submitted' AND p_next IN ('answered_private', 'approved_for_class', 'declined'))
      OR (p_previous = 'answered_private' AND p_next IN ('approved_for_class', 'declined', 'closed'))
      OR (p_previous = 'approved_for_class' AND p_next IN ('published', 'declined'))
      OR (p_previous = 'published' AND p_next IN ('declined', 'closed'))
      OR (p_previous = 'declined' AND p_next = 'closed');
  ELSIF p_kind = 'support' THEN
    RETURN
      (p_previous IS NULL AND p_next = 'open')
      OR (p_previous = 'open' AND p_next IN ('in_progress', 'resolved'))
      OR (p_previous = 'in_progress' AND p_next IN ('waiting_on_requester', 'resolved'))
      OR (p_previous = 'waiting_on_requester' AND p_next IN ('in_progress', 'resolved'))
      OR (p_previous = 'resolved' AND p_next IN ('in_progress', 'closed'));
  ELSIF p_kind = 'billing_operation' THEN
    IF p_previous IS NULL THEN
      RETURN p_next = 'not_started';
    ELSIF p_previous IN ('not_started', 'retry_wait') AND p_next = 'leased' THEN
      RETURN p_dispatch_attempts < 8
        AND p_presented_lease_generation IS NOT NULL
        AND p_presented_lease_generation > COALESCE(p_current_lease_generation, 0);
    ELSIF p_previous = 'leased' AND p_next = 'in_flight' THEN
      RETURN p_current_lease_generation IS NOT NULL
        AND p_presented_lease_generation = p_current_lease_generation;
    ELSIF p_previous = 'leased' AND p_next = 'retry_wait' THEN
      RETURN p_presented_lease_generation = p_current_lease_generation
        AND NOT p_provider_request_occurred
        AND NOT p_unknown_effect;
    ELSIF p_previous IN ('leased', 'in_flight') AND p_next = 'acceptance_unknown' THEN
      RETURN p_presented_lease_generation = p_current_lease_generation
        AND p_unknown_effect;
    ELSIF p_previous = 'in_flight' AND p_next IN ('accepted', 'complete', 'rejected') THEN
      RETURN p_presented_lease_generation = p_current_lease_generation
        AND NOT p_unknown_effect;
    ELSIF p_previous = 'in_flight' AND p_next = 'retry_wait' THEN
      RETURN p_presented_lease_generation = p_current_lease_generation
        AND NOT p_provider_request_occurred
        AND NOT p_unknown_effect;
    ELSIF p_previous = 'accepted' AND p_next = 'complete' THEN
      RETURN p_reconciliation_digest IS NOT NULL;
    ELSIF p_previous = 'acceptance_unknown' THEN
      RETURN p_unknown_effect
        AND p_reconciliation_digest IS NOT NULL
        AND (
          (p_next = 'accepted' AND p_reconciliation_outcome = 'effect_exists_accepted')
          OR (p_next = 'complete' AND p_reconciliation_outcome = 'effect_exists_complete')
          OR (p_next = 'retry_wait' AND p_reconciliation_outcome = 'effect_absent_retry_safe')
          OR (p_next = 'rejected' AND p_reconciliation_outcome = 'effect_permanently_rejected')
          OR (
            p_next = 'dead_letter'
            AND p_reconciliation_outcome = 'attempts_exhausted'
            AND p_dispatch_attempts + p_reconciliation_attempts >= 8
          )
        );
    ELSIF p_previous = 'retry_wait' AND p_next = 'dead_letter' THEN
      RETURN p_dispatch_attempts >= 8;
    ELSIF p_previous IN ('not_started', 'leased', 'retry_wait') AND p_next = 'canceled' THEN
      RETURN NOT p_provider_request_occurred AND NOT p_unknown_effect;
    ELSIF p_previous = 'dead_letter' AND p_next = 'not_started' THEN
      RETURN p_admin_recovery_authorized AND p_recovery_generation > 0;
    END IF;
  END IF;

  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION onetime.apply_canonical_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_event onetime.canonical_state_transition_events%ROWTYPE;
  current_record onetime.canonical_aggregate_states%ROWTYPE;
BEGIN
  SELECT *
    INTO prior_event
    FROM onetime.canonical_state_transition_events
   WHERE aggregate_kind = NEW.aggregate_kind
     AND aggregate_key = NEW.aggregate_key
     AND idempotency_key = NEW.idempotency_key;

  IF FOUND THEN
    IF prior_event.canonical_request_hash = NEW.canonical_request_hash
      AND prior_event.previous_state IS NOT DISTINCT FROM NEW.previous_state
      AND prior_event.next_state = NEW.next_state
      AND prior_event.expected_version = NEW.expected_version THEN
      RETURN NULL;
    END IF;
    RAISE EXCEPTION 'canonical state idempotency conflict'
      USING ERRCODE = '23505';
  END IF;

  IF NOT onetime.canonical_state_transition_is_allowed(
    NEW.aggregate_kind,
    NEW.previous_state,
    NEW.next_state,
    NEW.content_failure_origin,
    NEW.access_cause,
    NEW.provider_dispatch_attempts,
    NEW.provider_reconciliation_attempts,
    NEW.provider_recovery_generation,
    NEW.current_lease_generation,
    NEW.presented_lease_generation,
    NEW.provider_request_occurred,
    NEW.unknown_effect,
    NEW.reconciliation_outcome,
    NEW.reconciliation_digest,
    NEW.admin_recovery_authorized
  ) THEN
    RAISE EXCEPTION 'canonical state transition denied'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO current_record
    FROM onetime.canonical_aggregate_states
   WHERE aggregate_kind = NEW.aggregate_kind
     AND aggregate_key = NEW.aggregate_key
   FOR UPDATE;

  IF NEW.previous_state IS NULL THEN
    IF FOUND OR NEW.expected_version <> 0 THEN
      RAISE EXCEPTION 'canonical state creation version conflict'
        USING ERRCODE = '40001';
    END IF;

    INSERT INTO onetime.canonical_aggregate_states (
      aggregate_kind,
      aggregate_key,
      current_state,
      version,
      product_key,
      runtime_tier,
      verification_environment_id,
      last_transition_key,
      created_by_actor_kind,
      created_by_actor_key,
      last_mutated_by_actor_kind,
      last_mutated_by_actor_key,
      archived_at,
      created_at,
      updated_at
    ) VALUES (
      NEW.aggregate_kind,
      NEW.aggregate_key,
      NEW.next_state,
      NEW.resulting_version,
      NEW.product_key,
      NEW.runtime_tier,
      NEW.verification_environment_id,
      NEW.transition_key,
      NEW.actor_kind,
      NEW.actor_key,
      NEW.actor_kind,
      NEW.actor_key,
      CASE WHEN NEW.next_state = 'archived' THEN NEW.created_at ELSE NULL END,
      NEW.created_at,
      NEW.created_at
    );
  ELSE
    IF NOT FOUND
      OR current_record.current_state <> NEW.previous_state
      OR current_record.version <> NEW.expected_version
      OR current_record.product_key <> NEW.product_key
      OR current_record.runtime_tier <> NEW.runtime_tier
      OR current_record.verification_environment_id <> NEW.verification_environment_id THEN
      RAISE EXCEPTION 'canonical state stale version or scope conflict'
        USING ERRCODE = '40001';
    END IF;

    UPDATE onetime.canonical_aggregate_states
       SET current_state = NEW.next_state,
           version = NEW.resulting_version,
           last_transition_key = NEW.transition_key,
           last_mutated_by_actor_kind = NEW.actor_kind,
           last_mutated_by_actor_key = NEW.actor_key,
           archived_at = CASE WHEN NEW.next_state = 'archived' THEN NEW.created_at ELSE NULL END,
           updated_at = NEW.created_at
     WHERE aggregate_kind = NEW.aggregate_kind
       AND aggregate_key = NEW.aggregate_key
       AND version = NEW.expected_version;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'canonical state concurrent update conflict'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION onetime.reject_canonical_state_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'canonical state transition events are append-only'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER canonical_state_transition_apply
BEFORE INSERT ON onetime.canonical_state_transition_events
FOR EACH ROW
EXECUTE FUNCTION onetime.apply_canonical_state_transition();

CREATE TRIGGER canonical_state_transition_append_only
BEFORE UPDATE OR DELETE ON onetime.canonical_state_transition_events
FOR EACH ROW
EXECUTE FUNCTION onetime.reject_canonical_state_event_mutation();

REVOKE INSERT, UPDATE, DELETE ON onetime.canonical_aggregate_states FROM PUBLIC;
REVOKE UPDATE, DELETE ON onetime.canonical_state_transition_events FROM PUBLIC;

COMMENT ON TABLE onetime.canonical_aggregate_states IS
  'Canonical One Time v2.1 lifecycle state and optimistic version for assigned account, Student, access, occurrence, content, question, support, and billing-operation aggregates.';
COMMENT ON TABLE onetime.canonical_state_transition_events IS
  'Append-only, idempotent One Time v2.1 state transitions. Inserts are the only supported mutation path and atomically update canonical_aggregate_states.';
-- @postgres-only-end
