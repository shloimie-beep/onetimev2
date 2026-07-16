#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  TASK_ID,
  flagValue,
  outputJson,
  parseArgs,
  readJson,
  sha256File,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const migrationsDir = flagValue(flags, 'migrations', 'packages/db/migrations');
const outFile = flagValue(flags, 'out');
const appliedFile = flagValue(flags, 'applied');
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const migrations = files.map((file, index) => ({
  index,
  id: file.replace(/\.sql$/, ''),
  file,
  sha256: sha256File(join(migrationsDir, file)),
}));

const comparison = appliedFile
  ? compareApplied(readJson(appliedFile), migrations)
  : { mode: 'not_provided' };
const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  migrations_dir: migrationsDir,
  count: migrations.length,
  ledger_sha256: sha256FileLike(JSON.stringify(migrations.map((item) => [item.id, item.sha256]))),
  migrations,
  comparison,
};

if (outFile) writeJson(outFile, result);
outputJson(result);
if (comparison.status === 'fail') process.exit(1);

function compareApplied(applied, expected) {
  const rows = Array.isArray(applied) ? applied : (applied.migrations ?? applied.rows ?? []);
  const failures = [];
  for (const migration of expected) {
    const row = rows.find((item) => item.id === migration.id);
    if (!row) {
      failures.push(`missing:${migration.id}`);
      continue;
    }
    if (row.checksum && row.checksum !== migration.sha256)
      failures.push(`checksum:${migration.id}`);
  }
  return { mode: 'applied_ledger', status: failures.length ? 'fail' : 'pass', failures };
}

function sha256FileLike(text) {
  return createHash('sha256').update(text).digest('hex');
}
