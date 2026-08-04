import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';

const productionBase = {
  NODE_ENV: 'production',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'prod-test',
  COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
  AUTH_CSRF_SECRET: 'production-csrf-secret-with-enough-length',
  MFA_SECRET_ENCRYPTION_KEY: 'production-mfa-secret-with-enough-length',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'production-protected-payload-key',
};

describe('OT-89A support fail-closed config', () => {
  it('defaults subscriber support off in production when unconfigured', () => {
    const config = loadConfig(productionBase);
    expect(config.ot89SupportEnabled).toBe(false);
    expect(config.ot89SupportDeliveryMode).toBe('disabled');
    expect(config.ot89MockBnaEnabled).toBe(false);
  });

  it('refuses enabled support without a delivery mode', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        APP_VERSION: 'test',
        COMMIT_SHA: 'test',
        OT89_SUPPORT_ENABLED: 'true',
        OT89_SUPPORT_HMAC_KEY_ID: 'ot89-test-key',
        OT89_SUPPORT_HMAC_SECRET: 'test-secret-with-enough-length',
        OT89_BNA_TO_ONETIME_HMAC_KEY_ID: 'ot89-test-reverse-key',
        OT89_BNA_TO_ONETIME_HMAC_SECRET: 'reverse-test-secret-with-enough-length',
      }),
    ).toThrow(/cannot be enabled without a configured delivery mode/);
  });

  it('forbids production mock BNA endpoints', () => {
    expect(() =>
      loadConfig({
        ...productionBase,
        OT89_MOCK_BNA_ENABLED: 'true',
        OT89_SUPPORT_HMAC_KEY_ID: 'prod-onetime-key',
        OT89_SUPPORT_HMAC_SECRET: 'prod-onetime-secret-with-enough-length',
        OT89_BNA_TO_ONETIME_HMAC_KEY_ID: 'prod-bna-key',
        OT89_BNA_TO_ONETIME_HMAC_SECRET: 'prod-bna-secret-with-enough-length',
      }),
    ).toThrow(/mock BNA endpoint is forbidden/);
  });

  it('forbids known OT89 test HMAC defaults in production', () => {
    expect(() =>
      loadConfig({
        ...productionBase,
        OT89_SUPPORT_HMAC_KEY_ID: 'ot89-onetime-local',
        OT89_SUPPORT_HMAC_SECRET: 'ot89-test-secret-do-not-use-local-producer',
        OT89_BNA_TO_ONETIME_HMAC_KEY_ID: 'ot89-bna-local',
        OT89_BNA_TO_ONETIME_HMAC_SECRET: 'ot89-test-secret-do-not-use-local-consumer',
      }),
    ).toThrow(/test HMAC defaults are forbidden/);
  });
});
