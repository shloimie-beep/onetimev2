CREATE TABLE IF NOT EXISTS onetime.legacy_audience_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('csv_normalized', 'xlsx_normalized')),
  source_label text NOT NULL,
  source_digest text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run')),
  status text NOT NULL DEFAULT 'dry_run_completed' CHECK (
    status IN ('dry_run_completed', 'rollback_recorded')
  ),
  row_count integer NOT NULL CHECK (row_count >= 0),
  dry_run_report jsonb NOT NULL,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_batches_scope_idx
  ON onetime.legacy_audience_import_batches(account_key, product_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  source_sheet_label text,
  row_fingerprint text NOT NULL,
  identity_fingerprint text,
  has_email boolean NOT NULL DEFAULT false,
  has_phone boolean NOT NULL DEFAULT false,
  audience_type text NOT NULL CHECK (audience_type IN ('family', 'school')),
  legacy_system_state text NOT NULL CHECK (legacy_system_state IN ('present', 'absent', 'unknown')),
  active_legacy_user boolean NOT NULL DEFAULT false,
  lead_state text NOT NULL CHECK (lead_state IN ('lead', 'not_lead', 'unknown')),
  consent_state text NOT NULL CHECK (consent_state IN ('opted_in', 'opted_out', 'unknown')),
  suppression_state text NOT NULL CHECK (suppression_state IN ('active', 'suppressed', 'unknown')),
  disposition text NOT NULL CHECK (
    disposition IN (
      'matched_existing_contact',
      'stage_new_contact',
      'duplicate_input',
      'manual_review'
    )
  ),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  segment_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_contact_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_key, row_fingerprint),
  FOREIGN KEY (account_key, product_key, matched_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_rows_batch_idx
  ON onetime.legacy_audience_import_rows(batch_key, source_row_number);

CREATE INDEX IF NOT EXISTS legacy_audience_rows_disposition_idx
  ON onetime.legacy_audience_import_rows(account_key, product_key, disposition, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  row_key text NOT NULL REFERENCES onetime.legacy_audience_import_rows(row_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  match_kind text NOT NULL CHECK (
    match_kind IN ('email', 'phone', 'email_and_phone', 'conflict', 'none')
  ),
  reason_code text NOT NULL,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_candidates_row_idx
  ON onetime.legacy_audience_match_candidates(batch_key, row_key);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_segment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  row_key text NOT NULL REFERENCES onetime.legacy_audience_import_rows(row_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  segment_code text NOT NULL CHECK (
    segment_code IN (
      'migration_invite_eligible',
      'active_legacy_user',
      'manual_review',
      'school_follow_up',
      'do_not_contact'
    )
  ),
  communication_eligible boolean NOT NULL DEFAULT false,
  consent_state text NOT NULL CHECK (consent_state IN ('opted_in', 'opted_out', 'unknown')),
  suppression_state text NOT NULL CHECK (suppression_state IN ('active', 'suppressed', 'unknown')),
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_segments_scope_idx
  ON onetime.legacy_audience_segment_snapshots(account_key, product_key, segment_code, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_rollback_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollback_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  requested_by_user_key text NOT NULL,
  idempotency_key text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'reviewed', 'closed')),
  affected_record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (account_key, product_key, batch_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_rollbacks_batch_idx
  ON onetime.legacy_audience_rollback_records(account_key, product_key, batch_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  batch_key text,
  row_key text,
  contact_key text,
  actor_user_key text NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('dry_run_recorded', 'dry_run_replayed', 'rollback_recorded')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_key) REFERENCES onetime.legacy_audience_import_batches(batch_key),
  FOREIGN KEY (row_key) REFERENCES onetime.legacy_audience_import_rows(row_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_audit_batch_idx
  ON onetime.legacy_audience_audit_events(account_key, product_key, batch_key, created_at DESC);
