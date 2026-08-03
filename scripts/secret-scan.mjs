import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2',
]);

const patterns = [
  { name: 'private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'OpenAI secret key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g },
  { name: 'Stripe secret key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'SendGrid API key', regex: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g },
  {
    name: 'database URL with password',
    regex: /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s]+@[^/\s]+/gi,
  },
  { name: 'bearer credential', regex: /\bBearer\s+[A-Za-z0-9._=-]{32,}\b/g },
];

function trackedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'buffer',
    },
  );
  return output.toString('utf8').split('\0').filter(Boolean);
}

function isBinaryFile(filePath) {
  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function lineNumberFor(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function lineAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const endIndex = text.indexOf('\n', index);
  const end = endIndex === -1 ? text.length : endIndex;
  return text.slice(start, end).trim();
}

function redactedLine(line, secret, name) {
  return line.replace(secret, `<redacted ${name}>`);
}

const findings = [];
let scanned = 0;

for (const filePath of trackedFiles()) {
  if (isBinaryFile(filePath)) continue;
  // `git ls-files --cached` includes tracked paths deleted in the working tree.
  // A deletion cannot introduce a secret, so skip it instead of aborting the
  // scan before the remaining repository files are inspected.
  if (!existsSync(filePath)) continue;
  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) continue;
  const text = buffer.toString('utf8');
  scanned += 1;

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(text);
    while (match) {
      findings.push({
        filePath,
        line: lineNumberFor(text, match.index),
        name: pattern.name,
        snippet: redactedLine(lineAt(text, match.index), match[0], pattern.name),
      });
      match = pattern.regex.exec(text);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`Secret scan failed with ${findings.length} finding(s):\n`);
  for (const finding of findings) {
    process.stderr.write(
      `${finding.filePath}:${finding.line} ${finding.name}: ${finding.snippet}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(`Secret scan passed across ${scanned} repo text files.\n`);
