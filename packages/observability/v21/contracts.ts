export const OPERATIONS_CONTRACT_VERSION = '3.0.0' as const;

export const RUNTIME_TIERS = ['isolated_staging', 'production'] as const;
export type RuntimeTier = (typeof RUNTIME_TIERS)[number];

export const VERIFICATION_ENVIRONMENTS = [
  'ci',
  'provider_sandbox',
  'persistent_staging',
  'production_read_only',
  'production_operator_canary',
  'production_broad',
] as const;
export type VerificationEnvironmentId = (typeof VERIFICATION_ENVIRONMENTS)[number];

export const ENVIRONMENT_RUNTIME_TIERS: Readonly<Record<VerificationEnvironmentId, RuntimeTier>> = {
  ci: 'isolated_staging',
  provider_sandbox: 'isolated_staging',
  persistent_staging: 'isolated_staging',
  production_read_only: 'production',
  production_operator_canary: 'production',
  production_broad: 'production',
};

export const OPERATIONS_SERVICE_ROLES = [
  'web',
  'worker',
  'migration',
  'scheduled',
  'webhook',
] as const;
export type OperationsServiceRole = (typeof OPERATIONS_SERVICE_ROLES)[number];

export const OPERATIONS_PROVIDER_KEYS = [
  'resend',
  'ghl',
  'stripe',
  'zoom',
  'vimeo',
  'drive',
  'telegram',
] as const;
export type OperationsProviderKey = (typeof OPERATIONS_PROVIDER_KEYS)[number];

export const QUEUE_CLASSES = [
  'security_delivery',
  'classroom_access',
  'billing_access',
  'parent_reminder',
  'adult_crm_projection',
  'content_processing',
  'approved_marketing',
] as const;
export type QueueClass = (typeof QUEUE_CLASSES)[number];

export interface RuntimeExpectation {
  runtime_id: string;
  service_role: OperationsServiceRole;
  artifact_digest: string;
}

export interface QueueExpectation {
  queue: string;
  queue_class: QueueClass;
}

export interface WorkerExpectation {
  worker_type: string;
}

export interface ProviderExpectation {
  provider: OperationsProviderKey;
  required: boolean;
}

export interface OperationsInventoryContract {
  runtime_expectations: readonly RuntimeExpectation[];
  required_queues: readonly QueueExpectation[];
  required_workers: readonly WorkerExpectation[];
  providers: readonly ProviderExpectation[];
  maximum_observation_age_ms: number;
  migration_inventory_required: boolean;
}

export interface RuntimeIdentity {
  schema_version: typeof OPERATIONS_CONTRACT_VERSION;
  runtime_id: string;
  service_role: OperationsServiceRole;
  release: string;
  build_timestamp: string;
  migration_schema_version: string;
  repository_sha: string;
  application_source_sha: string;
  artifact_digest: string;
  configuration_digest: string;
  migration_inventory_digest: string;
  provider_registry_digest: string;
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
}

export interface CandidateIdentity {
  schema_version: typeof OPERATIONS_CONTRACT_VERSION;
  candidate_id: string;
  repository_sha: string;
  application_source_sha: string;
  release: string;
  build_timestamp: string;
  migration_schema_version: string;
  configuration_digest: string;
  migration_inventory_digest: string;
  provider_registry_digest: string;
  public_asset_digest: string;
  specification_digest: string;
  acceptance_contract_digest: string;
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
  operations_inventory: OperationsInventoryContract;
}

export type OperationsSeverity = 'ok' | 'warning' | 'sev2' | 'sev1';

export interface OperationsIssue {
  code: string;
  category:
    'runtime_identity' | 'migration' | 'database' | 'queue' | 'worker' | 'provider' | 'leakage';
  severity: Exclude<OperationsSeverity, 'ok'>;
  summary: string;
  safe_context: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ObservationEvidence {
  observed_at: string;
  evidence_qualified: boolean;
}

export interface MigrationLedgerEntry {
  ordinal: number;
  name: string;
  sha256: string;
}

export interface MigrationHealthObservation extends ObservationEvidence {
  expected: readonly MigrationLedgerEntry[];
  applied: readonly MigrationLedgerEntry[];
  read_only_verification_passed: boolean;
}

export interface QueueHealthObservation extends ObservationEvidence {
  queue: string;
  queue_class: QueueClass;
  depth: number;
  oldest_ready_age_ms: number | null;
  oldest_lease_age_ms: number | null;
  active_lease_count: number;
  unfenced_active_lease_count: number;
  fencing_token_high_watermark: number;
  retry_count: number;
  retry_scheduled_count: number;
  retry_exhausted_count: number;
  acceptance_unknown_count: number;
  dead_letter_count: number;
  expired_lease_count: number;
  throughput_15m: number;
  last_progress_at: string | null;
  content_progress_age_ms: number | null;
  duplicate_effect_risk: boolean;
}

export interface WorkerHealthObservation extends ObservationEvidence {
  worker_type: string;
  heartbeat_age_ms: number;
  source_agrees_with_candidate: boolean;
  configuration_agrees_with_candidate: boolean;
}

export interface ProviderHealthObservation extends ObservationEvidence {
  provider: OperationsProviderKey;
  required: boolean;
  state: 'ready' | 'degraded' | 'unavailable' | 'not_configured';
  unavailable_age_ms: number | null;
  credential_expires_in_ms: number | null;
  safe_account_ref: string | null;
}

export interface DatabaseHealthObservation extends ObservationEvidence {
  available: boolean;
  consecutive_failed_minute_probes: number;
  latency_ms: number | null;
  storage_percent: number | null;
  connection_utilization_percent: number | null;
  high_connection_utilization_age_ms: number | null;
  blocking_lock_age_ms: number | null;
}

export interface OperationsHealthInput {
  generated_at: string;
  candidate: CandidateIdentity;
  runtimes: readonly RuntimeIdentity[];
  database: DatabaseHealthObservation;
  migrations: MigrationHealthObservation;
  queues: readonly QueueHealthObservation[];
  workers: readonly WorkerHealthObservation[];
  providers: readonly ProviderHealthObservation[];
  leakage_issues?: readonly OperationsIssue[];
}

export interface OperationsHealthSnapshot {
  schema_version: typeof OPERATIONS_CONTRACT_VERSION;
  generated_at: string;
  status: OperationsSeverity;
  candidate_id: string;
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
  runtime_agreement: boolean;
  migration_drift: boolean;
  evidence_ready: boolean;
  database: DatabaseHealthObservation;
  queues: readonly QueueHealthObservation[];
  workers: readonly WorkerHealthObservation[];
  providers: readonly ProviderHealthObservation[];
  issues: readonly OperationsIssue[];
}

export interface OperationsAlert {
  schema_version: typeof OPERATIONS_CONTRACT_VERSION;
  alert_key: string;
  severity: Exclude<OperationsSeverity, 'ok'>;
  category: OperationsIssue['category'];
  generated_at: string;
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
  summary: string;
  routes: readonly ['ot_secure_operations', 'admin_operations'];
  safe_context: OperationsIssue['safe_context'];
}
