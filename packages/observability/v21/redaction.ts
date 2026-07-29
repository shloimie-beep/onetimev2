import type { OperationsIssue } from './contracts.ts';

const REDACTED = '[redacted]';
const SENSITIVE_KEY =
  /^(?:password|passwd|secret|access_token|refresh_token|id_token|cookie|authorization|credential|credentials|api[_-]?key|private[_-]?key|card_number|cvv|setup[_-]?link|reset[_-]?link)$/i;
const PII_KEY =
  /^(?:(?:email|phone)(?:_address|_number)?|full[_-]?name|display[_-]?name|(?:recipient|adult|parent|student|child|user|contact)_(?:email|phone|name)|student[_-]?(?:text|question)|child[_-]?(?:text|question))$/i;
const SAFE_DIGEST_KEY = /(?:sha|digest|hash|fingerprint)$/i;
const BEARER = /\bbearer\s+[a-z0-9._~+/=-]+/i;
const JWT = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+\d{8,15}\b|\b\d{3}[ .()-]\d{3}[ .-]\d{4}\b)/;
const PROVIDER_URL = /https?:\/\/[^\s"'<>]*(?:zoom|vimeo|drive\.google|meet\.google)[^\s"'<>]*/i;
const DATABASE_URL = /postgres(?:ql)?:\/\/[^\s]+/i;
const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/;

export type LeakageFindingCode =
  | 'secret_field'
  | 'pii_field'
  | 'bearer_token'
  | 'jwt_token'
  | 'pii_email'
  | 'pii_phone'
  | 'provider_url'
  | 'database_url'
  | 'card_data';

export interface LeakageScanResult {
  passed: boolean;
  finding_counts: Readonly<Partial<Record<LeakageFindingCode, number>>>;
  issues: readonly OperationsIssue[];
}

export function redactOperationalData(value: unknown): unknown {
  return redactValue(value, null);
}

export function scanOperationalLeakage(value: unknown): LeakageScanResult {
  const counts = new Map<LeakageFindingCode, number>();
  scanValue(value, null, counts);
  const findingCounts = Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<LeakageFindingCode, number>>;
  const issues = [...counts.keys()].map<OperationsIssue>((code) => ({
    code: `operational_leakage_${code}`,
    category: 'leakage',
    severity: 'sev1',
    summary: 'Protected material was detected in an operational payload.',
    safe_context: { finding_code: code, count: counts.get(code) ?? 0 },
  }));
  return { passed: counts.size === 0, finding_counts: findingCounts, issues };
}

function redactValue(value: unknown, key: string | null): unknown {
  if (key && !SAFE_DIGEST_KEY.test(key) && (SENSITIVE_KEY.test(key) || PII_KEY.test(key))) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    if (isProtectedString(value)) return REDACTED;
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      output[nestedKey] = redactValue(nestedValue, nestedKey);
    }
    return output;
  }
  return value;
}

function scanValue(
  value: unknown,
  key: string | null,
  counts: Map<LeakageFindingCode, number>,
): void {
  if (key && !SAFE_DIGEST_KEY.test(key)) {
    if (SENSITIVE_KEY.test(key) && hasMaterial(value)) increment(counts, 'secret_field');
    if (PII_KEY.test(key) && hasMaterial(value)) increment(counts, 'pii_field');
  }
  if (typeof value === 'string') {
    for (const [code, pattern] of [
      ['bearer_token', BEARER],
      ['jwt_token', JWT],
      ['pii_email', EMAIL],
      ['pii_phone', PHONE],
      ['provider_url', PROVIDER_URL],
      ['database_url', DATABASE_URL],
      ['card_data', CARD_NUMBER],
    ] as const) {
      if (pattern.test(value)) increment(counts, code);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanValue(item, key, counts);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      scanValue(nestedValue, nestedKey, counts);
    }
  }
}

function isProtectedString(value: string): boolean {
  return [BEARER, JWT, EMAIL, PHONE, PROVIDER_URL, DATABASE_URL, CARD_NUMBER].some((pattern) =>
    pattern.test(value),
  );
}

function hasMaterial(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function increment(counts: Map<LeakageFindingCode, number>, code: LeakageFindingCode): void {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}
