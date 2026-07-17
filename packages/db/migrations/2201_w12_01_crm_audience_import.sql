CREATE TABLE IF NOT EXISTS onetime.legacy_audience_source_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  manifest_sha256 text NOT NULL,
  manifest_payload jsonb NOT NULL,
  generated_by_user_key text NOT NULL,
  raw_values_included boolean NOT NULL DEFAULT false CHECK (raw_values_included = false),
  production_side_effects boolean NOT NULL DEFAULT false CHECK (production_side_effects = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, manifest_sha256)
);

CREATE INDEX IF NOT EXISTS legacy_audience_source_inventories_scope_idx
  ON onetime.legacy_audience_source_inventories(account_key, product_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_conflict_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  row_key text NOT NULL REFERENCES onetime.legacy_audience_import_rows(row_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  selected_contact_key text,
  decision text NOT NULL CHECK (
    decision IN (
      'accept_existing_contact',
      'stage_new_contact',
      'reject_unrelated',
      'mark_duplicate',
      'suppress_do_not_send',
      'needs_more_info'
    )
  ),
  idempotency_key text NOT NULL,
  decided_by_user_key text NOT NULL,
  reason text NOT NULL,
  raw_values_included boolean NOT NULL DEFAULT false CHECK (raw_values_included = false),
  production_side_effects boolean NOT NULL DEFAULT false CHECK (production_side_effects = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, row_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, selected_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_conflict_decisions_batch_idx
  ON onetime.legacy_audience_conflict_decisions(account_key, product_key, batch_key, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.legacy_audience_change_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apply_plan_key text NOT NULL UNIQUE,
  batch_key text NOT NULL REFERENCES onetime.legacy_audience_import_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run', 'apply')),
  target_environment text NOT NULL CHECK (target_environment IN ('local', 'test', 'staging', 'production')),
  status text NOT NULL CHECK (status IN ('dry_run', 'blocked', 'authorized_not_applied')),
  manifest_sha256 text NOT NULL,
  idempotency_key text NOT NULL,
  blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  planned_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL,
  operator_authorization_fingerprint text,
  real_bulk_import_applied boolean NOT NULL DEFAULT false CHECK (real_bulk_import_applied = false),
  production_side_effects boolean NOT NULL DEFAULT false CHECK (production_side_effects = false),
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, batch_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS legacy_audience_change_ledger_batch_idx
  ON onetime.legacy_audience_change_ledger(account_key, product_key, batch_key, created_at DESC);
