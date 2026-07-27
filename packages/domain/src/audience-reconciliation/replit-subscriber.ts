import { createHash } from 'node:crypto';
import { normalizeEmail, normalizePhone, stableKey } from '../lead/normalize.ts';

export const replitContactTaxonomy = {
  sourceTag: 'OT | Source | Legacy Subscriber',
  activeSubscriberTag: 'OT | Existing Subscriber',
  migrationCandidateTag: 'OT | Migration 2026',
  suppressionTag: 'OT | Marketing Suppressed',
  workflow: 'OT-02A Existing Subscriber Migration 2026 v1',
  segment: 'OT-02A | Replit Active Migration Candidates | 2026',
} as const;

export type ReplitSubscriberRow = {
  sourceRowNumber: number;
  externalId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  plan: string;
  location: string;
  joined: string;
  trialEnd: string;
  notes: string;
};

export type ExistingAdultIdentity = {
  recordKey: string;
  source: 'one_time' | 'ghl' | 'historical_crm';
  externalId?: string | null;
  oneTimeContactId?: string | null;
  ghlContactId?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  suppressed?: boolean;
  unsubscribed?: boolean;
  complaint?: boolean;
  hardBounce?: boolean;
  dnd?: boolean;
};

export type ReplitProtectedImportRow = {
  sourceRowNumber: number;
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  tags: string[];
  source: 'replit_legacy_subscriber_2026';
  activeUser: boolean;
  migrationCandidate: boolean;
  denied: boolean;
  action: 'create' | 'update' | 'no_change';
};

export type ReplitReconciliationSummary = {
  source_rows: number;
  valid_adult_rows: number;
  duplicates_inside_source: number;
  existing_contact_matches: number;
  existing_ghl_matches: number;
  existing_one_time_matches: number;
  existing_historical_matches: number;
  new_contacts: number;
  contact_updates: number;
  unchanged_contacts: number;
  active_users: number;
  migration_candidates: number;
  ot_02b_candidates: number;
  suppressed_or_denied_contacts: number;
  identity_conflicts: number;
  invalid_or_skipped_rows: number;
};

export type ReplitReconciliationResult = {
  summary: ReplitReconciliationSummary;
  protectedImportRows: ReplitProtectedImportRow[];
  quarantined: Array<{
    sourceRowNumbers: number[];
    reason: 'duplicate_source_identity' | 'invalid_email' | 'identity_conflict';
    fingerprint: string;
  }>;
  raw_values_in_sanitized_output: false;
  sends: 0;
  workflow_enrollments: 0;
  deletions: 0;
  suppression_removals: 0;
};

export function reconcileReplitSubscribers(input: {
  rows: ReplitSubscriberRow[];
  existingAdults: ExistingAdultIdentity[];
}): ReplitReconciliationResult {
  const sourceGroups = groupBy(
    input.rows,
    (row) => normalizeEmail(row.email) || `invalid:${row.sourceRowNumber}`,
  );
  const identities = indexIdentities(input.existingAdults);
  const protectedImportRows: ReplitProtectedImportRow[] = [];
  const quarantined: ReplitReconciliationResult['quarantined'] = [];
  let duplicateRows = 0;
  let invalidRows = 0;
  let conflictRows = 0;

  for (const [emailKey, sourceRows] of sourceGroups) {
    if (sourceRows.length > 1) {
      duplicateRows += sourceRows.length - 1;
      invalidRows += sourceRows.length;
      quarantined.push({
        sourceRowNumbers: sourceRows.map((row) => row.sourceRowNumber),
        reason: 'duplicate_source_identity',
        fingerprint: fingerprint(emailKey),
      });
      continue;
    }
    const row = sourceRows[0]!;
    const email = normalizeEmail(row.email);
    if (!validEmail(email)) {
      invalidRows += 1;
      quarantined.push({
        sourceRowNumbers: [row.sourceRowNumber],
        reason: 'invalid_email',
        fingerprint: fingerprint(`invalid:${row.sourceRowNumber}`),
      });
      continue;
    }

    const phone = normalizePhone(row.phone ?? undefined);
    const matches = matchExistingIdentity(row, email, phone, identities);
    if (matches.conflict) {
      invalidRows += 1;
      conflictRows += 1;
      quarantined.push({
        sourceRowNumbers: [row.sourceRowNumber],
        reason: 'identity_conflict',
        fingerprint: fingerprint(`${email}:${phone ?? ''}`),
      });
      continue;
    }

    const ghl = onlyRecord(matches.records, 'ghl');
    const active = row.status.trim().toLowerCase() === 'active';
    const denied = matches.records.some(isDenied);
    const migrationCandidate = active && !denied;
    const tags = new Set(ghl?.tags ?? []);
    tags.add(replitContactTaxonomy.sourceTag);
    if (active) {
      tags.add(replitContactTaxonomy.activeSubscriberTag);
    }
    if (migrationCandidate) {
      tags.add(replitContactTaxonomy.migrationCandidateTag);
    }
    if (denied) tags.add(replitContactTaxonomy.suppressionTag);
    const requiredTags = [
      replitContactTaxonomy.sourceTag,
      ...(active ? [replitContactTaxonomy.activeSubscriberTag] : []),
      ...(migrationCandidate ? [replitContactTaxonomy.migrationCandidateTag] : []),
      ...(denied ? [replitContactTaxonomy.suppressionTag] : []),
    ];
    const action = ghl
      ? requiredTags.every((tag) => (ghl.tags ?? []).some((value) => sameTag(value, tag)))
        ? 'no_change'
        : 'update'
      : 'create';
    const [firstName, lastName] = splitName(row.name);
    protectedImportRows.push({
      sourceRowNumber: row.sourceRowNumber,
      contactId: ghl?.ghlContactId ?? '',
      email,
      firstName,
      lastName,
      phone: phone ?? '',
      tags: [...tags].sort((a, b) => a.localeCompare(b)),
      source: 'replit_legacy_subscriber_2026',
      activeUser: active,
      migrationCandidate,
      denied,
      action,
    });
  }

  const matchCounts = countMatches(protectedImportRows, input.existingAdults);
  return {
    summary: {
      source_rows: input.rows.length,
      valid_adult_rows: protectedImportRows.length,
      duplicates_inside_source: duplicateRows,
      existing_contact_matches: matchCounts.any,
      existing_ghl_matches: matchCounts.ghl,
      existing_one_time_matches: matchCounts.oneTime,
      existing_historical_matches: matchCounts.historical,
      new_contacts: protectedImportRows.filter((row) => row.action === 'create').length,
      contact_updates: protectedImportRows.filter((row) => row.action === 'update').length,
      unchanged_contacts: protectedImportRows.filter((row) => row.action === 'no_change').length,
      active_users: protectedImportRows.filter((row) => row.activeUser).length,
      migration_candidates: protectedImportRows.filter((row) => row.migrationCandidate).length,
      ot_02b_candidates: 0,
      suppressed_or_denied_contacts: protectedImportRows.filter((row) => row.denied).length,
      identity_conflicts: conflictRows,
      invalid_or_skipped_rows: invalidRows,
    },
    protectedImportRows,
    quarantined,
    raw_values_in_sanitized_output: false,
    sends: 0,
    workflow_enrollments: 0,
    deletions: 0,
    suppression_removals: 0,
  };
}

export function parseReplitSubscriberCsv(csvText: string): ReplitSubscriberRow[] {
  const [headers = [], ...records] = parseCsvRecords(csvText);
  const indexes = headerIndexes(headers);
  return records
    .filter((record) => record.some((cell) => cell.trim()))
    .map((record, index) => ({
      sourceRowNumber: index + 2,
      externalId: cell(record, indexes, ['replit_id', 'external_id', 'user_id']) || null,
      name: cell(record, indexes, ['name', 'display_name']),
      email: cell(record, indexes, ['email', 'email_address']),
      phone: cell(record, indexes, ['phone', 'phone_number']) || null,
      status: cell(record, indexes, ['status', 'active_status']),
      plan: cell(record, indexes, ['plan']),
      location: cell(record, indexes, ['location']),
      joined: cell(record, indexes, ['joined', 'signup_date', 'created_at']),
      trialEnd: cell(record, indexes, ['trial_end']),
      notes: cell(record, indexes, ['notes']),
    }));
}

export function parseHighLevelContactCsv(csvText: string): ExistingAdultIdentity[] {
  const [headers = [], ...records] = parseCsvRecords(csvText);
  const indexes = headerIndexes(headers);
  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => {
      const contactId = cell(record, indexes, ['contact_id', 'id']);
      return {
        recordKey: contactId || `ghl-row-${index + 2}`,
        source: 'ghl' as const,
        ghlContactId: contactId || null,
        email: cell(record, indexes, ['email', 'email_address']) || null,
        phone: cell(record, indexes, ['phone', 'phone_number']) || null,
        tags: splitTags(cell(record, indexes, ['tags'])),
      };
    });
}

export function parseHistoricalAudienceCsv(
  csvText: string,
  kind: 'subscribed' | 'unsubscribed' | 'cleaned',
): ExistingAdultIdentity[] {
  const [headers = [], ...records] = parseCsvRecords(csvText);
  const indexes = headerIndexes(headers);
  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => ({
      recordKey: cell(record, indexes, ['euid', 'leid']) || `historical-${kind}-row-${index + 2}`,
      source: 'historical_crm' as const,
      externalId: cell(record, indexes, ['euid', 'leid']) || null,
      email: cell(record, indexes, ['email', 'email_address']) || null,
      phone: cell(record, indexes, ['phone', 'phone_number']) || null,
      tags: splitTags(cell(record, indexes, ['tags'])),
      unsubscribed: kind === 'unsubscribed',
      hardBounce: kind === 'cleaned',
      suppressed: kind !== 'subscribed',
    }));
}

export function parseAcceptedHistoricalImportCsv(csvText: string): ExistingAdultIdentity[] {
  const [headers = [], ...records] = parseCsvRecords(csvText);
  const indexes = headerIndexes(headers);
  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => {
      const recordKey =
        cell(record, indexes, ['one_time_crm_contact_id', 'external_id']) ||
        `accepted-historical-row-${index + 2}`;
      const suppression = cell(record, indexes, [
        'one_time_suppression_state',
        'suppression_state',
      ]);
      const consent = cell(record, indexes, ['one_time_email_consent', 'email_consent']);
      return {
        recordKey,
        source: 'historical_crm' as const,
        externalId: recordKey,
        email: cell(record, indexes, ['email', 'email_address']) || null,
        phone: cell(record, indexes, ['phone', 'phone_number']) || null,
        tags: splitTags(cell(record, indexes, ['tags'])),
        dnd: truthy(cell(record, indexes, ['dnd', 'email_dnd', 'all_dnd'])),
        unsubscribed: consent.toLowerCase() === 'opted_out',
        suppressed: /suppressed/i.test(suppression),
      };
    });
}

export function toProtectedHighLevelImportCsv(rows: ReplitProtectedImportRow[]) {
  const records = [
    ['Contact Id', 'Email', 'First Name', 'Last Name', 'Phone', 'Tags', 'Source'],
    ...rows.map((row) => [
      row.contactId,
      row.email,
      row.firstName,
      row.lastName,
      row.phone,
      row.tags.join(', '),
      row.source,
    ]),
  ];
  return records
    .map((record) => record.map(csvCell).join(','))
    .join('\n')
    .concat('\n');
}

export function parseProtectedHighLevelImportCsv(csvText: string) {
  const [headers = [], ...records] = parseCsvRecords(csvText);
  const indexes = headerIndexes(headers);
  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => ({
      protectedRowNumber: index + 2,
      contactId: cell(record, indexes, ['contact_id', 'id']),
      email: normalizeEmail(cell(record, indexes, ['email', 'email_address'])),
      firstName: cell(record, indexes, ['first_name']),
      lastName: cell(record, indexes, ['last_name']),
      phone: normalizePhone(cell(record, indexes, ['phone', 'phone_number'])) ?? '',
      tags: splitTags(cell(record, indexes, ['tags'])),
      source: cell(record, indexes, ['source']),
    }));
}

export function requiredReplitProviderTags(tags: string[]) {
  const allowed = new Set<string>([
    replitContactTaxonomy.sourceTag,
    replitContactTaxonomy.activeSubscriberTag,
    replitContactTaxonomy.migrationCandidateTag,
    replitContactTaxonomy.suppressionTag,
  ]);
  return [...new Set(tags.filter((tag) => allowed.has(tag)))].sort((a, b) => a.localeCompare(b));
}

function indexIdentities(records: ExistingAdultIdentity[]) {
  const external = new Map<string, ExistingAdultIdentity[]>();
  const email = new Map<string, ExistingAdultIdentity[]>();
  const phone = new Map<string, ExistingAdultIdentity[]>();
  const durable = new Map<string, ExistingAdultIdentity[]>();
  for (const record of records) {
    addIndex(external, record.externalId?.trim() || null, record);
    addIndex(email, record.email ? normalizeEmail(record.email) : null, record);
    addIndex(phone, normalizePhone(record.phone ?? undefined), record);
    addIndex(durable, record.oneTimeContactId?.trim() || null, record);
    addIndex(durable, record.ghlContactId?.trim() || null, record);
  }
  return { external, email, phone, durable };
}

function matchExistingIdentity(
  row: ReplitSubscriberRow,
  email: string,
  phone: string | null,
  indexes: ReturnType<typeof indexIdentities>,
) {
  const byExternal = row.externalId ? (indexes.external.get(row.externalId.trim()) ?? []) : [];
  const byEmail = indexes.email.get(email) ?? [];
  const byPhone = phone ? (indexes.phone.get(phone) ?? []) : [];
  const records = uniqueRecords([...byExternal, ...byEmail, ...byPhone]);
  const emailGhlIds = new Set(byEmail.map((record) => record.ghlContactId).filter(Boolean));
  const emailOneTimeIds = new Set(byEmail.map((record) => record.oneTimeContactId).filter(Boolean));
  const phoneDurable = durableKeys(byPhone);
  const emailDurable = durableKeys(byEmail);
  const crossSignalConflict =
    emailDurable.size > 0 &&
    phoneDurable.size > 0 &&
    [...emailDurable].every((key) => !phoneDurable.has(key));
  return {
    records,
    conflict: emailGhlIds.size > 1 || emailOneTimeIds.size > 1 || crossSignalConflict,
  };
}

function countMatches(rows: ReplitProtectedImportRow[], existing: ExistingAdultIdentity[]) {
  const emailsBySource = {
    ghl: new Set<string>(),
    oneTime: new Set<string>(),
    historical: new Set<string>(),
  };
  for (const record of existing) {
    if (!record.email) continue;
    const email = normalizeEmail(record.email);
    if (record.source === 'ghl') emailsBySource.ghl.add(email);
    if (record.source === 'one_time') emailsBySource.oneTime.add(email);
    if (record.source === 'historical_crm') emailsBySource.historical.add(email);
  }
  const result = { any: 0, ghl: 0, oneTime: 0, historical: 0 };
  for (const row of rows) {
    const ghl = emailsBySource.ghl.has(row.email);
    const oneTime = emailsBySource.oneTime.has(row.email);
    const historical = emailsBySource.historical.has(row.email);
    if (ghl || oneTime || historical) result.any += 1;
    if (ghl) result.ghl += 1;
    if (oneTime) result.oneTime += 1;
    if (historical) result.historical += 1;
  }
  return result;
}

function isDenied(record: ExistingAdultIdentity) {
  const tags = record.tags ?? [];
  return Boolean(
    record.suppressed ||
    record.unsubscribed ||
    record.complaint ||
    record.hardBounce ||
    record.dnd ||
    tags.some((tag) => /suppressed|unsubscribe|hard.?bounce|complaint|\bdnd\b/i.test(tag)),
  );
}

function onlyRecord(records: ExistingAdultIdentity[], source: ExistingAdultIdentity['source']) {
  const matches = records.filter((record) => record.source === source);
  return matches.length === 1 ? matches[0] : null;
}

function uniqueRecords(records: ExistingAdultIdentity[]) {
  return [
    ...new Map(records.map((record) => [`${record.source}:${record.recordKey}`, record])).values(),
  ];
}

function durableKeys(records: ExistingAdultIdentity[]) {
  return new Set(
    records
      .flatMap((record) => [
        record.oneTimeContactId ? `ot:${record.oneTimeContactId}` : null,
        record.ghlContactId ? `ghl:${record.ghlContactId}` : null,
        record.externalId ? `external:${record.externalId}` : null,
      ])
      .filter((value): value is string => Boolean(value)),
  );
}

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [parts[0] ?? '', ''];
  return [parts[0]!, parts.slice(1).join(' ')];
}

function splitTags(value: string) {
  return value
    .split(/[,;]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sameTag(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function truthy(value: string) {
  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function addIndex(
  index: Map<string, ExistingAdultIdentity[]>,
  key: string | null,
  value: ExistingAdultIdentity,
) {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), value]);
}

function headerIndexes(headers: string[]) {
  return new Map(
    headers.map((header, index) => [
      header
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''),
      index,
    ]),
  );
}

function cell(record: string[], indexes: Map<string, number>, names: string[]) {
  for (const name of names) {
    const index = indexes.get(name);
    if (index !== undefined) return record[index]?.trim() ?? '';
  }
  return '';
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function parseCsvRecords(input: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) records.push(row);
  }
  return records;
}
