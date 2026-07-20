import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  exactOneTimeProviderCanaryAuthorizationStatement,
  ONE_TIME_PROVIDER_CANARY_CONFIRMATION,
  ONE_TIME_PROVIDER_CANARY_KEYS,
  runProviderCanaryReadinessPreflight,
} from '../../../scripts/w12-100/providers/provider-canary-readiness-preflight.ts';

describe('One Time provider canary readiness preflight', () => {
  it('reports blocked provider and protected-input state without raw values', async () => {
    const fixture = await fixtureWorkspace({
      providerMode: 'disabled_missing_manifest',
      canaryState: 'not_run',
      missingNames: ['PROVIDER_SECRET_VALUE'],
      reportStatus: 'pending_private_authorization',
    });
    const report = await runProviderCanaryReadinessPreflight({
      ...fixture.options,
      now: new Date('2026-07-19T17:00:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('blocked');
    expect(report.checks).toMatchObject({
      provider_canaries_report_available: true,
      provider_canaries_report_readable_json: true,
      provider_canaries_report_status_ready_to_run: false,
      provider_canaries_external_effects_safe: true,
      all_required_providers_present: true,
      all_required_providers_ready_to_run: false,
      private_authorization_manifest_present: false,
      operator_authorization_present: false,
      production_confirmation_present: false,
      no_raw_values_in_report: true,
      no_provider_side_effects: true,
    });
    expect(report.blocked_reasons).toEqual(
      expect.arrayContaining([
        'BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED',
        'BLOCKED_PRIVATE_CANARY_AUTHORIZATION_NOT_PROVIDED',
        'BLOCKED_PROVIDER_CANARIES_REPORT_NOT_READY_TO_RUN',
        'BLOCKED_PROVIDER_CANARY_CONFIRMATION_NOT_PROVIDED',
        'BLOCKED_PROVIDER_WHATSAPP_NOT_READY_TO_RUN',
      ]),
    );
    expect(serialized).not.toContain('private-manifest-value');
    expect(serialized).not.toContain('operator-secret-value');
  });

  it('accepts readiness only with ready report, manifest, exact authorization, and confirmation', async () => {
    const fixture = await fixtureWorkspace({
      providerMode: 'configured',
      canaryState: 'ready_to_run',
      missingNames: [],
      reportStatus: 'ready_to_run',
    });
    const authorization = exactOneTimeProviderCanaryAuthorizationStatement({
      providerCanariesReportSha256: fixture.providerCanariesReportSha256,
      providerKeys: ONE_TIME_PROVIDER_CANARY_KEYS,
      targetEnvironment: 'production',
    });
    await writeJson(fixture.privateAuthorizationFile, {
      target_environment: 'production',
      provider_canaries_authorized: true,
      provider_canaries_report_sha256: fixture.providerCanariesReportSha256,
      authorized_providers: [...ONE_TIME_PROVIDER_CANARY_KEYS],
      raw_values_included: false,
      private_note: 'private-manifest-value',
    });
    await writeFile(fixture.operatorAuthorizationFile, `${authorization}\n`, 'utf8');
    await writeFile(
      fixture.productionConfirmationFile,
      `${ONE_TIME_PROVIDER_CANARY_CONFIRMATION}\n`,
      'utf8',
    );

    const report = await runProviderCanaryReadinessPreflight({
      ...fixture.options,
      now: new Date('2026-07-19T17:01:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('ready');
    expect(report.blocked_reasons).toEqual([]);
    expect(report.approved_scope).toMatchObject({
      provider_canaries_report_sha256: fixture.providerCanariesReportSha256,
      required_authorization_statement: authorization,
      required_confirmation: ONE_TIME_PROVIDER_CANARY_CONFIRMATION,
    });
    expect(report.checks).toMatchObject({
      all_required_providers_ready_to_run: true,
      private_authorization_manifest_required_providers_authorized: true,
      private_authorization_manifest_report_sha_matches: true,
      operator_authorization_matches_required: true,
      production_confirmation_matches_required: true,
    });
    expect(serialized).not.toContain('private-manifest-value');
    expect(serialized).not.toContain('operator-secret-value');
  });
});

async function fixtureWorkspace(input: {
  canaryState: string;
  missingNames: string[];
  providerMode: string;
  reportStatus: string;
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'provider-canary-readiness-'));
  const providerCanariesReportFile = path.join(directory, 'PROVIDER-CANARIES.json');
  const privateAuthorizationFile = path.join(directory, 'CANARY-AUTHORIZATION.private.json');
  const operatorAuthorizationFile = path.join(directory, 'OPERATOR-AUTH.private.txt');
  const productionConfirmationFile = path.join(directory, 'CONFIRM.private.txt');
  const providerCanariesReport = {
    schema_version: 'fixture.provider_canaries.v1',
    status: input.reportStatus,
    providers: Object.fromEntries(
      ONE_TIME_PROVIDER_CANARY_KEYS.map((key) => [
        key,
        {
          mode: input.providerMode,
          canary: input.canaryState,
          kill_switch: `KILL_SWITCH_${key.toUpperCase()}`,
          missing_or_blocking_names: input.missingNames,
        },
      ]),
    ),
    external_effects: {
      provider_canaries_run: 0,
      external_sends: 0,
      provider_writes: 0,
      live_charges: 0,
    },
  };
  await writeJson(providerCanariesReportFile, providerCanariesReport);

  return {
    operatorAuthorizationFile,
    privateAuthorizationFile,
    productionConfirmationFile,
    providerCanariesReportSha256: sha256(`${JSON.stringify(providerCanariesReport, null, 2)}\n`),
    options: {
      operatorAuthorizationFile,
      privateCanaryAuthorizationFile: privateAuthorizationFile,
      productionConfirmationFile,
      providerCanariesReportFile,
      targetEnvironment: 'production' as const,
    },
  };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
