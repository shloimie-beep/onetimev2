import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';
import {
  createLegacyAudienceDryRun,
  type LegacyAudienceExistingContact,
} from '../../packages/domain/src/audience-reconciliation/service.ts';

const args = parseArgs(process.argv.slice(2));
const report = createLegacyAudienceDryRun({
  scope: { accountKey: 'acct_w12_01_synthetic', productKey: 'prod_w12_01_synthetic' },
  request: {
    idempotency_key: 'w12-01-synthetic-dry-run',
    source: {
      kind: 'csv_normalized',
      source_label: 'w12-01-synthetic-no-raw-pii',
      worksheet_label: 'synthetic',
    },
    rows: syntheticRows(),
  },
  existingContacts: syntheticContacts(),
  now: new Date('2026-07-17T00:00:00.000Z'),
});

const output = `${JSON.stringify(report, null, 2)}\n`;
if (args.out) {
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, output, 'utf8');
} else {
  process.stdout.write(output);
}

function syntheticRows(): LegacyAudienceInputRow[] {
  return [
    {
      source_row_number: 2,
      source_sheet: 'synthetic',
      display_name: 'Synthetic Active Family',
      email: 'synthetic.active.family@example.test',
      phone: '',
      audience_type: 'family',
      legacy_system_state: 'present',
      active_legacy_user: true,
      new_system_activated: false,
      lead_state: 'lead',
      consent_state: 'opted_in',
      suppression_state: 'active',
      source_tags: ['family'],
    },
    {
      source_row_number: 3,
      source_sheet: 'synthetic',
      display_name: 'Synthetic Missing Identity',
      email: '',
      phone: '',
      audience_type: 'family',
      legacy_system_state: 'unknown',
      active_legacy_user: false,
      new_system_activated: false,
      lead_state: 'unknown',
      consent_state: 'unknown',
      suppression_state: 'active',
      source_tags: ['manual_review'],
    },
    {
      source_row_number: 4,
      source_sheet: 'synthetic',
      display_name: 'Synthetic Suppressed Family',
      email: 'synthetic.suppressed.family@example.test',
      phone: '',
      audience_type: 'family',
      legacy_system_state: 'present',
      active_legacy_user: true,
      new_system_activated: false,
      lead_state: 'lead',
      consent_state: 'opted_out',
      suppression_state: 'suppressed',
      source_tags: ['do_not_contact'],
    },
  ];
}

function syntheticContacts(): LegacyAudienceExistingContact[] {
  return [
    {
      account_key: 'acct_w12_01_synthetic',
      product_key: 'prod_w12_01_synthetic',
      contact_key: 'contact_w12_01_existing',
      public_contact_id: 'public_w12_01_existing',
      display_name: 'Synthetic Active Family',
      email_normalized: 'synthetic.active.family@example.test',
      phone_normalized: null,
      archived_at: null,
      suppression_state: 'active',
    },
  ];
}

function parseArgs(argv: string[]) {
  return {
    out: argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length),
  };
}
