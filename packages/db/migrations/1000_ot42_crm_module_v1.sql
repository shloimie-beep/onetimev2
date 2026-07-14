ALTER TABLE onetime.contacts
  ADD COLUMN IF NOT EXISTS archived_by_user_key text,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS prior_lead_status text,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_by_user_key text;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_scope_contact_key_idx
  ON onetime.contacts(account_key, product_key, contact_key);

CREATE UNIQUE INDEX IF NOT EXISTS account_users_scope_user_key_idx
  ON onetime.account_users(account_key, product_key, user_key);

CREATE TABLE IF NOT EXISTS onetime.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  display_name text NOT NULL,
  normalized_name text NOT NULL,
  visual_token text,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_by_user_key text,
  archived_at timestamptz,
  archive_reason text,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT crm_tags_plain_name CHECK (display_name <> ''),
  CONSTRAINT crm_tags_visual_token CHECK (
    visual_token IS NULL OR visual_token IN ('yellow', 'ice', 'neutral')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_scope_key_idx
  ON onetime.crm_tags(account_key, product_key, tag_key);

CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_active_name_idx
  ON onetime.crm_tags(account_key, product_key, normalized_name)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS onetime.crm_contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  tag_key text NOT NULL,
  assigned_by_user_key text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_by_user_key text,
  removed_at timestamptz,
  remove_reason text,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, tag_key)
    REFERENCES onetime.crm_tags(account_key, product_key, tag_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_contact_tags_active_pair_idx
  ON onetime.crm_contact_tags(account_key, product_key, contact_key, tag_key)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_contact_tags_tag_filter_idx
  ON onetime.crm_contact_tags(account_key, product_key, tag_key, contact_key)
  WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS onetime.crm_contact_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN (
    'provenance_import_source',
    'legacy_membership',
    'legacy_activity',
    'migration_eligibility'
  )),
  value_code text NOT NULL,
  source text NOT NULL,
  observed_at timestamptz,
  effective_at timestamptz,
  ended_at timestamptz,
  producer_key text,
  actor_user_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX IF NOT EXISTS crm_contact_facts_scope_idx
  ON onetime.crm_contact_facts(account_key, product_key, contact_key, dimension)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS onetime.crm_contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  body text NOT NULL CHECK (body <> ''),
  author_user_key text,
  source text NOT NULL CHECK (source IN ('manual_crm', 'legacy_scalar_backfill')),
  backfill_marker text,
  created_at timestamptz NOT NULL DEFAULT now(),
  audit_correlation_key text,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_contact_notes_backfill_once_idx
  ON onetime.crm_contact_notes(account_key, product_key, backfill_marker)
  WHERE backfill_marker IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_contact_notes_page_idx
  ON onetime.crm_contact_notes(account_key, product_key, contact_key, created_at DESC, note_key DESC);

INSERT INTO onetime.crm_contact_notes
  (note_key, account_key, product_key, contact_key, body, author_user_key, source, backfill_marker)
SELECT
  'note_backfill_' || contact_key,
  account_key,
  product_key,
  contact_key,
  internal_note,
  NULL,
  'legacy_scalar_backfill',
  'legacy_scalar_note:' || contact_key
FROM onetime.contacts
WHERE internal_note <> ''
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS onetime.crm_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_contact_key text NOT NULL,
  target_contact_key text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'related',
    'parent_guardian',
    'child_dependent',
    'spouse_partner',
    'sibling',
    'household',
    'organization_contact',
    'other'
  )),
  label text,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  unlinked_by_user_key text,
  unlinked_at timestamptz,
  unlink_reason text,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT crm_relationships_no_self CHECK (source_contact_key <> target_contact_key),
  CONSTRAINT crm_relationships_other_label CHECK (
    relationship_type <> 'other' OR coalesce(label, '') <> ''
  ),
  FOREIGN KEY (account_key, product_key, source_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, target_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_relationships_active_equivalent_idx
  ON onetime.crm_relationships(
    account_key,
    product_key,
    source_contact_key,
    target_contact_key,
    relationship_type
  )
  WHERE unlinked_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_relationships_source_idx
  ON onetime.crm_relationships(account_key, product_key, source_contact_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS onetime.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  title text NOT NULL CHECK (title <> ''),
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  owner_user_key text NOT NULL,
  due_at timestamptz NOT NULL,
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, owner_user_key)
    REFERENCES onetime.account_users(account_key, product_key, user_key)
);

CREATE INDEX IF NOT EXISTS crm_tasks_contact_page_idx
  ON onetime.crm_tasks(account_key, product_key, contact_key, due_at ASC, task_key ASC);

CREATE INDEX IF NOT EXISTS crm_tasks_due_idx
  ON onetime.crm_tasks(account_key, product_key, status, due_at ASC)
  WHERE status IN ('open', 'in_progress');

CREATE TABLE IF NOT EXISTS onetime.crm_identity_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_a_key text NOT NULL,
  contact_b_key text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('same_person', 'distinct')),
  canonical_contact_key text,
  evidence_fingerprint text NOT NULL,
  decided_by_user_key text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  ended_by_user_key text,
  ended_at timestamptz,
  end_reason text,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT crm_identity_no_self CHECK (contact_a_key <> contact_b_key),
  CONSTRAINT crm_identity_canonical_when_same CHECK (
    decision <> 'same_person'
    OR canonical_contact_key IN (contact_a_key, contact_b_key)
  ),
  FOREIGN KEY (account_key, product_key, contact_a_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, contact_b_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_identity_active_pair_idx
  ON onetime.crm_identity_resolutions(account_key, product_key, contact_a_key, contact_b_key)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS onetime.crm_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  idempotency_key uuid NOT NULL,
  method text NOT NULL,
  operation text NOT NULL,
  resource_type text NOT NULL,
  resource_key text NOT NULL,
  request_hash text NOT NULL,
  result_resource_type text NOT NULL,
  result_resource_key text NOT NULL,
  result_version integer NOT NULL,
  http_status integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_key, method, operation, resource_key, idempotency_key)
);
