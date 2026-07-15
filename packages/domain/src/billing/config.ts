import { createHash } from 'node:crypto';
import {
  billingModeSchema,
  billingOfferPriceMappingSchema,
  type BillingFeatureConfig,
  type BillingMode,
  type BillingOfferPriceMapping,
} from './types.ts';
import { OT87_PLAN_TRUTH, loadOt87CommercialPolicy } from './commercial-policy.ts';

export type BillingConfigSource = Record<string, unknown>;

export type BillingConfigErrorCode =
  | 'UNKNOWN_KEY'
  | 'LEGACY_ALIAS'
  | 'LIVE_MODE'
  | 'LIVE_LIKE_SECRET'
  | 'MODE_MISMATCH'
  | 'MALFORMED_ORIGIN'
  | 'TRANSPORT_DISABLED'
  | 'INVALID_OFFER_MAPPING'
  | 'LIVE_GUARD_REQUIRED'
  | 'INVALID_TEST_SECRET'
  | 'INVALID_EMERGENCY_MODE';

export class BillingConfigError extends Error {
  constructor(
    readonly code: BillingConfigErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const allowedKeys = new Set([
  'ONE_TIME_BILLING_FOUNDATION_ENABLED',
  'ONE_TIME_BILLING_TRANSPORT_ENABLED',
  'ONE_TIME_BILLING_CHECKOUT_ENABLED',
  'ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED',
  'ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED',
  'ONE_TIME_BILLING_RECONCILIATION_ENABLED',
  'ONE_TIME_BILLING_MODE',
  'ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN',
  'ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF',
  'ONE_TIME_BILLING_OFFERS_JSON',
]);

const legacyAliasPattern = /^(STRIPE_|RABBI_STRIPE_|BNA_STRIPE_|ENABLE_PAYMENT_TRANSPORT$)/i;
const liveLikePattern =
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|\bwhsec_[A-Za-z0-9]{12,}|\blivemode\b/i;

export function defaultBillingFeatureConfig(): BillingFeatureConfig {
  return {
    foundationEnabled: false,
    transportEnabled: false,
    checkoutEnabled: false,
    customerPortalEnabled: false,
    webhookIntakeEnabled: false,
    reconciliationEnabled: false,
    webhookProjectionEnabled: true,
    mode: 'test',
    canonicalPublicOrigin: null,
    expectedProviderAccountRef: null,
    offerMappings: [],
    policyId: 'ot46-billing-policy-v1',
    policyVersion: 'ot46-billing-policy-v1',
    planTruth: OT87_PLAN_TRUTH,
    entitlementEmergencyMode: 'normal',
    providerPortalConfigurationRef: null,
    configFingerprint: fingerprint({}),
  };
}

export function parseBillingFeatureConfig(source: BillingConfigSource): BillingFeatureConfig {
  for (const [key, value] of Object.entries(source)) {
    if (legacyAliasPattern.test(key)) {
      throw new BillingConfigError(
        'LEGACY_ALIAS',
        `Legacy billing configuration key rejected: ${key}`,
      );
    }
    if (!allowedKeys.has(key)) {
      throw new BillingConfigError('UNKNOWN_KEY', `Unknown billing configuration key: ${key}`);
    }
    if (typeof value === 'string' && liveLikePattern.test(value)) {
      throw new BillingConfigError(
        'LIVE_LIKE_SECRET',
        `Billing configuration value for ${key} has a forbidden secret-like shape.`,
      );
    }
  }

  const mode = parseMode(source.ONE_TIME_BILLING_MODE);
  const transportEnabled = bool(source.ONE_TIME_BILLING_TRANSPORT_ENABLED);
  const checkoutEnabled = bool(source.ONE_TIME_BILLING_CHECKOUT_ENABLED);
  const customerPortalEnabled = bool(source.ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED);
  const webhookIntakeEnabled = bool(source.ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED);
  const reconciliationEnabled = bool(source.ONE_TIME_BILLING_RECONCILIATION_ENABLED);

  if (!transportEnabled && (checkoutEnabled || customerPortalEnabled || webhookIntakeEnabled)) {
    throw new BillingConfigError(
      'TRANSPORT_DISABLED',
      'Billing subfeatures cannot be enabled while billing transport is disabled.',
    );
  }

  if (mode !== 'test') {
    throw new BillingConfigError('LIVE_MODE', 'Only test billing mode is accepted in this slice.');
  }

  const canonicalPublicOrigin = parseOrigin(source.ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN);
  const offerMappings = parseOfferMappings(source.ONE_TIME_BILLING_OFFERS_JSON, mode);
  const expectedProviderAccountRef = text(source.ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF);

  if (expectedProviderAccountRef?.toLowerCase().includes('live')) {
    throw new BillingConfigError(
      'LIVE_LIKE_SECRET',
      'Expected billing provider account reference has a forbidden live-like shape.',
    );
  }

  return {
    foundationEnabled: bool(source.ONE_TIME_BILLING_FOUNDATION_ENABLED),
    transportEnabled,
    checkoutEnabled,
    customerPortalEnabled,
    webhookIntakeEnabled,
    reconciliationEnabled,
    webhookProjectionEnabled: true,
    mode,
    canonicalPublicOrigin,
    expectedProviderAccountRef,
    offerMappings,
    policyId: 'ot46-billing-policy-v1',
    policyVersion: 'ot46-billing-policy-v1',
    planTruth: OT87_PLAN_TRUTH,
    entitlementEmergencyMode: 'normal',
    providerPortalConfigurationRef: null,
    configFingerprint: fingerprint(sanitizedSource(source)),
  };
}

export type Ot87BillingRuntimeSecrets = {
  secretKey: string | null;
  webhookSecret: string | null;
};

export function parseOt87StripeTestBillingConfig(
  source: BillingConfigSource,
  defaults: {
    accountKey: string;
    productKey: string;
    canonicalPublicOrigin: string;
  },
): BillingFeatureConfig {
  const policy = loadOt87CommercialPolicy();
  const liveGuard = text(source.LIVE_STRIPE_CHARGES_AUTHORIZED);
  const transportEnabled = bool(source.ENABLE_PAYMENT_TRANSPORT);
  const checkoutEnabled = bool(source.ENABLE_STRIPE_TEST_CHECKOUT);
  const customerPortalEnabled = bool(source.ENABLE_STRIPE_TEST_PORTAL);
  const webhookIntakeEnabled = bool(source.ENABLE_STRIPE_TEST_WEBHOOKS);
  const reconciliationEnabled = bool(source.ENABLE_STRIPE_TEST_RECONCILIATION);
  const webhookProjectionEnabled = !falseLike(source.ENABLE_STRIPE_TEST_WEBHOOK_PROJECTION);
  const anyTransportSurface =
    transportEnabled ||
    checkoutEnabled ||
    customerPortalEnabled ||
    webhookIntakeEnabled ||
    reconciliationEnabled;

  if (anyTransportSurface && liveGuard !== 'NO') {
    throw new BillingConfigError(
      'LIVE_GUARD_REQUIRED',
      'LIVE_STRIPE_CHARGES_AUTHORIZED must exactly equal NO before Stripe test transport is enabled.',
    );
  }
  if (!transportEnabled && (checkoutEnabled || customerPortalEnabled || webhookIntakeEnabled)) {
    throw new BillingConfigError(
      'TRANSPORT_DISABLED',
      'Stripe test subfeatures cannot be enabled while payment transport is disabled.',
    );
  }

  const emergencyMode = text(source.ONE_TIME_ENTITLEMENT_EMERGENCY_MODE) ?? 'normal';
  if (emergencyMode !== 'normal' && emergencyMode !== 'deny_all') {
    throw new BillingConfigError(
      'INVALID_EMERGENCY_MODE',
      'Entitlement emergency mode must be normal or deny_all.',
    );
  }

  const secretKey = text(source.ONE_TIME_STRIPE_TEST_SECRET_KEY);
  if (secretKey && !/^sk_test_[A-Za-z0-9_]+$/.test(secretKey)) {
    throw new BillingConfigError(
      'INVALID_TEST_SECRET',
      'Stripe test secret key must use the sk_test_ test-mode shape.',
    );
  }

  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === 'string' &&
      /_(?:live)_|\blivemode\b|pk_live_|sk_live_|rk_live_/i.test(value)
    ) {
      throw new BillingConfigError(
        'LIVE_LIKE_SECRET',
        `Stripe test billing configuration value for ${key} has a forbidden live-like shape.`,
      );
    }
  }

  const providerAccountRef = text(source.ONE_TIME_STRIPE_TEST_ACCOUNT_ID);
  const providerPriceRef = text(source.ONE_TIME_STRIPE_TEST_PRICE_ID);
  const providerPortalConfigurationRef = text(source.ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID);
  const offerMappings =
    providerAccountRef && providerPriceRef
      ? [
          {
            account_key: defaults.accountKey,
            product_key: defaults.productKey,
            offer_key: policy.offer.offer_key,
            provider: 'stripe' as const,
            mode: 'test' as const,
            provider_account_ref: providerAccountRef,
            provider_price_ref: providerPriceRef,
            currency: policy.offer.currency,
            amount_cents: policy.offer.unit_amount_cents,
            synthetic: false,
          },
        ]
      : [];

  for (const offer of offerMappings) {
    const parsed = billingOfferPriceMappingSchema.safeParse(offer);
    if (!parsed.success) {
      throw new BillingConfigError(
        'INVALID_OFFER_MAPPING',
        'OT-87 Stripe test offer mapping failed validation.',
      );
    }
  }

  return {
    foundationEnabled: anyTransportSurface || offerMappings.length > 0,
    transportEnabled,
    checkoutEnabled,
    customerPortalEnabled,
    webhookIntakeEnabled,
    reconciliationEnabled,
    webhookProjectionEnabled,
    mode: 'test',
    canonicalPublicOrigin: parseOrigin(
      source.ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN ?? defaults.canonicalPublicOrigin,
    ),
    expectedProviderAccountRef: providerAccountRef,
    offerMappings,
    policyId: policy.policy_id,
    policyVersion: policy.policy_version,
    planTruth: policy.public_copy.checkout_and_billing_surface_truth,
    entitlementEmergencyMode: emergencyMode,
    providerPortalConfigurationRef,
    configFingerprint: fingerprint(
      sanitizedSource({
        LIVE_STRIPE_CHARGES_AUTHORIZED: liveGuard === null ? null : liveGuard,
        ENABLE_PAYMENT_TRANSPORT: transportEnabled,
        ENABLE_STRIPE_TEST_CHECKOUT: checkoutEnabled,
        ENABLE_STRIPE_TEST_PORTAL: customerPortalEnabled,
        ENABLE_STRIPE_TEST_WEBHOOKS: webhookIntakeEnabled,
        ENABLE_STRIPE_TEST_RECONCILIATION: reconciliationEnabled,
        ENABLE_STRIPE_TEST_WEBHOOK_PROJECTION: webhookProjectionEnabled,
        ONE_TIME_STRIPE_TEST_SECRET_KEY: Boolean(secretKey),
        ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET: Boolean(
          text(source.ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET),
        ),
        ONE_TIME_STRIPE_TEST_ACCOUNT_ID: Boolean(providerAccountRef),
        ONE_TIME_STRIPE_TEST_PRICE_ID: Boolean(providerPriceRef),
        ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID: Boolean(providerPortalConfigurationRef),
        ONE_TIME_ENTITLEMENT_EMERGENCY_MODE: emergencyMode,
      }),
    ),
  };
}

export function readOt87StripeRuntimeSecrets(
  source: BillingConfigSource,
): Ot87BillingRuntimeSecrets {
  return {
    secretKey: text(source.ONE_TIME_STRIPE_TEST_SECRET_KEY),
    webhookSecret: text(source.ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET),
  };
}

export function billingConfigSnapshot(config: BillingFeatureConfig) {
  return {
    foundationEnabled: config.foundationEnabled,
    transportEnabled: config.transportEnabled,
    checkoutEnabled: config.checkoutEnabled,
    customerPortalEnabled: config.customerPortalEnabled,
    webhookIntakeEnabled: config.webhookIntakeEnabled,
    reconciliationEnabled: config.reconciliationEnabled,
    webhookProjectionEnabled: config.webhookProjectionEnabled,
    mode: config.mode,
    canonicalPublicOrigin: config.canonicalPublicOrigin,
    expectedProviderAccountRef: config.expectedProviderAccountRef ? 'configured' : null,
    providerPortalConfigurationRef: config.providerPortalConfigurationRef ? 'configured' : null,
    offerCount: config.offerMappings.length,
    policyId: config.policyId,
    policyVersion: config.policyVersion,
    entitlementEmergencyMode: config.entitlementEmergencyMode,
    configFingerprint: config.configFingerprint,
  };
}

function bool(value: unknown) {
  return value === true || value === 'true' || value === '1';
}

function falseLike(value: unknown) {
  return value === false || value === 'false' || value === '0';
}

function text(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseMode(value: unknown): BillingMode {
  const parsed = value === undefined || value === '' ? 'test' : value;
  const mode = billingModeSchema.safeParse(parsed);
  if (!mode.success) {
    throw new BillingConfigError('LIVE_MODE', 'Only test billing mode is accepted in this slice.');
  }
  return mode.data;
}

function parseOrigin(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('bad protocol');
    }
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('bad origin shape');
    }
    return url.origin;
  } catch {
    throw new BillingConfigError('MALFORMED_ORIGIN', 'Billing canonical origin is malformed.');
  }
}

function parseOfferMappings(value: unknown, mode: BillingMode): BillingOfferPriceMapping[] {
  const raw = text(value);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BillingConfigError('INVALID_OFFER_MAPPING', 'Billing offer mapping JSON is invalid.');
  }
  if (!Array.isArray(parsed)) {
    throw new BillingConfigError(
      'INVALID_OFFER_MAPPING',
      'Billing offer mappings must be an array.',
    );
  }
  return parsed.map((item) => {
    const offer = billingOfferPriceMappingSchema.safeParse(item);
    if (!offer.success || offer.data.mode !== mode) {
      throw new BillingConfigError(
        'INVALID_OFFER_MAPPING',
        'Billing offer mapping failed validation.',
      );
    }
    return offer.data;
  });
}

function sanitizedSource(source: BillingConfigSource) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      typeof value === 'string' && liveLikePattern.test(value) ? '[redacted]' : value,
    ]),
  );
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
