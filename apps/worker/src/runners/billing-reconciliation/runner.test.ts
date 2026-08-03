import { describe, expect, it, vi } from 'vitest';
import type {
  BillingReadbackAdapter,
  BillingReadbackBinding,
  VerifiedBillingEvent,
} from '../../../../../packages/contracts/src/billing/access/index.ts';
import { createMemoryBillingAccessRepository } from '../../../../../packages/db/src/billing/access/index.ts';
import { runBillingReconciliation } from './index.ts';

const binding: BillingReadbackBinding = {
  provider: 'stripe',
  mutation_policy: 'prohibited',
  household_id: 'household-a',
  provider_customer_ref_hash: 'a'.repeat(64),
};

describe('billing reconciliation runner', () => {
  it('projects only exact household-matched readback and never mutates Stripe', async () => {
    const repository = createMemoryBillingAccessRepository();
    const readVerifiedEvents = vi.fn(async () => [
      event('failure', 'payment_failed', '2026-07-02T00:00:00.000Z'),
      event('paid-older', 'term_paid', '2026-07-01T00:00:00.000Z'),
      {
        ...event('other-household', 'term_paid', '2026-07-03T00:00:00.000Z'),
        household_id: 'household-b',
      },
      event('recovery', 'term_paid', '2026-07-03T00:00:00.000Z'),
    ]);
    const adapter: BillingReadbackAdapter = {
      provider: 'stripe',
      readVerifiedEvents,
    };

    const first = await runBillingReconciliation({
      binding,
      adapter,
      repository,
      now: new Date('2026-07-03T00:01:00.000Z'),
      timeout_ms: 1_000,
    });
    const second = await runBillingReconciliation({
      binding,
      adapter,
      repository,
      now: new Date('2026-07-03T00:02:00.000Z'),
      timeout_ms: 1_000,
    });

    expect(first).toEqual({ read: 4, projected: 3, duplicate: 0, failed_closed: 1 });
    expect(second).toEqual({ read: 4, projected: 0, duplicate: 3, failed_closed: 1 });
    expect((await repository.getProjection('household-a'))?.state).toBe('active');
    expect(readVerifiedEvents).toHaveBeenCalledWith(binding, expect.any(AbortSignal));
  });

  it('rejects any mutation-capable binding', async () => {
    const repository = createMemoryBillingAccessRepository();
    await expect(
      runBillingReconciliation({
        binding: {
          ...binding,
          mutation_policy: 'allowed',
        } as unknown as BillingReadbackBinding,
        adapter: { provider: 'stripe', readVerifiedEvents: async () => [] },
        repository,
        now: new Date('2026-07-03T00:00:00.000Z'),
        timeout_ms: 1_000,
      }),
    ).rejects.toMatchObject({ code: 'invalid_contract' });
  });
});

function event(
  eventId: string,
  kind: VerifiedBillingEvent['kind'],
  occurredAt: string,
): VerifiedBillingEvent {
  return {
    event_id: eventId,
    provider: 'stripe',
    household_id: 'household-a',
    provider_customer_ref_hash: 'a'.repeat(64),
    billing_term_id: 'term-1',
    kind,
    occurred_at: occurredAt,
    term_ends_at: '2026-08-01T00:00:00.000Z',
    payload_digest: 'b'.repeat(64),
    signature_verified: true,
  };
}
