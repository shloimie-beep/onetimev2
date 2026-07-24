ALTER TABLE onetime.account_access_projections
  DROP CONSTRAINT IF EXISTS account_access_projections_state_check;

-- pg-mem assigns anonymous inline CHECK names; production PostgreSQL uses the
-- column-derived names above. Both drops are forward-only and conditional.
ALTER TABLE onetime.account_access_projections
  DROP CONSTRAINT IF EXISTS account_access_projections_constraint_1;

ALTER TABLE onetime.account_access_projections
  ADD CONSTRAINT account_access_projections_state_check
  CHECK (
    state IN (
      'pending',
      'paused',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  );

ALTER TABLE onetime.account_access_projections
  DROP CONSTRAINT IF EXISTS account_access_projections_source_kind_check;

ALTER TABLE onetime.account_access_projections
  DROP CONSTRAINT IF EXISTS account_access_projections_constraint_2;

ALTER TABLE onetime.account_access_projections
  ADD CONSTRAINT account_access_projections_source_kind_check
  CHECK (
    source_kind IN (
      'free_pilot',
      'complimentary',
      'highlevel_payment_state',
      'admin_override',
      'admin_suspension',
      'legacy_preview'
    )
  );

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_source_kind_check;

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_constraint_2;

ALTER TABLE onetime.account_access_events
  ADD CONSTRAINT account_access_events_source_kind_check
  CHECK (
    source_kind IN (
      'free_pilot',
      'complimentary',
      'highlevel_payment_state',
      'admin_override',
      'admin_suspension',
      'legacy_preview'
    )
  );

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_previous_state_check;

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_constraint_5;

ALTER TABLE onetime.account_access_events
  ADD CONSTRAINT account_access_events_previous_state_check
  CHECK (
    previous_state IS NULL
    OR previous_state IN (
      'pending',
      'paused',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  );

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_next_state_check;

ALTER TABLE onetime.account_access_events
  DROP CONSTRAINT IF EXISTS account_access_events_constraint_6;

ALTER TABLE onetime.account_access_events
  ADD CONSTRAINT account_access_events_next_state_check
  CHECK (
    next_state IN (
      'pending',
      'paused',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  );

CREATE TABLE onetime.account_access_source_states (
  source_state_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  source_slot text NOT NULL CHECK (
    source_slot IN (
      'highlevel_payment_state',
      'complimentary',
      'admin_suspension'
    )
  ),
  source_kind text NOT NULL CHECK (
    source_kind IN (
      'free_pilot',
      'complimentary',
      'highlevel_payment_state',
      'admin_override',
      'admin_suspension',
      'legacy_preview'
    )
  ),
  state text NOT NULL CHECK (
    state IN (
      'pending',
      'paused',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  ),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  opaque_source_reference text NOT NULL CHECK (opaque_source_reference <> ''),
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  source_updated_at timestamptz NOT NULL,
  source_request_hash text NOT NULL CHECK (source_request_hash <> ''),
  policy_version text NOT NULL CHECK (policy_version <> ''),
  revocation_reason text,
  last_event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, household_key, source_slot),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  CHECK (
    state NOT IN ('active', 'grace', 'scheduled_end')
    OR expires_at IS NULL
    OR expires_at > effective_at
  ),
  CHECK (
    state NOT IN ('suspended', 'revoked', 'manual_review')
    OR revocation_reason IS NOT NULL
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.account_access_source_states
  ADD CONSTRAINT account_access_source_reference_shape_check
  CHECK (
    length(opaque_source_reference) BETWEEN 8 AND 180
    AND opaque_source_reference ~ '^[A-Za-z0-9_:-]+$'
    AND position('://' in opaque_source_reference) = 0
  ),
  ADD CONSTRAINT account_access_source_request_hash_shape_check
  CHECK (
    length(source_request_hash) = 64
    AND source_request_hash = lower(source_request_hash)
  );
-- @postgres-only-end

CREATE INDEX account_access_source_states_scope_idx
  ON onetime.account_access_source_states(
    account_key,
    product_key,
    household_key,
    source_slot,
    state,
    expires_at
  );

INSERT INTO onetime.account_access_source_states (
  source_state_key,
  account_key,
  product_key,
  household_key,
  source_slot,
  source_kind,
  state,
  effective_at,
  expires_at,
  opaque_source_reference,
  source_revision,
  source_updated_at,
  source_request_hash,
  policy_version,
  revocation_reason,
  last_event_key,
  created_at,
  updated_at
)
SELECT
  'access_source_' || access_key,
  account_key,
  product_key,
  household_key,
  CASE
    WHEN source_kind = 'highlevel_payment_state' THEN 'highlevel_payment_state'
    WHEN source_kind IN ('admin_override', 'admin_suspension')
      AND state IN ('suspended', 'manual_review') THEN 'admin_suspension'
    ELSE 'complimentary'
  END,
  source_kind,
  state,
  effective_at,
  expires_at,
  opaque_source_reference,
  source_revision,
  source_updated_at,
  source_request_hash,
  policy_version,
  revocation_reason,
  last_event_key,
  created_at,
  updated_at
FROM onetime.account_access_projections
ON CONFLICT (account_key, product_key, household_key, source_slot) DO NOTHING;

CREATE TABLE onetime.adult_household_contact_links (
  link_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  household_key text NOT NULL,
  guardian_user_ref text,
  highlevel_location_id text NOT NULL CHECK (highlevel_location_id <> ''),
  highlevel_contact_id text,
  sync_state text NOT NULL DEFAULT 'sync_pending'
    CHECK (sync_state IN ('sync_pending', 'synced', 'conflict')),
  projection_revision bigint NOT NULL DEFAULT 1 CHECK (projection_revision > 0),
  last_delivery_key text,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, contact_key),
  UNIQUE (account_key, product_key, household_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  FOREIGN KEY (guardian_user_ref)
    REFERENCES onetime.account_users(user_key)
);

CREATE INDEX adult_household_contact_links_provider_idx
  ON onetime.adult_household_contact_links(
    account_key,
    product_key,
    highlevel_location_id,
    highlevel_contact_id
  )
  WHERE highlevel_contact_id IS NOT NULL;

CREATE TABLE onetime.contact_operation_receipts (
  receipt_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  operation_scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    account_key,
    product_key,
    actor_user_key,
    operation_scope,
    idempotency_key
  )
);

CREATE TABLE onetime.contact_operation_audit_events (
  audit_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  actor_capability text NOT NULL,
  contact_key text,
  household_key text,
  learner_key text,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_operation_audit_scope_idx
  ON onetime.contact_operation_audit_events(
    account_key,
    product_key,
    household_key,
    created_at DESC
  );

-- @postgres-only-begin
COMMENT ON TABLE onetime.account_access_source_states IS
  'Independent current paid, complimentary, and administrative-suspension facts. Not a payment ledger.';
COMMENT ON TABLE onetime.adult_household_contact_links IS
  'One durable adult Parent to One Time household and HighLevel contact identity link. Students are never represented here.';
-- @postgres-only-end
