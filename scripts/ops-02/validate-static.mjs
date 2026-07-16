#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TASK_ID, outputJson, run, writeJson } from './lib.mjs';

const evidenceDir = process.argv[2] ?? 'ops/release/ops-02/static-validation';
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const commands = [
  ['node', ['--check', 'scripts/ops-02/candidate-resolver.mjs']],
  [
    'node',
    [
      'scripts/ops-02/candidate-resolver.mjs',
      '--repo',
      '.',
      '--out',
      join(evidenceDir, 'candidate-resolution.json'),
    ],
  ],
  [
    'node',
    ['scripts/ops-02/inventory.mjs', '--repo', '.', '--out', join(evidenceDir, 'inventory.json')],
  ],
  [
    'node',
    [
      'scripts/ops-02/guard-context.mjs',
      '--repo',
      '.',
      '--out',
      join(evidenceDir, 'guard-context.json'),
    ],
  ],
  [
    'node',
    ['scripts/ops-02/render-env-presence.mjs', '--out', join(evidenceDir, 'env-presence.json')],
  ],
  [
    'node',
    ['scripts/ops-02/migration-ledger.mjs', '--out', join(evidenceDir, 'migration-ledger.json')],
  ],
  [
    'node',
    ['scripts/ops-02/verify-runtime.mjs', '--out', join(evidenceDir, 'runtime-source.json')],
  ],
  ['node', ['scripts/ops-02/worker-smoke.mjs', '--out', join(evidenceDir, 'worker-smoke.json')]],
  [
    'node',
    [
      'scripts/ops-02/forbidden-action-audit.mjs',
      '--out',
      join(evidenceDir, 'forbidden-action-audit.json'),
    ],
  ],
  [
    'node',
    [
      'scripts/ops-02/evidence-scan.mjs',
      '--path',
      'ops/release/ops-02',
      '--path',
      'scripts/ops-02',
      '--out',
      join(evidenceDir, 'evidence-scan.json'),
    ],
  ],
];

const results = [];
for (const [command, args] of commands) {
  const result = run(command, args, { cwd: process.cwd() });
  results.push({
    command: [command, ...args].join(' '),
    status: result.status,
    ok: result.ok,
    stderr: result.stderr.trim(),
  });
}
const failed = results.filter((result) => !result.ok);
const summary = { task_id: TASK_ID, status: failed.length ? 'fail' : 'pass', results };
writeJson(join(evidenceDir, 'summary.json'), summary);
outputJson(summary);
if (failed.length) process.exit(1);
