import type { OperationsIssue } from './contracts.ts';
import { isSafeOperationsIdentifier } from './runtime-identity.ts';

const REDACTED = '[redacted]';
const SENSITIVE_KEY =
  /(?:^|[_-])(?:password|passwd|secret(?:[_-](?:key|hash))?|access[_-]?token|refresh[_-]?token|id[_-]?token|token|cookie|authorization|proxy[_-]?authorization|credential(?![_-](?:expires|expiry|age))|credentials|api[_-]?key|private[_-]?key|card[_-]?number|cvv|setup[_-]?link|reset[_-]?link)(?:$|[_-])/i;
const PII_KEY =
  /^(?:(?:email|phone)(?:_address|_number)?|first[_-]?name|middle[_-]?name|last[_-]?name|full[_-]?name|display[_-]?name|date[_-]?of[_-]?birth|dob|ssn|national[_-]?id|passport[_-]?number|address|street|city|postal[_-]?code|zip[_-]?code|ip[_-]?address|user[_-]?agent|(?:recipient|adult|parent|student|child|user|contact)_(?:email|phone|name|address)|student[_-]?(?:text|question)|child[_-]?(?:text|question))$/i;
const SAFE_DIGEST_KEY =
  /^(?:repository_sha|application_source_sha|artifact_digest|configuration_digest|migration_inventory_digest|provider_registry_digest|public_asset_digest|specification_digest|acceptance_contract_digest|sha256)$/i;
const SAFE_OPERATIONAL_KEY = /^(?:fencing_token_high_watermark|credential_expires_in_ms)$/i;
const IDENTIFIER_KEY =
  /^(?:candidate_id|runtime_id|queue|worker_type|provider|safe_account_ref|release|evidence_id|alert_key|code|category)$/;
const SAFE_CONTEXT_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const BASIC = /\bbasic\s+[a-z0-9+/=]{4,}/i;
const BEARER = /\bbearer\s+[a-z0-9._~+/=-]+/i;
const JWT = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+\d{8,15}\b|\b\d{3}[ .()-]\d{3}[ .-]\d{4}\b)/;
const PROVIDER_URL =
  /https?:\/\/[^\s"'<>]*(?:resend\.com|gohighlevel\.com|leadconnectorhq\.com|stripe\.com|zoom\.(?:us|com)|vimeo\.com|drive\.google\.com|meet\.google\.com|api\.telegram\.org|telegram\.me|t\.me\/)[^\s"'<>]*/i;
const SIGNED_URL =
  /https?:\/\/[^\s"'<>]*[?&](?:x-amz-(?:signature|credential|security-token)|signature|sig|token|access_token|key)=[^&\s"'<>]+/i;
const DATABASE_URL = /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/i;
const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/;
const SECRET_ASSIGNMENT =
  /\b(?:secret|token|password|passwd|api[_-]?key|authorization|credential)\s*(?:=|:)\s*[^\s,;]+/i;

export type LeakageFindingCode =
  | 'secret_field'
  | 'pii_field'
  | 'basic_auth'
  | 'bearer_token'
  | 'jwt_token'
  | 'secret_assignment'
  | 'pii_email'
  | 'pii_phone'
  | 'provider_url'
  | 'signed_url'
  | 'database_url'
  | 'card_data'
  | 'unsafe_identifier'
  | 'unsafe_context_key';

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
  scanValue(value, null, false, counts);
  const findingCounts = Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<LeakageFindingCode, number>>;
  const issues = [...counts.keys()].map<OperationsIssue>((code) => ({
    code: `operational_leakage_${code}`,
    category: 'leakage',
    severity: 'sev1',
    summary: 'Protected or non-allowlisted material was detected in an operational payload.',
    safe_context: { finding_code: code, count: counts.get(code) ?? 0 },
  }));
  return { passed: counts.size === 0, finding_counts: findingCounts, issues };
}

function redactValue(value: unknown, key: string | null): unknown {
  if (
    key &&
    !SAFE_DIGEST_KEY.test(key) &&
    !SAFE_OPERATIONAL_KEY.test(key) &&
    (SENSITIVE_KEY.test(key) || PII_KEY.test(key))
  ) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    if (isProtectedString(value)) return REDACTED;
    if (key && IDENTIFIER_KEY.test(key) && !isSafeOperationsIdentifier(value)) return REDACTED;
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
  insideSafeContext: boolean,
  counts: Map<LeakageFindingCode, number>,
): void {
  if (key && !SAFE_DIGEST_KEY.test(key) && !SAFE_OPERATIONAL_KEY.test(key)) {
    if (SENSITIVE_KEY.test(key) && hasMaterial(value)) increment(counts, 'secret_field');
    if (PII_KEY.test(key) && hasMaterial(value)) increment(counts, 'pii_field');
    if (
      IDENTIFIER_KEY.test(key) &&
      typeof value === 'string' &&
      !isSafeOperationsIdentifier(value)
    ) {
      increment(counts, 'unsafe_identifier');
    }
    if (insideSafeContext && !SAFE_CONTEXT_KEY.test(key)) increment(counts, 'unsafe_context_key');
  }
  if (typeof value === 'string') {
    for (const [code, pattern] of [
      ['basic_auth', BASIC],
      ['bearer_token', BEARER],
      ['jwt_token', JWT],
      ['secret_assignment', SECRET_ASSIGNMENT],
      ['pii_email', EMAIL],
      ['pii_phone', PHONE],
      ['provider_url', PROVIDER_URL],
      ['signed_url', SIGNED_URL],
      ['database_url', DATABASE_URL],
      ['card_data', CARD_NUMBER],
    ] as const) {
      if (pattern.test(value)) increment(counts, code);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanValue(item, key, insideSafeContext, counts);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      scanValue(
        nestedValue,
        nestedKey,
        insideSafeContext || key === 'safe_context' || nestedKey === 'safe_context',
        counts,
      );
    }
  }
}

function isProtectedString(value: string): boolean {
  return [
    BASIC,
    BEARER,
    JWT,
    SECRET_ASSIGNMENT,
    EMAIL,
    PHONE,
    PROVIDER_URL,
    SIGNED_URL,
    DATABASE_URL,
    CARD_NUMBER,
  ].some((pattern) => pattern.test(value));
}

function hasMaterial(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function increment(counts: Map<LeakageFindingCode, number>, code: LeakageFindingCode): void {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}
