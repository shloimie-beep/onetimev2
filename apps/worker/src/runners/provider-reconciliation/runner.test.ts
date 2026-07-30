import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderReconciliationRepository,
  ProviderRegistryBinding,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { runProviderReconciliationBatch } from './runner.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const NOW = new Date('2026-07-28T19:00:00.000Z');
const SCOPE = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
} as const;

describe('provider reconciliation runner', () => {
  it('performs canonical readback only and fences a stale persistence result', async () => {
    const operation = acceptanceUnknownOperation();
    const persistReconciliation = vi.fn().mockResolvedValue(false);
    const repository: ProviderReconciliationRepository = {
      claimAcceptanceUnknown: vi.fn().mockResolvedValue([operation]),
      persistReconciliation,
    };
    const readCanonical = vi.fn().mockResolvedValue(readback());
    const summary = await runProviderReconciliationBatch({
      repository,
      bindings: [binding()],
      adapters: [{ provider: 'highlevel', readCanonical }],
      scope: SCOPE,
      limit: 10,
      timeout_ms: 1_000,
      now: NOW,
      random_unit_interval: () => 0,
    });

    expect(readCanonical).toHaveBeenCalledOnce();
    expect(persistReconciliation).toHaveBeenCalledOnce();
    expect(summary).toMatchObject({ claimed: 1, stale_fenced: 1, failed_closed: 0 });
  });

  it('fails closed without an exact adapter or registry binding', async () => {
    const repository: ProviderReconciliationRepository = {
      claimAcceptanceUnknown: vi.fn().mockResolvedValue([acceptanceUnknownOperation()]),
      persistReconciliation: vi.fn(),
    };
    const summary = await runProviderReconciliationBatch({
      repository,
      bindings: [],
      adapters: [],
      scope: SCOPE,
      limit: 10,
      timeout_ms: 1_000,
      now: NOW,
      random_unit_interval: () => 0,
    });
    expect(summary).toMatchObject({ claimed: 1, failed_closed: 1 });
    expect(repository.persistReconciliation).not.toHaveBeenCalled();
  });
});

function binding(): ProviderRegistryBinding {
  return {
    registry_binding_key: 'highlevel-ci',
    provider: 'highlevel',
    scope: SCOPE,
    provider_account_ref_hash: HASH_A,
    allowed_operation_types: ['ghl.household.upsert'],
    mutation_policy: 'allowed',
    active: true,
  };
}

function acceptanceUnknownOperation(): ProviderOperation {
  return {
    job_id: 'operation-1',
    operation_type: 'ghl.household.upsert',
    aggregate_ref: 'household-1',
    source_version: 1,
    provider: 'highlevel',
    scope: SCOPE,
    idempotency_key: 'household-1:ghl-upsert:v1',
    canonical_request_hash: HASH_B,
    payload_ref: 'payload-1',
    payload_digest: HASH_C,
    compensation_for_job_id: null,
    state: 'acceptance_unknown',
    version: 4,
    recovery_generation: 0,
    dispatch_attempts: 1,
    lifetime_dispatch_attempts: 1,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 1,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: true,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: 'provider_timeout',
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH_A,
    effect_kind: 'mutation',
    household_id: 'household-1',
  };
}

function readback(): ProviderCanonicalReadback {
  return {
    operation_id: 'operation-1',
    provider: 'highlevel',
    scope: SCOPE,
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH_A,
    canonical_request_hash: HASH_B,
    disposition: 'effect_exists',
    provider_resource_ref_hash: HASH_C,
    provider_acceptance_digest: HASH_D,
    reconciliation_digest: HASH_E,
    safe_error_code: null,
    completed_locally: true,
    observed_at: NOW.toISOString(),
  };
}
