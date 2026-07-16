#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { TASK_ID, flagValue, outputJson, parseArgs, writeJson } from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const outFile = flagValue(flags, 'out');
const baseUrl = flagValue(flags, 'base-url');
const expectedSha = flagValue(flags, 'expected-sha');
const implementedPaths = discoverPaths();
const result = {
  task_id: TASK_ID,
  generated_at_utc: new Date().toISOString(),
  mode: baseUrl ? 'http_probe' : 'source_discovery',
  implemented_paths: implementedPaths,
  probes: [],
  expected_sha: expectedSha ?? null,
  status: 'pass',
};

if (baseUrl) {
  for (const path of ['/health', '/ready', '/version', '/', '/signup', '/login']) {
    result.probes.push(await probe(baseUrl, path));
  }
  const version = result.probes.find((item) => item.path === '/version');
  if (expectedSha && version?.json?.commit_sha !== expectedSha) {
    result.status = 'fail';
    result.failure = 'version_sha_mismatch';
  }
  if (result.probes.some((item) => item.error || item.status_code >= 500)) result.status = 'fail';
}

if (outFile) writeJson(outFile, result);
outputJson(result);
if (result.status === 'fail') process.exit(1);

function discoverPaths() {
  const source = readFileSync('apps/web/src/server/app.ts', 'utf8');
  const paths = [...source.matchAll(/app\.(?:get|post)\('([^']+)'/g)].map((match) => match[1]);
  return [...new Set(paths)].sort();
}

async function probe(root, path) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, root));
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      path,
      status_code: response.status,
      elapsed_ms: Math.round(performance.now() - started),
      json,
    };
  } catch (error) {
    return { path, error: error.message, elapsed_ms: Math.round(performance.now() - started) };
  }
}
