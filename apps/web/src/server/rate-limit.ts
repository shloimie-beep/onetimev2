import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import { publicError } from '../../../../packages/observability/src/index.ts';

type HitBucket = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, HitBucket>();

export function leadRateLimit(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = `${req.ip ?? 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(identity);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(identity, { count: 1, resetAt: now + config.leadRateLimitWindowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > config.leadRateLimitMax) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res
        .status(429)
        .json(publicError('RATE_LIMITED', 'Too many signup attempts. Please try again soon.'));
      return;
    }

    next();
  };
}

export function resetLeadRateLimitForTests() {
  buckets.clear();
}
