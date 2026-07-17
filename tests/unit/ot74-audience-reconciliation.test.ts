import { describe, expect, it } from 'vitest';
import {
  createLegacyAudienceDryRun,
  formatLegacyAudienceDryRunReport,
  mapLegacyAudienceWorksheetRows,
  parseLegacyAudienceCsv,
  type LegacyAudienceExistingContact,
} from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

const scope = { accountKey: 'acct_ot74', productKey: 'prod_ot74' };

describe('OT-74 legacy audience reconciliation dry run', () => {
  it('keeps facts independent and derives safe segments without contact mutation', () => {
    const report = createLegacyAudienceDryRun({
      scope,
      request: request([
        row({
          source_row_number: 2,
          email: 'LEAD@example.test',
          active_legacy_user: true,
          legacy_system_state: 'present',
          lead_state: 'lead',
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 3,
          email: 'school@example.test',
          audience_type: 'school',
          active_legacy_user: true,
          lead_state: 'lead',
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 4,
          email: 'blocked@example.test',
          active_legacy_user: true,
          new_system_activated: true,
          consent_state: 'opted_out',
          suppression_state: 'suppressed',
        }),
      ]),
      existingContacts: [contact({ email_normalized: 'lead@example.test' })],
      now: new Date('2026-07-15T00:00:00.000Z'),
    });

    expect(report.production_side_effects).toBe(false);
    expect(report.raw_row_contents_included).toBe(false);
    expect(report.summary.matched_existing_contacts).toBe(1);
    expect(report.summary.school_follow_up_rows).toBe(1);
    expect(report.summary.do_not_contact_rows).toBe(1);
    expect(report.summary.already_activated_rows).toBe(1);
    expect(report.summary.migration_invite_eligible_rows).toBe(1);
    expect(outcome(report, 4).reasons).toContain('already_activated');

    const school = report.row_outcomes.find((outcome) => outcome.row_number === 3);
    expect(school?.segment_codes).toContain('school_follow_up');
    expect(school?.segment_codes).not.toContain('migration_invite_eligible');
    expect(school?.reasons).toContain('school_no_entitlement');
  });

  it('marks duplicate inputs, conflicts, same-name-only rows, and archived contacts for review', () => {
    const report = createLegacyAudienceDryRun({
      scope,
      request: request([
        row({ source_row_number: 2, display_name: 'Shared Name', email: 'dup@example.test' }),
        row({ source_row_number: 3, display_name: 'Shared Name', email: 'dup@example.test' }),
        row({
          source_row_number: 4,
          email: 'email-match@example.test',
          phone: '052-555-0100',
        }),
        row({ source_row_number: 5, display_name: 'Existing Same Name' }),
        row({ source_row_number: 6, email: 'archived@example.test' }),
      ]),
      existingContacts: [
        contact({
          contact_key: 'contact_email',
          public_contact_id: 'public_email',
          display_name: 'Email Contact',
          email_normalized: 'email-match@example.test',
        }),
        contact({
          contact_key: 'contact_phone',
          public_contact_id: 'public_phone',
          display_name: 'Phone Contact',
          email_normalized: 'phone-only@example.test',
          phone_normalized: '+972525550100',
        }),
        contact({
          contact_key: 'contact_name',
          public_contact_id: 'public_name',
          display_name: 'Existing Same Name',
          email_normalized: 'existing-name@example.test',
        }),
        contact({
          contact_key: 'contact_archived',
          public_contact_id: 'public_archived',
          display_name: 'Archived',
          email_normalized: 'archived@example.test',
          archived_at: '2026-07-01T00:00:00.000Z',
        }),
      ],
    });

    expect(report.summary.duplicate_rows).toBe(1);
    expect(report.summary.manual_review_rows).toBe(3);
    expect(outcome(report, 3).disposition).toBe('duplicate_input');
    expect(outcome(report, 4).reasons).toContain('conflicting_identity');
    expect(outcome(report, 5).reasons).toEqual(
      expect.arrayContaining(['missing_identity', 'no_name_only_match']),
    );
    expect(outcome(report, 6).reasons).toContain('archived_contact');
  });

  it('matches missing-email rows by normalized phone inside the One Time account only', () => {
    const report = createLegacyAudienceDryRun({
      scope,
      request: request([
        row({
          source_row_number: 2,
          email: '',
          phone: '052 555 0199',
          consent_state: 'opted_in',
          active_legacy_user: true,
        }),
      ]),
      existingContacts: [
        contact({
          contact_key: 'wrong_account_contact',
          account_key: 'acct_other',
          phone_normalized: '+972525550199',
        }),
        contact({
          contact_key: 'right_account_contact',
          public_contact_id: 'public_right',
          phone_normalized: '+972525550199',
        }),
      ],
    });

    expect(report.summary.matched_existing_contacts).toBe(1);
    expect(outcome(report, 2).matched_contact_key).toBe('right_account_contact');
    expect(outcome(report, 2).reasons).toContain('matched_by_phone');
  });

  it('parses synthetic CSV and worksheet-shaped rows without exposing row contents in reports', () => {
    const csvRows = parseLegacyAudienceCsv(
      [
        'name,email,phone,audience,active_legacy_user,consent,suppressed',
        'CSV Person,csv@example.test,052-555-0001,family,true,opted_in,false',
      ].join('\n'),
      { worksheet_label: 'csv-fixture' },
    );
    const worksheetRows = mapLegacyAudienceWorksheetRows(
      [
        {
          Name: 'Sheet Person',
          Email: 'sheet@example.test',
          Audience: 'school',
          Consent: 'opted_in',
          Lead: 'yes',
        },
      ],
      { worksheet_label: 'sheet-fixture' },
    );
    const report = createLegacyAudienceDryRun({
      scope,
      request: request([...csvRows, ...worksheetRows]),
      existingContacts: [],
    });
    const printable = formatLegacyAudienceDryRunReport(report);

    expect(report.summary.total_rows).toBe(2);
    expect(report.summary.school_follow_up_rows).toBe(1);
    expect(printable).not.toContain('CSV Person');
    expect(printable).not.toContain('csv@example.test');
    expect(printable).not.toContain('052-555-0001');
    expect(printable).toContain('reason_counts:');
  });

  it('handles 10k synthetic rows with counts-only output', () => {
    const rows = Array.from({ length: 10_000 }, (_, index) =>
      row({
        source_row_number: index + 2,
        display_name: `Synthetic ${index}`,
        email: `synthetic${index}@example.test`,
        active_legacy_user: true,
        consent_state: 'opted_in',
      }),
    );
    const report = createLegacyAudienceDryRun({
      scope,
      request: request(rows),
      existingContacts: [],
    });
    const printable = formatLegacyAudienceDryRunReport(report);

    expect(report.summary.total_rows).toBe(10_000);
    expect(report.summary.migration_invite_eligible_rows).toBe(10_000);
    expect(printable).toContain('total_rows: 10000');
    expect(printable).not.toContain('synthetic9999@example.test');
  });
});

function request(rows: LegacyAudienceInputRow[]) {
  return {
    idempotency_key: `idempotency-${rows.length}-${rows[0]?.source_row_number ?? 0}`,
    source: {
      kind: 'csv_normalized' as const,
      source_label: 'synthetic-unit-fixture',
      worksheet_label: 'unit',
    },
    rows,
  };
}

function row(overrides: Partial<LegacyAudienceInputRow>): LegacyAudienceInputRow {
  return {
    source_row_number: 1,
    display_name: 'Test Person',
    email: '',
    phone: '',
    audience_type: 'family',
    legacy_system_state: 'unknown',
    active_legacy_user: false,
    new_system_activated: false,
    lead_state: 'unknown',
    consent_state: 'unknown',
    suppression_state: 'active',
    source_tags: [],
    ...overrides,
  };
}

function contact(overrides: Partial<LegacyAudienceExistingContact>): LegacyAudienceExistingContact {
  return {
    account_key: scope.accountKey,
    product_key: scope.productKey,
    contact_key: 'contact_existing',
    public_contact_id: 'public_existing',
    display_name: 'Existing Contact',
    email_normalized: 'existing@example.test',
    phone_normalized: null,
    archived_at: null,
    suppression_state: 'active',
    ...overrides,
  };
}

function outcome(report: ReturnType<typeof createLegacyAudienceDryRun>, rowNumber: number) {
  const found = report.row_outcomes.find((row) => row.row_number === rowNumber);
  if (!found) throw new Error(`Missing row ${rowNumber}`);
  return found;
}
