import { describe, expect, it } from 'vitest';
import {
  classifyRuntime,
  loadConfig,
  type OneTimeRuntimeEnvironment,
} from '../../../packages/config/src/index.ts';

type NodeEnvironment = 'development' | 'test' | 'production';

const productionSecrets = {
  AUTH_CSRF_SECRET: 'production-runtime-classification-csrf-secret',
  MFA_SECRET_ENCRYPTION_KEY: 'production-runtime-classification-mfa-key',
};

const allowedTuples = [
  ['development', 'local', false, false, true],
  ['development', 'isolated_staging', false, true, true],
  ['test', 'test', false, true, true],
  ['test', 'isolated_staging', false, true, true],
  ['production', 'isolated_staging', true, true, true],
  ['production', 'production', true, false, false],
] as const satisfies ReadonlyArray<
  readonly [NodeEnvironment, OneTimeRuntimeEnvironment, boolean, boolean, boolean]
>;

const allNodeEnvironments = ['development', 'test', 'production'] as const;
const allRuntimeEnvironments = ['local', 'test', 'isolated_staging', 'production'] as const;
const allowedKeys = new Set(allowedTuples.map(([nodeEnv, runtime]) => `${nodeEnv}:${runtime}`));
const forbiddenTuples = allNodeEnvironments.flatMap((nodeEnv) =>
  allRuntimeEnvironments
    .filter((runtime) => !allowedKeys.has(`${nodeEnv}:${runtime}`))
    .map((runtime) => [nodeEnv, runtime] as const),
);

describe('canonical runtime classification', () => {
  it.each(allowedTuples)(
    'allows NODE_ENV=%s with runtime=%s through either alias or matching aliases',
    (nodeEnv, environment, secureCookies, providerActions, mockOrDemo) => {
      const expected = {
        environment,
        isProductionRuntime: environment === 'production',
        requiresSecureCookies: secureCookies,
        allowsProviderActions: providerActions,
        allowsMockOrDemo: mockOrDemo,
        allowsStartupMigrations: environment === 'test',
      };
      expect(classifyRuntime({ nodeEnv, deliveryEnvironment: environment })).toEqual(expected);
      expect(classifyRuntime({ nodeEnv, oneTimeRuntimeEnvironment: environment })).toEqual(
        expected,
      );
      expect(
        classifyRuntime({
          nodeEnv,
          deliveryEnvironment: environment,
          oneTimeRuntimeEnvironment: environment,
        }),
      ).toEqual(expected);
    },
  );

  it.each(forbiddenTuples)(
    'rejects NODE_ENV=%s with runtime=%s through either alias',
    (nodeEnv, runtime) => {
      expect(() => classifyRuntime({ nodeEnv, deliveryEnvironment: runtime })).toThrow(
        /Invalid runtime tuple/i,
      );
      expect(() => classifyRuntime({ nodeEnv, oneTimeRuntimeEnvironment: runtime })).toThrow(
        /Invalid runtime tuple/i,
      );
    },
  );

  it.each([
    ['development', 'local'],
    ['test', 'test'],
    ['production', 'production'],
  ] as const)('uses the only canonical default for NODE_ENV=%s', (nodeEnv, environment) => {
    expect(classifyRuntime({ nodeEnv }).environment).toBe(environment);
  });

  it.each(allNodeEnvironments)(
    'rejects mismatched delivery and One Time aliases before classifying NODE_ENV=%s',
    (nodeEnv) => {
      expect(() =>
        classifyRuntime({
          nodeEnv,
          deliveryEnvironment: 'test',
          oneTimeRuntimeEnvironment: 'isolated_staging',
        }),
      ).toThrow(
        'DELIVERY_ENVIRONMENT and ONE_TIME_RUNTIME_ENVIRONMENT must name the same runtime.',
      );
    },
  );

  it('rejects the former test-plus-production fallback-secret escape hatch', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        DELIVERY_ENVIRONMENT: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ENABLE_REAL_EMAIL_TRANSPORT: 'true',
      }),
    ).toThrow(/Invalid runtime tuple/i);
  });

  it('derives production secrets and fallback behavior from the canonical runtime class', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/AUTH_CSRF_SECRET/i);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', AUTH_CSRF_SECRET: productionSecrets.AUTH_CSRF_SECRET }),
    ).toThrow(/MFA_SECRET_ENCRYPTION_KEY/i);

    const production = loadConfig({ NODE_ENV: 'production', ...productionSecrets });
    expect(production).toMatchObject({
      isProduction: true,
      authCsrfSecret: productionSecrets.AUTH_CSRF_SECRET,
      mfaSecretEncryptionKey: productionSecrets.MFA_SECRET_ENCRYPTION_KEY,
      lifecycleDeliveryKey: undefined,
      liveClassObsBridgeToken: undefined,
      ot89SupportHmacKeyId: '',
      ot89SupportHmacSecret: '',
      ot89BnaToOnetimeHmacKeyId: '',
      ot89BnaToOnetimeHmacSecret: '',
    });
  });

  it('derives production webhook, mock, and test-secret guards from the canonical runtime class', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      }),
    ).toThrow(/RESEND_WEBHOOK_SECRET/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        ONE_TIME_TELEGRAM_WEBHOOK_ENABLED: 'true',
      }),
    ).toThrow(/ONE_TIME_TELEGRAM_WEBHOOK_SECRET/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        OT89_MOCK_BNA_ENABLED: 'true',
      }),
    ).toThrow(/mock BNA endpoint is forbidden in production/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...productionSecrets,
        OT89_SUPPORT_HMAC_KEY_ID: 'ot89-onetime-local',
      }),
    ).toThrow(/Known OT89 test HMAC defaults are forbidden in production/i);
  });

  it('derives startup migration, provider, and mock/demo gates from the canonical class', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'development', RUN_MIGRATIONS_ON_STARTUP: 'true' }),
    ).toThrow(/startup migrations are limited to the test runtime/i);
    expect(
      loadConfig({ NODE_ENV: 'test', RUN_MIGRATIONS_ON_STARTUP: 'true' }).runMigrationsOnStartup,
    ).toBe(true);
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
