import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createPostgresBillingRepositories } from '../../packages/db/src/billing/repository.ts';
import {
  type BillingProviderAccountRef,
  type ProviderCheckoutSessionInput,
  type ProviderPortalSessionInput,
} from '../../packages/contracts/src/billing/index.ts';
import {
  createFixtureBillingProviderAdapter,
  fixtureWebhookSignature,
  type FixtureBillingProviderAdapter,
} from '../../packages/domain/src/billing/fixture-adapter.ts';
import { withBillingNetworkGuard } from '../../packages/domain/src/billing/network-guard.ts';
import { createBillingServices } from '../../packages/domain/src/billing/service.ts';
import {
  createStripeTestBillingProviderAdapter,
  type StripeTestClient,
} from '../../packages/domain/src/billing/stripe-test-adapter.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../packages/domain/src/billing/types.ts';

const execFileAsync = promisify(execFile);

let pool: DbPool;

type StoredRedirectEntry = {
  redirectKey: string;
  provider: 'stripe';
  mode: 'test';
  providerUrl: string;
  expiresAt: Date;
};

const providerAccount: BillingProviderAccountRef = {
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: 'acct_fixture_w12_100_09',
};

const parentActor: BillingActorContext = {
  actor_key: 'parent_user_w12_100_09',
  role: 'parent',
  active: true,
};

const principal = {
  principal_key: 'household_w12_100_09',
  principal_type: 'opaque',
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
} as const;

const offer = {
  ...principal,
  offer_key: 'family_monthly_usd_67_v1',
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: providerAccount.provider_account_ref,
  provider_price_ref: 'price_fixture_w12_100_09_6700',
  currency: 'usd',
  amount_cents: 6700,
  synthetic: false,
} as const;

const checkoutInput: ProviderCheckoutSessionInput = {
  principal,
  providerAccount,
  offer,
  idempotencyKey: 'checkout_w12_100_09',
  successUrl: 'https://join.onetimeonetime.com/app/billing/checkout/success',
  cancelUrl: 'https://join.onetimeonetime.com/app/billing/checkout/cancel',
};

const portalInput: ProviderPortalSessionInput = {
  principal,
  providerAccount,
  provider_customer_ref: 'cus_test_w12_100_09',
  idempotencyKey: 'portal_w12_100_09',
  returnUrl: 'https://join.onetimeonetime.com/app/parent',
};

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('W12-100-09 official Stripe TEST adapter readiness', () => {
  it('creates checkout and portal redirect handles with a fake official client and no network calls', async () => {
    const stored: StoredRedirectEntry[] = [];
    const adapter = officialAdapter({
      redirectStore: (entry) => {
        stored.push(entry);
      },
    });

    const checkout = await withBillingNetworkGuard(() =>
      adapter.createCheckoutSession(checkoutInput),
    );
    const portal = await withBillingNetworkGuard(() =>
      adapter.createCustomerPortalSession(portalInput),
    );

    expect(checkout.attempts).toEqual([]);
    expect(portal.attempts).toEqual([]);
    expect(checkout.result.redirect_url).toMatch(/^\/app\/billing\/checkout\/redirect\//);
    expect(portal.result.redirect_url).toMatch(/^\/app\/billing\/portal\/redirect\//);
    expect(JSON.stringify({ checkout: checkout.result, portal: portal.result })).not.toContain(
      'stripe.com',
    );
    expect(stored.map((entry) => entry.providerUrl).sort()).toEqual([
      'https://billing.stripe.com/p/session/bps_test_w12_100_09',
      'https://checkout.stripe.com/c/pay/cs_test_w12_100_09',
    ]);
  });

  it('rejects every live-mode object shape exposed by the official test adapter seam', async () => {
    await expect(
      officialAdapter({
        customerCreate: { id: 'cus_test_flagged_create', livemode: true },
      }).createCheckoutSession(checkoutInput),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        checkoutSession: {
          id: 'cs_test_flagged_session',
          url: 'https://checkout.stripe.com/c/pay/cs_test_flagged_session',
          customer: 'cus_test_flagged_session',
          livemode: true,
        },
      }).createCheckoutSession(checkoutInput),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        portalSession: {
          id: 'bps_test_flagged_portal',
          url: 'https://billing.stripe.com/p/session/bps_test_flagged_portal',
          livemode: true,
        },
      }).createCustomerPortalSession(portalInput),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        webhookEvent: {
          id: 'evt_test_flagged_webhook',
          type: 'invoice.paid',
          account: providerAccount.provider_account_ref,
          created: 1_785_000_000,
          livemode: true,
          data: { object: { id: 'in_test_flagged_webhook', customer: 'cus_test_flagged_webhook' } },
        },
      }).verifyWebhook({
        rawBody: Buffer.from('{}'),
        signatureHeader: 'fixture-signature',
      }),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        customerRetrieve: { id: 'cus_test_flagged_retrieve', livemode: true },
      }).retrieveCustomer('cus_test_flagged_retrieve'),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        subscriptionRetrieve: {
          id: 'sub_test_flagged_retrieve',
          status: 'active',
          livemode: true,
        },
      }).retrieveSubscription('sub_test_flagged_retrieve'),
    ).rejects.toThrow(/Live Stripe/);
    await expect(
      officialAdapter({
        invoiceRetrieve: { id: 'in_test_flagged_retrieve', status: 'paid', livemode: true },
      }).retrieveInvoice('in_test_flagged_retrieve'),
    ).rejects.toThrow(/Live Stripe/);
  });
});

describe('W12-100-09 billing service readiness', () => {
  it('stores Stripe URLs server-side and consumes checkout and portal redirect tokens once', async () => {
    const repositories = createPostgresBillingRepositories(pool);
    const services = createBillingServices({
      config: enabledConfig(),
      repositories,
      providerAdapter: officialAdapter({
        redirectStore: (entry) => repositories.storeRedirect(entry),
      }),
      authorization: parentAuthorization(['billing:read', 'billing:checkout', 'billing:portal']),
      clock: () => new Date('2026-07-17T09:00:00Z'),
    });

    const checkout = await services.requestCheckoutSession({
      actor: parentActor,
      payload: {
        principal_key: principal.principal_key,
        offer_key: offer.offer_key,
        idempotency_key: 'checkout_redirect_once',
        version: 1,
      },
    });
    expect(checkout.ok).toBe(true);
    if (!checkout.ok) throw new Error('checkout failed');
    const checkoutKey = lastPathSegment(checkout.value.redirect_url);
    expect(await repositories.consumeRedirect(checkoutKey)).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_w12_100_09',
    );
    expect(await repositories.consumeRedirect(checkoutKey)).toBeNull();

    const portal = await services.requestCustomerPortalSession({
      actor: parentActor,
      payload: {
        principal_key: principal.principal_key,
        idempotency_key: 'portal_redirect_once',
        version: 1,
      },
    });
    expect(portal.ok).toBe(true);
    if (!portal.ok) throw new Error('portal failed');
    const portalKey = lastPathSegment(portal.value.redirect_url);
    expect(await repositories.consumeRedirect(portalKey)).toBe(
      'https://billing.stripe.com/p/session/bps_test_w12_100_09',
    );
    expect(await repositories.consumeRedirect(portalKey)).toBeNull();
  });

  it('projects expiration, cancellation, payment failure, and duplicate invoice events safely', async () => {
    const services = fixtureServices({
      authorization: parentAuthorization(['billing:read', 'billing:checkout', 'billing:portal']),
      clock: () => new Date('2026-07-20T12:00:00Z'),
    });
    const checkout = await requestCheckout(services, 'checkout_projection_edges');
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    const expired = await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_checkout_expired',
      type: 'checkout.session.expired',
      created: '2026-07-17T10:00:00Z',
      object: {
        id: checkout.checkout_session_ref,
        customer,
        subscription,
        metadata: metadata(),
      },
    });
    expect(expired).toMatchObject({ ok: true, value: { disposition: 'accepted' } });
    await expectCheckoutStatus(checkout.checkout_session_ref, 'expired');

    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_subscription_active',
      type: 'customer.subscription.updated',
      created: '2026-07-17T10:01:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        provider_product_ref: 'prod_fixture_w12_100_09',
        provider_price_ref: offer.provider_price_ref,
        current_period_start: '2026-07-17T10:00:00Z',
        current_period_end: '2026-08-17T10:00:00Z',
        latest_invoice: 'in_w12_100_09_paid',
        metadata: metadata(),
      },
    });
    const paidInvoice = {
      id: 'in_w12_100_09_paid',
      customer,
      subscription,
      provider_product_ref: 'prod_fixture_w12_100_09',
      provider_price_ref: offer.provider_price_ref,
      amount_due_cents: 6700,
      amount_paid_cents: 6700,
      currency: 'usd',
      issued_at: '2026-07-17T10:02:00Z',
      metadata: metadata(),
    };
    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_invoice_paid_1',
      type: 'invoice.paid',
      created: '2026-07-17T10:02:00Z',
      object: paidInvoice,
    });
    await expectEntitlement({ status: 'active', grants_access: true });

    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_invoice_paid_2',
      type: 'invoice.paid',
      created: '2026-07-17T10:03:00Z',
      object: paidInvoice,
    });
    await expectInvoiceCount('in_w12_100_09_paid', 1);

    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_cancel_at_period_end',
      type: 'customer.subscription.updated',
      created: '2026-07-17T10:04:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: '2026-08-17T10:00:00Z',
        latest_invoice: 'in_w12_100_09_paid',
        metadata: metadata(),
      },
    });
    await expectEntitlement({ status: 'scheduled_end', grants_access: true });

    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_invoice_failed',
      type: 'invoice.payment_failed',
      created: '2026-07-17T10:05:00Z',
      object: {
        id: 'in_w12_100_09_failed',
        customer,
        subscription,
        provider_product_ref: 'prod_fixture_w12_100_09',
        provider_price_ref: offer.provider_price_ref,
        amount_due_cents: 6700,
        amount_paid_cents: 0,
        currency: 'usd',
        issued_at: '2026-07-17T10:05:00Z',
        metadata: metadata(),
      },
    });
    await expectInvoiceCount('in_w12_100_09_failed', 1);
    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_active_failed_latest_invoice',
      type: 'customer.subscription.updated',
      created: '2026-07-17T10:05:30Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        current_period_end: '2026-08-17T10:00:00Z',
        latest_invoice: 'in_w12_100_09_failed',
        metadata: metadata(),
      },
    });
    await expectEntitlement({ status: 'active', grants_access: false });

    await receiveFixtureEvent(services, {
      id: 'evt_w12_100_09_subscription_deleted',
      type: 'customer.subscription.deleted',
      created: '2026-07-17T10:06:00Z',
      object: {
        id: subscription,
        customer,
        status: 'canceled',
        current_period_end: '2026-07-18T10:00:00Z',
        latest_invoice: 'in_w12_100_09_failed',
        metadata: metadata(),
      },
    });
    await expectEntitlement({ status: 'revoked', grants_access: false });
  });

  it('requires reconciliation capability and redacts thrown provider failures', async () => {
    const forbiddenAdapter = fixtureAdapter();
    const forbiddenServices = createBillingServices({
      config: enabledConfig(),
      repositories: createPostgresBillingRepositories(pool),
      providerAdapter: forbiddenAdapter,
      authorization: parentAuthorization(['billing:read']),
    });
    const forbidden = await forbiddenServices.requestReconciliation({
      actor: parentActor,
      payload: {
        principal_key: principal.principal_key,
        reason: 'operator_requested_readiness_check',
        idempotency_key: 'reconcile_forbidden',
        version: 1,
      },
    });
    expect(forbidden).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(forbiddenAdapter.invocationCounts.reconcileBillingPrincipal).toBe(0);

    const safeServices = fixtureServices({
      authorization: parentAuthorization(['billing:read', 'billing:reconcile']),
      adapterOverrides: {
        reconcileBillingPrincipal: async () => {
          throw new Error('provider leaked cus_test_secret_full_customer_object');
        },
      },
    });
    const safe = await safeServices.requestReconciliation({
      actor: parentActor,
      payload: {
        principal_key: principal.principal_key,
        reason: 'operator_requested_readiness_check',
        idempotency_key: 'reconcile_safe_failure',
        version: 1,
      },
    });
    expect(safe.ok).toBe(true);
    if (!safe.ok) throw new Error('reconciliation unexpectedly failed');
    expect(safe.value).toMatchObject({
      status: 'failed',
      disposition: 'provider_error',
      reason: 'provider_unavailable',
    });
    const persisted = await pool.query(
      `SELECT result
         FROM onetime.billing_reconciliation_jobs
        WHERE idempotency_key = 'reconcile_safe_failure'
        LIMIT 1`,
    );
    expect(JSON.stringify(persisted.rows[0]?.result)).toBe('{"reason":"provider_unavailable"}');
  });
});

describe('W12-100-09 billing reconciliation script guards', () => {
  it('blocks apply mode without explicit authorization before external Stripe or database work', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'w12-100-09-billing-'));
    const outputPath = path.join(tempDir, 'reconciliation-apply-blocked.json');
    try {
      const result = await runReconciliationScript([
        '--scope=family',
        '--apply',
        '--output',
        outputPath,
      ]);
      expect(result.code).toBe(1);
      const report = JSON.parse(await readFile(outputPath, 'utf8')) as {
        failures: string[];
        missing: string[];
        mutations: Record<string, number>;
      };
      expect(report.failures).toEqual(
        expect.arrayContaining([
          'LIVE_STRIPE_CHARGES_AUTHORIZED must exactly equal NO.',
          'ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED must equal YES for apply.',
        ]),
      );
      expect(report.missing).toEqual(
        expect.arrayContaining(['secret_key', 'account', 'database_url']),
      );
      expect(report.mutations).toMatchObject({
        local_projection_writes: 0,
        stripe_writes: 0,
        live_calls: 0,
        live_charges: 0,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function officialAdapter(
  overrides: {
    checkoutSession?: Awaited<ReturnType<StripeTestClient['checkout']['sessions']['create']>>;
    portalSession?: Awaited<ReturnType<StripeTestClient['billingPortal']['sessions']['create']>>;
    webhookEvent?: ReturnType<StripeTestClient['webhooks']['constructEvent']>;
    customerCreate?: Awaited<ReturnType<StripeTestClient['customers']['create']>>;
    customerRetrieve?: Awaited<ReturnType<StripeTestClient['customers']['retrieve']>>;
    subscriptionRetrieve?: Awaited<ReturnType<StripeTestClient['subscriptions']['retrieve']>>;
    invoiceRetrieve?: Awaited<ReturnType<StripeTestClient['invoices']['retrieve']>>;
    redirectStore?: (entry: StoredRedirectEntry) => void | Promise<void>;
  } = {},
) {
  const client: StripeTestClient = {
    checkout: {
      sessions: {
        create: async () =>
          overrides.checkoutSession ?? {
            id: 'cs_test_w12_100_09',
            url: 'https://checkout.stripe.com/c/pay/cs_test_w12_100_09',
            customer: 'cus_test_w12_100_09',
            subscription: 'sub_test_w12_100_09',
            livemode: false,
          },
      },
    },
    billingPortal: {
      sessions: {
        create: async () =>
          overrides.portalSession ?? {
            id: 'bps_test_w12_100_09',
            url: 'https://billing.stripe.com/p/session/bps_test_w12_100_09',
            livemode: false,
          },
      },
    },
    webhooks: {
      constructEvent: () =>
        overrides.webhookEvent ?? {
          id: 'evt_test_w12_100_09',
          type: 'invoice.paid',
          account: providerAccount.provider_account_ref,
          created: 1_785_000_000,
          livemode: false,
          data: { object: { id: 'in_test_w12_100_09', customer: 'cus_test_w12_100_09' } },
        },
    },
    customers: {
      create: async () =>
        overrides.customerCreate ?? { id: 'cus_test_w12_100_09', livemode: false },
      retrieve: async () =>
        overrides.customerRetrieve ?? { id: 'cus_test_w12_100_09', livemode: false },
    },
    subscriptions: {
      retrieve: async () =>
        overrides.subscriptionRetrieve ?? {
          id: 'sub_test_w12_100_09',
          status: 'active',
          livemode: false,
        },
    },
    invoices: {
      retrieve: async () =>
        overrides.invoiceRetrieve ?? {
          id: 'in_test_w12_100_09',
          status: 'paid',
          livemode: false,
        },
    },
  };
  return createStripeTestBillingProviderAdapter({
    providerAccountRef: providerAccount,
    webhookSecret: 'fixture_webhook_secret_w12_100_09',
    redirectVault: {
      store: (entry) => overrides.redirectStore?.(entry),
    },
    portalConfigurationRef: 'bpc_test_w12_100_09',
    client,
    clock: () => new Date(Date.now()),
  });
}

function fixtureServices(input: {
  authorization: BillingAuthorizationAdapter;
  adapterOverrides?: Partial<FixtureBillingProviderAdapter>;
  clock?: () => Date;
}) {
  const adapter = fixtureAdapter(input.adapterOverrides);
  return createBillingServices({
    config: enabledConfig(),
    repositories: createPostgresBillingRepositories(pool),
    providerAdapter: adapter,
    authorization: input.authorization,
    clock: input.clock ?? (() => new Date('2026-07-17T12:00:00Z')),
  });
}

function fixtureAdapter(overrides: Partial<FixtureBillingProviderAdapter> = {}) {
  return {
    ...createFixtureBillingProviderAdapter({
      providerAccountRef: providerAccount,
      idGenerator: deterministicIds(),
      now: () => new Date('2026-07-17T10:00:00Z'),
    }),
    ...overrides,
  };
}

function enabledConfig(): BillingFeatureConfig {
  return {
    foundationEnabled: true,
    transportEnabled: true,
    checkoutEnabled: true,
    customerPortalEnabled: true,
    webhookIntakeEnabled: true,
    webhookProjectionEnabled: true,
    reconciliationEnabled: true,
    mode: 'test',
    canonicalPublicOrigin: 'https://join.onetimeonetime.com',
    expectedProviderAccountRef: providerAccount.provider_account_ref,
    expectedProviderProductRef: 'prod_fixture_w12_100_09',
    providerPortalConfigurationRef: 'bpc_fixture_w12_100_09',
    policyId: 'ot87-family-monthly-usd-67-v1',
    policyVersion: '2026-07-15.1',
    planTruth: 'Family plan - $67/month - up to 3 active learners in one household.',
    entitlementEmergencyMode: 'normal',
    configFingerprint: 'fixture',
    offerMappings: [offer],
  };
}

function parentAuthorization(
  capabilities: Array<'billing:read' | 'billing:checkout' | 'billing:portal' | 'billing:reconcile'>,
): BillingAuthorizationAdapter {
  return {
    async resolvePrincipal({ actor, requested_principal_key }) {
      if (
        !actor.active ||
        actor.role !== 'parent' ||
        requested_principal_key !== principal.principal_key
      ) {
        return { ok: false, reason: 'wrong_scope' };
      }
      return {
        ok: true,
        principal,
        capabilities,
      };
    },
  };
}

async function requestCheckout(
  services: ReturnType<typeof fixtureServices>,
  idempotencyKey: string,
) {
  const checkout = await services.requestCheckoutSession({
    actor: parentActor,
    payload: {
      principal_key: principal.principal_key,
      offer_key: offer.offer_key,
      idempotency_key: idempotencyKey,
      version: 1,
    },
  });
  expect(checkout.ok).toBe(true);
  if (!checkout.ok) throw new Error('checkout failed');
  return checkout.value;
}

async function receiveFixtureEvent(
  services: ReturnType<typeof fixtureServices>,
  input: {
    id: string;
    type: string;
    created: string;
    object: Record<string, unknown>;
  },
) {
  const rawBody = Buffer.from(
    JSON.stringify({
      id: input.id,
      type: input.type,
      account: providerAccount.provider_account_ref,
      created: input.created,
      livemode: false,
      data: { object: input.object },
    }),
  );
  return services.receiveWebhook({
    rawBody,
    signatureHeader: fixtureWebhookSignature({ rawBody }),
  });
}

async function providerCustomerRef() {
  const result = await pool.query(
    `SELECT provider_customer_ref
       FROM onetime.billing_principal_customers
      WHERE principal_key = $1
      LIMIT 1`,
    [principal.principal_key],
  );
  return String(result.rows[0].provider_customer_ref);
}

async function providerSubscriptionRef() {
  const result = await pool.query(
    `SELECT provider_subscription_ref
       FROM onetime.billing_checkout_sessions
      WHERE principal_key = $1
      LIMIT 1`,
    [principal.principal_key],
  );
  return String(result.rows[0].provider_subscription_ref);
}

async function expectCheckoutStatus(providerCheckoutSessionRef: string, status: string) {
  const result = await pool.query(
    `SELECT status
       FROM onetime.billing_checkout_sessions
      WHERE provider_checkout_session_ref = $1
      LIMIT 1`,
    [providerCheckoutSessionRef],
  );
  expect(result.rows[0]?.status).toBe(status);
}

async function expectEntitlement(expected: { status: string; grants_access: boolean }) {
  const result = await pool.query(
    `SELECT status, grants_access
       FROM onetime.billing_entitlement_projections
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
      LIMIT 1`,
    [principal.account_key, principal.product_key, principal.principal_key],
  );
  expect(result.rows[0]).toMatchObject(expected);
}

async function expectInvoiceCount(providerInvoiceRef: string, expected: number) {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.billing_invoice_summaries
      WHERE provider_invoice_ref = $1`,
    [providerInvoiceRef],
  );
  expect(numberCount(result.rows[0].count)).toBe(expected);
}

function metadata() {
  return {
    account_key: principal.account_key,
    product_key: principal.product_key,
    principal_key: principal.principal_key,
    offer_key: offer.offer_key,
    policy_version: '2026-07-15.1',
  };
}

function deterministicIds() {
  let count = 0;
  return (prefix: string) => {
    count += 1;
    return `${prefix}_${String(count).padStart(4, '0')}`;
  };
}

function lastPathSegment(value: string) {
  return value.slice(value.lastIndexOf('/') + 1);
}

function numberCount(value: unknown) {
  return Array.isArray(value) ? Number(value[0]) : Number(value);
}

async function runReconciliationScript(args: string[]) {
  try {
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', 'scripts/ot87-billing-reconcile-test.ts', ...args],
      {
        cwd: process.cwd(),
        env: {
          PATH: process.env.PATH ?? process.env.Path ?? '',
          Path: process.env.Path ?? process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          TEMP: process.env.TEMP ?? tmpdir(),
          TMP: process.env.TMP ?? tmpdir(),
        },
      },
    );
    return { code: 0 };
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error && typeof error.code === 'number'
        ? error.code
        : 1;
    return { code };
  }
}
