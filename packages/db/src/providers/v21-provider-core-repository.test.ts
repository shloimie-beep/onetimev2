import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBindingReadRequest,
} from '../../../contracts/src/providers/v21-provider-core.ts';
import {
  createPostgresProviderCoreRepository,
  type ProviderCoreSqlClient,
} from './v21-provider-core-repository.ts';

const HASH = 'a'.repeat(64);
const NOW = '2026-07-28T19:00:00.000Z';

describe('Postgres provider core repository', () => {
  it('reads only one exact active registry binding with current evidence', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [bindingRow()], rowCount: 1 });
    const repository = createPostgresProviderCoreRepository(pool(query));
    const result = await repository.readActiveRegistryBinding(bindingRequest());
    expect(result?.binding.registry_binding_key).toBe('highlevel-ci');
    expect(result?.binding.allowed_operation_types).toEqual(['ghl.household.upsert']);
    expect(result?.registry_evidence_digest).toBe('b'.repeat(64));
    expect(query.mock.calls[0]?.[0]).toContain('provider_registry_binding_v21');
    expect(query.mock.calls[0]?.[0]).not.toContain('provider_operation_binding');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'highlevel-ci',
      'highlevel',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      HASH,
      'ghl.household.upsert',
      'b'.repeat(64),
      'c'.repeat(64),
      2,
      NOW,
      'mutation',
    ]);
  });

  it('fails closed on empty, duplicate, or malformed registry evidence', async () => {
    for (const rows of [[], [bindingRow(), bindingRow()], [{ ...bindingRow(), active: false }]]) {
      const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
      const repository = createPostgresProviderCoreRepository(pool(query));
      await expect(repository.readActiveRegistryBinding(bindingRequest())).resolves.toBeNull();
    }
  });

  it('claims only exact-scope acceptance-unknown operations with parameterized SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()], rowCount: 1 });
    const repository = createPostgresProviderCoreRepository(pool(query));
    const result = await repository.claimAcceptanceUnknown({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      provider_keys: ['highlevel'],
      limit: 10,
    });
    expect(result).toHaveLength(1);
    expect(query.mock.calls[0]?.[0]).toContain("j.state = 'acceptance_unknown'");
    expect(query.mock.calls[0]?.[0]).toContain('j.unknown_effect = true');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      ['highlevel'],
      10,
    ]);
  });

  it('persists the fenced transition and append-only readback in one transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ job_id: 'operation-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createPostgresProviderCoreRepository(pool(query));
    const prior = operation();
    const next = { ...prior, state: 'complete' as const, version: 5, unknown_effect: false };
    const persisted = await repository.persistReconciliation({
      prior,
      next,
      readback: readback(),
    });
    expect(persisted).toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining("state = 'acceptance_unknown'"),
      expect.stringContaining('provider_readback_ledger'),
      'COMMIT',
    ]);
  });
});

function pool(query: ReturnType<typeof vi.fn>) {
  const client: ProviderCoreSqlClient = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client) };
}

function row(): Record<string, unknown> {
  return {
    ...operation(),
    product: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
  };
}

function operation(): ProviderOperation {
  return {
    job_id: 'operation-1',
    operation_type: 'ghl.household.upsert',
    aggregate_ref: 'household-1',
    source_version: 1,
    provider: 'highlevel',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    idempotency_key: 'stable-key',
    canonical_request_hash: HASH,
    payload_ref: 'payload-1',
    payload_digest: HASH,
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
    created_at: NOW,
    updated_at: NOW,
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH,
    effect_kind: 'mutation',
    household_id: 'household-1',
  };
}

function readback(): ProviderCanonicalReadback {
  return {
    operation_id: 'operation-1',
    provider: 'highlevel',
    scope: operation().scope,
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH,
    canonical_request_hash: HASH,
    disposition: 'effect_exists',
    provider_resource_ref_hash: HASH,
    provider_acceptance_digest: HASH,
    reconciliation_digest: HASH,
    safe_error_code: null,
    completed_locally: true,
    observed_at: NOW,
  };
}

function bindingRequest(): ProviderRegistryBindingReadRequest {
  return {
    registry_binding_key: 'highlevel-ci',
    provider: 'highlevel',
    scope: operation().scope,
    operation_type: 'ghl.household.upsert',
    effect_kind: 'mutation',
    expected_provider_account_ref_hash: HASH,
    expected_registry_evidence_digest: 'b'.repeat(64),
    expected_provider_readback_evidence_digest: 'c'.repeat(64),
    expected_version: 2,
    observed_not_before: NOW,
  };
}

function bindingRow(): Record<string, unknown> {
  return {
    registry_binding_key: 'highlevel-ci',
    provider: 'highlevel',
    product_key: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
    provider_account_ref_hash: HASH,
    allowed_operation_types: ['ghl.household.upsert'],
    mutation_policy: 'orchestration_only',
    active: true,
    registry_evidence_digest: 'b'.repeat(64),
    provider_readback_evidence_digest: 'c'.repeat(64),
    observed_at: NOW,
    version: 2,
  };
}
