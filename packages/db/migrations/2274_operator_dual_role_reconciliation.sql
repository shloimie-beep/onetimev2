-- Restore the bounded operator repair under the controller-reserved ordinal; the historical
-- 2260 migration-number collision. This migration never creates an adult,
-- HumanAccount, credential, Admin membership, or household. It adds only the
-- missing active Parent membership when exactly one complete canonical
-- operator identity and exactly one active owned household already exist in
-- the production operator-canary scope.

INSERT INTO onetime.v21_human_account_role_memberships
  (human_account_id, role, granted_at, granted_reason, product_key,
   runtime_tier, verification_environment_id)
SELECT DISTINCT account.human_account_id,
       'parent',
       CURRENT_TIMESTAMP,
       'ot_p0_operator_dual_role_reconciliation',
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
  JOIN (
    SELECT household.owner_human_account_id,
           household.owner_adult_id,
           household.product_key,
           household.runtime_tier,
           household.verification_environment_id,
           count(*)::integer AS active_household_count
      FROM onetime.v21_households AS household
     WHERE household.state = 'active'
     GROUP BY household.owner_human_account_id,
              household.owner_adult_id,
              household.product_key,
              household.runtime_tier,
              household.verification_environment_id
  ) AS household_census
    ON household_census.owner_human_account_id = account.human_account_id
   AND household_census.owner_adult_id = adult.adult_id
   AND household_census.product_key = account.product_key
   AND household_census.runtime_tier = account.runtime_tier
   AND household_census.verification_environment_id = account.verification_environment_id
   AND household_census.active_household_count = 1
  LEFT JOIN onetime.v21_human_account_role_memberships AS parent_membership
    ON parent_membership.human_account_id = account.human_account_id
   AND parent_membership.product_key = account.product_key
   AND parent_membership.runtime_tier = account.runtime_tier
   AND parent_membership.verification_environment_id = account.verification_environment_id
   AND parent_membership.role = 'parent'
   AND parent_membership.revoked_at IS NULL
 WHERE adult.normalized_email = 'sdratler@gmail.com'
   AND adult.product_key = 'one_time_mishnayos'
   AND adult.runtime_tier = 'production'
   AND adult.verification_environment_id = 'production_operator_canary'
   AND adult.state = 'active'
   AND parent_membership.human_account_id IS NULL
ON CONFLICT DO NOTHING;
