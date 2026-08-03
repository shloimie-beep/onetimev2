CREATE TABLE onetime.support_tickets_v21 (
  ticket_id text PRIMARY KEY CHECK (ticket_id <> ''),
  product text NOT NULL DEFAULT 'one_time_mishnayos' CHECK (product = 'one_time_mishnayos'),
  conversation_kind text NOT NULL CHECK (conversation_kind IN ('technical_support', 'rabbi_question')),
  category text NOT NULL CHECK (category IN (
    'billing', 'support', 'access', 'technical', 'system', 'class_question', 'torah_question'
  )),
  subject text NOT NULL CHECK (length(subject) BETWEEN 5 AND 120),
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed')),
  requester_role text NOT NULL CHECK (requester_role IN ('parent', 'student')),
  requester_identity_id text NOT NULL,
  household_id text NOT NULL,
  student_id text,
  assignee_human_account_id text,
  ghl_conversation_id text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (conversation_kind = 'technical_support'
      AND category IN ('billing', 'support', 'access', 'technical', 'system'))
    OR
    (conversation_kind = 'rabbi_question'
      AND category IN ('class_question', 'torah_question'))
  ),
  CHECK (
    (requester_role = 'parent' AND student_id IS NULL)
    OR (requester_role = 'student' AND student_id IS NOT NULL)
  ),
  CHECK (
    ghl_conversation_id IS NULL
    OR (requester_role = 'parent' AND conversation_kind = 'technical_support')
  ),
  CHECK (conversation_kind <> 'rabbi_question' OR requester_role = 'student')
);

CREATE TABLE onetime.support_messages_v21 (
  ticket_id text NOT NULL REFERENCES onetime.support_tickets_v21(ticket_id),
  message_id text NOT NULL,
  author_identity_id text NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('admin', 'parent', 'student')),
  body text NOT NULL CHECK (body <> ''),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (ticket_id, message_id)
);

CREATE TABLE onetime.support_audit_v21 (
  audit_event_id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES onetime.support_tickets_v21(ticket_id),
  ticket_version bigint NOT NULL CHECK (ticket_version > 0),
  actor_identity_id text NOT NULL,
  action text NOT NULL,
  before_status text,
  after_status text,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE onetime.support_idempotency_v21 (
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  canonical_request_hash text NOT NULL,
  ticket_id text NOT NULL REFERENCES onetime.support_tickets_v21(ticket_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, idempotency_key),
  CHECK (
    length(canonical_request_hash) = 64
    AND canonical_request_hash = lower(canonical_request_hash)
  )
);

CREATE TABLE onetime.support_notification_intents_v21 (
  intent_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  ticket_id text NOT NULL REFERENCES onetime.support_tickets_v21(ticket_id),
  transport text NOT NULL DEFAULT 'telegram' CHECK (transport = 'telegram'),
  namespace text NOT NULL DEFAULT 'OT' CHECK (namespace = 'OT'),
  destination text NOT NULL CHECK (destination IN ('shloimie_support', 'rabbi_questions')),
  event text NOT NULL CHECK (event IN ('ticket_created', 'ticket_assigned', 'ticket_status_changed')),
  ticket_version bigint NOT NULL CHECK (ticket_version > 0),
  requester_role text NOT NULL CHECK (requester_role IN ('parent', 'student')),
  conversation_kind text NOT NULL CHECK (conversation_kind IN ('technical_support', 'rabbi_question')),
  category text NOT NULL CHECK (category IN (
    'billing', 'support', 'access', 'technical', 'system', 'class_question', 'torah_question'
  )),
  ticket_status text NOT NULL CHECK (
    ticket_status IN ('open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed')
  ),
  redacted_summary text NOT NULL CHECK (length(redacted_summary) BETWEEN 1 AND 512),
  contains_private_body boolean NOT NULL DEFAULT false CHECK (contains_private_body = false),
  contains_student_identity boolean NOT NULL DEFAULT false CHECK (contains_student_identity = false),
  provider_is_source_of_truth boolean NOT NULL DEFAULT false CHECK (provider_is_source_of_truth = false),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'dispatched', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (conversation_kind = 'technical_support'
      AND category IN ('billing', 'support', 'access', 'technical', 'system')
      AND destination = 'shloimie_support')
    OR
    (conversation_kind = 'rabbi_question'
      AND category IN ('class_question', 'torah_question')
      AND requester_role = 'student'
      AND destination = 'rabbi_questions')
  )
);

-- @postgres-only-begin
ALTER TABLE onetime.support_idempotency_v21
  ADD CONSTRAINT support_idempotency_request_hash_hex_check
  CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_support_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'support audit is append-only';
END;
$$;
CREATE TRIGGER support_audit_append_only
BEFORE UPDATE OR DELETE ON onetime.support_audit_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_support_audit_mutation();
CREATE TRIGGER support_messages_append_only
BEFORE UPDATE OR DELETE ON onetime.support_messages_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_support_audit_mutation();
-- @postgres-only-end
