ALTER TABLE onetime.rabbi_internal_tasks
  ADD COLUMN attempts integer NOT NULL DEFAULT 0
    CHECK (attempts >= 0 AND attempts <= 8),
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3
    CHECK (max_attempts >= 1 AND max_attempts <= 8),
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_generation integer NOT NULL DEFAULT 0
    CHECK (lease_generation >= 0),
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN last_error_code text,
  ADD COLUMN dead_lettered_at timestamptz;

ALTER TABLE onetime.rabbi_internal_tasks
  DROP CONSTRAINT IF EXISTS rabbi_internal_tasks_status_check,
  DROP CONSTRAINT IF EXISTS rabbi_internal_tasks_constraint_1;

ALTER TABLE onetime.rabbi_internal_tasks
  ADD CONSTRAINT rabbi_internal_tasks_status_queue_check CHECK (
    status IN ('queued', 'in_progress', 'blocked', 'completed', 'cancelled', 'dead_letter')
  ),
  ADD CONSTRAINT rabbi_internal_tasks_agent_lease_check CHECK (
    task_key NOT LIKE 'rabbi_agent_%'
    OR status <> 'in_progress'
    OR (
      lease_owner IS NOT NULL
      AND lease_expires_at IS NOT NULL
      AND attempts >= 1
    )
  ),
  ADD CONSTRAINT rabbi_internal_tasks_agent_terminal_check CHECK (
    task_key NOT LIKE 'rabbi_agent_%'
    OR status <> 'dead_letter'
    OR dead_lettered_at IS NOT NULL
  );

CREATE INDEX rabbi_internal_tasks_agent_claim_idx
  ON onetime.rabbi_internal_tasks(
    status,
    next_attempt_at,
    lease_expires_at,
    created_at,
    task_key
  )
  WHERE task_key LIKE 'rabbi_agent_%';

SELECT 1;
