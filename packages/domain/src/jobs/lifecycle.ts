import type {
  JobLeaseToken,
  JobScope,
  ProviderDispatchOutcome,
  ProviderJobRecord,
  ProviderReconciliationOutcome,
  TransactionalOutboxIntent,
} from '../../../contracts/src/jobs/index.ts';
import {
  JOB_LEASE_DURATION_MS,
  JOB_MAX_DISPATCH_ATTEMPTS,
  JOB_MAX_RETRY_DELAY_MS,
} from '../../../contracts/src/jobs/index.ts';
import {
  ONE_TIME_PRODUCT_SCOPE,
  VERIFICATION_RUNTIME_TIER,
} from '../../../contracts/src/state/index.ts';
import { JobFoundationError } from './errors.ts';
import { assertSha256 } from './idempotency.ts';

const BASE_RETRY_DELAY_MS = 30_000;

export function assertJobScope(scope: JobScope): void {
  if (
    scope.product !== ONE_TIME_PRODUCT_SCOPE ||
    VERIFICATION_RUNTIME_TIER[scope.verification_environment_id] !== scope.runtime_tier
  ) {
    throw new JobFoundationError(
      'invalid_scope',
      'Job scope must use the canonical product and environment-to-tier mapping.',
    );
  }
}

export function assertOutboxIntent(intent: TransactionalOutboxIntent): void {
  assertJobScope(intent.scope);
  for (const [field, value] of [
    ['job_id', intent.job_id],
    ['operation_type', intent.operation_type],
    ['aggregate_ref', intent.aggregate_ref],
    ['provider', intent.provider],
    ['idempotency_key', intent.idempotency_key],
    ['payload_ref', intent.payload_ref],
  ] as const) {
    if (value.trim() === '') {
      throw new JobFoundationError('invalid_identity', `${field} must be nonempty and opaque.`);
    }
  }
  if (!Number.isSafeInteger(intent.source_version) || intent.source_version < 1) {
    throw new JobFoundationError(
      'invalid_version',
      'A job must bind a positive immutable source version.',
    );
  }
  assertSha256(intent.canonical_request_hash, 'canonical_request_hash');
  assertSha256(intent.payload_digest, 'payload_digest');
}

export function leaseProviderJob(
  job: ProviderJobRecord,
  input: {
    owner: string;
    now: Date;
    expected_version: number;
  },
): ProviderJobRecord {
  assertRecord(job);
  assertExpectedVersion(job, input.expected_version);
  if (input.owner.trim() === '') {
    throw new JobFoundationError('invalid_identity', 'A worker owner is required.');
  }
  if (job.unknown_effect || job.state === 'acceptance_unknown') {
    throw new JobFoundationError(
      'acceptance_unknown_quarantined',
      'Acceptance-unknown work is reconciliation-only.',
    );
  }
  if (job.state !== 'not_started' && job.state !== 'retry_wait') {
    throw new JobFoundationError('invalid_transition', `Cannot lease a ${job.state} job.`);
  }
  if (job.dispatch_attempts >= JOB_MAX_DISPATCH_ATTEMPTS) {
    throw new JobFoundationError(
      'dispatch_attempts_exhausted',
      'The recovery generation has exhausted its eight dispatch attempts.',
    );
  }
  if (
    job.next_attempt_at !== null &&
    new Date(job.next_attempt_at).getTime() > input.now.getTime()
  ) {
    throw new JobFoundationError(
      'invalid_transition',
      'The retry not-before time has not arrived.',
    );
  }
  const expiresAt = new Date(input.now.getTime() + JOB_LEASE_DURATION_MS).toISOString();
  return {
    ...job,
    state: 'leased',
    version: job.version + 1,
    lease_owner: input.owner,
    lease_generation: job.lease_generation + 1,
    lease_expires_at: expiresAt,
    last_heartbeat_at: input.now.toISOString(),
    next_attempt_at: null,
    updated_at: input.now.toISOString(),
  };
}

export function heartbeatProviderJob(
  job: ProviderJobRecord,
  lease: JobLeaseToken,
  now: Date,
): ProviderJobRecord {
  assertCurrentLease(job, lease, now);
  if (job.state !== 'leased' && job.state !== 'in_flight') {
    throw new JobFoundationError('invalid_transition', 'Only owned active work may heartbeat.');
  }
  const expiresAt = new Date(now.getTime() + JOB_LEASE_DURATION_MS).toISOString();
  return {
    ...job,
    version: job.version + 1,
    lease_expires_at: expiresAt,
    last_heartbeat_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function markJobInFlight(
  job: ProviderJobRecord,
  lease: JobLeaseToken,
  expectedVersion: number,
  now: Date,
): ProviderJobRecord {
  assertExpectedVersion(job, expectedVersion);
  assertCurrentLease(job, lease, now);
  if (job.state !== 'leased') {
    throw new JobFoundationError('invalid_transition', 'Dispatch begins only from leased.');
  }
  return {
    ...job,
    state: 'in_flight',
    version: job.version + 1,
    dispatch_attempts: job.dispatch_attempts + 1,
    lifetime_dispatch_attempts: job.lifetime_dispatch_attempts + 1,
    updated_at: now.toISOString(),
  };
}

export function recordDispatchOutcome(
  job: ProviderJobRecord,
  lease: JobLeaseToken,
  expectedVersion: number,
  outcome: ProviderDispatchOutcome,
  input: { now: Date; random_unit_interval: number },
): ProviderJobRecord {
  assertExpectedVersion(job, expectedVersion);
  assertCurrentLease(job, lease, input.now);
  if (job.state !== 'in_flight') {
    throw new JobFoundationError('invalid_transition', 'A dispatch outcome requires in-flight.');
  }

  const base = clearLease(job, input.now);
  if (outcome.kind === 'accepted') {
    assertSha256(outcome.provider_acceptance_digest, 'provider_acceptance_digest');
    return {
      ...base,
      state: outcome.completed_locally ? 'complete' : 'accepted',
      provider_acceptance_digest: outcome.provider_acceptance_digest,
      safe_error_code: null,
    };
  }
  if (outcome.kind === 'permanently_rejected') {
    return {
      ...base,
      state: 'rejected',
      safe_error_code: sanitizeSafeCode(outcome.safe_error_code),
    };
  }
  if (outcome.kind === 'acceptance_unknown') {
    return {
      ...base,
      state: 'acceptance_unknown',
      unknown_effect: true,
      safe_error_code: sanitizeSafeCode(outcome.safe_error_code),
    };
  }

  const safeCode = sanitizeSafeCode(outcome.safe_error_code);
  if (job.dispatch_attempts >= JOB_MAX_DISPATCH_ATTEMPTS) {
    return {
      ...base,
      state: 'dead_letter',
      safe_error_code: safeCode,
    };
  }
  const delay = fullJitterRetryDelayMs({
    dispatch_attempt: job.dispatch_attempts,
    random_unit_interval: input.random_unit_interval,
    retry_after_ms: outcome.retry_after_ms,
  });
  return {
    ...base,
    state: 'retry_wait',
    next_attempt_at: new Date(input.now.getTime() + delay).toISOString(),
    safe_error_code: safeCode,
  };
}

export function reconcileAcceptanceUnknown(
  job: ProviderJobRecord,
  expectedVersion: number,
  outcome: ProviderReconciliationOutcome,
  input: { now: Date; random_unit_interval: number },
): ProviderJobRecord {
  assertExpectedVersion(job, expectedVersion);
  if (job.state !== 'acceptance_unknown' || !job.unknown_effect) {
    throw new JobFoundationError(
      'invalid_transition',
      'Only quarantined acceptance-unknown work may be reconciled.',
    );
  }
  assertSha256(outcome.reconciliation_digest, 'reconciliation_digest');
  const attempts = job.reconciliation_attempts + 1;
  const base: ProviderJobRecord = {
    ...job,
    version: job.version + 1,
    reconciliation_attempts: attempts,
    reconciliation_digest: outcome.reconciliation_digest,
    updated_at: input.now.toISOString(),
  };

  if (outcome.kind === 'effect_exists') {
    assertSha256(outcome.provider_acceptance_digest, 'provider_acceptance_digest');
    return {
      ...base,
      state: outcome.completed_locally ? 'complete' : 'accepted',
      unknown_effect: false,
      provider_acceptance_digest: outcome.provider_acceptance_digest,
      safe_error_code: null,
    };
  }
  if (outcome.kind === 'effect_absent_retry_safe') {
    if (job.dispatch_attempts >= JOB_MAX_DISPATCH_ATTEMPTS) {
      return {
        ...base,
        state: 'dead_letter',
        unknown_effect: false,
        safe_error_code: 'dispatch_attempts_exhausted',
      };
    }
    const delay = fullJitterRetryDelayMs({
      dispatch_attempt: Math.max(1, job.dispatch_attempts),
      random_unit_interval: input.random_unit_interval,
      retry_after_ms: null,
    });
    return {
      ...base,
      state: 'retry_wait',
      unknown_effect: false,
      next_attempt_at: new Date(input.now.getTime() + delay).toISOString(),
      safe_error_code: null,
    };
  }
  if (outcome.kind === 'permanently_rejected') {
    return {
      ...base,
      state: 'rejected',
      unknown_effect: false,
      safe_error_code: sanitizeSafeCode(outcome.safe_error_code),
    };
  }
  return {
    ...base,
    state: attempts >= JOB_MAX_DISPATCH_ATTEMPTS ? 'dead_letter' : 'acceptance_unknown',
    unknown_effect: true,
    safe_error_code: sanitizeSafeCode(outcome.safe_error_code),
  };
}

export function recoverDeadLetter(
  job: ProviderJobRecord,
  input: {
    expected_version: number;
    admin_authorized: boolean;
    now: Date;
  },
): ProviderJobRecord {
  assertExpectedVersion(job, input.expected_version);
  if (job.state !== 'dead_letter' || !input.admin_authorized) {
    throw new JobFoundationError(
      'recovery_not_authorized',
      'Dead-letter recovery requires explicit audited Admin authorization.',
    );
  }
  return {
    ...job,
    state: 'not_started',
    version: job.version + 1,
    recovery_generation: job.recovery_generation + 1,
    dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    updated_at: input.now.toISOString(),
  };
}

export function createCompensationIntent(
  original: ProviderJobRecord,
  input: {
    job_id: string;
    operation_type: string;
    idempotency_key: string;
    canonical_request_hash: string;
    payload_ref: string;
    payload_digest: string;
  },
): TransactionalOutboxIntent {
  if (original.state !== 'complete' && original.state !== 'accepted') {
    throw new JobFoundationError(
      'invalid_transition',
      'Compensation targets only a proven accepted logical effect.',
    );
  }
  const intent: TransactionalOutboxIntent = {
    job_id: input.job_id,
    operation_type: input.operation_type,
    aggregate_ref: original.aggregate_ref,
    source_version: original.source_version,
    provider: original.provider,
    scope: original.scope,
    idempotency_key: input.idempotency_key,
    canonical_request_hash: input.canonical_request_hash,
    payload_ref: input.payload_ref,
    payload_digest: input.payload_digest,
    compensation_for_job_id: original.job_id,
  };
  assertOutboxIntent(intent);
  if (intent.job_id === original.job_id || intent.idempotency_key === original.idempotency_key) {
    throw new JobFoundationError(
      'idempotency_conflict',
      'Compensation is a separate logical operation with its own identity.',
    );
  }
  return intent;
}

export function fullJitterRetryDelayMs(input: {
  dispatch_attempt: number;
  random_unit_interval: number;
  retry_after_ms: number | null;
}): number {
  if (
    !Number.isSafeInteger(input.dispatch_attempt) ||
    input.dispatch_attempt < 1 ||
    !Number.isFinite(input.random_unit_interval) ||
    input.random_unit_interval < 0 ||
    input.random_unit_interval >= 1
  ) {
    throw new JobFoundationError('invalid_contract', 'Retry inputs are invalid.');
  }
  const cap = Math.min(
    JOB_MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** (input.dispatch_attempt - 1),
  );
  const jitter = Math.floor(cap * input.random_unit_interval);
  const retryAfter = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, input.retry_after_ms ?? 0));
  return Math.max(jitter, retryAfter);
}

export function assertSafeRoutePath(path: string): void {
  if (
    !path.startsWith('/') ||
    path.includes('?') ||
    /(?:token|secret|bearer|email|phone|join_url|password)/i.test(path)
  ) {
    throw new JobFoundationError(
      'unsafe_url_contract',
      'Production paths contain only opaque path parameters and no PII or bearer material.',
    );
  }
}

function assertRecord(job: ProviderJobRecord): void {
  assertOutboxIntent(job);
  if (!Number.isSafeInteger(job.version) || job.version < 1) {
    throw new JobFoundationError('invalid_version', 'A durable job has a positive version.');
  }
}

function assertExpectedVersion(job: ProviderJobRecord, expectedVersion: number): void {
  if (job.version !== expectedVersion) {
    throw new JobFoundationError('stale_version', 'The job version is stale.');
  }
}

function assertCurrentLease(job: ProviderJobRecord, lease: JobLeaseToken, now: Date): void {
  if (
    job.job_id !== lease.job_id ||
    job.lease_owner !== lease.owner ||
    job.lease_generation !== lease.generation ||
    job.lease_expires_at !== lease.expires_at
  ) {
    throw new JobFoundationError('lease_lost', 'The worker generation is no longer current.');
  }
  if (new Date(lease.expires_at).getTime() <= now.getTime()) {
    throw new JobFoundationError('lease_expired', 'The fenced worker lease has expired.');
  }
}

function clearLease(job: ProviderJobRecord, now: Date): ProviderJobRecord {
  return {
    ...job,
    version: job.version + 1,
    lease_owner: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    updated_at: now.toISOString(),
  };
}

function sanitizeSafeCode(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return normalized === '' ? 'provider_unclassified_failure' : normalized;
}
