import { describe, expect, it } from 'vitest';
import { buildAudienceDryRunReport } from '../../../packages/domain/src/audience/dry-run.ts';
import { parseAudienceCsv } from '../../../packages/domain/src/audience/parser.ts';
import { buildSyntheticAudienceFixture } from '../../../scripts/support/audience-synthetic-fixtures.ts';

describe('OT74 audience reconciliation foundation', () => {
  it('parses CSV-shaped normalized input without printing row contents', () => {
    const rows = parseAudienceCsv(
      'name,email,phone,in_old_system,active_legacy_user\n"Parent, One",Parent@One.TEST,050-111-2222,true,true',
    );
    const [row] = rows;
    expect(row?.name).toBe('Parent, One');
    expect(row?.email).toBe('Parent@One.TEST');
  });

  it('keeps lead, old-system, and active-user facts independent', () => {
    const fixture = buildSyntheticAudienceFixture();
    const report = buildAudienceDryRunReport(fixture);
    const matched = report.decisions.find((decision) => decision.status === 'matched_existing');
    expect(matched?.segments).toContain('active_legacy_user');
    expect(matched?.segments).toContain('migration_invite_eligible');
    expect(matched?.reasons).toContain('email_match');
    expect(matched?.reasons).toContain('phone_match');
  });

  it('detects duplicate input and keeps replay idempotent by fingerprint', () => {
    const fixture = buildSyntheticAudienceFixture();
    const first = buildAudienceDryRunReport(fixture);
    const second = buildAudienceDryRunReport(fixture);
    expect(first.duplicate_row_count).toBe(1);
    expect(first.status_counts.duplicate_input).toBe(1);
    expect(second.decisions.map((decision) => decision.row_key)).toEqual(
      first.decisions.map((decision) => decision.row_key),
    );
  });

  it('routes conflicting identity matches to manual review', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    const conflict = report.decisions.find((decision) =>
      decision.reasons.includes('email_phone_conflict'),
    );
    expect(conflict?.status).toBe('manual_review');
    expect(conflict?.segments).toContain('manual_review');
    expect(conflict?.matched_contact_key).toBeNull();
  });

  it('never merges by name alone and allows same-name people with distinct identities', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    const nameOnly = report.decisions.find((decision) =>
      decision.reasons.includes('name_only_match_forbidden'),
    );
    expect(nameOnly?.status).toBe('manual_review');
    const sameNameNewCandidates = report.decisions.filter(
      (decision) =>
        decision.status === 'new_contact_candidate' &&
        decision.reasons.includes('new_identity_candidate'),
    );
    expect(sameNameNewCandidates.length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes phone identity when email is missing', () => {
    const fixture = buildSyntheticAudienceFixture();
    fixture.existingContacts.push({
      contact_key: 'contact_phone_only',
      account_key: 'one_time',
      product_key: 'one_time_mishnah',
      display_name: 'Phone Only',
      email_normalized: null,
      phone_normalized: '+972504000005',
      archived: false,
      suppression_status: 'active',
    });
    const report = buildAudienceDryRunReport(fixture);
    const phoneOnly = report.decisions.find(
      (decision) => decision.matched_contact_key === 'contact_phone_only',
    );
    expect(phoneOnly?.matched_contact_key).toBe('contact_phone_only');
  });

  it('does not reconcile across accounts', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    const crossAccount = report.decisions.find(
      (decision) => decision.row_fingerprint && decision.reasons.includes('new_identity_candidate'),
    );
    expect(crossAccount?.matched_contact_key).toBeNull();
  });

  it('preserves archived and suppressed contacts as review or no-contact outcomes', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    expect(report.reason_counts.archived_contact).toBe(1);
    expect(report.segment_counts.do_not_contact).toBe(1);
    expect(report.status_counts.blocked_do_not_contact).toBe(1);
  });

  it('handles school submissions as follow-up only with no entitlement', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    const school = report.decisions.find((decision) =>
      decision.reasons.includes('school_follow_up_required'),
    );
    expect(school?.segments).toContain('school_follow_up');
    expect(school?.entitlement_policy).toBe('no_class_or_portal_entitlement');
    expect(school?.segments).not.toContain('migration_invite_eligible');
  });

  it('keeps dry-run reports counts-only and rollback non-destructive', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture());
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('lead-existing@example.test');
    expect(serialized).not.toContain('Lead Existing Active');
    expect(report.rollback_plan.destructive_contact_deletes).toBe(0);
    expect(report.external_mutation_counts).toEqual({
      production_database_writes: 0,
      messages_sent: 0,
      provider_mutations: 0,
      real_spreadsheets_ingested: 0,
    });
  });

  it('processes 10000 synthetic rows without exposing row contents', () => {
    const report = buildAudienceDryRunReport(buildSyntheticAudienceFixture(10000));
    expect(report.row_count).toBe(10000);
    expect(report.unique_row_count).toBe(9999);
    expect(JSON.stringify(report)).not.toContain('synthetic-9999@example.test');
  });
});
