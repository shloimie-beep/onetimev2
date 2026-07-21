#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = 'shloimie-beep/onetimev2';
const EXPECTED_BLOCKER = 'RAILWAY_PR_ENVIRONMENTS_NOT_ENABLED_OR_SOURCE_NOT_CONNECTED';

const REQUIRED_FILES = [
  'ops/repository-transfer/CURRENT-REPOSITORY.json',
  'ops/repository-transfer/TRANSFER-MAP.md',
  'ops/repository-transfer/ACTIVE-REFERENCE-AUDIT.json',
  'ops/previews/PREVIEW-CONTRACT.md',
  'ops/previews/registry.json',
  'ops/previews/current.json',
  '.github/pull_request_template.md',
  'scripts/previews/discover-pr-preview.mjs',
  'scripts/previews/check-preview-contract.mjs',
];

function readJson(file) {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
}

function fail(errors) {
  console.error('PREVIEW_CONTRACT: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

function main() {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(path.resolve(file))) errors.push(`Missing required file: ${file}`);
  }
  if (errors.length) fail(errors);

  const packageJson = readJson('package.json');
  const currentRepository = readJson('ops/repository-transfer/CURRENT-REPOSITORY.json');
  const audit = readJson('ops/repository-transfer/ACTIVE-REFERENCE-AUDIT.json');
  const registry = readJson('ops/previews/registry.json');
  const current = readJson('ops/previews/current.json');
  const prTemplate = readFileSync(path.resolve('.github/pull_request_template.md'), 'utf8');

  if (packageJson.scripts?.['preview:discover'] !== 'node scripts/previews/discover-pr-preview.mjs --write') {
    errors.push('package.json is missing the preview:discover command.');
  }
  if (packageJson.scripts?.['preview:check'] !== 'node scripts/previews/check-preview-contract.mjs') {
    errors.push('package.json is missing the preview:check command.');
  }
  if (!/^\s*Preview URL:\s*/im.test(prTemplate)) {
    errors.push('.github/pull_request_template.md is missing a Preview URL field.');
  }
  if (!/^\s*Production changed:\s*NO\s*$/im.test(prTemplate)) {
    errors.push('.github/pull_request_template.md is missing Production changed: NO.');
  }

  for (const [label, value] of [
    ['CURRENT-REPOSITORY canonical repository', currentRepository.canonical_repository],
    ['ACTIVE-REFERENCE-AUDIT canonical repository', audit.canonical_repository],
    ['preview registry canonical repository', registry.canonical_repository],
    ['preview current canonical repository', current.canonical_repository],
  ]) {
    if (value !== REPO) errors.push(`${label} is ${value}; expected ${REPO}.`);
  }

  if (current.production_changed !== false) errors.push('ops/previews/current.json must record production_changed=false.');
  if (currentRepository.production_changed !== false) {
    errors.push('ops/repository-transfer/CURRENT-REPOSITORY.json must record production_changed=false.');
  }

  const records = current.preview_records ?? [];
  const requiredPrs = registry.tracked_pull_requests.filter((entry) => entry.preview_required);
  for (const entry of requiredPrs) {
    const record = records.find((candidate) =>
      entry.pr_number === null
        ? candidate.head_branch === entry.head_branch
        : candidate.pr_number === entry.pr_number,
    );
    if (!record) {
      errors.push(`Missing preview record for ${entry.pr_number === null ? entry.head_branch : `PR #${entry.pr_number}`}.`);
      continue;
    }

    for (const field of [
      'head_sha',
      'railway_environment_id',
      'web_url',
      'worker_status',
      'database_mode',
      'expiration',
      'safe_test_identity_mode',
      'last_deployment_status',
    ]) {
      if (!(field in record)) errors.push(`Preview record for ${entry.head_branch} is missing ${field}.`);
    }

    if (record.web_url && !/^https?:\/\//i.test(record.web_url)) {
      errors.push(`Preview record for ${entry.head_branch} has a non-URL web_url.`);
    }
    if (!record.web_url && record.blocker !== EXPECTED_BLOCKER) {
      errors.push(`Preview record for ${entry.head_branch} must use blocker ${EXPECTED_BLOCKER}.`);
    }
    if (record.database_mode && /production/i.test(record.database_mode)) {
      errors.push(`Preview record for ${entry.head_branch} references a production database mode.`);
    }
  }

  const blockers = new Set(records.filter((record) => !record.web_url).map((record) => record.blocker).filter(Boolean));
  if (blockers.size > 1) {
    errors.push(`Preview failures must report one exact blocker; found ${Array.from(blockers).join(', ')}.`);
  }
  if (blockers.size === 1 && !blockers.has(EXPECTED_BLOCKER)) {
    errors.push(`Unexpected preview blocker: ${Array.from(blockers)[0]}.`);
  }

  if (errors.length) fail(errors);

  const missingLiveUrls = records.filter((record) => !record.web_url);
  if (missingLiveUrls.length > 0) {
    console.log(`PREVIEW_CONTRACT: BLOCKED(${EXPECTED_BLOCKER})`);
    console.log(`MISSING_PREVIEW_URLS: ${missingLiveUrls.map((record) => record.pr_number ?? record.head_branch).join(', ')}`);
  } else {
    console.log('PREVIEW_CONTRACT: ENABLED');
  }
  console.log('PRODUCTION_CHANGED: NO');
}

main();
