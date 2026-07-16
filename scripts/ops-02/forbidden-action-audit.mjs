#!/usr/bin/env node
import {
  TASK_ID,
  flagValue,
  forbiddenActionCounters,
  outputJson,
  parseArgs,
  readJson,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const outFile = flagValue(flags, 'out');
const inputFile = flagValue(flags, 'input');
const counters = inputFile
  ? { ...forbiddenActionCounters, ...readJson(inputFile) }
  : forbiddenActionCounters;
const nonZero = Object.entries(counters)
  .filter(([key]) => key !== 'task_id')
  .filter(([, value]) => value !== 0);
const result = {
  ...counters,
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  status: nonZero.length ? 'fail' : 'pass',
  non_zero_counters: nonZero.map(([key, value]) => ({ key, value })),
};

if (outFile) writeJson(outFile, result);
outputJson(result);
if (nonZero.length) process.exit(1);
