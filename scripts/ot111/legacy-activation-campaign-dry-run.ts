import {
  createLegacyActivationCampaignPreview,
  formatLegacyActivationCampaignPreview,
} from '../../packages/domain/src/audience-reconciliation/activation-campaign.ts';
import {
  createLegacyAudienceDryRun,
  formatLegacyAudienceDryRunReport,
  type LegacyAudienceExistingContact,
} from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

const scope = { accountKey: 'acct_synthetic_ot111', productKey: 'prod_synthetic_ot111' };
const now = new Date('2026-07-16T09:00:00.000Z');
const rows = syntheticRows();
const report = createLegacyAudienceDryRun({
  scope,
  request: {
    idempotency_key: 'synthetic-ot111-audience',
    source: {
      kind: 'csv_normalized',
      source_label: 'synthetic-ot111-generated',
      worksheet_label: 'synthetic',
    },
    rows,
  },
  existingContacts: syntheticContacts(),
  now,
});
const preview = createLegacyActivationCampaignPreview({
  scope,
  report,
  request: {
    idempotency_key: 'synthetic-ot111-preview',
    batch_key: report.batch_key,
    segment: 'active_legacy_family_users',
    channel: 'email',
    template_revision: 'draft-day-one-activation-v1',
    batch_size: 25,
    schedule_not_before: '2026-07-17T09:00:00.000Z',
  },
  now,
});

process.stdout.write(formatLegacyAudienceDryRunReport(report));
process.stdout.write('\n');
process.stdout.write(formatLegacyActivationCampaignPreview(preview));

function syntheticRows(): LegacyAudienceInputRow[] {
  return [
    row({
      source_row_number: 2,
      email: 'active.legacy@example.test',
      active_legacy_user: true,
      legacy_system_state: 'present',
      lead_state: 'lead',
      consent_state: 'opted_in',
    }),
    row({
      source_row_number: 3,
      email: 'other.lead@example.test',
      active_legacy_user: false,
      lead_state: 'lead',
      consent_state: 'opted_in',
    }),
    row({
      source_row_number: 4,
      email: 'school@example.test',
      audience_type: 'school',
      lead_state: 'lead',
      consent_state: 'opted_in',
    }),
    row({
      source_row_number: 5,
      email: 'activated@example.test',
      active_legacy_user: true,
      new_system_activated: true,
      consent_state: 'opted_in',
    }),
    row({
      source_row_number: 6,
      email: 'suppressed@example.test',
      active_legacy_user: true,
      consent_state: 'opted_out',
      suppression_state: 'suppressed',
    }),
    row({
      source_row_number: 7,
      display_name: 'Name Only Review',
      active_legacy_user: true,
      consent_state: 'opted_in',
    }),
  ];
}

function syntheticContacts(): LegacyAudienceExistingContact[] {
  return [
    {
      account_key: scope.accountKey,
      product_key: scope.productKey,
      contact_key: 'contact_active_legacy',
      public_contact_id: 'public_active_legacy',
      display_name: 'Active Legacy',
      email_normalized: 'active.legacy@example.test',
      phone_normalized: null,
      archived_at: null,
      suppression_state: 'active',
      new_system_activated: false,
    },
  ];
}

function row(overrides: Partial<LegacyAudienceInputRow>): LegacyAudienceInputRow {
  return {
    source_row_number: 1,
    display_name: 'Synthetic Person',
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
