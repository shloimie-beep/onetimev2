CREATE TABLE onetime.worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type text NOT NULL CHECK (worker_type <> ''),
  worker_instance_key text NOT NULL CHECK (worker_instance_key <> ''),
  account_key text NOT NULL,
  product_key text NOT NULL,
  state text NOT NULL DEFAULT 'starting' CHECK (state IN ('starting', 'ready', 'draining', 'stopped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  draining_at timestamptz,
  stopped_at timestamptz,
  version text NOT NULL,
  commit_sha text NOT NULL,
  readiness jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_type, worker_instance_key)
);

CREATE INDEX worker_heartbeats_scope_idx
  ON onetime.worker_heartbeats(account_key, product_key, worker_type, last_seen_at DESC);

CREATE INDEX worker_heartbeats_lease_idx
  ON onetime.worker_heartbeats(state, lease_expires_at)
  WHERE state IN ('starting', 'ready', 'draining');

CREATE TABLE onetime.ops_synthetic_probe_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_run_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  target_base_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'blocked')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ops_synthetic_probe_runs_scope_idx
  ON onetime.ops_synthetic_probe_runs(account_key, product_key, completed_at DESC);

CREATE TABLE onetime.ops_restore_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_backup_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'blocked')),
  rpo_target_minutes integer NOT NULL CHECK (rpo_target_minutes > 0),
  rto_target_minutes integer NOT NULL CHECK (rto_target_minutes > 0),
  measured_rpo_minutes integer CHECK (measured_rpo_minutes >= 0),
  measured_rto_seconds integer CHECK (measured_rto_seconds >= 0),
  restored_schema_migration_count integer CHECK (restored_schema_migration_count >= 0),
  functional_smoke jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocker_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ops_restore_drills_scope_idx
  ON onetime.ops_restore_drills(account_key, product_key, created_at DESC);

CREATE TABLE onetime.ops_retention_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  target_table text NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  mode text NOT NULL CHECK (mode IN ('audit_only', 'dry_run', 'approved_apply')),
  last_checked_at timestamptz,
  last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ops_retention_jobs_scope_idx
  ON onetime.ops_retention_jobs(account_key, product_key, target_table);
