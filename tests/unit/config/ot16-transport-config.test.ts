import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';

const OPERATION_A = 'a'.repeat(64);
const OPERATION_B = 'b'.repeat(64);

describe('OT-16 exact transport authorization', () => {
  it('defaults off with no allowlist or provider budget', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test.invalid/onetime',
    });

    expect(config.oneTimeOt16TransportMode).toBe('disabled');
    expect(config.oneTimeOt16AuthorizationId).toBeUndefined();
    expect(config.oneTimeOt16CanaryOperationIds).toEqual([]);
    expect(config.oneTimeOt16PerRunBudget).toBe(0);
  });

  it('admits only one or two exact canary operation identities within the bounded budget', () => {
    const config = loadConfig({
      ...base(),
      ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
      ONE_TIME_OT16_CANARY_OPERATION_IDS: `${OPERATION_A},${OPERATION_B}`,
      ONE_TIME_OT16_PER_RUN_BUDGET: '2',
    });

    expect(config.oneTimeOt16TransportMode).toBe('canary');
    expect(config.oneTimeOt16CanaryOperationIds).toEqual([OPERATION_A, OPERATION_B]);
    expect(config.oneTimeOt16PerRunBudget).toBe(2);
    expect(() =>
      loadConfig({
        ...base(),
        ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
        ONE_TIME_OT16_CANARY_OPERATION_IDS: 'not-a-sha256',
        ONE_TIME_OT16_PER_RUN_BUDGET: '1',
      }),
    ).toThrow('one or two exact SHA-256 operation IDs');
    expect(() =>
      loadConfig({
        ...base(),
        ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
        ONE_TIME_OT16_CANARY_OPERATION_IDS: `${OPERATION_A},${OPERATION_B}`,
        ONE_TIME_OT16_PER_RUN_BUDGET: '1',
      }),
    ).toThrow('one or two exact SHA-256 operation IDs');
  });

  it('requires a distinct exact authorization and removes the canary allowlist for broad mode', () => {
    const broad = loadConfig({
      ...base(),
      ONE_TIME_OT16_TRANSPORT_MODE: 'broad',
      ONE_TIME_OT16_PER_RUN_BUDGET: '20',
    });
    expect(broad.oneTimeOt16TransportMode).toBe('broad');
    expect(broad.oneTimeOt16AuthorizationId).toBe('test-ot16-authorization');
    expect(broad.oneTimeOt16CanaryOperationIds).toEqual([]);

    expect(() =>
      loadConfig({
        ...base(),
        ONE_TIME_OT16_TRANSPORT_MODE: 'broad',
        ONE_TIME_OT16_CANARY_OPERATION_IDS: OPERATION_A,
        ONE_TIME_OT16_PER_RUN_BUDGET: '20',
      }),
    ).toThrow('cannot retain a canary operation allowlist');
    expect(() =>
      loadConfig({
        ...base(),
        ONE_TIME_OT16_TRANSPORT_MODE: 'broad',
        ONE_TIME_OT16_AUTHORIZATION_ID: '',
        ONE_TIME_OT16_PER_RUN_BUDGET: '20',
      }),
    ).toThrow('exact authorization ID');
  });

  it('admits an exact production-operator canary without opening the general delivery provider', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      AUTH_CSRF_SECRET: 'production-ot16-csrf-secret-32-characters-minimum',
      PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'production-ot16-payload-key-32-characters-minimum',
      ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-08-31T20:59:59.000Z',
      HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'production-provider-token-placeholder',
      ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
      ONE_TIME_OT16_AUTHORIZATION_ID: 'production-ot16-canary-authorization',
      ONE_TIME_OT16_CANARY_OPERATION_IDS: OPERATION_A,
      ONE_TIME_OT16_PER_RUN_BUDGET: '1',
    });

    expect(config.deliveryProviderMode).toBe('sink');
    expect(config.oneTimeOt16TransportMode).toBe('canary');
    expect(config.oneTimeVerificationEnvironmentId).toBe('production_operator_canary');
    expect(config.oneTimeVerificationWritesAllowed).toBe(true);
  });
});

function base() {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://test.invalid/onetime',
    HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
    ONE_TIME_OT16_AUTHORIZATION_ID: 'test-ot16-authorization',
  };
}
