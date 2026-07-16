import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const TASK_ID = 'OPS-02';
export const EXPECTED_REPOSITORY = 'webcraft-media/onetimev2';
export const EXPECTED_ORIGINS = new Set([
  'https://github.com/webcraft-media/onetimev2.git',
  'git@github.com:webcraft-media/onetimev2.git',
]);

export const protectedConfigNames = [
  'OPS02_RAILWAY_WORKSPACE',
  'OPS02_APPROVED_STAGING_PROJECT_ID',
  'OPS02_APPROVED_STAGING_ENVIRONMENT_ID',
  'OPS02_STAGING_WEB_SERVICE_ID',
  'OPS02_STAGING_WORKER_SERVICE_ID',
  'OPS02_STAGING_DATABASE_SERVICE_ID',
  'OPS02_STAGING_DATABASE_REFERENCE_ID',
  'OPS02_STAGING_HOSTNAME',
  'OPS02_PRODUCTION_DATABASE_REFERENCE_ID',
  'OPS02_EXPECTED_SOURCE_SHA',
  'OPS02_PREVIOUS_APPROVED_SOURCE_SHA',
  'DATABASE_URL',
  'AUTH_CSRF_SECRET',
  'MFA_SECRET_ENCRYPTION_KEY',
  'RAILWAY_TOKEN',
  'RAILWAY_API_TOKEN',
];

export const forbiddenActionCounters = {
  task_id: TASK_ID,
  live_email_sends: 0,
  live_whatsapp_sends: 0,
  live_telegram_sends: 0,
  broad_sends: 0,
  live_charges: 0,
  test_purchases_without_separate_approval: 0,
  buffer_or_social_publications: 0,
  real_users_created: 0,
  production_contacts_imported: 0,
  production_database_reads: 0,
  production_database_writes: 0,
  bna_mutations: 0,
  skillful_motivation_mutations: 0,
  root_dns_changes: 0,
  join_hostname_changes: 0,
  secret_values_committed: 0,
  real_rows_or_child_family_pii_in_evidence: 0,
};

export function parseArgs(argv) {
  const flags = new Map();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) {
      setFlag(flags, rawKey, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      setFlag(flags, rawKey, next);
      index += 1;
      continue;
    }
    setFlag(flags, rawKey, true);
  }
  return { flags, positional };
}

function setFlag(flags, key, value) {
  if (!flags.has(key)) {
    flags.set(key, value);
    return;
  }
  const existing = flags.get(key);
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  flags.set(key, [existing, value]);
}

export function flagValue(flags, key, fallback = undefined) {
  return flags.has(key) ? flags.get(key) : fallback;
}

export function flagValues(flags, key) {
  const value = flags.get(key);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function run(command, args, options = {}) {
  const shell = process.platform === 'win32' && ['railway', 'npm', 'npx'].includes(command);
  const result = spawnSync(shell ? shellCommand(command, args) : command, shell ? [] : args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    shell,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? result.error.message : undefined,
  };
}

function shellCommand(command, args) {
  return [command, ...args.map(shellQuote)].join(' ');
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

export function requireRun(command, args, options = {}) {
  const result = run(command, args, options);
  if (!result.ok) {
    throw new Error(
      `${command} ${args.join(' ')} failed: ${redactForLog(result.stderr || result.error || '')}`,
    );
  }
  return result.stdout.trim();
}

export function git(repo, args) {
  return requireRun('git', args, { cwd: repo });
}

export function tryJsonCommand(command, args, cwd) {
  const result = run(command, args, { cwd });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: redactForLog(result.stderr || result.error || ''),
    };
  }
  try {
    return { ok: true, value: JSON.parse(result.stdout || 'null') };
  } catch (error) {
    return { ok: false, status: result.status, error: `json_parse_failed:${error.message}` };
  }
}

export function normalizeOrigin(origin) {
  const trimmed = origin.trim();
  if (trimmed === 'git@github.com:webcraft-media/onetimev2.git') return EXPECTED_REPOSITORY;
  if (trimmed === 'https://github.com/webcraft-media/onetimev2.git') return EXPECTED_REPOSITORY;
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (httpsMatch) return httpsMatch[1].toLowerCase();
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1].toLowerCase();
  return `unrecognized:${trimmed}`;
}

export function repoReceipt(repo) {
  const origin = git(repo, ['remote', 'get-url', 'origin']);
  const head = git(repo, ['rev-parse', 'HEAD']);
  const tree = git(repo, ['rev-parse', 'HEAD^{tree}']);
  const status = git(repo, ['status', '--porcelain=v1']);
  return {
    origin_url: origin,
    normalized_origin: normalizeOrigin(origin),
    head_sha: head,
    tree_sha: tree,
    porcelain_count: status ? status.split('\n').filter(Boolean).length : 0,
  };
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function ensureParent(file) {
  mkdirSync(dirname(file), { recursive: true });
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  ensureParent(file);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function writeText(file, value) {
  ensureParent(file);
  writeFileSync(file, value, { mode: 0o600 });
}

export function outputJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function redactForLog(value) {
  return String(value)
    .replace(/(postgres(?:ql)?:\/\/)[^\s'"<>]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/(Authorization:\s*)[^\r\n]+/gi, '$1[redacted]')
    .replace(/(Cookie:\s*)[^\r\n]+/gi, '$1[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
}

export function flattenStrings(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) flattenStrings(item, out);
  }
  return out;
}

export function safeResolve(path) {
  return resolve(path);
}
