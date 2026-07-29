import {
  OPERATIONS_PROVIDER_KEYS,
  type CandidateIdentity,
  type OperationsHealthInput,
  type RuntimeIdentity,
} from './index.ts';

const GIT_SHA = 'a'.repeat(40);
const SOURCE_SHA = 'b'.repeat(40);
const DIGEST = 'c'.repeat(64);
const WEB_DIGEST = 'd'.repeat(64);
const WORKER_DIGEST = 'e'.repeat(64);

export function candidateIdentity(): CandidateIdentity {
  return {
    schema_version: '1.0.0',
    candidate_id: 'candidate-2026-07-29',
    repository_sha: GIT_SHA,
    application_source_sha: SOURCE_SHA,
    release: 'v2.1.0',
    web_artifact_digest: WEB_DIGEST,
    worker_artifact_digest: WORKER_DIGEST,
    configuration_digest: DIGEST,
    migration_inventory_digest: DIGEST,
    provider_registry_digest: DIGEST,
    public_asset_digest: DIGEST,
    specification_digest: DIGEST,
    acceptance_contract_digest: DIGEST,
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'persistent_staging',
  };
}

export function runtimeIdentities(): RuntimeIdentity[] {
  const common = {
    schema_version: '1.0.0' as const,
    release: 'v2.1.0',
    repository_sha: GIT_SHA,
    application_source_sha: SOURCE_SHA,
    configuration_digest: DIGEST,
    migration_inventory_digest: DIGEST,
    provider_registry_digest: DIGEST,
    runtime_tier: 'isolated_staging' as const,
    verification_environment_id: 'persistent_staging' as const,
  };
  return [
    { ...common, service_role: 'web', artifact_digest: WEB_DIGEST },
    { ...common, service_role: 'worker', artifact_digest: WORKER_DIGEST },
  ];
}

export function healthyInput(): OperationsHealthInput {
  return {
    generated_at: '2026-07-29T01:00:00.000Z',
    candidate: candidateIdentity(),
    runtimes: runtimeIdentities(),
    database: {
      available: true,
      consecutive_failed_minute_probes: 0,
      latency_ms: 12,
      storage_percent: 25,
      connection_utilization_percent: 10,
      high_connection_utilization_age_ms: null,
      blocking_lock_age_ms: null,
    },
    migrations: {
      expected: [{ ordinal: 1, name: '001_init.sql', sha256: DIGEST }],
      applied: [{ ordinal: 1, name: '001_init.sql', sha256: DIGEST }],
      read_only_verification_passed: true,
    },
    queues: [],
    workers: [
      {
        worker_type: 'delivery',
        heartbeat_age_ms: 10_000,
        source_agrees_with_candidate: true,
        configuration_agrees_with_candidate: true,
      },
    ],
    providers: OPERATIONS_PROVIDER_KEYS.map((provider) => ({
      provider,
      required: false,
      state: 'ready',
      unavailable_age_ms: null,
      credential_expires_in_ms: null,
      safe_account_ref: null,
    })),
  };
}

export { DIGEST, GIT_SHA };
