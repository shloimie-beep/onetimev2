import type {
  AudienceCommunicationEligibility,
  AudienceDryRunReport,
  AudienceExistingContact,
  AudienceImportBatch,
  AudienceImportRow,
  AudienceReconciliationDecision,
  AudienceReconciliationReason,
  AudienceReconciliationStatus,
  AudienceSegmentKey,
} from '../../../contracts/src/audience/schemas.ts';
import { audienceDryRunReportSchema } from '../../../contracts/src/audience/schemas.ts';
import { stableKey } from '../lead/normalize.ts';

export type AudienceReconciliationInput = {
  batch: AudienceImportBatch;
  rows: AudienceImportRow[];
  existingContacts: AudienceExistingContact[];
};

type MatchResult = {
  matchedContactKey: string | null;
  reasons: AudienceReconciliationReason[];
  status: AudienceReconciliationStatus;
};

const ALL_STATUSES: AudienceReconciliationStatus[] = [
  'matched_existing',
  'new_contact_candidate',
  'manual_review',
  'duplicate_input',
  'blocked_do_not_contact',
];

const ALL_SEGMENTS: AudienceSegmentKey[] = [
  'migration_invite_eligible',
  'active_legacy_user',
  'manual_review',
  'school_follow_up',
  'do_not_contact',
];

const ALL_REASONS: AudienceReconciliationReason[] = [
  'duplicate_row_fingerprint',
  'email_match',
  'phone_match',
  'email_phone_conflict',
  'multiple_identity_matches',
  'missing_reconcilable_identity',
  'name_only_match_forbidden',
  'school_follow_up_required',
  'suppression_blocks_contact',
  'archived_contact',
  'invalid_email',
  'invalid_phone',
  'replay_same_batch_row',
  'new_identity_candidate',
];

export function reconcileAudienceRows({
  batch,
  rows,
  existingContacts,
}: AudienceReconciliationInput): AudienceDryRunReport {
  const inScopeContacts = existingContacts.filter(
    (contact) =>
      contact.account_key === batch.account_key && contact.product_key === batch.product_key,
  );
  const seenFingerprints = new Set<string>();
  const decisions: AudienceReconciliationDecision[] = [];

  for (const row of rows) {
    const duplicate = seenFingerprints.has(row.row_fingerprint);
    seenFingerprints.add(row.row_fingerprint);
    const match = duplicate ? duplicateMatch(row) : matchRowToContact(row, inScopeContacts);
    const reasons = mergeReasons(match.reasons, row.row_warnings, rowDerivedReasons(row));
    const communicationEligibility = communicationEligibilityFor(row);
    const status = statusWithSuppression(match.status, communicationEligibility);
    const segments = deriveSegments(row, status, communicationEligibility);
    decisions.push({
      row_key: stableKey('audrec', [batch.source_batch_key, row.row_fingerprint]),
      row_fingerprint: row.row_fingerprint,
      status,
      matched_contact_key: match.matchedContactKey,
      reasons,
      segments,
      communication_eligibility: communicationEligibility,
      entitlement_policy:
        row.audience_type === 'school' || row.source_facts.school_submission
          ? 'no_class_or_portal_entitlement'
          : 'not_applicable',
      rollback_record_key: stableKey('audrollback', [batch.source_batch_key, row.row_fingerprint]),
    });
  }

  const report: AudienceDryRunReport = {
    success: true,
    report_kind: 'ot74_audience_reconciliation_dry_run',
    account_key: batch.account_key,
    product_key: batch.product_key,
    source_batch_key: batch.source_batch_key,
    source_spreadsheet_key: batch.source_spreadsheet_key,
    row_count: rows.length,
    unique_row_count: seenFingerprints.size,
    duplicate_row_count: rows.length - seenFingerprints.size,
    status_counts: countStatuses(decisions),
    segment_counts: countSegments(decisions),
    reason_counts: countReasons(decisions),
    decisions,
    rollback_plan: {
      rollback_plan_key: stableKey('audrollbackplan', [batch.source_batch_key]),
      reversible_records: decisions.length,
      destructive_contact_deletes: 0,
      actions: [
        { action: 'mark_import_batch_rolled_back', record_count: 1 },
        { action: 'remove_segment_assignments', record_count: countSegmentAssignments(decisions) },
        { action: 'clear_reconciliation_links', record_count: decisions.length },
      ],
    },
    external_mutation_counts: {
      production_database_writes: 0,
      messages_sent: 0,
      provider_mutations: 0,
      real_spreadsheets_ingested: 0,
    },
  };

  return audienceDryRunReportSchema.parse(report);
}

function duplicateMatch(row: AudienceImportRow): MatchResult {
  void row;
  return {
    matchedContactKey: null,
    reasons: ['duplicate_row_fingerprint'],
    status: 'duplicate_input',
  };
}

function matchRowToContact(
  row: AudienceImportRow,
  contacts: AudienceExistingContact[],
): MatchResult {
  const emailMatches = row.email_normalized
    ? contacts.filter((contact) => contact.email_normalized === row.email_normalized)
    : [];
  const phoneMatches = row.phone_normalized
    ? contacts.filter((contact) => contact.phone_normalized === row.phone_normalized)
    : [];
  const identityMatches = uniqueByContactKey([...emailMatches, ...phoneMatches]);

  if (!row.email_normalized && !row.phone_normalized) {
    return {
      matchedContactKey: null,
      reasons: row.display_name_present
        ? ['missing_reconcilable_identity', 'name_only_match_forbidden']
        : ['missing_reconcilable_identity'],
      status: 'manual_review',
    };
  }

  if (identityMatches.length > 1) {
    return {
      matchedContactKey: null,
      reasons:
        emailMatches.length > 0 && phoneMatches.length > 0
          ? ['email_phone_conflict']
          : ['multiple_identity_matches'],
      status: 'manual_review',
    };
  }

  const [match] = identityMatches;
  if (!match) {
    return {
      matchedContactKey: null,
      reasons: ['new_identity_candidate'],
      status: 'new_contact_candidate',
    };
  }

  const reasons: AudienceReconciliationReason[] = [];
  if (emailMatches.some((contact) => contact.contact_key === match.contact_key)) {
    reasons.push('email_match');
  }
  if (phoneMatches.some((contact) => contact.contact_key === match.contact_key)) {
    reasons.push('phone_match');
  }
  if (match.archived) reasons.push('archived_contact');
  if (match.suppression_status !== 'active') reasons.push('suppression_blocks_contact');
  return {
    matchedContactKey: match.contact_key,
    reasons,
    status: match.archived ? 'manual_review' : 'matched_existing',
  };
}

function communicationEligibilityFor(row: AudienceImportRow): AudienceCommunicationEligibility {
  if (row.suppression_status !== 'active' || row.consent_status === 'unsubscribed') {
    return 'blocked_suppression';
  }
  if (!row.email_normalized && !row.phone_normalized) return 'blocked_missing_channel';
  if (row.consent_status !== 'consented') return 'needs_consent_review';
  return 'eligible';
}

function statusWithSuppression(
  status: AudienceReconciliationStatus,
  communicationEligibility: AudienceCommunicationEligibility,
): AudienceReconciliationStatus {
  if (communicationEligibility === 'blocked_suppression') return 'blocked_do_not_contact';
  return status;
}

function deriveSegments(
  row: AudienceImportRow,
  status: AudienceReconciliationStatus,
  communicationEligibility: AudienceCommunicationEligibility,
): AudienceSegmentKey[] {
  const segments = new Set<AudienceSegmentKey>();
  if (row.source_facts.active_legacy_user) segments.add('active_legacy_user');
  if (status === 'manual_review' || status === 'duplicate_input') segments.add('manual_review');
  if (row.audience_type === 'school' || row.source_facts.school_submission) {
    segments.add('school_follow_up');
  }
  if (communicationEligibility === 'blocked_suppression') segments.add('do_not_contact');
  if (
    communicationEligibility === 'eligible' &&
    status !== 'manual_review' &&
    status !== 'duplicate_input' &&
    !segments.has('school_follow_up') &&
    (row.source_facts.in_old_system || row.source_facts.active_legacy_user)
  ) {
    segments.add('migration_invite_eligible');
  }
  return [...segments];
}

function rowDerivedReasons(row: AudienceImportRow): AudienceReconciliationReason[] {
  const reasons: AudienceReconciliationReason[] = [];
  if (row.audience_type === 'school' || row.source_facts.school_submission) {
    reasons.push('school_follow_up_required');
  }
  if (row.suppression_status !== 'active' || row.consent_status === 'unsubscribed') {
    reasons.push('suppression_blocks_contact');
  }
  return reasons;
}

function mergeReasons(
  primary: AudienceReconciliationReason[],
  warnings: AudienceReconciliationReason[],
  derived: AudienceReconciliationReason[],
) {
  return [...new Set([...primary, ...warnings, ...derived])];
}

function uniqueByContactKey(contacts: AudienceExistingContact[]) {
  const byKey = new Map<string, AudienceExistingContact>();
  for (const contact of contacts) byKey.set(contact.contact_key, contact);
  return [...byKey.values()];
}

function countStatuses(decisions: AudienceReconciliationDecision[]) {
  const counts = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<
    AudienceReconciliationStatus,
    number
  >;
  for (const decision of decisions) counts[decision.status] += 1;
  return counts;
}

function countSegments(decisions: AudienceReconciliationDecision[]) {
  const counts = Object.fromEntries(ALL_SEGMENTS.map((segment) => [segment, 0])) as Record<
    AudienceSegmentKey,
    number
  >;
  for (const decision of decisions) {
    for (const segment of decision.segments) counts[segment] += 1;
  }
  return counts;
}

function countReasons(decisions: AudienceReconciliationDecision[]) {
  const counts = Object.fromEntries(ALL_REASONS.map((reason) => [reason, 0])) as Record<
    AudienceReconciliationReason,
    number
  >;
  for (const decision of decisions) {
    for (const reason of decision.reasons) counts[reason] += 1;
  }
  return counts;
}

function countSegmentAssignments(decisions: AudienceReconciliationDecision[]) {
  return decisions.reduce((total, decision) => total + decision.segments.length, 0);
}
