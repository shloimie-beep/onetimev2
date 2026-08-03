CREATE TABLE onetime.communication_reminder_preference (
  adult_id text PRIMARY KEY,
  subject_kind text NOT NULL DEFAULT 'adult' CHECK (subject_kind = 'adult'),
  preference text NOT NULL CHECK (preference IN ('email', 'whatsapp', 'both', 'none')),
  version bigint NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (adult_id) REFERENCES onetime.v21_adult_identities(adult_id)
    ON DELETE RESTRICT
);

CREATE TABLE onetime.communication_decision (
  operation_id text PRIMARY KEY CHECK (operation_id <> ''),
  adult_id text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'adult' CHECK (subject_kind = 'adult'),
  purpose text NOT NULL CHECK (purpose IN (
    'requested_security',
    'essential_billing_access',
    'optional_reminder',
    'marketing'
  )),
  plan jsonb NOT NULL,
  suppression_snapshot_id text NOT NULL CHECK (suppression_snapshot_id <> ''),
  status text NOT NULL CHECK (status IN (
    'planned', 'email_sent', 'skipped', 'retry_pending'
  )),
  safe_provider_ref_hash text,
  safe_reason text,
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (adult_id) REFERENCES onetime.v21_adult_identities(adult_id)
    ON DELETE RESTRICT,
  CHECK (
    safe_provider_ref_hash IS NULL
    OR (
      length(safe_provider_ref_hash) = 64
      AND safe_provider_ref_hash = lower(safe_provider_ref_hash)
    )
  )
);

CREATE TABLE onetime.communication_delivery_dedupe (
  operation_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  suppression_snapshot_id text NOT NULL CHECK (suppression_snapshot_id <> ''),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_id, channel),
  FOREIGN KEY (operation_id) REFERENCES onetime.communication_decision(operation_id)
    ON DELETE RESTRICT
);

CREATE TABLE onetime.communication_workflow_readback (
  workflow_key text PRIMARY KEY CHECK (workflow_key <> ''),
  readback jsonb NOT NULL,
  provider_read_at timestamptz,
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((readback ->> 'workflow_key') = workflow_key),
  CHECK ((readback ->> 'provider_workflow_ref_hash') <> ''),
  CHECK ((readback ->> 'registry_digest') <> '')
);

CREATE TABLE onetime.communication_workflow_request (
  request_id text PRIMARY KEY CHECK (request_id <> ''),
  workflow_key text NOT NULL,
  requested_by_admin_id text NOT NULL CHECK (requested_by_admin_id <> ''),
  action text NOT NULL CHECK (action IN ('start', 'pause')),
  requested_at timestamptz NOT NULL,
  provider_readback_ref text NOT NULL CHECK (provider_readback_ref <> ''),
  audited boolean NOT NULL DEFAULT true CHECK (audited = true),
  direct_provider_mutation boolean NOT NULL DEFAULT false
    CHECK (direct_provider_mutation = false),
  FOREIGN KEY (workflow_key)
    REFERENCES onetime.communication_workflow_readback(workflow_key)
    ON DELETE RESTRICT
);

CREATE TABLE onetime.communication_website_lead_plan (
  operation_id text PRIMARY KEY CHECK (operation_id <> ''),
  adult_id text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'adult' CHECK (subject_kind = 'adult'),
  lead_kind text NOT NULL CHECK (lead_kind IN ('family', 'school')),
  next_action text NOT NULL CHECK (next_action IN (
    'offer_family_signup',
    'record_school_inquiry',
    'adult_support_escalation'
  )),
  transcript_ref_hash text NOT NULL,
  plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    length(transcript_ref_hash) = 64
    AND transcript_ref_hash = lower(transcript_ref_hash)
  ),
  CHECK ((plan ->> 'creates_student') = 'false'),
  CHECK ((plan ->> 'grants_access') = 'false'),
  CHECK ((plan ->> 'qualifies_via_whatsapp') = 'false')
);

CREATE INDEX communication_decision_status_idx
  ON onetime.communication_decision(status, purpose, updated_at);

CREATE INDEX communication_workflow_request_idx
  ON onetime.communication_workflow_request(workflow_key, requested_at);

-- @postgres-only-begin
ALTER TABLE onetime.communication_decision
  ADD CONSTRAINT communication_provider_ref_hex_check
    CHECK (
      safe_provider_ref_hash IS NULL
      OR safe_provider_ref_hash ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE onetime.communication_website_lead_plan
  ADD CONSTRAINT communication_transcript_ref_hex_check
    CHECK (transcript_ref_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.enforce_communication_version_step()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'communication optimistic version conflict';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER communication_preference_version_step
BEFORE UPDATE ON onetime.communication_reminder_preference
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_communication_version_step();

CREATE TRIGGER communication_decision_version_step
BEFORE UPDATE ON onetime.communication_decision
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_communication_version_step();

CREATE TRIGGER communication_workflow_readback_version_step
BEFORE UPDATE ON onetime.communication_workflow_readback
FOR EACH ROW EXECUTE FUNCTION onetime.enforce_communication_version_step();

CREATE OR REPLACE FUNCTION onetime.reject_communication_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'communication evidence is append-only';
END;
$$;

CREATE TRIGGER communication_delivery_dedupe_append_only
BEFORE UPDATE OR DELETE ON onetime.communication_delivery_dedupe
FOR EACH ROW EXECUTE FUNCTION onetime.reject_communication_evidence_mutation();

CREATE TRIGGER communication_workflow_request_append_only
BEFORE UPDATE OR DELETE ON onetime.communication_workflow_request
FOR EACH ROW EXECUTE FUNCTION onetime.reject_communication_evidence_mutation();

CREATE TRIGGER communication_website_plan_append_only
BEFORE UPDATE OR DELETE ON onetime.communication_website_lead_plan
FOR EACH ROW EXECUTE FUNCTION onetime.reject_communication_evidence_mutation();
-- @postgres-only-end
