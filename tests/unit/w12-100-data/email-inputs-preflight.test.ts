import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runEmailInputsPreflight } from '../../../scripts/w12-100/email/email-inputs-preflight.ts';

describe('RABBI-DAY-ONE email inputs preflight', () => {
  it('reports protected provider files without raw values and blocks missing canary destination', async () => {
    const keyholderDir = await fixtureKeyholder();

    const report = await runEmailInputsPreflight({
      keyholderDir,
      now: new Date('2026-07-19T14:30:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('blocked');
    expect(report.blocked_reasons).toEqual(['BLOCKED_CANARY_DESTINATION_FILE_NOT_PROVIDED']);
    expect(report.checks).toMatchObject({
      resend_api_key_present: true,
      resend_webhook_secret_present: true,
      approved_domain_matches: true,
      approved_sender_matches: true,
      approved_reply_to_matches: true,
      canary_destination_present: false,
      no_raw_values_in_report: true,
    });
    expect(report.protected_sources).toMatchObject({
      private_manifest_written: false,
      raw_values_included: false,
      secrets_printed: false,
    });
    expect(serialized).not.toContain('re_secret_fixture');
    expect(serialized).not.toContain('whsec_fixture');
    expect(serialized).not.toContain('operator@example.test');
    expect(report.inputs.resendApiKey?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('writes a private manifest only when all protected inputs are present', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'rabbi-day-one-email-ready-'));
    const keyholderDir = await fixtureKeyholder(directory);
    const canaryPath = path.join(directory, 'operator-canary-email.private.txt');
    const manifestPath = path.join(directory, 'EMAIL-INPUTS.private.json');
    await writeFile(canaryPath, 'operator@example.test\n', 'utf8');

    const report = await runEmailInputsPreflight({
      keyholderDir,
      canaryEmailFile: canaryPath,
      privateManifestOut: manifestPath,
      authorizationId: 'auth_rabbi_day_one_email_fixture',
      now: new Date('2026-07-19T14:31:00.000Z'),
    });
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      railway_variables: Record<string, string>;
      external_send_authorization: { allowed_recipients: string[] };
    };
    const serialized = JSON.stringify(report);

    expect(report.status).toBe('ready');
    expect(report.blocked_reasons).toEqual([]);
    expect(report.protected_sources.private_manifest_written).toBe(true);
    expect(report.private_manifest.railway_variables_ready).toBe(true);
    expect(report.private_manifest.variable_names).toContain('ONE_TIME_LIFECYCLE_EMAIL_MODE');
    expect(manifest.railway_variables).toMatchObject({
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
      ONE_TIME_EMAIL_FROM: 'info@onetimeonetime.com',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      RESEND_API_KEY: 're_secret_fixture',
      RESEND_WEBHOOK_SECRET: 'whsec_fixture',
    });
    expect(manifest.external_send_authorization.allowed_recipients).toEqual([
      'operator@example.test',
    ]);
    expect(serialized).not.toContain('re_secret_fixture');
    expect(serialized).not.toContain('whsec_fixture');
    expect(serialized).not.toContain('operator@example.test');
  });
});

async function fixtureKeyholder(parent?: string) {
  const directory = parent ?? (await mkdtemp(path.join(os.tmpdir(), 'rabbi-day-one-email-')));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'resend-api-key.txt'), 're_secret_fixture\n', 'utf8');
  await writeFile(path.join(directory, 'resend-webhook-secret.txt'), 'whsec_fixture\n', 'utf8');
  await writeFile(path.join(directory, 'resend-domain.txt'), 'onetimeonetime.com\n', 'utf8');
  await writeFile(
    path.join(directory, 'resend-from-email.txt'),
    'info@onetimeonetime.com\n',
    'utf8',
  );
  await writeFile(path.join(directory, 'resend-reply-to.txt'), 'info@onetimeonetime.com\n', 'utf8');
  await writeFile(path.join(directory, 'resend-from-name.txt'), 'One Time\n', 'utf8');
  return directory;
}
