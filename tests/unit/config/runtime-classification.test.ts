import { describe, expect, it } from 'vitest';
import { classifyRuntime, loadConfig } from '../../../packages/config/src/index.ts';

const productionSecrets = {
  AUTH_CSRF_SECRET: 'production-runtime-classification-csrf-secret',
  MFA_SECRET_ENCRYPTION_KEY: 'production-runtime-classification-mfa-key',
};

describe('canonical runtime classification', () => {
  it.each([
    [{ nodeEnv: 'development' as const }, 'local', false, false],
    [
      { nodeEnv: 'development' as const, oneTimeRuntimeEnvironment: 'isolated_staging' as const },
      'isolated_staging',
      false,
      true,
    ],
    [{ nodeEnv: 'test' as const }, 'test', false, true],
    [
      { nodeEnv: 'test' as const, oneTimeRuntimeEnvironment: 'isolated_staging' as const },
      'isolated_staging',
      false,
      true,
    ],
    [
      { nodeEnv: 'production' as const, deliveryEnvironment: 'isolated_staging' as const },
      'isolated_staging',
      true,
      true,
    ],
    [{ nodeEnv: 'production' as const }, 'production', true, false],
  ])(
    'classifies an allowed runtime tuple %#',
    (input, environment, secureCookies, providerActions) => {
      expect(classifyRuntime(input)).toMatchObject({
        environment,
        requiresSecureCookies: secureCookies,
        allowsProviderActions: providerActions,
      });
    },
  );

  it.each([
    { nodeEnv: 'development' as const, oneTimeRuntimeEnvironment: 'production' as const },
    { nodeEnv: 'production' as const, oneTimeRuntimeEnvironment: 'local' as const },
    {
      nodeEnv: 'development' as const,
      deliveryEnvironment: 'local' as const,
      oneTimeRuntimeEnvironment: 'isolated_staging' as const,
    },
  ])('rejects a contradictory runtime tuple %#', (input) => {
    expect(() => classifyRuntime(input)).toThrow(/runtime|tuple/i);
  });

  it('requires production secrets and forbids startup migrations in non-test runtimes', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/AUTH_CSRF_SECRET/i);
    expect(() =>
      loadConfig({ NODE_ENV: 'development', RUN_MIGRATIONS_ON_STARTUP: 'true' }),
    ).toThrow(/startup migrations are limited to the test runtime/i);

    expect(
      loadConfig({ NODE_ENV: 'test', RUN_MIGRATIONS_ON_STARTUP: 'true' }).runMigrationsOnStartup,
    ).toBe(true);
  });

  it('keeps mock/demo and provider behavior fail-closed by runtime class', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        LEARNING_DELIVERY_DEMO_ENABLED: 'true',
      }),
    ).toThrow(/demo is forbidden in production/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        DELIVERY_PROVIDER_MODE: 'provider',
      }),
    ).toThrow(/provider mode requires a separate exact authorization/i);

    expect(
      loadConfig({
        NODE_ENV: 'development',
        DELIVERY_ENVIRONMENT: 'isolated_staging',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
        DELIVERY_PROVIDER_MODE: 'provider',
      }).runtime.allowsProviderActions,
    ).toBe(true);
  });
});
