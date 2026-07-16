import { createHash } from 'node:crypto';
import {
  legacyAudienceDryRunRequestSchema,
  legacyAudienceInputRowSchema,
  type LegacyAudienceDisposition,
  type LegacyAudienceDryRunReport,
  type LegacyAudienceDryRunRequest,
  type LegacyAudienceInputRow,
  type LegacyAudienceReasonCode,
  type LegacyAudienceSegmentCode,
  type LegacyAudienceSegmentContract,
  type LegacyAudienceSource,
  type LegacyAudienceType,
  type LegacyConsentState,
  type LegacyLeadState,
  type LegacySuppressionState,
  type LegacySystemState,
} from '../../../contracts/src/audience-reconciliation/index.ts';
import { normalizePhone, stableKey } from '../lead/normalize.ts';

export type LegacyAudienceActorScope = {
  accountKey: string;
  productKey: string;
};

export type LegacyAudienceExistingContact = {
  account_key: string;
  product_key: string;
  contact_key: string;
  public_contact_id: string | null;
  display_name: string;
  email_normalized: string | null;
  phone_normalized: string | null;
  archived_at: string | Date | null;
  suppression_state: string | null;
  new_system_activated?: boolean | undefined;
};

type NormalizedRow = {
  sourceRowNumber: number;
  sourceSheet: string | null;
  displayNameKey: string;
  email: string | null;
  phone: string | null;
  audienceType: LegacyAudienceType;
  legacySystemState: LegacySystemState;
  activeLegacyUser: boolean;
  newSystemActivated: boolean;
  leadState: LegacyLeadState;
  consentState: LegacyConsentState;
  suppressionState: LegacySuppressionState;
  sourceTags: string[];
  rowFingerprint: string;
  identityFingerprint: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

type MatchResult = {
  contact: LegacyAudienceExistingContact | null;
  candidates: LegacyAudienceExistingContact[];
  matchKind: 'email' | 'phone' | 'email_and_phone' | 'conflict' | 'none';
  reasons: LegacyAudienceReasonCode[];
};

export const legacyAudienceSegmentContracts: LegacyAudienceSegmentContract[] = [
  {
    segment_code: 'migration_invite_eligible',
    tag_key: 'ot74_migration_invite_eligible',
    display_name: 'Migration invite eligible',
    description:
      'Synthetic dry-run segment for family contacts eligible for a later migration invite.',
    visual_token: 'yellow',
    crm_fact_dimension: 'migration_eligibility',
    sends_allowed: false,
  },
  {
    segment_code: 'active_legacy_user',
    tag_key: 'ot74_active_legacy_user',
    display_name: 'Active legacy user',
    description: 'Independent fact that the old system marks the person as active.',
    visual_token: 'ice',
    crm_fact_dimension: 'legacy_activity',
    sends_allowed: false,
  },
  {
    segment_code: 'manual_review',
    tag_key: 'ot74_manual_review',
    display_name: 'Manual review',
    description: 'Rows that must be reviewed before any contact or campaign action.',
    visual_token: 'neutral',
    crm_fact_dimension: 'migration_eligibility',
    sends_allowed: false,
  },
  {
    segment_code: 'school_follow_up',
    tag_key: 'ot74_school_follow_up',
    display_name: 'School follow-up',
    description: 'School leads that require human follow-up and no class or portal entitlement.',
    visual_token: 'ice',
    crm_fact_dimension: 'legacy_membership',
    sends_allowed: false,
  },
  {
    segment_code: 'do_not_contact',
    tag_key: 'ot74_do_not_contact',
    display_name: 'Do not contact',
    description: 'Consent or suppression state blocks communication eligibility.',
    visual_token: 'neutral',
    crm_fact_dimension: 'migration_eligibility',
    sends_allowed: false,
  },
];

export function createLegacyAudienceDryRun(input: {
  scope: LegacyAudienceActorScope;
  request: LegacyAudienceDryRunRequest;
  existingContacts: LegacyAudienceExistingContact[];
  now?: Date;
}): LegacyAudienceDryRunReport {
  const request = legacyAudienceDryRunRequestSchema.parse(input.request);
  const normalizedRows = request.rows.map((row) => normalizeInputRow(row, request.source));
  const requestHash = sha256(
    JSON.stringify({
      source: request.source,
      rows: normalizedRows.map((row) => ({
        row_fingerprint: row.rowFingerprint,
        identity_fingerprint: row.identityFingerprint,
      })),
    }),
  );
  const batchKey = stableKey('legacy_batch', [
    input.scope.accountKey,
    input.scope.productKey,
    request.idempotency_key,
    requestHash,
  ]);
  const sourceDigest = sha256(
    JSON.stringify({
      source: request.source,
      row_fingerprints: normalizedRows.map((row) => row.rowFingerprint),
    }),
  );
  const scopedContacts = input.existingContacts.filter(
    (contact) =>
      contact.account_key === input.scope.accountKey &&
      contact.product_key === input.scope.productKey,
  );
  const indexes = indexContacts(scopedContacts);
  const seenRowFingerprints = new Set<string>();
  const seenIdentityFingerprints = new Set<string>();
  const rowOutcomes = normalizedRows.map((row) => {
    const duplicate =
      seenRowFingerprints.has(row.rowFingerprint) ||
      (row.identityFingerprint !== null && seenIdentityFingerprints.has(row.identityFingerprint));
    seenRowFingerprints.add(row.rowFingerprint);
    if (row.identityFingerprint) seenIdentityFingerprints.add(row.identityFingerprint);
    return classifyRow({ batchKey, row, duplicate, match: matchRow(row, indexes) });
  });

  return {
    batch_key: batchKey,
    request_hash: requestHash,
    source_digest: sourceDigest,
    source: request.source,
    summary: summarizeRows(rowOutcomes),
    row_outcomes: rowOutcomes,
    generated_at: (input.now ?? new Date()).toISOString(),
    raw_row_contents_included: false,
    production_side_effects: false,
  };
}

export function parseLegacyAudienceCsv(
  csvText: string,
  source: Pick<LegacyAudienceSource, 'worksheet_label'> = {},
): LegacyAudienceInputRow[] {
  const records = parseCsvRecords(csvText);
  const header = records.shift();
  if (!header) return [];
  const normalizedHeader = header.map(normalizeHeader);
  return records
    .filter((record) => record.some((cell) => cell.trim() !== ''))
    .map((record, index) =>
      legacyAudienceInputRowSchema.parse(
        rowFromRecord({
          record,
          header: normalizedHeader,
          fallbackRowNumber: index + 2,
          fallbackSheet: source.worksheet_label,
        }),
      ),
    );
}

export function mapLegacyAudienceWorksheetRows(
  rows: Array<Record<string, unknown>>,
  source: Pick<LegacyAudienceSource, 'worksheet_label'> = {},
): LegacyAudienceInputRow[] {
  return rows.map((row, index) =>
    legacyAudienceInputRowSchema.parse(
      rowFromObject({
        row,
        fallbackRowNumber: index + 2,
        fallbackSheet: source.worksheet_label,
      }),
    ),
  );
}

export function formatLegacyAudienceDryRunReport(report: LegacyAudienceDryRunReport) {
  const lines = [
    'OT-74 legacy audience dry run',
    `source_kind: ${report.source.kind}`,
    `source_label: ${report.source.source_label}`,
    `batch_key: ${report.batch_key}`,
    `total_rows: ${report.summary.total_rows}`,
    `unique_rows: ${report.summary.unique_rows}`,
    `duplicate_rows: ${report.summary.duplicate_rows}`,
    `matched_existing_contacts: ${report.summary.matched_existing_contacts}`,
    `staged_new_contacts: ${report.summary.staged_new_contacts}`,
    `manual_review_rows: ${report.summary.manual_review_rows}`,
    `migration_invite_eligible_rows: ${report.summary.migration_invite_eligible_rows}`,
    `school_follow_up_rows: ${report.summary.school_follow_up_rows}`,
    `do_not_contact_rows: ${report.summary.do_not_contact_rows}`,
    `already_activated_rows: ${report.summary.already_activated_rows}`,
    'disposition_counts:',
    ...formatCounts(report.summary.disposition_counts),
    'reason_counts:',
    ...formatCounts(report.summary.reason_counts),
    'segment_counts:',
    ...formatCounts(report.summary.segment_counts),
    'raw_row_contents_included: false',
    'production_side_effects: false',
  ];
  return `${lines.join('\n')}\n`;
}

function classifyRow(input: {
  batchKey: string;
  row: NormalizedRow;
  duplicate: boolean;
  match: MatchResult;
}): LegacyAudienceDryRunReport['row_outcomes'][number] {
  const reasons = uniqueReasons([...input.match.reasons]);
  const segmentCodes = new Set<LegacyAudienceSegmentCode>();
  const suppressedBySource = input.row.suppressionState === 'suppressed';
  const suppressedByContact =
    input.match.contact?.suppression_state !== null &&
    input.match.contact?.suppression_state !== undefined &&
    input.match.contact.suppression_state !== 'active';
  const newSystemActivated =
    input.row.newSystemActivated || Boolean(input.match.contact?.new_system_activated);
  const consentOptedOut = input.row.consentState === 'opted_out';
  const communicationEligible =
    input.row.consentState === 'opted_in' &&
    !suppressedBySource &&
    !suppressedByContact &&
    !newSystemActivated &&
    (input.row.hasEmail || input.row.hasPhone);

  let disposition: LegacyAudienceDisposition = 'stage_new_contact';
  if (input.duplicate) {
    disposition = 'duplicate_input';
    reasons.push('duplicate_input');
  } else if (!input.row.hasEmail && !input.row.hasPhone) {
    disposition = 'manual_review';
    reasons.push('missing_identity', 'no_name_only_match');
  } else if (input.match.reasons.includes('conflicting_identity')) {
    disposition = 'manual_review';
  } else if (input.match.reasons.includes('ambiguous_match')) {
    disposition = 'manual_review';
  } else if (input.match.contact) {
    disposition = 'matched_existing_contact';
    if (input.match.contact.archived_at) {
      disposition = 'manual_review';
      reasons.push('archived_contact');
    }
  } else {
    disposition = 'stage_new_contact';
    reasons.push('new_identity');
  }

  if (input.row.activeLegacyUser) {
    reasons.push('active_legacy_user');
    segmentCodes.add('active_legacy_user');
  }
  if (input.row.audienceType === 'school') {
    reasons.push('school_requires_follow_up', 'school_no_entitlement');
    segmentCodes.add('school_follow_up');
  }
  if (suppressedBySource) reasons.push('suppressed_source');
  if (suppressedByContact) reasons.push('suppressed_contact');
  if (consentOptedOut) reasons.push('consent_opted_out');
  if (newSystemActivated) reasons.push('already_activated');
  if (suppressedBySource || suppressedByContact || consentOptedOut) {
    segmentCodes.add('do_not_contact');
  }
  if (communicationEligible) reasons.push('communication_eligible');
  if (disposition === 'manual_review') segmentCodes.add('manual_review');
  if (
    disposition !== 'manual_review' &&
    disposition !== 'duplicate_input' &&
    input.row.audienceType === 'family' &&
    input.row.activeLegacyUser &&
    communicationEligible &&
    !newSystemActivated
  ) {
    segmentCodes.add('migration_invite_eligible');
  }

  const uniqueReasonCodes = uniqueReasons(reasons);
  const candidateContactKeys = input.match.candidates.map((candidate) => candidate.contact_key);
  const rowKey = stableKey('legacy_row', [input.batchKey, input.row.rowFingerprint]);

  return {
    row_key: rowKey,
    row_number: input.row.sourceRowNumber,
    source_sheet: input.row.sourceSheet,
    row_fingerprint: input.row.rowFingerprint,
    identity_fingerprint: input.row.identityFingerprint,
    has_email: input.row.hasEmail,
    has_phone: input.row.hasPhone,
    audience_type: input.row.audienceType,
    legacy_system_state: input.row.legacySystemState,
    active_legacy_user: input.row.activeLegacyUser,
    new_system_activated: newSystemActivated,
    lead_state: input.row.leadState,
    consent_state: input.row.consentState,
    suppression_state: input.row.suppressionState,
    communication_eligible: communicationEligible,
    disposition,
    reasons: uniqueReasonCodes.length ? uniqueReasonCodes : ['new_identity'],
    segment_codes: Array.from(segmentCodes).sort(),
    matched_contact_key: input.match.contact?.contact_key ?? null,
    matched_contact_id:
      input.match.contact?.public_contact_id ?? input.match.contact?.contact_key ?? null,
    candidate_contact_keys: candidateContactKeys,
  };
}

function matchRow(row: NormalizedRow, indexes: ReturnType<typeof indexContacts>): MatchResult {
  const emailMatches = row.email ? (indexes.byEmail.get(row.email) ?? []) : [];
  const phoneMatches = row.phone ? (indexes.byPhone.get(row.phone) ?? []) : [];
  const candidates = uniqueContacts([...emailMatches, ...phoneMatches]);
  if (!candidates.length) return { contact: null, candidates: [], matchKind: 'none', reasons: [] };

  if (emailMatches.length && phoneMatches.length) {
    const emailKeys = new Set(emailMatches.map((contact) => contact.contact_key));
    const shared = phoneMatches.filter((contact) => emailKeys.has(contact.contact_key));
    if (!shared.length) {
      return {
        contact: null,
        candidates,
        matchKind: 'conflict',
        reasons: ['conflicting_identity'],
      };
    }
    if (candidates.length === 1) {
      return {
        contact: candidates[0] ?? null,
        candidates,
        matchKind: 'email_and_phone',
        reasons: ['matched_by_email_and_phone'],
      };
    }
  }

  if (candidates.length > 1) {
    return { contact: null, candidates, matchKind: 'conflict', reasons: ['ambiguous_match'] };
  }

  const contact = candidates[0] ?? null;
  if (!contact) return { contact: null, candidates: [], matchKind: 'none', reasons: [] };
  const matchedByEmail = row.email && contact.email_normalized === row.email;
  const matchedByPhone = row.phone && contact.phone_normalized === row.phone;
  const reasons: LegacyAudienceReasonCode[] =
    matchedByEmail && matchedByPhone
      ? ['matched_by_email_and_phone']
      : matchedByEmail
        ? ['matched_by_email']
        : ['matched_by_phone'];
  return {
    contact,
    candidates,
    matchKind:
      matchedByEmail && matchedByPhone ? 'email_and_phone' : matchedByEmail ? 'email' : 'phone',
    reasons,
  };
}

function normalizeInputRow(
  row: LegacyAudienceInputRow,
  source: LegacyAudienceSource,
): NormalizedRow {
  const parsed = legacyAudienceInputRowSchema.parse(row);
  const email = parsed.email ? normalizeEmail(parsed.email) : null;
  const phone = normalizePhone(parsed.phone) ?? null;
  const displayNameKey = parsed.display_name.trim().toLowerCase();
  const sourceSheet = parsed.source_sheet ?? source.worksheet_label ?? null;
  const identityFingerprint = email || phone ? sha256(JSON.stringify({ email, phone })) : null;
  const canonical = {
    source_kind: source.kind,
    source_label: source.source_label,
    workbook_label: source.workbook_label ?? null,
    source_sheet: sourceSheet,
    source_row_number: parsed.source_row_number,
    display_name_key: displayNameKey,
    email,
    phone,
    audience_type: parsed.audience_type,
    legacy_system_state: parsed.legacy_system_state,
    active_legacy_user: parsed.active_legacy_user,
    new_system_activated: parsed.new_system_activated,
    lead_state: parsed.lead_state,
    consent_state: parsed.consent_state,
    suppression_state: parsed.suppression_state,
    source_tags: parsed.source_tags.map((tag) => tag.toLowerCase()).sort(),
  };
  return {
    sourceRowNumber: parsed.source_row_number,
    sourceSheet,
    displayNameKey,
    email,
    phone,
    audienceType: parsed.audience_type,
    legacySystemState: parsed.legacy_system_state,
    activeLegacyUser: parsed.active_legacy_user,
    newSystemActivated: parsed.new_system_activated,
    leadState: parsed.lead_state,
    consentState: parsed.consent_state,
    suppressionState: parsed.suppression_state,
    sourceTags: parsed.source_tags,
    rowFingerprint: sha256(JSON.stringify(canonical)),
    identityFingerprint,
    hasEmail: email !== null,
    hasPhone: phone !== null,
  };
}

function summarizeRows(rowOutcomes: LegacyAudienceDryRunReport['row_outcomes']) {
  const reasonCounts: Record<string, number> = {};
  const dispositionCounts: Record<string, number> = {};
  const segmentCounts: Record<string, number> = {};
  for (const outcome of rowOutcomes) {
    addCount(dispositionCounts, outcome.disposition);
    for (const reason of outcome.reasons) addCount(reasonCounts, reason);
    for (const segment of outcome.segment_codes) addCount(segmentCounts, segment);
  }
  return {
    total_rows: rowOutcomes.length,
    unique_rows: rowOutcomes.filter((row) => row.disposition !== 'duplicate_input').length,
    duplicate_rows: rowOutcomes.filter((row) => row.disposition === 'duplicate_input').length,
    matched_existing_contacts: rowOutcomes.filter(
      (row) => row.disposition === 'matched_existing_contact',
    ).length,
    staged_new_contacts: rowOutcomes.filter((row) => row.disposition === 'stage_new_contact')
      .length,
    manual_review_rows: rowOutcomes.filter((row) => row.disposition === 'manual_review').length,
    school_follow_up_rows: rowOutcomes.filter((row) =>
      row.segment_codes.includes('school_follow_up'),
    ).length,
    do_not_contact_rows: rowOutcomes.filter((row) => row.segment_codes.includes('do_not_contact'))
      .length,
    already_activated_rows: rowOutcomes.filter((row) => row.new_system_activated).length,
    migration_invite_eligible_rows: rowOutcomes.filter((row) =>
      row.segment_codes.includes('migration_invite_eligible'),
    ).length,
    active_legacy_user_rows: rowOutcomes.filter((row) =>
      row.segment_codes.includes('active_legacy_user'),
    ).length,
    reason_counts: reasonCounts,
    disposition_counts: dispositionCounts,
    segment_counts: segmentCounts,
  };
}

function indexContacts(contacts: LegacyAudienceExistingContact[]) {
  const byEmail = new Map<string, LegacyAudienceExistingContact[]>();
  const byPhone = new Map<string, LegacyAudienceExistingContact[]>();
  for (const contact of contacts) {
    if (contact.email_normalized)
      addToIndex(byEmail, normalizeEmail(contact.email_normalized), contact);
    if (contact.phone_normalized) addToIndex(byPhone, contact.phone_normalized, contact);
  }
  return { byEmail, byPhone };
}

function rowFromRecord(input: {
  record: string[];
  header: string[];
  fallbackRowNumber: number;
  fallbackSheet?: string | undefined;
}) {
  const object: Record<string, unknown> = {};
  input.header.forEach((name, index) => {
    object[name] = input.record[index] ?? '';
  });
  return rowFromObject({
    row: object,
    fallbackRowNumber: input.fallbackRowNumber,
    fallbackSheet: input.fallbackSheet,
  });
}

function rowFromObject(input: {
  row: Record<string, unknown>;
  fallbackRowNumber: number;
  fallbackSheet?: string | undefined;
}) {
  const rowNumber = Number(
    readCell(input.row, ['source_row_number', 'row_number', 'row', 'source row']) ??
      input.fallbackRowNumber,
  );
  const sourceSheet = readCell(input.row, ['source_sheet', 'sheet', 'worksheet']);
  const mapped: Record<string, unknown> = {
    source_row_number: Number.isFinite(rowNumber) ? rowNumber : input.fallbackRowNumber,
    display_name: readCell(input.row, ['display_name', 'contact_name', 'name', 'full_name']) ?? '',
    email: readCell(input.row, ['email', 'email_address']) ?? '',
    phone: readCell(input.row, ['phone', 'whatsapp', 'mobile']) ?? '',
    audience_type: toAudience(readCell(input.row, ['audience_type', 'classification', 'audience'])),
    legacy_system_state: toLegacySystemState(
      readCell(input.row, ['legacy_system_state', 'old_system_state', 'exists_in_old_system']),
    ),
    active_legacy_user: toBoolean(
      readCell(input.row, ['active_legacy_user', 'legacy_active', 'active_user']),
    ),
    new_system_activated: toBoolean(
      readCell(input.row, ['new_system_activated', 'already_activated', 'activated_in_new_system']),
    ),
    lead_state: toLeadState(readCell(input.row, ['lead_state', 'is_lead', 'lead'])),
    consent_state: toConsentState(readCell(input.row, ['consent_state', 'consent'])),
    suppression_state: toSuppressionState(
      readCell(input.row, ['suppression_state', 'suppressed', 'do_not_contact']),
    ),
    source_tags: toTags(readCell(input.row, ['source_tags', 'tags'])),
  };
  const sheet = sourceSheet ?? input.fallbackSheet;
  if (sheet) mapped.source_sheet = sheet;
  return mapped;
}

function parseCsvRecords(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows;
}

function readCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    for (const [rawKey, value] of Object.entries(row)) {
      if (normalizeHeader(rawKey) === normalizedKey) {
        if (value === null || value === undefined) return undefined;
        return String(value).trim();
      }
    }
  }
  return undefined;
}

function toAudience(value?: string): LegacyAudienceType {
  return value?.toLowerCase() === 'school' ? 'school' : 'family';
}

function toLegacySystemState(value?: string): LegacySystemState {
  const normalized = value?.toLowerCase();
  if (normalized === 'present' || normalized === 'yes' || normalized === 'true') return 'present';
  if (normalized === 'absent' || normalized === 'no' || normalized === 'false') return 'absent';
  return 'unknown';
}

function toLeadState(value?: string): LegacyLeadState {
  const normalized = value?.toLowerCase();
  if (normalized === 'lead' || normalized === 'yes' || normalized === 'true') return 'lead';
  if (normalized === 'not_lead' || normalized === 'not lead' || normalized === 'no') {
    return 'not_lead';
  }
  return 'unknown';
}

function toConsentState(value?: string): LegacyConsentState {
  const normalized = value?.toLowerCase();
  if (normalized === 'opted_in' || normalized === 'opted in' || normalized === 'yes') {
    return 'opted_in';
  }
  if (normalized === 'opted_out' || normalized === 'opted out' || normalized === 'no') {
    return 'opted_out';
  }
  return 'unknown';
}

function toSuppressionState(value?: string): LegacySuppressionState {
  const normalized = value?.toLowerCase();
  if (normalized === 'suppressed' || normalized === 'do_not_contact' || normalized === 'true') {
    return 'suppressed';
  }
  if (normalized === 'active' || normalized === 'false') return 'active';
  return 'unknown';
}

function toBoolean(value?: string) {
  const normalized = value?.toLowerCase();
  return (
    normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'active'
  );
}

function toTags(value?: string) {
  return (value ?? '')
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function addToIndex(
  index: Map<string, LegacyAudienceExistingContact[]>,
  key: string,
  contact: LegacyAudienceExistingContact,
) {
  const contacts = index.get(key) ?? [];
  contacts.push(contact);
  index.set(key, contacts);
}

function uniqueContacts(contacts: LegacyAudienceExistingContact[]) {
  const seen = new Set<string>();
  const unique: LegacyAudienceExistingContact[] = [];
  for (const contact of contacts) {
    if (seen.has(contact.contact_key)) continue;
    seen.add(contact.contact_key);
    unique.push(contact);
  }
  return unique;
}

function uniqueReasons(reasons: LegacyAudienceReasonCode[]) {
  return Array.from(new Set(reasons));
}

function addCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function formatCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `- ${key}: ${value}`);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
