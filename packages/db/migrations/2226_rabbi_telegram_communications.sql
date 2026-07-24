ALTER TABLE onetime.portal_student_questions
  ADD COLUMN rabbi_answer_revision integer NOT NULL DEFAULT 0
    CHECK (rabbi_answer_revision >= 0),
  ADD COLUMN rabbi_answer_digest text,
  ADD COLUMN rabbi_answered_by_user_ref text,
  ADD COLUMN closed_at timestamptz,
  ADD CONSTRAINT portal_student_questions_rabbi_answer_digest_check CHECK (
    rabbi_answer_digest IS NULL OR rabbi_answer_digest = lower(rabbi_answer_digest)
  );

CREATE TABLE onetime.rabbi_parent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  adult_contact_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  provider_conversation_ciphertext text NOT NULL,
  provider_conversation_digest text NOT NULL
    CHECK (provider_conversation_digest = lower(provider_conversation_digest)),
  provider_contact_digest text NOT NULL
    CHECK (provider_contact_digest = lower(provider_contact_digest)),
  assignment_state text NOT NULL DEFAULT 'assigned_to_rabbi' CHECK (
    assignment_state IN ('assigned_to_rabbi', 'returned_to_operator', 'closed')
  ),
  scope_revision integer NOT NULL DEFAULT 1 CHECK (scope_revision >= 1),
  last_reply_digest text CHECK (
    last_reply_digest IS NULL OR last_reply_digest = lower(last_reply_digest)
  ),
  last_reply_state text NOT NULL DEFAULT 'none' CHECK (
    last_reply_state IN ('none', 'confirmed', 'delivered', 'failed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, household_key)
    REFERENCES onetime.portal_households(account_key, product_key, household_key),
  FOREIGN KEY (account_key, product_key, adult_contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  UNIQUE (account_key, product_key, provider_conversation_digest)
);

CREATE INDEX rabbi_parent_conversations_scope_idx
  ON onetime.rabbi_parent_conversations(
    account_key,
    product_key,
    assignment_state,
    updated_at DESC
  );

CREATE TABLE onetime.rabbi_action_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  provider_user_ref_hash text NOT NULL,
  chat_ref_hash text NOT NULL,
  actor_user_key text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  capability text NOT NULL CHECK (capability IN (
    'conversation.parent.reply.preview',
    'student.question.reply.preview',
    'student.question.close',
    'internal_task.create',
    'internal_task.update'
  )),
  target_key text NOT NULL,
  target_revision integer NOT NULL CHECK (target_revision >= 0),
  mapping_key text NOT NULL,
  mapping_version integer NOT NULL CHECK (mapping_version >= 1),
  security_version integer NOT NULL CHECK (security_version >= 1),
  action_digest text NOT NULL CHECK (action_digest = lower(action_digest)),
  preview_digest text NOT NULL CHECK (preview_digest = lower(preview_digest)),
  idempotency_key text NOT NULL,
  payload_ciphertext text,
  payload_digest text NOT NULL CHECK (payload_digest = lower(payload_digest)),
  payload_classification text NOT NULL DEFAULT 'confirmation_payload'
    CHECK (payload_classification = 'confirmation_payload'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment)
    REFERENCES onetime.telegram_bot_registry(bot_key, environment),
  FOREIGN KEY (actor_user_key) REFERENCES onetime.account_users(user_key),
  CHECK (consumed_at IS NULL OR cancelled_at IS NULL),
  UNIQUE (
    bot_key,
    environment,
    account_key,
    product_key,
    actor_user_key,
    idempotency_key
  )
);

CREATE UNIQUE INDEX rabbi_action_confirmations_one_open_action_idx
  ON onetime.rabbi_action_confirmations(
    bot_key,
    environment,
    actor_user_key,
    action_digest
  )
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX rabbi_action_confirmations_expiry_idx
  ON onetime.rabbi_action_confirmations(bot_key, environment, expires_at)
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE onetime.rabbi_parent_reply_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  account_key text NOT NULL,
  product_key text NOT NULL,
  conversation_key text NOT NULL,
  actor_user_key text NOT NULL,
  idempotency_key text NOT NULL,
  reply_digest text NOT NULL CHECK (reply_digest = lower(reply_digest)),
  payload_ciphertext text,
  payload_digest text NOT NULL CHECK (payload_digest = lower(payload_digest)),
  payload_classification text NOT NULL DEFAULT 'intent_payload'
    CHECK (payload_classification = 'intent_payload'),
  state text NOT NULL DEFAULT 'confirmed' CHECK (
    state IN ('confirmed', 'leased', 'retry', 'delivered', 'dead_letter')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts >= 1 AND max_attempts <= 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at timestamptz,
  last_error_code text,
  provider_mode text NOT NULL CHECK (provider_mode IN ('synthetic', 'provider')),
  provider_receipt_digest text CHECK (
    provider_receipt_digest IS NULL OR provider_receipt_digest = lower(provider_receipt_digest)
  ),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment)
    REFERENCES onetime.telegram_bot_registry(bot_key, environment),
  FOREIGN KEY (conversation_key)
    REFERENCES onetime.rabbi_parent_conversations(conversation_key),
  FOREIGN KEY (actor_user_key) REFERENCES onetime.account_users(user_key),
  UNIQUE (
    bot_key,
    environment,
    account_key,
    product_key,
    actor_user_key,
    idempotency_key
  )
);

CREATE INDEX rabbi_parent_reply_outbox_claim_idx
  ON onetime.rabbi_parent_reply_outbox(
    bot_key,
    environment,
    state,
    next_attempt_at,
    created_at
  );

CREATE INDEX rabbi_parent_reply_outbox_reclaim_idx
  ON onetime.rabbi_parent_reply_outbox(
    bot_key,
    environment,
    state,
    lease_expires_at
  )
  WHERE state = 'leased';

CREATE TABLE onetime.rabbi_internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_progress', 'blocked', 'completed', 'cancelled')
  ),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  owner_user_ref text,
  created_by_user_key text NOT NULL,
  updated_by_user_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_digest text NOT NULL CHECK (request_digest = lower(request_digest)),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (created_by_user_key) REFERENCES onetime.account_users(user_key),
  FOREIGN KEY (updated_by_user_key) REFERENCES onetime.account_users(user_key),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX rabbi_internal_tasks_scope_idx
  ON onetime.rabbi_internal_tasks(account_key, product_key, status, updated_at DESC);
