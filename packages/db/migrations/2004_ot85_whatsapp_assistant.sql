CREATE TABLE onetime.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_key text NOT NULL,
  sender_key text NOT NULL,
  sender_e164_ciphertext text NOT NULL,
  sender_e164_iv text NOT NULL,
  sender_e164_tag text NOT NULL,
  state text NOT NULL DEFAULT 'PUBLIC_IDLE' CHECK (state IN (
    'PUBLIC_IDLE',
    'QUALIFY_AUDIENCE',
    'CAPTURE_GUARDIAN_NAME',
    'CAPTURE_SCHOOL_CONTACT_NAME',
    'CAPTURE_CONTACT_PREFERENCE',
    'CAPTURE_FAMILY_REMINDER_PREFERENCE',
    'FAMILY_PERSIST_PENDING',
    'SCHOOL_PERSIST_PENDING',
    'HUMAN_HANDOFF_PENDING',
    'ACCOUNT_LINK_OFFERED',
    'ACCOUNT_LINK_PENDING',
    'ACCOUNT_LINKED',
    'SUPPRESSED',
    'CLOSED'
  )),
  audience_type text CHECK (audience_type IS NULL OR audience_type IN ('family', 'school')),
  contact_key text,
  signup_key text,
  verified_household_key text,
  verified_user_key text,
  verified_until timestamptz,
  suppression_state text NOT NULL DEFAULT 'active' CHECK (suppression_state IN ('active', 'suppressed')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, provider_account_key, sender_key)
);

CREATE INDEX whatsapp_conversations_state_idx
  ON onetime.whatsapp_conversations(account_key, product_key, state, updated_at DESC);

CREATE TABLE onetime.whatsapp_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  provider_message_ref_hash text NOT NULL,
  sender_key text NOT NULL,
  raw_body_digest text NOT NULL,
  payload_digest text NOT NULL,
  message_ciphertext text NOT NULL,
  message_iv text NOT NULL,
  message_tag text NOT NULL,
  provider_timestamp timestamptz,
  status text NOT NULL DEFAULT 'durable' CHECK (status IN (
    'durable',
    'processed',
    'processing_failed',
    'dead_lettered',
    'duplicate'
  )),
  processing_attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  failure_code text,
  replay_of_event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, provider_account_key, provider_message_ref_hash)
);

CREATE INDEX whatsapp_inbox_claim_idx
  ON onetime.whatsapp_inbox_events(account_key, product_key, status, received_at ASC);

CREATE TABLE onetime.whatsapp_outbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_message_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  recipient_key text NOT NULL,
  recipient_e164_ciphertext text NOT NULL,
  recipient_e164_iv text NOT NULL,
  recipient_e164_tag text NOT NULL,
  message_kind text NOT NULL CHECK (message_kind IN (
    'PUBLIC_PROGRAM_ANSWER',
    'QUALIFY_AUDIENCE',
    'ASK_GUARDIAN_NAME',
    'ASK_SCHOOL_CONTACT_NAME',
    'ASK_CONTACT_PREFERENCE',
    'ASK_FAMILY_REMINDER_PREFERENCE',
    'FAMILY_LEAD_ACK',
    'SCHOOL_LEAD_ACK',
    'HUMAN_HANDOFF_ACK',
    'STOP_CONFIRMATION',
    'START_CONFIRMATION',
    'SUPPRESSION_STATE_NOTICE',
    'ACCOUNT_LINK_OFFER',
    'ACCOUNT_LINK_CONFIRMED',
    'SAFE_STATUS_RESPONSE',
    'PRIVATE_DATA_BLOCKED',
    'TECHNICAL_HELP_REDIRECT',
    'UNKNOWN_FALLBACK'
  )),
  body_ciphertext text NOT NULL,
  body_iv text NOT NULL,
  body_tag text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',
    'sending',
    'sent',
    'suppressed',
    'retry_wait',
    'dead_lettered',
    'sink_delivered'
  )),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_ref_hash text,
  canary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (account_key, product_key, provider_account_key, idempotency_key)
);

CREATE INDEX whatsapp_outbox_claim_idx
  ON onetime.whatsapp_outbox_messages(account_key, product_key, status, next_attempt_at ASC);

CREATE TABLE onetime.whatsapp_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  sender_key text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('granted', 'revoked', 'resumed', 'declined')),
  consent_scope text NOT NULL CHECK (consent_scope IN ('reactive_conversation', 'family_reminders')),
  policy_version text NOT NULL,
  consent_text_digest text NOT NULL,
  source_inbox_event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_consent_conversation_idx
  ON onetime.whatsapp_consent_events(account_key, product_key, conversation_key, recorded_at DESC);

CREATE TABLE onetime.whatsapp_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_key text NOT NULL,
  sender_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  reason text NOT NULL CHECK (reason IN ('user_stop', 'abuse', 'operator')),
  source_inbox_event_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE INDEX whatsapp_suppressions_sender_idx
  ON onetime.whatsapp_suppressions(account_key, product_key, provider_account_key, sender_key);

CREATE UNIQUE INDEX whatsapp_suppressions_one_active_idx
  ON onetime.whatsapp_suppressions(account_key, product_key, provider_account_key, sender_key)
  WHERE status = 'active';

CREATE TABLE onetime.whatsapp_account_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  sender_key text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('safe_account_status')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_user_key text,
  consumed_household_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_account_link_pending_idx
  ON onetime.whatsapp_account_link_requests(account_key, product_key, conversation_key, status, expires_at);

CREATE TABLE onetime.whatsapp_verified_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  sender_key text NOT NULL,
  user_key text NOT NULL,
  household_key text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('safe_account_status')),
  grant_scope text NOT NULL CHECK (grant_scope IN ('safe_status_only')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_verified_grants_active_idx
  ON onetime.whatsapp_verified_grants(account_key, product_key, conversation_key, expires_at DESC);

CREATE TABLE onetime.whatsapp_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  conversation_key text NOT NULL REFERENCES onetime.whatsapp_conversations(conversation_key),
  contact_key text,
  signup_key text,
  audience_type text NOT NULL CHECK (audience_type IN ('family', 'school')),
  event_type text NOT NULL CHECK (event_type IN (
    'family_lead_captured',
    'school_lead_captured',
    'human_handoff_requested',
    'archived_contact_reinquiry'
  )),
  sender_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_lead_events_conversation_idx
  ON onetime.whatsapp_lead_events(account_key, product_key, conversation_key, created_at DESC);

CREATE TABLE onetime.whatsapp_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  outbox_message_key text REFERENCES onetime.whatsapp_outbox_messages(outbox_message_key),
  provider_event_ref_hash text,
  status text NOT NULL CHECK (status IN (
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'retriable_failure',
    'dead_lettered',
    'suppressed'
  )),
  failure_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_delivery_events_message_idx
  ON onetime.whatsapp_delivery_events(account_key, product_key, outbox_message_key, occurred_at DESC);

CREATE TABLE onetime.whatsapp_canary_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  provider_account_key text NOT NULL,
  recipient_key text NOT NULL,
  purpose text NOT NULL DEFAULT 'ot85_staging_canary',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'consumed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  UNIQUE (account_key, product_key, provider_account_key, recipient_key, purpose)
);
