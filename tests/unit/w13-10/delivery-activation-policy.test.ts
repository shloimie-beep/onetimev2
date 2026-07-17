import { describe, expect, it } from 'vitest';
import { providerError } from '../../../packages/contracts/src/delivery/errors.ts';
import {
  InMemoryDeliveryProviderBudget,
  evaluateProviderActivationPolicy,
  providerAttemptIdempotencyKey,
} from '../../../packages/domain/src/delivery/activation-policy.ts';
import { parseDeliveryProviderFeatureConfig } from '../../../apps/worker/src/delivery/provider-config.ts';
import { OneTimeProviderDeliveryRouter } from '../../../apps/worker/src/delivery/provider-router.ts';

const baseRequest = {
  channel: 'email',
  provider: 'resend',
  recipientClass: 'public',
  idempotencyKey: 'delivery_w13_10',
  from: 'One Time <delivery@example.test>',
  to: 'owner@example.test',
  subject: 'Test',
  text: 'Hello',
  html: '<p>Hello</p>',
  tags: [],
} as const;

const context = {
  deliveryKey: 'delivery_w13_10',
  attempt: 2,
  signal: new AbortController().signal,
};

function providerConfig(overrides: Record<string, string> = {}) {
  return parseDeliveryProviderFeatureConfig({
    NODE_ENV: 'test',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    DELIVERY_PROVIDER_MODE: 'provider',
    DELIVERY_PROVIDER_AUTHORIZATION_ID: 'auth_w13_10',
    DELIVERY_STAGING_CANARY_PROOF: 'proof_w13_10',
    DELIVERY_PROVIDER_PER_RUN_BUDGET: '2',
    DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '2',
    ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
    ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
    ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'owner@example.test',
    ...overrides,
  });
}

describe('W13-10 delivery activation policy', () => {
  it('keeps sink/provider-off as the default and does not invoke adapters', async () => {
    let adapterCalls = 0;
    const router = new OneTimeProviderDeliveryRouter(parseDeliveryProviderFeatureConfig({}), {
      resend: {
        sendEmail: async () => {
          adapterCalls += 1;
          return { messageId: 'unused' };
        },
      },
    });

    await expect(router.send(baseRequest, context)).rejects.toThrow(/provider_transport_disabled/);
    expect(adapterCalls).toBe(0);
  });

  it('requires isolated-staging proof before a canary provider call', async () => {
    const router = new OneTimeProviderDeliveryRouter(
      providerConfig({ DELIVERY_STAGING_CANARY_PROOF: '' }),
      {
        resend: {
          sendEmail: async () => ({ messageId: 'unused' }),
        },
      },
    );

    await expect(router.send(baseRequest, context)).rejects.toThrow(
      /isolated_staging_proof_missing/,
    );
  });

  it('rejects production provider activation even with other fields present', () => {
    const budget = new InMemoryDeliveryProviderBudget({ perRunLimit: 1, perProviderLimit: 1 });
    const decision = evaluateProviderActivationPolicy(
      {
        provider: 'resend',
        requestProvider: 'resend',
        providerMode: 'provider',
        runtimeEnvironment: 'production',
        transportEnabled: true,
        isolatedStagingProof: 'proof',
        authorization: { artifactId: 'auth', provider: 'resend', environment: 'production' },
        destinationRef: 'resend:configured-canary',
        allowlistedDestinationRef: 'resend:configured-canary',
        idempotencyKey: 'delivery_w13_10',
        consent: { required: true, granted: true, suppressionState: 'active' },
        timeoutMs: 1_000,
        leaseMsRemaining: 10_000,
        leaseSafetyMarginMs: 1_000,
        auditContext: {
          deliveryKey: 'delivery_w13_10',
          eventType: 'family_signup_email_ack.v1',
          channel: 'email',
        },
      },
      budget,
    );

    expect(decision.readiness).toBe('blocked');
    expect(decision.blockerCodes).toContain('production_authorization_missing');
  });

  it('enforces allowlisted destinations and budget before adapter invocation', async () => {
    let adapterCalls = 0;
    const router = new OneTimeProviderDeliveryRouter(providerConfig(), {
      resend: {
        sendEmail: async () => {
          adapterCalls += 1;
          return { messageId: 'unused' };
        },
      },
    });

    await expect(
      router.send({ ...baseRequest, to: 'other@example.test' }, context),
    ).rejects.toThrow(/allowlisted_destination_missing/);
    expect(adapterCalls).toBe(0);
  });

  it('preserves idempotency and exhausts bounded budgets deterministically', async () => {
    const idempotencyKeys: string[] = [];
    const router = new OneTimeProviderDeliveryRouter(
      providerConfig({
        DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
        DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
      }),
      {
        resend: {
          sendEmail: async (_request, options) => {
            idempotencyKeys.push(options.idempotencyKey);
            return { messageId: 'message_1' };
          },
        },
      },
    );

    await expect(router.send(baseRequest, context)).resolves.toMatchObject({
      provider: 'resend',
      sink: false,
    });
    await expect(router.send(baseRequest, context)).rejects.toThrow(/budget_exhausted/);
    expect(idempotencyKeys).toEqual([providerAttemptIdempotencyKey('delivery_w13_10', 2)]);
  });

  it('reports consent, suppression, lease, and audit blockers as typed codes', () => {
    const budget = new InMemoryDeliveryProviderBudget({ perRunLimit: 1, perProviderLimit: 1 });
    const decision = evaluateProviderActivationPolicy(
      {
        provider: 'resend',
        requestProvider: 'resend',
        providerMode: 'provider',
        runtimeEnvironment: 'isolated_staging',
        transportEnabled: true,
        isolatedStagingProof: 'proof',
        authorization: { artifactId: 'auth', provider: 'resend', environment: 'isolated_staging' },
        destinationRef: 'resend:configured-canary',
        allowlistedDestinationRef: 'resend:configured-canary',
        idempotencyKey: null,
        consent: { required: true, granted: false, suppressionState: 'unsubscribed' },
        timeoutMs: 9_000,
        leaseMsRemaining: 10_000,
        leaseSafetyMarginMs: 2_000,
        auditContext: null,
      },
      budget,
    );

    expect(decision.readiness).toBe('blocked');
    expect(decision.blockerCodes).toEqual(
      expect.arrayContaining([
        'idempotency_key_missing',
        'suppression_active',
        'consent_missing',
        'timeout_exceeds_lease_margin',
        'audit_context_missing',
      ]),
    );
    expect(JSON.stringify(decision)).not.toContain('owner@example.test');
  });

  it('keeps router blocker codes compatible with retry classification', () => {
    const error = providerError('budget_exhausted', {
      retryable: false,
      provider: 'resend',
    });
    expect(error.failure).toMatchObject({ code: 'budget_exhausted', category: 'permanent' });
  });
});
