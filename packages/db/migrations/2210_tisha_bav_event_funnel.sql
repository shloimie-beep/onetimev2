CREATE TABLE IF NOT EXISTS onetime.event_definitions (
  event_definition_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  public_title text NOT NULL,
  event_start timestamptz NOT NULL,
  event_timezone text NOT NULL,
  event_start_israel timestamptz NOT NULL,
  registration_open boolean NOT NULL DEFAULT false,
  landing_path text NOT NULL,
  join_path text NOT NULL,
  join_open_at timestamptz NOT NULL,
  join_close_at timestamptz NOT NULL,
  provider text NOT NULL DEFAULT 'zoom' CHECK (provider IN ('zoom')),
  provider_state text NOT NULL DEFAULT 'protected_unmapped'
    CHECK (provider_state IN ('protected_unmapped', 'mapped', 'created', 'unavailable')),
  protected_meeting_ref_digest text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, event_code),
  CHECK (landing_path LIKE '/%'),
  CHECK (join_path LIKE '/%'),
  CHECK (join_open_at < event_start),
  CHECK (join_close_at > event_start)
);

CREATE TABLE IF NOT EXISTS onetime.event_registrations (
  registration_key text PRIMARY KEY,
  event_definition_key text NOT NULL REFERENCES onetime.event_definitions(event_definition_key),
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  email_normalized text NOT NULL,
  first_name text,
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  event_service_consent_policy_version text NOT NULL,
  marketing_consent_policy_version text,
  marketing_consent_recorded_at timestamptz,
  initial_source text NOT NULL,
  latest_source text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  registered_at timestamptz NOT NULL,
  last_registered_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, event_code, email_normalized)
);

CREATE INDEX IF NOT EXISTS event_registrations_event_idx
  ON onetime.event_registrations(account_key, product_key, event_code, last_registered_at DESC);

CREATE TABLE IF NOT EXISTS onetime.event_delivery_events (
  delivery_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  registration_key text REFERENCES onetime.event_registrations(registration_key),
  event_type text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('highlevel', 'resend_fallback', 'zoom')),
  transport_mode text NOT NULL DEFAULT 'disabled'
    CHECK (transport_mode IN ('disabled', 'mock', 'provider', 'resend')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'provider_off', 'succeeded', 'failed', 'skipped')),
  idempotency_key text NOT NULL,
  payload_digest text NOT NULL,
  protected_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_result_reference_hash text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, event_code, idempotency_key)
);

CREATE INDEX IF NOT EXISTS event_delivery_events_pending_idx
  ON onetime.event_delivery_events(provider, status, next_attempt_at);

CREATE TABLE IF NOT EXISTS onetime.event_sessions (
  session_key text PRIMARY KEY,
  account_key text NOT NULL,
  product_key text NOT NULL,
  event_code text NOT NULL,
  registration_key text NOT NULL REFERENCES onetime.event_registrations(registration_key),
  token_hash text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'consumed', 'expired')),
  ip_hash text,
  user_agent_hash text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS event_sessions_event_idx
  ON onetime.event_sessions(account_key, product_key, event_code, expires_at);

INSERT INTO onetime.event_definitions (
  event_definition_key,
  account_key,
  product_key,
  event_code,
  public_title,
  event_start,
  event_timezone,
  event_start_israel,
  registration_open,
  landing_path,
  join_path,
  join_open_at,
  join_close_at,
  provider,
  provider_state,
  metadata
)
VALUES (
  'event_tisha_bav_2026',
  'one_time',
  'one_time_mishnah_class',
  'tisha-bav-2026',
  'A Live Tisha B''Av Program with Rabbi Eli Scheller',
  '2026-07-23T19:00:00.000Z',
  'America/New_York',
  '2026-07-23T19:00:00.000Z',
  true,
  '/tisha-bav',
  '/tisha-bav/live',
  '2026-07-23T18:15:00.000Z',
  '2026-07-23T22:00:00.000Z',
  'zoom',
  'protected_unmapped',
  '{
    "event_start_display": "Thursday, July 23, 2026, 3:00 PM Eastern / 10:00 PM Israel",
    "sender_visible_name": "Rabbi Eli Scheller | One Time Mishnayos",
    "sender_from": "info@onetimeonetime.com",
    "sender_reply_to": "info@onetimeonetime.com",
    "protected_zoom_join_url_env": "ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL",
    "raw_zoom_url_present": false,
    "student_data_allowed": false,
    "payment_required": false,
    "ghl_location_id": "pBSnOK2nkdxp6gf9Rg3o",
    "final_graphic_replacement_path": "apps/web/public/assets/events/tisha-bav-2026/final-hero.webp"
  }'::jsonb
)
ON CONFLICT (account_key, product_key, event_code)
DO UPDATE SET
  public_title = EXCLUDED.public_title,
  event_start = EXCLUDED.event_start,
  event_timezone = EXCLUDED.event_timezone,
  event_start_israel = EXCLUDED.event_start_israel,
  registration_open = EXCLUDED.registration_open,
  landing_path = EXCLUDED.landing_path,
  join_path = EXCLUDED.join_path,
  join_open_at = EXCLUDED.join_open_at,
  join_close_at = EXCLUDED.join_close_at,
  provider = EXCLUDED.provider,
  metadata = EXCLUDED.metadata,
  updated_at = now();
