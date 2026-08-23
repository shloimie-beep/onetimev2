CREATE TABLE onetime.parent_welcome_video_slots_v21 (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  slot_key text NOT NULL CHECK (slot_key = 'parent_companion_welcome'),
  video_version_id text NOT NULL CHECK (
    length(video_version_id) BETWEEN 3 AND 160
    AND video_version_id = btrim(video_version_id)
  ),
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  publication_generation bigint NOT NULL CHECK (publication_generation > 0),
  approval_projection_digest text NOT NULL CHECK (
    length(approval_projection_digest) = 64
    AND approval_projection_digest = lower(approval_projection_digest)
  ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 60000 AND 120000),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  captions_available boolean NOT NULL,
  poster_available boolean NOT NULL,
  state text NOT NULL CHECK (state IN ('approved', 'revoked')),
  approved_by_adult_id text NOT NULL CHECK (approved_by_adult_id <> ''),
  approved_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    video_version_id
  ),
  FOREIGN KEY (account_key, product_key, content_id)
    REFERENCES onetime.content_publications(account_key, product_key, content_id)
    ON DELETE RESTRICT,
  CHECK (width * 9 = height * 16),
  CHECK (state <> 'approved' OR (captions_available AND poster_available)),
  CHECK (
    (state = 'approved' AND revoked_at IS NULL)
    OR (state = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= approved_at)
  )
);

CREATE UNIQUE INDEX parent_welcome_video_active_slot_idx
  ON onetime.parent_welcome_video_slots_v21(
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    slot_key
  )
  WHERE state = 'approved';

CREATE TABLE onetime.parent_welcome_video_assets_v21 (
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  slot_key text NOT NULL CHECK (slot_key = 'parent_companion_welcome'),
  video_version_id text NOT NULL CHECK (
    length(video_version_id) BETWEEN 3 AND 160
    AND video_version_id = btrim(video_version_id)
  ),
  asset_kind text NOT NULL CHECK (asset_kind IN ('media', 'captions', 'poster')),
  source_key text NOT NULL CHECK (source_key <> ''),
  source_sha256 text NOT NULL CHECK (
    length(source_sha256) = 64 AND source_sha256 = lower(source_sha256)
  ),
  source_object_version_id text NOT NULL CHECK (
    length(source_object_version_id) BETWEEN 1 AND 1024
    AND source_object_version_id = btrim(source_object_version_id)
  ),
  storage_provider text NOT NULL CHECK (storage_provider = 's3'),
  bucket_ref text NOT NULL CHECK (length(bucket_ref) BETWEEN 3 AND 63),
  object_key text NOT NULL CHECK (length(object_key) BETWEEN 3 AND 160),
  object_version_id text NOT NULL CHECK (
    length(object_version_id) BETWEEN 1 AND 1024
    AND object_version_id = btrim(object_version_id)
  ),
  byte_count bigint NOT NULL CHECK (byte_count BETWEEN 1 AND 5368709120),
  payload_sha256 text NOT NULL CHECK (
    length(payload_sha256) = 64 AND payload_sha256 = lower(payload_sha256)
  ),
  content_type text NOT NULL,
  width integer,
  height integer,
  state text NOT NULL CHECK (state IN ('approved', 'revoked')),
  approved_by_adult_id text NOT NULL CHECK (approved_by_adult_id <> ''),
  approved_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    video_version_id,
    asset_kind
  ),
  CONSTRAINT parent_welcome_video_asset_slot_fk
    FOREIGN KEY (
      account_key,
      product_key,
      runtime_tier,
      verification_environment_id,
      video_version_id
    ) REFERENCES onetime.parent_welcome_video_slots_v21(
      account_key,
      product_key,
      runtime_tier,
      verification_environment_id,
      video_version_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (account_key, product_key, source_key)
    REFERENCES onetime.content_sources_v21(account_key, product_key, source_key)
    ON DELETE RESTRICT,
  CHECK (asset_kind <> 'media' OR content_type = 'video/mp4'),
  CHECK (asset_kind <> 'captions' OR content_type = 'text/vtt'),
  CHECK (
    asset_kind <> 'poster'
    OR content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  CHECK (
    (asset_kind = 'poster' AND width > 0 AND height > 0 AND width * 9 = height * 16)
    OR (asset_kind <> 'poster' AND width IS NULL AND height IS NULL)
  ),
  CHECK (
    (state = 'approved' AND revoked_at IS NULL)
    OR (state = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= approved_at)
  )
);

CREATE INDEX parent_welcome_video_asset_resolution_idx
  ON onetime.parent_welcome_video_assets_v21(
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    video_version_id,
    state
  );

CREATE TABLE onetime.parent_activation_events_v21 (
  event_id text PRIMARY KEY CHECK (
    length(event_id) = 64 AND event_id = lower(event_id)
  ),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  runtime_tier text NOT NULL CHECK (runtime_tier IN ('isolated_staging', 'production')),
  verification_environment_id text NOT NULL CHECK (verification_environment_id <> ''),
  household_id text NOT NULL CHECK (household_id <> ''),
  parent_adult_id text NOT NULL CHECK (parent_adult_id <> ''),
  video_version_id text NOT NULL CHECK (
    video_version_id = 'unbound'
    OR (
      length(video_version_id) BETWEEN 3 AND 160
      AND video_version_id = btrim(video_version_id)
    )
  ),
  event_type text NOT NULL CHECK (event_type IN (
    'family.account_created',
    'parent.portal_opened',
    'parent.welcome_video_impression',
    'parent.welcome_video_started',
    'parent.welcome_video_10_seconds',
    'parent.welcome_video_25_percent',
    'parent.welcome_video_50_percent',
    'parent.welcome_video_75_percent',
    'parent.welcome_video_completed',
    'parent.add_student_clicked',
    'parent.companion_activated',
    'student.created',
    'student.first_learning_started',
    'family.engaged'
  )),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  canonical_request_hash text NOT NULL CHECK (
    length(canonical_request_hash) = 64
    AND canonical_request_hash = lower(canonical_request_hash)
  ),
  observed_playback_seconds numeric(10,3),
  observed_position_percent numeric(6,3),
  event_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  FOREIGN KEY (household_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_households(
      household_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (parent_adult_id, product_key, runtime_tier, verification_environment_id)
    REFERENCES onetime.v21_adult_identities(
      adult_id,
      product_key,
      runtime_tier,
      verification_environment_id
    ) ON DELETE RESTRICT,
  UNIQUE (
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    household_id,
    parent_adult_id,
    video_version_id,
    event_type
  ),
  UNIQUE (
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    household_id,
    parent_adult_id,
    idempotency_key
  ),
  CHECK (observed_playback_seconds IS NULL OR observed_playback_seconds >= 0),
  CHECK (
    observed_position_percent IS NULL
    OR observed_position_percent BETWEEN 0 AND 100
  ),
  CHECK (
    event_type NOT IN (
      'parent.welcome_video_impression',
      'parent.welcome_video_started',
      'parent.welcome_video_10_seconds',
      'parent.welcome_video_25_percent',
      'parent.welcome_video_50_percent',
      'parent.welcome_video_75_percent',
      'parent.welcome_video_completed',
      'parent.companion_activated'
    ) OR video_version_id <> 'unbound'
  )
);

CREATE INDEX parent_activation_events_funnel_idx
  ON onetime.parent_activation_events_v21(
    account_key,
    product_key,
    runtime_tier,
    verification_environment_id,
    event_type,
    recorded_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.parent_welcome_video_slots_v21
  ADD CONSTRAINT parent_welcome_video_version_format_check
    CHECK (video_version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$'),
  ADD CONSTRAINT parent_welcome_video_approval_digest_format_check
    CHECK (approval_projection_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE onetime.parent_welcome_video_assets_v21
  ADD CONSTRAINT parent_welcome_video_asset_source_digest_format_check
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT parent_welcome_video_asset_payload_digest_format_check
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT parent_welcome_video_asset_bucket_format_check
    CHECK (
      bucket_ref ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
      AND bucket_ref !~ '\.\.'
      AND bucket_ref !~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
    ),
  ADD CONSTRAINT parent_welcome_video_asset_object_key_format_check
    CHECK (
      (asset_kind = 'media' AND object_key ~ '^(source_[0-9a-f]{32}|derivative_[0-9a-f]{64}|parent_welcome_media_[0-9a-f]{64})$')
      OR (asset_kind = 'captions' AND object_key ~ '^parent_welcome_captions_[0-9a-f]{64}$')
      OR (asset_kind = 'poster' AND object_key ~ '^parent_welcome_poster_[0-9a-f]{64}$')
    );

ALTER TABLE onetime.parent_activation_events_v21
  ADD CONSTRAINT parent_activation_event_id_format_check
    CHECK (event_id ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT parent_activation_video_version_format_check
    CHECK (
      video_version_id = 'unbound'
      OR video_version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$'
    ),
  ADD CONSTRAINT parent_activation_request_hash_format_check
    CHECK (canonical_request_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION onetime.reject_parent_activation_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'parent_activation_events_v21 is append-only';
END;
$$;

CREATE TRIGGER parent_activation_events_append_only
BEFORE UPDATE OR DELETE ON onetime.parent_activation_events_v21
FOR EACH ROW EXECUTE FUNCTION onetime.reject_parent_activation_event_mutation();

CREATE VIEW onetime.parent_welcome_activation_funnel_v21 AS
WITH steps(step_order, event_type, label) AS (
  VALUES
    (1, 'family.account_created', 'Family signup'),
    (2, 'parent.portal_opened', 'Parent portal opened'),
    (3, 'parent.welcome_video_impression', 'Welcome video shown'),
    (4, 'parent.welcome_video_started', 'Welcome video started'),
    (5, 'parent.welcome_video_10_seconds', '10 seconds watched'),
    (6, 'parent.companion_activated', 'Parent Companion activated'),
    (7, 'parent.welcome_video_25_percent', '25% watched'),
    (8, 'parent.welcome_video_50_percent', '50% watched'),
    (9, 'parent.welcome_video_75_percent', '75% watched'),
    (10, 'parent.welcome_video_completed', 'Welcome video completed'),
    (11, 'parent.add_student_clicked', 'Add Student clicked'),
    (12, 'student.created', 'Student created'),
    (13, 'student.first_learning_started', 'Student first learning'),
    (14, 'family.engaged', 'Engaged Family')
),
scopes AS (
  SELECT DISTINCT account_key, product_key, runtime_tier, verification_environment_id
    FROM onetime.parent_activation_events_v21
),
counts AS (
  SELECT scope.account_key,
         scope.product_key,
         scope.runtime_tier,
         scope.verification_environment_id,
         step.step_order,
         step.event_type,
         step.label,
         count(DISTINCT event.household_id)::integer AS household_count
    FROM scopes AS scope
    CROSS JOIN steps AS step
    LEFT JOIN onetime.parent_activation_events_v21 AS event
      ON event.account_key = scope.account_key
     AND event.product_key = scope.product_key
     AND event.runtime_tier = scope.runtime_tier
     AND event.verification_environment_id = scope.verification_environment_id
     AND event.event_type = step.event_type
   GROUP BY scope.account_key, scope.product_key, scope.runtime_tier,
            scope.verification_environment_id, step.step_order, step.event_type, step.label
),
adjacent AS (
  SELECT counts.*,
         lag(household_count) OVER (
           PARTITION BY account_key, product_key, runtime_tier, verification_environment_id
           ORDER BY step_order
         ) AS previous_household_count
    FROM counts
)
SELECT account_key,
       product_key,
       runtime_tier,
       verification_environment_id,
       step_order,
       event_type,
       label,
       household_count,
       previous_household_count,
       CASE
         WHEN previous_household_count IS NULL OR previous_household_count = 0 THEN NULL
         ELSE round((household_count::numeric * 100) / previous_household_count, 2)
       END AS adjacent_conversion_percent
  FROM adjacent;

CREATE VIEW onetime.parent_welcome_household_projection_v21 AS
SELECT account_key,
       product_key,
       runtime_tier,
       verification_environment_id,
       household_id,
       parent_adult_id,
       min(recorded_at) FILTER (WHERE event_type = 'parent.portal_opened')
         AS parent_portal_opened_at,
       min(recorded_at) FILTER (WHERE event_type = 'parent.welcome_video_started')
         AS welcome_video_started_at,
       min(recorded_at) FILTER (WHERE event_type = 'parent.welcome_video_completed')
         AS welcome_video_completed_at,
       min(recorded_at) FILTER (WHERE event_type = 'parent.add_student_clicked')
         AS add_student_clicked_at
  FROM onetime.parent_activation_events_v21
 GROUP BY account_key, product_key, runtime_tier, verification_environment_id,
          household_id, parent_adult_id;
-- @postgres-only-end

COMMENT ON TABLE onetime.parent_welcome_video_slots_v21 IS
  'Governed Parent Companion featured-media binding. Empty by default; contains no Drive/Vimeo URL or provider bearer and requires a separately approved published content version.';

COMMENT ON TABLE onetime.parent_welcome_video_assets_v21 IS
  'Exact private S3 object-version bindings for approved Parent welcome MP4, VTT captions, and poster artifacts. Empty by default and never returned to a browser.';

COMMENT ON TABLE onetime.parent_activation_events_v21 IS
  'Adult-household activation events only. These events never update Student attendance, progress, streaks, badges, credentials, or HighLevel contacts.';
