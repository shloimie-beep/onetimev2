import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMemoryPool, runMigrations } from '../packages/db/src/index.ts';
import { createPostgresOps04Repository } from '../packages/db/src/ops04/repository.ts';
import type {
  Ops04ApplyReceipt,
  Ops04DryRunReport,
} from '../packages/contracts/src/ops04/index.ts';
import {
  createOps04ApplyReceipt,
  createOps04DryRun,
  createSyntheticOps04Fixture,
  formatOps04DryRunMarkdown,
} from '../packages/domain/src/ops04/service.ts';

const command = process.argv[2] ?? 'help';
const flags = parseFlags(process.argv.slice(3));

if (command === 'help' || flags.help) {
  process.stdout.write(helpText());
} else if (command === 'fixture') {
  const out = requiredFlag(flags, 'out');
  await writeJson(out, createSyntheticOps04Fixture());
  process.stdout.write(`wrote ${out}\n`);
} else if (command === 'dry-run') {
  const request = flags.fixture
    ? createSyntheticOps04Fixture()
    : JSON.parse(await readFile(requiredFlag(flags, 'request'), 'utf8'));
  const report = createOps04DryRun(request);
  const out = requiredFlag(flags, 'out');
  await writeJson(out, report);
  await writeFile(`${out}.md`, formatOps04DryRunMarkdown(report), 'utf8');
  process.stdout.write(formatOps04DryRunMarkdown(report));
} else if (command === 'receipt') {
  const report = JSON.parse(
    await readFile(requiredFlag(flags, 'report'), 'utf8'),
  ) as Ops04DryRunReport;
  const receipt = createOps04ApplyReceipt({
    report,
    actor: optionalFlag(flags, 'actor') ?? 'ops04-cli-synthetic-actor',
  });
  const out = requiredFlag(flags, 'out');
  await writeJson(out, receipt);
  process.stdout.write(`wrote ${out}\n`);
} else if (command === 'totals') {
  const report = JSON.parse(
    await readFile(requiredFlag(flags, 'report'), 'utf8'),
  ) as Ops04DryRunReport;
  process.stdout.write(`${JSON.stringify(report.totals, null, 2)}\n`);
} else if (command === 'scan-evidence') {
  const reportText = await readFile(requiredFlag(flags, 'report'), 'utf8');
  const findings = scanEvidence(reportText);
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  if (!findings.passed) process.exitCode = 1;
} else if (command === 'rehearse') {
  const outDir =
    optionalFlag(flags, 'out-dir') ?? path.join('ops', 'evidence', 'OPS-04', 'synthetic');
  const result = await rehearseSynthetic(outDir);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (command === 'inventory') {
  const out = requiredFlag(flags, 'out');
  const inventory = {
    task_id: 'OPS-04',
    source_export_status: 'waiting_for_source_export',
    production_import_authorized: false,
    campaign_send_authorized: false,
    supported_commands: ['fixture', 'dry-run', 'receipt', 'totals', 'scan-evidence', 'rehearse'],
  };
  await writeJson(out, inventory);
  process.stdout.write(`wrote ${out}\n`);
} else {
  throw new Error(`Unknown OPS-04 command: ${command}`);
}

async function rehearseSynthetic(outDir: string) {
  await mkdir(outDir, { recursive: true });
  const request = createSyntheticOps04Fixture();
  const report = createOps04DryRun(request);
  const receipt = createOps04ApplyReceipt({ report, actor: 'ops04-cli-synthetic-actor' });
  const pool = createMemoryPool();
  try {
    await runMigrations(pool);
    const repository = createPostgresOps04Repository(pool);
    const actor = {
      accountKey: request.account_key,
      productKey: request.product_key,
      userKey: 'ops04_cli_synthetic_actor',
    };
    const recorded = await repository.recordDryRun({ actor, report });
    const applied = await repository.applySyntheticBatch({ actor, report, receipt });
    const replayed = await repository.replaySyntheticBatch({ actor, report, receipt });
    const verified = await repository.verifyBatch(actor, report.batch_key);
    const rollback = await repository.rollbackBatch({
      actor,
      batchKey: report.batch_key,
      idempotencyKey: 'ops04-cli-rollback-001',
      reason: 'Synthetic CLI rollback proof',
    });
    const totals = await repository.totals(actor, report.batch_key);
    await writeJson(path.join(outDir, 'dry-run-report.json'), report);
    await writeFile(
      path.join(outDir, 'dry-run-report.md'),
      formatOps04DryRunMarkdown(report),
      'utf8',
    );
    await writeJson(path.join(outDir, 'apply-receipt.json'), receipt);
    await writeJson(path.join(outDir, 'repository-rehearsal.json'), {
      recorded,
      applied,
      replayed,
      verified,
      rollback,
      totals,
    });
    return { recorded, applied, replayed, verified, rollback };
  } finally {
    await pool.end();
  }
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function scanEvidence(reportText: string) {
  const emailMatches = reportText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const phoneMatches = reportText.match(/\+\d{8,15}/g) ?? [];
  const allowedSyntheticEmails = emailMatches.filter((email) => email.endsWith('@example.test'));
  return {
    passed: emailMatches.length === allowedSyntheticEmails.length && phoneMatches.length === 0,
    email_matches: emailMatches.length,
    allowed_synthetic_email_matches: allowedSyntheticEmails.length,
    e164_phone_matches: phoneMatches.length,
  };
}

function requiredFlag(flagsByName: Record<string, string | boolean>, name: string) {
  const value = flagsByName[name];
  if (typeof value !== 'string' || !value) throw new Error(`Missing --${name}=...`);
  return value;
}

function optionalFlag(flagsByName: Record<string, string | boolean>, name: string) {
  const value = flagsByName[name];
  return typeof value === 'string' && value ? value : undefined;
}

function parseFlags(args: string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [name, value] = arg.slice(2).split('=', 2);
    if (!name) continue;
    parsed[name] = value ?? true;
  }
  return parsed;
}

function helpText() {
  return `OPS-04 tooling

Commands:
  fixture --out=PATH
  dry-run --fixture --out=PATH
  dry-run --request=PATH --out=PATH
  receipt --report=PATH --out=PATH [--actor=ID]
  totals --report=PATH
  scan-evidence --report=PATH
  rehearse [--out-dir=PATH]
  inventory --out=PATH

All commands are dry-run or synthetic/staging rehearsal only. No production import or campaign send path is implemented.
`;
}
