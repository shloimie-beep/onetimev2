-- DESIGN PROPOSAL ONLY. This file is intentionally outside packages/db/migrations.
-- It must not be applied, registered, or assigned a migration number without a
-- separate product/shared-path and production-data authority.

CREATE TABLE onetime.governed_campaign_audience_decisions (
  decision_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  campaign_key text NOT NULL,
  provider_location_id text NOT NULL,
  provider_campaign_id text,
  provider_workflow_id text NOT NULL,
  provider_launch_tag_id text NOT NULL,
  provider_contact_id text NOT NULL,
  contact_key text,
  decision text NOT NULL CHECK (decision IN ('include', 'exclude', 'review')),
  primary_reason text NOT NULL CHECK (
    primary_reason IN (
      'eligible_inactive_adult',
      'inactive_adult_tisha_registrant',
      'inactive_adult_former_member',
      'inactive_adult_lead',
      'active_or_current_subscriber',
      'student_or_minor',
      'school_contact',
      'staff_or_test',
      'duplicate_contact',
      'missing_email',
      'invalid_email',
      'email_dnd_or_unsubscribed',
      'complaint',
      'hard_bounce',
      'provider_suppression',
      'ambiguous_identity',
      'unknown_consent'
    )
  ),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(reason_codes) = 'array'),
  source_facts jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_facts) = 'object'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  source_observed_at timestamptz NOT NULL,
  decision_version bigint NOT NULL CHECK (decision_version > 0),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_by_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  UNIQUE (
    account_key,
    product_key,
    campaign_key,
    provider_contact_id,
    decision_version
  ),
  UNIQUE (
    account_key,
    product_key,
    campaign_key,
    provider_contact_id,
    idempotency_key
  ),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE UNIQUE INDEX governed_campaign_audience_current_contact_uq
  ON onetime.governed_campaign_audience_decisions(
    account_key,
    product_key,
    campaign_key,
    provider_contact_id
  )
  WHERE superseded_at IS NULL;

CREATE INDEX governed_campaign_audience_snapshot_idx
  ON onetime.governed_campaign_audience_decisions(
    account_key,
    product_key,
    campaign_key,
    snapshot_hash,
    decision,
    primary_reason
  )
  WHERE superseded_at IS NULL;

CREATE VIEW onetime.governed_campaign_audience_current AS
SELECT
  decision_key,
  account_key,
  product_key,
  campaign_key,
  provider_location_id,
  provider_campaign_id,
  provider_workflow_id,
  provider_launch_tag_id,
  provider_contact_id,
  contact_key,
  decision,
  primary_reason,
  reason_codes,
  source_facts,
  snapshot_hash,
  source_observed_at,
  decision_version,
  request_hash,
  created_at
FROM onetime.governed_campaign_audience_decisions
WHERE superseded_at IS NULL;

-- source_facts is a sanitized evidence envelope. The transaction API must
-- reject names, email addresses, phone numbers, postal addresses, free-form
-- notes, message bodies, and every other direct contact identifier.
