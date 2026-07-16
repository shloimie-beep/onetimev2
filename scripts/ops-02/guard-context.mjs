#!/usr/bin/env node
import {
  EXPECTED_REPOSITORY,
  TASK_ID,
  flagValue,
  flattenStrings,
  outputJson,
  parseArgs,
  readJson,
  repoReceipt,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const repo = flagValue(flags, 'repo', process.cwd());
const outFile = flagValue(flags, 'out');
const inventoryFile = flagValue(flags, 'railway-inventory');
const expectedSha = flagValue(flags, 'expected-sha');
const receipt = repoReceipt(repo);
const failures = [];

if (receipt.normalized_origin !== EXPECTED_REPOSITORY)
  failures.push(`origin:${receipt.normalized_origin}`);
if (expectedSha && receipt.head_sha !== expectedSha)
  failures.push(`source_sha:${receipt.head_sha}`);

let denylist = {
  bna: 0,
  skillful_motivation: 0,
  one_time_production: 0,
  production_environment: 0,
};
if (inventoryFile) {
  const inventory = readJson(inventoryFile);
  const text = flattenStrings(inventory).join('\n').toLowerCase();
  denylist = {
    bna: (text.match(/bna|bnei|academy/g) ?? []).length,
    skillful_motivation: (text.match(/skillful-motivation/g) ?? []).length,
    one_time_production: (text.match(/one-time-production/g) ?? []).length,
    production_environment: (text.match(/\bproduction\b/g) ?? []).length,
  };
  if (denylist.bna) failures.push('denylist:bna');
  if (denylist.skillful_motivation) failures.push('denylist:skillful-motivation');
  if (denylist.one_time_production) failures.push('denylist:one-time-production');
  if (denylist.production_environment) failures.push('denylist:production');
}

const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  status: failures.length ? 'fail' : 'pass',
  git: receipt,
  denylist,
  failures,
};

if (outFile) writeJson(outFile, result);
outputJson(result);
if (failures.length) process.exit(1);
