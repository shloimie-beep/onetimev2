ALTER TABLE onetime.account_users
  DROP CONSTRAINT IF EXISTS account_users_role_check;

ALTER TABLE onetime.account_users
  DROP CONSTRAINT IF EXISTS account_users_constraint_1;

ALTER TABLE onetime.account_users
  ADD CONSTRAINT account_users_role_check
  CHECK (role IN ('owner', 'admin', 'rabbi', 'crm_agent', 'viewer', 'parent', 'student'));

ALTER TABLE onetime.account_lifecycle_tokens
  DROP CONSTRAINT IF EXISTS account_lifecycle_tokens_target_role_check;

ALTER TABLE onetime.account_lifecycle_tokens
  DROP CONSTRAINT IF EXISTS account_lifecycle_tokens_constraint_2;

ALTER TABLE onetime.account_lifecycle_tokens
  ADD CONSTRAINT account_lifecycle_tokens_target_role_check
  CHECK (target_role IN ('owner', 'admin', 'rabbi', 'parent', 'student'));
