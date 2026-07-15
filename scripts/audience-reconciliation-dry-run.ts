import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildAudienceDryRunReport,
  summarizeDryRunReport,
} from '../packages/domain/src/audience/dry-run.ts';
import { buildSyntheticAudienceFixture } from './support/audience-synthetic-fixtures.ts';

const count = readCountArg(process.argv);
const writeReport = process.argv.includes('--write-report');
const fixture = buildSyntheticAudienceFixture(count);
const report = buildAudienceDryRunReport(fixture);
const summary = summarizeDryRunReport(report);
const output = `${JSON.stringify(summary, null, 2)}\n`;
process.stdout.write(output);

if (writeReport) {
  const evidenceDir = path.resolve(process.cwd(), 'ops/evidence/ot-74');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'dry-run-report.json'), output, 'utf8');
  await writeFile(
    path.join(evidenceDir, 'dry-run-report.md'),
    [
      '# OT-74 Synthetic Dry-Run Report',
      '',
      `Rows checked: ${summary.row_count}`,
      `Unique rows: ${summary.unique_row_count}`,
      `Duplicate rows: ${summary.duplicate_row_count}`,
      '',
      'No real spreadsheets were ingested. No row contents are printed.',
      '',
      '```json',
      JSON.stringify(summary, null, 2),
      '```',
      '',
    ].join('\n'),
    'utf8',
  );
}

function readCountArg(argv: string[]) {
  const countArg = argv.find((arg) => arg.startsWith('--count='));
  if (!countArg) return 12;
  const value = Number.parseInt(countArg.slice('--count='.length), 10);
  if (!Number.isFinite(value) || value < 1 || value > 10000) {
    throw new Error('--count must be between 1 and 10000');
  }
  return value;
}
