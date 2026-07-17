import type {
  DeliveryEnvironment,
  DeliveryTransportMode,
} from '../../../../packages/contracts/src/delivery/types.ts';
import {
  classifyDeliveryRuntimeEnvironment,
  type DeliveryProviderMode,
  type DeliveryRuntimeEnvironment,
} from '../../../../packages/domain/src/delivery/activation-policy.ts';
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
  runtimeEnvironment: DeliveryRuntimeEnvironment;
  providerMode: DeliveryProviderMode;
  authorizationConfigured: boolean;
  stagingCanaryProofConfigured: boolean;
  resend: 'disabled' | 'configured' | 'authorized';
  wapi: 'disabled' | 'configured' | 'authorized';
  canaryEmail: 'missing' | 'configured';
  canaryWhatsApp: 'missing' | 'configured';
  allowlistedEmailDestinations: number;
  allowlistedWhatsAppDestinations: number;
  canaryBudget: number;
  perRunBudget: number;
  perProviderBudget: number;
  safeFingerprint: string;
};

const DELIVERY_ENVIRONMENTS = new Set<DeliveryEnvironment>([
  'local',
  'test',
  'isolated_staging',
  'production',
]);

const DELIVERY_TRANSPORT_MODES = new Set<DeliveryTransportMode>(['sink', 'provider']);
const DELIVERY_PROVIDER_MODES = new Set<DeliveryProviderMode>(['sink', 'mock', 'provider']);

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

  const providerModeText = text(source.DELIVERY_PROVIDER_MODE);
  const inferredTransportFallback: DeliveryTransportMode =
    providerModeText === 'provider' ? 'provider' : (options.transportMode ?? 'sink');
  const transportMode = parseTransportMode(
    text(source.DELIVERY_TRANSPORT_MODE) ?? text(source.OUTBOX_TRANSPORT_MODE),
    inferredTransportFallback,
  );
  const runtimeEnvironment = classifyDeliveryRuntimeEnvironment(
    text(source.ONE_TIME_RUNTIME_ENVIRONMENT) ?? text(source.DELIVERY_ENVIRONMENT) ?? undefined,
    text(source.NODE_ENV) ?? undefined,
  );
  const environment = parseEnvironment(
    text(source.DELIVERY_ENVIRONMENT) ?? runtimeEnvironment,
    options.environment ?? 'local',
  );
  const providerMode = providerModeValue(source.DELIVERY_PROVIDER_MODE, transportMode);
  const authorizationArtifactId = text(source.DELIVERY_PROVIDER_AUTHORIZATION_ID);
  const stagingCanaryProof = text(source.DELIVERY_STAGING_CANARY_PROOF);
  const explicitEnvironmentGate = optionalEnvironment(
    text(source.ONE_TIME_DELIVERY_PROVIDER_ENVIRONMENT_GATE),
  );
  const environmentGate =
    explicitEnvironmentGate ??
    (providerMode === 'provider' && authorizationArtifactId ? environment : null);
  const stagingIsolationProof =
    Boolean(stagingCanaryProof) ||
    bool(source.ONE_TIME_DELIVERY_STAGING_ISOLATED) ||
    bool(source.ONE_TIME_WHATSAPP_STAGING_ISOLATED);
  const transportEnabled = bool(source.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED);
  const resendEnabled = bool(source.ONE_TIME_RESEND_TRANSPORT_ENABLED);
  const resendAuthorized = bool(source.ONE_TIME_RESEND_CANARY_AUTHORIZED);
  const wapiEnabled = bool(source.ONE_TIME_WAPI_TRANSPORT_ENABLED);
  const wapiAuthorized =
    bool(source.ONE_TIME_WAPI_CANARY_AUTHORIZED) || bool(source.ONETIME_WHATSAPP_CANARY_AUTHORIZED);
  if (
    !transportEnabled &&
    (resendEnabled || wapiEnabled || resendAuthorized || wapiAuthorized || authorizationArtifactId)
  ) {
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
  const perRunBudget = boundedInteger(
    source.DELIVERY_PROVIDER_PER_RUN_BUDGET,
    canaryBudget,
    0,
    1000,
    'DELIVERY_PROVIDER_PER_RUN_BUDGET',
  );
  const perProviderBudget = boundedInteger(
    source.DELIVERY_PROVIDER_PER_PROVIDER_BUDGET,
    canaryBudget,
    0,
    1000,
    'DELIVERY_PROVIDER_PER_PROVIDER_BUDGET',
  );
  const providerTimeoutMs = boundedInteger(
    source.DELIVERY_PROVIDER_TIMEOUT_MS,
    15_000,
    1,
    120_000,
    'DELIVERY_PROVIDER_TIMEOUT_MS',
  );
  const leaseSafetyMarginMs = boundedInteger(
    source.DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS,
    5_000,
    0,
    300_000,
    'DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS',
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
    runtimeEnvironment,
    providerMode,
    authorizationConfigured: Boolean(authorizationArtifactId),
    stagingCanaryProofConfigured: Boolean(stagingCanaryProof),
    perRunBudget,
    perProviderBudget,
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
    runtimeEnvironment,
    providerMode,
    authorizationConfigured: Boolean(authorizationArtifactId),
    stagingCanaryProofConfigured: Boolean(stagingCanaryProof),
    resend: providerStatus(resendEnabled, resendAuthorized || Boolean(authorizationArtifactId)),
    wapi: providerStatus(wapiEnabled, wapiAuthorized || Boolean(authorizationArtifactId)),
    canaryEmail: canaryEmailDestination ? 'configured' : 'missing',
    canaryWhatsApp: canaryWhatsAppDestination ? 'configured' : 'missing',
    allowlistedEmailDestinations: allowlistedEmailDestinations.size,
    allowlistedWhatsAppDestinations: allowlistedWhatsAppDestinations.size,
    canaryBudget,
    perRunBudget,
    perProviderBudget,
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

function providerModeValue(value: unknown, fallbackTransportMode: DeliveryTransportMode) {
  const textValue = text(value);
  if (!textValue) return fallbackTransportMode === 'provider' ? 'provider' : 'sink';
  if (!DELIVERY_PROVIDER_MODES.has(textValue as DeliveryProviderMode)) {
    throw new Error('DELIVERY_PROVIDER_MODE must be sink, mock, or provider.');
  }
  return textValue as DeliveryProviderMode;
}
