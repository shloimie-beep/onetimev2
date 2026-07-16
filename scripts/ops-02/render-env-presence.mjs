#!/usr/bin/env node
import {
  TASK_ID,
  flagValue,
  outputJson,
  parseArgs,
  protectedConfigNames,
  readJson,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const outFile = flagValue(flags, 'out');
const namesFile = flagValue(flags, 'names-file');
const names = namesFile ? readNames(namesFile) : protectedConfigNames;
const variables = names.map((name) => ({
  name,
  present: process.env[name] !== undefined && process.env[name] !== '',
}));
const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  value_output_policy: 'names_and_presence_only',
  variables,
};

if (outFile) writeJson(outFile, result);
outputJson(result);

function readNames(file) {
  const parsed = readJson(file);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.protected_configuration_names))
    return parsed.protected_configuration_names;
  throw new Error('names file must be an array or contain protected_configuration_names');
}
