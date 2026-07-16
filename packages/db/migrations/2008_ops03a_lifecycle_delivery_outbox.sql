CREATE TABLE onetime.account_lifecycle_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  token_key text NOT NULL REFERENCES onetime.account_lifecycle_tokens(token_key),
  intent_key text REFERENCES onetime.account_lifecycle_delivery_intents(intent_key),
  purpose text NOT NULL CHECK (purpose IN (
    'owner_admin_invitation',
    'parent_activation',
    'student_setup',
    'student_reset',
    'password_reset'
  )),
  channel text NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
  transport_mode text NOT NULL DEFAULT 'sink' CHECK (transport_mode IN ('sink', 'provider')),
  destination_ref text NOT NULL,
  key_id text NOT NULL,
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  nonce text,
  ciphertext text,
  auth_tag text,
  encrypted_payload_expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN (
    'queued',
    'leased',
    'retry',
    'sink_delivered',
    'provider_delivered',
    'provider_off',
    'dead_letter',
    'superseded',
    'expired',
    'cleared'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text NOT NULL,
  provider_message_ref_hash text,
  last_error_code text,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (account_key, product_key, purpose, idempotency_key),
  CHECK (
    state IN ('sink_delivered', 'provider_delivered', 'superseded', 'expired', 'cleared')
    OR (nonce IS NOT NULL AND ciphertext IS NOT NULL AND auth_tag IS NOT NULL)
  )
);

CREATE INDEX account_lifecycle_delivery_outbox_claim_idx
  ON onetime.account_lifecycle_delivery_outbox(
    account_key,
    product_key,
    transport_mode,
    state,
    next_attempt_at,
    created_at
  )
  WHERE state IN ('queued', 'retry', 'leased');

CREATE INDEX account_lifecycle_delivery_outbox_token_idx
  ON onetime.account_lifecycle_delivery_outbox(account_key, product_key, token_key);

CREATE INDEX account_lifecycle_delivery_outbox_destination_idx
  ON onetime.account_lifecycle_delivery_outbox(account_key, product_key, purpose, destination_ref)
  WHERE state IN ('queued', 'leased', 'retry', 'provider_off');
