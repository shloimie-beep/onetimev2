import { describe, expect, it } from 'vitest';
import type {
  ClaimedDelivery,
  DeliveryRequest,
} from '../../../packages/contracts/src/delivery/types.ts';
import { OneTimeProviderDeliveryRouter } from '../../../apps/worker/src/delivery/provider-router.ts';
import { parseDeliveryProviderFeatureConfig } from '../../../apps/worker/src/delivery/provider-config.ts';
import { InMemoryDeliveryProviderAdapter } from '../../../apps/worker/src/delivery/mock-provider-adapter.ts';
import { runDeliveryBatch } from '../../../apps/worker/src/delivery/worker.ts';
import { captureLogger } from '../../support/delivery/logger.ts';
import {
  MemoryDeliveryRepository,
  type MemorySeed,
} from '../../support/delivery/memory-repository.ts';
import { BASE_TIME, claimedDelivery, deliveryContact } from '../../support/delivery/fixtures.ts';

const baseProviderSource = {
  DELIVERY_TRANSPORT_MODE: 'provider',
  DELIVERY_ENVIRONMENT: 'isolated_staging',
  ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE: 'isolated_staging',
  ONE_TIME_DELIVERY_STAGING_ISOLATED: 'true',
  ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
  ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
  ONE_TIME_RESEND_CANARY_AUTHORIZED: 'true',
  ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'recipient@example.test',
  ONE_TIME_DELIVERY_CANARY_BUDGET: '1',
};

const emailRequest: DeliveryRequest = {
  channel: 'email',
  provider: 'resend',
  recipientClass: 'public',
  idempotencyKey: 'delivery_provider_1',
  from: 'One Time <delivery@example.test>',
  to: 'recipient@example.test',
  subject: 'Test',
  text: 'Hello',
  html: '<p>Hello</p>',
  tags: [],
};

const providerContext = {
  deliveryKey: 'delivery_provider_1',
  attempt: 1,
  transportMode: 'provider' as const,
  signal: new AbortController().signal,
};

const messageConfig = {
  emailFrom: 'One Time <delivery@example.test>',
  emailReplyTo: 'reply@example.test',
  protectedOwnerEmail: 'owner@protected.test',
};

const workerOptions = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnah_class',
  batchSize: 25,
  concurrency: 4,
  transportMode: 'provider' as const,
  claimLeaseMs: 120_000,
  providerTimeoutMs: 25,
  providerTimeoutLeaseSafetyMs: 5_000,
  maxAttempts: 5,
};

function providerConfig(overrides: Record<string, unknown> = {}) {
  return parseDeliveryProviderFeatureConfig({
    ...baseProviderSource,
    ...overrides,
  });
}

function routerWithAdapter(overrides: Record<string, unknown> = {}) {
  const adapter = new InMemoryDeliveryProviderAdapter();
  const router = new OneTimeProviderDeliveryRouter(providerConfig(overrides), {
    resend: adapter,
    wapi: adapter,
  });
  return { adapter, router };
}

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

describe('delivery provider transport gates', () => {
  it('allows an isolated staging canary only when every provider gate is present', async () => {
    const { adapter, router } = routerWithAdapter();

    const receipt = await router.send(emailRequest, providerContext);

    expect(receipt).toMatchObject({ provider: 'resend', sink: false });
    expect(receipt.messageId).toMatch(/^resend_[a-f0-9]{24}$/);
    expect(adapter.calls).toEqual([
      {
        provider: 'resend',
        destinationRef: expect.any(String),
        idempotencyKey: 'delivery_provider_1',
      },
    ]);
    expect(JSON.stringify({ receipt, calls: adapter.calls })).not.toContain(
      'recipient@example.test',
    );
  });

  it('rejects production provider mode before any adapter call', async () => {
    const { adapter, router } = routerWithAdapter({
      DELIVERY_ENVIRONMENT: 'production',
      ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE: 'production',
    });

    await expect(router.send(emailRequest, providerContext)).rejects.toThrow(
      /provider_production_disabled/,
    );
    expect(adapter.calls).toHaveLength(0);
  });

  it('enforces exact allowlisted destinations before dispatch', async () => {
    const { adapter, router } = routerWithAdapter();

    await expect(
      router.send({ ...emailRequest, to: 'other@example.test' }, providerContext),
    ).rejects.toThrow(/provider_destination_not_authorized/);
    expect(adapter.calls).toHaveLength(0);
  });

  it('exhausts bounded canary budget without falling back to sink success', async () => {
    const { adapter, router } = routerWithAdapter({ ONE_TIME_DELIVERY_CANARY_BUDGET: '0' });

    await expect(router.send(emailRequest, providerContext)).rejects.toThrow(
      /provider_canary_budget_exhausted/,
    );
    expect(adapter.calls).toHaveLength(0);
  });

  it('uses one stable idempotency key so retries cannot duplicate provider actions', async () => {
    const { adapter, router } = routerWithAdapter();

    const first = await router.send(emailRequest, providerContext);
    const second = await router.send(emailRequest, { ...providerContext, attempt: 2 });

    expect(second).toEqual(first);
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]?.idempotencyKey).toBe('delivery_provider_1');
    expect(adapter.calls[0]?.idempotencyKey).not.toContain(':2');
  });

  it.each([
    ['provider_mode_not_enabled', { DELIVERY_TRANSPORT_MODE: 'sink' }, providerContext],
    [
      'provider_environment_gate_mismatch',
      { ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE: '' },
      providerContext,
    ],
    [
      'provider_staging_isolation_missing',
      { ONE_TIME_DELIVERY_STAGING_ISOLATED: 'false' },
      providerContext,
    ],
    [
      'provider_transport_disabled',
      {
        ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'false',
        ONE_TIME_RESEND_TRANSPORT_ENABLED: 'false',
        ONE_TIME_RESEND_CANARY_AUTHORIZED: 'false',
      },
      providerContext,
    ],
    [
      'provider_authorization_missing',
      { ONE_TIME_RESEND_CANARY_AUTHORIZED: 'false' },
      providerContext,
    ],
    [
      'provider_idempotency_key_mismatch',
      {},
      { ...providerContext, deliveryKey: 'different_delivery' },
    ],
  ] as const)(
    'makes no provider call when gate %s is missing',
    async (code, overrides, context) => {
      const { adapter, router } = routerWithAdapter(overrides);

      await expect(router.send(emailRequest, context)).rejects.toThrow(new RegExp(code));
      expect(adapter.calls).toHaveLength(0);
    },
  );

  it('fails unsupported channels closed with a typed provider result', async () => {
    const { adapter, router } = routerWithAdapter();
    const unsupported = {
      ...emailRequest,
      channel: 'telegram',
      provider: 'telegram',
    } as unknown as DeliveryRequest;

    await expect(router.send(unsupported, providerContext)).rejects.toThrow(
      /unsupported_provider_channel/,
    );
    expect(adapter.calls).toHaveLength(0);
  });
});

describe('delivery provider worker integration', () => {
  it('delivers provider-mode rows without leaking destination data to logs', async () => {
    const adapter = new InMemoryDeliveryProviderAdapter();
    const router = new OneTimeProviderDeliveryRouter(providerConfig(), {
      resend: adapter,
      wapi: adapter,
    });
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(
        claimedDelivery({
          id: 'provider-row',
          deliveryKey: 'delivery_provider_1',
          transportMode: 'provider',
        }),
      ),
    ]);
    const { logger, events } = captureLogger();

    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options: workerOptions,
      clock: () => BASE_TIME,
    });

    expect(summary).toMatchObject({ claimed: 1, delivered: 1, sinkDelivered: 0 });
    expect(repository.snapshot('provider-row')?.status).toBe('delivered');
    expect(adapter.calls).toHaveLength(1);
    const logs = JSON.stringify(events);
    expect(logs).not.toContain('recipient@example.test');
    expect(logs).not.toContain('+12025550123');
    expect(logs).not.toContain('Fixture Parent');
  });

  it('enforces suppression before provider dispatch', async () => {
    const adapter = new InMemoryDeliveryProviderAdapter();
    const router = new OneTimeProviderDeliveryRouter(providerConfig(), {
      resend: adapter,
      wapi: adapter,
    });
    const repository = new MemoryDeliveryRepository([
      seedFromClaim(
        claimedDelivery({
          id: 'provider-suppressed',
          deliveryKey: 'delivery_provider_1',
          transportMode: 'provider',
          contact: deliveryContact({ suppressionState: 'suppressed' }),
        }),
      ),
    ]);
    const { logger } = captureLogger();

    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options: workerOptions,
      clock: () => BASE_TIME,
    });

    expect(summary).toMatchObject({ claimed: 1, suppressed: 1, delivered: 0 });
    expect(adapter.calls).toHaveLength(0);
  });

  it('rejects unsafe provider timeout versus claim lease settings', async () => {
    const { logger } = captureLogger();
    await expect(
      runDeliveryBatch({
        repository: new MemoryDeliveryRepository([]),
        router: new OneTimeProviderDeliveryRouter(providerConfig(), {}),
        logger,
        messageConfig,
        options: {
          ...workerOptions,
          claimLeaseMs: 10_000,
          providerTimeoutMs: 8_000,
          providerTimeoutLeaseSafetyMs: 3_000,
        },
        clock: () => BASE_TIME,
      }),
    ).rejects.toThrow(/timeout plus safety margin/);
  });
});
