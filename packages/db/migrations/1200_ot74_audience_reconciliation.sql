CREATE TABLE IF NOT EXISTS onetime.audience_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_spreadsheet_key text NOT NULL,
  source_name text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN (
    'legacy_audience_export',
    'school_submission_export',
    'synthetic_fixture'
  )),
  dry_run_only boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'dry_run' CHECK (status IN (
    'dry_run',
    'staged',
    'rolled_back'
  )),
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  reason_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz,
  rollback_key text,
  CONSTRAINT audience_import_batches_dry_run_guard CHECK (dry_run_only IS TRUE)
);

CREATE UNIQUE INDEX IF NOT EXISTS audience_import_batches_scope_batch_idx
  ON onetime.audience_import_batches(account_key, product_key, batch_key);

CREATE TABLE IF NOT EXISTS onetime.audience_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.audience_import_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_spreadsheet_key text NOT NULL,
  source_sheet_name text NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number >= 1),
  row_fingerprint text NOT NULL,
  normalized_email text,
  normalized_phone text,
  display_name_present boolean NOT NULL DEFAULT false,
  source_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_status text NOT NULL CHECK (consent_status IN (
    'consented',
    'not_recorded',
    'unsubscribed',
    'unknown'
  )),
  suppression_status text NOT NULL CHECK (suppression_status IN (
    'active',
    'do_not_contact',
    'unsubscribed',
    'bounced',
    'complaint',
    'wrong_number'
  )),
  reconciliation_status text NOT NULL CHECK (reconciliation_status IN (
    'matched_existing',
    'new_contact_candidate',
    'manual_review',
    'duplicate_input',
    'blocked_do_not_contact'
  )),
  matched_contact_key text,
  manual_review_reason text,
  communication_eligibility text NOT NULL CHECK (communication_eligibility IN (
    'eligible',
    'needs_consent_review',
    'blocked_missing_channel',
    'blocked_suppression'
  )),
  entitlement_policy text NOT NULL CHECK (entitlement_policy IN (
    'no_class_or_portal_entitlement',
    'not_applicable'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, matched_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS audience_import_rows_batch_fingerprint_idx
  ON onetime.audience_import_rows(account_key, product_key, batch_key, row_fingerprint);

CREATE INDEX IF NOT EXISTS audience_import_rows_manual_review_idx
  ON onetime.audience_import_rows(account_key, product_key, reconciliation_status)
  WHERE reconciliation_status IN ('manual_review', 'blocked_do_not_contact');

CREATE TABLE IF NOT EXISTS onetime.audience_segment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  segment_key text NOT NULL CHECK (segment_key IN (
    'migration_invite_eligible',
    'active_legacy_user',
    'manual_review',
    'school_follow_up',
    'do_not_contact'
  )),
  batch_key text NOT NULL REFERENCES onetime.audience_import_batches(batch_key),
  row_key text NOT NULL REFERENCES onetime.audience_import_rows(row_key),
  contact_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  reason text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  rollback_key text,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS audience_segment_assignments_scope_segment_idx
  ON onetime.audience_segment_assignments(account_key, product_key, segment_key, status);

CREATE TABLE IF NOT EXISTS onetime.audience_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  batch_key text NOT NULL REFERENCES onetime.audience_import_batches(batch_key),
  row_key text REFERENCES onetime.audience_import_rows(row_key),
  contact_key text,
  event_type text NOT NULL CHECK (event_type IN (
    'dry_run_created',
    'row_reconciled',
    'manual_review_required',
    'segment_derived',
    'rollback_planned',
    'rollback_applied'
  )),
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS audience_reconciliation_events_batch_idx
  ON onetime.audience_reconciliation_events(account_key, product_key, batch_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.audience_import_rollbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollback_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  batch_key text NOT NULL REFERENCES onetime.audience_import_batches(batch_key),
  rollback_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  destructive_contact_delete boolean NOT NULL DEFAULT false,
  planned_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  applied_by_user_key text,
  CONSTRAINT audience_import_rollbacks_no_contact_delete CHECK (destructive_contact_delete IS FALSE)
);

CREATE UNIQUE INDEX IF NOT EXISTS audience_import_rollbacks_batch_idx
  ON onetime.audience_import_rollbacks(account_key, product_key, batch_key, rollback_key);
