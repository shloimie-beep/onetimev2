import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  collectIdentityFilters,
  createPostgresLegacyAudienceRepository,
  LegacyAudienceIdempotencyConflictError,
} from '../../packages/db/src/audience-reconciliation/repository.ts';
import { createLegacyAudienceDryRun } from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

const actor = { accountKey: 'acct_ot74', productKey: 'prod_ot74', userKey: 'user_ot74' };

let pool: DbPool;
let repository: ReturnType<typeof createPostgresLegacyAudienceRepository>;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  repository = createPostgresLegacyAudienceRepository(pool);
  await seedContacts(pool);
});

describe('OT-74 legacy audience PostgreSQL repository', () => {
  it('applies migration 1201 and records dry-run rows without mutating contacts', async () => {
    const request = dryRunRequest([
      row({ source_row_number: 2, email: 'match@example.test', active_legacy_user: true }),
      row({ source_row_number: 3, email: 'new@example.test', active_legacy_user: true }),
      row({ source_row_number: 4, email: 'suppressed@example.test', consent_state: 'opted_out' }),
    ]);
    const contacts = await repository.findContactsByIdentities(
      actor,
      collectIdentityFilters(request.rows),
    );
    const report = createLegacyAudienceDryRun({
      scope: actor,
      request,
      existingContacts: contacts,
    });
    const recorded = await repository.recordDryRun({
      actor,
      idempotencyKey: request.idempotency_key,
      report,
    });

    expect(recorded.replayed).toBe(false);
    expect(report.summary.matched_existing_contacts).toBe(2);
    expect(report.summary.staged_new_contacts).toBe(1);
    expect(report.summary.do_not_contact_rows).toBe(1);

    await expectScalar(
      "SELECT COUNT(*) FROM onetime.schema_migrations WHERE id = '1201_ot74_legacy_audience_reconciliation'",
      '1',
    );
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_import_batches', '1');
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_import_rows', '3');
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_segment_snapshots', '5');
    await expectScalar('SELECT COUNT(*) FROM onetime.contacts', '3');
  });

  it('replays the same dry run idempotently and rejects conflicting reuse', async () => {
    const request = dryRunRequest([row({ source_row_number: 2, email: 'match@example.test' })]);
    const contacts = await repository.findContactsByIdentities(
      actor,
      collectIdentityFilters(request.rows),
    );
    const report = createLegacyAudienceDryRun({
      scope: actor,
      request,
      existingContacts: contacts,
    });
    await repository.recordDryRun({ actor, idempotencyKey: request.idempotency_key, report });
    const replay = await repository.recordDryRun({
      actor,
      idempotencyKey: request.idempotency_key,
      report,
    });

    expect(replay.replayed).toBe(true);
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_import_batches', '1');
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_import_rows', '1');

    const conflictingRequest = dryRunRequest([
      row({ source_row_number: 2, email: 'different@example.test' }),
    ]);
    const conflictingReport = createLegacyAudienceDryRun({
      scope: actor,
      request: { ...conflictingRequest, idempotency_key: request.idempotency_key },
      existingContacts: [],
    });
    await expect(
      repository.recordDryRun({
        actor,
        idempotencyKey: request.idempotency_key,
        report: conflictingReport,
      }),
    ).rejects.toBeInstanceOf(LegacyAudienceIdempotencyConflictError);
  });

  it('records rollback requests without destructive contact deletion', async () => {
    const request = dryRunRequest([row({ source_row_number: 2, email: 'match@example.test' })]);
    const contacts = await repository.findContactsByIdentities(
      actor,
      collectIdentityFilters(request.rows),
    );
    const report = createLegacyAudienceDryRun({
      scope: actor,
      request,
      existingContacts: contacts,
    });
    await repository.recordDryRun({ actor, idempotencyKey: request.idempotency_key, report });

    const rollback = await repository.recordRollbackRequest(actor, {
      batch_key: report.batch_key,
      idempotency_key: 'rollback-request-001',
      reason: 'Synthetic rollback proof',
    });
    const replay = await repository.recordRollbackRequest(actor, {
      batch_key: report.batch_key,
      idempotency_key: 'rollback-request-001',
      reason: 'Synthetic rollback proof',
    });

    expect(rollback.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    await expectScalar('SELECT COUNT(*) FROM onetime.legacy_audience_rollback_records', '1');
    await expectScalar('SELECT COUNT(*) FROM onetime.contacts', '3');
  });

  it('scopes identity lookup to the One Time account and product', async () => {
    const contacts = await repository.findContactsByIdentities(actor, {
      emails: ['other@example.test'],
      phones: ['+972525550777'],
    });
    expect(contacts).toHaveLength(0);
  });
});

async function seedContacts(db: DbPool) {
  await db.query(
    `INSERT INTO onetime.contacts
     (contact_key, public_contact_id, account_key, product_key, display_name,
      family_school_classification, family_or_school, location_text, timezone,
      email_normalized, phone_normalized, reminder_preference, suppression_state,
      source, lead_status, last_activity_at)
     VALUES
      ('contact_match', 'public_match', 'acct_ot74', 'prod_ot74', 'Matched Contact',
       'family', 'Matched Contact', 'Jerusalem', 'Asia/Jerusalem',
       'match@example.test', '+972525550100', 'email', 'active',
       'manual_crm', 'new', now()),
      ('contact_suppressed', 'public_suppressed', 'acct_ot74', 'prod_ot74', 'Suppressed Contact',
       'family', 'Suppressed Contact', 'Jerusalem', 'Asia/Jerusalem',
       'suppressed@example.test', NULL, 'email', 'suppressed',
       'manual_crm', 'new', now()),
      ('contact_other', 'public_other', 'acct_other', 'prod_ot74', 'Other Account',
       'family', 'Other Account', 'Jerusalem', 'Asia/Jerusalem',
       'other@example.test', '+972525550777', 'email', 'active',
       'manual_crm', 'new', now())`,
  );
}

function dryRunRequest(rows: LegacyAudienceInputRow[]) {
  return {
    idempotency_key: `repo-idempotency-${rows[0]?.email ?? 'none'}`,
    source: {
      kind: 'csv_normalized' as const,
      source_label: 'synthetic-repository-fixture',
      worksheet_label: 'repository',
    },
    rows,
  };
}

function row(overrides: Partial<LegacyAudienceInputRow>): LegacyAudienceInputRow {
  return {
    source_row_number: 1,
    display_name: 'Repository Person',
    email: '',
    phone: '',
    audience_type: 'family',
    legacy_system_state: 'unknown',
    active_legacy_user: false,
    lead_state: 'unknown',
    consent_state: 'opted_in',
    suppression_state: 'active',
    source_tags: [],
    ...overrides,
  };
}

async function expectScalar(sql: string, expected: string) {
  const result = await pool.query(sql);
  expect(String(result.rows[0].count)).toBe(expected);
}
