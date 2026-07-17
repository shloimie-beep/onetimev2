CREATE TABLE onetime.communication_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source text NOT NULL CHECK (source IN (
    'resend_export',
    'whatsapp_export',
    'stored_webhook_projection',
    'manual_redacted_fixture',
    'provider_history_unavailable'
  )),
  mode text NOT NULL CHECK (mode IN ('dry_run', 'imported')),
  status text NOT NULL DEFAULT 'dry_run_recorded' CHECK (status IN (
    'dry_run_recorded',
    'ready_for_review',
    'imported',
    'rejected',
    'blocked'
  )),
  source_fingerprint text NOT NULL CHECK (source_fingerprint = lower(source_fingerprint)),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_user_key text,
  reviewed_at timestamptz
);

CREATE INDEX communication_import_batches_scope_idx
  ON onetime.communication_import_batches(account_key, product_key, created_at DESC);

CREATE TABLE onetime.communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'internal_email')),
  participant_kind text NOT NULL DEFAULT 'unknown' CHECK (participant_kind IN (
    'contact',
    'household',
    'unknown'
  )),
  participant_ref_digest text NOT NULL CHECK (participant_ref_digest = lower(participant_ref_digest)),
  contact_key text,
  household_key text,
  display_label text NOT NULL,
  source text NOT NULL CHECK (source IN (
    'canonical_history_event',
    'local_outbox_intent',
    'crm_reply_draft',
    'stored_whatsapp_webhook',
    'stored_provider_delivery_event',
    'historical_import',
    'provider_history_unavailable'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX communication_threads_scope_idx
  ON onetime.communication_threads(account_key, product_key, updated_at DESC);

CREATE INDEX communication_threads_contact_idx
  ON onetime.communication_threads(account_key, product_key, contact_key, updated_at DESC)
  WHERE contact_key IS NOT NULL;

CREATE TABLE onetime.communication_history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  thread_key text NOT NULL REFERENCES onetime.communication_threads(thread_key),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'internal_email')),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  event_kind text NOT NULL,
  truthful_state text NOT NULL CHECK (truthful_state IN (
    'queued',
    'pending',
    'provider_accepted',
    'provider_sent',
    'sent',
    'delivered',
    'read',
    'received',
    'durable',
    'processed',
    'failed',
    'processing_failed',
    'dead_lettered',
    'retriable_failure',
    'bounced',
    'complained',
    'suppressed',
    'draft_saved',
    'duplicate',
    'unknown',
    'history_unavailable'
  )),
  source text NOT NULL CHECK (source IN (
    'canonical_history_event',
    'local_outbox_intent',
    'crm_reply_draft',
    'stored_whatsapp_webhook',
    'stored_provider_delivery_event',
    'historical_import',
    'provider_history_unavailable'
  )),
  provenance text NOT NULL CHECK (provenance IN (
    'local_database',
    'stored_webhook',
    'stored_provider_event',
    'redacted_export',
    'capability_limitation'
  )),
  contact_key text,
  household_key text,
  occurred_at timestamptz NOT NULL,
  redacted_preview text NOT NULL,
  provider_reference_digest text CHECK (
    provider_reference_digest IS NULL OR provider_reference_digest = lower(provider_reference_digest)
  ),
  import_batch_key text REFERENCES onetime.communication_import_batches(batch_key),
  idempotency_key text,
  source_event_key text,
  transport_available boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key),
  UNIQUE (account_key, product_key, source, source_event_key),
  UNIQUE (account_key, product_key, idempotency_key)
);

CREATE INDEX communication_history_events_scope_idx
  ON onetime.communication_history_events(account_key, product_key, occurred_at DESC, event_key DESC);

CREATE INDEX communication_history_events_contact_idx
  ON onetime.communication_history_events(account_key, product_key, contact_key, occurred_at DESC)
  WHERE contact_key IS NOT NULL;

CREATE INDEX communication_history_events_thread_idx
  ON onetime.communication_history_events(account_key, product_key, thread_key, occurred_at DESC);
