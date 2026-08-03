#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const checkLive = args.has('--live');

const files = {
  state: 'ops/codex-runs/ONE-TIME-FINISH-NOW/STATE.json',
  directorState: 'ops/director/CURRENT-STATE.json',
  directorMatrix: 'ops/director/CAPABILITY-MATRIX.json',
  directorDeployments: 'ops/director/DEPLOYMENTS.json',
  directorStart: 'ops/director/START-HERE.md',
};

const staleTokens = [
  '1197673fa409bfc4c649c2683f782e86775caa5e',
  'ops11-1197673',
  'c7d46066517d7a458d189f2c782cc06200f7861c',
];

const failures = [];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertTextExcludes(filePath, tokens) {
  const text = readFileSync(filePath, 'utf8');
  for (const token of tokens) {
    if (text.includes(token)) failures.push(`${filePath} still contains stale token ${token}`);
  }
}

async function fetchRuntimeIdentity(url, probeToken) {
  const response = await fetch(`${url}/api/internal/ops/diagnostics`, {
    headers: { 'x-ops-probe-token': probeToken },
  });
  if (!response.ok) {
    throw new Error(`${url}/api/internal/ops/diagnostics returned ${response.status}`);
  }
  const body = await response.json();
  if (!body || typeof body !== 'object' || !body.runtime || typeof body.runtime !== 'object') {
    throw new Error(`${url}/api/internal/ops/diagnostics omitted protected runtime identity`);
  }
  return body.runtime;
}

const state = readJson(files.state);
const directorState = readJson(files.directorState);
const directorMatrix = readJson(files.directorMatrix);
const directorDeployments = readJson(files.directorDeployments);

const expectedVersion = state.live_readback.production.version;
const expectedSha = state.live_readback.production.commit_sha;
const expectedTopline = state.topline;
const expectedProductionRailway = state.live_readback.production.railway;
const expectedStagingRailway = state.live_readback.staging.railway;

assertEqual(
  'state production/staging version',
  state.live_readback.staging.version,
  expectedVersion,
);
assertEqual('state production/staging sha', state.live_readback.staging.commit_sha, expectedSha);

assertEqual('director release version', directorState.release_truth.version, expectedVersion);
assertEqual('director release runtime sha', directorState.release_truth.runtime_sha, expectedSha);
assertEqual(
  'director production readback version',
  directorState.live_readback.production.version,
  expectedVersion,
);
assertEqual(
  'director production readback sha',
  directorState.live_readback.production.commit_sha,
  expectedSha,
);
assertEqual(
  'director staging readback version',
  directorState.live_readback.staging.version,
  expectedVersion,
);
assertEqual(
  'director staging readback sha',
  directorState.live_readback.staging.commit_sha,
  expectedSha,
);

for (const [key, expected] of Object.entries(expectedTopline)) {
  assertEqual(`director topline ${key}`, directorState.release_truth[key], expected);
}

assertEqual('director matrix runtime sha', directorMatrix.production_runtime_sha, expectedSha);
assertEqual('director matrix version', directorMatrix.production_version, expectedVersion);

assertEqual(
  'deployment production sha',
  directorDeployments.production.runtime_source_sha,
  expectedSha,
);
assertEqual(
  'deployment production version',
  directorDeployments.production.version,
  expectedVersion,
);
assertEqual('deployment staging sha', directorDeployments.staging.runtime_source_sha, expectedSha);
assertEqual('deployment staging version', directorDeployments.staging.version, expectedVersion);
assertEqual(
  'deployment production web id',
  directorDeployments.production.web_deployment,
  expectedProductionRailway.web_deployment_id,
);
assertEqual(
  'deployment production worker id',
  directorDeployments.production.worker_deployment,
  expectedProductionRailway.worker_deployment_id,
);
assertEqual(
  'deployment production web digest',
  directorDeployments.production.web_digest,
  expectedProductionRailway.web_image_digest,
);
assertEqual(
  'deployment production worker digest',
  directorDeployments.production.worker_digest,
  expectedProductionRailway.worker_image_digest,
);
assertEqual(
  'deployment staging web id',
  directorDeployments.staging.web_deployment,
  expectedStagingRailway.web_deployment_id,
);
assertEqual(
  'deployment staging worker id',
  directorDeployments.staging.worker_deployment,
  expectedStagingRailway.worker_deployment_id,
);
assertEqual(
  'deployment staging web digest',
  directorDeployments.staging.web_digest,
  expectedStagingRailway.web_image_digest,
);
assertEqual(
  'deployment staging worker digest',
  directorDeployments.staging.worker_digest,
  expectedStagingRailway.worker_image_digest,
);

for (const filePath of Object.values(files)) {
  assertTextExcludes(filePath, staleTokens);
}

if (checkLive) {
  try {
    const probeToken = process.env.OPERATIONS_PROBE_TOKEN;
    if (!probeToken) {
      throw new Error('OPERATIONS_PROBE_TOKEN is required for protected live readback');
    }
    const [production, staging] = await Promise.all([
      fetchRuntimeIdentity(state.live_readback.production.url, probeToken),
      fetchRuntimeIdentity(state.live_readback.staging.url, probeToken),
    ]);
    assertEqual('live production version', production.version, expectedVersion);
    assertEqual('live production sha', production.commit_sha, expectedSha);
    assertEqual('live staging version', staging.version, expectedVersion);
    assertEqual('live staging sha', staging.commit_sha, expectedSha);
  } catch (error) {
    failures.push(
      `live readback failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(`Director truth check failed with ${failures.length} issue(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  JSON.stringify(
    {
      status: 'ok',
      checked_live: checkLive,
      version: expectedVersion,
      runtime_sha: expectedSha,
      files_checked: Object.values(files),
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
