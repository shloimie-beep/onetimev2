ALTER TABLE onetime.telegram_bot_registry
  ADD COLUMN IF NOT EXISTS bot_installation_id text;

UPDATE onetime.telegram_bot_registry
   SET bot_installation_id = bot_key || ':' || environment
 WHERE bot_installation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_bot_registry_installation_idx
  ON onetime.telegram_bot_registry(bot_installation_id)
  WHERE bot_installation_id IS NOT NULL;

ALTER TABLE onetime.telegram_identity_mappings
  ADD COLUMN IF NOT EXISTS chat_ref_hash text,
  ADD COLUMN IF NOT EXISTS mapping_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS telegram_identity_private_chat_idx
  ON onetime.telegram_identity_mappings(bot_key, environment, chat_ref_hash)
  WHERE status = 'active' AND chat_ref_hash IS NOT NULL;

ALTER TABLE onetime.telegram_update_inbox
  ADD COLUMN IF NOT EXISTS bot_installation_id text,
  ADD COLUMN IF NOT EXISTS received_http_status integer;

UPDATE onetime.telegram_update_inbox
   SET bot_installation_id = bot_key || ':' || environment
 WHERE bot_installation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_update_inbox_installation_update_idx
  ON onetime.telegram_update_inbox(bot_installation_id, update_id)
  WHERE bot_installation_id IS NOT NULL;

ALTER TABLE onetime.telegram_command_executions
  DROP CONSTRAINT IF EXISTS telegram_command_executions_capability_check;

ALTER TABLE onetime.telegram_command_executions
  DROP CONSTRAINT IF EXISTS telegram_command_executions_constraint_2;

ALTER TABLE onetime.telegram_command_executions
  ADD CONSTRAINT telegram_command_executions_capability_ot84_check CHECK (
    capability IN (
      'gateway.help',
      'gateway.identity.read_self',
      'gateway.scope.read',
      'crm.lead.list',
      'crm.lead.read',
      'crm.lead.create',
      'crm.contact.read_redacted',
      'crm.lead_tag.list',
      'crm.lead_tag.add',
      'crm.lead_tag.remove',
      'class.schedule.read',
      'class.status.read',
      'class.status.update',
      'content.pipeline.read',
      'content.item.read',
      'content.item.retry',
      'task.list',
      'task.read',
      'task.create',
      'task.update',
      'support.ticket.list',
      'support.ticket.read_redacted',
      'support.ticket.assign_self',
      'support.ticket.status.update',
      'class.question.list',
      'class.question.read_redacted',
      'class.question.select',
      'telegram.audit.read_recent'
    )
  );

ALTER TABLE onetime.telegram_confirmations
  DROP CONSTRAINT IF EXISTS telegram_confirmations_capability_check;

ALTER TABLE onetime.telegram_confirmations
  DROP CONSTRAINT IF EXISTS telegram_confirmations_constraint_2;

ALTER TABLE onetime.telegram_confirmations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'deterministic'
    CHECK (source IN ('deterministic', 'natural_language', 'callback')),
  ADD COLUMN IF NOT EXISTS risk_class text NOT NULL DEFAULT 'R1'
    CHECK (risk_class IN ('R0', 'R1', 'R2', 'R3')),
  ADD COLUMN IF NOT EXISTS target_version integer,
  ADD COLUMN IF NOT EXISTS mapping_key text NOT NULL DEFAULT 'legacy_mapping',
  ADD COLUMN IF NOT EXISTS mapping_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS role_at_preview text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS preview_digest text NOT NULL DEFAULT 'legacy_preview',
  ADD COLUMN IF NOT EXISTS result_json jsonb;

ALTER TABLE onetime.telegram_confirmations
  ADD CONSTRAINT telegram_confirmations_capability_ot84_check CHECK (
    capability IN (
      'crm.lead.create',
      'crm.lead_tag.add',
      'crm.lead_tag.remove',
      'class.status.update',
      'content.item.retry',
      'task.create',
      'task.update',
      'support.ticket.assign_self',
      'support.ticket.status.update',
      'class.question.select'
    )
  );

CREATE TABLE onetime.telegram_response_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_key text NOT NULL UNIQUE,
  bot_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  bot_installation_id text,
  chat_ref_hash text NOT NULL,
  correlation_key text NOT NULL,
  payload jsonb NOT NULL,
  payload_digest text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'sent', 'retry', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at timestamptz,
  provider_message_ref_hash text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bot_key, environment) REFERENCES onetime.telegram_bot_registry(bot_key, environment)
);

CREATE INDEX telegram_response_outbox_queue_idx
  ON onetime.telegram_response_outbox(bot_key, environment, status, next_attempt_at, created_at);

CREATE TABLE onetime.action_gateway_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'class.question.created',
      'class.question.selected',
      'support.ticket.received',
      'content.processing.status_changed',
      'lead.created',
      'task.created',
      'task.updated'
    )
  ),
  source text NOT NULL,
  subject text NOT NULL,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_principal_id text NOT NULL,
  actor_role text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('telegram', 'web', 'api', 'system')),
  correlation_id text NOT NULL,
  causation_id text,
  idempotency_key text NOT NULL,
  event_json jsonb NOT NULL,
  event_digest text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'published', 'retry', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (account_key, product_key, event_type, idempotency_key)
);

CREATE INDEX action_gateway_event_outbox_queue_idx
  ON onetime.action_gateway_event_outbox(status, next_attempt_at, created_at);

CREATE INDEX action_gateway_event_outbox_scope_idx
  ON onetime.action_gateway_event_outbox(account_key, product_key, created_at DESC);
