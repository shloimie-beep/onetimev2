import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  exactW12100CrmImportAuthorizationStatement,
  runW12100CrmImportApply,
  runW12100SourcePreflight,
  type ApprovedSource,
  type W12100CrmImportBackupProof,
} from '../../../scripts/w12-100/data/real-source-preflight.ts';

let pool: DbPool;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('W12-100-04 real source CRM apply', () => {
  it('imports only CRM-importable rows, records hashed proof, and replays idempotently', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-crm-apply-'));
    const csv = [
      'Name,Email,Phone,Subscription Status,Tags',
      'Opted In Person,optin@example.test,052-555-0301,subscribed,family',
      'Unknown Consent,unknown@example.test,052-555-0302,,family',
      'Suppressed Person,suppressed@example.test,052-555-0303,unsubscribed,family',
      'Duplicate Person,optin@example.test,052-555-0301,subscribed,family',
    ].join('\n');
    await writeFile(path.join(directory, 'synthetic-audience.csv'), csv, 'utf8');
    const approvedSources = [approval('synthetic-audience.csv', csv, 4)];
    const now = new Date('2026-07-19T12:00:00.000Z');
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    });
    const preflight = await runW12100SourcePreflight({
      sourceDir: directory,
      approvedSources,
      now,
    });
    const dryRunReportSha256 = createHash('sha256')
      .update(`${JSON.stringify(preflight, null, 2)}\n`)
      .digest('hex');
    const backupProof: W12100CrmImportBackupProof = {
      target_environment: 'test',
      created_at: now.toISOString(),
      dry_run_report_sha256: dryRunReportSha256,
      approved_source_group_fingerprint: preflight.approved_scope.approved_source_group_fingerprint,
      total_rows: preflight.summary.total_rows,
      crm_importable: preflight.summary.crm_importable,
      raw_values_included: false,
    };
    const operatorAuthorizationStatement = exactW12100CrmImportAuthorizationStatement({
      dryRunReportSha256,
      crmImportable: preflight.summary.crm_importable,
      targetEnvironment: 'test',
    });

    const blocked = await runW12100CrmImportApply({
      sourceDir: directory,
      approvedSources,
      pool,
      config,
      backupProof,
      idempotencyKey: 'w12-100-crm-apply-fixture-blocked',
      operatorAuthorizationStatement: 'approved-but-not-exact',
      targetEnvironment: 'test',
      createdByUserKey: 'user_fixture',
      now,
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blocked_reasons).toContain('BLOCKED_EXACT_OPERATOR_AUTHORIZATION_MISMATCH');
    expect(blocked.safety.database_writes_performed).toBe(false);
    await expectTableCount('onetime.contacts', 0);

    const result = await runW12100CrmImportApply({
      sourceDir: directory,
      approvedSources,
      pool,
      config,
      backupProof,
      idempotencyKey: 'w12-100-crm-apply-fixture',
      operatorAuthorizationStatement,
      targetEnvironment: 'test',
      createdByUserKey: 'user_fixture',
      now,
    });

    expect(result.status).toBe('applied');
    expect(result.counts).toMatchObject({
      total_rows: 4,
      crm_importable: 3,
      writable_candidates: 3,
      inserted_contacts: 3,
      skipped_existing_contacts: 0,
      blocked_duplicate: 1,
      email_campaign_eligible: 1,
      whatsapp_campaign_eligible: 0,
      suppressed: 1,
      sends_queued: 0,
    });
    expect(result.safety).toMatchObject({
      backup_proof_verified: true,
      exact_authorization_verified: true,
      database_writes_performed: true,
      external_sends_performed: false,
      provider_mutation_count: 0,
    });
    expect(JSON.stringify(result)).not.toContain('optin@example.test');
    expect(JSON.stringify(result)).not.toContain('052-555-0301');
    expect(JSON.stringify(result)).not.toContain('Opted In Person');

    const contacts = await pool.query(
      `SELECT email_normalized, reminder_preference, suppression_state, lead_status
         FROM onetime.contacts
        ORDER BY email_normalized`,
    );
    expect(contacts.rows).toEqual([
      {
        email_normalized: 'optin@example.test',
        reminder_preference: 'email',
        suppression_state: 'active',
        lead_status: 'new',
      },
      {
        email_normalized: 'suppressed@example.test',
        reminder_preference: 'none',
        suppression_state: 'suppressed',
        lead_status: 'in_review',
      },
      {
        email_normalized: 'unknown@example.test',
        reminder_preference: 'none',
        suppression_state: 'active',
        lead_status: 'in_review',
      },
    ]);
    await expectTableCount('onetime.crm_contact_facts', 6);
    await expectTableCount('onetime.crm_real_source_import_rows', 4);
    await expectTableCount('onetime.audit_events', 4);
    await expectTableCount('onetime.outbox_events', 0);

    const ledgerRawValues = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.crm_real_source_import_rows
        WHERE raw_values_included = false
          AND email_fingerprint IS NOT NULL
          AND phone_fingerprint IS NOT NULL`,
    );
    expect(ledgerRawValues.rows[0].count).toBe(4);

    const replay = await runW12100CrmImportApply({
      sourceDir: directory,
      approvedSources,
      pool,
      config,
      backupProof,
      idempotencyKey: 'w12-100-crm-apply-fixture',
      operatorAuthorizationStatement,
      targetEnvironment: 'test',
      createdByUserKey: 'user_fixture',
      now,
    });
    expect(replay.status).toBe('replayed');
    expect(replay.counts.inserted_contacts).toBe(3);
    expect(replay.safety.database_writes_performed).toBe(false);
    await expectTableCount('onetime.contacts', 3);
    await expectTableCount('onetime.crm_real_source_import_rows', 4);
  });
});

async function expectTableCount(tableName: string, expected: number) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${tableName}`);
  expect(result.rows[0].count).toBe(expected);
}

function approval(fileName: string, content: string, expectedRows: number): ApprovedSource {
  return {
    id: 'SYNTH-APPLY',
    fileName,
    classification: 'email_audience_export',
    sha256: createHash('sha256').update(content).digest('hex'),
    expectedRows,
    expectedColumns: 5,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'unknown',
    defaultSuppressionState: 'active',
  };
}
