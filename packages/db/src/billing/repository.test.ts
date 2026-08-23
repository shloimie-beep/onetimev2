import { describe, expect, it, vi } from 'vitest';
import type { BillingEntitlementProjection } from '../../../contracts/src/billing/index.ts';
import { deriveBillingGhlLifecycleEvent } from '../../../domain/src/billing/highlevel-lifecycle.ts';
import { createPostgresBillingRepositories } from './repository.ts';

describe('billing GHL lifecycle persistence', () => {
  it('atomically persists an adult-only intent with signed local provenance', async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const client = {
      query: vi.fn(async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('SELECT episode_discriminator')) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: text === 'BEGIN' || text === 'COMMIT' ? null : 1 };
      }),
      release: vi.fn(),
    };
    const repositories = createPostgresBillingRepositories({
      connect: async () => client,
      query: client.query,
      end: vi.fn(),
    } as never);
    const entitlement = activeEntitlement();
    const lifecycle = deriveBillingGhlLifecycleEvent(entitlement);

    await expect(repositories.upsertEntitlementProjection(entitlement, lifecycle)).resolves.toEqual(
      { projection: 'updated', lifecycle_intent: 'inserted' },
    );

    expect(calls.map(({ text }) => text.trim())).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT']),
    );
    expect(calls.some(({ text }) => text.includes('pg_advisory_xact_lock'))).toBe(true);
    const intent = calls.find(({ text }) =>
      text.includes('INSERT INTO onetime.billing_ghl_lifecycle_intents'),
    );
    expect(intent?.values).toEqual(
      expect.arrayContaining([
        'adult_household',
        'OT-04',
        'billing.payment_active.v1',
        true,
        false,
        'pending_external_binding',
      ]),
    );
    expect(calls.every(({ text }) => !text.includes('contacts/'))).toBe(true);
  });

  it('updates the local projection without duplicating an unchanged workflow episode', async () => {
    const entitlement = activeEntitlement();
    const lifecycle = deriveBillingGhlLifecycleEvent(entitlement)!;
    let intentInsertCount = 0;
    const client = {
      query: vi.fn(async (text: string) => {
        if (text.includes('SELECT episode_discriminator')) {
          return {
            rows: [{ episode_discriminator: lifecycle.episode_discriminator }],
            rowCount: 1,
          };
        }
        if (text.includes('INSERT INTO onetime.billing_ghl_lifecycle_intents')) {
          intentInsertCount += 1;
        }
        return { rows: [], rowCount: text === 'BEGIN' || text === 'COMMIT' ? null : 1 };
      }),
      release: vi.fn(),
    };
    const repositories = createPostgresBillingRepositories({
      connect: async () => client,
      query: client.query,
      end: vi.fn(),
    } as never);

    await expect(repositories.upsertEntitlementProjection(entitlement, lifecycle)).resolves.toEqual(
      { projection: 'updated', lifecycle_intent: 'unchanged' },
    );
    expect(intentInsertCount).toBe(0);
  });

  it('rolls back mismatched lifecycle evidence before writing', async () => {
    const entitlement = activeEntitlement();
    const lifecycle = {
      ...deriveBillingGhlLifecycleEvent(entitlement)!,
      household_key: 'different-household',
    };
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        calls.push(text.trim());
        return { rows: [], rowCount: null };
      }),
      release: vi.fn(),
    };
    const repositories = createPostgresBillingRepositories({
      connect: async () => client,
      query: client.query,
      end: vi.fn(),
    } as never);

    await expect(repositories.upsertEntitlementProjection(entitlement, lifecycle)).rejects.toThrow(
      'billing_ghl_lifecycle_projection_mismatch',
    );
    expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
  });
});

function activeEntitlement(): BillingEntitlementProjection {
  return {
    entitlement_key: 'billing_entitlement:one_time:family:household-1',
    account_key: 'one_time',
    product_key: 'family',
    principal_key: 'household-1',
    principal_type: 'opaque',
    status: 'active',
    policy_version: '2026-07-15.1',
    source: 'billing_event_1',
    reason: 'active_paid_current_invoice',
    effective_at: '2026-08-05T12:00:00.000Z',
    evaluated_at: '2026-08-05T12:00:01.000Z',
    grants_access: true,
  };
}
