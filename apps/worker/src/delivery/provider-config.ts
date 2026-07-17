import { safeFingerprint } from '../../../../packages/domain/src/providers/shared.ts';

export type DeliveryProviderFeatureConfig = {
  transportEnabled: boolean;
  resendEnabled: boolean;
  wapiEnabled: boolean;
  resendWebhookEnabled: boolean;
  wapiWebhookEnabled: boolean;
  publicWhatsAppAutoreplyEnabled: boolean;
  canaryEmailDestination: string | null;
  canaryWhatsAppDestination: string | null;
  snapshot: {
    configured: boolean;
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
  };
  return {
    transportEnabled,
    resendEnabled,
    wapiEnabled,
    resendWebhookEnabled: fingerprintSource.resendWebhookEnabled,
    wapiWebhookEnabled: fingerprintSource.wapiWebhookEnabled,
    publicWhatsAppAutoreplyEnabled: fingerprintSource.publicWhatsAppAutoreplyEnabled,
    canaryEmailDestination,
    canaryWhatsAppDestination,
    snapshot: {
      configured: transportEnabled,
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
