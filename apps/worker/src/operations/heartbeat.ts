import {
  assertRuntimeMatchesCandidate,
  buildOperationsHealthSnapshot,
  isSafeOperationsIdentifier,
  OperationsIdentityError,
  type OperationsHealthInput,
  type OperationsHealthSnapshot,
  type RuntimeIdentity,
} from '../../../../packages/observability/v21/index.ts';

export interface OperationsHeartbeat {
  schema_version: '3.0.0';
  worker_type: string;
  heartbeat_at: string;
  health_observed_at: string;
  state: 'ready' | 'degraded';
  readiness_codes: readonly string[];
  candidate_id: string;
  release: string;
  build_timestamp: string;
  migration_schema_version: string;
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
  health_input: OperationsHealthInput;
  runtime_id: string;
  worker_type: string;
  publisher: OperationsHeartbeatPublisher;
  now?: () => Date;
}): Promise<OperationsHeartbeat> {
  const publicationTime = input.now?.() ?? new Date();
  const snapshot = buildOperationsHealthSnapshot(input.health_input);
  assertSnapshotCurrent(
    snapshot,
    publicationTime,
    input.health_input.candidate.operations_inventory.maximum_observation_age_ms,
  );
  const runtime = exactWorkerRuntime(input.health_input, input.runtime_id);
  assertRuntimeMatchesCandidate(runtime, input.health_input.candidate);
  if (runtime.service_role !== 'worker') {
    throw new OperationsIdentityError(
      'heartbeat_role_invalid',
      'Only a worker runtime can publish a worker heartbeat.',
    );
  }
  if (
    !isSafeOperationsIdentifier(input.worker_type) ||
    !input.health_input.candidate.operations_inventory.required_workers.some(
      (entry) => entry.worker_type === input.worker_type,
    ) ||
    !snapshot.workers.some((worker) => worker.worker_type === input.worker_type)
  ) {
    throw new OperationsIdentityError(
      'heartbeat_worker_type_invalid',
      'Worker heartbeat type is not in the exact validated health inventory.',
    );
  }
  const readinessCodes = deriveReadinessCodes(snapshot);
  const heartbeat: OperationsHeartbeat = {
    schema_version: '3.0.0',
    worker_type: input.worker_type,
    heartbeat_at: publicationTime.toISOString(),
    health_observed_at: snapshot.generated_at,
    state: snapshot.status === 'ok' && snapshot.evidence_ready ? 'ready' : 'degraded',
    readiness_codes: readinessCodes,
    candidate_id: input.health_input.candidate.candidate_id,
    release: runtime.release,
    build_timestamp: runtime.build_timestamp,
    migration_schema_version: runtime.migration_schema_version,
    repository_sha: runtime.repository_sha,
    application_source_sha: runtime.application_source_sha,
    artifact_digest: runtime.artifact_digest,
    configuration_digest: runtime.configuration_digest,
    migration_inventory_digest: runtime.migration_inventory_digest,
    provider_registry_digest: runtime.provider_registry_digest,
    runtime_tier: runtime.runtime_tier,
    verification_environment_id: runtime.verification_environment_id,
  };
  await input.publisher.publish(heartbeat);
  return heartbeat;
}

function assertSnapshotCurrent(
  snapshot: OperationsHealthSnapshot,
  publicationTime: Date,
  maximumAgeMs: number,
): void {
  const publicationMs = publicationTime.getTime();
  const snapshotMs = Date.parse(snapshot.generated_at);
  const age = publicationMs - snapshotMs;
  if (
    !Number.isFinite(publicationMs) ||
    !Number.isFinite(snapshotMs) ||
    age < 0 ||
    age > maximumAgeMs
  ) {
    throw new OperationsIdentityError(
      'heartbeat_health_snapshot_stale',
      'Worker heartbeat requires a current health snapshot at publication time.',
    );
  }
}

function exactWorkerRuntime(
  healthInput: OperationsHealthInput,
  runtimeId: string,
): RuntimeIdentity {
  if (!isSafeOperationsIdentifier(runtimeId)) {
    throw new OperationsIdentityError('heartbeat_runtime_id_invalid', 'Runtime ID is invalid.');
  }
  const matches = healthInput.runtimes.filter((runtime) => runtime.runtime_id === runtimeId);
  if (matches.length !== 1) {
    throw new OperationsIdentityError(
      'heartbeat_runtime_cardinality_invalid',
      'Heartbeat runtime must occur exactly once.',
    );
  }
  return matches[0]!;
}

function deriveReadinessCodes(snapshot: OperationsHealthSnapshot): readonly string[] {
  if (snapshot.status === 'ok' && snapshot.evidence_ready) return ['operations.ready'];
  return [...new Set(snapshot.issues.map((issue) => issue.code))].sort();
}
