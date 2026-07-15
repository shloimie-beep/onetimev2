import type {
  AudienceExistingContact,
  AudienceImportBatch,
  AudienceImportCell,
} from '../../packages/contracts/src/audience/schemas.ts';

export type SyntheticAudienceFixture = {
  batch: AudienceImportBatch;
  rows: Record<string, AudienceImportCell>[];
  existingContacts: AudienceExistingContact[];
};

export function buildSyntheticAudienceFixture(rowCount = 12): SyntheticAudienceFixture {
  const baseRows: Record<string, AudienceImportCell>[] = [
    legacyRow('Lead Existing Active', 'lead-existing@example.test', '050-100-0001', {
      isLead: true,
      inOldSystem: true,
      activeLegacyUser: true,
    }),
    legacyRow('Lead Existing Active', 'lead-existing@example.test', '050-100-0001', {
      isLead: true,
      inOldSystem: true,
      activeLegacyUser: true,
    }),
    legacyRow('Conflicting Identity', 'conflict-email@example.test', '050-200-0002', {
      inOldSystem: true,
    }),
    legacyRow('Same Name', 'same-a@example.test', '050-300-0003', {
      inOldSystem: true,
      activeLegacyUser: true,
    }),
    legacyRow('Same Name', 'same-b@example.test', '050-300-0004', {
      inOldSystem: true,
    }),
    legacyRow('Missing Email Has Phone', '', '050-400-0005', {
      inOldSystem: true,
      activeLegacyUser: true,
    }),
    legacyRow('Name Only Person', '', '', { inOldSystem: true }),
    legacyRow('Suppressed Person', 'suppressed@example.test', '050-500-0006', {
      inOldSystem: true,
      activeLegacyUser: true,
      suppression: 'do_not_contact',
    }),
    legacyRow('Archived Person', 'archived@example.test', '050-600-0007', {
      inOldSystem: true,
      activeLegacyUser: true,
    }),
    legacyRow('School Office', 'school@example.test', '050-700-0008', {
      isLead: true,
      schoolSubmission: true,
      audienceType: 'school',
    }),
    legacyRow('Cross Account Person', 'cross-account@example.test', '050-800-0009', {
      inOldSystem: true,
    }),
    legacyRow('Invalid Email', 'not-an-email', '050-900-0000', {
      inOldSystem: true,
    }),
  ];

  while (baseRows.length < rowCount) {
    const index = baseRows.length + 1;
    baseRows.push(
      legacyRow(`Synthetic ${index}`, `synthetic-${index}@example.test`, `050-77${index}`, {
        inOldSystem: true,
        activeLegacyUser: index % 3 === 0,
      }),
    );
  }

  return {
    batch: {
      account_key: 'one_time',
      product_key: 'one_time_mishnah',
      source_spreadsheet_key: 'synthetic_legacy_audience_sheet',
      source_batch_key: `synthetic_batch_${rowCount}`,
      source_name: 'Synthetic OT74 audience fixture',
      source_kind: 'synthetic_fixture',
      dry_run_only: true,
    },
    rows: baseRows.slice(0, rowCount),
    existingContacts: [
      contact(
        'contact_existing',
        'Lead Existing Active',
        'lead-existing@example.test',
        '+972501000001',
      ),
      contact('contact_conflict_email', 'Conflict Email', 'conflict-email@example.test', null),
      contact('contact_conflict_phone', 'Conflict Phone', null, '+972502000002'),
      contact('contact_archived', 'Archived Person', 'archived@example.test', '+972506000007', {
        archived: true,
      }),
      contact(
        'contact_cross_account',
        'Cross Account Person',
        'cross-account@example.test',
        '+972508000009',
        { accountKey: 'other_account' },
      ),
    ],
  };
}

function legacyRow(
  name: string,
  email: string,
  phone: string,
  options: {
    isLead?: boolean;
    inOldSystem?: boolean;
    activeLegacyUser?: boolean;
    schoolSubmission?: boolean;
    audienceType?: string;
    suppression?: string;
  },
): Record<string, AudienceImportCell> {
  return {
    name,
    email,
    phone,
    audience_type: options.audienceType ?? 'family',
    is_lead: options.isLead ?? false,
    in_old_system: options.inOldSystem ?? false,
    active_legacy_user: options.activeLegacyUser ?? false,
    school_submission: options.schoolSubmission ?? false,
    consent_status: options.suppression ? 'unsubscribed' : 'consented',
    suppression_status: options.suppression ?? 'active',
  };
}

function contact(
  contactKey: string,
  displayName: string,
  email: string | null,
  phone: string | null,
  options: { archived?: boolean; accountKey?: string } = {},
): AudienceExistingContact {
  return {
    contact_key: contactKey,
    account_key: options.accountKey ?? 'one_time',
    product_key: 'one_time_mishnah',
    display_name: displayName,
    email_normalized: email,
    phone_normalized: phone,
    archived: options.archived ?? false,
    suppression_status: 'active',
  };
}
