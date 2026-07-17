import { loadConfig, type AppConfig } from '../../../../packages/config/src/index.ts';
import type { DeliveryTransportMode } from '../../../../packages/contracts/src/delivery/types.ts';
import type { DeliveryMessageConfig } from '../../../../packages/domain/src/delivery/messages.ts';
import {
  parseDeliveryProviderFeatureConfig,
  type DeliveryProviderFeatureConfig,
} from './provider-config.ts';

export type DeliveryWorkerConfig = {
  appConfig: AppConfig;
  accountKey: string;
  productKey: string;
  transportMode: DeliveryTransportMode;
  provider: DeliveryProviderFeatureConfig;
  batchSize: number;
  concurrency: number;
  claimLeaseMs: number;
  providerTimeoutMs: number;
  providerTimeoutLeaseSafetyMs: number;
  pollIntervalMs: number;
  maxAttempts: number;
  message: DeliveryMessageConfig;
};

function booleanValue(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function loadDeliveryWorkerConfig(source: NodeJS.ProcessEnv): DeliveryWorkerConfig {
  const appConfig = loadConfig(source);
  const requestedMode = (
    source.DELIVERY_TRANSPORT_MODE ??
    source.OUTBOX_TRANSPORT_MODE ??
    appConfig.outboxTransportMode
  ).toLowerCase();
  if (requestedMode !== 'sink' && requestedMode !== 'provider') {
    throw new Error('Delivery worker transport mode must be sink or provider.');
  }
  const transportMode = requestedMode as DeliveryTransportMode;
  const provider = parseDeliveryProviderFeatureConfig(source, {
    transportMode,
    environment: appConfig.deliveryEnvironment,
    allowUnknownKeys: true,
  });
  const providerFlagsWithoutProviderMode =
    transportMode === 'sink' &&
    (provider.transportEnabled ||
      provider.resendEnabled ||
      provider.wapiEnabled ||
      provider.resendAuthorized ||
      provider.wapiAuthorized ||
      booleanValue(source.DELIVERY_PROVIDER_ACTIVATION_ENABLED) ||
      booleanValue(source.ENABLE_REAL_EMAIL_TRANSPORT) ||
      booleanValue(source.ENABLE_REAL_WHATSAPP_TRANSPORT) ||
      booleanValue(source.ENABLE_REAL_TELEGRAM_TRANSPORT) ||
      booleanValue(source.ENABLE_PAYMENT_TRANSPORT));

  if (providerFlagsWithoutProviderMode) {
    throw new Error('Delivery provider flags require explicit provider transport mode.');
  }
  if (transportMode === 'provider' && appConfig.deliveryEnvironment === 'production') {
    throw new Error('Production delivery provider mode is disabled pending a reviewed release.');
  }
  if (!appConfig.databaseUrl) {
    throw new Error('DATABASE_URL is required by the delivery worker.');
  }

  const claimLeaseMs = boundedInteger(
    source.DELIVERY_CLAIM_LEASE_MS,
    120_000,
    5_000,
    900_000,
    'DELIVERY_CLAIM_LEASE_MS',
  );
  const providerTimeoutMs = boundedInteger(
    source.DELIVERY_PROVIDER_TIMEOUT_MS,
    15_000,
    100,
    120_000,
    'DELIVERY_PROVIDER_TIMEOUT_MS',
  );
  const providerTimeoutLeaseSafetyMs = boundedInteger(
    source.DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS,
    5_000,
    1_000,
    300_000,
    'DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS',
  );

  if (providerTimeoutMs + providerTimeoutLeaseSafetyMs >= claimLeaseMs) {
    throw new Error(
      'DELIVERY_PROVIDER_TIMEOUT_MS plus safety margin must be less than DELIVERY_CLAIM_LEASE_MS.',
    );
  }

  const emailReplyTo = optionalValue(source.ONE_TIME_EMAIL_REPLY_TO);
  const protectedOwnerEmail = optionalValue(source.ONE_TIME_DELIVERY_OWNER_ALERT_EMAIL);

  return {
    appConfig,
    accountKey: appConfig.accountKey,
    productKey: appConfig.productKey,
    transportMode,
    provider,
    batchSize: boundedInteger(
      source.DELIVERY_WORKER_BATCH_SIZE,
      25,
      1,
      100,
      'DELIVERY_WORKER_BATCH_SIZE',
    ),
    concurrency: boundedInteger(
      source.DELIVERY_WORKER_CONCURRENCY,
      4,
      1,
      25,
      'DELIVERY_WORKER_CONCURRENCY',
    ),
    claimLeaseMs,
    providerTimeoutMs,
    providerTimeoutLeaseSafetyMs,
    pollIntervalMs: boundedInteger(
      source.DELIVERY_POLL_INTERVAL_MS,
      15_000,
      250,
      300_000,
      'DELIVERY_POLL_INTERVAL_MS',
    ),
    maxAttempts: boundedInteger(source.DELIVERY_MAX_ATTEMPTS, 5, 1, 20, 'DELIVERY_MAX_ATTEMPTS'),
    message: {
      emailFrom:
        optionalValue(source.ONE_TIME_EMAIL_FROM) ??
        'One Time Mishnayos <delivery@onetime.invalid>',
      ...(emailReplyTo ? { emailReplyTo } : {}),
      ...(protectedOwnerEmail ? { protectedOwnerEmail } : {}),
    },
  };
}
