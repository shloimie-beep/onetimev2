CREATE TABLE onetime.governed_campaign_audience_decisions (
  runtime_tier text NOT NULL
    CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL
    CHECK (verification_environment_id <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key <> ''),
  campaign_key text NOT NULL CHECK (campaign_key <> ''),
  provider_location_id text NOT NULL
    CHECK (provider_location_id = 'pBSnOK2nkdxp6gf9Rg3o'),
  provider_campaign_id text NOT NULL
    CHECK (provider_campaign_id = '6a71a64c28f7a5dbb3aec1be'),
  provider_workflow_id text NOT NULL
    CHECK (provider_workflow_id = '09051378-5917-4172-afda-f425619dd23d'),
  provider_launch_tag_id text NOT NULL
    CHECK (provider_launch_tag_id = 'IcOGsLgSIOYGFlHF4kQ0'),
  decision_key text NOT NULL CHECK (decision_key <> ''),
  provider_contact_ref_hash text NOT NULL
    CHECK (
      length(provider_contact_ref_hash) = 64
      AND provider_contact_ref_hash = lower(provider_contact_ref_hash)
    ),
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
  source_facts jsonb NOT NULL
    CHECK (jsonb_typeof(source_facts) = 'object'),
  snapshot_hash text NOT NULL
    CHECK (length(snapshot_hash) = 64 AND snapshot_hash = lower(snapshot_hash)),
  source_observed_at timestamptz NOT NULL,
  decision_version bigint NOT NULL CHECK (decision_version > 0),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  request_hash text NOT NULL
    CHECK (length(request_hash) = 64 AND request_hash = lower(request_hash)),
  created_by_user_key text NOT NULL CHECK (created_by_user_key <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  PRIMARY KEY (
    runtime_tier,
    verification_environment_id,
    account_key,
    product_key,
    campaign_key,
    provider_location_id,
    provider_campaign_id,
    provider_workflow_id,
    provider_launch_tag_id,
    decision_key
  ),
  UNIQUE (
    runtime_tier,
    verification_environment_id,
    account_key,
    product_key,
    campaign_key,
    provider_location_id,
    provider_campaign_id,
    provider_workflow_id,
    provider_launch_tag_id,
    provider_contact_ref_hash,
    decision_version
  ),
  UNIQUE (
    runtime_tier,
    verification_environment_id,
    account_key,
    product_key,
    campaign_key,
    provider_location_id,
    provider_campaign_id,
    provider_workflow_id,
    provider_launch_tag_id,
    provider_contact_ref_hash,
    idempotency_key
  ),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (superseded_at IS NULL OR superseded_at >= created_at)
);

CREATE UNIQUE INDEX governed_campaign_audience_current_contact_uq
  ON onetime.governed_campaign_audience_decisions(
    runtime_tier,
    verification_environment_id,
    account_key,
    product_key,
    campaign_key,
    provider_location_id,
    provider_campaign_id,
    provider_workflow_id,
    provider_launch_tag_id,
    provider_contact_ref_hash
  )
  WHERE superseded_at IS NULL;

CREATE INDEX governed_campaign_audience_snapshot_idx
  ON onetime.governed_campaign_audience_decisions(
    runtime_tier,
    verification_environment_id,
    account_key,
    product_key,
    campaign_key,
    provider_location_id,
    provider_campaign_id,
    provider_workflow_id,
    provider_launch_tag_id,
    snapshot_hash,
    decision,
    primary_reason
  )
  WHERE superseded_at IS NULL;

CREATE VIEW onetime.governed_campaign_audience_current AS
SELECT
  runtime_tier,
  verification_environment_id,
  account_key,
  product_key,
  campaign_key,
  provider_location_id,
  provider_campaign_id,
  provider_workflow_id,
  provider_launch_tag_id,
  decision_key,
  provider_contact_ref_hash,
  contact_key,
  decision,
  primary_reason,
  reason_codes,
  source_facts,
  snapshot_hash,
  source_observed_at,
  decision_version,
  idempotency_key,
  request_hash,
  created_by_user_key,
  created_at
FROM onetime.governed_campaign_audience_decisions
WHERE superseded_at IS NULL;

-- @postgres-only-begin
CREATE FUNCTION onetime.governed_campaign_reason_codes_are_sanitized(candidate jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    jsonb_typeof(candidate) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(candidate) AS code(value)
      WHERE jsonb_typeof(code.value) <> 'string'
         OR code.value #>> '{}' NOT IN (
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
    )
    AND jsonb_array_length(candidate) = (
      SELECT count(DISTINCT code.value)
      FROM jsonb_array_elements(candidate) AS code(value)
    );
$$;

CREATE FUNCTION onetime.governed_campaign_source_facts_are_sanitized(candidate jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    jsonb_typeof(candidate) = 'object'
    AND candidate = jsonb_build_object(
      'adultEvidenceState', candidate -> 'adultEvidenceState',
      'studentOrMinorState', candidate -> 'studentOrMinorState',
      'schoolContactState', candidate -> 'schoolContactState',
      'activeOrCurrentSubscriberState', candidate -> 'activeOrCurrentSubscriberState',
      'consentState', candidate -> 'consentState',
      'deliverabilityState', candidate -> 'deliverabilityState',
      'providerSuppressionState', candidate -> 'providerSuppressionState',
      'identityMatchState', candidate -> 'identityMatchState',
      'sourceJoinCount', candidate -> 'sourceJoinCount',
      'sourceFactsHash', candidate -> 'sourceFactsHash'
    )
    AND candidate ->> 'adultEvidenceState' IN ('proven', 'not_proven', 'conflicting')
    AND candidate ->> 'studentOrMinorState' IN ('absent', 'present', 'unknown')
    AND candidate ->> 'schoolContactState' IN ('absent', 'present', 'unknown')
    AND candidate ->> 'activeOrCurrentSubscriberState' IN ('absent', 'present', 'unknown')
    AND candidate ->> 'consentState' IN ('opted_in', 'opted_out', 'unknown')
    AND candidate ->> 'deliverabilityState' IN ('deliverable', 'invalid', 'missing', 'unknown')
    AND candidate ->> 'providerSuppressionState' IN ('active', 'suppressed', 'unknown')
    AND candidate ->> 'identityMatchState' IN ('exact', 'duplicate', 'ambiguous', 'missing')
    AND jsonb_typeof(candidate -> 'sourceJoinCount') = 'number'
    AND candidate ->> 'sourceJoinCount' ~ '^(0|[1-9][0-9]*)$'
    AND candidate ->> 'sourceFactsHash' ~ '^[0-9a-f]{64}$';
$$;

ALTER TABLE onetime.governed_campaign_audience_decisions
  ADD CONSTRAINT governed_campaign_provider_contact_hash_check
    CHECK (provider_contact_ref_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT governed_campaign_snapshot_hash_check
    CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT governed_campaign_request_hash_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT governed_campaign_reason_codes_check
    CHECK (onetime.governed_campaign_reason_codes_are_sanitized(reason_codes)),
  ADD CONSTRAINT governed_campaign_source_facts_check
    CHECK (onetime.governed_campaign_source_facts_are_sanitized(source_facts));

CREATE FUNCTION onetime.guard_governed_campaign_audience_decision_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'governed campaign audience decisions are append-only';
  END IF;

  IF OLD.superseded_at IS NOT NULL
    OR NEW.superseded_at IS NULL
    OR NEW.superseded_at < OLD.created_at
    OR (to_jsonb(NEW) - 'superseded_at')
      IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_at')
  THEN
    RAISE EXCEPTION 'only a one-way NULL-to-timestamp supersession is allowed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER governed_campaign_audience_decision_immutability
BEFORE UPDATE OR DELETE ON onetime.governed_campaign_audience_decisions
FOR EACH ROW
EXECUTE FUNCTION onetime.guard_governed_campaign_audience_decision_immutability();
-- @postgres-only-end
