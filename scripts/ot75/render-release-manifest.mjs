import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEMPLATE_PATH = 'ops/release/ot75/release-manifest.template.json';

function main() {
  const outIndex = process.argv.indexOf('--out');
  const outPath = outIndex === -1 ? null : process.argv[outIndex + 1];
  const template = JSON.parse(readFileSync(path.resolve(ROOT, TEMPLATE_PATH), 'utf8'));
  const currentSha = git(['rev-parse', 'HEAD']).trim();

  const manifest = {
    ...template,
    generated_at: new Date().toISOString(),
    release_id: process.env.OT80_RELEASE_ID ?? template.release_id,
    integrated_heads: {
      web: process.env.OT80_WEB_SOURCE_SHA ?? currentSha,
      delivery_worker: process.env.OT80_DELIVERY_WORKER_SOURCE_SHA ?? currentSha,
      provider_worker: process.env.OT80_PROVIDER_WORKER_SOURCE_SHA ?? currentSha,
      telegram_worker: process.env.OT80_TELEGRAM_WORKER_SOURCE_SHA ?? currentSha,
    },
    source_readback: {
      expected_source_sha: process.env.OT75_EXPECTED_SOURCE_SHA ?? currentSha,
      staging_readback_sha: process.env.OT75_STAGING_READBACK_SHA ?? 'TO_BE_FILLED_BY_OT80',
      production_readback_sha_before_cutover:
        process.env.OT75_PRODUCTION_READBACK_SHA ?? 'TO_BE_FILLED_BY_OT80',
    },
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (outPath) {
    const absolute = path.resolve(ROOT, outPath);
    assertSafeOutputPath(outPath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, serialized);
    process.stdout.write(`Wrote ${outPath}\n`);
  } else {
    process.stdout.write(serialized);
  }
}

function assertSafeOutputPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.startsWith('ops/release/ot75/evidence/')) {
    throw new Error('Manifest output must stay under ops/release/ot75/evidence/.');
  }
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

main();
