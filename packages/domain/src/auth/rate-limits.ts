import { AUTH_RATE_LIMITS } from '../../../contracts/src/identity/auth/index.ts';

export type AuthRateLimitKind = keyof typeof AUTH_RATE_LIMITS;

type AuthRateLimitRule = {
  window_ms: number;
  maximum_failures?: number;
  maximum_requests?: number;
};

export function evaluateAuthRateLimit(input: {
  kind: AuthRateLimitKind;
  event_times: readonly Date[];
  now: Date;
}): { allowed: true } | { allowed: false; retry_after_seconds: number } {
  const rule: AuthRateLimitRule = AUTH_RATE_LIMITS[input.kind];
  const maximum = rule.maximum_failures ?? rule.maximum_requests;
  if (maximum === undefined) throw new Error(`Auth rate limit ${input.kind} has no maximum.`);
  const windowStart = input.now.getTime() - rule.window_ms;
  const inWindow = input.event_times
    .map((event) => event.getTime())
    .filter((timestamp) => timestamp > windowStart && timestamp <= input.now.getTime())
    .sort((left, right) => left - right);
  if (inWindow.length < maximum) return { allowed: true };
  const oldestBlockingEvent = inWindow[inWindow.length - maximum];
  if (oldestBlockingEvent === undefined) return { allowed: true };
  return {
    allowed: false,
    retry_after_seconds: Math.max(
      1,
      Math.ceil((oldestBlockingEvent + rule.window_ms - input.now.getTime()) / 1000),
    ),
  };
}
