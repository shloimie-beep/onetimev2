import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLegacyAudienceSourceInventory } from '../../packages/domain/src/audience-reconciliation/source-inventory.ts';
import {
  createLegacyAudienceApplyPlan,
  createLegacyAudienceDryRun,
} from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

describe('W12-01 CRM audience import safety', () => {
  it('inventories candidate source files without row values or absolute paths', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-01-inventory-'));
    await writeFile(
      path.join(directory, 'Rabbi Scheller Followers.csv'),
      [
        'Name,Email,Phone,Consent',
        'Private Person,private@example.test,052-555-0123,opted_in',
      ].join('\n'),
    );
    await writeFile(
      path.join(directory, 'rabbi_sheller_business_structure.csv'),
      'Date,Amount\n2026-01-01,10\n',
    );
    await writeFile(path.join(directory, 'balance_history.csv'), 'Date,Amount\n2026-01-01,10\n');

    const manifest = await createLegacyAudienceSourceInventory({
      roots: [{ label: 'synthetic-downloads', directory }],
      generatedBy: 'unit-test',
      now: new Date('2026-07-17T09:00:00.000Z'),
    });
    const serialized = JSON.stringify(manifest);

    expect(manifest.raw_values_included).toBe(false);
    expect(manifest.production_side_effects).toBe(false);
    expect(manifest.summary.file_count).toBe(2);
    expect(manifest.summary.proven_one_time).toBe(1);
    expect(manifest.summary.unrelated).toBe(1);
    expect(serialized).toContain('Name');
    expect(serialized).toContain('Email');
    expect(serialized).not.toContain('balance_history.csv');
    expect(serialized).not.toContain('Private Person');
    expect(serialized).not.toContain('private@example.test');
    expect(serialized).not.toContain(directory);
  });

  it('requires exact manifest, counts, authorization, and non-production target before apply', () => {
    const report = createLegacyAudienceDryRun({
      scope: { accountKey: 'acct_w12', productKey: 'prod_w12' },
      request: {
        idempotency_key: 'w12-unit-report',
        source: {
          kind: 'csv_normalized',
          source_label: 'synthetic-w12',
          worksheet_label: 'unit',
        },
        rows: [
          row({
            source_row_number: 2,
            email: 'ready@example.test',
            active_legacy_user: true,
            consent_state: 'opted_in',
          }),
        ],
      },
      existingContacts: [],
      now: new Date('2026-07-17T09:00:00.000Z'),
    });

    const dryRun = createLegacyAudienceApplyPlan({
      report,
      request: {
        batch_key: report.batch_key,
        idempotency_key: 'apply-plan-dry-run',
        mode: 'dry_run',
        manifest_sha256: report.source_digest,
        expected_total_rows: report.summary.total_rows,
        expected_unique_rows: report.summary.unique_rows,
        expected_manual_review_rows: report.summary.manual_review_rows,
        target_environment: 'test',
      },
    });
    expect(dryRun).toMatchObject({
      status: 'dry_run',
      real_bulk_import_applied: false,
      production_side_effects: false,
    });

    const blocked = createLegacyAudienceApplyPlan({
      report,
      request: {
        batch_key: report.batch_key,
        idempotency_key: 'apply-plan-production',
        mode: 'apply',
        manifest_sha256: report.source_digest,
        expected_total_rows: report.summary.total_rows,
        expected_unique_rows: report.summary.unique_rows,
        expected_manual_review_rows: report.summary.manual_review_rows,
        target_environment: 'production',
      },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blocked_reasons).toEqual(
      expect.arrayContaining(['missing_operator_authorization', 'production_target_declared']),
    );
    expect(blocked.real_bulk_import_applied).toBe(false);
  });
});

function row(overrides: Partial<LegacyAudienceInputRow>): LegacyAudienceInputRow {
  return {
    source_row_number: 1,
    display_name: 'W12 Person',
    email: '',
    phone: '',
    audience_type: 'family',
    legacy_system_state: 'unknown',
    active_legacy_user: false,
    new_system_activated: false,
    lead_state: 'lead',
    consent_state: 'unknown',
    suppression_state: 'active',
    source_tags: [],
    ...overrides,
  };
}
