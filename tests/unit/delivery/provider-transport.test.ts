import { describe, expect, it } from 'vitest';
import { providerError } from '../../../packages/contracts/src/delivery/errors.ts';
import type {
  ClaimedDelivery,
  DeliveryOutcome,
  DeliveryProviderAcceptanceRecovery,
  DeliveryRequest,
} from '../../../packages/contracts/src/delivery/types.ts';
import {
  OneTimeProviderDeliveryRouter,
  type ResendProviderClient,
} from '../../../apps/worker/src/delivery/provider-router.ts';
import { parseDeliveryProviderFeatureConfig } from '../../../apps/worker/src/delivery/provider-config.ts';
import { InMemoryDeliveryProviderAdapter } from '../../../apps/worker/src/delivery/mock-provider-adapter.ts';
import { runDeliveryBatch } from '../../../apps/worker/src/delivery/worker.ts';
import { providerOperationIdempotencyKey } from '../../../packages/domain/src/delivery/activation-policy.ts';
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

type ProviderFault = 'success' | 'accept_then_timeout' | 'retryable_reject' | 'permanent_reject';

class FaultInjectingResend implements ResendProviderClient {
  readonly calls: string[] = [];
  readonly effects = new Set<string>();

  constructor(
    private fault: ProviderFault,
    readonly acceptanceRecovery?: DeliveryProviderAcceptanceRecovery,
    private readonly afterAccept?: () => void,
  ) {}

  async sendEmail(
    _request: Parameters<ResendProviderClient['sendEmail']>[0],
    options: Parameters<ResendProviderClient['sendEmail']>[1],
  ): Promise<{ messageId: string; acceptedAt: Date }> {
    this.calls.push(options.idempotencyKey);
    if (this.fault === 'retryable_reject') {
      this.fault = 'success';
      throw providerError('resend_rate_limit_exceeded', {
        retryable: true,
        acceptance: 'not_accepted',
        provider: 'resend',
        httpStatus: 429,
      });
    }
    if (this.fault === 'permanent_reject') {
      throw providerError('resend_validation_error', {
        retryable: false,
        acceptance: 'not_accepted',
        provider: 'resend',
        httpStatus: 422,
      });
    }
    this.effects.add(options.idempotencyKey);
    this.afterAccept?.();
    if (this.fault === 'accept_then_timeout') {
      this.fault = 'success';
      return await new Promise(() => undefined);
    }
    return {
      messageId: `provider_fixture_${options.idempotencyKey}`,
      acceptedAt: BASE_TIME,
    };
  }
}

class CrashBeforeOutboxCompletionRepository extends MemoryDeliveryRepository {
  private crash = true;

  override async complete(claim: ClaimedDelivery, outcome: DeliveryOutcome): Promise<boolean> {
    if (this.crash && outcome.kind === 'delivered') {
      this.crash = false;
      return false;
    }
    return super.complete(claim, outcome);
  }
}

function providerSeed(id: string): MemorySeed {
  return seedFromClaim(
    claimedDelivery({
      id,
      deliveryKey: 'delivery_provider_1',
      transportMode: 'provider',
    }),
  );
}

async function runProviderFaultBatch(
  repository: MemoryDeliveryRepository,
  adapter: ResendProviderClient,
  now: () => Date,
) {
  return runDeliveryBatch({
    repository,
    router: new OneTimeProviderDeliveryRouter(providerConfig(), { resend: adapter }),
    logger: captureLogger().logger,
    messageConfig,
    options: {
      ...workerOptions,
      concurrency: 1,
      providerTimeoutMs: 5,
    },
    clock: now,
  });
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
        idempotencyKey: providerOperationIdempotencyKey('delivery_provider_1'),
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
    ).rejects.toThrow(/allowlisted_destination_missing/);
    expect(adapter.calls).toHaveLength(0);
  });

  it('exhausts bounded canary budget without falling back to sink success', async () => {
    const { adapter, router } = routerWithAdapter({ ONE_TIME_DELIVERY_CANARY_BUDGET: '0' });

    await expect(router.send(emailRequest, providerContext)).rejects.toThrow(/budget_exhausted/);
    expect(adapter.calls).toHaveLength(0);
  });

  it('uses one stable idempotency key so retries cannot duplicate provider actions', async () => {
    const { adapter, router } = routerWithAdapter();

    const first = await router.send(emailRequest, providerContext);
    const second = await router.send(emailRequest, { ...providerContext, attempt: 2 });

    expect(second).toEqual(first);
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]?.idempotencyKey).toBe(
      providerOperationIdempotencyKey('delivery_provider_1'),
    );
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

  it('retries accepted-then-timeout with the same key and one idempotent provider effect', async () => {
    const repository = new MemoryDeliveryRepository([providerSeed('accepted-timeout')]);
    const adapter = new FaultInjectingResend('accept_then_timeout', 'retry_same_key');

    const first = await runProviderFaultBatch(repository, adapter, () => BASE_TIME);
    const retryAt = repository.snapshot('accepted-timeout')?.nextAttemptAt;
    expect(first).toMatchObject({ retried: 1, acceptanceUnknown: 0 });
    expect(repository.snapshot('accepted-timeout')?.providerOperation.state).toBe(
      'acceptance_unknown',
    );
    expect(retryAt).toBeInstanceOf(Date);

    const second = await runProviderFaultBatch(repository, adapter, () => retryAt ?? BASE_TIME);
    expect(second).toMatchObject({ delivered: 1 });
    expect(repository.snapshot('accepted-timeout')).toMatchObject({
      status: 'delivered',
      providerOperation: { state: 'accepted' },
    });
    expect(adapter.calls).toEqual(['delivery_provider_1', 'delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });

  it('finishes from durable acceptance after a crash before outbox completion without resending', async () => {
    const repository = new CrashBeforeOutboxCompletionRepository([
      providerSeed('accepted-before-complete'),
    ]);
    const adapter = new FaultInjectingResend('success', 'retry_same_key');

    const first = await runProviderFaultBatch(repository, adapter, () => BASE_TIME);
    const leaseExpiry = repository.snapshot('accepted-before-complete')?.claimLeaseExpiresAt;
    expect(first).toMatchObject({ leaseLost: 1, delivered: 0 });
    expect(repository.snapshot('accepted-before-complete')?.providerOperation.state).toBe(
      'accepted',
    );

    const second = await runProviderFaultBatch(repository, adapter, () => leaseExpiry ?? BASE_TIME);
    expect(second).toMatchObject({ delivered: 1 });
    expect(adapter.calls).toEqual(['delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });

  it('recovers an expired lease with the same provider key and one effect', async () => {
    let now = BASE_TIME;
    const leaseExpiry = new Date(BASE_TIME.getTime() + workerOptions.claimLeaseMs);
    const repository = new MemoryDeliveryRepository([providerSeed('lease-expiry')]);
    const adapter = new FaultInjectingResend('success', 'retry_same_key', () => {
      now = leaseExpiry;
    });

    const first = await runProviderFaultBatch(repository, adapter, () => now);
    expect(first).toMatchObject({ leaseLost: 1, delivered: 0 });
    expect(repository.snapshot('lease-expiry')?.providerOperation.state).toBe('in_flight');

    const second = await runProviderFaultBatch(repository, adapter, () => now);
    expect(second).toMatchObject({ delivered: 1 });
    expect(adapter.calls).toEqual(['delivery_provider_1', 'delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });

  it('allows two racing workers only one claimed provider operation', async () => {
    const repository = new MemoryDeliveryRepository([providerSeed('two-workers')]);
    const adapter = new FaultInjectingResend('success', 'retry_same_key');

    const results = await Promise.all([
      runProviderFaultBatch(repository, adapter, () => BASE_TIME),
      runProviderFaultBatch(repository, adapter, () => BASE_TIME),
    ]);
    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.delivered, 0)).toBe(1);
    expect(adapter.calls).toEqual(['delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });

  it('records a retryable pre-acceptance rejection and later reuses the same key', async () => {
    const repository = new MemoryDeliveryRepository([providerSeed('retryable-reject')]);
    const adapter = new FaultInjectingResend('retryable_reject', 'retry_same_key');

    const first = await runProviderFaultBatch(repository, adapter, () => BASE_TIME);
    const retryAt = repository.snapshot('retryable-reject')?.nextAttemptAt;
    expect(first).toMatchObject({ retried: 1 });
    expect(repository.snapshot('retryable-reject')?.providerOperation.state).toBe('rejected');
    expect(adapter.effects.size).toBe(0);

    const second = await runProviderFaultBatch(repository, adapter, () => retryAt ?? BASE_TIME);
    expect(second).toMatchObject({ delivered: 1 });
    expect(adapter.calls).toEqual(['delivery_provider_1', 'delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });

  it('records permanent pre-acceptance rejection without a provider effect', async () => {
    const repository = new MemoryDeliveryRepository([providerSeed('permanent-reject')]);
    const adapter = new FaultInjectingResend('permanent_reject', 'retry_same_key');

    const result = await runProviderFaultBatch(repository, adapter, () => BASE_TIME);
    expect(result).toMatchObject({ deadLettered: 1, retried: 0 });
    expect(repository.snapshot('permanent-reject')).toMatchObject({
      status: 'dead_lettered',
      providerOperation: { state: 'rejected' },
    });
    expect(adapter.effects.size).toBe(0);
  });

  it('quarantines uncertain acceptance when same-key recovery is not explicitly safe', async () => {
    const repository = new MemoryDeliveryRepository([providerSeed('quarantine')]);
    const adapter = new FaultInjectingResend('accept_then_timeout');

    const first = await runProviderFaultBatch(repository, adapter, () => BASE_TIME);
    expect(first).toMatchObject({ acceptanceUnknown: 1, retried: 0 });
    expect(repository.snapshot('quarantine')).toMatchObject({
      status: 'acceptance_unknown',
      providerOperation: { state: 'acceptance_unknown' },
    });

    const second = await runProviderFaultBatch(
      repository,
      adapter,
      () => new Date(BASE_TIME.getTime() + workerOptions.claimLeaseMs * 2),
    );
    expect(second.claimed).toBe(0);
    expect(adapter.calls).toEqual(['delivery_provider_1']);
    expect(adapter.effects.size).toBe(1);
  });
});
