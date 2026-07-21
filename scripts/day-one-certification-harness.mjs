#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const IMMUTABLE_BASE = 'dfef7de2035e08f1ee72e0133ccf656fe7a74444';
const DEFAULT_MANIFEST = 'ops/day-one/release-manifest.example.json';
const DEFAULT_REGISTRY = 'ops/day-one/day-one-capability-registry.json';
const DEFAULT_OUT_DIR = 'ops/evidence/ot-76';

const DEFAULT_ALLOWED_CHANGE_PATHS = [
  'scripts/day-one-certification-harness.mjs',
  'ops/day-one/',
  'ops/evidence/ot-76/',
  'ops/execution/ot-76/',
  'ops/execution/registry.json',
];

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode ?? args._[0] ?? 'audit').toLowerCase();
if (!['audit', 'certify'].includes(mode)) {
  console.error(`Unsupported mode "${mode}". Use audit or certify.`);
  process.exit(2);
}

const manifestPath = normalizePath(args.manifest ?? DEFAULT_MANIFEST);
const registryPath = normalizePath(args.registry ?? DEFAULT_REGISTRY);
const outDir = normalizePath(args.outDir ?? args['out-dir'] ?? DEFAULT_OUT_DIR);
const scopeBaseSha = String(
  args['scope-base'] ?? process.env.OT76_SCOPE_BASE_SHA ?? IMMUTABLE_BASE,
);
const policy = String(
  args.policy ??
    (mode === 'audit' ? 'audit_zero_unless_harness_or_scope_failure' : 'certify_strict'),
);

const manifest = await readJson(manifestPath);
const registry = await readJson(registryPath);
const packageJson = await readJson('package.json');
const facts = await collectFacts({ manifest, scopeBaseSha });
const gateResults = await Promise.all(
  registry.gates.map((gate) => evaluateGate({ gate, manifest, packageJson, facts })),
);

const forbiddenChanges = facts.changedFiles.filter(
  (file) => !isAllowedChange(file, facts.allowedChangePaths),
);
const manifestFailures = validateManifest({ manifest, registry });
const hardFailures = [
  ...manifestFailures,
  ...forbiddenChanges.map((file) => ({
    code: 'FORBIDDEN_FILE_SCOPE',
    message: `${file} is outside the OT-76 harness/evidence scope`,
  })),
];
const gateFailures = gateResults.filter((result) => result.status !== 'pass');
const exitCode =
  hardFailures.length > 0 ||
  (mode === 'certify' && gateFailures.length > 0) ||
  (mode === 'audit' && policy === 'audit_strict' && gateFailures.length > 0)
    ? 1
    : 0;

const report = {
  harness: 'ot-76-day-one-certification-harness',
  generated_at: new Date().toISOString(),
  mode,
  policy,
  repository: manifest.repository,
  immutable_base_sha: IMMUTABLE_BASE,
  scope_base_sha: scopeBaseSha,
  manifest_path: manifestPath,
  registry_path: registryPath,
  current_branch: facts.branch,
  current_head_sha: facts.head,
  external_mutation_counts: {
    deployments: 0,
    provider_calls: 0,
    live_sends: 0,
    production_database_writes: 0,
    payment_or_access_mutations: 0,
    dns_or_railway_mutations: 0,
  },
  changed_files: facts.changedFiles,
  forbidden_changes: forbiddenChanges,
  manifest_failures: hardFailures,
  gate_summary: {
    total: gateResults.length,
    pass: gateResults.filter((result) => result.status === 'pass').length,
    missing_capability: gateResults.filter((result) => result.status === 'missing_capability')
      .length,
    blocker: gateResults.filter((result) => result.status === 'blocker').length,
  },
  result:
    exitCode === 0 ? (mode === 'audit' ? 'audit_complete_not_certified' : 'certified') : 'failed',
  day_one_certified: mode === 'certify' && exitCode === 0,
  gates: gateResults,
};

await mkdir(outDir, { recursive: true });
const jsonPath = path.join(outDir, `day-one-${mode}-report.json`);
const mdPath = path.join(outDir, `day-one-${mode}-report.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(mdPath, renderMarkdown(report));

process.stdout.write(
  JSON.stringify(
    {
      mode,
      policy,
      result: report.result,
      day_one_certified: report.day_one_certified,
      gate_summary: report.gate_summary,
      report_json: jsonPath,
      report_md: mdPath,
      exit_code: exitCode,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');

process.exit(exitCode);

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      parsed._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function collectFacts({ manifest, scopeBaseSha }) {
  const head = git(['rev-parse', 'HEAD']).trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const statusLines = git(['status', '--porcelain=v1']).split('\n').filter(Boolean);
  const changedFromBase = git(['diff', '--name-only', `${scopeBaseSha}..HEAD`])
    .split('\n')
    .filter(Boolean);
  const changedFiles = unique([
    ...changedFromBase.map(normalizePath),
    ...statusLines.map(parseStatusPath).filter(Boolean),
  ]);
  const sourceFiles = unique(
    (manifest.routes ?? [])
      .flatMap((route) => route.source_files ?? [])
      .concat((manifest.static_scan_files ?? []).map(String)),
  );
  const sourceText = new Map();
  for (const filePath of sourceFiles) {
    sourceText.set(normalizePath(filePath), await readTextIfExists(filePath));
  }
  return {
    head,
    branch,
    changedFiles,
    sourceText,
    allowedChangePaths: allowedChangePaths(manifest),
  };
}

async function evaluateGate({ gate, manifest, packageJson, facts }) {
  const signals = await Promise.all(
    (gate.signals ?? []).map((signal) => evaluateSignal({ signal, manifest, packageJson, facts })),
  );
  const missing = signals.filter((signal) => !signal.ok);
  const status =
    missing.length === 0
      ? 'pass'
      : gate.required_for_certify === false
        ? 'missing_capability'
        : 'blocker';
  return {
    id: gate.id,
    title: gate.title,
    prompt_coverage: gate.prompt_coverage,
    required_for_certify: gate.required_for_certify !== false,
    status,
    summary:
      missing.length === 0
        ? 'All configured signals are present.'
        : `${missing.length} configured signal(s) missing or incomplete.`,
    missing: missing.map(({ id, type, message }) => ({ id, type, message })),
    signals,
  };
}

async function evaluateSignal({ signal, manifest, packageJson, facts }) {
  try {
    if (signal.type === 'manifest_path') {
      const value = getPath(manifest, signal.path);
      return signalResult(
        signal,
        value !== undefined && value !== null && value !== '',
        'manifest path is set',
      );
    }
    if (signal.type === 'path_exists') {
      return signalResult(signal, await exists(signal.path), `${signal.path} exists`);
    }
    if (signal.type === 'file_contains') {
      const text = await readTextIfExists(signal.path);
      const ok = signal.values.every((value) => text.includes(value));
      return signalResult(signal, ok, `${signal.path} contains required text`);
    }
    if (signal.type === 'route') {
      const route = (manifest.routes ?? []).find((entry) => entry.id === signal.route_id);
      if (!route) return signalResult(signal, false, `route ${signal.route_id} is not in manifest`);
      const patterns = route.source_patterns ?? [];
      const files = route.source_files ?? [];
      const ok =
        patterns.length === 0 ||
        patterns.every((pattern) =>
          files.some((file) => (facts.sourceText.get(normalizePath(file)) ?? '').includes(pattern)),
        );
      return signalResult(signal, ok, `route ${signal.route_id} source patterns are visible`);
    }
    if (signal.type === 'command') {
      const command = manifest.commands?.[signal.command_id];
      const scriptOk = signal.package_script
        ? Boolean(packageJson.scripts?.[signal.package_script])
        : true;
      return signalResult(
        signal,
        Boolean(command) && scriptOk,
        `command ${signal.command_id} is declared${signal.package_script ? ' and package script exists' : ''}`,
      );
    }
    if (signal.type === 'capability_status') {
      const capability = manifest.capabilities?.[signal.capability_id];
      const allowed = signal.allowed_statuses ?? ['present'];
      return signalResult(
        signal,
        Boolean(capability) && allowed.includes(capability.status),
        `capability ${signal.capability_id} has allowed status`,
      );
    }
    if (signal.type === 'visible_action_registry') {
      const registry = await readJson(signal.path);
      const validation = validateVisibleActionRegistry(registry, signal);
      return signalResult(signal, validation.ok, validation.message);
    }
    if (signal.type === 'budget') {
      return signalResult(
        signal,
        Boolean(manifest.budgets?.[signal.budget_id]),
        `budget ${signal.budget_id} is declared`,
      );
    }
    if (signal.type === 'migration') {
      const migration = (manifest.migrations ?? []).find(
        (entry) => entry.id === signal.migration_id,
      );
      const ok = Boolean(migration) && (await exists(migration.path));
      return signalResult(signal, ok, `migration ${signal.migration_id} exists`);
    }
    if (signal.type === 'forbidden_text_absent') {
      const matches = [];
      for (const filePath of signal.paths ?? []) {
        const text = await readTextIfExists(filePath);
        for (const pattern of signal.patterns ?? []) {
          if (text.toLowerCase().includes(String(pattern).toLowerCase())) {
            matches.push(`${filePath}:${pattern}`);
          }
        }
      }
      return signalResult(
        signal,
        matches.length === 0,
        matches.join(', ') || 'forbidden text absent',
      );
    }
    if (signal.type === 'changed_files_allowed') {
      const forbidden = facts.changedFiles.filter(
        (file) => !isAllowedChange(file, facts.allowedChangePaths),
      );
      return signalResult(
        signal,
        forbidden.length === 0,
        forbidden.join(', ') || 'changed files are scoped',
      );
    }
    if (signal.type === 'source_sha') {
      const ok = manifest.source?.immutable_base_sha === IMMUTABLE_BASE;
      return signalResult(signal, ok, `manifest immutable base is ${IMMUTABLE_BASE}`);
    }
    return signalResult(signal, false, `unsupported signal type ${signal.type}`);
  } catch (error) {
    return {
      id: signal.id ?? signal.type,
      type: signal.type,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateManifest({ manifest, registry }) {
  const failures = [];
  if (manifest.repository !== 'shloimie-beep/onetimev2') {
    failures.push({
      code: 'REPOSITORY_MISMATCH',
      message: 'manifest repository is not shloimie-beep/onetimev2',
    });
  }
  if (manifest.source?.immutable_base_sha !== IMMUTABLE_BASE) {
    failures.push({
      code: 'BASE_SHA_MISMATCH',
      message: 'manifest immutable base does not match OT-76 prompt',
    });
  }
  if (manifest.permissions?.product_code_change_allowed === true) {
    const changeScope = manifest.change_scope;
    if (
      changeScope?.product_code_changes_are_release_scoped !== true ||
      !Array.isArray(changeScope.allowed_paths) ||
      changeScope.allowed_paths.length === 0
    ) {
      failures.push({
        code: 'PRODUCT_CODE_SCOPE_MISSING',
        message:
          'product code changes require explicit release-scoped allowed paths in change_scope',
      });
    }
  } else if (manifest.permissions?.product_code_change_allowed !== false) {
    failures.push({
      code: 'PRODUCT_CODE_SCOPE_OPEN',
      message:
        'manifest must either forbid product code changes or declare scoped release change paths',
    });
  }
  if (manifest.permissions?.deployment_allowed !== false) {
    failures.push({ code: 'DEPLOYMENT_SCOPE_OPEN', message: 'manifest must forbid deployment' });
  }
  if (manifest.permissions?.external_mutation_allowed !== false) {
    failures.push({
      code: 'EXTERNAL_MUTATION_SCOPE_OPEN',
      message: 'manifest must forbid external mutations',
    });
  }
  if (!Array.isArray(registry.gates) || registry.gates.length !== 13) {
    failures.push({
      code: 'GATE_COUNT_MISMATCH',
      message: 'registry must contain the 13 Day-One gates',
    });
  }
  return failures;
}

function signalResult(signal, ok, message) {
  return {
    id: signal.id ?? signal.type,
    type: signal.type,
    ok,
    message: ok ? message : (signal.missing_message ?? message),
  };
}

function validateVisibleActionRegistry(registry, signal) {
  const actions = registry?.actions;
  if (!Array.isArray(actions)) {
    return { ok: false, message: `${signal.path} must contain an actions array` };
  }
  const minActions = Number(signal.min_actions ?? 1);
  if (actions.length < minActions) {
    return {
      ok: false,
      message: `${signal.path} has ${actions.length} actions; expected at least ${minActions}`,
    };
  }
  const ids = new Set();
  for (const [index, action] of actions.entries()) {
    const id = String(action?.action_id ?? '');
    if (!id) return { ok: false, message: `action ${index} is missing action_id` };
    if (ids.has(id)) return { ok: false, message: `${id} is duplicated` };
    ids.add(id);
    const requiredStringPaths = [
      'label',
      'surface',
      'route',
      'capability',
      'handler.path',
      'audit.event',
      'readiness_state',
    ];
    for (const requiredPath of requiredStringPaths) {
      const value = getPath(action, requiredPath);
      if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, message: `${id} is missing ${requiredPath}` };
      }
    }
    if (!Array.isArray(action.roles) || action.roles.length === 0) {
      return { ok: false, message: `${id} must declare authorized roles` };
    }
    if (!['ready', 'unavailable_by_design'].includes(action.readiness_state)) {
      return { ok: false, message: `${id} has unsupported readiness_state` };
    }
    if (action.external_mutation !== false) {
      return { ok: false, message: `${id} must not perform external mutation for OT81` };
    }
    if (!Array.isArray(action.test_evidence) || action.test_evidence.length === 0) {
      return { ok: false, message: `${id} must cite test evidence` };
    }
    for (const state of ['loading', 'success', 'error', 'permission', 'offline']) {
      if (typeof action.states?.[state] !== 'string' || action.states[state].length === 0) {
        return { ok: false, message: `${id} is missing ${state} state copy` };
      }
    }
  }
  return {
    ok: true,
    message: `${signal.path} maps ${actions.length} visible actions`,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# OT-76 Day-One QA Harness Report',
    '',
    `Mode: \`${report.mode}\``,
    `Policy: \`${report.policy}\``,
    `Result: \`${report.result}\``,
    `Day-One certified: \`${report.day_one_certified}\``,
    `Current branch: \`${report.current_branch}\``,
    `Current HEAD: \`${report.current_head_sha}\``,
    '',
    '## Scope Proof',
    '',
    `- Immutable base: \`${report.immutable_base_sha}\``,
    `- Scope base: \`${report.scope_base_sha}\``,
    `- Forbidden changed files: ${report.forbidden_changes.length ? report.forbidden_changes.map((file) => `\`${file}\``).join(', ') : 'none'}`,
    '- External mutation counts: deployments 0, provider calls 0, live sends 0, production DB writes 0, payments/access 0, DNS/Railway 0.',
    '',
    '## Gate Summary',
    '',
    `- Total: ${report.gate_summary.total}`,
    `- Pass: ${report.gate_summary.pass}`,
    `- Missing capability: ${report.gate_summary.missing_capability}`,
    `- Blocker: ${report.gate_summary.blocker}`,
    '',
    '## Gates',
    '',
  ];
  for (const gate of report.gates) {
    lines.push(`### ${gate.id}: ${gate.title}`);
    lines.push('');
    lines.push(`Status: \`${gate.status}\``);
    lines.push('');
    lines.push(gate.summary);
    lines.push('');
    if (gate.missing.length > 0) {
      lines.push('Missing or incomplete signals:');
      for (const missing of gate.missing) {
        lines.push(`- \`${missing.id}\`: ${missing.message}`);
      }
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

function getPath(value, dottedPath) {
  return String(dottedPath)
    .split('.')
    .reduce((current, part) => (current == null ? undefined : current[part]), value);
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function parseStatusPath(line) {
  let filePath = line.slice(3).trim();
  if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop();
  return normalizePath(filePath.replace(/^"|"$/g, ''));
}

function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/');
}

function allowedChangePaths(manifest) {
  const paths = manifest.change_scope?.allowed_paths;
  if (!Array.isArray(paths) || paths.length === 0) return DEFAULT_ALLOWED_CHANGE_PATHS;
  return paths.map(normalizePath);
}

function isAllowedChange(filePath, allowedPaths = DEFAULT_ALLOWED_CHANGE_PATHS) {
  const normalized = normalizePath(filePath);
  return allowedPaths.some((allowed) =>
    allowed.endsWith('/') ? normalized.startsWith(allowed) : normalized === allowed,
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(normalizePath))];
}
