ALTER TABLE onetime.event_registrations
  ADD COLUMN contact_key text,
  ADD COLUMN registration_status text NOT NULL DEFAULT 'unknown'
    CHECK (registration_status IN ('unknown', 'active', 'cancelled')),
  ADD COLUMN identity_status text NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'verified', 'ambiguous', 'invalid')),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text;

ALTER TABLE onetime.event_registrations
  ADD CONSTRAINT event_registrations_contact_scope_fk
  FOREIGN KEY (account_key, product_key, contact_key)
  REFERENCES onetime.contacts(account_key, product_key, contact_key);

CREATE INDEX event_registrations_contact_scope_idx
  ON onetime.event_registrations(
    account_key,
    product_key,
    event_code,
    contact_key,
    registration_status
  );

ALTER TABLE onetime.event_email_permission_events
  ADD COLUMN contact_key text;

ALTER TABLE onetime.event_email_permission_events
  ADD CONSTRAINT event_email_permission_events_contact_scope_fk
  FOREIGN KEY (account_key, product_key, contact_key)
  REFERENCES onetime.contacts(account_key, product_key, contact_key);

CREATE INDEX event_email_permission_events_contact_scope_idx
  ON onetime.event_email_permission_events(
    account_key,
    product_key,
    event_code,
    contact_key,
    recorded_at DESC
  );

ALTER TABLE onetime.event_email_permissions
  ADD COLUMN contact_key text;

ALTER TABLE onetime.event_email_permissions
  ADD CONSTRAINT event_email_permissions_contact_scope_fk
  FOREIGN KEY (account_key, product_key, contact_key)
  REFERENCES onetime.contacts(account_key, product_key, contact_key);

-- @postgres-only-begin
DO $$
DECLARE
  legacy_email_constraint record;
BEGIN
  FOR legacy_email_constraint IN
    SELECT constraint_row.oid, constraint_row.conname
      FROM pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = 'onetime.event_email_permissions'::regclass
       AND constraint_row.contype = 'u'
  LOOP
    IF pg_get_constraintdef(legacy_email_constraint.oid) =
       'UNIQUE (account_key, product_key, event_code, email_normalized)' THEN
      EXECUTE format(
        'ALTER TABLE onetime.event_email_permissions DROP CONSTRAINT %I',
        legacy_email_constraint.conname
      );
    END IF;
  END LOOP;
END
$$;
-- @postgres-only-end

CREATE UNIQUE INDEX event_email_permissions_contact_scope_unique_idx
  ON onetime.event_email_permissions(account_key, product_key, event_code, contact_key)
  WHERE contact_key IS NOT NULL;

CREATE INDEX event_email_permissions_legacy_email_lookup_idx
  ON onetime.event_email_permissions(account_key, product_key, event_code, email_normalized);

CREATE INDEX event_email_permissions_contact_scope_idx
  ON onetime.event_email_permissions(
    account_key,
    product_key,
    event_code,
    contact_key,
    status
  );

CREATE TABLE onetime.contact_email_restriction_events (
  restriction_event_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  restriction_type text NOT NULL CHECK (restriction_type IN (
    'global_suppression',
    'global_dnd',
    'global_unsubscribe',
    'complaint',
    'hard_bounce'
  )),
  action text NOT NULL CHECK (action IN ('applied', 'cleared')),
  source text NOT NULL,
  reason_code text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, contact_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX contact_email_restriction_events_contact_idx
  ON onetime.contact_email_restriction_events(
    account_key,
    product_key,
    contact_key,
    recorded_at DESC
  );

CREATE TABLE onetime.contact_email_restrictions (
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  restriction_type text NOT NULL CHECK (restriction_type IN (
    'global_suppression',
    'global_dnd',
    'global_unsubscribe',
    'complaint',
    'hard_bounce'
  )),
  active boolean NOT NULL,
  reason_code text,
  latest_restriction_event_key text NOT NULL
    REFERENCES onetime.contact_email_restriction_events(restriction_event_key),
  effective_at timestamptz NOT NULL,
  applied_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, product_key, contact_key, restriction_type),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX contact_email_restrictions_active_idx
  ON onetime.contact_email_restrictions(
    account_key,
    product_key,
    contact_key,
    restriction_type
  )
  WHERE active;
