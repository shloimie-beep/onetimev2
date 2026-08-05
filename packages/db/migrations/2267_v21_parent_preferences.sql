CREATE TABLE onetime.v21_parent_preferences (
  household_id text PRIMARY KEY,
  owner_adult_id text NOT NULL,
  time_zone text NOT NULL CHECK (
    time_zone IN ('UTC', 'Etc/UTC') OR time_zone LIKE '%/%'
  ),
  portal_class_reminders boolean NOT NULL DEFAULT false,
  email_class_reminders boolean NOT NULL DEFAULT false,
  whatsapp_class_reminders boolean NOT NULL DEFAULT false
    CHECK (whatsapp_class_reminders = false),
  parent_newsletter_consent boolean NOT NULL DEFAULT false,
  newsletter_consent_policy_version text NOT NULL
    DEFAULT 'parent-newsletter-v2.1-2026-08-05',
  newsletter_consent_recorded_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  product_key text NOT NULL DEFAULT 'one_time_mishnayos'
    CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL,
  updated_by_adult_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  CHECK (
    (runtime_tier = 'isolated_staging'
      AND verification_environment_id IN ('ci', 'provider_sandbox', 'persistent_staging'))
    OR
    (runtime_tier = 'production'
      AND verification_environment_id IN (
        'production_read_only',
        'production_operator_canary',
        'production_broad'
      ))
  )
);

CREATE TABLE onetime.v21_parent_preference_commands (
  household_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  canonical_request_hash text NOT NULL CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$'),
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, idempotency_key),
  FOREIGN KEY (household_id) REFERENCES onetime.v21_parent_preferences(household_id)
    ON DELETE RESTRICT
);

WITH latest_signup AS (
  SELECT DISTINCT ON (household_id)
         household_id,
         household_timezone,
         parent_newsletter_consent,
         committed_at
    FROM onetime.family_signup_requests
   ORDER BY household_id, committed_at DESC
)
INSERT INTO onetime.v21_parent_preferences (
  household_id,
  owner_adult_id,
  time_zone,
  portal_class_reminders,
  email_class_reminders,
  whatsapp_class_reminders,
  parent_newsletter_consent,
  newsletter_consent_recorded_at,
  revision,
  product_key,
  runtime_tier,
  verification_environment_id,
  updated_by_adult_id,
  updated_at
)
SELECT household.household_id,
       household.owner_adult_id,
       COALESCE(signup.household_timezone, 'Asia/Jerusalem'),
       false,
       false,
       false,
       COALESCE(signup.parent_newsletter_consent, false),
       CASE
         WHEN COALESCE(signup.parent_newsletter_consent, false) THEN signup.committed_at
         ELSE NULL
       END,
       1,
       household.product_key,
       household.runtime_tier,
       household.verification_environment_id,
       household.owner_adult_id,
       COALESCE(signup.committed_at, household.updated_at)
  FROM onetime.v21_households AS household
  LEFT JOIN latest_signup AS signup USING (household_id)
 WHERE household.classification = 'family'
ON CONFLICT (household_id) DO NOTHING;
