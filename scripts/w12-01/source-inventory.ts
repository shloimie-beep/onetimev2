import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LegacyAudienceSourceInventoryManifest } from '../../packages/contracts/src/audience-reconciliation/index.ts';
import { createLegacyAudienceSourceInventory } from '../../packages/domain/src/audience-reconciliation/source-inventory.ts';

const args = parseArgs(process.argv.slice(2));
const defaultDownloads = path.join(process.env.USERPROFILE ?? process.cwd(), 'Downloads');
const root = args.root ?? defaultDownloads;
const label = args.label ?? 'Downloads';
const outDir = args.outDir ?? path.join(process.cwd(), 'ops/codex-runs/W12-01');

const manifest = await createLegacyAudienceSourceInventory({
  roots: [{ label, directory: root }],
  generatedBy: 'codex-w12-01',
});

await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, 'SOURCE-INVENTORY.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(path.join(outDir, 'SOURCE-INVENTORY.md'), renderMarkdown(manifest));
process.stdout.write(
  JSON.stringify(
    {
      out_dir: outDir,
      manifest_sha256: manifest.manifest_sha256,
      summary: manifest.summary,
      raw_values_included: false,
      production_side_effects: false,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');

function parseArgs(argv: string[]) {
  const parsed: { root?: string; label?: string; outDir?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith('--root=')) parsed.root = arg.slice('--root='.length);
    else if (arg.startsWith('--label=')) parsed.label = arg.slice('--label='.length);
    else if (arg.startsWith('--out-dir=')) parsed.outDir = arg.slice('--out-dir='.length);
  }
  return parsed;
}

function renderMarkdown(manifest: LegacyAudienceSourceInventoryManifest) {
  const lines = [
    '# W12-01 Source Inventory',
    '',
    `Generated: ${manifest.generated_at}`,
    `Manifest SHA-256: \`${manifest.manifest_sha256}\``,
    '',
    'Raw row values included: `false`',
    'Production side effects: `false`',
    '',
    '## Summary',
    '',
    `- Files: ${manifest.summary.file_count}`,
    `- Proven One Time: ${manifest.summary.proven_one_time}`,
    `- Mixed / needs review: ${manifest.summary.mixed_needs_review}`,
    `- Unrelated: ${manifest.summary.unrelated}`,
    `- Duplicate: ${manifest.summary.duplicate}`,
    `- Unsupported files: ${manifest.summary.unsupported_files}`,
    `- Possible PII column files: ${manifest.summary.possible_pii_files}`,
    '',
    '## Files',
    '',
    '| File | Class | Size | SHA-256 | Sheets | Columns | Warnings |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
  ];
  for (const file of manifest.files) {
    const sheets = file.sheet_names.join(', ') || 'n/a';
    const columns = Object.values(file.column_names_by_sheet).flat().slice(0, 20).join(', ');
    lines.push(
      `| ${escapeCell(file.file_name)} | ${file.classification} | ${file.byte_size} | \`${file.sha256}\` | ${escapeCell(sheets)} | ${escapeCell(columns || 'n/a')} | ${escapeCell(file.warnings.join(', ') || 'none')} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
