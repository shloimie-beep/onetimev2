#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPO = 'shloimie-beep/onetimev2';
const EXPECTED_BLOCKER = 'RAILWAY_PR_ENVIRONMENTS_NOT_ENABLED_OR_SOURCE_NOT_CONNECTED';
const REGISTRY_PATH = path.resolve('ops/previews/registry.json');
const CURRENT_PATH = path.resolve('ops/previews/current.json');
const STAGING_RAILWAY = {
  projectId: '7c8eee26-7a6a-4684-826d-9f4377d67d46',
  baseEnvironment: 'staging',
  baseEnvironmentId: '11edf8a2-0160-45b4-a039-b15b4beb4c10',
  webServiceId: '9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2',
  workerServiceId: '76e7fdc2-99b9-4a82-ba55-5dff3723398f',
};

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function run(command, args, options = {}) {
  const useWindowsShim = command === 'railway' && process.platform === 'win32';
  const resolvedCommand = useWindowsShim ? 'cmd.exe' : command;
  const resolvedArgs = useWindowsShim ? ['/d', '/s', '/c', command, ...args] : args;
  try {
    return {
      ok: true,
      stdout: execFileSync(resolvedCommand, resolvedArgs, {
        cwd: options.cwd ?? process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeoutMs ?? 20000,
      }),
      stderr: '',
      status: 0,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() || error.message,
      status: error.status ?? 1,
    };
  }
}

function parseFirstJson(text) {
  const source = text.trim();
  for (let start = 0; start < source.length; start += 1) {
    const first = source[start];
    if (first !== '{' && first !== '[') continue;

    const stack = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        const expected = char === '}' ? '{' : '[';
        if (stack.at(-1) !== expected) break;
        stack.pop();
        if (stack.length === 0) {
          const candidate = source.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function runJson(command, args, options = {}) {
  const result = run(command, args, options);
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout, raw: result };
  const parsed = parseFirstJson(result.stdout);
  if (parsed === null) {
    return { ok: false, error: `No JSON object found in ${command} output`, raw: result };
  }
  return { ok: true, value: parsed, raw: result };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function previewField(body) {
  const match = (body ?? '').match(/^\s*Preview URL:\s*(.+?)\s*$/im);
  if (!match) return { present: false, value: null, url: null };
  const value = match[1].trim();
  const url = value.match(/^https?:\/\/\S+/i)?.[0] ?? null;
  return { present: true, value, url };
}

function getPr(number) {
  const result = runJson('gh', [
    'pr',
    'view',
    String(number),
    '--repo',
    REPO,
    '--json',
    'number,title,headRefName,headRefOid,baseRefName,state,url,body',
  ]);
  return result.ok ? result.value : null;
}

function getCurrentBranchPr() {
  const result = runJson('gh', [
    'pr',
    'view',
    '--repo',
    REPO,
    '--json',
    'number,title,headRefName,headRefOid,baseRefName,state,url,body',
  ]);
  if (result.ok) return result.value;

  const currentBranch = getGitValue(['branch', '--show-current']);
  if (!currentBranch) return null;

  const list = runJson('gh', [
    'pr',
    'list',
    '--repo',
    REPO,
    '--head',
    currentBranch,
    '--state',
    'open',
    '--json',
    'number,title,headRefName,headRefOid,baseRefName,state,url,body',
  ]);
  return list.ok && Array.isArray(list.value) ? (list.value[0] ?? null) : null;
}

function getGitValue(args) {
  const result = run('git', args);
  return result.ok ? result.stdout.trim() : null;
}

function discoverEphemeralEnvironments() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'onetime-railway-preview-'));
  try {
    const link = run(
      'railway',
      [
        'link',
        '--project',
        STAGING_RAILWAY.projectId,
        '--environment',
        STAGING_RAILWAY.baseEnvironment,
        '--service',
        STAGING_RAILWAY.webServiceId,
        '--json',
      ],
      { cwd: tempDir, timeoutMs: 30000 },
    );
    if (!link.ok) {
      return { ok: false, environments: [], error: link.stderr || link.stdout };
    }

    const list = runJson('railway', ['environment', 'list', '--ephemeral', '--json'], {
      cwd: tempDir,
      timeoutMs: 30000,
    });
    if (!list.ok) {
      return { ok: false, environments: [], error: list.error };
    }

    return { ok: true, environments: Array.isArray(list.value) ? list.value : [], error: null };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function getDeployments() {
  const result = runJson('gh', ['api', `repos/${REPO}/deployments?per_page=100`]);
  return result.ok && Array.isArray(result.value) ? result.value : [];
}

function stringify(value) {
  return JSON.stringify(value ?? '').toLowerCase();
}

function findEnvironmentForPr(environments, pr) {
  if (!pr) return null;
  const branch = pr.headRefName?.toLowerCase() ?? '';
  const pull = `pr-${pr.number}`;
  const pullAlt = `pull/${pr.number}`;

  return (
    environments.find((environment) => {
      const haystack = stringify(environment);
      return haystack.includes(pull) || haystack.includes(pullAlt) || (branch && haystack.includes(branch));
    }) ?? null
  );
}

function environmentId(environment) {
  return (
    environment?.id ??
    environment?.environmentId ??
    environment?.projectEnvironmentId ??
    environment?.deploymentEnvironmentId ??
    null
  );
}

function environmentWebUrl(environment) {
  const haystack = stringify(environment);
  const match = haystack.match(/https?:\/\/[a-z0-9.-]+\.up\.railway\.app/i);
  return match?.[0] ?? null;
}

function findDeploymentForPr(deployments, pr) {
  if (!pr) return null;
  return (
    deployments.find((deployment) => deployment.sha === pr.headRefOid) ??
    deployments.find((deployment) => deployment.ref === pr.headRefName) ??
    null
  );
}

function recordForRegistryEntry(entry, pr, environments, deployments) {
  const field = previewField(pr?.body);
  const environment = findEnvironmentForPr(environments, pr);
  const deployment = findDeploymentForPr(deployments, pr);
  const webUrl = field.url ?? environmentWebUrl(environment);
  const blocked = !webUrl;

  return {
    pr_number: pr?.number ?? entry.pr_number ?? null,
    lane: entry.lane,
    title: pr?.title ?? entry.title,
    head_branch: pr?.headRefName ?? entry.head_branch,
    head_sha: pr?.headRefOid ?? getGitValue(['rev-parse', 'HEAD']),
    base_branch: pr?.baseRefName ?? entry.base_branch,
    url: pr?.url ?? null,
    railway_environment_id: environmentId(environment),
    web_url: webUrl,
    worker_status: blocked ? 'blocked_no_pr_environment' : 'pending_worker_status_verification',
    database_mode: blocked
      ? `not_provisioned_use_${entry.database_mode}`
      : entry.database_mode,
    expiration: 'on_pull_request_close',
    safe_test_identity_mode: entry.safe_test_identity_mode,
    last_deployment_status: deployment?.state ?? (blocked ? 'blocked_no_railway_pr_environment' : 'unknown'),
    pr_body_preview_field: field.present,
    preview_field_value: field.value,
    blocker: blocked ? EXPECTED_BLOCKER : null,
  };
}

function main() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`Missing ${path.relative(process.cwd(), REGISTRY_PATH)}`);
    process.exit(1);
  }

  const write = process.argv.includes('--write');
  const registry = readJson(REGISTRY_PATH);
  const railway = discoverEphemeralEnvironments();
  const deployments = getDeployments();

  const records = [];
  for (const entry of registry.tracked_pull_requests) {
    if (entry.pr_number === null) continue;
    records.push(recordForRegistryEntry(entry, getPr(entry.pr_number), railway.environments, deployments));
  }

  const currentBranch = getGitValue(['branch', '--show-current']);
  const selfEntry = registry.tracked_pull_requests.find((entry) => entry.head_branch === currentBranch);
  if (selfEntry) {
    records.push(recordForRegistryEntry(selfEntry, getCurrentBranchPr(), railway.environments, deployments));
  }

  const liveMissing = records.filter((record) => !record.web_url);
  const current = {
    schema_version: 'onetime.preview.current.v1',
    generated_at: utcNow(),
    canonical_repository: REPO,
    railway_pr_environments: {
      status: liveMissing.length === 0 ? 'enabled' : 'blocked',
      blocker: liveMissing.length === 0 ? null : EXPECTED_BLOCKER,
      base_environment: STAGING_RAILWAY.baseEnvironment,
      base_environment_id: STAGING_RAILWAY.baseEnvironmentId,
      ephemeral_environments: railway.environments,
      railway_cli_error: railway.ok ? null : railway.error,
      production_changed: false,
    },
    preview_records: records,
    production_changed: false,
  };

  if (write) writeJson(CURRENT_PATH, current);
  console.log(JSON.stringify(current, null, 2));
}

main();
