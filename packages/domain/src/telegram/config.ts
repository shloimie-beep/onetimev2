import { safeFingerprint } from '../providers/shared.ts';

export type OneTimeTelegramTransportConfig = {
  enabled: boolean;
  botKey: string;
  environment: 'local' | 'staging' | 'production';
  accountKey: string;
  productKey: string;
  tokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  ownerMappingConfigured: boolean;
  singleConsumerGate: boolean;
  canaryChatConfigured: boolean;
  webhookEnabled: boolean;
  localPollingEnabled: boolean;
  productionPollingEnabled: boolean;
  safeFingerprint: string;
};

const allowedKeys = new Set([
  'ONE_TIME_TELEGRAM_TRANSPORT_ENABLED',
  'ONE_TIME_TELEGRAM_BOT_KEY',
  'ONE_TIME_TELEGRAM_ENVIRONMENT',
  'ONE_TIME_TELEGRAM_TOKEN_CONFIGURED',
  'ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED',
  'ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED',
  'ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE',
  'ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED',
  'ONE_TIME_TELEGRAM_WEBHOOK_ENABLED',
  'ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED',
  'ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED',
]);

const forbiddenRawValue = /\d{6,}:[A-Za-z0-9_-]{20,}|https:\/\/api\.telegram\.org|chat_id|token/i;

export function parseOneTimeTelegramTransportConfig(
  source: Record<string, unknown>,
  scope: { accountKey: string; productKey: string },
): OneTimeTelegramTransportConfig {
  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown Telegram config key: ${key}`);
    if (typeof value === 'string' && forbiddenRawValue.test(value)) {
      throw new Error(`Telegram config value for ${key} has a forbidden raw-provider shape.`);
    }
  }
  const environment = environmentValue(source.ONE_TIME_TELEGRAM_ENVIRONMENT);
  const config = {
    enabled: bool(source.ONE_TIME_TELEGRAM_TRANSPORT_ENABLED),
    botKey: text(source.ONE_TIME_TELEGRAM_BOT_KEY) ?? 'one_time_internal_ops',
    environment,
    accountKey: scope.accountKey,
    productKey: scope.productKey,
    tokenConfigured: bool(source.ONE_TIME_TELEGRAM_TOKEN_CONFIGURED),
    webhookSecretConfigured: bool(source.ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED),
    ownerMappingConfigured: bool(source.ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED),
    singleConsumerGate: bool(source.ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE),
    canaryChatConfigured: bool(source.ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED),
    webhookEnabled: bool(source.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED),
    localPollingEnabled: bool(source.ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED),
    productionPollingEnabled: bool(source.ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED),
  };
  return {
    ...config,
    safeFingerprint: safeFingerprint(JSON.stringify(config)),
  };
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function environmentValue(value: unknown): OneTimeTelegramTransportConfig['environment'] {
  const raw = text(value) ?? 'staging';
  if (raw === 'local' || raw === 'staging' || raw === 'production') return raw;
  throw new Error('Telegram environment rejected.');
}
