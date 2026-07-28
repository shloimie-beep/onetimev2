import { describe, expect, it } from 'vitest';
import { defineTypedApiRouteContract } from '../../../contracts/src/api/index.ts';
import type {
  JobLeaseToken,
  ProviderJobRecord,
  VersionedSaga,
} from '../../../contracts/src/jobs/index.ts';
import { executeTypedJobCommand } from '../../../../apps/web/src/server/features/jobs/command-handler.ts';
import { JobFoundationError } from './errors.ts';
import {
  assertOutboxIntent,
  assertSafeRoutePath,
  createCompensationIntent,
  fullJitterRetryDelayMs,
  leaseProviderJob,
  markJobInFlight,
  reconcileAcceptanceUnknown,
  recordDispatchOutcome,
  recoverDeadLetter,
} from './lifecycle.ts';
import { canonicalRequestHash } from './idempotency.ts';
import { transitionVersionedSaga } from './saga.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = new Date('2026-07-28T18:00:00.000Z');

describe('F05 typed API and durable job foundation', () => {
  it('enforces server-derived scope and typed authorization before mutation', async () => {
    let calls = 0;
    const contract = defineTypedApiRouteContract({
      operation_id: 'prepare_class',
      method: 'POST',
      path: '/api/classes/:class_ref/prepare',
      kind: 'command',
      allowed_roles: ['admin'],
      scope_source: 'server',
      idempotency: 'required',
      concurrency: 'expected_version',
      request_schema_ref: 'PrepareClassCommand.v1',
      success_schema_ref: 'PrepareClassResult.v1',
      error_codes: ['forbidden', 'stale_version', 'idempotency_conflict'],
      contains_pii_or_bearer_in_url: false,
    });
    const response = await executeTypedJobCommand({
      contract,
      context: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
        actor_role: 'parent',
        actor_ref: 'actor_opaque',
        account_ref: 'account_opaque',
        household_ref: 'household_opaque',
      },
      envelope: {
        command: { occurrence_ref: 'occurrence_opaque' },
        correlation_id: 'correlation_opaque',
        idempotency_key: 'prepare_class:opaque',
        canonical_request_hash: HASH_A,
        expected_version: 3,
      },
      store: {
        async executeTransactionalCommand() {
          calls += 1;
          return {
            disposition: 'applied' as const,
            response: { state: 'draft' },
            resulting_version: 4,
            outbox_job_ids: [],
          };
        },
      },
      authorize: () => true,
      mutate: async () => ({
        response: { state: 'draft' },
        resulting_version: 4,
        outbox_intents: [],
      }),
    });
    expect(response.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it('rejects scope mismatch, sensitive URL fields, and stale versions', () => {
    const current = job();
    expect(() =>
      assertOutboxIntent({
        ...current,
        scope: { ...current.scope, runtime_tier: 'production' },
      }),
    ).toThrowError(JobFoundationError);
    expect(() => assertSafeRoutePath('/api/jobs/:email/retry')).toThrowError(
      JobFoundationError,
    );
    expect(() =>
      leaseProviderJob(current, {
        owner: 'worker_1',
        now: NOW,
        expected_version: current.version - 1,
      }),
    ).toThrowError(JobFoundationError);
  });

  it('fences lease generations and increments dispatch attempts only at dispatch', () => {
    const leased = leaseProviderJob(job(), {
      owner: 'worker_1',
      now: NOW,
      expected_version: 1,
    });
    expect(leased.dispatch_attempts).toBe(0);
    const staleLease: JobLeaseToken = {
      ...leaseFrom(leased),
      generation: leased.lease_generation - 1,
    };
    expect(() => markJobInFlight(leased, staleLease, leased.version, NOW)).toThrowError(
      JobFoundationError,
    );
    const inFlight = markJobInFlight(leased, leaseFrom(leased), leased.version, NOW);
    expect(inFlight.dispatch_attempts).toBe(1);
    expect(inFlight.lifetime_dispatch_attempts).toBe(1);
  });

  it('quarantines acceptance uncertainty and permits retry only after absence readback', () => {
    const leased = leaseProviderJob(job(), {
      owner: 'worker_1',
      now: NOW,
      expected_version: 1,
    });
    const inFlight = markJobInFlight(leased, leaseFrom(leased), leased.version, NOW);
    const unknown = recordDispatchOutcome(
      inFlight,
      leaseFrom(inFlight),
      inFlight.version,
      {
        kind: 'acceptance_unknown',
        safe_error_code: 'provider_timeout',
      },
      { now: NOW, random_unit_interval: 0.5 },
    );
    expect(unknown.state).toBe('acceptance_unknown');
    expect(unknown.unknown_effect).toBe(true);
    expect(() =>
      leaseProviderJob(unknown, {
        owner: 'worker_2',
        now: NOW,
        expected_version: unknown.version,
      }),
    ).toThrowError(JobFoundationError);

    const reconciled = reconcileAcceptanceUnknown(
      unknown,
      unknown.version,
      {
        kind: 'effect_absent_retry_safe',
        reconciliation_digest: HASH_B,
      },
      { now: NOW, random_unit_interval: 0.5 },
    );
    expect(reconciled.state).toBe('retry_wait');
    expect(reconciled.unknown_effect).toBe(false);
    expect(reconciled.idempotency_key).toBe(unknown.idempotency_key);
    expect(reconciled.canonical_request_hash).toBe(unknown.canonical_request_hash);
  });

  it('bounds full jitter, dead-letters the eighth dispatch, and preserves lifetime history', () => {
    expect(
      fullJitterRetryDelayMs({
        dispatch_attempt: 1,
        random_unit_interval: 0.999,
        retry_after_ms: null,
      }),
    ).toBeLessThan(30_000);
    expect(
      fullJitterRetryDelayMs({
        dispatch_attempt: 8,
        random_unit_interval: 0.999,
        retry_after_ms: 2_000_000,
      }),
    ).toBe(1_800_000);

    const leased = leaseProviderJob(
      job({ dispatch_attempts: 7, lifetime_dispatch_attempts: 12 }),
      { owner: 'worker_1', now: NOW, expected_version: 1 },
    );
    const inFlight = markJobInFlight(leased, leaseFrom(leased), leased.version, NOW);
    const dead = recordDispatchOutcome(
      inFlight,
      leaseFrom(inFlight),
      inFlight.version,
      {
        kind: 'not_accepted_retryable',
        safe_error_code: 'provider_unavailable',
        retry_after_ms: null,
      },
      { now: NOW, random_unit_interval: 0.5 },
    );
    expect(dead.state).toBe('dead_letter');
    expect(dead.dispatch_attempts).toBe(8);
    const recovered = recoverDeadLetter(dead, {
      expected_version: dead.version,
      admin_authorized: true,
      now: NOW,
    });
    expect(recovered.state).toBe('not_started');
    expect(recovered.dispatch_attempts).toBe(0);
    expect(recovered.lifetime_dispatch_attempts).toBe(13);
    expect(recovered.recovery_generation).toBe(1);
    expect(recovered.idempotency_key).toBe(dead.idempotency_key);
  });

  it('models compensation as a distinct idempotent operation', () => {
    const original = job({
      state: 'complete',
      provider_acceptance_digest: HASH_B,
    });
    const compensation = createCompensationIntent(original, {
      job_id: 'job_compensation',
      operation_type: 'delete_provider_resource',
      idempotency_key: 'compensate:opaque',
      canonical_request_hash: HASH_B,
      payload_ref: 'payload_ref_compensation',
      payload_digest: HASH_A,
    });
    expect(compensation.compensation_for_job_id).toBe(original.job_id);
    expect(compensation.idempotency_key).not.toBe(original.idempotency_key);
  });

  it('binds saga confirmation and prevents leaving quarantine before reconciliation', () => {
    const draft = saga();
    const validating = transitionVersionedSaga(draft, {
      expected_version: 1,
      to_state: 'validating',
      failed_stage: null,
      preview_digest: null,
      unknown_job_ids: [],
      completed_job_ids: [],
    });
    const preview = transitionVersionedSaga(validating, {
      expected_version: 2,
      to_state: 'preview_ready',
      failed_stage: null,
      preview_digest: HASH_A,
      unknown_job_ids: [],
      completed_job_ids: [],
    });
    const confirmed = transitionVersionedSaga(preview, {
      expected_version: 3,
      to_state: 'confirmed',
      failed_stage: null,
      preview_digest: HASH_A,
      unknown_job_ids: [],
      completed_job_ids: [],
    });
    expect(confirmed.preview_digest).toBe(HASH_A);

    const quarantined: VersionedSaga = {
      ...confirmed,
      state: 'acceptance_unknown',
      unknown_job_ids: ['job_1'],
    };
    expect(() =>
      transitionVersionedSaga(quarantined, {
        expected_version: quarantined.version,
        to_state: 'provisioning',
        failed_stage: null,
        preview_digest: HASH_A,
        unknown_job_ids: ['job_1'],
        completed_job_ids: [],
      }),
    ).toThrowError(JobFoundationError);
  });

  it('canonicalizes request objects independently of property order', () => {
    expect(canonicalRequestHash({ b: 2, a: ['x', 1] })).toBe(
      canonicalRequestHash({ a: ['x', 1], b: 2 }),
    );
  });
});

function job(overrides: Partial<ProviderJobRecord> = {}): ProviderJobRecord {
  return {
    job_id: 'job_opaque',
    operation_type: 'provider_effect',
    aggregate_ref: 'aggregate_opaque',
    source_version: 1,
    provider: 'provider_opaque',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    idempotency_key: 'provider_effect:opaque',
    canonical_request_hash: HASH_A,
    payload_ref: 'payload_ref_opaque',
    payload_digest: HASH_B,
    compensation_for_job_id: null,
    state: 'not_started',
    version: 1,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function leaseFrom(record: ProviderJobRecord): JobLeaseToken {
  if (record.lease_owner === null || record.lease_expires_at === null) {
    throw new Error('missing_test_lease');
  }
  return {
    job_id: record.job_id,
    owner: record.lease_owner,
    generation: record.lease_generation,
    expires_at: record.lease_expires_at,
    job_version: record.version,
  };
}

function saga(): VersionedSaga {
  return {
    saga_id: 'saga_opaque',
    aggregate_ref: 'occurrence_opaque',
    source_version: 1,
    state: 'draft',
    version: 1,
    failed_stage: null,
    preview_digest: null,
    unknown_job_ids: [],
    completed_job_ids: [],
  };
}
