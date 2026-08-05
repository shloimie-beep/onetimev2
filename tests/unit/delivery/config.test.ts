import { describe, expect, it } from 'vitest';
import { loadDeliveryWorkerConfig } from '../../../apps/worker/src/delivery/config.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';

const baseEnv = {
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'test',
  COMMIT_SHA: 'test',
  DATABASE_URL: 'postgres://example.test/onetime',
  OUTBOX_TRANSPORT_MODE: 'sink',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'delivery-config-protected-payload-key',
};

describe('delivery worker config', () => {
  it('loads sink-only defaults from the current app config', () => {
    const config = loadDeliveryWorkerConfig(baseEnv);
    expect(config).toMatchObject({
      accountKey: 'one_time',
      productKey: 'one_time_mishnayos',
      transportMode: 'sink',
      provider: {
        snapshot: {
          mode: 'sink',
          environment: 'test',
          productionProviderMode: 'disabled',
        },
      },
      batchSize: 25,
      concurrency: 4,
    });
  });

  it('uses canonical standalone owner-alert names and ignores legacy class-link aliases', () => {
    const config = loadDeliveryWorkerConfig({
      ...baseEnv,
      ONE_TIME_DELIVERY_OWNER_ALERT_EMAIL: 'Owner.Alert@Example.Test',
      ONE_TIME_OWNER_ALERT_EMAIL: 'legacy-owner@example.test',
      ONE_TIME_CURRENT_CLASS_LINK: 'https://legacy.example.test/class',
      ONE_TIME_WHATSAPP_CLASS_LINK: 'https://legacy.example.test/whatsapp',
    });
    expect(config.message).toMatchObject({
      protectedOwnerEmail: 'Owner.Alert@Example.Test',
    });
    expect(config.message).not.toHaveProperty('currentClassLink');
  });

  it.each([
    { DELIVERY_TRANSPORT_MODE: 'mock' },
    { DELIVERY_PROVIDER_ACTIVATION_ENABLED: '1' },
    { ENABLE_REAL_EMAIL_TRANSPORT: 'true' },
    { ENABLE_REAL_WHATSAPP_TRANSPORT: 'true' },
    { ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true' },
  ])('fails closed for provider activation %#', (overrides) => {
    expect(() => loadDeliveryWorkerConfig({ ...baseEnv, ...overrides })).toThrow(
      /provider flags|transport mode/,
    );
  });

  it('allows production lifecycle transactional email while generic outbox delivery remains sink', () => {
    const config = loadDeliveryWorkerConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      AUTH_CSRF_SECRET: 'production-test-auth-csrf-secret-32-bytes',
      MFA_SECRET_ENCRYPTION_KEY: 'production-test-mfa-secret-32-bytes',
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'production-lifecycle-delivery-key-32-bytes',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      DELIVERY_PROVIDER_AUTHORIZATION_ID: 'auth_rabbi_day_one_email_fixture',
      DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
      DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
      RESEND_API_KEY: 'test-resend-key',
      RESEND_WEBHOOK_SECRET: 'test-resend-webhook-secret',
    });

    expect(config.transportMode).toBe('sink');
    expect(config.appConfig.lifecycleEmailMode).toBe('transactional');
    expect(config.appConfig.deliveryProviderTransportEnabled).toBe(true);
    expect(config.appConfig.resendTransportEnabled).toBe(true);
    expect(config.provider.snapshot).toMatchObject({
      mode: 'sink',
      productionProviderMode: 'disabled',
      resend: 'authorized',
    });
  });

  it('does not allow lifecycle transactional email to smuggle generic provider sends', () => {
    expect(() =>
      loadDeliveryWorkerConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        AUTH_CSRF_SECRET: 'production-test-auth-csrf-secret-32-bytes',
        MFA_SECRET_ENCRYPTION_KEY: 'production-test-mfa-secret-32-bytes',
        ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
        ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'production-lifecycle-delivery-key-32-bytes',
        ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
        ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
        ONE_TIME_RESEND_CANARY_AUTHORIZED: 'true',
        ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
        ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
        ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
        DELIVERY_PROVIDER_AUTHORIZATION_ID: 'auth_rabbi_day_one_email_fixture',
        DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
        DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
        RESEND_API_KEY: 'test-resend-key',
        RESEND_WEBHOOK_SECRET: 'test-resend-webhook-secret',
      }),
    ).toThrow(/provider flags require explicit provider transport mode/i);
  });

  it('loads explicit provider mode readiness for test canaries without defaulting to production', () => {
    const config = loadDeliveryWorkerConfig({
      ...baseEnv,
      DELIVERY_TRANSPORT_MODE: 'provider',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE: 'test',
      ONE_TIME_DELIVERY_STAGING_ISOLATED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_CANARY_AUTHORIZED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'canary@example.test',
      ONE_TIME_DELIVERY_CANARY_BUDGET: '1',
    });
    expect(config).toMatchObject({
      transportMode: 'provider',
      provider: {
        snapshot: {
          environment: 'test',
          environmentGate: 'matched',
          stagingIsolationProof: true,
          resend: 'authorized',
          canaryEmail: 'configured',
          allowlistedEmailDestinations: 1,
          canaryBudget: 1,
        },
      },
    });
  });

  it('rejects production provider mode even when flags are present', () => {
    expect(() =>
      loadDeliveryWorkerConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        DELIVERY_ENVIRONMENT: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        AUTH_CSRF_SECRET: 'production-delivery-config-csrf-secret',
        MFA_SECRET_ENCRYPTION_KEY: 'production-delivery-config-mfa-key',
        DELIVERY_TRANSPORT_MODE: 'provider',
        ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      }),
    ).toThrow(/Production delivery provider mode is disabled/);
  });

  it('requires provider timeout to stay inside the claim lease with a margin', () => {
    expect(() =>
      loadDeliveryWorkerConfig({
        ...baseEnv,
        DELIVERY_CLAIM_LEASE_MS: '10000',
        DELIVERY_PROVIDER_TIMEOUT_MS: '8000',
        DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS: '3000',
      }),
    ).toThrow(/safety margin/);
  });
});

describe('live class fake adapter config', () => {
  it('allows isolated staging previews to use the fake live adapter under production Node mode', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      DELIVERY_ENVIRONMENT: 'isolated_staging',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      AUTH_CSRF_SECRET: 'production-node-isolated-staging-csrf-secret',
      MFA_SECRET_ENCRYPTION_KEY: 'production-node-isolated-staging-mfa-key',
      LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
    });

    expect(config.liveClassFakeAdapterEnabled).toBe(true);
  });

  it('still rejects the fake live adapter in production runtime scope', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        DELIVERY_ENVIRONMENT: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        AUTH_CSRF_SECRET: 'production-runtime-csrf-secret-value',
        MFA_SECRET_ENCRYPTION_KEY: 'production-runtime-mfa-key-value',
        LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
      }),
    ).toThrow(/Live class fake adapter is forbidden in production/);
  });
});
