CREATE TABLE onetime.account_access_projections (
  access_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  state text NOT NULL CHECK (
    state IN (
      'pending',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  ),
  source_kind text NOT NULL CHECK (
    source_kind IN (
      'free_pilot',
      'highlevel_payment_state',
      'admin_override',
      'legacy_preview'
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
  access_version bigint NOT NULL DEFAULT 1 CHECK (access_version > 0),
  last_event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, household_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  CHECK (
    state NOT IN ('active', 'grace', 'scheduled_end')
    OR expires_at IS NULL
    OR expires_at > effective_at
  ),
  CHECK (source_kind <> 'free_pilot' OR expires_at IS NOT NULL),
  CHECK (state NOT IN ('grace', 'scheduled_end') OR expires_at IS NOT NULL),
  CHECK (
    state NOT IN ('suspended', 'revoked', 'manual_review')
    OR revocation_reason IS NOT NULL
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.account_access_projections
  ADD CONSTRAINT account_access_opaque_source_reference_shape_check
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

CREATE INDEX account_access_current_scope_idx
  ON onetime.account_access_projections(
    account_key,
    product_key,
    household_key,
    state,
    expires_at
  );

CREATE TABLE onetime.account_access_events (
  event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash <> ''),
  source_kind text NOT NULL CHECK (
    source_kind IN (
      'free_pilot',
      'highlevel_payment_state',
      'admin_override',
      'legacy_preview'
    )
  ),
  source_reference_digest text NOT NULL CHECK (source_reference_digest <> ''),
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  source_updated_at timestamptz NOT NULL,
  previous_state text CHECK (
    previous_state IS NULL
    OR previous_state IN (
      'pending',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  ),
  next_state text NOT NULL CHECK (
    next_state IN (
      'pending',
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'revoked',
      'manual_review'
    )
  ),
  decision text NOT NULL CHECK (
    decision IN (
      'applied',
      'replayed',
      'rejected_stale',
      'rejected_conflict',
      'rejected_precedence'
    )
  ),
  response_json jsonb NOT NULL,
  actor_kind text NOT NULL CHECK (
    actor_kind IN (
      'highlevel_action',
      'admin',
      'provisioner',
      'account_lifecycle',
      'migration'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key)
);

-- @postgres-only-begin
ALTER TABLE onetime.account_access_events
  ADD CONSTRAINT account_access_event_request_hash_shape_check
  CHECK (
    length(request_hash) = 64
    AND request_hash = lower(request_hash)
  ),
  ADD CONSTRAINT account_access_event_source_digest_shape_check
  CHECK (
    length(source_reference_digest) = 64
    AND source_reference_digest = lower(source_reference_digest)
  );

COMMENT ON TABLE onetime.account_access_projections IS
  'Canonical current account/product/household access projection. Payment history is not stored here.';
COMMENT ON TABLE onetime.billing_entitlement_projections IS
  'Historical billing/provider projection only. It is not authoritative for current portal access.';
-- @postgres-only-end

CREATE INDEX account_access_events_scope_idx
  ON onetime.account_access_events(
    account_key,
    product_key,
    household_key,
    created_at DESC
  );
