import { createHash } from 'node:crypto';

const SAFE_LOG_KEYS = new Set([
  'worker',
  'delivery_ref',
  'channel',
  'event_type',
  'attempt',
  'status',
  'reason',
  'failure_code',
  'failure_category',
  'provider',
  'http_status',
  'lease_lost',
  'claimed',
  'stage',
  'completed',
  'provider_calls_performed',
  'safe_error_code',
  'delivered',
  'sink_delivered',
  'retried',
  'dead_lettered',
  'suppressed',
  'skipped',
]);

export function opaqueDeliveryReference(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function redactText(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9._~-]+/gi, 'bearer [redacted]')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]')
    .replace(/\b(?:token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 200);
}

export function safeLogFields(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_LOG_KEYS.has(key) || value === undefined || value === null) continue;
    if (typeof value === 'string') {
      output[key] = redactText(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
    }
  }
  return output;
}
