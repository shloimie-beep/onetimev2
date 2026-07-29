import {
  OPERATIONS_PROVIDER_KEYS,
  computeMigrationInventoryDigest,
  type CandidateIdentity,
  type MigrationLedgerEntry,
  type OperationsHealthInput,
  type QueueExpectation,
  type RuntimeIdentity,
} from './index.ts';

const GIT_SHA = 'a'.repeat(40);
const SOURCE_SHA = 'b'.repeat(40);
const DIGEST = 'c'.repeat(64);
const WEB_DIGEST = 'd'.repeat(64);
const WORKER_DIGEST = 'e'.repeat(64);
const OBSERVED_AT = '2026-07-29T01:00:00.000Z';

export const MIGRATIONS: readonly MigrationLedgerEntry[] = [
  { ordinal: 1, name: '001_init.sql', sha256: DIGEST },
];

export const REQUIRED_QUEUES: readonly QueueExpectation[] = [
  { queue: 'security_delivery', queue_class: 'security_delivery' },
  { queue: 'classroom_access', queue_class: 'classroom_access' },
  { queue: 'billing_access', queue_class: 'billing_access' },
  { queue: 'parent_reminder', queue_class: 'parent_reminder' },
  { queue: 'adult_crm_projection', queue_class: 'adult_crm_projection' },
  { queue: 'content_processing', queue_class: 'content_processing' },
  { queue: 'approved_marketing', queue_class: 'approved_marketing' },
];

export function candidateIdentity(): CandidateIdentity {
  return {
    schema_version: '2.0.0',
    candidate_id: 'candidate-2026-07-29',
    repository_sha: GIT_SHA,
    application_source_sha: SOURCE_SHA,
    release: 'v2.1.0',
    configuration_digest: DIGEST,
    migration_inventory_digest: computeMigrationInventoryDigest(MIGRATIONS),
    provider_registry_digest: DIGEST,
    public_asset_digest: DIGEST,
    specification_digest: DIGEST,
    acceptance_contract_digest: DIGEST,
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'persistent_staging',
    operations_inventory: {
      runtime_expectations: [
        { runtime_id: 'web-primary', service_role: 'web', artifact_digest: WEB_DIGEST },
        {
          runtime_id: 'worker-primary',
          service_role: 'worker',
          artifact_digest: WORKER_DIGEST,
        },
      ],
      required_queues: REQUIRED_QUEUES,
      required_workers: [{ worker_type: 'delivery' }],
      providers: OPERATIONS_PROVIDER_KEYS.map((provider) => ({
        provider,
        required: provider === 'resend' || provider === 'stripe',
      })),
      maximum_observation_age_ms: 60_000,
      migration_inventory_required: true,
    },
  };
}

export function runtimeIdentities(): RuntimeIdentity[] {
  const candidate = candidateIdentity();
  const common = {
    schema_version: '2.0.0' as const,
    release: candidate.release,
    repository_sha: candidate.repository_sha,
    application_source_sha: candidate.application_source_sha,
    configuration_digest: candidate.configuration_digest,
    migration_inventory_digest: candidate.migration_inventory_digest,
    provider_registry_digest: candidate.provider_registry_digest,
    runtime_tier: candidate.runtime_tier,
    verification_environment_id: candidate.verification_environment_id,
  };
  return [
    {
      ...common,
      runtime_id: 'web-primary',
      service_role: 'web',
      artifact_digest: WEB_DIGEST,
    },
    {
      ...common,
      runtime_id: 'worker-primary',
      service_role: 'worker',
      artifact_digest: WORKER_DIGEST,
    },
  ];
}

export function healthyInput(): OperationsHealthInput {
  const candidate = candidateIdentity();
  return {
    generated_at: OBSERVED_AT,
    candidate,
    runtimes: runtimeIdentities(),
    database: {
      observed_at: OBSERVED_AT,
      evidence_qualified: true,
      available: true,
      consecutive_failed_minute_probes: 0,
      latency_ms: 12,
      storage_percent: 25,
      connection_utilization_percent: 10,
      high_connection_utilization_age_ms: null,
      blocking_lock_age_ms: null,
    },
    migrations: {
      observed_at: OBSERVED_AT,
      evidence_qualified: true,
      expected: MIGRATIONS,
      applied: MIGRATIONS,
      read_only_verification_passed: true,
    },
    queues: candidate.operations_inventory.required_queues.map((queue) => ({
      observed_at: OBSERVED_AT,
      evidence_qualified: true,
      queue: queue.queue,
      queue_class: queue.queue_class,
      depth: 0,
      oldest_ready_age_ms: null,
      oldest_lease_age_ms: null,
      retry_count: 0,
      acceptance_unknown_count: 0,
      dead_letter_count: 0,
      expired_lease_count: 0,
      throughput_15m: 1,
      duplicate_effect_risk: false,
    })),
    workers: [
      {
        observed_at: OBSERVED_AT,
        evidence_qualified: true,
        worker_type: 'delivery',
        heartbeat_age_ms: 10_000,
        source_agrees_with_candidate: true,
        configuration_agrees_with_candidate: true,
      },
    ],
    providers: candidate.operations_inventory.providers.map((expectation) => ({
      observed_at: OBSERVED_AT,
      evidence_qualified: true,
      provider: expectation.provider,
      required: expectation.required,
      state: 'ready',
      unavailable_age_ms: null,
      credential_expires_in_ms: null,
      safe_account_ref: null,
    })),
  };
}

export { DIGEST, GIT_SHA, OBSERVED_AT };
