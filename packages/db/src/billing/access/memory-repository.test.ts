import { describe, expect, it } from 'vitest';
import type { VerifiedBillingEvent } from '../../../../contracts/src/billing/access/index.ts';
import { createMemoryBillingAccessRepository } from './index.ts';

const EVENT: VerifiedBillingEvent = {
  event_id: 'paid-1',
  provider: 'stripe',
  household_id: 'household-a',
  provider_customer_ref_hash: 'a'.repeat(64),
  billing_term_id: 'term-1',
  kind: 'term_paid',
  occurred_at: '2026-07-01T00:00:00.000Z',
  term_ends_at: '2026-08-01T00:00:00.000Z',
  payload_digest: 'b'.repeat(64),
  signature_verified: true,
};

describe('memory billing access repository', () => {
  it('atomically deduplicates concurrent receipt attempts', async () => {
    const repository = createMemoryBillingAccessRepository();
    const results = await Promise.all([
      repository.projectVerifiedEvent(EVENT, new Date('2026-07-01T00:00:01.000Z')),
      repository.projectVerifiedEvent(EVENT, new Date('2026-07-01T00:00:02.000Z')),
    ]);

    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(1);
    expect(results[0]?.projection.version).toBe(1);
    expect(results[1]?.projection.version).toBe(1);
  });

  it('rejects event identity reuse with changed truth', async () => {
    const repository = createMemoryBillingAccessRepository();
    await repository.projectVerifiedEvent(EVENT, new Date('2026-07-01T00:00:01.000Z'));

    await expect(
      repository.projectVerifiedEvent(
        { ...EVENT, payload_digest: 'c'.repeat(64) },
        new Date('2026-07-01T00:00:02.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'event_id_conflict' });
  });
});
