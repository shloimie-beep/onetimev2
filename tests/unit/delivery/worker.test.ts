import { describe, expect, it } from 'vitest';
import { providerError } from '../../../packages/contracts/src/delivery/errors.ts';
import type {
  ClaimedDelivery,
  DeliveryProviderRouter,
  ProviderReceipt,
} from '../../../packages/contracts/src/delivery/types.ts';
import { SinkDeliveryRouter } from '../../../apps/worker/src/delivery/sink-router.ts';
import { runDeliveryBatch } from '../../../apps/worker/src/delivery/worker.ts';
import { captureLogger } from '../../support/delivery/logger.ts';
import {
  MemoryDeliveryRepository,
  type MemorySeed,
} from '../../support/delivery/memory-repository.ts';
import { BASE_TIME, claimedDelivery } from '../../support/delivery/fixtures.ts';

function seedFromClaim(claim: ClaimedDelivery, overrides: Partial<MemorySeed> = {}): MemorySeed {
  const { claimLeaseExpiresAt, ...seed } = claim;
  void claimLeaseExpiresAt;
  return {
    ...seed,
    status: 'pending',
    nextAttemptAt: new Date(0),
    ...overrides,
  };
}

const messageConfig = {
  emailFrom: 'One Time <delivery@example.test>',
  emailReplyTo: 'reply@example.test',
  protectedOwnerEmail: 'owner@protected.test',
  currentClassLink: 'https://example.test/current-class',
};

const options = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnah_class',
  batchSize: 25,
  concurrency: 4,
  claimLeaseMs: 120_000,
  providerTimeoutMs: 25,
  maxAttempts: 5,
};

describe('delivery worker claims and failures', () => {
  it('does not claim the same row twice while the first lease is active', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-duplicate' })),
    ]);
    const first = await repository.claimBatch({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      now: BASE_TIME,
      limit: 10,
      leaseMs: 120_000,
    });
    const duplicate = await repository.claimBatch({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      now: BASE_TIME,
      limit: 10,
      leaseMs: 120_000,
    });
    expect(first).toHaveLength(1);
    expect(duplicate).toHaveLength(0);
  });

  it('allows only one of two concurrent workers to claim a row', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-concurrent' })),
    ]);
    const [left, right] = await Promise.all([
      repository.claimBatch({
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        transportMode: 'sink',
        now: BASE_TIME,
        limit: 10,
        leaseMs: 120_000,
      }),
      repository.claimBatch({
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        transportMode: 'sink',
        now: BASE_TIME,
        limit: 10,
        leaseMs: 120_000,
      }),
    ]);
    expect(left.length + right.length).toBe(1);
  });

  it('reclaims an expired processing lease but rejects stale completion', async () => {
    const oldLease = new Date(BASE_TIME.getTime() - 1);
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-expired' }), {
        status: 'processing',
        nextAttemptAt: oldLease,
        claimLeaseExpiresAt: oldLease,
        attempts: 1,
      }),
    ]);
    const staleClaim = claimedDelivery({
      id: 'row-expired',
      attempts: 1,
      claimLeaseExpiresAt: oldLease,
    });
    const reclaimed = await repository.claimBatch({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      now: BASE_TIME,
      limit: 1,
      leaseMs: 120_000,
    });
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]?.attempts).toBe(2);
    const staleCompleted = await repository.complete(staleClaim, {
      kind: 'delivered',
      at: BASE_TIME,
      receipt: { provider: 'sink', acceptedAt: BASE_TIME, sink: true },
    });
    expect(staleCompleted).toBe(false);
  });

  it('leaves provider-mode, unsupported, and cross-scope rows untouched', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'provider-mode', transportMode: 'provider' })),
      seedFromClaim(claimedDelivery({ id: 'wrong-account', accountKey: 'other_account' })),
      seedFromClaim(claimedDelivery({ id: 'wrong-product', productKey: 'other_product' })),
      seedFromClaim(claimedDelivery({ id: 'unsupported-event', eventType: 'future_event' })),
      seedFromClaim(claimedDelivery({ id: 'supported' })),
    ]);
    const claims = await repository.claimBatch({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      now: BASE_TIME,
      limit: 25,
      leaseMs: 120_000,
    });
    expect(claims.map((claim) => claim.id)).toEqual(['supported']);
    expect(repository.snapshot('provider-mode')?.status).toBe('pending');
    expect(repository.snapshot('wrong-account')?.status).toBe('pending');
    expect(repository.snapshot('wrong-product')?.status).toBe('pending');
    expect(repository.snapshot('unsupported-event')?.status).toBe('pending');
  });

  it('turns a provider timeout into a scheduled retry', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-timeout', deliveryKey: 'delivery_timeout' })),
    ]);
    const router: DeliveryProviderRouter = {
      async send(): Promise<ProviderReceipt> {
        return await new Promise<ProviderReceipt>(() => undefined);
      },
    };
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options: { ...options, providerTimeoutMs: 5 },
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, retried: 1, deadLettered: 0 });
    expect(repository.snapshot('row-timeout')).toMatchObject({
      status: 'pending',
      outcome: {
        kind: 'retry',
        failure: { code: 'provider_timeout', category: 'transient' },
      },
    });
  });

  it('dead-letters a permanent provider failure without retrying', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-permanent', deliveryKey: 'delivery_permanent' })),
    ]);
    const router: DeliveryProviderRouter = {
      async send(): Promise<ProviderReceipt> {
        throw providerError('resend_validation_error', {
          retryable: false,
          provider: 'resend',
          httpStatus: 422,
        });
      },
    };
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ deadLettered: 1, retried: 0 });
    expect(repository.snapshot('row-permanent')).toMatchObject({
      status: 'dead_lettered',
      outcome: { kind: 'dead_lettered' },
    });
  });

  it('delivers through the sink without provider side effects or PII logs', async () => {
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(claimedDelivery({ id: 'row-sink', deliveryKey: 'delivery_sink' })),
    ]);
    const { logger, events } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router: new SinkDeliveryRouter(),
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({
      claimed: 1,
      sinkDelivered: 1,
      delivered: 0,
    });
    expect(repository.snapshot('row-sink')?.status).toBe('sink_delivered');
    const logs = JSON.stringify(events);
    expect(logs).not.toContain('recipient@example.test');
    expect(logs).not.toContain('+12025550123');
    expect(logs).not.toContain('Fixture Parent');
    expect(logs).not.toContain('https://example.test/current-class');
  });
});
