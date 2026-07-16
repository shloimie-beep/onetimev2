import {
  createLegacyAudienceDryRun,
  formatLegacyAudienceDryRunReport,
  type LegacyAudienceExistingContact,
} from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

const rowCount = parseRowCount(process.argv);
const rows = syntheticRows(rowCount);
const report = createLegacyAudienceDryRun({
  scope: { accountKey: 'acct_synthetic_ot74', productKey: 'prod_synthetic_ot74' },
  request: {
    idempotency_key: `synthetic-ot74-${rowCount}`,
    source: {
      kind: 'csv_normalized',
      source_label: 'synthetic-ot74-generated',
      worksheet_label: 'synthetic',
    },
    rows,
  },
  existingContacts: syntheticContacts(),
  now: new Date('2026-07-15T00:00:00.000Z'),
});

process.stdout.write(formatLegacyAudienceDryRunReport(report));

function parseRowCount(args: string[]) {
  const value = args.find((arg) => arg.startsWith('--rows='))?.slice('--rows='.length);
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25000) {
    throw new Error('--rows must be an integer from 1 to 25000.');
  }
  return parsed;
}

function syntheticRows(count: number): LegacyAudienceInputRow[] {
  return Array.from({ length: count }, (_, index) => {
    const rowNumber = index + 2;
    const school = index % 19 === 0;
    const suppressed = index % 23 === 0;
    const missingEmail = index % 17 === 0;
    return {
      source_row_number: rowNumber,
      source_sheet: 'synthetic',
      display_name: `Synthetic Person ${index}`,
      email: missingEmail ? '' : `synthetic${index}@example.test`,
      phone: index % 5 === 0 ? `052-555-${String(index).padStart(4, '0')}` : '',
      audience_type: school ? 'school' : 'family',
      legacy_system_state: index % 3 === 0 ? 'present' : 'unknown',
      active_legacy_user: index % 2 === 0,
      new_system_activated: false,
      lead_state: school || index % 4 === 0 ? 'lead' : 'unknown',
      consent_state: suppressed ? 'opted_out' : 'opted_in',
      suppression_state: suppressed ? 'suppressed' : 'active',
      source_tags: school ? ['school'] : ['family'],
    };
  });
}

function syntheticContacts(): LegacyAudienceExistingContact[] {
  return [
    {
      account_key: 'acct_synthetic_ot74',
      product_key: 'prod_synthetic_ot74',
      contact_key: 'contact_synthetic_10',
      public_contact_id: 'public_synthetic_10',
      display_name: 'Synthetic Person 10',
      email_normalized: 'synthetic10@example.test',
      phone_normalized: '+972525550010',
      archived_at: null,
      suppression_state: 'active',
    },
  ];
}
