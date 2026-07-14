import { describe, expect, it } from 'vitest';
import { loadDeliveryWorkerConfig } from '../../../apps/worker/src/delivery/config.ts';

const baseEnv = {
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'test',
  COMMIT_SHA: 'test',
  DATABASE_URL: 'postgres://example.test/onetime',
  OUTBOX_TRANSPORT_MODE: 'sink',
};

describe('delivery worker config', () => {
  it('loads sink-only defaults from the current app config', () => {
    const config = loadDeliveryWorkerConfig(baseEnv);
    expect(config).toMatchObject({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      batchSize: 25,
      concurrency: 4,
    });
  });

  it('uses canonical standalone delivery names instead of legacy target aliases', () => {
    const config = loadDeliveryWorkerConfig({
      ...baseEnv,
      ONE_TIME_DELIVERY_OWNER_ALERT_EMAIL: 'Owner.Alert@Example.Test',
      ONE_TIME_PROTECTED_CLASS_TARGET_URL: 'https://example.test/current-class',
      ONE_TIME_OWNER_ALERT_EMAIL: 'legacy-owner@example.test',
      ONE_TIME_CURRENT_CLASS_LINK: 'https://legacy.example.test/class',
      ONE_TIME_WHATSAPP_CLASS_LINK: 'https://legacy.example.test/whatsapp',
    });
    expect(config.message).toMatchObject({
      protectedOwnerEmail: 'Owner.Alert@Example.Test',
      currentClassLink: 'https://example.test/current-class',
    });
  });

  it.each([
    { DELIVERY_TRANSPORT_MODE: 'provider' },
    { DELIVERY_TRANSPORT_MODE: 'mock' },
    { OUTBOX_TRANSPORT_MODE: 'mock' },
    { DELIVERY_PROVIDER_ACTIVATION_ENABLED: '1' },
    { ENABLE_REAL_EMAIL_TRANSPORT: 'true' },
    { ENABLE_REAL_WHATSAPP_TRANSPORT: 'true' },
  ])('fails closed for provider activation %#', (overrides) => {
    expect(() => loadDeliveryWorkerConfig({ ...baseEnv, ...overrides })).toThrow(
      /sink-only|transport mode/,
    );
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
