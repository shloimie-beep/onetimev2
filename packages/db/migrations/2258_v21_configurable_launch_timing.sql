ALTER TABLE onetime.family_signup_access_projections
  DROP CONSTRAINT IF EXISTS family_signup_access_projections_check;

-- PostgreSQL assigns an implementation-dependent name to the final unnamed
-- table CHECK in migration 2248. Remove any surviving fixed-date variant
-- without editing the applied migration or rewriting existing rows.
-- @postgres-only-begin
DO $$
DECLARE
  fixed_constraint record;
BEGIN
  FOR fixed_constraint IN
    SELECT constraint_row.conname
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_namespace AS schema_row ON schema_row.oid = table_row.relnamespace
    WHERE schema_row.nspname = 'onetime'
      AND table_row.relname = 'family_signup_access_projections'
      AND constraint_row.contype = 'c'
      AND pg_get_constraintdef(constraint_row.oid) LIKE '%2026-09-13%'
  LOOP
    EXECUTE format(
      'ALTER TABLE onetime.family_signup_access_projections DROP CONSTRAINT %I',
      fixed_constraint.conname
    );
  END LOOP;
END
$$;
-- @postgres-only-end

ALTER TABLE onetime.family_signup_access_projections
  ADD CONSTRAINT family_signup_access_projection_shape_v2_check CHECK (
    (
      access_branch = 'immediate_free'
      AND access_state = 'free'
      AND free_access_expires_at IS NOT NULL
      AND signup_committed_at < free_access_expires_at
      AND checkout_required = false
      AND checkout_blocked_by_identity_review = false
    )
    OR (
      access_branch = 'inactive_checkout'
      AND access_state = 'inactive'
      AND free_access_expires_at IS NULL
      AND checkout_required = true
      AND checkout_blocked_by_identity_review = false
    )
    OR (
      access_branch = 'inactive_identity_review'
      AND access_state = 'inactive'
      AND free_access_expires_at IS NULL
      AND checkout_required = false
      AND checkout_blocked_by_identity_review = true
    )
  );
