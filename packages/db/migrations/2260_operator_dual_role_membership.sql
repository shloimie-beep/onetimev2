-- OT-LIVE-001.03 bounded operator repair.
--
-- Preserve the existing normalized adult identity, HumanAccount, Admin
-- membership, credential, and sole owned household. Add only the missing
-- Parent membership, and do so idempotently. If any prerequisite is absent or
-- ambiguous this migration deliberately performs no write; it never creates a
-- second identity, credential, or household and never resets a password.

INSERT INTO onetime.v21_human_account_role_memberships
  (human_account_id, role, granted_at, granted_reason, product_key,
   runtime_tier, verification_environment_id)
SELECT account.human_account_id,
       'parent',
       CURRENT_TIMESTAMP,
       'ot_live_001_03_operator_dual_role_repair',
       account.product_key,
       account.runtime_tier,
       account.verification_environment_id
  FROM onetime.v21_adult_identities AS adult
  JOIN onetime.v21_human_accounts AS account
    ON account.adult_id = adult.adult_id
   AND account.product_key = adult.product_key
   AND account.runtime_tier = adult.runtime_tier
   AND account.verification_environment_id = adult.verification_environment_id
   AND account.state = 'active'
  JOIN onetime.v21_human_account_role_memberships AS admin_membership
    ON admin_membership.human_account_id = account.human_account_id
   AND admin_membership.product_key = account.product_key
   AND admin_membership.runtime_tier = account.runtime_tier
   AND admin_membership.verification_environment_id = account.verification_environment_id
   AND admin_membership.role = 'admin'
   AND admin_membership.revoked_at IS NULL
  JOIN onetime.v21_adult_credentials AS credential
    ON credential.human_account_id = account.human_account_id
   AND credential.adult_id = adult.adult_id
   AND credential.product_key = account.product_key
   AND credential.runtime_tier = account.runtime_tier
   AND credential.verification_environment_id = account.verification_environment_id
   AND credential.credential_state = 'active'
  JOIN onetime.v21_households AS household
    ON household.owner_human_account_id = account.human_account_id
   AND household.owner_adult_id = adult.adult_id
   AND household.product_key = account.product_key
   AND household.runtime_tier = account.runtime_tier
   AND household.verification_environment_id = account.verification_environment_id
   AND household.state = 'active'
  LEFT JOIN onetime.v21_households AS other_household
    ON other_household.owner_human_account_id = account.human_account_id
   AND other_household.owner_adult_id = adult.adult_id
   AND other_household.product_key = account.product_key
   AND other_household.runtime_tier = account.runtime_tier
   AND other_household.verification_environment_id = account.verification_environment_id
   AND other_household.state = 'active'
   AND other_household.household_id <> household.household_id
  LEFT JOIN onetime.v21_human_account_role_memberships AS parent_membership
    ON parent_membership.human_account_id = account.human_account_id
   AND parent_membership.product_key = account.product_key
   AND parent_membership.runtime_tier = account.runtime_tier
   AND parent_membership.verification_environment_id = account.verification_environment_id
   AND parent_membership.role = 'parent'
   AND parent_membership.revoked_at IS NULL
 WHERE adult.normalized_email = 'sdratler@gmail.com'
   AND adult.product_key = 'one_time_mishnayos'
   AND adult.state = 'active'
   AND parent_membership.human_account_id IS NULL
   AND other_household.household_id IS NULL
ON CONFLICT DO NOTHING;
