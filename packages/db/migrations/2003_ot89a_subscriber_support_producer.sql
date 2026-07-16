CREATE TABLE onetime.support_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id text NOT NULL UNIQUE CHECK (source_ticket_id LIKE 'ots_%'),
  receipt_id text NOT NULL UNIQUE CHECK (receipt_id LIKE 'otr_%'),
  event_id text NOT NULL UNIQUE CHECK (event_id LIKE 'evt_%'),
  outbox_id text NOT NULL UNIQUE CHECK (outbox_id LIKE 'otx_%'),
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  actor_role text NOT NULL,
  entitlement_id text NOT NULL,
  entitlement_checked_at timestamptz NOT NULL,
  entitlement_valid_until timestamptz,
  category text NOT NULL CHECK (category IN ('bug', 'access_login', 'class_zoom', 'billing', 'content', 'complaint', 'other')),
  title text NOT NULL,
  message text NOT NULL,
  issue_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_preference text NOT NULL CHECK (reply_preference IN ('in_app', 'email', 'whatsapp')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash = lower(request_hash)),
  body_fingerprint text NOT NULL CHECK (body_fingerprint = lower(body_fingerprint)),
  privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_state text NOT NULL DEFAULT 'QUEUED' CHECK (delivery_state IN ('QUEUED', 'DELIVERY_DELAYED', 'DELIVERED', 'DEAD_LETTER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_key, idempotency_key),
  FOREIGN KEY (actor_user_key) REFERENCES onetime.account_users(user_key)
);

CREATE INDEX support_submissions_actor_idx
  ON onetime.support_submissions(account_key, product_key, actor_user_key, created_at DESC);

CREATE TABLE onetime.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id text NOT NULL UNIQUE CHECK (attachment_id LIKE 'ota_%'),
  source_ticket_id text NOT NULL REFERENCES onetime.support_submissions(source_ticket_id) ON DELETE CASCADE,
  normalized_filename text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp', 'text/plain')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256 text NOT NULL CHECK (sha256 = lower(sha256)),
  transfer_locator text NOT NULL UNIQUE,
  normalization text NOT NULL CHECK (normalization IN ('image-decoded-and-reencoded', 'utf8-text-normalized')),
  storage_class text NOT NULL DEFAULT 'private' CHECK (storage_class = 'private'),
  content_disposition text NOT NULL DEFAULT 'attachment' CHECK (content_disposition = 'attachment'),
  pixel_width integer CHECK (pixel_width BETWEEN 1 AND 8000),
  pixel_height integer CHECK (pixel_height BETWEEN 1 AND 8000),
  blob_bytes bytea NOT NULL,
  status text NOT NULL DEFAULT 'private_ready' CHECK (status IN ('private_ready', 'quarantined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_attachments_ticket_idx
  ON onetime.support_attachments(source_ticket_id, attachment_id);

CREATE TABLE onetime.support_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id text NOT NULL UNIQUE CHECK (outbox_id LIKE 'otx_%'),
  event_id text NOT NULL UNIQUE CHECK (event_id LIKE 'evt_%'),
  source_ticket_id text NOT NULL UNIQUE REFERENCES onetime.support_submissions(source_ticket_id) ON DELETE CASCADE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  raw_body text NOT NULL,
  body_fingerprint text NOT NULL CHECK (body_fingerprint = lower(body_fingerprint)),
  event_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD_LETTER')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  delivered_at timestamptz,
  bna_ticket_ref text CHECK (bna_ticket_ref IS NULL OR bna_ticket_ref LIKE 'bna_%'),
  last_error_code text,
  last_http_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_outbox_claim_idx
  ON onetime.support_outbox(account_key, product_key, status, next_attempt_at, created_at);

CREATE TABLE onetime.support_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE,
  outbox_id text NOT NULL REFERENCES onetime.support_outbox(outbox_id) ON DELETE CASCADE,
  event_id text NOT NULL,
  source_ticket_id text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  outcome text NOT NULL CHECK (outcome IN ('DELIVERED', 'RETRY', 'DEAD_LETTER', 'LEASE_LOST')),
  http_status integer,
  error_code text,
  response_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.support_status_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id text NOT NULL UNIQUE REFERENCES onetime.support_submissions(source_ticket_id) ON DELETE CASCADE,
  receipt_id text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  actor_user_key text NOT NULL,
  bna_ticket_ref text CHECK (bna_ticket_ref IS NULL OR bna_ticket_ref LIKE 'bna_%'),
  status text NOT NULL CHECK (status IN ('new', 'triage', 'pending_operator', 'waiting_customer', 'in_progress', 'resolved', 'closed', 'rejected')),
  public_summary text NOT NULL,
  status_version integer NOT NULL DEFAULT 1 CHECK (status_version >= 1),
  delivery_state text NOT NULL DEFAULT 'queued' CHECK (delivery_state IN ('queued', 'delivery_delayed', 'delivered', 'dead_letter')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_status_projection_actor_idx
  ON onetime.support_status_projection(account_key, product_key, actor_user_key, updated_at DESC);

CREATE TABLE onetime.support_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  source_ticket_id text,
  actor_user_key text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_audit_scope_idx
  ON onetime.support_audit_events(account_key, product_key, source_ticket_id, created_at DESC);

CREATE TABLE onetime.support_mock_bna_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE CHECK (event_id LIKE 'evt_%'),
  source_ticket_id text NOT NULL UNIQUE CHECK (source_ticket_id LIKE 'ots_%'),
  body_fingerprint text NOT NULL CHECK (body_fingerprint = lower(body_fingerprint)),
  immutable_payload_fingerprint text NOT NULL CHECK (immutable_payload_fingerprint = lower(immutable_payload_fingerprint)),
  bna_ticket_ref text NOT NULL UNIQUE CHECK (bna_ticket_ref LIKE 'bna_%'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triage', 'pending_operator', 'waiting_customer', 'in_progress', 'resolved', 'closed', 'rejected')),
  public_summary text NOT NULL,
  status_version integer NOT NULL DEFAULT 1 CHECK (status_version >= 1),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onetime.support_mock_bna_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id text NOT NULL,
  nonce text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (key_id, nonce)
);

CREATE INDEX support_mock_bna_nonces_expiry_idx
  ON onetime.support_mock_bna_nonces(expires_at);
