import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';

const productionSecrets = {
  AUTH_CSRF_SECRET: 'production-verification-scope-csrf-secret',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'production-verification-scope-payload-key',
};

describe('v2.1 verification-environment runtime binding', () => {
  it('derives deterministic fail-safe defaults for local, staging, and production', () => {
    expect(loadConfig({ NODE_ENV: 'test' })).toMatchObject({
      oneTimeRuntimeTier: 'isolated_staging',
      oneTimeVerificationEnvironmentId: 'ci',
      oneTimeVerificationWritesAllowed: true,
    });
    expect(
      loadConfig({
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
        ...productionSecrets,
      }),
    ).toMatchObject({
      oneTimeRuntimeTier: 'isolated_staging',
      oneTimeVerificationEnvironmentId: 'persistent_staging',
      oneTimeVerificationWritesAllowed: true,
    });
    expect(
      loadConfig({
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ...productionSecrets,
      }),
    ).toMatchObject({
      oneTimeRuntimeTier: 'production',
      oneTimeVerificationEnvironmentId: 'production_read_only',
      oneTimeVerificationWritesAllowed: false,
    });
  });

  it('accepts an exact environment only inside its canonical runtime tier', () => {
    expect(
      loadConfig({
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
        ...productionSecrets,
      }),
    ).toMatchObject({
      oneTimeRuntimeTier: 'production',
      oneTimeVerificationEnvironmentId: 'production_operator_canary',
      oneTimeVerificationWritesAllowed: true,
    });

    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'ci',
        ...productionSecrets,
      }),
    ).toThrow(/does not belong to the configured One Time runtime tier/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
      }),
    ).toThrow(/does not belong to the configured One Time runtime tier/i);
  });

  it('rejects unknown verification-environment identifiers', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'staging-ish',
      }),
    ).toThrow();
  });
});
