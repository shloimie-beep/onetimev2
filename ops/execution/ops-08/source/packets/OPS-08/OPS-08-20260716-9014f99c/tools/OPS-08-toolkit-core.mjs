/**
 * OPS-08 repository-safe utility and fingerprint primitives.
 * Node.js 24+, no external dependencies.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
export const TASK_ID = 'OPS-08';
export const PACKET_ID = 'OPS-08-20260716-9014f99c';
const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA'];
const FORBIDDEN_SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9_-]+/i,
  /sk_test_[A-Za-z0-9_-]+/i,
  /rk_live_[A-Za-z0-9_-]+/i,
  /whsec_[A-Za-z0-9_-]+/i,
  /re_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:password|secret|token|api[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9+/_=-]{16,}/i,
];

export function usage() {
  process.stderr.write(`
${TASK_ID} toolkit

Commands:
  init-state --root PATH --packet-root PATH
  dns --domain HOSTNAME --out FILE
  probe --inventory FILE --out FILE
  fingerprint --input FILE --out FILE
  validate --inventory FILE [--authorization FILE] [--change-manifest FILE]
  verify-checksums --root PATH

All output is repository-safe: no private DNS target, credential, or provider secret is requested.
`);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const part = rest[i];
    if (!part.startsWith('--')) throw new Error(`Unexpected argument: ${part}`);
    const key = part.slice(2);
    const value = rest[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export async function atomicWrite(file, value) {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, value, { encoding: 'utf8', mode: 0o600 });
  await rename(temp, file);
}

export async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  await visit(root);
  return files.sort();
}

export function now() {
  return new Date().toISOString();
}

export function requireTaskPacket(doc, label) {
  if (doc.task_id !== TASK_ID) throw new Error(`${label}: task_id must be ${TASK_ID}`);
  if (doc.packet_id !== PACKET_ID) throw new Error(`${label}: packet_id must be ${PACKET_ID}`);
}

export function assertNoSecrets(text, label) {
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(text)) throw new Error(`${label}: forbidden secret-shaped content matched ${pattern}`);
  }
}


function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['captured_at', 'updated_at', 'created_at', 'duration_ms'].includes(key))
        .map(([key, item]) => [key, stripVolatile(item)]),
    );
  }
  return value;
}

export async function commandFingerprint(args) {
  if (!args.input || !args.out) throw new Error('fingerprint requires --input and --out');
  const text = await readFile(args.input, 'utf8');
  assertNoSecrets(text, args.input);
  const parsed = JSON.parse(text);
  const normalized = stableJson(stripVolatile(parsed));
  const report = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    input: path.basename(args.input),
    generated_at: now(),
    sha256: sha256(normalized),
    raw_values_embedded: false,
  };
  await atomicWrite(args.out, stableJson(report));
  process.stdout.write(`${TASK_ID} fingerprint: ${report.sha256}\n`);
}

