ALTER TABLE onetime.family_signup_access_projections
  DROP CONSTRAINT IF EXISTS family_signup_access_projections_access_branch_check,
  DROP CONSTRAINT IF EXISTS family_signup_access_projection_shape_v2_check,
  -- pg-mem retains the two unnamed 2248 checks under generated names.
  DROP CONSTRAINT IF EXISTS family_signup_access_projections_constraint_1,
  DROP CONSTRAINT IF EXISTS family_signup_access_projections_constraint_7;

ALTER TABLE onetime.family_signup_access_projections
  ADD CONSTRAINT family_signup_access_projections_access_branch_v3_check CHECK (
    access_branch IN (
      'immediate_free',
      'inactive_checkout',
      'inactive_identity_review',
      'inactive_support'
    )
  ),
  ADD CONSTRAINT family_signup_access_projection_shape_v3_check CHECK (
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
    OR (
      access_branch = 'inactive_support'
      AND access_state = 'inactive'
      AND free_access_expires_at IS NULL
      AND checkout_required = false
      AND checkout_blocked_by_identity_review = false
    )
  );
