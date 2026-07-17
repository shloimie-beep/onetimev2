import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  runW12100SourcePreflight,
  type ApprovedSource,
} from '../../../scripts/w12-100/data/real-source-preflight.ts';

const execFileAsync = promisify(execFile);

describe('W12-100-04 source preflight integration', () => {
  it('excludes unapproved spreadsheets before parsing any row values', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-unapproved-'));
    const approvedCsv = [
      'Name,Email,Subscription Status',
      'Safe Fixture,safe@example.test,subscribed',
    ].join('\n');
    const unapprovedCsv = [
      'Name,Email,Message Body',
      'External Lead,external.lead@example.test,private message text',
    ].join('\n');
    await writeFile(path.join(directory, 'approved.csv'), approvedCsv, 'utf8');
    await writeFile(path.join(directory, 'external-leads.csv'), unapprovedCsv, 'utf8');

    const result = await runW12100SourcePreflight({
      sourceDir: directory,
      approvedSources: [approval('approved.csv', approvedCsv)],
      now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('blocked');
    expect(result.blocked_reasons).toContain('BLOCKED_UNAPPROVED_SOURCE_FILE_PRESENT');
    expect(result.validation.unapproved_supported_file_count).toBe(1);
    expect(result.summary.total_rows).toBe(0);
    expect(result.excluded_sources_policy).toMatchObject({
      external_lead_lists_excluded: true,
      message_bodies_excluded: true,
    });
    expect(serialized).not.toContain('External Lead');
    expect(serialized).not.toContain('external.lead@example.test');
    expect(serialized).not.toContain('private message text');
  });

  it('CLI records apply mode as blocked instead of implementing it', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-cli-'));
    const outPath = path.join(directory, 'blocked-apply.json');
    await execFileAsync(process.execPath, [
      '--import',
      'tsx',
      path.join(process.cwd(), 'scripts/w12-100/data/real-source-preflight.ts'),
      '--apply',
      `--out=${outPath}`,
    ]);
    const result = JSON.parse(await readFile(outPath, 'utf8')) as {
      status: string;
      blocked_reasons: string[];
      w12_01_import_contract_compatibility: { apply_mode_implemented: boolean };
      privacy_and_safety: { database_writes_performed: boolean; production_mutation_count: number };
    };

    expect(result.status).toBe('blocked');
    expect(result.blocked_reasons).toContain('BLOCKED_APPLY_MODE_NOT_IMPLEMENTED_IN_W12_100_04');
    expect(result.w12_01_import_contract_compatibility.apply_mode_implemented).toBe(false);
    expect(result.privacy_and_safety.database_writes_performed).toBe(false);
    expect(result.privacy_and_safety.production_mutation_count).toBe(0);
  });
});

function approval(fileName: string, content: string): ApprovedSource {
  return {
    id: 'SYNTH-INTEGRATION',
    fileName,
    classification: 'email_audience_export',
    sha256: createHash('sha256').update(content).digest('hex'),
    expectedRows: 1,
    expectedColumns: 3,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'unknown',
    defaultSuppressionState: 'active',
  };
}
