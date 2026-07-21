ALTER TABLE onetime.class_series
  ADD COLUMN IF NOT EXISTS canonical_series_ref text NOT NULL DEFAULT 'one_time_daily_mishnayos_7pm_jerusalem',
  ADD COLUMN IF NOT EXISTS expected_local_start_time time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS expected_timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN IF NOT EXISTS board_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE onetime.class_occurrences
  ADD COLUMN IF NOT EXISTS provider_meeting_ref_digest text,
  ADD COLUMN IF NOT EXISTS provider_meeting_state text NOT NULL DEFAULT 'not_requested'
    CHECK (provider_meeting_state IN ('not_requested', 'sink_ready', 'requested', 'ready', 'cancelled', 'failed')),
  ADD COLUMN IF NOT EXISTS new_meeting_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS raw_zoom_join_url_present boolean NOT NULL DEFAULT false CHECK (raw_zoom_join_url_present = false),
  ADD COLUMN IF NOT EXISTS parent_reminder_target text NOT NULL DEFAULT 'portal_classroom_link'
    CHECK (parent_reminder_target = 'portal_classroom_link');

CREATE TABLE onetime.classroom_lesson_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text NOT NULL,
  occurrence_key text,
  content_item_key text NOT NULL,
  title text NOT NULL,
  description text,
  publication_state text NOT NULL DEFAULT 'unpublished'
    CHECK (publication_state IN ('draft', 'review', 'published', 'unpublished', 'revoked')),
  featured boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  unpublished_at timestamptz,
  controlled_by_actor_ref text,
  vimeo_source_key text,
  vimeo_provider_ref_digest text,
  newest_upload_auto_publish boolean NOT NULL DEFAULT false CHECK (newest_upload_auto_publish = false),
  raw_private_url_present boolean NOT NULL DEFAULT false CHECK (raw_private_url_present = false),
  transcript_state text NOT NULL DEFAULT 'not_available'
    CHECK (transcript_state IN ('not_available', 'processing', 'available', 'rejected')),
  resource_count integer NOT NULL DEFAULT 0 CHECK (resource_count >= 0),
  resources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  FOREIGN KEY (content_item_key) REFERENCES onetime.content_items(content_item_key),
  UNIQUE (account_key, product_key, content_item_key)
);

CREATE INDEX classroom_lesson_publications_featured_idx
  ON onetime.classroom_lesson_publications(account_key, product_key, publication_state, featured, published_at DESC);

CREATE INDEX classroom_lesson_publications_occurrence_idx
  ON onetime.classroom_lesson_publications(account_key, product_key, occurrence_key, published_at DESC);

CREATE TABLE onetime.classroom_lesson_conversation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  lesson_key text NOT NULL,
  occurrence_key text,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  submitted_by_user_ref text NOT NULL,
  submission_type text NOT NULL DEFAULT 'question'
    CHECK (submission_type IN ('question', 'reflection', 'accomplishment')),
  visibility_state text NOT NULL DEFAULT 'private'
    CHECK (visibility_state IN ('private', 'approved', 'rejected', 'kept_private', 'unpublished')),
  moderation_state text NOT NULL DEFAULT 'private'
    CHECK (
      moderation_state IN (
        'private',
        'approved_exact',
        'approved_edited',
        'redacted',
        'rejected',
        'kept_private',
        'unpublished'
      )
    ),
  original_body_ciphertext text NOT NULL,
  original_body_digest text NOT NULL,
  display_body_redacted text,
  pinned boolean NOT NULL DEFAULT false,
  approved_by_actor_ref text,
  approved_at timestamptz,
  unpublished_by_actor_ref text,
  unpublished_at timestamptz,
  rejection_reason text,
  audit_revision integer NOT NULL DEFAULT 1,
  replies_enabled boolean NOT NULL DEFAULT false CHECK (replies_enabled = false),
  public_internet_visible boolean NOT NULL DEFAULT false CHECK (public_internet_visible = false),
  ai_judgment_used boolean NOT NULL DEFAULT false CHECK (ai_judgment_used = false),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lesson_key) REFERENCES onetime.classroom_lesson_publications(lesson_key),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, learner_key, lesson_key, idempotency_key)
);

CREATE INDEX classroom_lesson_conversation_display_idx
  ON onetime.classroom_lesson_conversation_submissions(account_key, product_key, lesson_key, visibility_state, pinned, approved_at DESC);

CREATE INDEX classroom_lesson_conversation_review_idx
  ON onetime.classroom_lesson_conversation_submissions(account_key, product_key, moderation_state, created_at DESC);

CREATE TABLE onetime.classroom_lesson_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  submission_key text NOT NULL,
  action_type text NOT NULL CHECK (
    action_type IN ('approve_exact', 'approve_edited', 'redact', 'reject', 'keep_private', 'pin', 'unpublish')
  ),
  actor_user_ref text NOT NULL,
  actor_role text NOT NULL,
  original_body_digest text NOT NULL,
  display_body_digest text,
  result_state text NOT NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (submission_key) REFERENCES onetime.classroom_lesson_conversation_submissions(submission_key),
  UNIQUE (account_key, product_key, submission_key, action_type, idempotency_key)
);

CREATE TABLE onetime.classroom_leaderboard_publication_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text NOT NULL,
  title text NOT NULL,
  publication_state text NOT NULL DEFAULT 'unpublished'
    CHECK (publication_state IN ('unpublished', 'published', 'paused')),
  actual_names_visible boolean NOT NULL DEFAULT true CHECK (actual_names_visible = true),
  time_basis text NOT NULL DEFAULT 'all_time_no_reset' CHECK (time_basis = 'all_time_no_reset'),
  negative_labels_present boolean NOT NULL DEFAULT false CHECK (negative_labels_present = false),
  ai_judgment_present boolean NOT NULL DEFAULT false CHECK (ai_judgment_present = false),
  controlled_by_actor_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, class_series_key)
);

CREATE INDEX classroom_leaderboard_publication_scope_idx
  ON onetime.classroom_leaderboard_publication_controls(account_key, product_key, publication_state, updated_at DESC);

CREATE TABLE onetime.classroom_leaderboard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_event_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  class_series_key text NOT NULL,
  learner_key text NOT NULL,
  reward_event_key text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'attendance_present',
      'lesson_completed',
      'worksheet_completed',
      'question_approved',
      'excellent_question',
      'consistency_bonus',
      'rabbi_correction'
    )
  ),
  points_delta integer NOT NULL,
  all_time_no_reset boolean NOT NULL DEFAULT true CHECK (all_time_no_reset = true),
  correction_of_event_key text,
  actor_user_ref text NOT NULL,
  audit_reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (learner_key) REFERENCES onetime.portal_learners(learner_key),
  FOREIGN KEY (reward_event_key) REFERENCES onetime.portal_reward_events(reward_event_key)
);

CREATE INDEX classroom_leaderboard_events_learner_idx
  ON onetime.classroom_leaderboard_events(account_key, product_key, learner_key, occurred_at DESC);

CREATE TABLE onetime.classroom_session_provider_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_projection_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  occurrence_key text NOT NULL,
  provider text NOT NULL DEFAULT 'zoom' CHECK (provider = 'zoom'),
  new_meeting_required boolean NOT NULL DEFAULT true CHECK (new_meeting_required = true),
  provider_meeting_ref_digest text,
  provider_state text NOT NULL DEFAULT 'not_configured'
    CHECK (provider_state IN ('not_configured', 'sink_ready', 'ready', 'failed', 'cancelled')),
  raw_join_url_present boolean NOT NULL DEFAULT false CHECK (raw_join_url_present = false),
  protected_launch_required boolean NOT NULL DEFAULT true CHECK (protected_launch_required = true),
  parent_reminder_target text NOT NULL DEFAULT 'portal_classroom_link'
    CHECK (parent_reminder_target = 'portal_classroom_link'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occurrence_key) REFERENCES onetime.class_occurrences(occurrence_key),
  UNIQUE (account_key, product_key, occurrence_key, provider)
);

CREATE INDEX classroom_session_provider_projection_state_idx
  ON onetime.classroom_session_provider_projection(account_key, product_key, provider_state, updated_at DESC);
