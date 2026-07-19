import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { normalizeEmail, normalizePhone } from '../../../packages/domain/src/lead/normalize.ts';

export const W12_100_04_APPROVED_SOURCES = [
  {
    id: 'DL-SHEET-f93f34d98e',
    fileName: 'Rabbi Scheller Followers.xlsx',
    classification: 'one_time_rabbi_scheller_followers',
    sha256: 'e17bbb32c8b2e642b8a6c5041ee36e720467fc4e666b0b5d59de1bb7f688a405',
    expectedRows: 812,
    expectedColumns: 2,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'unknown',
    defaultSuppressionState: 'unknown',
  },
  {
    id: 'DL-SHEET-3d4dceeb1b',
    fileName: 'subscribed_email_audience_export_HASH.csv',
    classification: 'email_audience_export',
    sha256: 'b1e7bb30e6464d4c3239590cba97e65842cc2736c77eb95d323e05d4b38ce319',
    expectedRows: 1311,
    expectedColumns: 31,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'opted_in',
    defaultSuppressionState: 'active',
  },
  {
    id: 'DL-SHEET-8c69f34fcd',
    fileName: 'unsubscribed_email_audience_export_HASH.csv',
    classification: 'email_audience_export',
    sha256: '4a5f84834b4e4f806775b945df09a03c73bd86e82afb15be84c0405ec38a2089',
    expectedRows: 152,
    expectedColumns: 35,
    sourceOwner: 'operator local Downloads',
    readiness: 'suppression_precedence_source',
    defaultConsentState: 'opted_out',
    defaultSuppressionState: 'suppressed',
  },
  {
    id: 'DL-SHEET-ead777c4b0',
    fileName: 'cleaned_email_audience_export_HASH.csv',
    classification: 'email_audience_export',
    sha256: 'b3093f6d3a7b4e9e9745740a734213d366c83d7c079c7b13c8f79089e63c94ca',
    expectedRows: 60,
    expectedColumns: 33,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'unknown',
    defaultSuppressionState: 'unknown',
  },
  {
    id: 'DL-SHEET-25eb3cb2d6',
    fileName: 'subscribers_detailed.csv',
    classification: 'email_audience_export',
    sha256: '0e05cd969c15e73240f4c2d681ca5208d9ada1ff95d908b2f14d337c67cdf6ca',
    expectedRows: 86,
    expectedColumns: 8,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'opted_in',
    defaultSuppressionState: 'active',
  },
  {
    id: 'DL-SHEET-2900326013',
    fileName: 'subscribers.csv',
    classification: 'email_audience_export',
    sha256: '3732cb909f796920ed3e418b94a3c89b98ce63fffc1741c2edd6d07d59d30437',
    expectedRows: 88,
    expectedColumns: 5,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'opted_in',
    defaultSuppressionState: 'active',
  },
] as const satisfies ApprovedSource[];

export const W12_100_04_MANUAL_REVIEW_CATEGORIES = [
  'missing_email_and_missing_phone',
  'duplicate_input_same_identity',
  'email_match_phone_conflict',
  'phone_match_email_conflict',
  'same_name_different_identity',
  'conflicting_consent_or_suppression',
  'legacy_member_without_current_consent',
  'pipeline_stage_ambiguous',
  'school_vs_family_classification_ambiguous',
  'household_guardian_role_ambiguous',
  'learner_without_guardian',
  'minor_or_student_safety_unclear',
  'source_ownership_unclear',
  'external_lead_source_requires_operator_approval',
  'existing_production_record_conflict',
  'private_message_or_note_requires_exclusion',
] as const;

export type ManualReviewCategory = (typeof W12_100_04_MANUAL_REVIEW_CATEGORIES)[number];

export type ApprovedSource = {
  id: string;
  fileName: string;
  classification:
    | 'one_time_rabbi_scheller_followers'
    | 'email_audience_export'
    | 'legacy_crm_or_pipeline_export'
    | 'communications_export'
    | 'external_lead_list'
    | 'unknown_spreadsheet';
  sha256: string;
  expectedRows: number;
  expectedColumns: number;
  sourceOwner: string;
  readiness: string;
  defaultConsentState: ConsentState;
  defaultSuppressionState: SuppressionState;
};

export type ExistingIdentitySnapshot = {
  identity_fingerprint: string;
  contact_fingerprint: string;
  suppression_state?: SuppressionState;
  new_system_activated?: boolean;
  no_op?: boolean;
};

export type RunW12100SourcePreflightOptions = {
  sourceDir?: string | undefined;
  approvedSources?: readonly ApprovedSource[] | undefined;
  existingIdentitySnapshot?: readonly ExistingIdentitySnapshot[] | undefined;
  now?: Date | undefined;
};

type ConsentState = 'opted_in' | 'opted_out' | 'unknown';
type SuppressionState = 'active' | 'suppressed' | 'unknown';
type Disposition =
  'matched_existing_contact' | 'stage_new_contact' | 'duplicate_input' | 'no_op' | 'manual_review';
type CrmStorageStatus =
  'crm_importable' | 'invalid' | 'duplicate' | 'identity_conflict' | 'quarantined';

type CorrectedCrmCounts = {
  crm_importable: number;
  email_campaign_eligible: number;
  whatsapp_campaign_eligible: number;
  suppressed: number;
  invalid: number;
  duplicate: number;
  identity_conflict: number;
  quarantined: number;
};

type SourceValidationResult = {
  id: string;
  file_name: string;
  status: 'verified' | 'missing' | 'hash_mismatch';
  expected_rows: number;
  expected_columns: number;
  approved_hash_fingerprint: string;
  detected_hash_fingerprint: string | null;
};

type SourceSummary = {
  id: string;
  file_name: string;
  classification: ApprovedSource['classification'];
  readiness: string;
  source_owner: string;
  file_fingerprint: string;
  expected_rows: number;
  observed_rows: number;
  expected_columns: number;
  observed_column_count: number;
  row_fingerprint_set_digest: string;
  identity_fingerprint_set_digest: string;
  disposition_counts: Record<Disposition, number>;
  consent_counts: Record<ConsentState, number>;
  suppression_counts: Record<SuppressionState, number>;
  corrected_crm_counts: CorrectedCrmCounts;
  manual_review_rows: number;
};

type NormalizedRow = {
  sourceId: string;
  sourceFileName: string;
  sourceClassification: ApprovedSource['classification'];
  sourceReadiness: string;
  sourceOwner: string;
  rowNumber: number;
  sheetLabel: string;
  headerKeys: string[];
  displayNameKey: string | null;
  emailKey: string | null;
  phoneKey: string | null;
  identityFingerprint: string | null;
  rowFingerprint: string;
  consentState: ConsentState;
  suppressionState: SuppressionState;
  explicitOptIn: boolean;
  explicitOptOut: boolean;
  activeLegacyUser: boolean;
  newSystemActivated: boolean;
  sourceTags: string[];
  audienceSignals: Set<string>;
};

type RowClassification = {
  row: NormalizedRow;
  disposition: Disposition;
  manualCategories: ManualReviewCategory[];
  crmStorageStatus: CrmStorageStatus;
  emailCampaignEligible: boolean;
  whatsappCampaignEligible: boolean;
  communicationEligible: boolean;
  matchedExisting: ExistingIdentitySnapshot | null;
};

type ParsedRecord = {
  source: ApprovedSource;
  rowNumber: number;
  sheetLabel: string;
  row: Record<string, string>;
  headerKeys: string[];
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

export type W12100SourcePreflightReport = {
  schema_version: 'onetime.w12_100_04.real_source_preflight.v1';
  lane_id: 'W12-100-04';
  generated_at: string;
  status: 'done' | 'blocked';
  blocked_reasons: string[];
  approved_scope: {
    source_files: number;
    one_time_rabbi_followers_sources: number;
    email_audience_sources: number;
    expected_naive_rows: number;
    approved_source_group_fingerprint: string;
  };
  validation: {
    source_dir_provided: boolean;
    source_dir_available: boolean;
    exact_filename_match_required: true;
    exact_hash_match_required: true;
    unapproved_supported_file_count: number;
    unapproved_supported_file_fingerprint_digest: string;
    source_results: SourceValidationResult[];
  };
  summary: {
    total_rows: number;
    expected_naive_rows: number;
    unique_identity_count: number;
    duplicate_identity_rows: number;
    disposition_counts: Record<Disposition, number>;
    w12_01_compatible_disposition_counts: {
      matched_existing_contact: number;
      stage_new_contact: number;
      duplicate_input: number;
      manual_review: number;
      no_op: number;
    };
    communication_eligible_rows: number;
    crm_importable: number;
    email_campaign_eligible: number;
    whatsapp_campaign_eligible: number;
    suppressed: number;
    invalid: number;
    duplicate: number;
    identity_conflict: number;
    quarantined: number;
    do_not_contact_rows: number;
    matched_existing_rows: number;
    staged_new_rows: number;
    no_op_rows: number;
    manual_review_rows: number;
  };
  source_summaries: SourceSummary[];
  manual_review_categories: Record<
    ManualReviewCategory,
    { count: number; row_fingerprint_set_digest: string }
  >;
  source_ownership_and_consent_blockers: {
    approved_operator_owned_sources: number;
    source_ownership_blockers: string[];
    consent_blocker_counts: {
      suppressed_or_opted_out: number;
      unknown_consent: number;
      channel_specific_consent_absent: number;
      conflicting_consent_or_suppression: number;
    };
  };
  consent_suppression_precedence: {
    applied_before_eligibility: true;
    precedence_order: string[];
  };
  excluded_sources_policy: {
    communications_exports_excluded: true;
    message_bodies_excluded: true;
    external_lead_lists_excluded: true;
    unknown_spreadsheets_excluded: true;
  };
  w12_01_import_contract_compatibility: {
    dry_run_tables_available: string[];
    source_kinds: Array<'csv_normalized' | 'xlsx_normalized'>;
    raw_row_contents_included: false;
    production_side_effects: false;
    database_writes_performed: false;
    apply_mode_implemented: false;
  };
  privacy_and_safety: {
    row_values_printed: false;
    emails_printed: false;
    phones_printed: false;
    names_printed: false;
    addresses_printed: false;
    notes_or_messages_printed: false;
    production_database_connected: false;
    production_database_read: false;
    database_writes_performed: false;
    external_actions_count: 0;
    provider_mutation_count: 0;
    production_mutation_count: 0;
    temporary_files_created: number;
    temporary_cleanup_performed: true;
  };
};

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.tsv', '.xlsx']);
const EMPTY_DIGEST = digestFingerprints([]);
const PRECEDENCE_ORDER = [
  'manual/legal suppression, abuse suppression, complaint, hard bounce, or provider suppression',
  'explicit unsubscribe, STOP, opt-out, or unsubscribed export',
  'private CRM storage allowed for owned valid contacts even when channel consent is unknown',
  'subscribed or opted-in source with no stronger suppression',
  'unknown consent blocks campaign audiences, not private CRM contact storage',
];

export async function runW12100SourcePreflight(
  options: RunW12100SourcePreflightOptions = {},
): Promise<W12100SourcePreflightReport> {
  const approvedSources = options.approvedSources ?? W12_100_04_APPROVED_SOURCES;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const cleanupPaths: string[] = [];
  const base = createBaseReport({
    generatedAt,
    approvedSources,
    sourceDirProvided: Boolean(options.sourceDir),
  });

  try {
    if (!options.sourceDir) {
      return block(base, 'BLOCKED_SANITIZED_SOURCE_PACKET_NOT_PROVIDED');
    }
    const sourceDirAvailable = await directoryExists(options.sourceDir);
    base.validation.source_dir_available = sourceDirAvailable;
    if (!sourceDirAvailable) {
      return block(base, 'BLOCKED_SANITIZED_SOURCE_PACKET_NOT_FOUND');
    }

    const validation = await validateApprovedFiles(options.sourceDir, approvedSources);
    base.validation.source_results = validation.sourceResults;
    base.validation.unapproved_supported_file_count = validation.unapprovedSupportedFileCount;
    base.validation.unapproved_supported_file_fingerprint_digest =
      validation.unapprovedSupportedFileFingerprintDigest;

    if (validation.blockedReasons.length) {
      return block(base, ...validation.blockedReasons);
    }

    const parsedRecords = (
      await Promise.all(
        approvedSources.map(async (source) =>
          parseApprovedSource(path.join(options.sourceDir as string, source.fileName), source),
        ),
      )
    ).flat();
    const normalizedRows = parsedRecords.map(normalizeParsedRecord);
    const rowClassifications = classifyRows(normalizedRows, options.existingIdentitySnapshot ?? []);
    applyClassifiedRows(base, approvedSources, rowClassifications);
    base.status = 'done';
    return base;
  } finally {
    await cleanupTemporaryPaths(cleanupPaths);
    base.privacy_and_safety.temporary_cleanup_performed = true;
  }
}

export function fingerprintIdentityForW12100(input: {
  email?: string | undefined;
  phone?: string | undefined;
}) {
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return null;
  return sha256(`w12-100-04-identity-v1\0${email ?? ''}\0${phone ?? ''}`);
}

export function fingerprintApprovedFileHashForW12100(sha256Value: string) {
  return sha256(`w12-100-04-approved-file-v1\0${sha256Value.toLowerCase()}`);
}

async function validateApprovedFiles(
  sourceDir: string,
  approvedSources: readonly ApprovedSource[],
) {
  const approvedNames = new Set(approvedSources.map((source) => source.fileName));
  const directoryEntries = await readdir(sourceDir, { withFileTypes: true });
  const fileNames = directoryEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const unapprovedSupportedFiles = fileNames.filter(
    (fileName) =>
      SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase()) &&
      !approvedNames.has(fileName),
  );
  const blockedReasons: string[] = [];
  if (unapprovedSupportedFiles.length) {
    blockedReasons.push('BLOCKED_UNAPPROVED_SOURCE_FILE_PRESENT');
  }

  const sourceResults: SourceValidationResult[] = [];
  for (const source of approvedSources) {
    const filePath = path.join(sourceDir, source.fileName);
    if (!fileNames.includes(source.fileName)) {
      blockedReasons.push(`BLOCKED_APPROVED_SOURCE_MISSING:${source.id}`);
      sourceResults.push({
        id: source.id,
        file_name: source.fileName,
        status: 'missing',
        expected_rows: source.expectedRows,
        expected_columns: source.expectedColumns,
        approved_hash_fingerprint: fingerprintApprovedFileHashForW12100(source.sha256),
        detected_hash_fingerprint: null,
      });
      continue;
    }
    const detectedSha256 = await sha256File(filePath);
    const detectedHashFingerprint = fingerprintApprovedFileHashForW12100(detectedSha256);
    if (detectedSha256.toLowerCase() !== source.sha256.toLowerCase()) {
      blockedReasons.push(`BLOCKED_APPROVED_SOURCE_HASH_MISMATCH:${source.id}`);
      sourceResults.push({
        id: source.id,
        file_name: source.fileName,
        status: 'hash_mismatch',
        expected_rows: source.expectedRows,
        expected_columns: source.expectedColumns,
        approved_hash_fingerprint: fingerprintApprovedFileHashForW12100(source.sha256),
        detected_hash_fingerprint: detectedHashFingerprint,
      });
      continue;
    }
    sourceResults.push({
      id: source.id,
      file_name: source.fileName,
      status: 'verified',
      expected_rows: source.expectedRows,
      expected_columns: source.expectedColumns,
      approved_hash_fingerprint: fingerprintApprovedFileHashForW12100(source.sha256),
      detected_hash_fingerprint: detectedHashFingerprint,
    });
  }
  return {
    blockedReasons: Array.from(new Set(blockedReasons)).sort(),
    sourceResults,
    unapprovedSupportedFileCount: unapprovedSupportedFiles.length,
    unapprovedSupportedFileFingerprintDigest: digestFingerprints(
      unapprovedSupportedFiles.map((fileName) =>
        sha256(`w12-100-04-unapproved-file-v1\0${path.extname(fileName).toLowerCase()}`),
      ),
    ),
  };
}

async function parseApprovedSource(
  filePath: string,
  source: ApprovedSource,
): Promise<ParsedRecord[]> {
  const extension = path.extname(source.fileName).toLowerCase();
  if (extension === '.csv' || extension === '.tsv') {
    const text = await readFile(filePath, 'utf8');
    return recordsFromDelimitedText(text, extension === '.tsv' ? '\t' : ',', source);
  }
  if (extension === '.xlsx') {
    return recordsFromXlsx(await readFile(filePath), source);
  }
  return [];
}

function recordsFromDelimitedText(
  text: string,
  delimiter: ',' | '\t',
  source: ApprovedSource,
): ParsedRecord[] {
  const rows = parseDelimitedRecords(text.replace(/^\uFEFF/, ''), delimiter);
  const header = rows.shift()?.map(normalizeHeader) ?? [];
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => cell.trim() !== ''))
    .map(({ row, index }) => ({
      source,
      rowNumber: index + 2,
      sheetLabel: delimiter === '\t' ? 'tsv' : 'csv',
      row: rowToObject(header, row),
      headerKeys: header,
    }));
}

function recordsFromXlsx(buffer: Buffer, source: ApprovedSource): ParsedRecord[] {
  const entries = readZipEntries(buffer);
  const entryMap = new Map(entries.map((entry) => [entry.name, readZipEntry(buffer, entry)]));
  const sharedStrings = parseSharedStrings(entryMap.get('xl/sharedStrings.xml')?.toString('utf8'));
  const workbookXml = entryMap.get('xl/workbook.xml')?.toString('utf8');
  const relsXml = entryMap.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbookXml || !relsXml) return [];
  const rels = parseWorkbookRelationships(relsXml);
  const sheets = parseWorkbookSheets(workbookXml);
  return sheets.flatMap((sheet) => {
    const target = rels.get(sheet.relationshipId);
    if (!target) return [];
    const sheetXml = entryMap.get(normalizeXlsxTarget(target))?.toString('utf8');
    if (!sheetXml) return [];
    return recordsFromWorksheetXml(sheet.name, sheetXml, sharedStrings, source);
  });
}

function recordsFromWorksheetXml(
  sheetName: string,
  sheetXml: string,
  sharedStrings: string[],
  source: ApprovedSource,
): ParsedRecord[] {
  const rows = Array.from(sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)).map((match) => {
    const rowNumber = Number(attr(match[1] ?? '', 'r') ?? 0);
    const cells = Array.from((match[2] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).map(
      (cellMatch) => ({
        ref: attr(cellMatch[1] ?? '', 'r') ?? '',
        value: cellValue(cellMatch[1] ?? '', cellMatch[2] ?? '', sharedStrings),
      }),
    );
    return { rowNumber, cells };
  });
  const firstRow = rows[0];
  const headerCells = firstRow?.cells ?? [];
  const header = headerCells.map((cell) => normalizeHeader(cell.value));
  return rows
    .slice(1)
    .filter((row) => row.cells.some((cell) => cell.value.trim() !== ''))
    .map((row, index) => ({
      source,
      rowNumber: row.rowNumber > 0 ? row.rowNumber : index + 2,
      sheetLabel: sheetName,
      row: rowToObject(header, materializeSparseRow(headerCells, row.cells)),
      headerKeys: header,
    }));
}

function normalizeParsedRecord(record: ParsedRecord): NormalizedRow {
  const emailValue = readCell(record.row, [
    'email',
    'email_address',
    'e_mail',
    'subscriber_email',
    'contact_email',
  ]);
  const phoneValue = readCell(record.row, ['phone', 'mobile', 'whatsapp', 'phone_number']);
  const firstName = readCell(record.row, ['first_name', 'firstname']);
  const lastName = readCell(record.row, ['last_name', 'lastname']);
  const displayName =
    readCell(record.row, ['display_name', 'contact_name', 'name', 'full_name']) ??
    [firstName, lastName].filter(Boolean).join(' ');
  const emailKey = emailValue ? normalizeEmail(emailValue) : null;
  const phoneKey = normalizePhone(phoneValue);
  const identityFingerprint = fingerprintIdentityForW12100({
    email: emailKey ?? undefined,
    phone: phoneKey ?? undefined,
  });
  const statusValues = [
    readCell(record.row, ['subscription_status', 'status', 'consent', 'suppression']),
    readCell(record.row, ['subscribed', 'unsubscribed', 'do_not_contact', 'suppressed']),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const statusText = statusValues.toLowerCase();
  const explicitOptOut =
    /unsubscribe|unsubscribed|opt.?out|stop|complaint|bounce|suppressed|do.?not.?contact/.test(
      statusText,
    );
  const explicitOptIn = /subscribed|opt.?in|active|consent(ed)?|yes|true/.test(statusText);
  const sourceForcesSuppression = record.source.readiness === 'suppression_precedence_source';
  const consentState: ConsentState = explicitOptOut
    ? 'opted_out'
    : explicitOptIn
      ? 'opted_in'
      : record.source.defaultConsentState;
  const suppressionState: SuppressionState =
    explicitOptOut || sourceForcesSuppression
      ? 'suppressed'
      : record.source.defaultSuppressionState;
  const sourceTags = tagsFor(record);
  const canonical = {
    source_id: record.source.id,
    source_file_fingerprint: fingerprintApprovedFileHashForW12100(record.source.sha256),
    row_number: record.rowNumber,
    sheet_label: record.sheetLabel,
    display_name_key: displayName.trim().toLowerCase() || null,
    email_key: emailKey,
    phone_key: phoneKey,
    consent_state: consentState,
    suppression_state: suppressionState,
    source_tags: sourceTags,
  };
  return {
    sourceId: record.source.id,
    sourceFileName: record.source.fileName,
    sourceClassification: record.source.classification,
    sourceReadiness: record.source.readiness,
    sourceOwner: record.source.sourceOwner,
    rowNumber: record.rowNumber,
    sheetLabel: record.sheetLabel,
    headerKeys: record.headerKeys,
    displayNameKey: displayName.trim().toLowerCase() || null,
    emailKey,
    phoneKey,
    identityFingerprint,
    rowFingerprint: sha256(JSON.stringify(canonical)),
    consentState,
    suppressionState,
    explicitOptIn,
    explicitOptOut,
    activeLegacyUser: /legacy|member|subscriber|follower|active/.test(sourceTags.join(' ')),
    newSystemActivated: toBoolean(
      readCell(record.row, ['new_system_activated', 'already_activated', 'activated']),
    ),
    sourceTags,
    audienceSignals: new Set(
      [...record.headerKeys, ...sourceTags].map((value) => value.toLowerCase()),
    ),
  };
}

function classifyRows(
  rows: NormalizedRow[],
  existingSnapshot: readonly ExistingIdentitySnapshot[],
): RowClassification[] {
  const existingByIdentity = new Map(
    existingSnapshot.map((snapshot) => [snapshot.identity_fingerprint, snapshot]),
  );
  const identityGroups = groupBy(
    rows.filter((row) => row.identityFingerprint),
    (row) => row.identityFingerprint as string,
  );
  const emailGroups = groupBy(
    rows.filter((row) => row.emailKey),
    (row) => row.emailKey as string,
  );
  const phoneGroups = groupBy(
    rows.filter((row) => row.phoneKey),
    (row) => row.phoneKey as string,
  );
  const nameGroups = groupBy(
    rows.filter((row) => row.displayNameKey && row.identityFingerprint),
    (row) => row.displayNameKey as string,
  );
  const firstIdentityRows = new Set<string>();
  const seenRowFingerprints = new Set<string>();

  return rows.map((row) => {
    const categories = new Set<ManualReviewCategory>();
    if (!row.emailKey && !row.phoneKey) categories.add('missing_email_and_missing_phone');
    const identityGroup = row.identityFingerprint
      ? (identityGroups.get(row.identityFingerprint) ?? [])
      : [];
    const duplicateIdentity = Boolean(row.identityFingerprint && identityGroup[0] !== row);
    const duplicateRow = seenRowFingerprints.has(row.rowFingerprint);
    seenRowFingerprints.add(row.rowFingerprint);
    if (duplicateIdentity || duplicateRow) categories.add('duplicate_input_same_identity');
    if (row.identityFingerprint && !duplicateIdentity)
      firstIdentityRows.add(row.identityFingerprint);
    if (row.emailKey && uniqueValues(emailGroups.get(row.emailKey) ?? [], 'phoneKey').length > 1) {
      categories.add('email_match_phone_conflict');
    }
    if (row.phoneKey && uniqueValues(phoneGroups.get(row.phoneKey) ?? [], 'emailKey').length > 1) {
      categories.add('phone_match_email_conflict');
    }
    if (row.displayNameKey) {
      const identitiesForName = uniqueValues(
        nameGroups.get(row.displayNameKey) ?? [],
        'identityFingerprint',
      );
      if (identitiesForName.length > 1) categories.add('same_name_different_identity');
    }
    if (
      identityGroup.some((entry) => entry.consentState === 'opted_in') &&
      identityGroup.some(
        (entry) => entry.consentState === 'opted_out' || entry.suppressionState === 'suppressed',
      )
    ) {
      categories.add('conflicting_consent_or_suppression');
    }
    // Unknown campaign consent is not a private CRM storage blocker.
    if (
      hasSignal(row, ['pipeline', 'opportunity', 'stage']) &&
      !hasSignal(row, ['family', 'school'])
    ) {
      categories.add('pipeline_stage_ambiguous');
    }
    if (hasSignal(row, ['school']) && hasSignal(row, ['family'])) {
      categories.add('school_vs_family_classification_ambiguous');
    }
    if (
      hasSignal(row, ['household']) &&
      hasSignal(row, ['guardian']) &&
      hasSignal(row, ['ambiguous'])
    ) {
      categories.add('household_guardian_role_ambiguous');
    }
    if (hasSignal(row, ['learner', 'student']) && !hasSignal(row, ['guardian', 'parent'])) {
      categories.add('learner_without_guardian');
    }
    if (hasSignal(row, ['minor', 'student', 'learner'])) {
      categories.add('minor_or_student_safety_unclear');
    }
    if (!/operator local Downloads/i.test(row.sourceOwner)) {
      categories.add('source_ownership_unclear');
    }
    if (row.sourceClassification === 'external_lead_list') {
      categories.add('external_lead_source_requires_operator_approval');
    }
    if (
      row.sourceClassification === 'communications_export' ||
      hasSignal(row, [
        'message_body',
        'private_message',
        'sms_body',
        'call_log',
        'communication_log',
      ])
    ) {
      categories.add('private_message_or_note_requires_exclusion');
    }
    const matchedExisting = row.identityFingerprint
      ? (existingByIdentity.get(row.identityFingerprint) ?? null)
      : null;
    if (
      matchedExisting &&
      ((matchedExisting.suppression_state === 'suppressed' && row.consentState === 'opted_in') ||
        row.newSystemActivated !== Boolean(matchedExisting.new_system_activated))
    ) {
      categories.add('existing_production_record_conflict');
    }

    const manualCategories = Array.from(categories).sort() as ManualReviewCategory[];
    const identityConflict = hasIdentityConflictCategory(manualCategories);
    const quarantined = hasQuarantineCategory(manualCategories);
    const invalid = !row.identityFingerprint;
    let crmStorageStatus: CrmStorageStatus = 'crm_importable';
    if (invalid) crmStorageStatus = 'invalid';
    else if (duplicateIdentity || duplicateRow) crmStorageStatus = 'duplicate';
    else if (identityConflict) crmStorageStatus = 'identity_conflict';
    else if (quarantined) crmStorageStatus = 'quarantined';

    const contactStorageAllowed = crmStorageStatus === 'crm_importable';
    const emailCampaignEligible =
      row.consentState === 'opted_in' &&
      row.suppressionState === 'active' &&
      Boolean(row.emailKey) &&
      contactStorageAllowed &&
      !matchedExisting?.new_system_activated;
    const whatsappCampaignEligible =
      row.consentState === 'opted_in' &&
      row.suppressionState === 'active' &&
      Boolean(row.phoneKey) &&
      hasWhatsappConsentSignal(row) &&
      contactStorageAllowed &&
      !matchedExisting?.new_system_activated;
    const communicationEligible = emailCampaignEligible || whatsappCampaignEligible;

    let disposition: Disposition;
    if (crmStorageStatus === 'duplicate') {
      disposition = 'duplicate_input';
    } else if (crmStorageStatus !== 'crm_importable') {
      disposition = 'manual_review';
    } else if (matchedExisting?.new_system_activated || matchedExisting?.no_op) {
      disposition = 'no_op';
    } else if (matchedExisting) {
      disposition = 'matched_existing_contact';
    } else {
      disposition = 'stage_new_contact';
    }
    return {
      row,
      disposition,
      manualCategories,
      crmStorageStatus,
      emailCampaignEligible,
      whatsappCampaignEligible,
      communicationEligible,
      matchedExisting,
    };
  });
}

function hasIdentityConflictCategory(categories: readonly ManualReviewCategory[]) {
  return categories.some((category) =>
    [
      'email_match_phone_conflict',
      'phone_match_email_conflict',
      'same_name_different_identity',
      'conflicting_consent_or_suppression',
      'existing_production_record_conflict',
    ].includes(category),
  );
}

function hasQuarantineCategory(categories: readonly ManualReviewCategory[]) {
  return categories.some((category) =>
    [
      'pipeline_stage_ambiguous',
      'school_vs_family_classification_ambiguous',
      'household_guardian_role_ambiguous',
      'learner_without_guardian',
      'minor_or_student_safety_unclear',
      'source_ownership_unclear',
      'external_lead_source_requires_operator_approval',
      'private_message_or_note_requires_exclusion',
    ].includes(category),
  );
}

function hasWhatsappConsentSignal(row: NormalizedRow) {
  return row.explicitOptIn && hasSignal(row, ['whatsapp']);
}

function applyClassifiedRows(
  report: W12100SourcePreflightReport,
  approvedSources: readonly ApprovedSource[],
  classifications: RowClassification[],
) {
  report.summary.total_rows = classifications.length;
  report.summary.expected_naive_rows = approvedSources.reduce(
    (sum, source) => sum + source.expectedRows,
    0,
  );
  report.summary.unique_identity_count = new Set(
    classifications
      .map((classification) => classification.row.identityFingerprint)
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
  ).size;
  report.summary.duplicate_identity_rows = classifications.filter((classification) =>
    classification.manualCategories.includes('duplicate_input_same_identity'),
  ).length;
  report.summary.communication_eligible_rows = classifications.filter(
    (classification) => classification.communicationEligible,
  ).length;
  report.summary.crm_importable = classifications.filter(
    (classification) => classification.crmStorageStatus === 'crm_importable',
  ).length;
  report.summary.email_campaign_eligible = classifications.filter(
    (classification) => classification.emailCampaignEligible,
  ).length;
  report.summary.whatsapp_campaign_eligible = classifications.filter(
    (classification) => classification.whatsappCampaignEligible,
  ).length;
  report.summary.suppressed = classifications.filter(
    (classification) =>
      classification.row.suppressionState === 'suppressed' ||
      classification.row.consentState === 'opted_out',
  ).length;
  report.summary.invalid = classifications.filter(
    (classification) => classification.crmStorageStatus === 'invalid',
  ).length;
  report.summary.duplicate = classifications.filter(
    (classification) => classification.crmStorageStatus === 'duplicate',
  ).length;
  report.summary.identity_conflict = classifications.filter(
    (classification) => classification.crmStorageStatus === 'identity_conflict',
  ).length;
  report.summary.quarantined = classifications.filter(
    (classification) => classification.crmStorageStatus === 'quarantined',
  ).length;
  report.summary.do_not_contact_rows = classifications.filter(
    (classification) =>
      classification.row.suppressionState === 'suppressed' ||
      classification.row.consentState === 'opted_out',
  ).length;
  for (const classification of classifications) {
    addCount(report.summary.disposition_counts, classification.disposition);
  }
  report.summary.matched_existing_rows = report.summary.disposition_counts.matched_existing_contact;
  report.summary.staged_new_rows = report.summary.disposition_counts.stage_new_contact;
  report.summary.no_op_rows = report.summary.disposition_counts.no_op;
  report.summary.manual_review_rows = report.summary.disposition_counts.manual_review;
  report.summary.w12_01_compatible_disposition_counts = {
    matched_existing_contact: report.summary.disposition_counts.matched_existing_contact,
    stage_new_contact: report.summary.disposition_counts.stage_new_contact,
    duplicate_input: report.summary.disposition_counts.duplicate_input,
    manual_review: report.summary.disposition_counts.manual_review,
    no_op: report.summary.disposition_counts.no_op,
  };

  for (const source of approvedSources) {
    const sourceRows = classifications.filter(
      (classification) => classification.row.sourceId === source.id,
    );
    report.source_summaries.push(summarizeSource(source, sourceRows));
  }

  for (const category of W12_100_04_MANUAL_REVIEW_CATEGORIES) {
    const fingerprints = classifications
      .filter((classification) => classification.manualCategories.includes(category))
      .map((classification) => classification.row.rowFingerprint);
    report.manual_review_categories[category] = {
      count: fingerprints.length,
      row_fingerprint_set_digest: digestFingerprints(fingerprints),
    };
  }
  report.source_ownership_and_consent_blockers.consent_blocker_counts = {
    suppressed_or_opted_out: report.summary.do_not_contact_rows,
    unknown_consent: classifications.filter(
      (classification) => classification.row.consentState === 'unknown',
    ).length,
    channel_specific_consent_absent: classifications.filter(
      (classification) => classification.row.consentState !== 'opted_in',
    ).length,
    conflicting_consent_or_suppression:
      report.manual_review_categories.conflicting_consent_or_suppression.count,
  };
}

function summarizeSource(
  source: ApprovedSource,
  classifications: RowClassification[],
): SourceSummary {
  const dispositionCounts = emptyDispositionCounts();
  const consentCounts = emptyConsentCounts();
  const suppressionCounts = emptySuppressionCounts();
  for (const classification of classifications) {
    addCount(dispositionCounts, classification.disposition);
    addCount(consentCounts, classification.row.consentState);
    addCount(suppressionCounts, classification.row.suppressionState);
  }
  return {
    id: source.id,
    file_name: source.fileName,
    classification: source.classification,
    readiness: source.readiness,
    source_owner: source.sourceOwner,
    file_fingerprint: fingerprintApprovedFileHashForW12100(source.sha256),
    expected_rows: source.expectedRows,
    observed_rows: classifications.length,
    expected_columns: source.expectedColumns,
    observed_column_count: classifications[0]?.row.headerKeys.length ?? 0,
    row_fingerprint_set_digest: digestFingerprints(
      classifications.map((classification) => classification.row.rowFingerprint),
    ),
    identity_fingerprint_set_digest: digestFingerprints(
      classifications
        .map((classification) => classification.row.identityFingerprint)
        .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
    ),
    disposition_counts: dispositionCounts,
    consent_counts: consentCounts,
    suppression_counts: suppressionCounts,
    corrected_crm_counts: correctedCrmCounts(classifications),
    manual_review_rows: classifications.filter(
      (classification) => classification.disposition === 'manual_review',
    ).length,
  };
}

function correctedCrmCounts(classifications: RowClassification[]): CorrectedCrmCounts {
  return {
    crm_importable: classifications.filter(
      (classification) => classification.crmStorageStatus === 'crm_importable',
    ).length,
    email_campaign_eligible: classifications.filter(
      (classification) => classification.emailCampaignEligible,
    ).length,
    whatsapp_campaign_eligible: classifications.filter(
      (classification) => classification.whatsappCampaignEligible,
    ).length,
    suppressed: classifications.filter(
      (classification) =>
        classification.row.suppressionState === 'suppressed' ||
        classification.row.consentState === 'opted_out',
    ).length,
    invalid: classifications.filter(
      (classification) => classification.crmStorageStatus === 'invalid',
    ).length,
    duplicate: classifications.filter(
      (classification) => classification.crmStorageStatus === 'duplicate',
    ).length,
    identity_conflict: classifications.filter(
      (classification) => classification.crmStorageStatus === 'identity_conflict',
    ).length,
    quarantined: classifications.filter(
      (classification) => classification.crmStorageStatus === 'quarantined',
    ).length,
  };
}

function createBaseReport(input: {
  generatedAt: string;
  approvedSources: readonly ApprovedSource[];
  sourceDirProvided: boolean;
}): W12100SourcePreflightReport {
  const expectedRows = input.approvedSources.reduce((sum, source) => sum + source.expectedRows, 0);
  return {
    schema_version: 'onetime.w12_100_04.real_source_preflight.v1',
    lane_id: 'W12-100-04',
    generated_at: input.generatedAt,
    status: 'blocked',
    blocked_reasons: [],
    approved_scope: {
      source_files: input.approvedSources.length,
      one_time_rabbi_followers_sources: input.approvedSources.filter(
        (source) => source.classification === 'one_time_rabbi_scheller_followers',
      ).length,
      email_audience_sources: input.approvedSources.filter(
        (source) => source.classification === 'email_audience_export',
      ).length,
      expected_naive_rows: expectedRows,
      approved_source_group_fingerprint: digestFingerprints(
        input.approvedSources.map((source) =>
          sha256(`${source.id}\0${source.fileName}\0${source.sha256}\0${source.expectedRows}`),
        ),
      ),
    },
    validation: {
      source_dir_provided: input.sourceDirProvided,
      source_dir_available: false,
      exact_filename_match_required: true,
      exact_hash_match_required: true,
      unapproved_supported_file_count: 0,
      unapproved_supported_file_fingerprint_digest: EMPTY_DIGEST,
      source_results: input.approvedSources.map((source) => ({
        id: source.id,
        file_name: source.fileName,
        status: 'missing',
        expected_rows: source.expectedRows,
        expected_columns: source.expectedColumns,
        approved_hash_fingerprint: fingerprintApprovedFileHashForW12100(source.sha256),
        detected_hash_fingerprint: null,
      })),
    },
    summary: {
      total_rows: 0,
      expected_naive_rows: expectedRows,
      unique_identity_count: 0,
      duplicate_identity_rows: 0,
      disposition_counts: emptyDispositionCounts(),
      w12_01_compatible_disposition_counts: {
        matched_existing_contact: 0,
        stage_new_contact: 0,
        duplicate_input: 0,
        manual_review: 0,
        no_op: 0,
      },
      communication_eligible_rows: 0,
      crm_importable: 0,
      email_campaign_eligible: 0,
      whatsapp_campaign_eligible: 0,
      suppressed: 0,
      invalid: 0,
      duplicate: 0,
      identity_conflict: 0,
      quarantined: 0,
      do_not_contact_rows: 0,
      matched_existing_rows: 0,
      staged_new_rows: 0,
      no_op_rows: 0,
      manual_review_rows: 0,
    },
    source_summaries: [],
    manual_review_categories: emptyManualReviewCategories(),
    source_ownership_and_consent_blockers: {
      approved_operator_owned_sources: input.approvedSources.filter((source) =>
        /operator local Downloads/i.test(source.sourceOwner),
      ).length,
      source_ownership_blockers: [],
      consent_blocker_counts: {
        suppressed_or_opted_out: 0,
        unknown_consent: 0,
        channel_specific_consent_absent: 0,
        conflicting_consent_or_suppression: 0,
      },
    },
    consent_suppression_precedence: {
      applied_before_eligibility: true,
      precedence_order: PRECEDENCE_ORDER,
    },
    excluded_sources_policy: {
      communications_exports_excluded: true,
      message_bodies_excluded: true,
      external_lead_lists_excluded: true,
      unknown_spreadsheets_excluded: true,
    },
    w12_01_import_contract_compatibility: {
      dry_run_tables_available: [
        'onetime.legacy_audience_import_batches',
        'onetime.legacy_audience_import_rows',
        'onetime.legacy_audience_match_candidates',
        'onetime.legacy_audience_segment_snapshots',
        'onetime.legacy_audience_rollback_records',
        'onetime.legacy_audience_audit_events',
      ],
      source_kinds: Array.from(
        new Set(
          input.approvedSources.map((source) =>
            path.extname(source.fileName).toLowerCase() === '.xlsx'
              ? 'xlsx_normalized'
              : 'csv_normalized',
          ),
        ),
      ),
      raw_row_contents_included: false,
      production_side_effects: false,
      database_writes_performed: false,
      apply_mode_implemented: false,
    },
    privacy_and_safety: {
      row_values_printed: false,
      emails_printed: false,
      phones_printed: false,
      names_printed: false,
      addresses_printed: false,
      notes_or_messages_printed: false,
      production_database_connected: false,
      production_database_read: false,
      database_writes_performed: false,
      external_actions_count: 0,
      provider_mutation_count: 0,
      production_mutation_count: 0,
      temporary_files_created: 0,
      temporary_cleanup_performed: true,
    },
  };
}

function block(report: W12100SourcePreflightReport, ...reasons: string[]) {
  report.status = 'blocked';
  report.blocked_reasons = Array.from(new Set([...report.blocked_reasons, ...reasons])).sort();
  if (report.validation.unapproved_supported_file_count > 0) {
    report.source_ownership_and_consent_blockers.source_ownership_blockers.push(
      'unapproved_supported_files_present',
    );
  }
  return report;
}

function emptyManualReviewCategories() {
  return Object.fromEntries(
    W12_100_04_MANUAL_REVIEW_CATEGORIES.map((category) => [
      category,
      { count: 0, row_fingerprint_set_digest: EMPTY_DIGEST },
    ]),
  ) as W12100SourcePreflightReport['manual_review_categories'];
}

function emptyDispositionCounts(): Record<Disposition, number> {
  return {
    matched_existing_contact: 0,
    stage_new_contact: 0,
    duplicate_input: 0,
    no_op: 0,
    manual_review: 0,
  };
}

function emptyConsentCounts(): Record<ConsentState, number> {
  return { opted_in: 0, opted_out: 0, unknown: 0 };
}

function emptySuppressionCounts(): Record<SuppressionState, number> {
  return { active: 0, suppressed: 0, unknown: 0 };
}

function parseDelimitedRecords(input: string, delimiter: ',' | '\t') {
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
        cell += char ?? '';
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char ?? '';
    }
  }
  row.push(cell);
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows;
}

function rowToObject(header: string[], row: string[]) {
  const object: Record<string, string> = {};
  header.forEach((name, index) => {
    const key = name || `column_${index + 1}`;
    object[key] = row[index] ?? '';
  });
  return object;
}

function materializeSparseRow(
  headerCells: Array<{ ref: string; value: string }>,
  cells: Array<{ ref: string; value: string }>,
) {
  const maxColumns = Math.max(
    headerCells.length,
    ...cells.map((cell) => columnIndex(cell.ref) + 1),
  );
  const row = Array.from({ length: maxColumns }, () => '');
  for (const cell of cells) {
    const index = columnIndex(cell.ref);
    if (index >= 0) row[index] = cell.value;
  }
  return row;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`bad local header for ${entry.name}`);
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return data;
  if (entry.compressionMethod === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.compressionMethod}`);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('missing zip directory');
}

function parseSharedStrings(xml?: string) {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) =>
    Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1] ?? ''))
      .join(''),
  );
}

function parseWorkbookRelationships(xml: string) {
  const rels = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = match[1] ?? '';
    const id = attr(attrs, 'Id');
    const target = attr(attrs, 'Target');
    if (id && target) rels.set(id, target);
  }
  return rels;
}

function parseWorkbookSheets(xml: string) {
  return Array.from(xml.matchAll(/<sheet\b([^>]*)\/?>/g)).flatMap((match) => {
    const attrs = match[1] ?? '';
    const name = attr(attrs, 'name');
    const relationshipId = attr(attrs, 'r:id');
    return name && relationshipId ? [{ name: decodeXml(name), relationshipId }] : [];
  });
}

function normalizeXlsxTarget(target: string) {
  const normalized = target.replace(/^\/+/, '');
  if (normalized.startsWith('xl/')) return normalized;
  return path.posix.normalize(`xl/${normalized}`).replace(/\\/g, '/');
}

function cellValue(attrs: string, body: string, sharedStrings: string[]) {
  const type = attr(attrs, 't');
  if (type === 's') {
    const index = Number(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? -1);
    return Number.isInteger(index) ? (sharedStrings[index] ?? '') : '';
  }
  if (type === 'inlineStr') {
    return decodeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '');
  }
  return decodeXml(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? '');
}

function attr(attrs: string, name: string) {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return attrs.match(new RegExp(`${escaped}="([^"]*)"`))?.[1] ?? null;
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? '';
  if (!letters) return -1;
  return letters.split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function readCell(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    for (const [rawKey, value] of Object.entries(row)) {
      if (normalizeHeader(rawKey) === normalizedKey) return value.trim() || undefined;
    }
  }
  return undefined;
}

function tagsFor(record: ParsedRecord) {
  const tags = new Set<string>();
  tags.add(record.source.classification.replace(/[^a-z0-9]+/g, '_'));
  const joinedHeaders = record.headerKeys.join(' ');
  for (const signal of [
    'family',
    'school',
    'household',
    'guardian',
    'parent',
    'learner',
    'student',
    'member',
    'subscriber',
    'follower',
    'legacy',
    'pipeline',
    'opportunity',
    'stage',
    'communication_log',
  ]) {
    if (joinedHeaders.includes(signal)) tags.add(signal);
  }
  const rawTags = readCell(record.row, ['source_tags', 'tags', 'classification', 'audience']);
  for (const tag of (rawTags ?? '').split(/[;,]/)) {
    const normalized = normalizeHeader(tag);
    if (normalized) tags.add(normalized);
  }
  return Array.from(tags).sort();
}

function hasSignal(row: NormalizedRow, signals: string[]) {
  return signals.some((signal) => row.audienceSignals.has(normalizeHeader(signal)));
}

function normalizeHeader(value: string) {
  return decodeXml(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function toBoolean(value?: string) {
  const normalized = value?.toLowerCase();
  return (
    normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'active'
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function uniqueValues<T, K extends keyof T>(items: T[], key: K) {
  return Array.from(
    new Set(
      items
        .map((item) => item[key])
        .filter((value): value is NonNullable<T[K]> => value !== null && value !== undefined),
    ),
  );
}

function addCount<T extends string>(counts: Record<T, number>, key: T) {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function directoryExists(directory: string) {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function cleanupTemporaryPaths(paths: string[]) {
  await Promise.all(paths.map((entry) => rm(entry, { recursive: true, force: true })));
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function digestFingerprints(fingerprints: string[]) {
  return sha256(fingerprints.slice().sort().join('\0'));
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

async function loadExistingSnapshot(filePath?: string) {
  if (!filePath) return [];
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('--existing-snapshot must point to a JSON array.');
  return parsed.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('existing snapshot entries must be objects.');
    }
    const record = entry as Record<string, unknown>;
    const snapshot: ExistingIdentitySnapshot = {
      identity_fingerprint: String(record.identity_fingerprint ?? ''),
      contact_fingerprint: String(record.contact_fingerprint ?? ''),
      new_system_activated: Boolean(record.new_system_activated),
      no_op: Boolean(record.no_op),
    };
    if (record.suppression_state) {
      snapshot.suppression_state = record.suppression_state as SuppressionState;
    }
    return snapshot;
  });
}

function parseArgs(argv: string[]) {
  const parsed: {
    sourceDir?: string;
    out?: string;
    existingSnapshot?: string;
    applyRequested: boolean;
  } = { applyRequested: false };
  for (const arg of argv) {
    if (arg.startsWith('--source-dir=')) parsed.sourceDir = arg.slice('--source-dir='.length);
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length);
    else if (arg.startsWith('--existing-snapshot=')) {
      parsed.existingSnapshot = arg.slice('--existing-snapshot='.length);
    } else if (arg === '--apply' || arg.startsWith('--mode=apply')) {
      parsed.applyRequested = true;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existingIdentitySnapshot = await loadExistingSnapshot(args.existingSnapshot);
  const report = args.applyRequested
    ? block(
        createBaseReport({
          generatedAt: new Date().toISOString(),
          approvedSources: W12_100_04_APPROVED_SOURCES,
          sourceDirProvided: Boolean(args.sourceDir),
        }),
        'BLOCKED_APPLY_MODE_NOT_IMPLEMENTED_IN_W12_100_04',
      )
    : await runW12100SourcePreflight({
        sourceDir: args.sourceDir,
        existingIdentitySnapshot,
      });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
