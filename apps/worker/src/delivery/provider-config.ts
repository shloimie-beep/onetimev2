import { safeFingerprint } from '../../../../packages/domain/src/providers/shared.ts';
import {
  classifyDeliveryRuntimeEnvironment,
  type DeliveryProviderMode,
  type DeliveryRuntimeEnvironment,
} from '../../../../packages/domain/src/delivery/activation-policy.ts';

export type DeliveryProviderFeatureConfig = {
  transportEnabled: boolean;
  resendEnabled: boolean;
  wapiEnabled: boolean;
  runtimeEnvironment: DeliveryRuntimeEnvironment;
  providerMode: DeliveryProviderMode;
  authorizationArtifactId: string | null;
  stagingCanaryProof: string | null;
  perRunBudget: number;
  perProviderBudget: number;
  providerTimeoutMs: number;
  leaseSafetyMarginMs: number;
  resendWebhookEnabled: boolean;
  wapiWebhookEnabled: boolean;
  publicWhatsAppAutoreplyEnabled: boolean;
  canaryEmailDestination: string | null;
  canaryWhatsAppDestination: string | null;
  snapshot: {
    configured: boolean;
    runtimeEnvironment: DeliveryRuntimeEnvironment;
    providerMode: DeliveryProviderMode;
    resend: 'disabled' | 'configured';
    wapi: 'disabled' | 'configured';
    canaryEmail: 'missing' | 'configured';
    canaryWhatsApp: 'missing' | 'configured';
    safeFingerprint: string;
  };
};

const allowedKeys = new Set([
  'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
  'ONE_TIME_RESEND_TRANSPORT_ENABLED',
  'ONE_TIME_WAPI_TRANSPORT_ENABLED',
  'ONE_TIME_RESEND_WEBHOOK_ENABLED',
  'ONE_TIME_WAPI_WEBHOOK_ENABLED',
  'ONE_TIME_PUBLIC_WHATSAPP_AUTOREPLY_ENABLED',
  'ONE_TIME_DELIVERY_TEST_CANARY_EMAIL',
  'ONE_TIME_DELIVERY_TEST_CANARY_WHATSAPP',
  'ONE_TIME_RUNTIME_ENVIRONMENT',
  'NODE_ENV',
  'DELIVERY_PROVIDER_MODE',
  'DELIVERY_PROVIDER_AUTHORIZATION_ID',
  'DELIVERY_STAGING_CANARY_PROOF',
  'DELIVERY_PROVIDER_PER_RUN_BUDGET',
  'DELIVERY_PROVIDER_PER_PROVIDER_BUDGET',
  'DELIVERY_PROVIDER_TIMEOUT_MS',
  'DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS',
]);

const secretLikePattern = /\b(?:sk|rk|whsec|xoxb|bot|token|secret)[_-]?[A-Za-z0-9]{10,}/i;

export function defaultDeliveryProviderFeatureConfig(): DeliveryProviderFeatureConfig {
  return parseDeliveryProviderFeatureConfig({});
}

export function parseDeliveryProviderFeatureConfig(
  source: Record<string, unknown>,
): DeliveryProviderFeatureConfig {
  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown delivery provider config key: ${key}`);
    if (typeof value === 'string' && secretLikePattern.test(value)) {
      throw new Error(`Delivery provider config value for ${key} has a forbidden secret shape.`);
    }
  }
  const transportEnabled = bool(source.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED);
  const resendEnabled = bool(source.ONE_TIME_RESEND_TRANSPORT_ENABLED);
  const wapiEnabled = bool(source.ONE_TIME_WAPI_TRANSPORT_ENABLED);
  const runtimeEnvironment = classifyDeliveryRuntimeEnvironment(
    text(source.ONE_TIME_RUNTIME_ENVIRONMENT) ?? undefined,
    text(source.NODE_ENV) ?? undefined,
  );
  const providerMode = providerModeValue(source.DELIVERY_PROVIDER_MODE);
  const authorizationArtifactId = text(source.DELIVERY_PROVIDER_AUTHORIZATION_ID);
  const stagingCanaryProof = text(source.DELIVERY_STAGING_CANARY_PROOF);
  const perRunBudget = numberValue(source.DELIVERY_PROVIDER_PER_RUN_BUDGET, 0);
  const perProviderBudget = numberValue(source.DELIVERY_PROVIDER_PER_PROVIDER_BUDGET, 0);
  const providerTimeoutMs = numberValue(source.DELIVERY_PROVIDER_TIMEOUT_MS, 15_000);
  const leaseSafetyMarginMs = numberValue(source.DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS, 5_000);
  if (!transportEnabled && (resendEnabled || wapiEnabled)) {
    throw new Error('Delivery provider subfeatures require provider transport to be enabled.');
  }
  const canaryEmailDestination =
    text(source.ONE_TIME_DELIVERY_TEST_CANARY_EMAIL)?.toLowerCase() ?? null;
  const canaryWhatsAppDestination = text(source.ONE_TIME_DELIVERY_TEST_CANARY_WHATSAPP) ?? null;
  const fingerprintSource = {
    transportEnabled,
    resendEnabled,
    wapiEnabled,
    resendWebhookEnabled: bool(source.ONE_TIME_RESEND_WEBHOOK_ENABLED),
    wapiWebhookEnabled: bool(source.ONE_TIME_WAPI_WEBHOOK_ENABLED),
    publicWhatsAppAutoreplyEnabled: bool(source.ONE_TIME_PUBLIC_WHATSAPP_AUTOREPLY_ENABLED),
    canaryEmailConfigured: Boolean(canaryEmailDestination),
    canaryWhatsAppConfigured: Boolean(canaryWhatsAppDestination),
    runtimeEnvironment,
    providerMode,
    authorizationConfigured: Boolean(authorizationArtifactId),
    stagingCanaryProofConfigured: Boolean(stagingCanaryProof),
    perRunBudget,
    perProviderBudget,
  };
  return {
    transportEnabled,
    resendEnabled,
    wapiEnabled,
    runtimeEnvironment,
    providerMode,
    authorizationArtifactId,
    stagingCanaryProof,
    perRunBudget,
    perProviderBudget,
    providerTimeoutMs,
    leaseSafetyMarginMs,
    resendWebhookEnabled: fingerprintSource.resendWebhookEnabled,
    wapiWebhookEnabled: fingerprintSource.wapiWebhookEnabled,
    publicWhatsAppAutoreplyEnabled: fingerprintSource.publicWhatsAppAutoreplyEnabled,
    canaryEmailDestination,
    canaryWhatsAppDestination,
    snapshot: {
      configured: transportEnabled,
      runtimeEnvironment,
      providerMode,
      resend: resendEnabled ? 'configured' : 'disabled',
      wapi: wapiEnabled ? 'configured' : 'disabled',
      canaryEmail: canaryEmailDestination ? 'configured' : 'missing',
      canaryWhatsApp: canaryWhatsAppDestination ? 'configured' : 'missing',
      safeFingerprint: safeFingerprint(JSON.stringify(fingerprintSource)),
    },
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

function numberValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Delivery provider budget and timeout values must be non-negative integers.');
  }
  return parsed;
}

function providerModeValue(value: unknown): DeliveryProviderMode {
  const textValue = text(value);
  if (textValue === 'mock' || textValue === 'provider') return textValue;
  return 'sink';
}
