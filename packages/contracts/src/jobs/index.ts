import type {
  RuntimeTier,
  VerificationEnvironmentId,
} from '../state/index.ts';

export const JOB_CONTRACT_VERSION = '1.0.0' as const;
export const JOB_LEASE_DURATION_MS = 5 * 60 * 1000;
export const JOB_HEARTBEAT_INTERVAL_MS = 60 * 1000;
export const JOB_MAX_DISPATCH_ATTEMPTS = 8;
export const JOB_MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

export const PROVIDER_JOB_STATES = [
  'not_started',
  'leased',
  'in_flight',
  'accepted',
  'retry_wait',
  'acceptance_unknown',
  'rejected',
  'dead_letter',
  'complete',
  'canceled',
] as const;
export type ProviderJobState = (typeof PROVIDER_JOB_STATES)[number];

export const VERSIONED_SAGA_STATES = [
  'draft',
  'validating',
  'preview_ready',
  'confirmed',
  'provisioning',
  'ready_to_notify',
  'notifying',
  'partial_failure',
  'failed',
  'acceptance_unknown',
  'invalidated',
  'canceled',
  'complete',
] as const;
export type VersionedSagaState = (typeof VERSIONED_SAGA_STATES)[number];

export interface JobScope {
  product: 'one_time_mishnayos';
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
}

export interface TransactionalOutboxIntent {
  job_id: string;
  operation_type: string;
  aggregate_ref: string;
  source_version: number;
  provider: string;
  scope: JobScope;
  idempotency_key: string;
  canonical_request_hash: string;
  payload_ref: string;
  payload_digest: string;
  compensation_for_job_id: string | null;
}

export interface ProviderJobRecord extends TransactionalOutboxIntent {
  state: ProviderJobState;
  version: number;
  recovery_generation: number;
  dispatch_attempts: number;
  lifetime_dispatch_attempts: number;
  reconciliation_attempts: number;
  lease_owner: string | null;
  lease_generation: number;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  next_attempt_at: string | null;
  unknown_effect: boolean;
  provider_acceptance_digest: string | null;
  reconciliation_digest: string | null;
  safe_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobLeaseToken {
  job_id: string;
  owner: string;
  generation: number;
  expires_at: string;
  job_version: number;
}

export interface VersionedSaga {
  saga_id: string;
  aggregate_ref: string;
  source_version: number;
  state: VersionedSagaState;
  version: number;
  failed_stage: 'validating' | 'provisioning' | 'notifying' | null;
  preview_digest: string | null;
  unknown_job_ids: readonly string[];
  completed_job_ids: readonly string[];
}

export type ProviderDispatchOutcome =
  | {
      kind: 'accepted';
      provider_acceptance_digest: string;
      completed_locally: boolean;
    }
  | {
      kind: 'not_accepted_retryable';
      safe_error_code: string;
      retry_after_ms: number | null;
    }
  | {
      kind: 'permanently_rejected';
      safe_error_code: string;
    }
  | {
      kind: 'acceptance_unknown';
      safe_error_code: string;
    };

export type ProviderReconciliationOutcome =
  | {
      kind: 'effect_exists';
      provider_acceptance_digest: string;
      completed_locally: boolean;
      reconciliation_digest: string;
    }
  | {
      kind: 'effect_absent_retry_safe';
      reconciliation_digest: string;
    }
  | {
      kind: 'permanently_rejected';
      safe_error_code: string;
      reconciliation_digest: string;
    }
  | {
      kind: 'still_unknown';
      safe_error_code: string;
      reconciliation_digest: string;
    };

export interface ClaimDueJobsInput {
  owner: string;
  now: Date;
  limit: number;
  scope: JobScope;
  operation_types: readonly string[];
}

export interface RecordDispatchOutcomeInput {
  lease: JobLeaseToken;
  expected_version: number;
  now: Date;
  outcome: ProviderDispatchOutcome;
  random_unit_interval: number;
}

export interface JobFoundationRepository {
  claimDueJobs(input: ClaimDueJobsInput): Promise<ProviderJobRecord[]>;
  heartbeat(lease: JobLeaseToken, now: Date): Promise<JobLeaseToken | null>;
  markInFlight(
    lease: JobLeaseToken,
    expectedVersion: number,
    now: Date,
  ): Promise<ProviderJobRecord | null>;
  recordDispatchOutcome(input: RecordDispatchOutcomeInput): Promise<ProviderJobRecord | null>;
}

export interface ProviderJobHandler {
  operation_type: string;
  dispatch(job: ProviderJobRecord, signal: AbortSignal): Promise<ProviderDispatchOutcome>;
}
