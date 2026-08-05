import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BillingConfigError,
  defaultBillingFeatureConfig,
  parseBillingFeatureConfig,
  parseOt87StripeTestBillingConfig,
} from '../../packages/domain/src/billing/config.ts';
import { evaluateBillingEntitlement } from '../../packages/domain/src/billing/policy.ts';
import { isRejectedReturnPath } from '../../packages/domain/src/billing/return-paths.ts';
import { withBillingNetworkGuard } from '../../packages/domain/src/billing/network-guard.ts';
import type { BillingPrincipalRef } from '../../packages/contracts/src/billing/index.ts';

const principal: BillingPrincipalRef = {
  principal_key: 'principal_owner',
  principal_type: 'account_user',
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
};

describe('OT-46 billing config isolation', () => {
  it('defaults every billing feature off and accepts absent configuration', () => {
    expect(defaultBillingFeatureConfig()).toMatchObject({
      foundationEnabled: false,
      transportEnabled: false,
      checkoutEnabled: false,
      customerPortalEnabled: false,
      webhookIntakeEnabled: false,
      reconciliationEnabled: false,
      mode: 'test',
      offerMappings: [],
    });
    expect(parseBillingFeatureConfig({})).toMatchObject(defaultBillingFeatureConfig());
  });

  it('rejects live mode, live-like key material, unknown keys, and legacy aliases', () => {
    expect(() => parseBillingFeatureConfig({ ONE_TIME_BILLING_MODE: 'live' })).toThrow(
      BillingConfigError,
    );
    expect(() =>
      parseBillingFeatureConfig({
        ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF: 'sk_live_fake_secret_key',
      }),
    ).toThrow(BillingConfigError);
    expect(() => parseBillingFeatureConfig({ STRIPE_SECRET_KEY: 'redacted' })).toThrow(
      BillingConfigError,
    );
    expect(() => parseBillingFeatureConfig({ ENABLE_PAYMENT_TRANSPORT: 'true' })).toThrow(
      BillingConfigError,
    );
    expect(() => parseBillingFeatureConfig({ RANDOM_BILLING_KEY: '1' })).toThrow(
      BillingConfigError,
    );
  });

  it('accepts least-privilege restricted Stripe TEST server keys', () => {
    expect(
      parseOt87StripeTestBillingConfig(
        {
          ONE_TIME_STRIPE_TEST_SECRET_KEY: 'rk_test_restricted_test_key',
        },
        {
          accountKey: 'one_time',
          productKey: 'one_time_mishnah_class',
          canonicalPublicOrigin: 'https://join.onetimeonetime.com',
        },
      ),
    ).toMatchObject({
      mode: 'test',
    });
    expect(() =>
      parseOt87StripeTestBillingConfig(
        {
          ONE_TIME_STRIPE_TEST_SECRET_KEY: 'rk_live_restricted_live_key',
        },
        {
          accountKey: 'one_time',
          productKey: 'one_time_mishnah_class',
          canonicalPublicOrigin: 'https://join.onetimeonetime.com',
        },
      ),
    ).toThrow(BillingConfigError);
  });

  it('rejects enabled subfeatures while billing transport remains off', () => {
    expect(() =>
      parseBillingFeatureConfig({
        ONE_TIME_BILLING_FOUNDATION_ENABLED: 'true',
        ONE_TIME_BILLING_CHECKOUT_ENABLED: 'true',
      }),
    ).toThrow(/transport is disabled/);
  });

  it('constructs only fixed server-side return targets and rejects hostile return shapes', () => {
    for (const attempt of [
      '//evil.test/path',
      '/app/billing\\portal',
      '/app/billing#token',
      '/app/billing/%2f%2fevil.test',
      'https://evil.test/app/billing',
      '/unapproved',
    ]) {
      expect(isRejectedReturnPath(attempt)).toBe(true);
    }
  });
});

describe('OT-46 provider-neutral entitlement policy', () => {
  it.each([
    ['trialing', 'billing_eligible'],
    ['active', 'active'],
    ['past_due', 'suspended'],
    ['unpaid', 'suspended'],
    ['incomplete', 'pending'],
    ['incomplete_expired', 'manual_review'],
    ['paused', 'suspended'],
    ['disputed', 'manual_review'],
    ['refunded', 'manual_review'],
    ['unknown', 'manual_review'],
  ] as const)('maps %s to %s without granting access', (subscriptionStatus, entitlementStatus) => {
    const projection = evaluateBillingEntitlement({
      principal,
      subscription: {
        status: subscriptionStatus,
        current_period_end: null,
        cancel_at: null,
        canceled_at: null,
        source_event_key: 'event_fixture',
      },
      source: 'event_fixture',
      effectiveAt: new Date('2026-07-14T00:00:00Z'),
      evaluatedAt: new Date('2026-07-14T00:00:01Z'),
      reconciliationConfidence: 'verified',
    });
    expect(projection.status).toBe(entitlementStatus);
    expect(projection.grants_access).toBe(false);
  });
});

describe('OT-46 public isolation and privacy static checks', () => {
  it('keeps public client entry free of Stripe and billing imports', async () => {
    const publicEntry = await readFile(
      path.resolve(process.cwd(), 'apps/web/src/client/public/public-entry.ts'),
      'utf8',
    );
    const publicImports = publicEntry
      .split(/\r?\n/u)
      .filter((line) => line.trimStart().startsWith('import '))
      .join('\n');
    expect(publicImports).not.toMatch(/stripe|billing|checkout|subscription|invoice/i);
    expect(publicEntry).not.toMatch(/api\.stripe\.com|Stripe\s*\(/i);
  });

  it('keeps the billing migration free of forbidden payment data columns', async () => {
    const migration = await readFile(
      path.resolve(process.cwd(), 'packages/db/migrations/1300_ot46_billing_foundation.sql'),
      'utf8',
    );
    expect(migration).not.toMatch(
      /card|payment_method|fingerprint|full_address|tax_id|signature_header|raw_webhook|invoice_url/i,
    );
    expect(migration).toContain('grants_access boolean NOT NULL DEFAULT false');
    expect(migration).toContain("mode text NOT NULL CHECK (mode = 'test')");
  });

  it('blocks fixture billing network attempts through the no-network guard', async () => {
    await expect(
      withBillingNetworkGuard(async () => {
        await fetch('https://api.stripe.com/v1/customers');
      }),
    ).rejects.toThrow(/network access is blocked/);
  });
});
