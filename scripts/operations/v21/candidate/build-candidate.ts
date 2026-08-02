import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

export const CANDIDATE_DOMAIN_PREFIX = 'ONE-TIME-V2.1-CANDIDATE\0';

export const CANDIDATE_CORE_KEYS = [
  'repository_source_sha',
  'application_content_sha256',
  'product_tree_digest',
  'web_artifact_digest',
  'worker_artifact_digest',
  'configuration_bundle_digest',
  'migration_inventory_digest',
  'frontend_asset_digest',
  'route_action_inventory_digest',
  'workflow_registry_digest',
  'highlevel_registry_digest',
  'provider_registry_digest',
  'message_catalog_digest',
  'acceptance_contract_digest',
  'environment_profile_schema_digest',
] as const;

export const CANDIDATE_INPUT_SET_NAMES = [
  'application_content',
  'product_tree',
  'web_artifact',
  'worker_artifact',
  'configuration_bundle',
  'migration_inventory',
  'frontend_assets',
  'route_action_inventory',
  'workflow_registry',
  'highlevel_registry',
  'provider_registry',
  'message_catalog',
  'acceptance_contract',
  'environment_profile_schema',
] as const;

export type CandidateInputSetName = (typeof CANDIDATE_INPUT_SET_NAMES)[number];
export type CandidateCoreKey = (typeof CANDIDATE_CORE_KEYS)[number];

type DigestMode = 'inventory_sha256' | 'single_file_sha256';

type InputSetDefinition = {
  candidate_core_field: Exclude<CandidateCoreKey, 'repository_source_sha'>;
  digest_mode: DigestMode;
  exact_paths?: readonly string[];
};

export const CANDIDATE_INPUT_SET_DEFINITIONS: Record<CandidateInputSetName, InputSetDefinition> = {
  application_content: {
    candidate_core_field: 'application_content_sha256',
    digest_mode: 'inventory_sha256',
  },
  product_tree: {
    candidate_core_field: 'product_tree_digest',
    digest_mode: 'inventory_sha256',
  },
  web_artifact: {
    candidate_core_field: 'web_artifact_digest',
    digest_mode: 'inventory_sha256',
  },
  worker_artifact: {
    candidate_core_field: 'worker_artifact_digest',
    digest_mode: 'inventory_sha256',
  },
  configuration_bundle: {
    candidate_core_field: 'configuration_bundle_digest',
    digest_mode: 'inventory_sha256',
  },
  migration_inventory: {
    candidate_core_field: 'migration_inventory_digest',
    digest_mode: 'inventory_sha256',
  },
  frontend_assets: {
    candidate_core_field: 'frontend_asset_digest',
    digest_mode: 'inventory_sha256',
  },
  route_action_inventory: {
    candidate_core_field: 'route_action_inventory_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['ops/day-one/visible-action-registry.json'],
  },
  workflow_registry: {
    candidate_core_field: 'workflow_registry_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['integrations/highlevel/registry/workflow-registry.yaml'],
  },
  highlevel_registry: {
    candidate_core_field: 'highlevel_registry_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['integrations/highlevel/registry/current.json'],
  },
  provider_registry: {
    candidate_core_field: 'provider_registry_digest',
    digest_mode: 'inventory_sha256',
  },
  message_catalog: {
    candidate_core_field: 'message_catalog_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md'],
  },
  acceptance_contract: {
    candidate_core_field: 'acceptance_contract_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml'],
  },
  environment_profile_schema: {
    candidate_core_field: 'environment_profile_schema_digest',
    digest_mode: 'single_file_sha256',
    exact_paths: ['ops/release/ot75/environment-schema.json'],
  },
};

export const NATIVE_POSTGRESQL_PROBE_IDS = [
  'cleanup',
  'delete_denial',
  'digest_shape',
  'null_operation_arrays',
  'rollback',
  'stale_update',
  'stripe_policy',
  'version_jump_update',
] as const;

export type CandidateInputFile = {
  path: string;
  sha256: string;
};

export type CandidateInputSet = {
  expected_paths: string[];
  files: CandidateInputFile[];
};

export type CandidateCore = Record<CandidateCoreKey, string>;

export type NativePostgresqlResult = {
  engine_version: string;
  migration_count: number;
  ledger_digest: string;
  pending_count: number;
  issue_count: number;
  probes: Array<{ id: string; passed: boolean }>;
};

export type CandidateBuildRequest = {
  schema_version: 1;
  repository_source_sha: string;
  tool_versions: {
    node: string;
    npm: string;
    git: string;
    postgresql: string;
  };
  commands: string[];
  native_postgresql: NativePostgresqlResult;
};

export type CandidateSourceOptions = {
  repository_root?: string;
};

export type CandidateDerivation = {
  schema_version: 1;
  execution_id: 'OT-V21-PRODUCTION';
  candidate_core: CandidateCore;
  canonicalization: {
    algorithm: 'sha256';
    domain_prefix_utf8: 'ONE-TIME-V2.1-CANDIDATE\\0';
    serialization: string;
  };
  canonical_candidate_digest: string;
  input_sets: Record<
    CandidateInputSetName,
    {
      digest_mode: DigestMode;
      candidate_core_field: Exclude<CandidateCoreKey, 'repository_source_sha'>;
      expected_paths: string[];
      files: CandidateInputFile[];
      digest: string;
    }
  >;
  tool_versions: CandidateBuildRequest['tool_versions'];
  commands: string[];
  native_postgresql: NativePostgresqlResult;
};

export type CandidateBuildResult = {
  candidate_core: CandidateCore;
  canonical_candidate_digest: string;
  derivation: CandidateDerivation;
};

const sha256Pattern = /^[0-9a-f]{64}$/;
const gitShaPattern = /^[0-9a-f]{40}$/;
const unresolvedPlaceholderPattern =
  /\$\{[^}]+\}|<[^>\n]+>|\b(?:TBD|TODO|FIXME|UNKNOWN|PLACEHOLDER|REPLACE_ME)\b/i;
const nondeterministicKeyPattern =
  /^(?:generated_at|created_at|updated_at|frozen_at|deployment_time|timestamp|now|random|nonce)$/;
const mutableCandidatePathPattern =
  /^ops\/v2\.1-execution\/(?:control|runtime|results|proofs|merge)(?:\/|$)/;

const ARCHIVE_INPUTS = {
  web_artifact: [
    'apps/web',
    'packages',
    'scripts',
    'package.json',
    'package-lock.json',
    'tsconfig.typecheck.json',
  ],
  worker_artifact: [
    'apps/worker',
    'packages',
    'scripts',
    'package.json',
    'package-lock.json',
    'tsconfig.typecheck.json',
  ],
  frontend_assets: [
    'apps/web/src/client',
    'apps/web/public',
    'packages/brand-system',
    'scripts/build-public-pages.ts',
  ],
} as const;

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function gitBytes(repositoryRoot: string, args: readonly string[]): Buffer {
  try {
    return execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git source derivation failed (${args.join(' ')}): ${message}`);
  }
}

function trackedPathsAtSource(repositoryRoot: string, sourceSha: string): string[] {
  gitBytes(repositoryRoot, ['cat-file', '-e', `${sourceSha}^{commit}`]);
  const paths = gitBytes(repositoryRoot, ['ls-tree', '-r', '--name-only', '-z', sourceSha])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
  if (paths.length === 0) throw new Error('repository source tree must not be empty');
  paths.forEach((entry, index) => assertRepositoryPath(entry, `source_tree[${index}]`));
  return paths;
}

function gitBlobInput(
  repositoryRoot: string,
  sourceSha: string,
  repositoryPath: string,
): CandidateInputFile {
  return hashCandidateInput(
    repositoryPath,
    gitBytes(repositoryRoot, ['cat-file', 'blob', `${sourceSha}:${repositoryPath}`]),
  );
}

function inventoryFromPaths(
  repositoryRoot: string,
  sourceSha: string,
  paths: readonly string[],
): CandidateInputSet {
  if (paths.length === 0) throw new Error('derived candidate input set must not be empty');
  const expectedPaths = [...paths].sort();
  return {
    expected_paths: expectedPaths,
    files: expectedPaths.map((repositoryPath) =>
      gitBlobInput(repositoryRoot, sourceSha, repositoryPath),
    ),
  };
}

function archiveInput(
  repositoryRoot: string,
  sourceSha: string,
  archivePath: string,
  pathspecs: readonly string[],
): CandidateInputSet {
  const archive = gitBytes(repositoryRoot, [
    'archive',
    '--format=tar.gz',
    sourceSha,
    '--',
    ...pathspecs,
  ]);
  if (archive.length === 0) throw new Error(`${archivePath} archive must not be empty`);
  return {
    expected_paths: [archivePath],
    files: [hashCandidateInput(archivePath, archive)],
  };
}

const derivedInputSetCache = new Map<string, Record<CandidateInputSetName, CandidateInputSet>>();

function cloneInputSets(
  sets: Record<CandidateInputSetName, CandidateInputSet>,
): Record<CandidateInputSetName, CandidateInputSet> {
  return Object.fromEntries(
    CANDIDATE_INPUT_SET_NAMES.map((setName) => [
      setName,
      {
        expected_paths: [...sets[setName].expected_paths],
        files: sets[setName].files.map((file) => ({ ...file })),
      },
    ]),
  ) as Record<CandidateInputSetName, CandidateInputSet>;
}

export function deriveCandidateInputSets(
  repositoryRoot: string,
  repositorySourceSha: string,
): Record<CandidateInputSetName, CandidateInputSet> {
  if (!path.isAbsolute(repositoryRoot)) {
    throw new Error('repository_root must be an absolute path');
  }
  if (!gitShaPattern.test(repositorySourceSha)) {
    throw new Error('repository_source_sha must be an exact lowercase 40-character Git SHA');
  }
  const cacheKey = `${path.resolve(repositoryRoot)}\0${repositorySourceSha}`;
  const cached = derivedInputSetCache.get(cacheKey);
  if (cached) return cloneInputSets(cached);
  const tracked = trackedPathsAtSource(repositoryRoot, repositorySourceSha);
  const productTree = tracked.filter((entry) => !mutableCandidatePathPattern.test(entry));
  const configurationBundle = productTree.filter((entry) =>
    /(?:^|\/)(?:Dockerfile|railway[^/]*|\.env[^/]*|[^/]*config[^/]*)$/iu.test(entry),
  );
  const migrations = productTree.filter((entry) => entry.startsWith('packages/db/migrations/'));
  const providerRegistry = productTree.filter(
    (entry) =>
      entry.startsWith('integrations/highlevel/registry/') ||
      /(?:^|\/)(?:provider|providers)(?:[-_./]|$)/iu.test(entry),
  );

  const derived: Record<CandidateInputSetName, CandidateInputSet> = {
    application_content: archiveInput(
      repositoryRoot,
      repositorySourceSha,
      'git/application-content.git-archive.tar.gz',
      ['apps', 'packages', 'scripts', 'integrations', 'ops/day-one'],
    ),
    product_tree: archiveInput(
      repositoryRoot,
      repositorySourceSha,
      'git/product-tree.git-archive.tar.gz',
      [
        '.',
        ':(exclude)ops/v2.1-execution/control',
        ':(exclude)ops/v2.1-execution/runtime',
        ':(exclude)ops/v2.1-execution/results',
        ':(exclude)ops/v2.1-execution/proofs',
        ':(exclude)ops/v2.1-execution/merge',
      ],
    ),
    web_artifact: archiveInput(
      repositoryRoot,
      repositorySourceSha,
      'artifacts/web-build-context.tar.gz',
      ARCHIVE_INPUTS.web_artifact,
    ),
    worker_artifact: archiveInput(
      repositoryRoot,
      repositorySourceSha,
      'artifacts/worker-build-context.tar.gz',
      ARCHIVE_INPUTS.worker_artifact,
    ),
    configuration_bundle: inventoryFromPaths(
      repositoryRoot,
      repositorySourceSha,
      configurationBundle,
    ),
    migration_inventory: inventoryFromPaths(repositoryRoot, repositorySourceSha, migrations),
    frontend_assets: archiveInput(
      repositoryRoot,
      repositorySourceSha,
      'artifacts/frontend-build-context.tar.gz',
      ARCHIVE_INPUTS.frontend_assets,
    ),
    route_action_inventory: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'ops/day-one/visible-action-registry.json',
    ]),
    workflow_registry: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'integrations/highlevel/registry/workflow-registry.yaml',
    ]),
    highlevel_registry: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'integrations/highlevel/registry/current.json',
    ]),
    provider_registry: inventoryFromPaths(repositoryRoot, repositorySourceSha, providerRegistry),
    message_catalog: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md',
    ]),
    acceptance_contract: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml',
    ]),
    environment_profile_schema: inventoryFromPaths(repositoryRoot, repositorySourceSha, [
      'ops/release/ot75/environment-schema.json',
    ]),
  };
  for (const setName of CANDIDATE_INPUT_SET_NAMES) assertInputSet(setName, derived[setName]);
  derivedInputSetCache.set(cacheKey, cloneInputSets(derived));
  return cloneInputSets(derived);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  location: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    const missing = wanted.filter((key) => !actual.includes(key));
    const extra = actual.filter((key) => !wanted.includes(key));
    throw new Error(
      `${location} has an inexact input set (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
    );
  }
}

function assertNoFloatsPlaceholdersOrNondeterminism(value: unknown, location = 'request'): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${location} contains a floating-point or non-finite value`);
    }
    return;
  }
  if (typeof value === 'string') {
    if (unresolvedPlaceholderPattern.test(value)) {
      throw new Error(`${location} contains an unresolved placeholder`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoFloatsPlaceholdersOrNondeterminism(entry, `${location}[${index}]`),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (nondeterministicKeyPattern.test(key)) {
        throw new Error(`${location} contains nondeterministic field ${key}`);
      }
      assertNoFloatsPlaceholdersOrNondeterminism(entry, `${location}.${key}`);
    }
  }
}

function assertRepositoryPath(path: unknown, location: string): asserts path is string {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').includes('..') ||
    path === '.git' ||
    path.startsWith('.git/')
  ) {
    throw new Error(`${location} must be a normalized repository-relative path`);
  }
}

function assertSortedPaths(paths: unknown, location: string): asserts paths is string[] {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error(`${location} must contain at least one path`);
  }
  let priorPath: string | undefined;
  for (const [index, path] of paths.entries()) {
    assertRepositoryPath(path, `${location}[${index}]`);
    if (priorPath !== undefined && path <= priorPath) {
      throw new Error(`${location} must be strictly sorted with no duplicates`);
    }
    priorPath = path;
  }
}

function assertInputSet(
  setName: CandidateInputSetName,
  value: unknown,
): asserts value is CandidateInputSet {
  if (!isRecord(value)) {
    throw new Error(`input_sets.${setName} must be an object`);
  }
  assertExactKeys(value, ['expected_paths', 'files'], `input_sets.${setName}`);
  const expectedPaths = value.expected_paths;
  assertSortedPaths(expectedPaths, `input_sets.${setName}.expected_paths`);
  const files = value.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`input_sets.${setName}.files must contain at least one input`);
  }

  let priorPath: string | undefined;
  for (const [index, entry] of files.entries()) {
    if (!isRecord(entry)) {
      throw new Error(`input_sets.${setName}[${index}] must be an object`);
    }
    assertExactKeys(entry, ['path', 'sha256'], `input_sets.${setName}[${index}]`);
    assertRepositoryPath(entry.path, `input_sets.${setName}[${index}].path`);
    if (typeof entry.sha256 !== 'string' || !sha256Pattern.test(entry.sha256)) {
      throw new Error(`input_sets.${setName}[${index}].sha256 must be lowercase SHA-256`);
    }
    if (priorPath !== undefined && entry.path <= priorPath) {
      throw new Error(`input_sets.${setName} must be strictly sorted by path with no duplicates`);
    }
    priorPath = entry.path;
  }

  const exactPaths = CANDIDATE_INPUT_SET_DEFINITIONS[setName].exact_paths;
  if (
    exactPaths &&
    (expectedPaths.length !== exactPaths.length ||
      expectedPaths.some((path, index) => path !== exactPaths[index]))
  ) {
    throw new Error(`input_sets.${setName} must contain exactly: ${exactPaths.join(', ')}`);
  }

  const actualPaths = files.map(({ path }) => path);
  const missing = expectedPaths.filter((path) => !actualPaths.includes(path));
  const extra = actualPaths.filter((path) => !expectedPaths.includes(path));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `input_sets.${setName} has inexact files (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
    );
  }

  if (setName === 'application_content') {
    for (const entry of files) {
      if (mutableCandidatePathPattern.test(entry.path)) {
        throw new Error(
          `application_content cannot include mutable candidate record ${entry.path}`,
        );
      }
    }
  }
}

function assertToolVersions(
  value: unknown,
): asserts value is CandidateBuildRequest['tool_versions'] {
  if (!isRecord(value)) {
    throw new Error('tool_versions must be an object');
  }
  assertExactKeys(value, ['node', 'npm', 'git', 'postgresql'], 'tool_versions');
  for (const [tool, version] of Object.entries(value)) {
    if (typeof version !== 'string' || version.trim() !== version || version.length === 0) {
      throw new Error(`tool_versions.${tool} must be an exact non-empty version`);
    }
  }
  if (value.postgresql !== '18.4') {
    throw new Error('tool_versions.postgresql must bind the authorized PostgreSQL 18.4 helper');
  }
}

function assertCommands(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('commands must contain the exact non-empty command sequence');
  }
  const seen = new Set<string>();
  for (const [index, command] of value.entries()) {
    if (
      typeof command !== 'string' ||
      command.length === 0 ||
      command.trim() !== command ||
      seen.has(command)
    ) {
      throw new Error(`commands[${index}] must be exact, trimmed, and unique`);
    }
    seen.add(command);
  }
}

function assertNativePostgresql(value: unknown): asserts value is NativePostgresqlResult {
  if (!isRecord(value)) {
    throw new Error('native_postgresql must be an object');
  }
  assertExactKeys(
    value,
    [
      'engine_version',
      'migration_count',
      'ledger_digest',
      'pending_count',
      'issue_count',
      'probes',
    ],
    'native_postgresql',
  );
  if (value.engine_version !== '18.4') {
    throw new Error('native_postgresql.engine_version must be 18.4');
  }
  if (value.migration_count !== 88 || value.pending_count !== 0 || value.issue_count !== 0) {
    throw new Error('native_postgresql must report exactly 88 migrations, pending 0, issues 0');
  }
  if (typeof value.ledger_digest !== 'string' || !sha256Pattern.test(value.ledger_digest)) {
    throw new Error('native_postgresql.ledger_digest must be lowercase SHA-256');
  }
  if (!Array.isArray(value.probes)) {
    throw new Error('native_postgresql.probes must be an array');
  }
  const probeIds: string[] = [];
  for (const [index, probe] of value.probes.entries()) {
    if (!isRecord(probe)) {
      throw new Error(`native_postgresql.probes[${index}] must be an object`);
    }
    assertExactKeys(probe, ['id', 'passed'], `native_postgresql.probes[${index}]`);
    if (typeof probe.id !== 'string' || probe.passed !== true) {
      throw new Error(`native_postgresql.probes[${index}] must be a passed named probe`);
    }
    probeIds.push(probe.id);
  }
  if (
    probeIds.length !== NATIVE_POSTGRESQL_PROBE_IDS.length ||
    probeIds.some((id, index) => id !== NATIVE_POSTGRESQL_PROBE_IDS[index])
  ) {
    throw new Error(
      `native_postgresql.probes must be exactly: ${NATIVE_POSTGRESQL_PROBE_IDS.join(', ')}`,
    );
  }
}

function assertCandidateBuildRequest(request: unknown): asserts request is CandidateBuildRequest {
  assertNoFloatsPlaceholdersOrNondeterminism(request);
  if (!isRecord(request)) {
    throw new Error('candidate request must be an object');
  }
  assertExactKeys(
    request,
    ['schema_version', 'repository_source_sha', 'tool_versions', 'commands', 'native_postgresql'],
    'request',
  );
  if (request.schema_version !== 1) {
    throw new Error('schema_version must be 1');
  }
  if (
    typeof request.repository_source_sha !== 'string' ||
    !gitShaPattern.test(request.repository_source_sha)
  ) {
    throw new Error('repository_source_sha must be an exact lowercase 40-character Git SHA');
  }
  assertToolVersions(request.tool_versions);
  assertCommands(request.commands);
  assertNativePostgresql(request.native_postgresql);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('canonical JSON rejects floating-point and non-finite values');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  throw new Error('canonical JSON accepts only JSON data');
}

export function inputInventoryBytes(files: readonly CandidateInputFile[]): Buffer {
  return Buffer.from(files.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join(''));
}

export function digestInputSet(files: readonly CandidateInputFile[], mode: DigestMode): string {
  if (mode === 'single_file_sha256') {
    if (files.length !== 1) {
      throw new Error('single_file_sha256 requires exactly one input');
    }
    const file = files[0];
    if (!file) {
      throw new Error('single_file_sha256 input is missing');
    }
    return file.sha256;
  }
  return sha256(inputInventoryBytes(files));
}

export function hashCandidateInput(path: string, content: string | Uint8Array): CandidateInputFile {
  assertRepositoryPath(path, 'path');
  return { path, sha256: sha256(content) };
}

export function buildCandidate(
  request: unknown,
  options: CandidateSourceOptions = {},
): CandidateBuildResult {
  assertCandidateBuildRequest(request);
  const repositoryRoot = path.resolve(options.repository_root ?? process.cwd());
  const inputSets = deriveCandidateInputSets(repositoryRoot, request.repository_source_sha);

  const derivedInputSets = {} as CandidateDerivation['input_sets'];
  const derivedCoreFields: Partial<CandidateCore> = {};
  for (const setName of CANDIDATE_INPUT_SET_NAMES) {
    const definition = CANDIDATE_INPUT_SET_DEFINITIONS[setName];
    const inputSet = inputSets[setName];
    const files = inputSet.files.map((file) => ({ ...file }));
    const digest = digestInputSet(files, definition.digest_mode);
    derivedCoreFields[definition.candidate_core_field] = digest;
    derivedInputSets[setName] = {
      digest_mode: definition.digest_mode,
      candidate_core_field: definition.candidate_core_field,
      expected_paths: [...inputSet.expected_paths],
      files,
      digest,
    };
  }

  const candidateCore = {
    repository_source_sha: request.repository_source_sha,
    application_content_sha256: derivedCoreFields.application_content_sha256,
    product_tree_digest: derivedCoreFields.product_tree_digest,
    web_artifact_digest: derivedCoreFields.web_artifact_digest,
    worker_artifact_digest: derivedCoreFields.worker_artifact_digest,
    configuration_bundle_digest: derivedCoreFields.configuration_bundle_digest,
    migration_inventory_digest: derivedCoreFields.migration_inventory_digest,
    frontend_asset_digest: derivedCoreFields.frontend_asset_digest,
    route_action_inventory_digest: derivedCoreFields.route_action_inventory_digest,
    workflow_registry_digest: derivedCoreFields.workflow_registry_digest,
    highlevel_registry_digest: derivedCoreFields.highlevel_registry_digest,
    provider_registry_digest: derivedCoreFields.provider_registry_digest,
    message_catalog_digest: derivedCoreFields.message_catalog_digest,
    acceptance_contract_digest: derivedCoreFields.acceptance_contract_digest,
    environment_profile_schema_digest: derivedCoreFields.environment_profile_schema_digest,
  };

  assertExactKeys(candidateCore, CANDIDATE_CORE_KEYS, 'candidate_core');
  for (const [field, digest] of Object.entries(candidateCore)) {
    const pattern = field === 'repository_source_sha' ? gitShaPattern : sha256Pattern;
    if (typeof digest !== 'string' || !pattern.test(digest)) {
      throw new Error(`candidate_core.${field} was not derived`);
    }
  }

  const candidateCoreResult = candidateCore as CandidateCore;
  const canonicalCandidateDigest = sha256(
    Buffer.concat([
      Buffer.from(CANDIDATE_DOMAIN_PREFIX, 'utf8'),
      Buffer.from(canonicalJson(candidateCoreResult), 'utf8'),
    ]),
  );

  const derivation: CandidateDerivation = {
    schema_version: 1,
    execution_id: 'OT-V21-PRODUCTION',
    candidate_core: candidateCoreResult,
    canonicalization: {
      algorithm: 'sha256',
      domain_prefix_utf8: 'ONE-TIME-V2.1-CANDIDATE\\0',
      serialization:
        "candidate_core as UTF-8 JSON; recursively sorted keys; separators ',' and ':'; ensure_ascii=false; no floats",
    },
    canonical_candidate_digest: canonicalCandidateDigest,
    input_sets: derivedInputSets,
    tool_versions: { ...request.tool_versions },
    commands: [...request.commands],
    native_postgresql: {
      ...request.native_postgresql,
      probes: request.native_postgresql.probes.map((probe) => ({ ...probe })),
    },
  };

  return {
    candidate_core: candidateCoreResult,
    canonical_candidate_digest: canonicalCandidateDigest,
    derivation,
  };
}

function assertFrozenAt(frozenAt: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(frozenAt) ||
    !Number.isFinite(Date.parse(frozenAt))
  ) {
    throw new Error('frozen_at must be an exact UTC ISO-8601 timestamp');
  }
}

export function buildCandidateDocuments(
  request: unknown,
  frozenAt: string,
  options: CandidateSourceOptions = {},
): CandidateBuildResult & {
  candidate_directory: string;
  derivation_path: string;
  manifest_path: string;
  derivation_json: string;
  candidate_yaml: string;
} {
  assertFrozenAt(frozenAt);
  const result = buildCandidate(request, options);
  const digest = result.canonical_candidate_digest;
  const candidateDirectory = `ops/v2.1-execution/merge/candidates/${digest}`;
  const manifest = {
    schema_version: 1,
    execution_id: 'OT-V21-PRODUCTION',
    candidate_core: result.candidate_core,
    canonicalization: {
      algorithm: 'sha256',
      domain_prefix: CANDIDATE_DOMAIN_PREFIX,
      serialization:
        "candidate_core as UTF-8 JSON; recursively sorted keys; separators ',' and ':'; ensure_ascii=false; no floats",
      excludes: [
        'canonical_candidate_digest',
        'manifest path and manifest commit',
        'timestamps',
        'deployment instances and deployment time',
        'per-environment provider assets/readbacks',
        'evidence and result heads',
      ],
    },
    canonical_candidate_digest: digest,
    candidate_manifest_commit_sha: 'derive_from_git_and_record_in_control_current_candidate',
    frozen_at: frozenAt,
    evidence_branch: `codex/v21-evidence-${digest.slice(0, 12)}`,
    immutable: true,
  };

  const require = createRequire(import.meta.url);
  const yaml = require('js-yaml') as {
    dump(value: unknown, options: Record<string, unknown>): string;
  };
  const candidateYaml = yaml.dump(manifest, {
    noRefs: true,
    lineWidth: -1,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  return {
    ...result,
    candidate_directory: candidateDirectory,
    derivation_path: `${candidateDirectory}/CANDIDATE-DERIVATION.json`,
    manifest_path: `${candidateDirectory}/CANDIDATE.yaml`,
    derivation_json: `${JSON.stringify(result.derivation, null, 2)}\n`,
    candidate_yaml: candidateYaml.endsWith('\n') ? candidateYaml : `${candidateYaml}\n`,
  };
}
