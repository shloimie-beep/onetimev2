CREATE TABLE IF NOT EXISTS onetime.ops04_source_files (
  file_id text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  adapter_family text NOT NULL,
  adapter_version text NOT NULL,
  file_sha256 text NOT NULL CHECK (file_sha256 <> ''),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  safe_path_fingerprint text NOT NULL,
  workbook_sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  normalized_headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  physical_row_count integer NOT NULL DEFAULT 0 CHECK (physical_row_count >= 0),
  blank_row_count integer NOT NULL DEFAULT 0 CHECK (blank_row_count >= 0),
  error_row_count integer NOT NULL DEFAULT 0 CHECK (error_row_count >= 0),
  classification_status text NOT NULL DEFAULT 'unclassified_source' CHECK (
    classification_status IN ('classified_source', 'unclassified_source', 'rejected_source')
  ),
  snapshot_semantics text NOT NULL DEFAULT 'unknown' CHECK (
    snapshot_semantics IN ('snapshot', 'incremental', 'unknown')
  ),
  timestamp_policy text NOT NULL DEFAULT 'unknown',
  consent_suppression_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, file_sha256, adapter_version)
);

CREATE TABLE IF NOT EXISTS onetime.ops04_batches (
  batch_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 <> ''),
  mapping_sha256 text NOT NULL CHECK (mapping_sha256 <> ''),
  database_snapshot_key text NOT NULL,
  dry_run_hash text NOT NULL CHECK (dry_run_hash <> ''),
  state text NOT NULL CHECK (
    state IN ('discovered','parsed','previewed','review_required','approved','applying','applied','verified','failed','rejected','rolled_back')
  ),
  mode text NOT NULL CHECK (mode IN ('dry_run', 'synthetic_rehearsal', 'staging_rehearsal')),
  row_count integer NOT NULL CHECK (row_count >= 0),
  action_count integer NOT NULL CHECK (action_count >= 0),
  production_import_authorized boolean NOT NULL DEFAULT false,
  campaign_send_authorized boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'absent' CHECK (
    approval_status IN ('absent', 'valid_synthetic', 'valid_nonproduction', 'invalid', 'expired')
  ),
  dry_run_report jsonb NOT NULL,
  reconciliation_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, manifest_sha256, mapping_sha256, database_snapshot_key)
);

CREATE INDEX IF NOT EXISTS ops04_batches_scope_state_idx
  ON onetime.ops04_batches(account_key, product_key, state, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.ops04_source_row_versions (
  row_version_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  file_id text,
  source_row_key text NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  source_sheet_label text,
  row_hmac text NOT NULL,
  row_version_sha256 text NOT NULL CHECK (row_version_sha256 <> ''),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  old_external_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  normalized_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_key, source_row_key, row_version_sha256)
);

CREATE INDEX IF NOT EXISTS ops04_source_rows_batch_idx
  ON onetime.ops04_source_row_versions(batch_key, source_row_number);

CREATE TABLE IF NOT EXISTS onetime.ops04_external_identities (
  identity_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  object_type text NOT NULL,
  external_id_text text NOT NULL,
  source_row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  status text NOT NULL DEFAULT 'observed' CHECK (status IN ('observed', 'linked', 'conflict')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, object_type, external_id_text)
);

CREATE TABLE IF NOT EXISTS onetime.ops04_legacy_membership_events (
  event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  external_identity_key text,
  legacy_state text NOT NULL,
  plan_raw text,
  effective_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  source_row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops04_legacy_membership_scope_idx
  ON onetime.ops04_legacy_membership_events(account_key, product_key, contact_key, observed_at DESC);

CREATE TABLE IF NOT EXISTS onetime.ops04_contact_points (
  contact_point_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  point_type text NOT NULL CHECK (point_type IN ('email', 'phone', 'whatsapp')),
  point_hmac text NOT NULL,
  normalized_state text NOT NULL CHECK (
    normalized_state IN ('valid', 'invalid', 'ambiguous_local_phone', 'missing')
  ),
  ownership_state text NOT NULL DEFAULT 'exclusive_declared' CHECK (
    ownership_state IN ('exclusive_verified','exclusive_declared','shared_household','shared_organization','shared_unresolved','disputed','invalid')
  ),
  source_row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, point_type, point_hmac)
);

CREATE TABLE IF NOT EXISTS onetime.ops04_contact_point_owners (
  owner_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_point_key text NOT NULL REFERENCES onetime.ops04_contact_points(contact_point_key),
  contact_key text,
  owner_role text NOT NULL DEFAULT 'unknown',
  ownership_state text NOT NULL,
  source_row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, contact_point_key, contact_key, owner_role)
);

CREATE TABLE IF NOT EXISTS onetime.ops04_channel_state_events (
  channel_state_event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  contact_point_key text,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  consent_state text NOT NULL,
  suppression_state text NOT NULL,
  reason_code text NOT NULL,
  source_authority integer NOT NULL DEFAULT 0,
  effective_at timestamptz,
  source_row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops04_channel_state_scope_idx
  ON onetime.ops04_channel_state_events(account_key, product_key, channel, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.ops04_match_decisions (
  decision_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  primary_disposition text NOT NULL CHECK (
    primary_disposition IN ('manual_review','suppressed','already_migrated','migration_invitation_eligible','blast_candidate')
  ),
  matched_contact_key text,
  candidate_contact_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  quarantine_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  independent_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_snapshots jsonb NOT NULL DEFAULT '{}'::jsonb,
  sends_allowed boolean NOT NULL DEFAULT false CHECK (sends_allowed = false),
  target_version integer,
  candidate_set_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_key, row_version_key)
);

CREATE INDEX IF NOT EXISTS ops04_match_decisions_disposition_idx
  ON onetime.ops04_match_decisions(account_key, product_key, primary_disposition, created_at DESC);

CREATE TABLE IF NOT EXISTS onetime.ops04_action_ledger (
  action_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  row_version_key text NOT NULL REFERENCES onetime.ops04_source_row_versions(row_version_key),
  decision_key text NOT NULL REFERENCES onetime.ops04_match_decisions(decision_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  action_type text NOT NULL CHECK (
    action_type IN ('create_contact','link_external_identity','append_legacy_membership_event','append_lead_event','add_contact_point','add_contact_point_owner','append_channel_state_event','add_relationship','add_tag_assignment','link_source_provenance','set_migration_projection','no_op_unchanged','quarantine_manual_review','reject_insufficient_identity')
  ),
  target_table text NOT NULL,
  target_key text,
  target_precondition_version integer,
  owned_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned','claimed','committed','no_op','quarantined','failed','verified','rolled_back','rollback_conflict')
  ),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  worker_key text,
  applied_version integer,
  actor_user_key text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  committed_at timestamptz,
  verified_at timestamptz,
  rolled_back_at timestamptz,
  UNIQUE (batch_key, action_type, target_table, target_key, row_version_key)
);

CREATE INDEX IF NOT EXISTS ops04_action_ledger_claim_idx
  ON onetime.ops04_action_ledger(batch_key, status, created_at ASC);

CREATE TABLE IF NOT EXISTS onetime.ops04_tag_assignments (
  assignment_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  action_key text NOT NULL REFERENCES onetime.ops04_action_ledger(action_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text,
  tag_key text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);

CREATE TABLE IF NOT EXISTS onetime.ops04_rollback_events (
  rollback_event_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  action_key text REFERENCES onetime.ops04_action_ledger(action_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  result text NOT NULL CHECK (result IN ('reversed', 'already_reversed', 'conflict', 'failed')),
  reason_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onetime.ops04_reconciliation_totals (
  totals_key text PRIMARY KEY,
  batch_key text NOT NULL REFERENCES onetime.ops04_batches(batch_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  totals jsonb NOT NULL,
  equations_balanced boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onetime.ops04_audit_events (
  audit_event_key text PRIMARY KEY,
  batch_key text,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  event_type text NOT NULL,
  event_hash text NOT NULL CHECK (event_hash <> ''),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops04_audit_events_batch_idx
  ON onetime.ops04_audit_events(account_key, product_key, batch_key, created_at DESC);
