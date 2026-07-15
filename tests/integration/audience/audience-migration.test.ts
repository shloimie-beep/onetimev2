import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT74 audience migration namespace', () => {
  it('applies OT74 migrations between CRM and billing namespaces', async () => {
    const migrations = await pool.query(
      "SELECT id FROM onetime.schema_migrations WHERE id LIKE '%ot74%' OR id LIKE '1000_%' OR id LIKE '1300_%' ORDER BY id",
    );
    expect(migrations.rows.map((row) => row.id)).toEqual([
      '1000_ot42_crm_module_v1',
      '1200_ot74_audience_reconciliation',
      '1201_ot74_legacy_audience_reconciliation',
      '1300_ot46_billing_foundation',
    ]);
  });

  it('stores provenance, reconciliation, segments, and rollback records without contact deletion', async () => {
    await pool.query(
      `INSERT INTO onetime.contacts (
         contact_key, account_key, product_key, display_name, family_school_classification,
         family_or_school, location_text, timezone, email_normalized, phone_normalized,
         reminder_preference, source
       )
       VALUES (
         'contact_existing', 'one_time', 'one_time_mishnah', 'Existing Person', 'family',
         'Existing', 'Jerusalem', 'Asia/Jerusalem', 'existing@example.test', '+972501111111',
         'email', 'test'
       )`,
    );
    await pool.query(
      `INSERT INTO onetime.audience_import_batches
       (batch_key, account_key, product_key, source_spreadsheet_key, source_name, source_kind, row_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        'batch_ot74_test',
        'one_time',
        'one_time_mishnah',
        'sheet_ot74_test',
        'Synthetic test',
        'synthetic_fixture',
        1,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.audience_import_rows (
         row_key, batch_key, account_key, product_key, source_spreadsheet_key,
         source_sheet_name, source_row_number, row_fingerprint, normalized_email,
         normalized_phone, display_name_present, source_facts, consent_status,
         suppression_status, reconciliation_status, matched_contact_key,
         communication_eligibility, entitlement_policy
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18)`,
      [
        'row_ot74_test',
        'batch_ot74_test',
        'one_time',
        'one_time_mishnah',
        'sheet_ot74_test',
        'Sheet1',
        2,
        'a'.repeat(64),
        'existing@example.test',
        '+972501111111',
        true,
        JSON.stringify({
          is_lead: true,
          in_old_system: true,
          active_legacy_user: true,
          school_submission: false,
        }),
        'consented',
        'active',
        'matched_existing',
        'contact_existing',
        'eligible',
        'not_applicable',
      ],
    );
    await pool.query(
      `INSERT INTO onetime.audience_segment_assignments
       (assignment_key, account_key, product_key, segment_key, batch_key, row_key, contact_key, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        'assign_ot74_test',
        'one_time',
        'one_time_mishnah',
        'migration_invite_eligible',
        'batch_ot74_test',
        'row_ot74_test',
        'contact_existing',
        'eligible dry-run segment',
      ],
    );
    await pool.query(
      `INSERT INTO onetime.audience_import_rollbacks
       (rollback_key, account_key, product_key, batch_key, rollback_plan)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [
        'rollback_ot74_test',
        'one_time',
        'one_time_mishnah',
        'batch_ot74_test',
        JSON.stringify({ destructive_contact_deletes: 0 }),
      ],
    );

    const rollback = await pool.query(
      'SELECT destructive_contact_delete FROM onetime.audience_import_rollbacks WHERE rollback_key = $1',
      ['rollback_ot74_test'],
    );
    const contacts = await pool.query('SELECT count(*)::int AS count FROM onetime.contacts');
    expect(rollback.rows[0].destructive_contact_delete).toBe(false);
    expect(contacts.rows[0].count).toBe(1);
  });
});
