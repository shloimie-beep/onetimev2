import type {
  DeliveryEnvironment,
  DeliveryTransportMode,
} from '../../../../packages/contracts/src/delivery/types.ts';
import { safeFingerprint } from '../../../../packages/domain/src/providers/shared.ts';

export type DeliveryProviderFeatureConfig = {
  transportMode: DeliveryTransportMode;
  environment: DeliveryEnvironment;
  environmentGate: DeliveryEnvironment | null;
  stagingIsolationProof: boolean;
  transportEnabled: boolean;
  resendEnabled: boolean;
  resendAuthorized: boolean;
  wapiEnabled: boolean;
  wapiAuthorized: boolean;
  resendWebhookEnabled: boolean;
  wapiWebhookEnabled: boolean;
  publicWhatsAppAutoreplyEnabled: boolean;
  canaryBudget: number;
  canaryEmailDestination: string | null;
  canaryWhatsAppDestination: string | null;
  allowlistedEmailDestinations: ReadonlySet<string>;
  allowlistedWhatsAppDestinations: ReadonlySet<string>;
  snapshot: DeliveryProviderReadinessSnapshot;
};

export type DeliveryProviderReadinessSnapshot = {
  configured: boolean;
  mode: DeliveryTransportMode;
  environment: DeliveryEnvironment;
  environmentGate: 'missing' | 'matched' | 'mismatched';
  stagingIsolationProof: boolean;
  productionProviderMode: 'disabled';
  resend: 'disabled' | 'configured' | 'authorized';
  wapi: 'disabled' | 'configured' | 'authorized';
  canaryEmail: 'missing' | 'configured';
  canaryWhatsApp: 'missing' | 'configured';
  allowlistedEmailDestinations: number;
  allowlistedWhatsAppDestinations: number;
  canaryBudget: number;
  safeFingerprint: string;
};

const DELIVERY_ENVIRONMENTS = new Set<DeliveryEnvironment>([
  'local',
  'test',
  'isolated_staging',
  'production',
]);

const DELIVERY_TRANSPORT_MODES = new Set<DeliveryTransportMode>(['sink', 'provider']);

const allowedKeys = new Set([
  'DELIVERY_ENVIRONMENT',
  'DELIVERY_TRANSPORT_MODE',
  'OUTBOX_TRANSPORT_MODE',
  'ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE',
  'ONE_TIME_DELIVERY_STAGING_ISOLATED',
  'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
  'ONE_TIME_RESEND_TRANSPORT_ENABLED',
  'ONE_TIME_RESEND_CANARY_AUTHORIZED',
  'ONE_TIME_WAPI_TRANSPORT_ENABLED',
  'ONE_TIME_WAPI_CANARY_AUTHORIZED',
  'ONE_TIME_RESEND_WEBHOOK_ENABLED',
  'ONE_TIME_WAPI_WEBHOOK_ENABLED',
  'ONE_TIME_PUBLIC_WHATSAPP_AUTOREPLY_ENABLED',
  'ONE_TIME_DELIVERY_TEST_CANARY_EMAIL',
  'ONE_TIME_DELIVERY_TEST_CANARY_WHATSAPP',
  'ONE_TIME_DELIVERY_EMAIL_ALLOWLIST',
  'ONE_TIME_DELIVERY_WHATSAPP_ALLOWLIST',
  'ONE_TIME_DELIVERY_CANARY_BUDGET',
  'ONE_TIME_WHATSAPP_STAGING_ISOLATED',
  'ONETIME_CANARY_WHATSAPP_RECIPIENT_E164',
  'ONETIME_WHATSAPP_CANARY_AUTHORIZED',
]);

const secretLikePattern = /\b(?:sk|rk|whsec|xoxb|bot|token|secret)[_-]?[A-Za-z0-9]{10,}/i;

export function defaultDeliveryProviderFeatureConfig(): DeliveryProviderFeatureConfig {
  return parseDeliveryProviderFeatureConfig({});
}

export function parseDeliveryProviderFeatureConfig(
  source: Record<string, unknown>,
  options: {
    transportMode?: DeliveryTransportMode;
    environment?: DeliveryEnvironment;
    allowUnknownKeys?: boolean;
  } = {},
): DeliveryProviderFeatureConfig {
  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) {
      if (options.allowUnknownKeys) continue;
      throw new Error(`Unknown delivery provider config key: ${key}`);
    }
    if (typeof value === 'string' && secretLikePattern.test(value)) {
      throw new Error(`Delivery provider config value for ${key} has a forbidden secret shape.`);
    }
  }

  const transportMode = parseTransportMode(
    text(source.DELIVERY_TRANSPORT_MODE) ?? text(source.OUTBOX_TRANSPORT_MODE),
    options.transportMode ?? 'sink',
  );
  const environment = parseEnvironment(
    text(source.DELIVERY_ENVIRONMENT),
    options.environment ?? 'local',
  );
  const environmentGate = optionalEnvironment(
    text(source.ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE),
  );
  const stagingIsolationProof =
    bool(source.ONE_TIME_DELIVERY_STAGING_ISOLATED) ||
    bool(source.ONE_TIME_WHATSAPP_STAGING_ISOLATED);
  const transportEnabled = bool(source.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED);
  const resendEnabled = bool(source.ONE_TIME_RESEND_TRANSPORT_ENABLED);
  const resendAuthorized = bool(source.ONE_TIME_RESEND_CANARY_AUTHORIZED);
  const wapiEnabled = bool(source.ONE_TIME_WAPI_TRANSPORT_ENABLED);
  const wapiAuthorized =
    bool(source.ONE_TIME_WAPI_CANARY_AUTHORIZED) || bool(source.ONETIME_WHATSAPP_CANARY_AUTHORIZED);
  if (!transportEnabled && (resendEnabled || wapiEnabled || resendAuthorized || wapiAuthorized)) {
    throw new Error('Delivery provider subfeatures require provider transport to be enabled.');
  }

  const canaryEmailDestination =
    text(source.ONE_TIME_DELIVERY_TEST_CANARY_EMAIL)?.toLowerCase() ?? null;
  const canaryWhatsAppDestination =
    text(source.ONE_TIME_DELIVERY_TEST_CANARY_WHATSAPP) ??
    text(source.ONETIME_CANARY_WHATSAPP_RECIPIENT_E164) ??
    null;
  const allowlistedEmailDestinations = new Set([
    ...emailList(source.ONE_TIME_DELIVERY_EMAIL_ALLOWLIST),
    ...(canaryEmailDestination ? [canaryEmailDestination] : []),
  ]);
  const allowlistedWhatsAppDestinations = new Set([
    ...plainList(source.ONE_TIME_DELIVERY_WHATSAPP_ALLOWLIST),
    ...(canaryWhatsAppDestination ? [canaryWhatsAppDestination] : []),
  ]);
  const canaryBudget = boundedInteger(
    source.ONE_TIME_DELIVERY_CANARY_BUDGET,
    0,
    0,
    100,
    'ONE_TIME_DELIVERY_CANARY_BUDGET',
  );
  const fingerprintSource = {
    transportMode,
    environment,
    environmentGate,
    stagingIsolationProof,
    transportEnabled,
    resendEnabled,
    resendAuthorized,
    wapiEnabled,
    wapiAuthorized,
    resendWebhookEnabled: bool(source.ONE_TIME_RESEND_WEBHOOK_ENABLED),
    wapiWebhookEnabled: bool(source.ONE_TIME_WAPI_WEBHOOK_ENABLED),
    publicWhatsAppAutoreplyEnabled: bool(source.ONE_TIME_PUBLIC_WHATSAPP_AUTOREPLY_ENABLED),
    canaryEmailConfigured: Boolean(canaryEmailDestination),
    canaryWhatsAppConfigured: Boolean(canaryWhatsAppDestination),
    allowlistedEmailDestinations: allowlistedEmailDestinations.size,
    allowlistedWhatsAppDestinations: allowlistedWhatsAppDestinations.size,
    canaryBudget,
  };
  const snapshot: DeliveryProviderReadinessSnapshot = {
    configured: transportMode === 'provider' && transportEnabled,
    mode: transportMode,
    environment,
    environmentGate:
      environmentGate === null
        ? 'missing'
        : environmentGate === environment
          ? 'matched'
          : 'mismatched',
    stagingIsolationProof,
    productionProviderMode: 'disabled',
    resend: providerStatus(resendEnabled, resendAuthorized),
    wapi: providerStatus(wapiEnabled, wapiAuthorized),
    canaryEmail: canaryEmailDestination ? 'configured' : 'missing',
    canaryWhatsApp: canaryWhatsAppDestination ? 'configured' : 'missing',
    allowlistedEmailDestinations: allowlistedEmailDestinations.size,
    allowlistedWhatsAppDestinations: allowlistedWhatsAppDestinations.size,
    canaryBudget,
    safeFingerprint: safeFingerprint(JSON.stringify(fingerprintSource)),
  };
  return {
    transportMode,
    environment,
    environmentGate,
    stagingIsolationProof,
    transportEnabled,
    resendEnabled,
    resendAuthorized,
    wapiEnabled,
    wapiAuthorized,
    resendWebhookEnabled: fingerprintSource.resendWebhookEnabled,
    wapiWebhookEnabled: fingerprintSource.wapiWebhookEnabled,
    publicWhatsAppAutoreplyEnabled: fingerprintSource.publicWhatsAppAutoreplyEnabled,
    canaryBudget,
    canaryEmailDestination,
    canaryWhatsAppDestination,
    allowlistedEmailDestinations,
    allowlistedWhatsAppDestinations,
    snapshot,
  };
}

function providerStatus(
  enabled: boolean,
  authorized: boolean,
): 'disabled' | 'configured' | 'authorized' {
  if (!enabled) return 'disabled';
  return authorized ? 'authorized' : 'configured';
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseTransportMode(
  value: string | null,
  fallback: DeliveryTransportMode,
): DeliveryTransportMode {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (!DELIVERY_TRANSPORT_MODES.has(normalized as DeliveryTransportMode)) {
    throw new Error('Delivery transport mode must be sink or provider.');
  }
  return normalized as DeliveryTransportMode;
}

function parseEnvironment(
  value: string | null,
  fallback: DeliveryEnvironment,
): DeliveryEnvironment {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (!DELIVERY_ENVIRONMENTS.has(normalized as DeliveryEnvironment)) {
    throw new Error('DELIVERY_ENVIRONMENT must be local, test, isolated_staging, or production.');
  }
  return normalized as DeliveryEnvironment;
}

function optionalEnvironment(value: string | null): DeliveryEnvironment | null {
  if (!value) return null;
  return parseEnvironment(value, 'local');
}

function emailList(value: unknown): string[] {
  return plainList(value).map((entry) => entry.toLowerCase());
}

function plainList(value: unknown): string[] {
  const raw = text(value);
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const raw = typeof value === 'number' ? String(value) : text(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}
