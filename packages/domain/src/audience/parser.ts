import { createHash } from 'node:crypto';
import type {
  AudienceImportBatch,
  AudienceImportCell,
  AudienceImportRow,
  AudienceReconciliationReason,
  AudienceSuppressionStatus,
  AudienceType,
} from '../../../contracts/src/audience/schemas.ts';
import { audienceImportRowSchema } from '../../../contracts/src/audience/schemas.ts';
import { normalizeEmail, normalizePhone, stableKey } from '../lead/normalize.ts';

export type AudienceWorksheetRow = Record<string, AudienceImportCell>;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'active']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'inactive']);

export function parseAudienceCsv(csv: string): AudienceWorksheetRow[] {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map(normalizeHeader);
  return dataLines.map((line) => {
    const cells = parseCsvLine(line);
    const row: AudienceWorksheetRow = {};
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index] ?? '';
    });
    return row;
  });
}

export function mapAudienceWorksheetRows(
  batch: AudienceImportBatch,
  rows: AudienceWorksheetRow[],
  sheetName = 'Sheet1',
): AudienceImportRow[] {
  return rows.map((row, index) => mapAudienceWorksheetRow(batch, row, sheetName, index + 2));
}

export function mapAudienceWorksheetRow(
  batch: AudienceImportBatch,
  row: AudienceWorksheetRow,
  sheetName: string,
  sourceRowNumber: number,
): AudienceImportRow {
  const normalizedRow = normalizeRowKeys(row);
  const warnings: AudienceReconciliationReason[] = [];
  const email = normalizeEmailCell(readCell(normalizedRow, ['email', 'email_address']));
  if (email === 'invalid') warnings.push('invalid_email');
  const phone = normalizePhoneCell(
    readCell(normalizedRow, ['phone', 'phone_number', 'whatsapp', 'whatsapp_phone']),
  );
  if (phone === 'invalid') warnings.push('invalid_phone');
  const displayName = readCell(normalizedRow, ['display_name', 'name', 'contact_name']);
  const audienceType = parseAudienceType(
    readCell(normalizedRow, ['audience_type', 'classification', 'type']),
    parseBoolean(readCell(normalizedRow, ['school_submission', 'school_lead'])),
  );
  const rowFingerprint = fingerprintAudienceRow(batch, normalizedRow, sheetName, sourceRowNumber);
  const importRow: AudienceImportRow = {
    source_row_id: stableKey('audrow', [
      batch.source_batch_key,
      sheetName,
      String(sourceRowNumber),
      rowFingerprint,
    ]),
    source_spreadsheet_key: batch.source_spreadsheet_key,
    source_batch_key: batch.source_batch_key,
    source_sheet_name: sheetName,
    source_row_number: sourceRowNumber,
    row_fingerprint: rowFingerprint,
    display_name_present: Boolean(displayName),
    email_normalized: email === 'invalid' ? null : email,
    phone_normalized: phone === 'invalid' ? null : phone,
    audience_type: audienceType,
    source_facts: {
      is_lead: parseBoolean(readCell(normalizedRow, ['is_lead', 'lead', 'lead_status'])),
      in_old_system: parseBoolean(
        readCell(normalizedRow, ['in_old_system', 'old_system', 'legacy_contact']),
      ),
      active_legacy_user: parseBoolean(
        readCell(normalizedRow, ['active_legacy_user', 'legacy_active', 'active_user']),
      ),
      school_submission:
        audienceType === 'school' ||
        parseBoolean(readCell(normalizedRow, ['school_submission', 'school_lead'])),
    },
    consent_status: parseConsent(readCell(normalizedRow, ['consent_status', 'consent'])),
    suppression_status: parseSuppression(
      readCell(normalizedRow, ['suppression_status', 'suppression', 'do_not_contact']),
    ),
    archived: parseBoolean(readCell(normalizedRow, ['archived', 'is_archived'])),
    row_warnings: warnings,
  };
  return audienceImportRowSchema.parse(importRow);
}

export function fingerprintAudienceRow(
  batch: AudienceImportBatch,
  row: AudienceWorksheetRow,
  sheetName: string,
  _sourceRowNumber: number,
) {
  const stablePayload = JSON.stringify({
    source_spreadsheet_key: batch.source_spreadsheet_key,
    source_batch_key: batch.source_batch_key,
    sheetName,
    row: Object.keys(row)
      .sort()
      .map((key) => [key, stringifyCell(row[key])]),
  });
  return createHash('sha256').update(stablePayload).digest('hex');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeRowKeys(row: AudienceWorksheetRow): AudienceWorksheetRow {
  const normalized: AudienceWorksheetRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readCell(row: AudienceWorksheetRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && stringifyCell(value).trim() !== '') {
      return stringifyCell(value);
    }
  }
  return '';
}

function stringifyCell(value: AudienceImportCell | undefined) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeEmailCell(value: string): string | null | 'invalid' {
  if (!value) return null;
  const normalized = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : 'invalid';
}

function normalizePhoneCell(value: string): string | null | 'invalid' {
  if (!value) return null;
  const normalized = normalizePhone(value);
  if (!normalized) return null;
  return /^\+\d{7,15}$/.test(normalized) ? normalized : 'invalid';
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return false;
}

function parseAudienceType(value: string, schoolSubmission: boolean): AudienceType {
  const normalized = value.trim().toLowerCase();
  if (schoolSubmission || normalized.includes('school')) return 'school';
  if (normalized.includes('family') || normalized.includes('parent')) return 'family';
  return 'unknown';
}

function parseConsent(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['consented', 'yes', 'true', 'opt_in', 'opted_in'].includes(normalized)) return 'consented';
  if (['unsubscribed', 'opt_out', 'opted_out'].includes(normalized)) return 'unsubscribed';
  if (!normalized) return 'not_recorded';
  return 'unknown';
}

function parseSuppression(value: string): AudienceSuppressionStatus {
  const normalized = value.trim().toLowerCase();
  if (['do_not_contact', 'dnc', 'true', 'yes'].includes(normalized)) return 'do_not_contact';
  if (['unsubscribed', 'unsubscribe'].includes(normalized)) return 'unsubscribed';
  if (['bounced', 'bounce'].includes(normalized)) return 'bounced';
  if (['complaint', 'spam'].includes(normalized)) return 'complaint';
  if (['wrong_number', 'wrong number'].includes(normalized)) return 'wrong_number';
  return 'active';
}
