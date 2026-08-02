import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_CORE_KEYS,
  CANDIDATE_DOMAIN_PREFIX,
  NATIVE_POSTGRESQL_PROBE_IDS,
  buildCandidate,
  buildCandidateDocuments,
  canonicalJson,
  type CandidateBuildRequest,
  type CandidateInputFile,
  type CandidateInputSet,
  type CandidateInputSetName,
} from './build-candidate.ts';

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

const file = (path: string): CandidateInputFile => ({
  path,
  sha256: sha256(`content:${path}`),
});

const set = (...paths: string[]): CandidateInputSet => ({
  expected_paths: paths,
  files: paths.map(file),
});

function requestFixture(): CandidateBuildRequest {
  return {
    schema_version: 1,
    repository_source_sha: 'a'.repeat(40),
    input_sets: {
      application_content: set('apps/web/src/server/app.ts', 'packages/domain/src/index.ts'),
      product_tree: set('git/product-tree.inventory'),
      web_artifact: set('dist/apps/web/server.js'),
      worker_artifact: set('dist/apps/worker/main.js'),
      configuration_bundle: set('packages/config/src/index.ts'),
      migration_inventory: set('packages/db/migrations/2257_v21_provider_registry_bindings.sql'),
      frontend_assets: set('dist/apps/web/public/assets/app.js'),
      route_action_inventory: set('ops/day-one/visible-action-registry.json'),
      workflow_registry: set('integrations/highlevel/registry/workflow-registry.yaml'),
      highlevel_registry: set('integrations/highlevel/registry/current.json'),
      provider_registry: set('packages/db/migrations/2257_v21_provider_registry_bindings.sql'),
      message_catalog: set(
        'ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md',
      ),
      acceptance_contract: set('ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml'),
      environment_profile_schema: set('ops/release/ot75/environment-schema.json'),
    },
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
      migration_count: 88,
      ledger_digest: sha256('immutable migration ledger'),
      pending_count: 0,
      issue_count: 0,
      probes: NATIVE_POSTGRESQL_PROBE_IDS.map((id) => ({ id, passed: true })),
    },
  };
}

const clone = <T>(value: T): T => structuredClone(value);

describe('I36 deterministic candidate builder', () => {
  it('derives the exact candidate core and domain-separated digest deterministically', () => {
    const request = requestFixture();
    const first = buildCandidate(request);
    const second = buildCandidate(clone(request));

    expect(second).toEqual(first);
    expect(Object.keys(first.candidate_core)).toEqual(CANDIDATE_CORE_KEYS);
    expect(first.candidate_core.application_content_sha256).toBe(
      sha256(
        request.input_sets.application_content.files
          .map(({ path, sha256: digest }) => `${path}\0${digest}\n`)
          .join(''),
      ),
    );
    expect(first.candidate_core.route_action_inventory_digest).toBe(
      request.input_sets.route_action_inventory.files[0]?.sha256,
    );
    expect(first.canonical_candidate_digest).toBe(
      sha256(
        Buffer.concat([
          Buffer.from(CANDIDATE_DOMAIN_PREFIX),
          Buffer.from(canonicalJson(first.candidate_core)),
        ]),
      ),
    );
    expect(first.derivation.input_sets.web_artifact).toMatchObject({
      digest_mode: 'inventory_sha256',
      candidate_core_field: 'web_artifact_digest',
      expected_paths: request.input_sets.web_artifact.expected_paths,
      files: request.input_sets.web_artifact.files,
      digest: first.candidate_core.web_artifact_digest,
    });
    expect(first.derivation.native_postgresql).toEqual(request.native_postgresql);
  });

  it('renders exact later-freeze derivation and manifest documents outside candidate identity', () => {
    const documents = buildCandidateDocuments(requestFixture(), '2026-08-02T07:00:00Z');
    const digest = documents.canonical_candidate_digest;

    expect(documents.candidate_directory).toBe(`ops/v2.1-execution/merge/candidates/${digest}`);
    expect(documents.derivation_path).toBe(
      `${documents.candidate_directory}/CANDIDATE-DERIVATION.json`,
    );
    expect(documents.manifest_path).toBe(`${documents.candidate_directory}/CANDIDATE.yaml`);
    expect(JSON.parse(documents.derivation_json)).toEqual(documents.derivation);

    const require = createRequire(import.meta.url);
    const yaml = require('js-yaml') as { load(value: string): Record<string, unknown> };
    const manifest = yaml.load(documents.candidate_yaml);
    expect(manifest.candidate_core).toEqual(documents.candidate_core);
    expect(manifest.canonical_candidate_digest).toBe(digest);
    expect(manifest.frozen_at).toBe('2026-08-02T07:00:00Z');
    expect(manifest.evidence_branch).toBe(`codex/v21-evidence-${digest.slice(0, 12)}`);
  });

  it.each([
    [
      'a missing input set',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<string, unknown>;
        delete inputSets.worker_artifact;
      },
      /missing: worker_artifact/,
    ],
    [
      'an extra input set',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<string, unknown>;
        inputSets.untracked = set('untracked.txt');
      },
      /extra: untracked/,
    ],
    [
      'an extra declared-set input',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<CandidateInputSetName, CandidateInputSet>;
        inputSets.route_action_inventory.files.push(file('ops/day-one/another-registry.json'));
        inputSets.route_action_inventory.files.sort((left, right) =>
          left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
        );
      },
      /extra: ops\/day-one\/another-registry\.json/,
    ],
    [
      'a missing declared input',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<CandidateInputSetName, CandidateInputSet>;
        inputSets.application_content.files.pop();
      },
      /missing: packages\/domain\/src\/index\.ts/,
    ],
    [
      'unsorted inputs',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<CandidateInputSetName, CandidateInputSet>;
        inputSets.application_content.files.reverse();
      },
      /strictly sorted/,
    ],
    [
      'an unresolved placeholder',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<CandidateInputSetName, CandidateInputSet>;
        inputSets.web_artifact.expected_paths[0] = 'dist/<WEB_ARTIFACT>.js';
        inputSets.web_artifact.files[0] = file('dist/<WEB_ARTIFACT>.js');
      },
      /unresolved placeholder/,
    ],
    [
      'a floating-point value',
      (request: Record<string, unknown>) => {
        const native = request.native_postgresql as Record<string, unknown>;
        native.migration_count = 88.5;
      },
      /floating-point/,
    ],
    [
      'a mutable application-content path',
      (request: Record<string, unknown>) => {
        const inputSets = request.input_sets as Record<CandidateInputSetName, CandidateInputSet>;
        inputSets.application_content = set('ops/v2.1-execution/runtime/I36/TASK-STATE.yaml');
      },
      /mutable candidate record/,
    ],
    [
      'a failed native PostgreSQL probe',
      (request: Record<string, unknown>) => {
        const native = request.native_postgresql as CandidateBuildRequest['native_postgresql'];
        const first = native.probes[0];
        if (first) first.passed = false;
      },
      /passed named probe/,
    ],
    [
      'a duplicate command',
      (request: Record<string, unknown>) => {
        const commands = request.commands as string[];
        commands.push(commands[0] ?? '');
      },
      /trimmed, and unique/,
    ],
  ])('rejects %s', (_label, mutate, expected) => {
    const request = clone(requestFixture()) as unknown as Record<string, unknown>;
    mutate(request);
    expect(() => buildCandidate(request)).toThrow(expected);
  });

  it('rejects timestamps and invalid freeze metadata from deterministic inputs', () => {
    const request = clone(requestFixture()) as unknown as Record<string, unknown>;
    request.generated_at = '2026-08-02T07:00:00Z';
    expect(() => buildCandidate(request)).toThrow(/nondeterministic field generated_at/);
    expect(() => buildCandidateDocuments(requestFixture(), 'today')).toThrow(/exact UTC ISO-8601/);
  });
});
