import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import {
  normalizeEmail,
  normalizePhone,
  stableKey,
} from '../../../../packages/domain/src/lead/normalize.ts';
import { consumeRateLimitBudgets } from '../../../../packages/domain/src/security/rate-limit.ts';
import { publicError } from '../../../../packages/observability/src/index.ts';

export function leadRateLimit(config: AppConfig, pool: DbPool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = leadIdentifier(req.body);
    const result = await consumeRateLimitBudgets({
      pool,
      config,
      budgets: [
        {
          scope: 'lead_ip',
          subject: req.ip ?? 'unknown',
          limit: config.leadRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'lead_identifier',
          subject: identifier,
          limit: config.leadIdentifierRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'lead_account_product',
          subject: `${config.accountKey}:${config.productKey}`,
          limit: config.leadAccountRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'lead_global',
          subject: 'all',
          limit: config.leadGlobalRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
      ],
    });
    if (result.allowed) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(result.retryAfterSeconds ?? 1));
    res
      .status(429)
      .json(publicError('RATE_LIMITED', 'Too many signup attempts. Please try again soon.'));
  };
}

export function eventRateLimit(config: AppConfig, pool: DbPool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = leadIdentifier(req.body);
    const result = await consumeRateLimitBudgets({
      pool,
      config,
      budgets: [
        {
          scope: 'event_ip',
          subject: req.ip ?? 'unknown',
          limit: config.leadRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'event_identifier',
          subject: identifier,
          limit: config.leadIdentifierRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'event_account_product',
          subject: `${config.accountKey}:${config.productKey}`,
          limit: config.leadAccountRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
        {
          scope: 'event_global',
          subject: 'all',
          limit: config.leadGlobalRateLimitMax,
          windowMs: config.leadRateLimitWindowMs,
        },
      ],
    });
    if (result.allowed) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(result.retryAfterSeconds ?? 1));
    res.status(429).json(publicError('RATE_LIMITED', 'Too many event attempts. Try again soon.'));
  };
}

function leadIdentifier(body: unknown) {
  if (!body || typeof body !== 'object') return 'anonymous';
  const candidate = body as Record<string, unknown>;
  const email = typeof candidate.email === 'string' ? normalizeEmail(candidate.email) : '';
  const phone = typeof candidate.phone === 'string' ? normalizePhone(candidate.phone) : '';
  if (email || phone) return stableKey('lead_identifier', [email, phone ?? '']);
  const idem = typeof candidate.idempotency_key === 'string' ? candidate.idempotency_key : '';
  return idem ? stableKey('lead_idem', [idem]) : 'anonymous';
}

export function resetLeadRateLimitForTests() {
  // Durable rate-limit buckets live in the per-test database now.
}
