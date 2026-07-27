import { describe, expect, it } from 'vitest';
import {
  parseAcceptedHistoricalImportCsv,
  parseProtectedHighLevelImportCsv,
  parseReplitSubscriberCsv,
  reconcileReplitSubscribers,
  replitContactTaxonomy,
  requiredReplitProviderTags,
  toProtectedHighLevelImportCsv,
  type ExistingAdultIdentity,
  type ReplitSubscriberRow,
} from '../../../packages/domain/src/audience-reconciliation/replit-subscriber.ts';

describe('Replit subscriber reconciliation', () => {
  it('quarantines duplicate source identities and never matches by name', () => {
    const result = reconcileReplitSubscribers({
      rows: [
        row(2, { email: 'duplicate@example.test' }),
        row(3, { email: 'DUPLICATE@example.test', notes: 'different' }),
        row(4, { email: 'new@example.test', name: 'Same Name' }),
      ],
      existingAdults: [
        existing({
          recordKey: 'name-only',
          email: 'other@example.test',
        }),
      ],
    });

    expect(result.summary.duplicates_inside_source).toBe(1);
    expect(result.summary.invalid_or_skipped_rows).toBe(2);
    expect(result.summary.valid_adult_rows).toBe(1);
    expect(result.summary.new_contacts).toBe(1);
    expect(result.quarantined[0]?.sourceRowNumbers).toEqual([2, 3]);
  });

  it('matches exact email, preserves IDs/tags/denials, and excludes denied OT-02A candidates', () => {
    const result = reconcileReplitSubscribers({
      rows: [row(2, { email: 'ACTIVE@example.test', status: 'active' })],
      existingAdults: [
        existing({
          recordKey: 'ghl-1',
          ghlContactId: 'ghl-contact-1',
          email: 'active@example.test',
          tags: ['Unrelated Existing Tag'],
        }),
        existing({
          recordKey: 'history-1',
          source: 'historical_crm',
          email: 'active@example.test',
          unsubscribed: true,
        }),
      ],
    });

    expect(result.summary.existing_ghl_matches).toBe(1);
    expect(result.summary.active_users).toBe(1);
    expect(result.summary.migration_candidates).toBe(0);
    expect(result.summary.ot_02b_candidates).toBe(0);
    expect(result.summary.suppressed_or_denied_contacts).toBe(1);
    expect(result.protectedImportRows[0]).toMatchObject({
      contactId: 'ghl-contact-1',
      action: 'update',
      denied: true,
    });
    expect(result.protectedImportRows[0]?.tags).toEqual(
      expect.arrayContaining([
        'Unrelated Existing Tag',
        replitContactTaxonomy.sourceTag,
        replitContactTaxonomy.activeSubscriberTag,
        replitContactTaxonomy.suppressionTag,
      ]),
    );
    expect(result.protectedImportRows[0]?.tags).not.toContain(
      replitContactTaxonomy.migrationCandidateTag,
    );
    expect(result.sends).toBe(0);
    expect(result.workflow_enrollments).toBe(0);
    expect(result.suppression_removals).toBe(0);
  });

  it('quarantines conflicting durable email matches and never emits raw values in result metadata', () => {
    const result = reconcileReplitSubscribers({
      rows: [row(2, { email: 'conflict@example.test' })],
      existingAdults: [
        existing({
          recordKey: 'ghl-a',
          ghlContactId: 'ghl-a',
          email: 'conflict@example.test',
        }),
        existing({
          recordKey: 'ghl-b',
          ghlContactId: 'ghl-b',
          email: 'conflict@example.test',
        }),
      ],
    });

    expect(result.summary.identity_conflicts).toBe(1);
    expect(result.summary.invalid_or_skipped_rows).toBe(1);
    expect(result.protectedImportRows).toHaveLength(0);
    expect(JSON.stringify(result.quarantined)).not.toContain('conflict@example.test');
    expect(result.raw_values_in_sanitized_output).toBe(false);
  });

  it('parses quoted CSV and creates an import with no workflow or send columns', () => {
    const rows = parseReplitSubscriberCsv(
      [
        'email,name,status,plan,location,joined,trial_end,notes',
        '"person@example.test","Parent, One",active,standard,,2026-01-01,,"note, safe"',
      ].join('\n'),
    );
    const result = reconcileReplitSubscribers({ rows, existingAdults: [] });
    const csv = toProtectedHighLevelImportCsv(result.protectedImportRows);

    expect(rows[0]?.name).toBe('Parent, One');
    expect(csv).toContain(',"Parent,",One,');
    expect(csv).not.toMatch(/workflow|enroll|send/i);
  });

  it('preserves denial facts from the accepted historical CRM import', () => {
    const records = parseAcceptedHistoricalImportCsv(
      [
        'email,one_time_crm_contact_id,tags,dnd,one_time_email_consent,one_time_suppression_state',
        'denied@example.test,historic-1,Existing Tag,TRUE,opted_out,suppressed',
      ].join('\n'),
    );
    const result = reconcileReplitSubscribers({
      rows: [row(2, { email: 'denied@example.test', status: 'active' })],
      existingAdults: records,
    });

    expect(result.summary.existing_historical_matches).toBe(1);
    expect(result.summary.suppressed_or_denied_contacts).toBe(1);
    expect(result.protectedImportRows[0]?.tags).toContain(replitContactTaxonomy.suppressionTag);
  });

  it('round-trips the protected provider CSV and limits writes to canonical taxonomy', () => {
    const csv = toProtectedHighLevelImportCsv([
      {
        sourceRowNumber: 2,
        contactId: 'ghl-contact-1',
        email: 'adult@example.test',
        firstName: 'Adult',
        lastName: 'One',
        phone: '',
        tags: [
          'Unrelated Existing Tag',
          replitContactTaxonomy.sourceTag,
          replitContactTaxonomy.activeSubscriberTag,
        ],
        source: 'replit_legacy_subscriber_2026',
        activeUser: true,
        migrationCandidate: false,
        denied: false,
        action: 'update',
      },
    ]);
    const [parsed] = parseProtectedHighLevelImportCsv(csv);

    expect(parsed).toMatchObject({
      protectedRowNumber: 2,
      contactId: 'ghl-contact-1',
      email: 'adult@example.test',
      firstName: 'Adult',
      lastName: 'One',
      source: 'replit_legacy_subscriber_2026',
    });
    expect(requiredReplitProviderTags(parsed!.tags)).toEqual([
      replitContactTaxonomy.activeSubscriberTag,
      replitContactTaxonomy.sourceTag,
    ]);
  });
});

function row(sourceRowNumber: number, overrides: Partial<ReplitSubscriberRow>) {
  return {
    sourceRowNumber,
    externalId: null,
    name: 'Same Name',
    email: `person-${sourceRowNumber}@example.test`,
    phone: null,
    status: 'cancelled',
    plan: 'standard',
    location: '',
    joined: '2026-01-01',
    trialEnd: '',
    notes: '',
    ...overrides,
  } satisfies ReplitSubscriberRow;
}

function existing(overrides: Partial<ExistingAdultIdentity>) {
  return {
    recordKey: 'existing',
    source: 'ghl',
    email: 'existing@example.test',
    tags: [],
    ...overrides,
  } satisfies ExistingAdultIdentity;
}
