import {
  ENVIRONMENT_RUNTIME_TIERS,
  OPERATIONS_CONTRACT_VERSION,
  OPERATIONS_PROVIDER_KEYS,
  OPERATIONS_SERVICE_ROLES,
  QUEUE_CLASSES,
  RUNTIME_TIERS,
  VERIFICATION_ENVIRONMENTS,
  type CandidateIdentity,
  type OperationsIssue,
  type RuntimeExpectation,
  type RuntimeIdentity,
} from './contracts.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,159}$/;

export class OperationsIdentityError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OperationsIdentityError';
  }
}

export function isSafeOperationsIdentifier(value: string): boolean {
  return SAFE_IDENTIFIER.test(value);
}

export function assertRuntimeIdentity(identity: RuntimeIdentity): void {
  if (identity.schema_version !== OPERATIONS_CONTRACT_VERSION) {
    throw new OperationsIdentityError('runtime_schema_unknown', 'Unknown runtime schema version.');
  }
  assertSafeIdentifier(identity.runtime_id, 'runtime_id_invalid');
  if (!OPERATIONS_SERVICE_ROLES.includes(identity.service_role)) {
    throw new OperationsIdentityError('runtime_service_role_unknown', 'Unknown service role.');
  }
  if (!RUNTIME_TIERS.includes(identity.runtime_tier)) {
    throw new OperationsIdentityError('runtime_tier_unknown', 'Unknown runtime tier.');
  }
  if (!VERIFICATION_ENVIRONMENTS.includes(identity.verification_environment_id)) {
    throw new OperationsIdentityError(
      'verification_environment_unknown',
      'Unknown verification environment.',
    );
  }
  if (ENVIRONMENT_RUNTIME_TIERS[identity.verification_environment_id] !== identity.runtime_tier) {
    throw new OperationsIdentityError(
      'runtime_environment_mismatch',
      'Runtime tier and verification environment do not match.',
    );
  }
  assertGitSha(identity.repository_sha, 'repository_sha_invalid');
  assertGitSha(identity.application_source_sha, 'application_source_sha_invalid');
  assertCanonicalTimestamp(identity.build_timestamp, 'build_timestamp_invalid');
  assertSafeIdentifier(identity.migration_schema_version, 'migration_schema_version_invalid');
  for (const [name, value] of Object.entries({
    artifact_digest: identity.artifact_digest,
    configuration_digest: identity.configuration_digest,
    migration_inventory_digest: identity.migration_inventory_digest,
    provider_registry_digest: identity.provider_registry_digest,
  })) {
    assertSha256(value, `${name}_invalid`);
  }
  assertRelease(identity.release, 'release_invalid');
}

export function assertCandidateIdentity(candidate: CandidateIdentity): void {
  if (candidate.schema_version !== OPERATIONS_CONTRACT_VERSION) {
    throw new OperationsIdentityError(
      'candidate_schema_unknown',
      'Unknown candidate schema version.',
    );
  }
  assertSafeIdentifier(candidate.candidate_id, 'candidate_id_invalid');
  assertGitSha(candidate.repository_sha, 'candidate_repository_sha_invalid');
  assertGitSha(candidate.application_source_sha, 'candidate_application_source_sha_invalid');
  assertRelease(candidate.release, 'candidate_release_invalid');
  assertCanonicalTimestamp(candidate.build_timestamp, 'candidate_build_timestamp_invalid');
  assertSafeIdentifier(
    candidate.migration_schema_version,
    'candidate_migration_schema_version_invalid',
  );
  for (const [name, value] of Object.entries({
    configuration_digest: candidate.configuration_digest,
    migration_inventory_digest: candidate.migration_inventory_digest,
    provider_registry_digest: candidate.provider_registry_digest,
    public_asset_digest: candidate.public_asset_digest,
    specification_digest: candidate.specification_digest,
    acceptance_contract_digest: candidate.acceptance_contract_digest,
  })) {
    assertSha256(value, `${name}_invalid`);
  }
  if (
    !RUNTIME_TIERS.includes(candidate.runtime_tier) ||
    !VERIFICATION_ENVIRONMENTS.includes(candidate.verification_environment_id) ||
    ENVIRONMENT_RUNTIME_TIERS[candidate.verification_environment_id] !== candidate.runtime_tier
  ) {
    throw new OperationsIdentityError(
      'candidate_runtime_environment_mismatch',
      'Candidate runtime tier and verification environment do not match.',
    );
  }
  assertOperationsInventory(candidate);
}

export function evaluateRuntimeAgreement(input: {
  candidate: CandidateIdentity;
  runtimes: readonly RuntimeIdentity[];
}): { ok: boolean; issues: OperationsIssue[] } {
  try {
    assertCandidateIdentity(input.candidate);
  } catch (error) {
    return { ok: false, issues: [identityIssue(error, 'candidate')] };
  }

  const issues: OperationsIssue[] = [];
  const expectations = new Map(
    input.candidate.operations_inventory.runtime_expectations.map((entry) => [
      entry.runtime_id,
      entry,
    ]),
  );
  const observed = new Set<string>();

  for (const runtime of input.runtimes) {
    try {
      assertRuntimeIdentity(runtime);
    } catch (error) {
      issues.push(identityIssue(error, safeIdentifierOrFallback(runtime.runtime_id)));
      continue;
    }
    if (observed.has(runtime.runtime_id)) {
      issues.push(runtimeIssue('runtime_identity_duplicate', runtime.runtime_id));
      continue;
    }
    observed.add(runtime.runtime_id);
    const expected = expectations.get(runtime.runtime_id);
    if (!expected) {
      issues.push(runtimeIssue('runtime_identity_extra', runtime.runtime_id));
      continue;
    }
    const mismatchCount = runtimeMismatchCount(runtime, expected, input.candidate);
    if (mismatchCount > 0) {
      issues.push({
        code: 'runtime_candidate_mismatch',
        category: 'runtime_identity',
        severity: 'sev1',
        summary: 'Runtime identity does not match the exact candidate expectation.',
        safe_context: { runtime_id: runtime.runtime_id, mismatch_count: mismatchCount },
      });
    }
  }
  for (const expected of expectations.values()) {
    if (!observed.has(expected.runtime_id)) {
      issues.push(runtimeIssue('runtime_identity_missing', expected.runtime_id));
    }
  }
  return { ok: issues.length === 0, issues };
}

export function assertRuntimeMatchesCandidate(
  runtime: RuntimeIdentity,
  candidate: CandidateIdentity,
): void {
  assertCandidateIdentity(candidate);
  assertRuntimeIdentity(runtime);
  const expected = candidate.operations_inventory.runtime_expectations.find(
    (entry) => entry.runtime_id === runtime.runtime_id,
  );
  if (!expected || runtimeMismatchCount(runtime, expected, candidate) > 0) {
    throw new OperationsIdentityError(
      'runtime_candidate_mismatch',
      'Runtime does not match the exact candidate expectation.',
    );
  }
}

function assertOperationsInventory(candidate: CandidateIdentity): void {
  const inventory = candidate.operations_inventory;
  if (!inventory || typeof inventory !== 'object') {
    throw new OperationsIdentityError(
      'operations_inventory_missing',
      'Operations inventory is required.',
    );
  }
  assertPositiveInteger(inventory.maximum_observation_age_ms, 'maximum_observation_age_invalid');
  if (inventory.maximum_observation_age_ms > 15 * 60_000) {
    throw new OperationsIdentityError(
      'maximum_observation_age_invalid',
      'Maximum observation age exceeds the allowed bound.',
    );
  }
  if (typeof inventory.migration_inventory_required !== 'boolean') {
    throw new OperationsIdentityError(
      'migration_inventory_policy_invalid',
      'Migration inventory policy is invalid.',
    );
  }

  assertNonemptyUnique(
    inventory.runtime_expectations,
    (entry) => entry.runtime_id,
    'runtime_expectations',
  );
  let webCount = 0;
  let workerCount = 0;
  for (const entry of inventory.runtime_expectations) {
    assertSafeIdentifier(entry.runtime_id, 'runtime_expectation_id_invalid');
    if (!OPERATIONS_SERVICE_ROLES.includes(entry.service_role)) {
      throw new OperationsIdentityError(
        'runtime_expectation_role_invalid',
        'Runtime expectation role is invalid.',
      );
    }
    if (entry.service_role === 'web') webCount += 1;
    if (entry.service_role === 'worker') workerCount += 1;
    assertSha256(entry.artifact_digest, 'runtime_expectation_artifact_invalid');
  }
  if (webCount < 1 || workerCount < 1) {
    throw new OperationsIdentityError(
      'runtime_expectation_required_roles_missing',
      'At least one web and one worker runtime expectation are required.',
    );
  }

  assertNonemptyUnique(inventory.required_queues, (entry) => entry.queue, 'required_queues');
  for (const entry of inventory.required_queues) {
    assertSafeIdentifier(entry.queue, 'queue_expectation_id_invalid');
    if (!QUEUE_CLASSES.includes(entry.queue_class)) {
      throw new OperationsIdentityError(
        'queue_expectation_class_invalid',
        'Queue expectation class is invalid.',
      );
    }
  }

  assertNonemptyUnique(
    inventory.required_workers,
    (entry) => entry.worker_type,
    'required_workers',
  );
  for (const entry of inventory.required_workers) {
    assertSafeIdentifier(entry.worker_type, 'worker_expectation_id_invalid');
  }

  assertNonemptyUnique(inventory.providers, (entry) => entry.provider, 'providers');
  const configuredProviders = [...inventory.providers.map((entry) => entry.provider)].sort();
  const exactProviders = [...OPERATIONS_PROVIDER_KEYS].sort();
  if (configuredProviders.join(',') !== exactProviders.join(',')) {
    throw new OperationsIdentityError(
      'provider_inventory_incomplete',
      'Provider inventory must enumerate the exact supported providers.',
    );
  }
  for (const entry of inventory.providers) {
    if (!OPERATIONS_PROVIDER_KEYS.includes(entry.provider) || typeof entry.required !== 'boolean') {
      throw new OperationsIdentityError(
        'provider_expectation_invalid',
        'Provider expectation is invalid.',
      );
    }
  }
}

function runtimeMismatchCount(
  runtime: RuntimeIdentity,
  expected: RuntimeExpectation,
  candidate: CandidateIdentity,
): number {
  return [
    runtime.service_role !== expected.service_role,
    runtime.artifact_digest !== expected.artifact_digest,
    runtime.repository_sha !== candidate.repository_sha,
    runtime.application_source_sha !== candidate.application_source_sha,
    runtime.release !== candidate.release,
    runtime.build_timestamp !== candidate.build_timestamp,
    runtime.migration_schema_version !== candidate.migration_schema_version,
    runtime.configuration_digest !== candidate.configuration_digest,
    runtime.migration_inventory_digest !== candidate.migration_inventory_digest,
    runtime.provider_registry_digest !== candidate.provider_registry_digest,
    runtime.runtime_tier !== candidate.runtime_tier,
    runtime.verification_environment_id !== candidate.verification_environment_id,
  ].filter(Boolean).length;
}

function identityIssue(error: unknown, runtimeId: string): OperationsIssue {
  return {
    code: error instanceof OperationsIdentityError ? error.code : 'runtime_identity_invalid',
    category: 'runtime_identity',
    severity: 'sev1',
    summary: 'Runtime or candidate identity is missing, unknown, or invalid.',
    safe_context: { runtime_id: runtimeId },
  };
}

function runtimeIssue(code: string, runtimeId: string): OperationsIssue {
  return {
    code,
    category: 'runtime_identity',
    severity: 'sev1',
    summary: 'Runtime inventory does not match the exact candidate.',
    safe_context: { runtime_id: runtimeId },
  };
}

function assertNonemptyUnique<T>(
  entries: readonly T[],
  key: (entry: T) => string,
  name: string,
): void {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new OperationsIdentityError(`${name}_empty`, `${name} must be nonempty.`);
  }
  if (new Set(entries.map(key)).size !== entries.length) {
    throw new OperationsIdentityError(`${name}_duplicate`, `${name} contains duplicates.`);
  }
}

function assertSafeIdentifier(value: string, code: string): void {
  if (typeof value !== 'string' || !isSafeOperationsIdentifier(value)) {
    throw new OperationsIdentityError(code, 'Expected a safe operations identifier.');
  }
}

function safeIdentifierOrFallback(value: unknown): string {
  return typeof value === 'string' && isSafeOperationsIdentifier(value) ? value : 'invalid';
}

function assertPositiveInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OperationsIdentityError(code, 'Expected a positive integer.');
  }
}

function assertRelease(value: string, code: string): void {
  if (typeof value !== 'string' || !isSafeOperationsIdentifier(value) || value.length > 120) {
    throw new OperationsIdentityError(code, 'Release identity is absent or invalid.');
  }
}

function assertCanonicalTimestamp(value: string, code: string): void {
  const parsed = Date.parse(value);
  if (
    typeof value !== 'string' ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new OperationsIdentityError(code, 'Expected a canonical UTC timestamp.');
  }
}

function assertGitSha(value: string, code: string): void {
  if (typeof value !== 'string' || !GIT_SHA.test(value)) {
    throw new OperationsIdentityError(code, 'Expected a lowercase 40-character Git SHA.');
  }
}

function assertSha256(value: string, code: string): void {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new OperationsIdentityError(code, 'Expected a lowercase SHA-256 digest.');
  }
}
