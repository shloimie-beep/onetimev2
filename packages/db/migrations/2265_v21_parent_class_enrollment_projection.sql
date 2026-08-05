-- Project every active v2.1 Student into the class-series enrollment ledger
-- consumed by calendars, classroom authorization, and attendance.
-- @postgres-only-begin
INSERT INTO onetime.class_series_enrollments AS existing
  (enrollment_key, account_key, product_key, class_series_key, learner_key,
   household_key, enrollment_state, source, effective_at, revoked_at,
   idempotency_key, audit_ref, version)
SELECT 'family-class-' || substr(md5(
         series.account_key || ':' || series.class_series_key || ':' || enrollment.enrollment_id
       ), 1, 32),
       series.account_key,
       series.product_key,
       series.class_series_key,
       enrollment.student_id,
       enrollment.household_id,
       enrollment.state,
       'parent_household_v21',
       enrollment.updated_at,
       CASE WHEN enrollment.state = 'revoked' THEN enrollment.updated_at ELSE NULL END,
       'parent-v21-class-enrollment:' || enrollment.student_id,
       'parent-household:' || enrollment.enrollment_id,
       1
  FROM onetime.admin_canonical_student_enrollments AS enrollment
  JOIN onetime.class_series AS series
    ON series.product_key = enrollment.product_key
   AND series.is_canonical = true
 WHERE enrollment.runtime_tier = 'production'
   AND enrollment.verification_environment_id IN ('production_operator_canary', 'production_broad')
   AND series.status = 'active'
   AND series.series_state = 'active'
ON CONFLICT (account_key, product_key, class_series_key, learner_key)
DO UPDATE SET enrollment_state = EXCLUDED.enrollment_state,
              effective_at = EXCLUDED.effective_at,
              revoked_at = EXCLUDED.revoked_at,
              source = EXCLUDED.source,
              audit_ref = EXCLUDED.audit_ref,
              version = existing.version + 1;
-- @postgres-only-end

SELECT 1;
