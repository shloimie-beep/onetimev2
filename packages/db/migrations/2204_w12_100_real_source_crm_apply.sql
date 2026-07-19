CREATE TABLE IF NOT EXISTS onetime.crm_real_source_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  target_environment text NOT NULL CHECK (
    target_environment IN ('local', 'test', 'staging', 'production')
  ),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  dry_run_report_sha256 text NOT NULL,
  approved_source_group_fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('applied', 'replayed', 'blocked')),
  planned_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL,
  backup_proof jsonb NOT NULL,
  operator_authorization_fingerprint text,
  raw_values_included boolean NOT NULL DEFAULT false CHECK (raw_values_included = false),
  production_side_effects boolean NOT NULL DEFAULT false,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS crm_real_source_import_batches_scope_idx
  ON onetime.crm_real_source_import_batches(account_key, product_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.crm_real_source_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_row_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.crm_real_source_import_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_id text NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  source_sheet_label text,
  row_fingerprint text NOT NULL,
  identity_fingerprint text,
  email_fingerprint text,
  phone_fingerprint text,
  contact_key text,
  result text NOT NULL CHECK (
    result IN (
      'inserted_contact',
      'skipped_existing_contact',
      'blocked_contact_schema',
      'blocked_duplicate',
      'blocked_identity_conflict',
      'blocked_quarantined',
      'blocked_invalid'
    )
  ),
  consent_state text NOT NULL CHECK (consent_state IN ('opted_in', 'opted_out', 'unknown')),
  suppression_state text NOT NULL CHECK (suppression_state IN ('active', 'suppressed', 'unknown')),
  email_campaign_eligible boolean NOT NULL DEFAULT false,
  whatsapp_campaign_eligible boolean NOT NULL DEFAULT false,
  rollback_action text NOT NULL CHECK (rollback_action IN ('delete_inserted_contact', 'none')),
  rollback_state text NOT NULL DEFAULT 'not_requested'
    CHECK (rollback_state IN ('not_requested', 'completed', 'skipped')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_values_included boolean NOT NULL DEFAULT false CHECK (raw_values_included = false),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_real_source_import_rows_batch_idx
  ON onetime.crm_real_source_import_rows(batch_key, result, created_at DESC);

CREATE INDEX IF NOT EXISTS crm_real_source_import_rows_contact_idx
  ON onetime.crm_real_source_import_rows(account_key, product_key, contact_key)
  WHERE contact_key IS NOT NULL;
