import {
  ENVIRONMENT_RUNTIME_TIERS,
  OPERATIONS_CONTRACT_VERSION,
  OPERATIONS_SERVICE_ROLES,
  RUNTIME_TIERS,
  VERIFICATION_ENVIRONMENTS,
  type CandidateIdentity,
  type OperationsIssue,
  type RuntimeIdentity,
} from './contracts.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

export class OperationsIdentityError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OperationsIdentityError';
  }
}

export function assertRuntimeIdentity(identity: RuntimeIdentity): void {
  if (identity.schema_version !== OPERATIONS_CONTRACT_VERSION) {
    throw new OperationsIdentityError('runtime_schema_unknown', 'Unknown runtime schema version.');
  }
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
  for (const [name, value] of Object.entries({
    artifact_digest: identity.artifact_digest,
    configuration_digest: identity.configuration_digest,
    migration_inventory_digest: identity.migration_inventory_digest,
    provider_registry_digest: identity.provider_registry_digest,
  })) {
    assertSha256(value, `${name}_invalid`);
  }
  if (!identity.release.trim() || identity.release.length > 120) {
    throw new OperationsIdentityError('release_invalid', 'Release identity is absent or invalid.');
  }
}

export function assertCandidateIdentity(candidate: CandidateIdentity): void {
  if (candidate.schema_version !== OPERATIONS_CONTRACT_VERSION) {
    throw new OperationsIdentityError(
      'candidate_schema_unknown',
      'Unknown candidate schema version.',
    );
  }
  if (!candidate.candidate_id.trim() || candidate.candidate_id.length > 160) {
    throw new OperationsIdentityError('candidate_id_invalid', 'Candidate ID is absent or invalid.');
  }
  assertGitSha(candidate.repository_sha, 'candidate_repository_sha_invalid');
  assertGitSha(candidate.application_source_sha, 'candidate_application_source_sha_invalid');
  if (!candidate.release.trim() || candidate.release.length > 120) {
    throw new OperationsIdentityError('candidate_release_invalid', 'Candidate release is invalid.');
  }
  for (const [name, value] of Object.entries({
    web_artifact_digest: candidate.web_artifact_digest,
    worker_artifact_digest: candidate.worker_artifact_digest,
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
}

export function evaluateRuntimeAgreement(input: {
  candidate: CandidateIdentity;
  runtimes: readonly RuntimeIdentity[];
}): { ok: boolean; issues: OperationsIssue[] } {
  const issues: OperationsIssue[] = [];
  try {
    assertCandidateIdentity(input.candidate);
  } catch (error) {
    issues.push(identityIssue(error));
    return { ok: false, issues };
  }

  const web = input.runtimes.filter((runtime) => runtime.service_role === 'web');
  const worker = input.runtimes.filter((runtime) => runtime.service_role === 'worker');
  if (web.length !== 1 || worker.length !== 1) {
    issues.push({
      code: 'web_worker_identity_cardinality',
      category: 'runtime_identity',
      severity: 'sev1',
      summary: 'Exactly one web and one worker runtime identity are required.',
      safe_context: { web_count: web.length, worker_count: worker.length },
    });
  }

  for (const runtime of input.runtimes) {
    try {
      assertRuntimeIdentity(runtime);
    } catch (error) {
      issues.push(identityIssue(error, runtime.service_role));
      continue;
    }
    const expectedArtifact =
      runtime.service_role === 'web'
        ? input.candidate.web_artifact_digest
        : runtime.service_role === 'worker'
          ? input.candidate.worker_artifact_digest
          : runtime.artifact_digest;
    const mismatches = [
      runtime.repository_sha !== input.candidate.repository_sha && 'repository_sha',
      runtime.application_source_sha !== input.candidate.application_source_sha &&
        'application_source_sha',
      runtime.release !== input.candidate.release && 'release',
      runtime.artifact_digest !== expectedArtifact && 'artifact_digest',
      runtime.configuration_digest !== input.candidate.configuration_digest &&
        'configuration_digest',
      runtime.migration_inventory_digest !== input.candidate.migration_inventory_digest &&
        'migration_inventory_digest',
      runtime.provider_registry_digest !== input.candidate.provider_registry_digest &&
        'provider_registry_digest',
      runtime.runtime_tier !== input.candidate.runtime_tier && 'runtime_tier',
      runtime.verification_environment_id !== input.candidate.verification_environment_id &&
        'verification_environment_id',
    ].filter((value): value is string => Boolean(value));
    if (mismatches.length > 0) {
      issues.push({
        code: 'runtime_candidate_mismatch',
        category: 'runtime_identity',
        severity: 'sev1',
        summary: 'Runtime identity does not match the exact candidate.',
        safe_context: {
          service_role: runtime.service_role,
          mismatch_count: mismatches.length,
          mismatch_fields: mismatches.join(','),
        },
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

function identityIssue(error: unknown, serviceRole?: string): OperationsIssue {
  return {
    code: error instanceof OperationsIdentityError ? error.code : 'runtime_identity_invalid',
    category: 'runtime_identity',
    severity: 'sev1',
    summary: 'Runtime identity is missing, unknown, or invalid.',
    safe_context: { service_role: serviceRole ?? 'candidate' },
  };
}

function assertGitSha(value: string, code: string): void {
  if (!GIT_SHA.test(value)) {
    throw new OperationsIdentityError(code, 'Expected a lowercase 40-character Git SHA.');
  }
}

function assertSha256(value: string, code: string): void {
  if (!SHA256.test(value)) {
    throw new OperationsIdentityError(code, 'Expected a lowercase SHA-256 digest.');
  }
}
