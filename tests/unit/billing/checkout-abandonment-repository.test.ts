import { describe, expect, it, vi } from 'vitest';

import { createPostgresOt03CheckoutAbandonmentRepository } from '../../../packages/db/src/billing/checkout-abandonment-repository.ts';
import { deriveOt03CheckoutAbandonmentIntents } from '../../../packages/domain/src/billing/checkout-abandonment.ts';

describe('OT-03 checkout abandonment repository', () => {
  it('selects only exact adult-safe latest incomplete checkout episodes', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          checkout_request_key: 'checkout-request-1',
          account_key: 'one_time',
          product_key: 'one_time_mishnayos',
          household_key: 'household-1',
          adult_id: 'adult-1',
          checkout_status: 'session_created',
          checkout_started_at: new Date('2026-08-05T00:00:00.000Z'),
          request_fingerprint: 'f'.repeat(64),
        },
      ],
    });
    const repository = createPostgresOt03CheckoutAbandonmentRepository({ query });
    const rows = await repository.listDueCandidates({
      accountKey: 'one_time',
      productKey: 'one_time_mishnayos',
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_broad',
      observedAt: '2026-08-06T00:00:00.000Z',
      limit: 50,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        checkout_request_key: 'checkout-request-1',
        household_key: 'household-1',
        adult_id: 'adult-1',
        checkout_started_at: '2026-08-05T00:00:00.000Z',
      }),
    ]);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("guardian.authority = 'primary_guardian'");
    expect(sql).toContain("account_user.role = 'parent'");
    expect(sql).toContain("checkout.status IN ('started', 'session_created', 'expired')");
    expect(sql).toContain("household.status = 'active'");
    expect(sql).toContain('newer.started_at > checkout.started_at');
    expect(sql).toContain("source_event.processing_state = 'completed'");
    expect(sql).toContain("entitlement.status = 'active'");
  });

  it('rechecks due and completion exits when inserting an intent', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ intent_key: 'intent' }] });
    const repository = createPostgresOt03CheckoutAbandonmentRepository({ query });
    const [intent] = deriveOt03CheckoutAbandonmentIntents(
      {
        checkout_request_key: 'checkout-request-1',
        account_key: 'one_time',
        product_key: 'one_time_mishnayos',
        household_key: 'household-1',
        adult_id: 'adult-1',
        checkout_status: 'session_created',
        checkout_started_at: '2026-08-05T00:00:00.000Z',
        request_fingerprint: 'f'.repeat(64),
      },
      '2026-08-05T02:00:00.000Z',
    );

    await expect(
      repository.insertIntent({
        intent: intent!,
        runtimeTier: 'production',
        verificationEnvironmentId: 'production_broad',
      }),
    ).resolves.toBe(true);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("checkout.status IN ('started', 'session_created', 'expired')");
    expect(sql).toContain("interval '2 hours'");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain('ON CONFLICT (checkout_request_key, checkpoint) DO NOTHING');
    expect(sql).toContain("entitlement.status = 'active'");
    expect(sql).toContain('adult.adult_id = $6');
    expect(sql).toContain('adult.runtime_tier = $14');
    expect(sql).toContain('adult.verification_environment_id = $15');
    expect(query.mock.calls[0]?.[1]).toHaveLength(15);
  });
});
