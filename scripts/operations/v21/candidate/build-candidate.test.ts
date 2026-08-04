import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_CORE_KEYS,
  CANDIDATE_DOMAIN_PREFIX,
  CANDIDATE_INPUT_SET_NAMES,
  NATIVE_POSTGRESQL_PROBE_IDS,
  buildCandidate,
  buildCandidateDocuments,
  canonicalJson,
  deriveCandidateInputSets,
  type CandidateBuildRequest,
} from './build-candidate.ts';

const repositoryRoot = process.cwd();
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function requestFixture(): CandidateBuildRequest {
  return {
    schema_version: 1,
    repository_source_sha: sourceSha,
    tool_versions: {
      node: '24.13.0',
      npm: '11.6.2',
      git: '2.50.1.windows.1',
      postgresql: '18.4',
    },
    commands: [
      'npm ci',
      'npm run build',
      'npm run verify',
      'npm run db:migrate',
      'npm run db:verify',
    ],
    native_postgresql: {
      engine_version: '18.4',
      migration_count: 91,
      ledger_digest: sha256('immutable migration ledger'),
      pending_count: 0,
      issue_count: 0,
      probes: NATIVE_POSTGRESQL_PROBE_IDS.map((id) => ({ id, passed: true })),
    },
  };
}

describe('I36 deterministic candidate builder', () => {
  it('derives every exact non-empty input set from raw blobs at the exact Git SHA', () => {
    const sets = deriveCandidateInputSets(repositoryRoot, sourceSha);
    expect(Object.keys(sets)).toEqual(CANDIDATE_INPUT_SET_NAMES);
    for (const setName of CANDIDATE_INPUT_SET_NAMES) {
      expect(sets[setName].expected_paths.length, setName).toBeGreaterThan(0);
      expect(
        sets[setName].files.map(({ path }) => path),
        setName,
      ).toEqual(sets[setName].expected_paths);
    }
    const registry = execFileSync(
      'git',
      ['cat-file', 'blob', `${sourceSha}:ops/day-one/visible-action-registry.json`],
      { cwd: repositoryRoot },
    );
    expect(sets.route_action_inventory.files).toEqual([
      { path: 'ops/day-one/visible-action-registry.json', sha256: sha256(registry) },
    ]);
    expect(sets.application_content.expected_paths).toHaveLength(1164);
    expect(sets.web_artifact.expected_paths).toHaveLength(1030);
    expect(sets.worker_artifact.expected_paths).toHaveLength(1030);
    expect(sets.application_content.expected_paths).toEqual(
      [...sets.application_content.expected_paths].sort((left, right) =>
        Buffer.compare(Buffer.from(left), Buffer.from(right)),
      ),
    );
    for (const requiredPath of [
      '.dockerignore',
      '.prettierrc.json',
      'Dockerfile',
      'eslint.config.js',
      'package.json',
      'package-lock.json',
      'tsconfig.typecheck.json',
      'apps/web/src/server/app.ts',
      'apps/worker/src/main/index.ts',
      'ops/commercial/ot87/family-plan.v1.json',
      'railway.json',
      'railway.web.staging.json',
      'railway.worker.staging.json',
    ]) {
      expect(sets.application_content.expected_paths, requiredPath).toContain(requiredPath);
    }
    for (const requiredPath of [
      '.dockerignore',
      '.prettierrc.json',
      'Dockerfile',
      'eslint.config.js',
      'package.json',
      'package-lock.json',
      'tsconfig.typecheck.json',
      'apps/web/src/server/app.ts',
      'apps/worker/src/main/index.ts',
      'ops/commercial/ot87/family-plan.v1.json',
      'railway.json',
    ]) {
      expect(sets.web_artifact.expected_paths, requiredPath).toContain(requiredPath);
      expect(sets.worker_artifact.expected_paths, requiredPath).toContain(requiredPath);
    }
    expect(sets.web_artifact.expected_paths).toContain('railway.web.staging.json');
    expect(sets.web_artifact.expected_paths).not.toContain('railway.worker.staging.json');
    expect(sets.worker_artifact.expected_paths).toContain('railway.worker.staging.json');
    expect(sets.worker_artifact.expected_paths).not.toContain('railway.web.staging.json');
    expect(
      sets.application_content.expected_paths.some((entry) =>
        /^ops\/v2\.1-execution\/(?:control|runtime|results|proofs|merge)(?:\/|$)/u.test(entry),
      ),
    ).toBe(false);
    expect(JSON.stringify(sets)).not.toMatch(/dist\/apps\/(?:web|worker)\/(?:server|main)\.js/u);
    expect(JSON.stringify(sets)).not.toMatch(/(?:git-archive|build-context\.tar|artifact.*\.tar)/u);

    for (const [setName, repositoryPath] of [
      ['application_content', 'Dockerfile'],
      ['web_artifact', 'railway.web.staging.json'],
      ['worker_artifact', 'railway.worker.staging.json'],
    ] as const) {
      const blob = execFileSync('git', ['cat-file', 'blob', `${sourceSha}:${repositoryPath}`], {
        cwd: repositoryRoot,
      });
      expect(
        sets[setName].files.find(({ path }) => path === repositoryPath),
        `${setName}:${repositoryPath}`,
      ).toEqual({ path: repositoryPath, sha256: sha256(blob) });
    }

    sets.web_artifact.files[0]!.sha256 = '0'.repeat(64);
    expect(
      deriveCandidateInputSets(repositoryRoot, sourceSha).web_artifact.files[0]!.sha256,
    ).not.toBe('0'.repeat(64));
  }, 30_000);

  it('derives the candidate identity deterministically without caller-supplied path inventories', () => {
    const request = requestFixture();
    const first = buildCandidate(request, { repository_root: repositoryRoot });
    const second = buildCandidate(structuredClone(request), { repository_root: repositoryRoot });
    expect(second).toEqual(first);
    expect(Object.keys(first.candidate_core)).toEqual(CANDIDATE_CORE_KEYS);
    expect(first.candidate_core.repository_source_sha).toBe(sourceSha);
    expect(first.canonical_candidate_digest).toBe(
      sha256(
        Buffer.concat([
          Buffer.from(CANDIDATE_DOMAIN_PREFIX),
          Buffer.from(canonicalJson(first.candidate_core)),
        ]),
      ),
    );
  });

  it('rejects caller inventories, source omissions, placeholders, and failed probes', () => {
    const callerInventory = requestFixture() as unknown as Record<string, unknown>;
    callerInventory.input_sets = {};
    expect(() => buildCandidate(callerInventory, { repository_root: repositoryRoot })).toThrow(
      /extra: input_sets/,
    );

    const missingSource = requestFixture();
    missingSource.repository_source_sha = '0'.repeat(40);
    expect(() => buildCandidate(missingSource, { repository_root: repositoryRoot })).toThrow(
      /Git source derivation failed/,
    );

    const placeholder = requestFixture() as unknown as Record<string, unknown>;
    placeholder.commands = ['npm run <BUILD>'];
    expect(() => buildCandidate(placeholder, { repository_root: repositoryRoot })).toThrow(
      /unresolved placeholder/,
    );

    const failedProbe = requestFixture();
    const firstProbe = failedProbe.native_postgresql.probes[0];
    if (firstProbe) firstProbe.passed = false;
    expect(() => buildCandidate(failedProbe, { repository_root: repositoryRoot })).toThrow(
      /passed named probe/,
    );

    const pre2260MigrationCount = requestFixture();
    pre2260MigrationCount.native_postgresql.migration_count = 90;
    expect(() =>
      buildCandidate(pre2260MigrationCount, { repository_root: repositoryRoot }),
    ).toThrow(/exactly 91 migrations/);
  });

  it('renders later-freeze documents outside candidate identity', () => {
    const documents = buildCandidateDocuments(requestFixture(), '2026-08-02T07:00:00Z', {
      repository_root: repositoryRoot,
    });
    const digest = documents.canonical_candidate_digest;
    expect(documents.candidate_directory).toBe(`ops/v2.1-execution/merge/candidates/${digest}`);
    expect(JSON.parse(documents.derivation_json)).toEqual(documents.derivation);
    const require = createRequire(import.meta.url);
    const yaml = require('js-yaml') as { load(value: string): Record<string, unknown> };
    const manifest = yaml.load(documents.candidate_yaml);
    expect(manifest.canonical_candidate_digest).toBe(digest);
    expect(manifest.frozen_at).toBe('2026-08-02T07:00:00Z');
  });
});
