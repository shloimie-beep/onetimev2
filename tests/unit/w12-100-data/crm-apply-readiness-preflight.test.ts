import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION,
  runCrmApplyReadinessPreflight,
} from '../../../scripts/w12-100/data/crm-apply-readiness-preflight.ts';
import { exactW12100CrmImportAuthorizationStatement } from '../../../scripts/w12-100/data/real-source-preflight.ts';

describe('RABBI-DAY-ONE CRM apply readiness preflight', () => {
  it('reports missing protected production-apply inputs without raw values', async () => {
    const fixture = await fixtureWorkspace();
    await writeFile(
      fixture.privateAuthorizationFile,
      JSON.stringify({ dry_run_authorized: true, production_apply_authorized: false }),
      'utf8',
    );

    const report = await runCrmApplyReadinessPreflight({
      ...fixture.options,
      env: {},
      now: new Date('2026-07-19T15:00:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('blocked');
    expect(report.checks).toMatchObject({
      source_packet_available: true,
      dry_run_report_available: true,
      dry_run_report_status_done: true,
      private_authorization_manifest_present: true,
      private_authorization_manifest_production_apply_authorized: false,
      backup_proof_present: false,
      operator_authorization_present: false,
      idempotency_key_present: false,
      created_by_user_key_present: false,
      production_confirmation_present: false,
      manual_review_handling_present: false,
      database_url_configured: false,
      no_raw_values_in_report: true,
      no_production_side_effects: true,
    });
    expect(report.blocked_reasons).toEqual(
      expect.arrayContaining([
        'BLOCKED_BACKUP_PROOF_NOT_PROVIDED',
        'BLOCKED_CREATED_BY_USER_KEY_NOT_PROVIDED',
        'BLOCKED_DATABASE_URL_NOT_CONFIGURED',
        'BLOCKED_IDEMPOTENCY_KEY_NOT_PROVIDED',
        'BLOCKED_MANUAL_REVIEW_HANDLING_NOT_PROVIDED',
        'BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED',
        'BLOCKED_PRIVATE_MANIFEST_PRODUCTION_APPLY_NOT_AUTHORIZED',
        'BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED',
      ]),
    );
    expect(serialized).not.toContain('postgres://fixture');
    expect(serialized).not.toContain('idempotency-fixture');
    expect(serialized).not.toContain('created-by-fixture');
    expect(report.inputs.privateAuthorization?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts readiness only when every guarded protected input matches', async () => {
    const fixture = await fixtureWorkspace();
    const dryRunSha256 = sha256(`${JSON.stringify(fixture.dryRunReport, null, 2)}\n`);
    const requiredAuthorization = exactW12100CrmImportAuthorizationStatement({
      dryRunReportSha256: dryRunSha256,
      crmImportable: fixture.dryRunReport.summary.crm_importable,
      targetEnvironment: 'production',
    });
    await writeFile(
      fixture.privateAuthorizationFile,
      JSON.stringify({ dry_run_authorized: true, production_apply_authorized: true }),
      'utf8',
    );
    await writeFile(
      fixture.backupProofFile,
      JSON.stringify({
        target_environment: 'production',
        created_at: '2026-07-19T15:01:00.000Z',
        dry_run_report_sha256: dryRunSha256,
        approved_source_group_fingerprint:
          fixture.dryRunReport.approved_scope.approved_source_group_fingerprint,
        total_rows: fixture.dryRunReport.summary.total_rows,
        crm_importable: fixture.dryRunReport.summary.crm_importable,
        raw_values_included: false,
      }),
      'utf8',
    );
    await writeFile(fixture.operatorAuthorizationFile, `${requiredAuthorization}\n`, 'utf8');
    await writeFile(fixture.idempotencyKeyFile, 'idempotency-fixture\n', 'utf8');
    await writeFile(fixture.createdByUserKeyFile, 'created-by-fixture\n', 'utf8');
    await writeFile(
      fixture.productionConfirmationFile,
      `${RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION}\n`,
      'utf8',
    );
    await writeFile(
      fixture.manualReviewHandlingFile,
      JSON.stringify({
        manual_review_rows: fixture.dryRunReport.summary.manual_review_rows,
        excluded_from_apply: true,
        terminal_decisions_recorded: false,
        raw_values_included: false,
      }),
      'utf8',
    );

    const report = await runCrmApplyReadinessPreflight({
      ...fixture.options,
      env: { DATABASE_URL: 'postgres://fixture-secret' },
      now: new Date('2026-07-19T15:02:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('ready');
    expect(report.blocked_reasons).toEqual([]);
    expect(report.approved_scope).toMatchObject({
      dry_run_report_sha256: dryRunSha256,
      crm_importable: fixture.dryRunReport.summary.crm_importable,
      manual_review_rows: fixture.dryRunReport.summary.manual_review_rows,
      required_authorization_statement: requiredAuthorization,
    });
    expect(report.checks).toMatchObject({
      backup_proof_raw_values_excluded: true,
      manual_review_raw_values_excluded: true,
      operator_authorization_matches_required: true,
      production_confirmation_matches_required: true,
      database_url_configured: true,
    });
    expect(serialized).not.toContain('postgres://fixture-secret');
    expect(serialized).not.toContain('idempotency-fixture');
    expect(serialized).not.toContain('created-by-fixture');
  });
});

async function fixtureWorkspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rabbi-crm-apply-readiness-'));
  const sourcePacketDir = path.join(directory, 'source-packet');
  await mkdir(sourcePacketDir);
  const dryRunReport = {
    status: 'done',
    approved_scope: {
      approved_source_group_fingerprint: 'source-group-fixture',
    },
    summary: {
      total_rows: 4,
      crm_importable: 3,
      manual_review_rows: 1,
    },
  };
  const dryRunReportFile = path.join(directory, 'crm-corrected-dry-run.json');
  await writeFile(dryRunReportFile, `${JSON.stringify(dryRunReport, null, 2)}\n`, 'utf8');
  const privateAuthorizationFile = path.join(directory, 'CRM-IMPORT-AUTHORIZATION.private.json');
  const backupProofFile = path.join(directory, 'BACKUP.private.json');
  const operatorAuthorizationFile = path.join(directory, 'OPERATOR-AUTH.private.txt');
  const idempotencyKeyFile = path.join(directory, 'IDEMPOTENCY.private.txt');
  const createdByUserKeyFile = path.join(directory, 'CREATED-BY.private.txt');
  const productionConfirmationFile = path.join(directory, 'CONFIRM.private.txt');
  const manualReviewHandlingFile = path.join(directory, 'MANUAL-REVIEW.private.json');
  return {
    backupProofFile,
    createdByUserKeyFile,
    dryRunReport,
    idempotencyKeyFile,
    manualReviewHandlingFile,
    operatorAuthorizationFile,
    privateAuthorizationFile,
    productionConfirmationFile,
    options: {
      backupProofFile,
      createdByUserKeyFile,
      dryRunReportFile,
      idempotencyKeyFile,
      manualReviewHandlingFile,
      operatorAuthorizationFile,
      privateAuthorizationFile,
      productionConfirmationFile,
      sourcePacketDir,
      targetEnvironment: 'production' as const,
    },
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
