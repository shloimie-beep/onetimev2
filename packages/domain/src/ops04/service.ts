import { createHash, createHmac } from 'node:crypto';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import {
  ops04CanonicalizationVersion,
  ops04DryRunReportSchema,
  ops04DryRunRequestSchema,
  ops04MappingVersion,
  ops04TaskId,
  type Ops04ActionType,
  type Ops04ApplyReceipt,
  type Ops04ChannelSnapshot,
  type Ops04ConsentState,
  type Ops04DryRunReport,
  type Ops04DryRunRequest,
  type Ops04ExistingContact,
  type Ops04PrimaryDisposition,
  type Ops04QuarantineReason,
  type Ops04RowOutcome,
  type Ops04SourceFile,
  type Ops04SuppressionState,
  type Ops04SyntheticRow,
} from '../../../contracts/src/ops04/index.ts';

type NormalizedPhone = {
  status: Ops04RowOutcome['normalized_phone_status'];
  e164: string | null;
};

type NormalizedRow = {
  parsed: Ops04SyntheticRow;
  sourceSheet: string | null;
  email: string | null;
  phone: NormalizedPhone;
  oldExternalIds: string[];
  rowVersionSha256: string;
  rowHmac: string;
  rowVersionKey: string;
  decisionKey: string;
};

type IndexedContacts = {
  byOldId: Map<string, Ops04ExistingContact[]>;
  byEmail: Map<string, Ops04ExistingContact[]>;
  byPhone: Map<string, Ops04ExistingContact[]>;
};

type MatchResult = {
  matched: Ops04ExistingContact | null;
  candidates: Ops04ExistingContact[];
  reasons: Ops04QuarantineReason[];
};

const SYNTHETIC_HMAC_KEY = 'ops04-synthetic-hmac-key-v1';
const FUTURE_SEND_BLOCKED_REASON = 'OPS-04 dry run and rehearsals never authorize sends.';

export function createOps04DryRun(input: Ops04DryRunRequest): Ops04DryRunReport {
  const request = ops04DryRunRequestSchema.parse(input);
  const hmacKey = hmacKeyFor(request);
  const manifestSha256 = sha256(canonicalJson(request.source_files));
  const mappingSha256 = sha256(
    canonicalJson({
      mapping_version: ops04MappingVersion,
      canonicalization_version: ops04CanonicalizationVersion,
    }),
  );
  const databaseSnapshotKey = stableKey('ops04_snapshot', [
    request.account_key,
    request.product_key,
    hmacDigest(hmacKey, canonicalJson(snapshotFacts(request.existing_contacts, hmacKey))),
  ]);
  const batchKey = stableKey('ops04_batch', [
    request.account_key,
    request.product_key,
    request.operator_idempotency_key,
    manifestSha256,
    mappingSha256,
    databaseSnapshotKey,
  ]);
  const indexedContacts = indexContacts(request.existing_contacts);
  const seenRowVersions = new Map<string, number>();
  const rows = request.rows.map((row) => {
    const normalized = normalizeRow(row, request.source_files, hmacKey, batchKey);
    const occurrenceCount = seenRowVersions.get(normalized.rowVersionSha256) ?? 0;
    seenRowVersions.set(normalized.rowVersionSha256, occurrenceCount + 1);
    return classifyRow({
      normalized,
      hmacKey,
      match: matchRow(normalized, indexedContacts),
      duplicateOccurrence: occurrenceCount > 0,
    });
  });
  const totals = summarize(request.source_files, rows);
  const generatedAt = request.now ?? '2026-07-16T00:00:00.000Z';
  const reportBase = {
    task_id: ops04TaskId,
    batch_key: batchKey,
    manifest_sha256: manifestSha256,
    mapping_sha256: mappingSha256,
    database_snapshot_key: databaseSnapshotKey,
    generated_at: generatedAt,
    source_files: request.source_files,
    rows,
    totals,
    approval_status: 'absent' as const,
    production_import_authorized: false as const,
    campaign_send_authorized: false as const,
    raw_row_contents_included: false as const,
    sends_allowed: false as const,
  };
  const dryRunHash = sha256(
    canonicalJson({
      batch_key: batchKey,
      manifest_sha256: manifestSha256,
      mapping_sha256: mappingSha256,
      database_snapshot_key: databaseSnapshotKey,
      rows,
      totals,
    }),
  );
  return ops04DryRunReportSchema.parse({ ...reportBase, dry_run_hash: dryRunHash });
}

export function createOps04ApplyReceipt(input: {
  report: Ops04DryRunReport;
  actor: string;
  now?: Date;
  expiresInMinutes?: number;
  mode?: Ops04ApplyReceipt['mode'];
}): Ops04ApplyReceipt {
  const report = ops04DryRunReportSchema.parse(input.report);
  const now = input.now ?? new Date('2026-07-16T00:00:00.000Z');
  const expiresAt = new Date(
    now.getTime() + (input.expiresInMinutes ?? 30) * 60 * 1000,
  ).toISOString();
  return {
    task_id: ops04TaskId,
    mode: input.mode ?? 'synthetic_rehearsal',
    batch_key: report.batch_key,
    manifest_sha256: report.manifest_sha256,
    mapping_sha256: report.mapping_sha256,
    database_snapshot_key: report.database_snapshot_key,
    dry_run_hash: report.dry_run_hash,
    approved_counts: { ...report.totals.actions },
    actor: input.actor,
    expires_at: expiresAt,
    import_approval_does_not_authorize_send: true,
  };
}

export function formatOps04DryRunMarkdown(report: Ops04DryRunReport) {
  const parsed = ops04DryRunReportSchema.parse(report);
  const lines = [
    '# OPS-04 dry-run reconciliation',
    '',
    `task_id: ${parsed.task_id}`,
    `batch_key: ${parsed.batch_key}`,
    `dry_run_hash: ${parsed.dry_run_hash}`,
    `manifest_sha256: ${parsed.manifest_sha256}`,
    `mapping_sha256: ${parsed.mapping_sha256}`,
    `database_snapshot_key: ${parsed.database_snapshot_key}`,
    `approval_status: ${parsed.approval_status}`,
    `production_import_authorized: ${parsed.production_import_authorized}`,
    `campaign_send_authorized: ${parsed.campaign_send_authorized}`,
    `sends_allowed: ${parsed.sends_allowed}`,
    `raw_row_contents_included: ${parsed.raw_row_contents_included}`,
    '',
    '## Rows',
    ...formatCounts(parsed.totals.rows),
    '',
    '## Actions',
    ...formatCounts(parsed.totals.actions),
    '',
    '## Outreach',
    ...formatCounts(parsed.totals.outreach),
    '',
    `equations_balanced: ${parsed.totals.equations_balanced}`,
    '',
    FUTURE_SEND_BLOCKED_REASON,
  ];
  return `${lines.join('\n')}\n`;
}

export function createSyntheticOps04Fixture(): Ops04DryRunRequest {
  const sourceFile = syntheticSourceFile();
  return {
    account_key: 'acct_ops04_synthetic',
    product_key: 'prod_ops04_synthetic',
    operator_idempotency_key: 'ops04-synthetic-rehearsal-001',
    mode: 'synthetic',
    source_files: [sourceFile],
    existing_contacts: syntheticExistingContacts(),
    rows: syntheticRows(),
    now: '2026-07-16T00:00:00.000Z',
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortCanonical(value));
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${sha256(parts.join('\0')).slice(0, 24)}`;
}

export function hmacDigest(key: string, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function normalizeOps04Email(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

export function normalizeOps04Phone(phone: string, region = ''): NormalizedPhone {
  const trimmed = phone.trim();
  if (!trimmed) return { status: 'missing', e164: null };
  const digits = trimmed.replace(/\D+/g, '');
  const normalizedRegion = region.trim().toUpperCase();
  let candidate = trimmed;
  let country: CountryCode | undefined;
  if (trimmed.startsWith('00') && digits.length > 2) {
    candidate = `+${digits.slice(2)}`;
  } else if (trimmed.startsWith('+')) {
    candidate = `+${digits}`;
  } else if (normalizedRegion) {
    country = normalizedRegion as CountryCode;
  } else if (digits.startsWith('0')) {
    return { status: 'ambiguous_local_phone', e164: null };
  } else if (digits.startsWith('972') || digits.length > 10) {
    candidate = `+${digits}`;
  } else {
    return { status: 'invalid', e164: null };
  }

  const parsed = parsePhoneNumberFromString(candidate, country);
  if (!parsed?.isValid()) return { status: 'invalid', e164: null };
  return { status: 'valid', e164: parsed.number };
}

function hmacKeyFor(request: Ops04DryRunRequest) {
  if (request.mode === 'authorized' && !request.hmac_key) {
    throw new Error('OPS-04 authorized mode requires an HMAC key before row access.');
  }
  return request.hmac_key ?? SYNTHETIC_HMAC_KEY;
}

function normalizeRow(
  row: Ops04SyntheticRow,
  sourceFiles: Ops04SourceFile[],
  hmacKey: string,
  batchKey: string,
): NormalizedRow {
  const parsed = row;
  const sourceFile = sourceFiles[0];
  if (!sourceFile) throw new Error('OPS-04 dry run requires at least one source file.');
  const sourceSheet = parsed.source_sheet ?? null;
  const email = normalizeOps04Email(parsed.email);
  const phone = normalizeOps04Phone(parsed.phone, parsed.phone_region);
  const oldExternalIds = [
    parsed.source_stable_id,
    parsed.old_user_id,
    parsed.old_subscription_id,
  ].filter((value): value is string => Boolean(value.trim()));
  const canonical = {
    source_file_sha256: sourceFile.file_sha256,
    source_sheet: sourceSheet,
    source_stable_id: parsed.source_stable_id.trim(),
    display_name_key: parsed.display_name.trim().toLowerCase(),
    email,
    phone: phone.e164,
    phone_status: phone.status,
    audience_type: parsed.audience_type,
    explicit_relationship: parsed.explicit_relationship,
    old_user_id: parsed.old_user_id.trim(),
    old_subscription_id: parsed.old_subscription_id.trim(),
    legacy_membership_state: parsed.legacy_membership_state,
    active_old_app_user: parsed.active_old_app_user,
    lead_state: parsed.lead_state,
    current_subscriber_state: parsed.current_subscriber_state,
    existing_migration_state: parsed.existing_migration_state,
    email_consent_state: parsed.email_consent_state,
    whatsapp_consent_state: parsed.whatsapp_consent_state,
    email_suppression_state: parsed.email_suppression_state,
    whatsapp_suppression_state: parsed.whatsapp_suppression_state,
    source_status: parsed.source_status.trim().toLowerCase(),
    source_tags: parsed.source_tags.map((tag) => tag.toLowerCase()).sort(),
  };
  const rowVersionSha256 = sha256(canonicalJson(canonical));
  return {
    parsed,
    sourceSheet,
    email,
    phone,
    oldExternalIds,
    rowVersionSha256,
    rowHmac: hmacDigest(hmacKey, canonicalJson(canonical)),
    rowVersionKey: stableKey('ops04_row', [batchKey, rowVersionSha256]),
    decisionKey: stableKey('ops04_decision', [batchKey, rowVersionSha256]),
  };
}

function classifyRow(input: {
  normalized: NormalizedRow;
  hmacKey: string;
  match: MatchResult;
  duplicateOccurrence: boolean;
}): Ops04RowOutcome {
  const row = input.normalized.parsed;
  const facts = independentFacts(row);
  const quarantineReasons = uniqueReasons([
    ...input.match.reasons,
    ...rowLevelReasons(input.normalized),
  ]);
  const matched = input.match.matched;
  const emailSuppression = strongestSuppression(
    row.email_suppression_state,
    matched?.email_suppression_state ?? 'none',
  );
  const whatsappSuppression = strongestSuppression(
    row.whatsapp_suppression_state,
    matched?.whatsapp_suppression_state ?? 'none',
  );
  const channelSnapshots = {
    email: channelSnapshot({
      channel: 'email',
      hasDestination: Boolean(input.normalized.email),
      consent: row.email_consent_state,
      suppression: emailSuppression,
      manualReview: quarantineReasons.length > 0,
    }),
    whatsapp: channelSnapshot({
      channel: 'whatsapp',
      hasDestination: input.normalized.phone.status === 'valid',
      consent: row.whatsapp_consent_state,
      suppression: whatsappSuppression,
      manualReview: quarantineReasons.length > 0 || input.normalized.phone.status !== 'valid',
    }),
  };
  const disposition = primaryDisposition({
    facts,
    quarantineReasons,
    emailSuppression,
    whatsappSuppression,
    emailEligible: channelSnapshots.email.eligibility === 'eligible',
    whatsappEligible: channelSnapshots.whatsapp.eligibility === 'eligible',
  });
  const tagKeys = tagsFor(row, facts, disposition, emailSuppression, whatsappSuppression);
  const plannedActions = actionsFor({
    row: input.normalized,
    facts,
    disposition,
    matched,
    duplicateOccurrence: input.duplicateOccurrence,
  });

  return {
    row_version_key: input.normalized.rowVersionKey,
    decision_key: input.normalized.decisionKey,
    source_row_number: row.source_row_number,
    source_sheet: input.normalized.sourceSheet,
    row_hmac: input.normalized.rowHmac,
    row_version_sha256: input.normalized.rowVersionSha256,
    old_external_id_hmacs: input.normalized.oldExternalIds.map((id) =>
      hmacDigest(input.hmacKey, `external:${id}`),
    ),
    email_hmac: input.normalized.email
      ? hmacDigest(input.hmacKey, `email:${input.normalized.email}`)
      : null,
    phone_hmac: input.normalized.phone.e164
      ? hmacDigest(input.hmacKey, `phone:${input.normalized.phone.e164}`)
      : null,
    normalized_phone_status: input.normalized.phone.status,
    matched_contact_key: matched?.contact_key ?? null,
    candidate_contact_keys: input.match.candidates.map((contact) => contact.contact_key).sort(),
    quarantine_reasons: quarantineReasons,
    primary_disposition: disposition,
    independent_facts: facts,
    channel_snapshots: channelSnapshots,
    tag_keys: tagKeys,
    planned_actions: plannedActions,
    sends_allowed: false,
  };
}

function rowLevelReasons(row: NormalizedRow): Ops04QuarantineReason[] {
  const reasons: Ops04QuarantineReason[] = [];
  const sourceStatus = row.parsed.source_status.toLowerCase();
  const hasStableIdentity =
    row.email !== null || row.phone.status === 'valid' || row.oldExternalIds.length > 0;
  if (row.phone.status === 'ambiguous_local_phone') reasons.push('ambiguous_local_phone');
  if (row.phone.status === 'invalid' && !hasStableIdentity) {
    reasons.push('invalid_destination_with_no_stable_identity');
  }
  if (sourceStatus.includes('archived')) reasons.push('archived_target_requires_review');
  if (sourceStatus.includes('cleaned') || sourceStatus.includes('provider')) {
    reasons.push('cleaned_provider_semantics_unknown');
  }
  if (!hasStableIdentity) reasons.push('insufficient_identity');
  return reasons;
}

function primaryDisposition(input: {
  facts: Ops04RowOutcome['independent_facts'];
  quarantineReasons: Ops04QuarantineReason[];
  emailSuppression: Ops04SuppressionState;
  whatsappSuppression: Ops04SuppressionState;
  emailEligible: boolean;
  whatsappEligible: boolean;
}): Ops04PrimaryDisposition {
  if (input.quarantineReasons.length) return 'manual_review';
  if (input.emailSuppression !== 'none' || input.whatsappSuppression !== 'none') {
    return 'suppressed';
  }
  if (input.facts.current_subscriber || input.facts.already_migrated) return 'already_migrated';
  if (input.facts.active_old_app_user && (input.emailEligible || input.whatsappEligible)) {
    return 'migration_invitation_eligible';
  }
  return 'blast_candidate';
}

function actionsFor(input: {
  row: NormalizedRow;
  facts: Ops04RowOutcome['independent_facts'];
  disposition: Ops04PrimaryDisposition;
  matched: Ops04ExistingContact | null;
  duplicateOccurrence: boolean;
}) {
  const actions = new Set<Ops04ActionType>(['link_source_provenance']);
  if (input.duplicateOccurrence) actions.add('no_op_unchanged');
  if (input.disposition === 'manual_review') {
    actions.add('quarantine_manual_review');
    if (
      input.row.email === null &&
      input.row.phone.status !== 'valid' &&
      !input.row.oldExternalIds.length
    ) {
      actions.add('reject_insufficient_identity');
    }
    return Array.from(actions).sort();
  }
  if (!input.matched && input.disposition !== 'already_migrated') actions.add('create_contact');
  if (input.row.oldExternalIds.length) actions.add('link_external_identity');
  if (input.facts.old_system) actions.add('append_legacy_membership_event');
  if (input.facts.lead) actions.add('append_lead_event');
  if (input.row.email || input.row.phone.status !== 'missing') {
    actions.add('add_contact_point');
    actions.add('add_contact_point_owner');
    actions.add('append_channel_state_event');
  }
  actions.add('add_tag_assignment');
  actions.add('set_migration_projection');
  if (input.disposition === 'already_migrated') actions.add('no_op_unchanged');
  return Array.from(actions).sort();
}

function independentFacts(row: Ops04SyntheticRow): Ops04RowOutcome['independent_facts'] {
  const oldSystem =
    Boolean(
      row.old_user_id.trim() || row.old_subscription_id.trim() || row.source_stable_id.trim(),
    ) || !['unknown', 'deleted'].includes(row.legacy_membership_state);
  const currentSubscriber = ['trial', 'active', 'past_due', 'paused'].includes(
    row.current_subscriber_state,
  );
  const lead =
    row.lead_state !== 'unknown' ||
    row.active_old_app_user ||
    row.audience_type === 'school' ||
    oldSystem;
  return {
    lead,
    old_system: oldSystem,
    active_old_app_user:
      row.active_old_app_user ||
      ['trial', 'active', 'paused'].includes(row.legacy_membership_state),
    current_subscriber: currentSubscriber,
    family: row.audience_type === 'family',
    school: row.audience_type === 'school',
    organization: row.audience_type === 'organization',
    already_migrated: row.existing_migration_state || currentSubscriber,
  };
}

function channelSnapshot(input: {
  channel: 'email' | 'whatsapp';
  hasDestination: boolean;
  consent: Ops04ConsentState;
  suppression: Ops04SuppressionState;
  manualReview: boolean;
}): Ops04ChannelSnapshot {
  if (input.suppression !== 'none' || input.consent === 'opted_out') {
    return {
      channel: input.channel,
      eligibility: 'suppressed',
      consent_state: input.consent,
      suppression_state: input.suppression,
      sends_allowed: false,
      reason: 'suppression_or_opt_out_precedence',
    };
  }
  if (!input.hasDestination) {
    return {
      channel: input.channel,
      eligibility: 'missing_destination',
      consent_state: input.consent,
      suppression_state: input.suppression,
      sends_allowed: false,
      reason: 'destination_missing',
    };
  }
  if (input.manualReview) {
    return {
      channel: input.channel,
      eligibility: 'manual_review',
      consent_state: input.consent,
      suppression_state: input.suppression,
      sends_allowed: false,
      reason: 'identity_or_ownership_requires_review',
    };
  }
  if (input.consent !== 'opted_in') {
    return {
      channel: input.channel,
      eligibility: 'unknown_consent',
      consent_state: input.consent,
      suppression_state: input.suppression,
      sends_allowed: false,
      reason: 'consent_not_opted_in',
    };
  }
  return {
    channel: input.channel,
    eligibility: 'eligible',
    consent_state: input.consent,
    suppression_state: input.suppression,
    sends_allowed: false,
    reason: 'eligible_for_future_review_only',
  };
}

function matchRow(row: NormalizedRow, indexed: IndexedContacts): MatchResult {
  const byOldId = uniqueContacts(row.oldExternalIds.flatMap((id) => indexed.byOldId.get(id) ?? []));
  const byEmail = row.email ? (indexed.byEmail.get(row.email) ?? []) : [];
  const byPhone = row.phone.e164 ? (indexed.byPhone.get(row.phone.e164) ?? []) : [];
  const candidates = uniqueContacts([...byOldId, ...byEmail, ...byPhone]);
  const reasons: Ops04QuarantineReason[] = [];
  if (byOldId.length > 1) reasons.push('stable_external_id_target_conflict');
  if (byEmail.length > 1) reasons.push('shared_email_without_relationship');
  if (byPhone.length > 1) reasons.push('shared_phone_without_relationship');
  if (byEmail.some((contact) => contact.shared_email) && !row.parsed.explicit_relationship) {
    reasons.push('shared_email_without_relationship');
  }
  if (byPhone.some((contact) => contact.shared_phone) && !row.parsed.explicit_relationship) {
    reasons.push('shared_phone_without_relationship');
  }

  const emailKeys = new Set(byEmail.map((contact) => contact.contact_key));
  const phoneKeys = new Set(byPhone.map((contact) => contact.contact_key));
  if (emailKeys.size && phoneKeys.size && !setsOverlap(emailKeys, phoneKeys)) {
    reasons.push('email_phone_target_conflict');
  }

  if (byOldId.length === 1) {
    const oldContact = byOldId[0];
    if (!oldContact) return { matched: null, candidates, reasons };
    const nonOldCandidates = candidates.filter(
      (contact) => contact.contact_key !== oldContact.contact_key,
    );
    if (nonOldCandidates.length) reasons.push('stable_external_id_target_conflict');
    return {
      matched: reasons.length ? null : oldContact,
      candidates,
      reasons: uniqueReasons(reasons),
    };
  }

  if (candidates.length === 1 && !reasons.length) {
    return { matched: candidates[0] ?? null, candidates, reasons: [] };
  }
  if (candidates.length > 1 && !reasons.length) reasons.push('multiple_top_rank_candidates');
  return { matched: null, candidates, reasons: uniqueReasons(reasons) };
}

function indexContacts(contacts: Ops04ExistingContact[]): IndexedContacts {
  const byOldId = new Map<string, Ops04ExistingContact[]>();
  const byEmail = new Map<string, Ops04ExistingContact[]>();
  const byPhone = new Map<string, Ops04ExistingContact[]>();
  for (const contact of contacts) {
    for (const id of contact.old_user_ids.map((value) => value.trim()).filter(Boolean)) {
      addIndex(byOldId, id, contact);
    }
    for (const email of contact.emails
      .map((value) => normalizeOps04Email(value))
      .filter(isString)) {
      addIndex(byEmail, email, contact);
    }
    for (const phone of contact.phones) {
      const normalized = normalizeOps04Phone(phone);
      if (normalized.e164) addIndex(byPhone, normalized.e164, contact);
    }
  }
  return { byOldId, byEmail, byPhone };
}

function snapshotFacts(contacts: Ops04ExistingContact[], hmacKey: string) {
  return contacts
    .map((contact) => ({
      contact_key: contact.contact_key,
      version: contact.version,
      archived: contact.archived,
      merged: contact.merged,
      audience_type: contact.audience_type,
      old_ids: contact.old_user_ids.map((id) => hmacDigest(hmacKey, `old:${id}`)).sort(),
      emails: contact.emails
        .map((email) => normalizeOps04Email(email))
        .filter(isString)
        .map((email) => hmacDigest(hmacKey, `email:${email}`))
        .sort(),
      phones: contact.phones
        .map((phone) => normalizeOps04Phone(phone).e164)
        .filter(isString)
        .map((phone) => hmacDigest(hmacKey, `phone:${phone}`))
        .sort(),
      shared_email: contact.shared_email,
      shared_phone: contact.shared_phone,
      current_subscriber_state: contact.current_subscriber_state,
      email_suppression_state: contact.email_suppression_state,
      whatsapp_suppression_state: contact.whatsapp_suppression_state,
      newer_field_versions: contact.newer_field_versions,
    }))
    .sort((left, right) => left.contact_key.localeCompare(right.contact_key));
}

function summarize(sourceFiles: Ops04SourceFile[], rows: Ops04RowOutcome[]) {
  const rowVersions = new Set(rows.map((row) => row.row_version_sha256));
  const countsByDisposition = countBy(rows, (row) => row.primary_disposition);
  const actionCounts: Record<string, number> = {};
  for (const row of rows) {
    for (const action of row.planned_actions) addCount(actionCounts, action);
  }
  const files = {
    total: sourceFiles.length,
    classified_source: sourceFiles.filter(
      (file) => file.classification_status === 'classified_source',
    ).length,
    unclassified_source: sourceFiles.filter(
      (file) => file.classification_status === 'unclassified_source',
    ).length,
    rejected_source: sourceFiles.filter((file) => file.classification_status === 'rejected_source')
      .length,
  };
  const rowCounts = {
    total: rows.length,
    unique: rowVersions.size,
    duplicate_occurrences: rows.length - rowVersions.size,
    manual_review: countsByDisposition.manual_review ?? 0,
    suppressed: countsByDisposition.suppressed ?? 0,
    already_migrated: countsByDisposition.already_migrated ?? 0,
    migration_invitation_eligible: countsByDisposition.migration_invitation_eligible ?? 0,
    blast_candidate: countsByDisposition.blast_candidate ?? 0,
    quarantine: rows.filter((row) => row.quarantine_reasons.length > 0).length,
    matched: rows.filter((row) => row.matched_contact_key !== null).length,
    current_subscriber_read_only: rows.filter((row) => row.independent_facts.current_subscriber)
      .length,
    active_old_app_user_leads: rows.filter(
      (row) => row.independent_facts.active_old_app_user && row.independent_facts.lead,
    ).length,
    school_leads_without_entitlement: rows.filter(
      (row) => row.independent_facts.school && row.independent_facts.lead,
    ).length,
  };
  const equationTotal =
    rowCounts.manual_review +
    rowCounts.suppressed +
    rowCounts.already_migrated +
    rowCounts.migration_invitation_eligible +
    rowCounts.blast_candidate;
  return {
    files,
    rows: rowCounts,
    occurrences: {
      source_rows: rows.length,
      row_versions: rowVersions.size,
      repeated_row_versions: rows.length - rowVersions.size,
    },
    unique_rows: {
      row_versions: rowVersions.size,
      matched_contact_keys: new Set(rows.map((row) => row.matched_contact_key).filter(isString))
        .size,
      email_hmacs: new Set(rows.map((row) => row.email_hmac).filter(isString)).size,
      phone_hmacs: new Set(rows.map((row) => row.phone_hmac).filter(isString)).size,
    },
    actions: actionCounts,
    attempts: { dry_run: rows.length, apply: 0, sends: 0 },
    rollback: { reversible_actions_planned: actionCounts.create_contact ?? 0, rolled_back: 0 },
    outreach: {
      sends_allowed: 0,
      campaigns_authorized: 0,
      suppressed_channels: suppressedChannelCount(rows),
    },
    equations_balanced: equationTotal === rows.length,
  };
}

function tagsFor(
  row: Ops04SyntheticRow,
  facts: Ops04RowOutcome['independent_facts'],
  disposition: Ops04PrimaryDisposition,
  emailSuppression: Ops04SuppressionState,
  whatsappSuppression: Ops04SuppressionState,
) {
  const tags = new Set<string>([
    'ops04:source:legacy',
    `ops04:audience:${row.audience_type}`,
    `ops04:disposition:${disposition}`,
    `ops04:lead:${facts.lead ? 'yes' : 'no'}`,
  ]);
  if (facts.old_system) tags.add('ops04:old-system');
  if (facts.active_old_app_user) tags.add('ops04:legacy:active-user');
  if (facts.current_subscriber) tags.add('ops04:subscriber:current');
  if (emailSuppression !== 'none') tags.add(`ops04:suppression:email:${emailSuppression}`);
  if (whatsappSuppression !== 'none') tags.add(`ops04:suppression:whatsapp:${whatsappSuppression}`);
  for (const sourceTag of row.source_tags) tags.add(`ops04:source-tag:${sourceTag.toLowerCase()}`);
  return Array.from(tags).sort();
}

function strongestSuppression(
  left: Ops04SuppressionState,
  right: Ops04SuppressionState,
): Ops04SuppressionState {
  const rank: Record<Ops04SuppressionState, number> = {
    none: 0,
    unsubscribed: 1,
    stop: 2,
    wrong_number: 3,
    invalid_address: 4,
    hard_bounce: 5,
    do_not_contact: 6,
    legal_hold: 7,
  };
  return rank[right] > rank[left] ? right : left;
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortCanonical(nested)]),
    );
  }
  return value;
}

function syntheticSourceFile(): Ops04SourceFile {
  return {
    file_id: 'ops04_synthetic_fixture',
    adapter_family: 'ops04_synthetic',
    adapter_version: 'v1',
    file_sha256: sha256('ops04 synthetic fixture v1'),
    byte_size: 18_000,
    safe_path_fingerprint: stableKey('ops04_path', ['synthetic-fixture']),
    workbook_sheets: ['synthetic'],
    normalized_headers: [
      'source_row_number',
      'display_name',
      'email',
      'phone',
      'audience_type',
      'old_user_id',
      'legacy_membership_state',
      'lead_state',
      'consent',
      'suppression',
    ],
    physical_row_count: 18,
    blank_row_count: 0,
    error_row_count: 0,
    classification_status: 'classified_source',
    snapshot_semantics: 'snapshot',
    timestamp_policy: 'synthetic_fixed_2026_07_16',
    consent_suppression_metadata: { synthetic: true },
  };
}

function syntheticExistingContacts(): Ops04ExistingContact[] {
  return [
    existingContact({
      contact_key: 'contact_current_subscriber',
      version: 4,
      audience_type: 'family',
      old_user_ids: ['old-100'],
      emails: ['current@example.test'],
      phones: ['+14155550100'],
      current_subscriber_state: 'active',
    }),
    existingContact({
      contact_key: 'contact_shared_household_a',
      version: 2,
      audience_type: 'family',
      emails: ['shared@example.test'],
      phones: [],
      shared_email: true,
    }),
    existingContact({
      contact_key: 'contact_shared_household_b',
      version: 2,
      audience_type: 'family',
      emails: ['shared@example.test'],
      phones: [],
      shared_email: true,
    }),
    existingContact({
      contact_key: 'contact_phone_a',
      version: 1,
      audience_type: 'family',
      emails: ['phone-a@example.test'],
      phones: ['+14155550111'],
    }),
    existingContact({
      contact_key: 'contact_phone_b',
      version: 1,
      audience_type: 'family',
      emails: ['phone-b@example.test'],
      phones: ['+14155550112'],
    }),
    existingContact({
      contact_key: 'contact_suppressed',
      version: 3,
      audience_type: 'family',
      emails: ['suppressed@example.test'],
      phones: ['+14155550113'],
      email_suppression_state: 'hard_bounce',
      whatsapp_suppression_state: 'stop',
    }),
  ];
}

function existingContact(
  overrides: Partial<Ops04ExistingContact> & Pick<Ops04ExistingContact, 'contact_key'>,
): Ops04ExistingContact {
  const { contact_key: contactKey, ...rest } = overrides;
  return {
    contact_key: contactKey,
    version: 1,
    archived: false,
    merged: false,
    audience_type: 'family',
    old_user_ids: [],
    emails: [],
    phones: [],
    shared_email: false,
    shared_phone: false,
    current_subscriber_state: 'none' as const,
    email_suppression_state: 'none' as const,
    whatsapp_suppression_state: 'none' as const,
    newer_field_versions: {},
    ...rest,
  };
}

function syntheticRows(): Ops04SyntheticRow[] {
  return [
    row(2, {
      email: 'eligible@example.test',
      phone: '+1 415 555 0101',
      old_user_id: 'old-001',
      active_old_app_user: true,
      legacy_membership_state: 'active',
      email_consent_state: 'opted_in',
      whatsapp_consent_state: 'opted_in',
    }),
    row(3, {
      email: 'blast@example.test',
      phone: '+1 415 555 0102',
      lead_state: 'new',
      email_consent_state: 'opted_in',
    }),
    row(4, {
      email: 'current@example.test',
      old_user_id: 'old-100',
      current_subscriber_state: 'active',
      existing_migration_state: true,
      active_old_app_user: true,
    }),
    row(5, {
      email: 'suppressed@example.test',
      email_suppression_state: 'unsubscribed',
      whatsapp_suppression_state: 'stop',
      email_consent_state: 'opted_out',
    }),
    row(6, { email: 'shared@example.test' }),
    row(7, { phone: '050-111-2222', phone_region: '' }),
    row(8, { email: '', phone: '' }),
    row(9, {
      email: 'school@example.test',
      audience_type: 'school',
      lead_state: 'new',
      source_tags: ['school-lead'],
    }),
    row(10, {
      email: 'legacy-former@example.test',
      old_user_id: 'old-010',
      legacy_membership_state: 'former',
      active_old_app_user: true,
    }),
    row(11, { email: 'phone-a@example.test', phone: '+1 415 555 0112' }),
    row(12, { email: 'invalid-only', phone: '12345' }),
    row(13, {
      source_stable_id: 'stable-013',
      old_subscription_id: 'sub-013',
      email: '',
      phone: '',
      legacy_membership_state: 'cancelled',
    }),
    row(14, {
      email: 'unknown-consent@example.test',
      email_consent_state: 'unknown',
      whatsapp_consent_state: 'unknown',
      phone: '+1 415 555 0114',
    }),
    row(15, { email: 'transactional@example.test', email_consent_state: 'transactional_only' }),
    row(16, {
      display_name: 'OPS04 Synthetic 2',
      email: 'eligible@example.test',
      phone: '+1 415 555 0101',
      old_user_id: 'old-001',
      active_old_app_user: true,
      legacy_membership_state: 'active',
      email_consent_state: 'opted_in',
      whatsapp_consent_state: 'opted_in',
    }),
    row(17, {
      email: 'organization@example.test',
      audience_type: 'organization',
      lead_state: 'qualified',
    }),
    row(18, { email: 'manual-archived@example.test', source_status: 'archived target' }),
    row(19, {
      email: 'cleaned-provider@example.test',
      source_status: 'cleaned provider semantics unknown',
    }),
  ];
}

function row(sourceRowNumber: number, overrides: Partial<Ops04SyntheticRow>): Ops04SyntheticRow {
  return {
    source_row_number: sourceRowNumber,
    source_sheet: 'synthetic',
    source_stable_id: '',
    display_name: `OPS04 Synthetic ${sourceRowNumber}`,
    email: `person${sourceRowNumber}@example.test`,
    phone: '',
    phone_region: '',
    audience_type: 'family',
    explicit_relationship: false,
    old_user_id: '',
    old_subscription_id: '',
    legacy_membership_state: 'unknown',
    active_old_app_user: false,
    lead_state: 'unknown',
    current_subscriber_state: 'none',
    existing_migration_state: false,
    email_consent_state: 'opted_in',
    whatsapp_consent_state: 'unknown',
    email_suppression_state: 'none',
    whatsapp_suppression_state: 'none',
    source_status: '',
    source_tags: [],
    ...overrides,
  };
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts: Record<string, number> = {};
  for (const value of values) addCount(counts, key(value));
  return counts;
}

function addCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function formatCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `- ${key}: ${value}`);
}

function suppressedChannelCount(rows: Ops04RowOutcome[]) {
  return rows.filter(
    (row) =>
      row.channel_snapshots.email.eligibility === 'suppressed' ||
      row.channel_snapshots.whatsapp.eligibility === 'suppressed',
  ).length;
}

function addIndex(
  index: Map<string, Ops04ExistingContact[]>,
  key: string,
  contact: Ops04ExistingContact,
) {
  const contacts = index.get(key) ?? [];
  contacts.push(contact);
  index.set(key, contacts);
}

function uniqueContacts(contacts: Ops04ExistingContact[]) {
  const seen = new Set<string>();
  const unique: Ops04ExistingContact[] = [];
  for (const contact of contacts) {
    if (seen.has(contact.contact_key)) continue;
    seen.add(contact.contact_key);
    unique.push(contact);
  }
  return unique.sort((left, right) => left.contact_key.localeCompare(right.contact_key));
}

function uniqueReasons(reasons: Ops04QuarantineReason[]) {
  return Array.from(new Set(reasons)).sort();
}

function setsOverlap(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}
