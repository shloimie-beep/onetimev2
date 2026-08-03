import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const LAUNCH_MANIFEST_SCHEMA = 'onetime.w12_100.railway_launch_manifest.v1';
export const LAUNCH_EVIDENCE_SCHEMA = 'onetime.w12_100.railway_launch_evidence.v1';
export const STAGING_MUTATION_CONFIRMATION = 'W12-100-STAGING-MUTATION-OK';
export const PRODUCTION_MUTATION_CONFIRMATION = 'W12-100-PRODUCTION-PROMOTION-OK';

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;
const BLOCKED_STAGING_HOSTS = new Set(['join.onetimeonetime.com']);
const PROVIDER_TRANSPORTS = [
  'email',
  'whatsapp',
  'telegram',
  'payments',
  'zoom',
  'buffer',
  'openai_helper',
] as const;
const SAFE_TRANSPORT_STATES = new Set(['disabled', 'off', 'sink', 'mock', 'not_configured']);

export type EnvironmentKind = 'staging' | 'production';
export type LaunchOperation =
  | 'plan'
  | 'preflight-staging'
  | 'deploy-staging'
  | 'migrate-staging'
  | 'verify-staging'
  | 'rollback-staging'
  | 'roll-forward-staging'
  | 'preflight-production'
  | 'promote-production'
  | 'migrate-production'
  | 'verify-production';
export type CheckStatus = 'passed' | 'warning' | 'blocked' | 'failed';
export type CheckResult = {
  id: string;
  status: CheckStatus;
  summary: string;
  detail?: string;
};
export type RailwayIdentity = {
  project_id: string;
  environment_id: string;
  web_service_id: string;
  worker_service_id: string;
  database_service_id: string;
  project_name?: string;
  environment_name?: string;
  web_service_name?: string;
  worker_service_name?: string;
  database_service_name?: string;
};
export type LaunchManifest = {
  schema_version: typeof LAUNCH_MANIFEST_SCHEMA;
  lane_id: string;
  repository: string;
  target: {
    environment_kind: EnvironmentKind;
    base_url: string;
    railway: RailwayIdentity;
  };
  candidate: {
    commit_sha: string;
    expected_image_digest: string;
    branch?: string;
  };
  predeploy?: {
    expected_version?: string;
    expected_commit_sha?: string;
  };
  rollback?: {
    predeploy_commit_sha?: string;
    predeploy_image_digest?: string;
  };
  provider_transports: Record<(typeof PROVIDER_TRANSPORTS)[number], string>;
  limits?: {
    worker_heartbeat_max_age_ms?: number;
    queue_ready_max_count?: number;
    queue_oldest_ready_max_age_ms?: number;
    backup_max_age_minutes?: number;
  };
};
export type CommandPlan = {
  id: string;
  mutates: boolean;
  args: string[];
  redacted_command: string;
};
export type DeploymentRecord = {
  service_id: string;
  deployment_id: string;
  image_digest?: string;
  source_sha?: string;
};
export type LaunchEvidence = {
  schema_version: typeof LAUNCH_EVIDENCE_SCHEMA;
  generated_at: string;
  lane_id: string;
  repository: string;
  operation: LaunchOperation;
  mode: 'dry_run' | 'execute';
  status: 'passed' | 'blocked' | 'failed';
  target: {
    environment_kind: EnvironmentKind;
    base_url_hash: string;
    railway: RailwayIdentity;
  };
  candidate: {
    commit_sha: string;
    expected_image_digest: string;
  };
  checks: CheckResult[];
  command_plan: CommandPlan[];
  deployment_records: DeploymentRecord[];
  external_actions: number;
  production_mutations: number;
  redaction: {
    env_values_recorded: false;
    secrets_recorded: false;
    raw_database_urls_recorded: false;
  };
};
export type FetchResponse = { status: number; json: () => Promise<unknown> };
export type Fetcher = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>;

type CliOptions = {
  operation: LaunchOperation;
  manifestPath: string;
  execute: boolean;
  skipHttp: boolean;
  opsProbeTokenEnv: string;
  outputPath?: string;
  railwayStatusPath?: string;
  migrationStatusPath?: string;
  backupMetadataPath?: string;
  deploymentListPath?: string;
  stagingConfirmation?: string;
  productionConfirmation?: string;
};

export function parseLaunchManifest(value: unknown): LaunchManifest {
  const root = requiredRecord(value, 'manifest');
  const target = requiredRecord(root.target, 'manifest.target');
  const railway = requiredRecord(target.railway, 'manifest.target.railway');
  const candidate = requiredRecord(root.candidate, 'manifest.candidate');
  const transports = requiredRecord(root.provider_transports, 'manifest.provider_transports');
  const environmentKind = requiredString(target, 'environment_kind');
  if (environmentKind !== 'staging' && environmentKind !== 'production') {
    throw new Error('manifest.target.environment_kind must be staging or production');
  }

  const identity: RailwayIdentity = {
    project_id: requiredString(railway, 'project_id'),
    environment_id: requiredString(railway, 'environment_id'),
    web_service_id: requiredString(railway, 'web_service_id'),
    worker_service_id: requiredString(railway, 'worker_service_id'),
    database_service_id: requiredString(railway, 'database_service_id'),
  };
  for (const key of [
    'project_name',
    'environment_name',
    'web_service_name',
    'worker_service_name',
    'database_service_name',
  ] as const) {
    const value = optionalString(railway, key);
    if (value) identity[key] = value;
  }

  const providerTransports = PROVIDER_TRANSPORTS.reduce(
    (accumulator, transport) => ({
      ...accumulator,
      [transport]: requiredString(transports, transport),
    }),
    {} as Record<(typeof PROVIDER_TRANSPORTS)[number], string>,
  );

  const manifest: LaunchManifest = {
    schema_version: requiredString(root, 'schema_version') as typeof LAUNCH_MANIFEST_SCHEMA,
    lane_id: requiredString(root, 'lane_id'),
    repository: requiredString(root, 'repository'),
    target: {
      environment_kind: environmentKind,
      base_url: requiredString(target, 'base_url'),
      railway: identity,
    },
    candidate: {
      commit_sha: requiredString(candidate, 'commit_sha'),
      expected_image_digest: requiredString(candidate, 'expected_image_digest'),
    },
    provider_transports: providerTransports,
  };

  assignOptionalString(manifest.candidate, candidate, 'branch');
  const predeploy = optionalRecord(root.predeploy);
  if (predeploy) {
    const expectedVersion = optionalString(predeploy, 'expected_version');
    const expectedCommitSha = optionalString(predeploy, 'expected_commit_sha');
    manifest.predeploy = {};
    if (expectedVersion) manifest.predeploy.expected_version = expectedVersion;
    if (expectedCommitSha) manifest.predeploy.expected_commit_sha = expectedCommitSha;
  }
  const rollback = optionalRecord(root.rollback);
  if (rollback) {
    const predeployCommitSha = optionalString(rollback, 'predeploy_commit_sha');
    const predeployImageDigest = optionalString(rollback, 'predeploy_image_digest');
    manifest.rollback = {};
    if (predeployCommitSha) manifest.rollback.predeploy_commit_sha = predeployCommitSha;
    if (predeployImageDigest) manifest.rollback.predeploy_image_digest = predeployImageDigest;
  }
  const limits = optionalRecord(root.limits);
  if (limits) {
    manifest.limits = {};
    assignOptionalNumber(manifest.limits, limits, 'worker_heartbeat_max_age_ms');
    assignOptionalNumber(manifest.limits, limits, 'queue_ready_max_count');
    assignOptionalNumber(manifest.limits, limits, 'queue_oldest_ready_max_age_ms');
    assignOptionalNumber(manifest.limits, limits, 'backup_max_age_minutes');
  }
  return manifest;
}

export async function loadLaunchManifest(manifestPath: string) {
  return parseLaunchManifest(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown);
}

export function validateLaunchManifest(
  manifest: LaunchManifest,
  operation: LaunchOperation,
): CheckResult[] {
  return [
    equalsCheck('manifest_schema', manifest.schema_version, LAUNCH_MANIFEST_SCHEMA),
    equalsCheck('repository', manifest.repository, 'webcraft-media/onetimev2'),
    equalsCheck('lane_id', manifest.lane_id, 'W12-100-10'),
    validateCandidate(manifest),
    validateImmutableIdentity(manifest.target.railway),
    validateEnvironmentForOperation(manifest, operation),
    validateBaseUrl(manifest),
    validateProviderTransportsOff(manifest),
    validateRollbackSource(manifest, operation),
    validatePredeployVersionExpectation(manifest, operation),
  ];
}

export function isMutatingOperation(operation: LaunchOperation) {
  return [
    'deploy-staging',
    'migrate-staging',
    'rollback-staging',
    'roll-forward-staging',
    'promote-production',
    'migrate-production',
  ].includes(operation);
}

export function isProductionOperation(operation: LaunchOperation) {
  return operation.endsWith('production') || operation === 'promote-production';
}

export function buildRailwayCommandPlan(
  manifest: LaunchManifest,
  operation: LaunchOperation,
): CommandPlan[] {
  const railway = manifest.target.railway;
  const common = ['--project', railway.project_id, '--environment', railway.environment_id];
  const source =
    operation === 'rollback-staging'
      ? manifest.rollback?.predeploy_commit_sha
      : manifest.candidate.commit_sha;
  const status = command('railway-status', false, ['status', '--json', ...common]);
  const listWeb = command('deployment-list-web', false, [
    'deployment',
    'list',
    '--json',
    ...common,
    '--service',
    railway.web_service_id,
    '--limit',
    '20',
  ]);
  const listWorker = command('deployment-list-worker', false, [
    'deployment',
    'list',
    '--json',
    ...common,
    '--service',
    railway.worker_service_id,
    '--limit',
    '20',
  ]);
  const deployWeb = command('deploy-web', true, [
    'up',
    '--detach',
    '--json',
    ...common,
    '--service',
    railway.web_service_id,
    '--message',
    `W12-100 ${operation} web ${source ?? 'missing-source'}`,
  ]);
  const deployWorker = command('deploy-worker', true, [
    'up',
    '--detach',
    '--json',
    ...common,
    '--service',
    railway.worker_service_id,
    '--message',
    `W12-100 ${operation} worker ${source ?? 'missing-source'}`,
  ]);
  const migrate = command('run-migrations', true, [
    'run',
    ...common,
    '--service',
    railway.web_service_id,
    '--no-local',
    '--',
    'npm',
    'run',
    'db:migrate',
  ]);

  if (operation === 'plan') return [status, listWeb, listWorker];
  if (operation.startsWith('preflight')) return [status, listWeb, listWorker];
  if (operation === 'deploy-staging' || operation === 'promote-production') {
    return [status, deployWeb, deployWorker, listWeb, listWorker];
  }
  if (operation === 'migrate-staging' || operation === 'migrate-production')
    return [status, migrate];
  if (operation.startsWith('verify')) return [status, listWeb, listWorker];
  if (operation === 'rollback-staging' || operation === 'roll-forward-staging') {
    return [status, deployWeb, deployWorker, listWeb, listWorker];
  }
  return [status];
}

export function assertRailwayCommandAllowed(plan: CommandPlan) {
  const [first, second] = plan.args;
  if (!first || !new Set(['status', 'deployment', 'up', 'run']).has(first)) {
    throw new Error(`Railway command ${first ?? 'unknown'} is not allowed by W12-100`);
  }
  if (first === 'deployment' && second !== 'list') {
    throw new Error('Only railway deployment list is allowed by W12-100');
  }
  const forbidden = new Set([
    'delete',
    'remove',
    'rm',
    'down',
    'connect',
    'variable',
    'variables',
    'var',
    'volume',
    'config',
    'apply',
    'source',
    'disconnect',
    'files',
    'upload',
    'domain',
  ]);
  for (const arg of plan.args) {
    if (forbidden.has(arg.toLowerCase())) {
      throw new Error(`Railway argument ${arg} is forbidden by W12-100`);
    }
  }
}

export function evaluateRailwayStatus(
  manifest: LaunchManifest,
  statusJson: unknown,
): CheckResult[] {
  const strings = collectStrings(statusJson);
  const requiredIds = [
    manifest.target.railway.project_id,
    manifest.target.railway.environment_id,
    manifest.target.railway.web_service_id,
    manifest.target.railway.worker_service_id,
    manifest.target.railway.database_service_id,
  ];
  const missing = requiredIds.filter((id) => !strings.has(id));
  const duplicateNames = [
    manifest.target.railway.web_service_name,
    manifest.target.railway.worker_service_name,
    manifest.target.railway.database_service_name,
  ]
    .filter((name): name is string => Boolean(name))
    .filter((name) => countExactString(statusJson, name) > 1);
  const rawEnvValues = containsRawEnvValueShape(statusJson);
  return [
    {
      id: 'railway_status_exact_ids_present',
      status: missing.length === 0 ? 'passed' : 'blocked',
      summary:
        missing.length === 0
          ? 'Railway status contains every immutable project/environment/service/database ID.'
          : 'Railway status is missing required immutable IDs.',
      ...(missing.length ? { detail: `missing=${missing.join(',')}` } : {}),
    },
    {
      id: 'railway_status_unambiguous_names',
      status: duplicateNames.length === 0 ? 'passed' : 'blocked',
      summary:
        duplicateNames.length === 0
          ? 'No duplicate optional service names were detected.'
          : 'Railway status contains ambiguous service names.',
      ...(duplicateNames.length ? { detail: `duplicate_names=${duplicateNames.join(',')}` } : {}),
    },
    {
      id: 'railway_status_raw_env_values_absent',
      status: rawEnvValues ? 'blocked' : 'passed',
      summary: rawEnvValues
        ? 'Railway evidence appears to contain raw environment variable values.'
        : 'Railway status evidence did not include variable-list output.',
    },
  ];
}

export function evaluateMigrationStatus(value: unknown): CheckResult[] {
  const record = requiredRecord(value, 'migration status');
  const pending = numberValue(record.pending_migrations);
  const status = stringValue(record.status);
  const mutation = booleanValue(record.database_mutation_performed);
  const rawRows = booleanValue(record.raw_source_rows_included);
  return [
    {
      id: 'pending_migration_count',
      status: pending === 0 ? 'passed' : 'blocked',
      summary: pending === 0 ? 'Pending migration count is zero.' : 'Pending migrations remain.',
      detail: `pending_migrations=${Number.isFinite(pending) ? pending : 'missing'}`,
    },
    {
      id: 'migration_status_passed',
      status: status === 'passed' || status === 'ok' ? 'passed' : 'blocked',
      summary:
        status === 'passed' || status === 'ok'
          ? 'Migration status evidence passed.'
          : 'Migration status evidence is not passed.',
    },
    {
      id: 'migration_evidence_redacted',
      status: mutation === false && rawRows === false ? 'passed' : 'blocked',
      summary:
        mutation === false && rawRows === false
          ? 'Migration count evidence is redacted and read-only.'
          : 'Migration evidence reports mutation or raw source rows.',
    },
  ];
}

export function evaluateMigrationStatusForOperation(
  operation: LaunchOperation,
  value: unknown,
): CheckResult[] {
  const checks = evaluateMigrationStatus(value);
  if (operation !== 'migrate-staging' && operation !== 'migrate-production') return checks;
  const record = requiredRecord(value, 'migration status');
  const pending = numberValue(record.pending_migrations);
  const safeEvidence =
    checks.find((check) => check.id === 'migration_evidence_redacted')?.status === 'passed';
  if (!Number.isFinite(pending) || pending <= 0 || !safeEvidence) return checks;
  return checks.map((check) => {
    if (check.id !== 'pending_migration_count' && check.id !== 'migration_status_passed') {
      return check;
    }
    return {
      ...check,
      status: 'warning',
      summary:
        check.id === 'pending_migration_count'
          ? 'Pending migrations are present for the controlled migration operation.'
          : 'Migration status is pending; post-migration verification must reach passed.',
    };
  });
}

export function evaluateBackupMetadata(manifest: LaunchManifest, value: unknown): CheckResult[] {
  const record = requiredRecord(value, 'backup metadata');
  const status = stringValue(record.status);
  const age = numberValue(record.latest_backup_age_minutes);
  const maxAge = manifest.limits?.backup_max_age_minutes ?? 1440;
  const pitr = booleanValue(record.pitr_enabled);
  const secretLike = containsSecretLikeString(value);
  return [
    {
      id: 'backup_freshness',
      status: status === 'ok' && age <= maxAge ? 'passed' : 'blocked',
      summary:
        status === 'ok' && age <= maxAge
          ? 'Backup freshness metadata is within limit.'
          : 'Backup freshness metadata is stale or unavailable.',
      detail: `latest_backup_age_minutes=${Number.isFinite(age) ? age : 'missing'}; limit=${maxAge}`,
    },
    {
      id: 'backup_pitr_metadata',
      status: pitr ? 'passed' : 'warning',
      summary: pitr ? 'PITR metadata reports enabled.' : 'PITR metadata is not positively enabled.',
    },
    {
      id: 'backup_metadata_redacted',
      status: secretLike ? 'blocked' : 'passed',
      summary: secretLike
        ? 'Backup metadata contains secret-like material.'
        : 'Backup metadata is redacted.',
    },
  ];
}

export function extractDeploymentRecords(value: unknown): DeploymentRecord[] {
  const records: DeploymentRecord[] = [];
  visitObjects(value, (record) => {
    const deploymentId =
      optionalString(record, 'deployment_id') ??
      optionalString(record, 'deploymentId') ??
      optionalString(record, 'id');
    const serviceId =
      optionalString(record, 'service_id') ??
      optionalString(record, 'serviceId') ??
      optionalString(record, 'service');
    if (!deploymentId || !serviceId) return;
    const deployment: DeploymentRecord = { service_id: serviceId, deployment_id: deploymentId };
    const digest =
      optionalString(record, 'image_digest') ??
      optionalString(record, 'imageDigest') ??
      optionalString(record, 'digest');
    const sourceSha =
      optionalString(record, 'source_sha') ??
      optionalString(record, 'sourceSha') ??
      optionalString(record, 'commit_sha') ??
      optionalString(record, 'commitSha');
    if (digest) deployment.image_digest = digest;
    if (sourceSha) deployment.source_sha = sourceSha;
    records.push(deployment);
  });
  return records;
}

export function evaluateDeploymentRecords(
  manifest: LaunchManifest,
  operation: LaunchOperation,
  records: DeploymentRecord[],
): CheckResult[] {
  const expectedSource =
    operation === 'rollback-staging'
      ? manifest.rollback?.predeploy_commit_sha
      : manifest.candidate.commit_sha;
  const serviceIds = [
    manifest.target.railway.web_service_id,
    manifest.target.railway.worker_service_id,
  ];
  const missing = serviceIds.filter(
    (serviceId) => !records.some((record) => record.service_id === serviceId),
  );
  const digestMismatches = records.filter(
    (record) =>
      serviceIds.includes(record.service_id) &&
      record.image_digest &&
      record.image_digest !== manifest.candidate.expected_image_digest,
  );
  const sourceMismatches = records.filter(
    (record) =>
      serviceIds.includes(record.service_id) &&
      expectedSource &&
      record.source_sha &&
      record.source_sha !== expectedSource,
  );
  return [
    {
      id: 'deployment_records_present',
      status: missing.length === 0 ? 'passed' : 'blocked',
      summary:
        missing.length === 0
          ? 'Deployment IDs are present for web and worker services.'
          : 'Deployment IDs are missing for one or more services.',
      ...(missing.length ? { detail: `missing_services=${missing.join(',')}` } : {}),
    },
    {
      id: 'deployment_digest_match',
      status: digestMismatches.length === 0 ? 'passed' : 'blocked',
      summary:
        digestMismatches.length === 0
          ? 'Deployment digests match the expected digest when reported.'
          : 'One or more deployment digests do not match.',
    },
    {
      id: 'deployment_source_match',
      status: sourceMismatches.length === 0 ? 'passed' : 'blocked',
      summary:
        sourceMismatches.length === 0
          ? 'Deployment source SHAs match when reported.'
          : 'One or more deployment source SHAs do not match.',
    },
  ];
}

export async function verifyHttpEndpoints(input: {
  manifest: LaunchManifest;
  operation: LaunchOperation;
  fetcher?: Fetcher;
  opsProbeToken?: string;
}): Promise<CheckResult[]> {
  const fetcher: Fetcher = input.fetcher ?? ((url, init) => fetch(url, init));
  const checks: CheckResult[] = [];
  const version = await fetchJson(fetcher, input.manifest.target.base_url, '/version');
  checks.push(httpStatusCheck('version_http', version.status));
  checks.push(jsonOkCheck('version_ok', version.body));

  const health = await fetchJson(fetcher, input.manifest.target.base_url, '/health');
  checks.push(httpStatusCheck('health_http', health.status));
  checks.push(jsonOkCheck('health_ok', health.body));
  const ready = await fetchJson(fetcher, input.manifest.target.base_url, '/ready');
  checks.push(httpStatusCheck('ready_http', ready.status));
  checks.push(jsonOkCheck('ready_ok', ready.body));

  if (!input.opsProbeToken) {
    checks.push(
      blocked(
        'runtime_identity_probe_token',
        'Runtime identity verification requires an ops probe token.',
      ),
      blocked(
        'worker_heartbeat_probe_token',
        'Worker heartbeat verification requires an ops probe token.',
      ),
    );
    return checks;
  }
  const diagnostics = await fetchJson(
    fetcher,
    input.manifest.target.base_url,
    '/api/internal/ops/diagnostics',
    { 'x-ops-probe-token': input.opsProbeToken },
  );
  checks.push(httpStatusCheck('ops_diagnostics_http', diagnostics.status));
  if (isRecord(diagnostics.body) && isRecord(diagnostics.body.runtime)) {
    const runtime = diagnostics.body.runtime;
    const actualCommit = stringValue(runtime.commit_sha);
    const actualVersion = stringValue(runtime.version);
    const expectedCommit = expectedVersionCommit(input.manifest, input.operation);
    checks.push(...evaluateVersionDeploymentProof(input.manifest, input.operation, runtime));
    checks.push({
      id: 'version_commit_match',
      status: expectedCommit && actualCommit === expectedCommit ? 'passed' : 'blocked',
      summary:
        expectedCommit && actualCommit === expectedCommit
          ? 'Protected runtime commit matches the required source.'
          : 'Protected runtime commit does not match the required source.',
      detail: `actual=${actualCommit || 'unknown'}; expected=${expectedCommit ?? 'missing'}`,
    });
    if (
      endpointPhase(input.operation) === 'predeploy' &&
      input.manifest.predeploy?.expected_version
    ) {
      checks.push({
        id: 'version_name_match',
        status: actualVersion === input.manifest.predeploy.expected_version ? 'passed' : 'blocked',
        summary:
          actualVersion === input.manifest.predeploy.expected_version
            ? 'Protected runtime release name matches.'
            : 'Protected runtime release name does not match.',
      });
    }
  } else {
    checks.push(
      blocked('runtime_identity_json', 'Protected diagnostics did not return a runtime identity.'),
    );
  }
  checks.push(...providerReadyChecks(diagnostics.body));
  checks.push(...workerHeartbeatChecks(input.manifest, diagnostics.body));
  checks.push(...queueChecks(input.manifest, diagnostics.body));
  return checks;
}

export function evaluateVersionDeploymentProof(
  manifest: LaunchManifest,
  operation: LaunchOperation,
  versionBody: unknown,
): CheckResult[] {
  const root = optionalRecord(versionBody);
  const deployment = optionalRecord(root?.deployment);
  if (!deployment) {
    return [
      warning(
        'version_deployment_proof_present',
        'Protected diagnostics do not expose runtime deployment proof; falling back to commit check.',
      ),
    ];
  }

  const provider = stringValue(deployment.provider);
  const deploymentId = stringValue(deployment.deployment_id);
  const snapshotId = stringValue(deployment.snapshot_id);
  const projectId = stringValue(deployment.project_id);
  const environmentId = stringValue(deployment.environment_id);
  const serviceId = stringValue(deployment.service_id);
  const gitCommitSha = stringValue(deployment.git_commit_sha);
  const expectedCommit = expectedVersionCommit(manifest, operation);

  const checks: CheckResult[] = [
    {
      id: 'version_deployment_provider',
      status: provider === 'railway' ? 'passed' : 'blocked',
      summary:
        provider === 'railway'
          ? 'Version deployment proof identifies Railway as the runtime provider.'
          : 'Version deployment proof does not identify Railway as the runtime provider.',
      detail: `actual=${provider || 'missing'}; expected=railway`,
    },
    {
      id: 'version_deployment_id_present',
      status: deploymentId ? 'passed' : 'blocked',
      summary: deploymentId
        ? 'Version deployment proof includes the serving deployment ID.'
        : 'Version deployment proof is missing the serving deployment ID.',
    },
    {
      id: 'version_snapshot_id_present',
      status: snapshotId ? 'passed' : 'blocked',
      summary: snapshotId
        ? 'Version deployment proof includes the serving snapshot ID.'
        : 'Version deployment proof is missing the serving snapshot ID.',
    },
    {
      id: 'version_project_id_match',
      status: projectId === manifest.target.railway.project_id ? 'passed' : 'blocked',
      summary:
        projectId === manifest.target.railway.project_id
          ? 'Version deployment proof project ID matches the manifest.'
          : 'Version deployment proof project ID does not match the manifest.',
      detail: `actual=${projectId || 'missing'}; expected=${manifest.target.railway.project_id}`,
    },
    {
      id: 'version_environment_id_match',
      status: environmentId === manifest.target.railway.environment_id ? 'passed' : 'blocked',
      summary:
        environmentId === manifest.target.railway.environment_id
          ? 'Version deployment proof environment ID matches the manifest.'
          : 'Version deployment proof environment ID does not match the manifest.',
      detail: `actual=${environmentId || 'missing'}; expected=${
        manifest.target.railway.environment_id
      }`,
    },
    {
      id: 'version_web_service_id_match',
      status: serviceId === manifest.target.railway.web_service_id ? 'passed' : 'blocked',
      summary:
        serviceId === manifest.target.railway.web_service_id
          ? 'Version deployment proof web service ID matches the manifest.'
          : 'Version deployment proof web service ID does not match the manifest.',
      detail: `actual=${serviceId || 'missing'}; expected=${manifest.target.railway.web_service_id}`,
    },
  ];

  if (!gitCommitSha) {
    checks.push(
      warning(
        'version_git_commit_sha_present',
        'Railway git commit SHA is absent; CLI/source rebuild proof must bind deployment ID to Railway deployment metadata.',
      ),
    );
  } else {
    checks.push({
      id: 'version_git_commit_sha_match',
      status: expectedCommit && gitCommitSha === expectedCommit ? 'passed' : 'blocked',
      summary:
        expectedCommit && gitCommitSha === expectedCommit
          ? 'Railway git commit SHA matches the required source.'
          : 'Railway git commit SHA does not match the required source.',
      detail: `actual=${gitCommitSha}; expected=${expectedCommit ?? 'missing'}`,
    });
  }

  return checks;
}

export function requiredGitSourceForOperation(
  manifest: LaunchManifest,
  operation: LaunchOperation,
) {
  if (operation === 'rollback-staging') return manifest.rollback?.predeploy_commit_sha;
  if (
    [
      'deploy-staging',
      'roll-forward-staging',
      'migrate-staging',
      'promote-production',
      'migrate-production',
    ].includes(operation)
  ) {
    return manifest.candidate.commit_sha;
  }
  return undefined;
}

export function validateCurrentGitHead(
  manifest: LaunchManifest,
  operation: LaunchOperation,
  currentHead: string,
): CheckResult {
  const required = requiredGitSourceForOperation(manifest, operation);
  if (!required)
    return passed('git_head_not_required', 'This operation does not require a source checkout.');
  return {
    id: 'git_head_exact_source',
    status: currentHead === required ? 'passed' : 'blocked',
    summary:
      currentHead === required
        ? 'Current git HEAD matches the operation source.'
        : 'Current git HEAD does not match the operation source.',
    detail: `actual=${currentHead}; expected=${required}`,
  };
}

export function buildLaunchEvidence(input: {
  manifest: LaunchManifest;
  operation: LaunchOperation;
  execute: boolean;
  checks: CheckResult[];
  commandPlan: CommandPlan[];
  deploymentRecords?: DeploymentRecord[];
  externalActions?: number;
  productionMutations?: number;
}): LaunchEvidence {
  const status = input.checks.some((check) => check.status === 'failed')
    ? 'failed'
    : input.checks.some((check) => check.status === 'blocked')
      ? 'blocked'
      : 'passed';
  return {
    schema_version: LAUNCH_EVIDENCE_SCHEMA,
    generated_at: new Date().toISOString(),
    lane_id: input.manifest.lane_id,
    repository: input.manifest.repository,
    operation: input.operation,
    mode: input.execute ? 'execute' : 'dry_run',
    status,
    target: {
      environment_kind: input.manifest.target.environment_kind,
      base_url_hash: sha256(input.manifest.target.base_url),
      railway: input.manifest.target.railway,
    },
    candidate: {
      commit_sha: input.manifest.candidate.commit_sha,
      expected_image_digest: input.manifest.candidate.expected_image_digest,
    },
    checks: input.checks,
    command_plan: input.commandPlan,
    deployment_records: input.deploymentRecords ?? [],
    external_actions: input.externalActions ?? 0,
    production_mutations: input.productionMutations ?? 0,
    redaction: {
      env_values_recorded: false,
      secrets_recorded: false,
      raw_database_urls_recorded: false,
    },
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const manifest = await loadLaunchManifest(options.manifestPath);
  const checks = validateLaunchManifest(manifest, options.operation);
  const commandPlan = buildRailwayCommandPlan(manifest, options.operation);
  for (const plan of commandPlan) assertRailwayCommandAllowed(plan);

  if (options.railwayStatusPath) {
    checks.push(...evaluateRailwayStatus(manifest, await readJson(options.railwayStatusPath)));
  } else if (options.operation !== 'plan') {
    checks.push(blocked('railway_status_required', 'Railway status JSON is required.'));
  }
  if (options.migrationStatusPath) {
    checks.push(
      ...evaluateMigrationStatusForOperation(
        options.operation,
        await readJson(options.migrationStatusPath),
      ),
    );
  } else if (operationNeedsMigrationEvidence(options.operation)) {
    checks.push(blocked('migration_status_required', 'Migration status JSON is required.'));
  }
  if (options.backupMetadataPath) {
    checks.push(...evaluateBackupMetadata(manifest, await readJson(options.backupMetadataPath)));
  } else if (operationNeedsBackupEvidence(options.operation)) {
    checks.push(blocked('backup_metadata_required', 'Backup freshness metadata is required.'));
  }
  const deploymentRecords = options.deploymentListPath
    ? extractDeploymentRecords(await readJson(options.deploymentListPath))
    : [];
  if (options.deploymentListPath) {
    checks.push(...evaluateDeploymentRecords(manifest, options.operation, deploymentRecords));
  } else if (operationNeedsDeploymentRecords(options.operation)) {
    checks.push(blocked('deployment_records_required', 'Deployment records JSON is required.'));
  }
  const requiredSource = requiredGitSourceForOperation(manifest, options.operation);
  if (requiredSource)
    checks.push(validateCurrentGitHead(manifest, options.operation, await currentGitHead()));
  if (!options.skipHttp && operationNeedsHttp(options.operation)) {
    const token = process.env[options.opsProbeTokenEnv];
    checks.push(
      ...(await verifyHttpEndpoints({
        manifest,
        operation: options.operation,
        ...(token ? { opsProbeToken: token } : {}),
      })),
    );
  } else if (operationNeedsHttp(options.operation)) {
    checks.push(blocked('http_verification_required', 'HTTP verification was skipped.'));
  }
  if (isMutatingOperation(options.operation)) {
    checks.push(validateMutationConfirmation(manifest, options));
    if (!options.execute)
      checks.push(blocked('execute_flag_required', 'Mutating operations require --execute.'));
  }

  let externalActions = 0;
  let productionMutations = 0;
  if (options.execute && isMutatingOperation(options.operation)) {
    if (checks.some((check) => check.status === 'blocked' || check.status === 'failed')) {
      checks.push(blocked('mutation_blocked', 'One or more launch checks blocked execution.'));
    } else {
      for (const plan of commandPlan.filter((item) => item.mutates)) {
        await execFileAsync('railway', plan.args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
        externalActions += 1;
        if (isProductionOperation(options.operation)) productionMutations += 1;
      }
    }
  }

  const evidence = buildLaunchEvidence({
    manifest,
    operation: options.operation,
    execute: options.execute,
    checks,
    commandPlan,
    deploymentRecords,
    externalActions,
    productionMutations,
  });
  const output = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, output, 'utf8');
  }
  process.stdout.write(output);
  if (evidence.status !== 'passed') process.exitCode = 1;
}

function parseCliOptions(args: string[]): CliOptions {
  const operationName = args[0];
  if (!operationName || !isLaunchOperation(operationName)) {
    throw new Error('Usage: railway-launch-toolkit.ts <operation> --manifest <path>');
  }
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith('--')) throw new Error(`Unexpected argument ${arg ?? ''}`);
    const key = arg.slice(2);
    const next = args[index + 1];
    if (
      [
        'manifest',
        'output',
        'railway-status-json',
        'migration-status-json',
        'backup-metadata-json',
        'deployment-list-json',
        'confirm-staging-mutation',
        'confirm-production-mutation',
        'ops-probe-token-env',
      ].includes(key)
    ) {
      if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
  const manifestPath = values.get('manifest');
  if (!manifestPath) throw new Error('--manifest is required');
  const options: CliOptions = {
    operation: operationName,
    manifestPath,
    execute: flags.has('execute'),
    skipHttp: flags.has('skip-http'),
    opsProbeTokenEnv: values.get('ops-probe-token-env') ?? 'OPERATIONS_PROBE_TOKEN',
  };
  const outputPath = values.get('output');
  const railwayStatusPath = values.get('railway-status-json');
  const migrationStatusPath = values.get('migration-status-json');
  const backupMetadataPath = values.get('backup-metadata-json');
  const deploymentListPath = values.get('deployment-list-json');
  const stagingConfirmation = values.get('confirm-staging-mutation');
  const productionConfirmation = values.get('confirm-production-mutation');
  if (outputPath) options.outputPath = outputPath;
  if (railwayStatusPath) options.railwayStatusPath = railwayStatusPath;
  if (migrationStatusPath) options.migrationStatusPath = migrationStatusPath;
  if (backupMetadataPath) options.backupMetadataPath = backupMetadataPath;
  if (deploymentListPath) options.deploymentListPath = deploymentListPath;
  if (stagingConfirmation) options.stagingConfirmation = stagingConfirmation;
  if (productionConfirmation) options.productionConfirmation = productionConfirmation;
  return options;
}

function validateCandidate(manifest: LaunchManifest): CheckResult {
  const commitOk = COMMIT_SHA.test(manifest.candidate.commit_sha);
  const digestOk = IMAGE_DIGEST.test(manifest.candidate.expected_image_digest);
  return {
    id: 'candidate_identity',
    status: commitOk && digestOk ? 'passed' : 'blocked',
    summary:
      commitOk && digestOk
        ? 'Candidate commit and expected image digest are immutable.'
        : 'Candidate commit or expected image digest is invalid.',
  };
}

function validateImmutableIdentity(identity: RailwayIdentity): CheckResult {
  const values = [
    identity.project_id,
    identity.environment_id,
    identity.web_service_id,
    identity.worker_service_id,
    identity.database_service_id,
  ];
  const placeholder = values.some(isPlaceholder);
  const servicesDistinct =
    new Set([identity.web_service_id, identity.worker_service_id, identity.database_service_id])
      .size === 3;
  return {
    id: 'railway_immutable_identity',
    status: !placeholder && servicesDistinct ? 'passed' : 'blocked',
    summary:
      !placeholder && servicesDistinct
        ? 'Project, environment, web, worker, and database IDs are explicit.'
        : 'Railway identity values are placeholders or ambiguous.',
  };
}

function validateEnvironmentForOperation(
  manifest: LaunchManifest,
  operation: LaunchOperation,
): CheckResult {
  if (operation === 'plan') return passed('operation_environment', 'Plan mode is non-mutating.');
  const production = isProductionOperation(operation);
  const kindMatches = production
    ? manifest.target.environment_kind === 'production'
    : manifest.target.environment_kind === 'staging';
  const ok = kindMatches && (production || !isProductionLikeTarget(manifest));
  return {
    id: 'operation_environment',
    status: ok ? 'passed' : 'blocked',
    summary: ok
      ? 'Operation and Railway environment kind match.'
      : 'Operation/environment mismatch or production-like staging target detected.',
  };
}

function validateBaseUrl(manifest: LaunchManifest): CheckResult {
  try {
    const parsed = new URL(manifest.target.base_url);
    return {
      id: 'base_url_https',
      status: parsed.protocol === 'https:' ? 'passed' : 'blocked',
      summary: parsed.protocol === 'https:' ? 'Base URL uses HTTPS.' : 'Base URL must use HTTPS.',
    };
  } catch {
    return blocked('base_url_https', 'Base URL is not valid.');
  }
}

function validateProviderTransportsOff(manifest: LaunchManifest): CheckResult {
  const unsafe = Object.entries(manifest.provider_transports)
    .filter(([, value]) => !SAFE_TRANSPORT_STATES.has(value))
    .map(([key, value]) => `${key}=${value}`);
  return {
    id: 'provider_transports_off',
    status: unsafe.length === 0 ? 'passed' : 'blocked',
    summary:
      unsafe.length === 0
        ? 'Provider transports are disabled, sink, mock, off, or not configured.'
        : 'One or more provider transports are configured for real delivery.',
    ...(unsafe.length ? { detail: unsafe.join(',') } : {}),
  };
}

function validateRollbackSource(manifest: LaunchManifest, operation: LaunchOperation): CheckResult {
  if (operation !== 'rollback-staging')
    return passed('rollback_source_not_required', 'Rollback source is not required.');
  const source = manifest.rollback?.predeploy_commit_sha;
  return {
    id: 'rollback_exact_source',
    status: source && COMMIT_SHA.test(source) ? 'passed' : 'blocked',
    summary:
      source && COMMIT_SHA.test(source)
        ? 'Rollback source is an exact predeploy commit SHA.'
        : 'Rollback requires an exact predeploy commit SHA.',
  };
}

function validatePredeployVersionExpectation(
  manifest: LaunchManifest,
  operation: LaunchOperation,
): CheckResult {
  if (operation !== 'preflight-staging' && operation !== 'deploy-staging') {
    return passed(
      'predeploy_version_requirement_not_applicable',
      'Predeploy protected runtime expectation is not applicable.',
    );
  }
  const source = manifest.predeploy?.expected_commit_sha;
  return {
    id: 'predeploy_version_expectation',
    status: source && COMMIT_SHA.test(source) ? 'passed' : 'blocked',
    summary:
      source && COMMIT_SHA.test(source)
        ? 'Predeploy protected runtime expected commit is explicit.'
        : 'Predeploy protected runtime expected commit is required before staging deployment.',
  };
}

function validateMutationConfirmation(manifest: LaunchManifest, options: CliOptions): CheckResult {
  if (manifest.target.environment_kind === 'production') {
    return {
      id: 'production_mutation_confirmation',
      status:
        options.productionConfirmation === PRODUCTION_MUTATION_CONFIRMATION ? 'passed' : 'blocked',
      summary: 'Production mutation requires exact confirmation text.',
    };
  }
  return {
    id: 'staging_mutation_confirmation',
    status: options.stagingConfirmation === STAGING_MUTATION_CONFIRMATION ? 'passed' : 'blocked',
    summary: 'Staging mutation requires exact confirmation text.',
  };
}

function providerReadyChecks(body: unknown): CheckResult[] {
  const snapshot = diagnosticSnapshot(body);
  const optionalDependencies: unknown[] =
    snapshot && Array.isArray(snapshot.optional_dependencies) ? snapshot.optional_dependencies : [];
  const present = Boolean(snapshot && Array.isArray(snapshot.optional_dependencies));
  const unsafe = optionalDependencies
    .filter(isRecord)
    .filter((dependency) =>
      ['email_transport', 'whatsapp_transport', 'support_bridge'].includes(
        stringValue(dependency.name),
      ),
    )
    .filter((dependency) => !['disabled', 'ok'].includes(stringValue(dependency.status)));
  return [
    {
      id: 'ready_provider_transports_safe',
      status: present && unsafe.length === 0 ? 'passed' : 'blocked',
      summary: !present
        ? 'Protected diagnostics omitted optional provider dependencies.'
        : unsafe.length === 0
          ? 'Protected diagnostics report safe optional provider dependencies.'
          : 'Protected diagnostics report an unsafe provider dependency.',
    },
  ];
}

function workerHeartbeatChecks(manifest: LaunchManifest, body: unknown): CheckResult[] {
  const snapshot = diagnosticSnapshot(body);
  const workers = Array.isArray(snapshot?.workers) ? snapshot.workers.filter(isRecord) : [];
  const maxAge = manifest.limits?.worker_heartbeat_max_age_ms ?? 120_000;
  const fresh = workers.filter(
    (worker) =>
      stringValue(worker.state) !== 'stale' && numberValue(worker.heartbeat_age_ms) <= maxAge,
  );
  return [
    {
      id: 'worker_heartbeat_fresh',
      status: fresh.length > 0 ? 'passed' : 'blocked',
      summary:
        fresh.length > 0
          ? 'At least one worker heartbeat is fresh.'
          : 'No fresh worker heartbeat was found.',
      detail: `fresh_workers=${fresh.length}; max_age_ms=${maxAge}`,
    },
  ];
}

function queueChecks(manifest: LaunchManifest, body: unknown): CheckResult[] {
  const snapshot = diagnosticSnapshot(body);
  const queues = Array.isArray(snapshot?.queues) ? snapshot.queues.filter(isRecord) : [];
  const maxReady = manifest.limits?.queue_ready_max_count ?? 50;
  const maxAge = manifest.limits?.queue_oldest_ready_max_age_ms ?? 600_000;
  const highReady = queues.filter((queue) => numberValue(queue.ready_count) > maxReady);
  const oldReady = queues.filter((queue) => numberValue(queue.oldest_ready_age_ms) > maxAge);
  const unhealthyDelivery = queues.filter(
    (queue) => numberValue(queue.dead_letter_count) > 0 || numberValue(queue.retry_count) > 100,
  );
  return [
    {
      id: 'queue_depth',
      status: highReady.length === 0 ? 'passed' : 'blocked',
      summary:
        highReady.length === 0 ? 'Queue depth is below limit.' : 'Queue depth exceeds limit.',
    },
    {
      id: 'queue_oldest_age',
      status: oldReady.length === 0 ? 'passed' : 'blocked',
      summary:
        oldReady.length === 0
          ? 'Oldest ready queue age is below limit.'
          : 'Oldest ready queue age exceeds limit.',
    },
    {
      id: 'delivery_retries_dead_letters',
      status: unhealthyDelivery.length === 0 ? 'passed' : 'blocked',
      summary:
        unhealthyDelivery.length === 0
          ? 'Retries and dead letters are within launch limits.'
          : 'Retries or dead letters require operator review.',
    },
  ];
}

function diagnosticSnapshot(body: unknown) {
  if (!isRecord(body)) return undefined;
  return isRecord(body.snapshot) ? body.snapshot : body;
}

async function fetchJson(
  fetcher: Fetcher,
  baseUrl: string,
  route: string,
  headers?: Record<string, string>,
) {
  const response = await fetcher(
    new URL(route, ensureSlash(baseUrl)).toString(),
    headers ? { headers } : undefined,
  );
  return { status: response.status, body: await response.json().catch(() => null) };
}

function endpointPhase(operation: LaunchOperation): 'predeploy' | 'postdeploy' {
  return operation === 'preflight-staging' || operation === 'preflight-production'
    ? 'predeploy'
    : 'postdeploy';
}

function expectedVersionCommit(manifest: LaunchManifest, operation: LaunchOperation) {
  if (endpointPhase(operation) === 'predeploy') return manifest.predeploy?.expected_commit_sha;
  if (operation === 'rollback-staging') return manifest.rollback?.predeploy_commit_sha;
  return manifest.candidate.commit_sha;
}

function httpStatusCheck(id: string, status: number): CheckResult {
  return {
    id,
    status: status >= 200 && status < 300 ? 'passed' : 'blocked',
    summary: status >= 200 && status < 300 ? `${id} returned 2xx.` : `${id} did not return 2xx.`,
    detail: `status=${status}`,
  };
}

function jsonOkCheck(id: string, body: unknown): CheckResult {
  const ok = isRecord(body) && body.ok === true;
  return {
    id,
    status: ok ? 'passed' : 'blocked',
    summary: ok ? `${id} reported ok=true.` : `${id} did not report ok=true.`,
  };
}

function command(id: string, mutates: boolean, args: string[]): CommandPlan {
  return {
    id,
    mutates,
    args,
    redacted_command: `railway ${args.map(shellToken).join(' ')}`,
  };
}

function shellToken(value: string) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

function equalsCheck(id: string, actual: string, expected: string): CheckResult {
  return {
    id,
    status: actual === expected ? 'passed' : 'blocked',
    summary: actual === expected ? `${id} matches.` : `${id} does not match.`,
    detail: `actual=${actual}; expected=${expected}`,
  };
}

function passed(id: string, summary: string): CheckResult {
  return { id, status: 'passed', summary };
}

function warning(id: string, summary: string): CheckResult {
  return { id, status: 'warning', summary };
}

function blocked(id: string, summary: string): CheckResult {
  return { id, status: 'blocked', summary };
}

function operationNeedsHttp(operation: LaunchOperation) {
  return [
    'preflight-staging',
    'verify-staging',
    'rollback-staging',
    'roll-forward-staging',
    'preflight-production',
    'verify-production',
  ].includes(operation);
}

function operationNeedsMigrationEvidence(operation: LaunchOperation) {
  return [
    'preflight-staging',
    'deploy-staging',
    'migrate-staging',
    'verify-staging',
    'preflight-production',
    'promote-production',
    'migrate-production',
    'verify-production',
  ].includes(operation);
}

function operationNeedsBackupEvidence(operation: LaunchOperation) {
  return [
    'preflight-staging',
    'deploy-staging',
    'migrate-staging',
    'verify-staging',
    'preflight-production',
    'promote-production',
    'migrate-production',
    'verify-production',
  ].includes(operation);
}

function operationNeedsDeploymentRecords(operation: LaunchOperation) {
  return [
    'verify-staging',
    'rollback-staging',
    'roll-forward-staging',
    'verify-production',
  ].includes(operation);
}

function isLaunchOperation(value: string): value is LaunchOperation {
  return [
    'plan',
    'preflight-staging',
    'deploy-staging',
    'migrate-staging',
    'verify-staging',
    'rollback-staging',
    'roll-forward-staging',
    'preflight-production',
    'promote-production',
    'migrate-production',
    'verify-production',
  ].includes(value);
}

function isProductionLikeTarget(manifest: LaunchManifest) {
  const values = [
    manifest.target.railway.environment_name,
    manifest.target.railway.environment_id,
    manifest.target.base_url,
  ].filter((value): value is string => Boolean(value));
  return values.some((value) => {
    if (/(^|[-_\s])prod(uction)?($|[-_\s])/i.test(value)) return true;
    try {
      return BLOCKED_STAGING_HOSTS.has(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  });
}

function isPlaceholder(value: string) {
  return (
    value.trim().length < 3 || /replace|todo|placeholder|example|unknown|<|>|\$\{/i.test(value)
  );
}

function containsRawEnvValueShape(value: unknown) {
  if (!isRecord(value)) return false;
  return /DATABASE_URL|RESEND_API_KEY|TOKEN|SECRET|PASSWORD/.test(JSON.stringify(value));
}

function containsSecretLikeString(value: unknown) {
  return [...collectStrings(value)].some(
    (text) =>
      /postgres(?:ql)?:\/\//i.test(text) ||
      /(?:secret|token|password|api[_-]?key)=/i.test(text) ||
      /[A-Za-z0-9_-]{48,}/.test(text),
  );
}

function collectStrings(value: unknown, output = new Set<string>()) {
  if (typeof value === 'string') output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (isRecord(value)) Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function countExactString(value: unknown, needle: string): number {
  if (typeof value === 'string') return value === needle ? 1 : 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((count, item) => count + countExactString(item, needle), 0);
  }
  if (isRecord(value)) {
    return Object.values(value).reduce<number>(
      (count, item) => count + countExactString(item, needle),
      0,
    );
  }
  return 0;
}

function visitObjects(value: unknown, visitor: (record: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => visitObjects(item, visitor));
    return;
  }
  if (!isRecord(value)) return;
  visitor(value);
  Object.values(value).forEach((item) => visitObjects(item, visitor));
}

function requiredRecord(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function optionalRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function assignOptionalString<T extends Record<string, string | undefined>>(
  target: T,
  record: Record<string, unknown>,
  key: keyof T & string,
) {
  const value = optionalString(record, key);
  if (value) target[key] = value as T[keyof T & string];
}

function assignOptionalNumber<T extends Record<string, number | undefined>>(
  target: T,
  record: Record<string, unknown>,
  key: keyof T & string,
) {
  const value = numberValue(record[key]);
  if (Number.isFinite(value) && value > 0) target[key] = value as T[keyof T & string];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
}

function ensureSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function currentGitHead() {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
