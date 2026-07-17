import type { DbPool } from '../../../db/src/index.ts';

export type LearnerBillingAccessInput = {
  pool: DbPool;
  accountKey: string;
  productKey: string;
  householdKey: string;
};

export async function householdHasLearningAccess(input: LearnerBillingAccessInput) {
  const result = await input.pool.query(
    `SELECT grants_access
       FROM onetime.billing_entitlement_projections
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
        AND status IN ('active', 'scheduled_end')
      ORDER BY evaluated_at DESC
      LIMIT 1`,
    [input.accountKey, input.productKey, input.householdKey],
  );
  return result.rows[0]?.grants_access === true;
}
