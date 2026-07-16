#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { TASK_ID, flagValue, outputJson, parseArgs, writeJson } from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const outFile = flagValue(flags, 'out');
const source = readFileSync('apps/worker/src/main/index.ts', 'utf8');
const checks = {
  uses_for_update_skip_locked: /FOR UPDATE SKIP LOCKED/i.test(source),
  sink_delivery_status_present: /sink_delivered/.test(source),
  bounded_limit_present: /LIMIT\s+25/i.test(source),
  provider_send_code_present: /sendgrid|resend|whatsapp|telegram|stripe|buffer/i.test(source),
};
const failures = [];
if (!checks.uses_for_update_skip_locked) failures.push('missing_skip_locked');
if (!checks.sink_delivery_status_present) failures.push('missing_sink_delivery_status');
if (!checks.bounded_limit_present) failures.push('missing_bounded_limit');
if (checks.provider_send_code_present) failures.push('provider_send_code_present');
const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  mode: 'offline_source_smoke',
  checks,
  status: failures.length ? 'fail' : 'pass',
  failures,
};

if (outFile) writeJson(outFile, result);
outputJson(result);
if (failures.length) process.exit(1);
