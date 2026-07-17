ALTER TABLE onetime.portal_student_access_state
  DROP CONSTRAINT IF EXISTS portal_student_access_state_last_operation_type_check;

ALTER TABLE onetime.portal_student_access_state
  DROP CONSTRAINT IF EXISTS portal_student_access_state_constraint_1;

ALTER TABLE onetime.portal_student_access_state
  DROP CONSTRAINT IF EXISTS portal_student_access_state_constraint_2;

ALTER TABLE onetime.portal_student_access_state
  ADD CONSTRAINT portal_student_access_state_last_operation_type_check
  CHECK (
    last_operation_type IS NULL OR last_operation_type IN (
      'setup',
      'reset',
      'suspend',
      'restore',
      'revoke_sessions'
    )
  );

ALTER TABLE onetime.portal_student_access_operations
  DROP CONSTRAINT IF EXISTS portal_student_access_operations_operation_type_check;

ALTER TABLE onetime.portal_student_access_operations
  DROP CONSTRAINT IF EXISTS portal_student_access_operations_constraint_1;

ALTER TABLE onetime.portal_student_access_operations
  ADD CONSTRAINT portal_student_access_operations_operation_type_check
  CHECK (
    operation_type IN (
      'setup',
      'reset',
      'suspend',
      'restore',
      'revoke_sessions'
    )
  );
