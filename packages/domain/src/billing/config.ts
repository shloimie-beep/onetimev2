import { createHash } from 'node:crypto';
import {
  billingModeSchema,
  billingOfferPriceMappingSchema,
  type BillingFeatureConfig,
  type BillingMode,
  type BillingOfferPriceMapping,
} from './types.ts';

export type BillingConfigSource = Record<string, unknown>;

export type BillingConfigErrorCode =
  | 'UNKNOWN_KEY'
  | 'LEGACY_ALIAS'
  | 'LIVE_MODE'
  | 'LIVE_LIKE_SECRET'
  | 'MODE_MISMATCH'
  | 'MALFORMED_ORIGIN'
  | 'TRANSPORT_DISABLED'
  | 'INVALID_OFFER_MAPPING';

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
    mode: 'test',
    canonicalPublicOrigin: null,
    expectedProviderAccountRef: null,
    offerMappings: [],
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
    mode,
    canonicalPublicOrigin,
    expectedProviderAccountRef,
    offerMappings,
    configFingerprint: fingerprint(sanitizedSource(source)),
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
    mode: config.mode,
    canonicalPublicOrigin: config.canonicalPublicOrigin,
    expectedProviderAccountRef: config.expectedProviderAccountRef ? 'configured' : null,
    offerCount: config.offerMappings.length,
    configFingerprint: config.configFingerprint,
  };
}

function bool(value: unknown) {
  return value === true || value === 'true' || value === '1';
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
