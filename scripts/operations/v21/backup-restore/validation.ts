export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: readonly ValidationIssue[];
}

export function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

export function result(issues: readonly ValidationIssue[]): ValidationResult {
  return { passed: issues.length === 0, issues };
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isLowercaseSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function parseTimestamp(value: unknown): number | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isPlaceholder(value: string): boolean {
  return /(?:^|[\s_-])(tbd|todo|placeholder|unknown|unapproved|pending|n\/a|none|role only|test fixture)(?:$|[\s_-])/i.test(
    value.trim(),
  );
}
