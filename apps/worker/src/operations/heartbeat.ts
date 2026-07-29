import {
  assertCandidateIdentity,
  assertRuntimeIdentity,
  OperationsIdentityError,
  type CandidateIdentity,
  type RuntimeIdentity,
} from '../../../../packages/observability/v21/index.ts';

export interface OperationsHeartbeat {
  schema_version: '1.0.0';
  worker_type: string;
  heartbeat_at: string;
  state: 'ready' | 'degraded';
  readiness_codes: readonly string[];
  candidate_id: string;
  release: string;
  repository_sha: string;
  application_source_sha: string;
  artifact_digest: string;
  configuration_digest: string;
  migration_inventory_digest: string;
  provider_registry_digest: string;
  runtime_tier: RuntimeIdentity['runtime_tier'];
  verification_environment_id: RuntimeIdentity['verification_environment_id'];
}

export interface OperationsHeartbeatPublisher {
  publish: (heartbeat: OperationsHeartbeat) => Promise<void>;
}

export async function publishOperationsHeartbeat(input: {
  candidate: CandidateIdentity;
  runtime: RuntimeIdentity;
  worker_type: string;
  state: OperationsHeartbeat['state'];
  readiness_codes?: readonly string[];
  publisher: OperationsHeartbeatPublisher;
  now?: () => Date;
}): Promise<OperationsHeartbeat> {
  assertCandidateIdentity(input.candidate);
  assertRuntimeIdentity(input.runtime);
  if (input.runtime.service_role !== 'worker') {
    throw new OperationsIdentityError(
      'heartbeat_role_invalid',
      'Only a worker runtime can publish a worker heartbeat.',
    );
  }
  assertWorkerCandidateAgreement(input.runtime, input.candidate);
  const heartbeat: OperationsHeartbeat = {
    schema_version: '1.0.0',
    worker_type: safeWorkerType(input.worker_type),
    heartbeat_at: (input.now?.() ?? new Date()).toISOString(),
    state: input.state,
    readiness_codes: (input.readiness_codes ?? []).map(safeReadinessCode),
    candidate_id: input.candidate.candidate_id,
    release: input.runtime.release,
    repository_sha: input.runtime.repository_sha,
    application_source_sha: input.runtime.application_source_sha,
    artifact_digest: input.runtime.artifact_digest,
    configuration_digest: input.runtime.configuration_digest,
    migration_inventory_digest: input.runtime.migration_inventory_digest,
    provider_registry_digest: input.runtime.provider_registry_digest,
    runtime_tier: input.runtime.runtime_tier,
    verification_environment_id: input.runtime.verification_environment_id,
  };
  await input.publisher.publish(heartbeat);
  return heartbeat;
}

function assertWorkerCandidateAgreement(
  runtime: RuntimeIdentity,
  candidate: CandidateIdentity,
): void {
  const agrees =
    runtime.repository_sha === candidate.repository_sha &&
    runtime.application_source_sha === candidate.application_source_sha &&
    runtime.release === candidate.release &&
    runtime.artifact_digest === candidate.worker_artifact_digest &&
    runtime.configuration_digest === candidate.configuration_digest &&
    runtime.migration_inventory_digest === candidate.migration_inventory_digest &&
    runtime.provider_registry_digest === candidate.provider_registry_digest &&
    runtime.runtime_tier === candidate.runtime_tier &&
    runtime.verification_environment_id === candidate.verification_environment_id;
  if (!agrees) {
    throw new OperationsIdentityError(
      'worker_candidate_mismatch',
      'Worker runtime does not match the exact candidate.',
    );
  }
}

function safeWorkerType(value: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) {
    throw new OperationsIdentityError('worker_type_invalid', 'Worker type is invalid.');
  }
  return value;
}

function safeReadinessCode(value: string): string {
  if (!/^[a-z0-9][a-z0-9_.:-]{0,119}$/.test(value)) {
    throw new OperationsIdentityError(
      'readiness_code_invalid',
      'Worker readiness code is invalid.',
    );
  }
  return value;
}
