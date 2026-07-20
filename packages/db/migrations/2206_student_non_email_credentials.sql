ALTER TABLE onetime.portal_student_access_state
  ADD COLUMN IF NOT EXISTS username_display text,
  ADD COLUMN IF NOT EXISTS normalized_username text,
  ADD COLUMN IF NOT EXISTS password_hash_ref text,
  ADD COLUMN IF NOT EXISTS credential_status text NOT NULL DEFAULT 'not_configured'
    CHECK (credential_status IN ('not_configured', 'parent_managed', 'reset_required', 'suspended', 'disabled')),
  ADD COLUMN IF NOT EXISTS password_version integer NOT NULL DEFAULT 0 CHECK (password_version >= 0),
  ADD COLUMN IF NOT EXISTS security_version integer NOT NULL DEFAULT 1 CHECK (security_version >= 1),
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  ADD COLUMN IF NOT EXISTS rate_limited_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_session_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_parent_actor_ref text,
  ADD COLUMN IF NOT EXISTS legacy_student_email_digest text,
  ADD COLUMN IF NOT EXISTS credential_policy_version text NOT NULL DEFAULT 'ot-student-parent-managed-credentials-v1';

UPDATE onetime.portal_student_access_state
   SET credential_status = CASE
       WHEN status = 'active' THEN 'parent_managed'
       WHEN status = 'suspended' THEN 'suspended'
       WHEN status = 'disabled' THEN 'disabled'
       WHEN status = 'reset_requested' THEN 'reset_required'
       ELSE credential_status
     END
 WHERE credential_status = 'not_configured'
   AND status <> 'not_configured';

CREATE UNIQUE INDEX portal_student_access_username_ci_idx
  ON onetime.portal_student_access_state(account_key, product_key, normalized_username)
  WHERE normalized_username IS NOT NULL
    AND status <> 'disabled';

CREATE INDEX portal_student_access_credentials_scope_idx
  ON onetime.portal_student_access_state(account_key, product_key, credential_status, updated_at DESC);

CREATE TABLE onetime.portal_student_credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  operation_type text NOT NULL CHECK (
    operation_type IN ('setup', 'reset', 'suspend', 'restore', 'revoke_sessions')
  ),
  actor_user_ref text NOT NULL,
  username_digest text,
  password_hash_ref_digest text,
  session_revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key),
  UNIQUE (account_key, product_key, learner_key, operation_type, audit_key)
);

CREATE INDEX portal_student_credential_audit_learner_idx
  ON onetime.portal_student_credential_audit(account_key, product_key, learner_key, created_at DESC);

CREATE TABLE onetime.portal_student_session_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revocation_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  household_key text NOT NULL,
  learner_key text NOT NULL,
  actor_user_ref text NOT NULL,
  revoked_session_count integer NOT NULL DEFAULT 0 CHECK (revoked_session_count >= 0),
  reason text NOT NULL DEFAULT 'parent_requested' CHECK (
    reason IN ('parent_requested', 'reset_password', 'suspend_access', 'security_review')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_key, product_key, learner_key)
    REFERENCES onetime.portal_learners(account_key, product_key, learner_key)
);

CREATE INDEX portal_student_session_revocations_learner_idx
  ON onetime.portal_student_session_revocations(account_key, product_key, learner_key, created_at DESC);

CREATE TABLE onetime.portal_student_username_reservations (
  normalized_username text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO onetime.portal_student_username_reservations (normalized_username, reason)
VALUES
  ('admin', 'reserved'),
  ('administrator', 'reserved'),
  ('billing', 'reserved'),
  ('parent', 'reserved'),
  ('rabbi', 'reserved'),
  ('root', 'reserved'),
  ('student', 'reserved'),
  ('support', 'reserved')
ON CONFLICT (normalized_username) DO NOTHING;
