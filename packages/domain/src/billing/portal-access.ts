import type { DbPool } from '../../../db/src/index.ts';
import { householdHasLearningAccess as householdHasCurrentAccess } from '../access/service.ts';

/**
 * Compatibility seam for portal adapters. The historical file name remains to
 * avoid a broad import churn, but current access is resolved only from the
 * neutral account-access projection.
 */
export async function householdHasLearningAccess(input: {
  pool: DbPool;
  accountKey: string;
  productKey: string;
  householdKey: string;
  now?: Date;
}) {
  return householdHasCurrentAccess({
    db: input.pool,
    accountKey: input.accountKey,
    productKey: input.productKey,
    householdKey: input.householdKey,
    ...(input.now ? { now: input.now } : {}),
  });
}
