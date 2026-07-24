import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool } from '../../../db/src/index.ts';

export type RateLimitBudget = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  scope?: string;
};

export async function consumeRateLimitBudgets({
  pool,
  config,
  budgets,
  now = new Date(),
}: {
  pool: DbPool;
  config: Pick<AppConfig, 'accountKey' | 'productKey'>;
  budgets: RateLimitBudget[];
  now?: Date;
}): Promise<RateLimitResult> {
  await pool.query('DELETE FROM onetime.rate_limit_buckets WHERE expires_at < $1', [now]);

  for (const budget of budgets) {
    if (budget.limit <= 0) continue;
    const result = await consumeOneBudget({ pool, config, budget, now });
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

function budgetKey(config: Pick<AppConfig, 'accountKey' | 'productKey'>, budget: RateLimitBudget) {
  return createHash('sha256')
    .update([config.accountKey, config.productKey, budget.scope, budget.subject].join('\0'))
    .digest('hex');
}

async function consumeOneBudget({
  pool,
  config,
  budget,
  now,
}: {
  pool: DbPool;
  config: Pick<AppConfig, 'accountKey' | 'productKey'>;
  budget: RateLimitBudget;
  now: Date;
}): Promise<RateLimitResult> {
  const resetAt = new Date(now.getTime() + budget.windowMs);
  const expiresAt = new Date(resetAt.getTime() + budget.windowMs);
  const key = budgetKey(config, budget);
  const result = await pool.query(
    `INSERT INTO onetime.rate_limit_buckets
       (budget_key, account_key, product_key, scope, count, reset_at, expires_at)
     VALUES ($1,$2,$3,$4,1,$5,$6)
     ON CONFLICT (budget_key)
     DO UPDATE SET
       count = CASE
         WHEN onetime.rate_limit_buckets.reset_at <= $7 THEN 1
         ELSE onetime.rate_limit_buckets.count + 1
       END,
       reset_at = CASE
         WHEN onetime.rate_limit_buckets.reset_at <= $7 THEN $5
         ELSE onetime.rate_limit_buckets.reset_at
       END,
       expires_at = $6,
       updated_at = $7
     RETURNING count, reset_at`,
    [key, config.accountKey, config.productKey, budget.scope, resetAt, expiresAt, now],
  );
  const row = result.rows[0];
  const count = Number(row?.count ?? 0);
  if (count <= budget.limit) return { allowed: true };
  const currentResetAt = new Date(String(row.reset_at));
  return {
    allowed: false,
    scope: budget.scope,
    retryAfterSeconds: Math.max(1, Math.ceil((currentResetAt.getTime() - now.getTime()) / 1000)),
  };
}
