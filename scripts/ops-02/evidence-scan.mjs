#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TASK_ID, flagValue, flagValues, outputJson, parseArgs, writeJson } from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const paths = flagValues(flags, 'path');
const outFile = flagValue(flags, 'out');
const scanRoots = paths.length ? paths : ['ops/codex-runs/OPS-02', 'ops/release/ops-02'];
const findings = [];
const rules = [
  { name: 'database_url', pattern: /postgres(?:ql)?:\/\/[^\s'"<>]+/i },
  { name: 'url_credentials', pattern: /https?:\/\/[^/\s:@]+:[^/\s:@]+@/i },
  {
    name: 'authorization_header',
    pattern: /Authorization:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/i,
  },
  { name: 'cookie_header', pattern: /Cookie:\s*[A-Za-z0-9_]+=.{12,}/i },
  { name: 'private_key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'railway_token_assignment', pattern: /RAILWAY_(?:API_)?TOKEN\s*=\s*[A-Za-z0-9._-]{12,}/ },
  {
    name: 'secret_assignment',
    pattern: /(?:SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*[:=]\s*["']?[A-Za-z0-9+/._=-]{16,}/,
  },
];
for (const root of scanRoots) scanPath(root);

const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  scanned_roots: scanRoots,
  finding_count: findings.length,
  findings,
  status: findings.length ? 'fail' : 'pass',
};

if (outFile) writeJson(outFile, result);
outputJson(result);
if (findings.length) process.exit(1);

function scanPath(path) {
  if (!exists(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const child of readdirSync(path)) scanPath(join(path, child));
    return;
  }
  if (stat.size > 2 * 1024 * 1024) return;
  const text = readFileSync(path, 'utf8');
  for (const rule of rules) {
    if (rule.pattern.test(text)) findings.push({ path, rule: rule.name });
  }
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
