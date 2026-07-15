import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GATES_PATH = 'ops/release/ot75/predeploy-gates.json';

function main() {
  const json = process.argv.includes('--json');
  const failOnBlocked = process.argv.includes('--fail-on-blocked');
  const outIndex = process.argv.indexOf('--out');
  const outPath = outIndex === -1 ? null : process.argv[outIndex + 1];
  const gates = readJson(GATES_PATH).gates;
  const results = gates.map(evaluateGate);
  const blocked = results.filter((result) => result.status !== 'passed');
  const report = {
    task_id: 'OT-75',
    generated_at: new Date().toISOString(),
    print_values: false,
    blocked_count: blocked.length,
    gates: results,
    external_mutation_counts: {
      deployments: 0,
      dns_changes: 0,
      database_mutations: 0,
      provider_mutations: 0,
      messages_sent: 0,
      payments_or_charges: 0,
      real_users_created: 0,
    },
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `OT-75 predeploy gates: ${results.length - blocked.length}/${results.length} passed.\n`,
    );
    for (const result of results) {
      process.stdout.write(`- ${result.id}: ${result.status} (${result.summary})\n`);
    }
  }

  if (outPath) {
    assertSafeOutputPath(outPath);
    const absolute = path.resolve(ROOT, outPath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Wrote ${outPath}\n`);
  }

  if (failOnBlocked && blocked.length > 0) {
    process.exitCode = 2;
  }
}

function assertSafeOutputPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.startsWith('ops/release/ot75/evidence/')) {
    throw new Error('Gate report output must stay under ops/release/ot75/evidence/.');
  }
}

function evaluateGate(gate) {
  const check = gate.machine_check;
  switch (check.type) {
    case 'env_presence':
      return envPresence(gate, check.env_names);
    case 'env_distinct':
      return envDistinct(gate, check.env_names);
    case 'file_exists_and_env_presence':
      return combine(gate, [pathsExist(check.paths), envPresenceResult(check.env_names)]);
    case 'static_paths_and_env_presence':
      return combine(gate, [pathsExist(check.paths), envPresenceResult(check.env_names)]);
    case 'git_sha_env_match':
      return gitShaEnvMatch(gate, check.expected_env, check.actual_env);
    case 'scope_diff':
      return scopeDiff(gate, check.contract_path);
    default:
      return {
        id: gate.id,
        status: 'blocked',
        summary: `unknown machine check type ${check.type}`,
        missing_env_names: [],
      };
  }
}

function envPresence(gate, names) {
  const result = envPresenceResult(names);
  return {
    id: gate.id,
    status: result.passed ? 'passed' : 'blocked_activation_missing_env',
    summary: result.passed ? 'all required names are present' : 'required names are missing',
    missing_env_names: result.missing,
  };
}

function envPresenceResult(names) {
  const missing = names.filter((name) => !process.env[name]);
  return { passed: missing.length === 0, missing };
}

function envDistinct(gate, names) {
  const presence = envPresenceResult(names);
  if (!presence.passed) {
    return {
      id: gate.id,
      status: 'blocked_activation_missing_env',
      summary: 'required names are missing',
      missing_env_names: presence.missing,
    };
  }
  const values = names.map((name) => process.env[name]);
  const distinct = new Set(values).size === values.length;
  return {
    id: gate.id,
    status: distinct ? 'passed' : 'blocked_activation_values_not_distinct',
    summary: distinct
      ? 'required references are present and distinct'
      : 'references are present but not distinct',
    missing_env_names: [],
  };
}

function pathsExist(paths) {
  const missing = paths.filter((filePath) => !existsSync(path.resolve(ROOT, filePath)));
  return { passed: missing.length === 0, missing_paths: missing };
}

function combine(gate, checks) {
  const missingEnv = checks.flatMap((check) => check.missing ?? []);
  const missingPaths = checks.flatMap((check) => check.missing_paths ?? []);
  const passed = checks.every((check) => check.passed);
  return {
    id: gate.id,
    status: passed ? 'passed' : 'blocked_activation_or_static_missing',
    summary: passed
      ? 'static paths and required names are present'
      : 'static path or required name is missing',
    missing_env_names: missingEnv,
    missing_paths: missingPaths,
  };
}

function gitShaEnvMatch(gate, expectedEnv, actualEnv) {
  const missing = [expectedEnv, actualEnv].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return {
      id: gate.id,
      status: 'blocked_activation_missing_env',
      summary: 'source SHA env names are missing',
      missing_env_names: missing,
    };
  }
  const match = process.env[expectedEnv] === process.env[actualEnv];
  return {
    id: gate.id,
    status: match ? 'passed' : 'blocked_source_sha_mismatch',
    summary: match
      ? 'expected and active source SHA match'
      : 'expected and active source SHA differ',
    missing_env_names: [],
  };
}

function scopeDiff(gate, contractPath) {
  const contract = readJson(contractPath);
  const changed = changedFiles(contract.task.immutable_base_sha);
  const bad = changed.filter(
    (filePath) => !isAllowedPath(filePath, contract.ownership.allowed_path_prefixes),
  );
  return {
    id: gate.id,
    status: bad.length === 0 ? 'passed' : 'blocked_scope_drift',
    summary:
      bad.length === 0
        ? 'changed files stay inside OT-75-owned paths'
        : 'changed files include forbidden paths',
    changed_file_count: changed.length,
    forbidden_changed_files: bad,
  };
}

function changedFiles(baseSha) {
  return unique([
    ...git(['diff', '--name-only', `${baseSha}...HEAD`]),
    ...git(['diff', '--name-only', '--cached']),
    ...git(['diff', '--name-only']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ]).sort();
}

function isAllowedPath(filePath, allowedPrefixes) {
  const normalized = filePath.replace(/\\/g, '/');
  return allowedPrefixes.some((prefix) =>
    prefix.endsWith('/') ? normalized.startsWith(prefix) : normalized === prefix,
  );
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(ROOT, filePath), 'utf8'));
}

function unique(values) {
  return [...new Set(values)];
}

main();
