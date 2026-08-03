import { describe, expect, it } from 'vitest';
import { runRabbiTelegramWorkerOnce } from '../../apps/telegram-bot/src/main.ts';
import { loadConfig } from '../../packages/config/src/index.ts';
import { rabbiTelegramReadiness } from '../../packages/domain/src/telegram/rabbi-runtime.ts';

describe('Rabbi Telegram executable readiness', () => {
  it('starts provider-off without protected prerequisites and does not require a database', async () => {
    const result = await runRabbiTelegramWorkerOnce({ NODE_ENV: 'test' });
    expect(result).toMatchObject({
      started: false,
      readiness: {
        status: 'provider_off',
        customerDeliveryStatus: 'provider_off',
        customerDeliveryAuthorized: false,
      },
    });
    if (result.started) throw new Error('expected provider-off');
    expect(result.readiness.blockers).toEqual(
      expect.arrayContaining([
        'runtime_disabled',
        'distinct_token_unconfigured',
        'owner_mapping_unconfigured',
        'single_consumer_gate_off',
        'distinct_payload_key_unconfigured',
      ]),
    );
  });

  it('requires a distinct fixed bot identity, key, mapping, and lease gate', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_RABBI_TELEGRAM_ENABLED: 'true',
      }),
    ).toThrow(/distinct token, owner mapping, token fingerprint, and single-consumer gate/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_RABBI_TELEGRAM_BOT_KEY: 'one_time_internal_ops',
      }),
    ).toThrow();

    const ready = rabbiTelegramReadiness(
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_RABBI_TELEGRAM_ENABLED: 'true',
        ONE_TIME_RABBI_TELEGRAM_TOKEN_CONFIGURED: 'true',
        ONE_TIME_RABBI_TELEGRAM_OWNER_MAPPING_CONFIGURED: 'true',
        ONE_TIME_RABBI_TELEGRAM_SINGLE_CONSUMER_GATE: 'true',
        ONE_TIME_RABBI_TELEGRAM_TOKEN_FINGERPRINT_HASH: 'a'.repeat(64),
        ONE_TIME_RABBI_TELEGRAM_PAYLOAD_KEY: 'distinct-rabbi-test-payload-key-do-not-use',
      }),
    );
    expect(ready).toMatchObject({
      ready: true,
      status: 'ready',
      botKey: 'one_time_rabbi_torah_console',
      customerDeliveryStatus: 'provider_off',
      customerDeliveryAuthorized: false,
    });
  });

  it('limits synthetic HighLevel mode to test or isolated staging', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ONE_TIME_RABBI_GHL_REPLY_MODE: 'synthetic',
        AUTH_CSRF_SECRET: 'production-test-csrf-secret-do-not-use-1234',
      }),
    ).toThrow(/synthetic HighLevel replies are limited/i);
  });
});
