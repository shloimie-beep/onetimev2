#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TASK_ID,
  flagValue,
  normalizeOrigin,
  outputJson,
  parseArgs,
  redactForLog,
  repoReceipt,
  run,
  tryJsonCommand,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const repo = flagValue(flags, 'repo', process.cwd());
const outFile = flagValue(flags, 'out');
const includeRailway = flags.has('railway-readonly');
const tempDir = mkdtempSync(join(tmpdir(), 'ops-02-inventory-'));

try {
  const receipt = repoReceipt(repo);
  const inventory = {
    task_id: TASK_ID,
    generated_at_utc: new Date().toISOString(),
    git: {
      ...receipt,
      origin_ok: normalizeOrigin(receipt.origin_url) === 'webcraft-media/onetimev2',
    },
    tools: {
      git: commandVersion('git', ['--version']),
      gh: commandVersion('gh', ['--version']),
      railway: commandVersion('railway', ['--version']),
    },
    railway: includeRailway ? collectRailway(repo) : { mode: 'not_requested' },
    temp_raw_deleted: false,
  };
  rmSync(tempDir, { recursive: true, force: true });
  inventory.temp_raw_deleted = !existsSync(tempDir);
  if (outFile) writeJson(outFile, inventory);
  outputJson(inventory);
} finally {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}

function commandVersion(command, args) {
  const result = run(command, args, { cwd: process.cwd() });
  return result.ok
    ? { available: true, first_line: result.stdout.split('\n').find(Boolean) ?? '' }
    : { available: false, error: result.error ?? result.stderr.trim() };
}

function collectRailway(repoPath) {
  const commands = [
    ['whoami'],
    ['project', 'list', '--json'],
    ['status', '--json'],
    ['environment', 'list', '--json'],
    ['service', 'list', '--json'],
    ['service', 'status', '--all', '--json'],
  ];
  const results = [];
  for (const args of commands) {
    const result = args.includes('--json')
      ? tryJsonCommand('railway', args, repoPath)
      : run('railway', args, { cwd: repoPath });
    if ('value' in result) {
      results.push({
        command: ['railway', ...args].join(' '),
        ok: result.ok,
        value: redactRailway(result.value),
      });
    } else {
      results.push({
        command: ['railway', ...args].join(' '),
        ok: result.ok,
        status: result.status,
        text: redactForLog(
          result.ok ? result.stdout.trim() : (result.error ?? result.stderr.trim()),
        ),
      });
    }
  }
  const strings = JSON.stringify(results).toLowerCase();
  return {
    mode: 'readonly',
    commands: results,
    denylist: {
      bna_matches: (strings.match(/bna|bnei|academy/g) ?? []).length,
      skillful_motivation_matches: (strings.match(/skillful-motivation/g) ?? []).length,
      one_time_production_matches: (strings.match(/one-time-production/g) ?? []).length,
      production_environment_matches: (
        strings.match(/"production"|: production|\bproduction\b/g) ?? []
      ).length,
    },
  };
}

function redactRailway(value) {
  if (Array.isArray(value)) return value.map(redactRailway);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|url|connection|password|key/i.test(key)) {
      out[key] = item ? '[redacted-present]' : item;
    } else {
      out[key] = redactRailway(item);
    }
  }
  return out;
}
