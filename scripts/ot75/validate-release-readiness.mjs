import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = 'ops/release/ot75/release-readiness.contract.json';
const REPORT_PATH = 'ops/release/ot75/evidence/validation-report.json';

const forbiddenWorkflowPatterns = [
  /\brailway\s+(up|deploy|variables|env|run)\b/i,
  /\bvercel\s+deploy\b/i,
  /\bkubectl\s+/i,
  /\bnpm\s+run\s+db:migrate\b/i,
  /\bnpx\s+tsx\s+scripts\/migrate\.ts\b/i,
  /\bpsql\s+/i,
  /\bcurl\s+.*(api|webhook|telegram|stripe|send)\b/i,
];

const secretPatterns = [
  { name: 'private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'OpenAI secret key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g },
  { name: 'Stripe secret key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  {
    name: 'database URL with password',
    regex: /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s]+@[^/\s]+/gi,
  },
  { name: 'bearer credential', regex: /\bBearer\s+[A-Za-z0-9._=-]{32,}\b/g },
];

function main() {
  const writeReport = process.argv.includes('--write-report');
  const contract = readJson(CONTRACT_PATH);
  const gates = readJson(contract.contracts.predeploy_gates);
  const scopeBaseSha =
    argValue('--scope-base') ?? process.env.OT75_SCOPE_BASE_SHA ?? contract.task.immutable_base_sha;
  const scopeHeadSha = argValue('--scope-head') ?? process.env.OT75_SCOPE_HEAD_SHA ?? 'HEAD';
  const changedFiles = changedFilesForScope(scopeBaseSha, scopeHeadSha);
  const report = {
    task_id: contract.task.id,
    generated_at: new Date().toISOString(),
    base_sha: contract.task.immutable_base_sha,
    scope_base_sha: scopeBaseSha,
    scope_head_sha: scopeHeadSha,
    changed_files: changedFiles,
    checks: [],
  };

  check(
    contract.task.repository === 'webcraft-media/onetimev2',
    'repository is webcraft-media/onetimev2',
    report,
  );
  check(
    contract.mutation_policy.deployments_allowed === false,
    'deployments are forbidden',
    report,
  );
  check(
    contract.mutation_policy.database_mutations_allowed === false,
    'database mutations are forbidden',
    report,
  );
  check(
    contract.mutation_policy.provider_mutations_allowed === false,
    'provider mutations are forbidden',
    report,
  );
  check(
    contract.ownership.current_runtime_composition_change === false,
    'runtime composition change is false',
    report,
  );

  checkRequiredFiles(contract, report);
  checkGateCoverage(contract.required_gate_ids, gates.gates, report);
  checkChangedFileScope(contract, changedFiles, report);
  checkWorkflowSafety(contract.ci.workflow, report);
  checkSecretPatterns(changedFiles, report);
  checkManifestTemplate(contract.contracts.release_manifest_template, report);

  const failed = report.checks.filter((item) => item.status !== 'passed');
  if (writeReport) {
    mkdirSync(path.dirname(resolvePath(REPORT_PATH)), { recursive: true });
    writeFileSync(resolvePath(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  }

  if (failed.length > 0) {
    process.stderr.write(`OT-75 validation failed with ${failed.length} finding(s).\n`);
    for (const item of failed) {
      process.stderr.write(`- ${item.name}: ${item.detail}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`OT-75 validation passed with ${report.checks.length} checks.\n`);
  if (writeReport) process.stdout.write(`Wrote ${REPORT_PATH}\n`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(resolvePath(filePath), 'utf8'));
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function resolvePath(filePath) {
  return path.resolve(ROOT, filePath);
}

function check(condition, name, report, detail = '') {
  report.checks.push({
    name,
    status: condition ? 'passed' : 'failed',
    detail,
  });
}

function checkRequiredFiles(contract, report) {
  const files = [
    contract.contracts.environment_schema,
    contract.contracts.predeploy_gates,
    contract.contracts.health_readiness,
    contract.contracts.observability,
    contract.contracts.alerts,
    contract.contracts.dashboard,
    contract.contracts.release_manifest_template,
    ...contract.deployment_descriptors,
    ...contract.runbooks,
  ];
  for (const filePath of files) {
    check(existsSync(resolvePath(filePath)), `required file exists: ${filePath}`, report);
  }
}

function checkGateCoverage(requiredIds, gates, report) {
  const actual = new Set(gates.map((gate) => gate.id));
  for (const id of requiredIds) {
    check(actual.has(id), `required gate exists: ${id}`, report);
  }
  for (const gate of gates) {
    check(Boolean(gate.machine_check?.type), `gate has machine check: ${gate.id}`, report);
  }
}

function changedFilesForScope(baseSha, headSha) {
  const committed = git(['diff', '--name-only', `${baseSha}...${headSha}`]);
  const staged = git(['diff', '--name-only', '--cached']);
  const unstaged = git(['diff', '--name-only']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return unique([...committed, ...staged, ...unstaged, ...untracked].filter(Boolean)).sort();
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function checkChangedFileScope(contract, changedFiles, report) {
  const allowedPrefixes = contract.ownership.allowed_path_prefixes;
  for (const filePath of changedFiles) {
    const normalized = filePath.replace(/\\/g, '/');
    const allowed = allowedPrefixes.some((prefix) =>
      prefix.endsWith('/') ? normalized.startsWith(prefix) : normalized === prefix,
    );
    check(allowed, `changed path is OT-75-owned: ${normalized}`, report, 'outside OT-75 scope');
  }

  for (const forbidden of contract.ownership.forbidden_runtime_paths) {
    const touched = changedFiles.some((filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      return forbidden.endsWith('/') ? normalized.startsWith(forbidden) : normalized === forbidden;
    });
    check(
      !touched,
      `forbidden runtime path untouched: ${forbidden}`,
      report,
      'runtime path changed',
    );
  }
}

function checkWorkflowSafety(workflowPath, report) {
  const text = readFileSync(resolvePath(workflowPath), 'utf8');
  check(text.includes('workflow_dispatch'), 'OT-75 workflow can be run manually', report);
  check(
    text.includes('node scripts/ot75/validate-release-readiness.mjs'),
    'workflow runs OT-75 validator',
    report,
  );
  for (const pattern of forbiddenWorkflowPatterns) {
    check(!pattern.test(text), `workflow does not match forbidden pattern ${pattern}`, report);
  }
}

function checkSecretPatterns(changedFiles, report) {
  for (const filePath of changedFiles) {
    if (isBinaryPath(filePath)) continue;
    const absolute = resolvePath(filePath);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, 'utf8');
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      check(!pattern.regex.test(text), `no ${pattern.name} in ${filePath}`, report);
    }
  }
}

function checkManifestTemplate(filePath, report) {
  const template = readJson(filePath);
  const serialized = JSON.stringify(template);
  check(serialized.includes('TO_BE_FILLED_BY_OT80'), 'manifest remains OT-80-fillable', report);
  check(
    template.external_mutation_counts.deployments === 0,
    'manifest records zero OT-75 deployments',
    report,
  );
}

function isBinaryPath(filePath) {
  return /\.(avif|gif|ico|jpeg|jpg|pdf|png|webp|woff2?)$/i.test(filePath);
}

function unique(values) {
  return [...new Set(values)];
}

main();
