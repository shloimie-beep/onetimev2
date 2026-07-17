import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createPostgresBillingRepositories } from '../../packages/db/src/billing/repository.ts';
import {
  createFixtureBillingProviderAdapter,
  fixtureWebhookSignature,
} from '../../packages/domain/src/billing/fixture-adapter.ts';
import { createBillingServices } from '../../packages/domain/src/billing/service.ts';
import { householdHasLearningAccess } from '../../packages/domain/src/billing/portal-access.ts';
import type { BillingProviderAccountRef } from '../../packages/contracts/src/billing/index.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../packages/domain/src/billing/types.ts';

let pool: DbPool;

const providerAccount: BillingProviderAccountRef = {
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: 'acct_fixture_ot87',
};

const parentActor: BillingActorContext = {
  actor_key: 'parent_user_ot87',
  role: 'parent',
  active: true,
};

const principal = {
  principal_key: 'household_ot87',
  principal_type: 'opaque',
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
} as const;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-87 family subscription entitlement policy', () => {
  it('requires checkout correlation, active subscription, and a paid USD 6700 invoice before granting access', async () => {
    const services = servicesFor();
    const checkout = await services.requestCheckoutSession({
      actor: parentActor,
      payload: {
        principal_key: principal.principal_key,
        offer_key: 'family_monthly_usd_67_v1',
        idempotency_key: 'ot87_checkout_0001',
        version: 1,
      },
    });
    expect(checkout.ok).toBe(true);
    if (!checkout.ok) throw new Error('checkout failed');

    await expectNoAccess('checkout_creation');

    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();
    const checkoutCompleted = await receiveFixtureEvent(services, {
      id: 'evt_ot87_checkout_completed',
      type: 'checkout.session.completed',
      created: '2026-07-15T12:00:00Z',
      object: {
        id: checkout.value.checkout_session_ref,
        customer,
        subscription,
        client_reference_id: checkout.value.checkout_request_key,
        metadata: metadata(),
      },
    });
    expect(checkoutCompleted).toMatchObject({
      ok: true,
      value: { disposition: 'accepted' },
    });
    await expectNoAccess('checkout_completed_alone');

    const active = await receiveFixtureEvent(services, {
      id: 'evt_ot87_subscription_active',
      type: 'customer.subscription.updated',
      created: '2026-07-15T12:01:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        current_period_start: '2026-07-15T12:00:00Z',
        current_period_end: '2026-08-15T12:00:00Z',
        latest_invoice: 'in_fixture_ot87_paid',
        metadata: metadata(),
      },
    });
    expect(active).toMatchObject({ ok: true, value: { disposition: 'accepted' } });
    await expectNoAccess('active_without_invoice');

    const paid = await receiveFixtureEvent(services, {
      id: 'evt_ot87_invoice_paid',
      type: 'invoice.paid',
      created: '2026-07-15T12:02:00Z',
      object: {
        id: 'in_fixture_ot87_paid',
        customer,
        subscription,
        amount_due_cents: 6700,
        amount_paid_cents: 6700,
        currency: 'usd',
        issued_at: '2026-07-15T12:02:00Z',
        metadata: metadata(),
      },
    });
    expect(paid).toMatchObject({ ok: true, value: { disposition: 'accepted' } });

    const summary = await services.billingSummary({
      actor: parentActor,
      principal_key: principal.principal_key,
    });
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.value.entitlement).toMatchObject({
        status: 'active',
        grants_access: true,
        policy_version: '2026-07-15.1',
      });
    }
    await expect(
      householdHasLearningAccess({
        pool,
        accountKey: principal.account_key,
        productKey: principal.product_key,
        householdKey: principal.principal_key,
      }),
    ).resolves.toBe(true);
  });

  it('suspends immediately for past_due and treats trialing as manual review with no access', async () => {
    const services = servicesFor();
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    await receiveFixtureEvent(services, {
      id: 'evt_ot87_trialing',
      type: 'customer.subscription.updated',
      created: '2026-07-15T12:00:00Z',
      object: { id: subscription, customer, status: 'trialing', metadata: metadata() },
    });
    let summary = await services.billingSummary({
      actor: parentActor,
      principal_key: principal.principal_key,
    });
    expect(summary.ok && summary.value.entitlement).toMatchObject({
      status: 'manual_review',
      grants_access: false,
    });

    await receiveFixtureEvent(services, {
      id: 'evt_ot87_past_due',
      type: 'customer.subscription.updated',
      created: '2026-07-15T12:01:00Z',
      object: { id: subscription, customer, status: 'past_due', metadata: metadata() },
    });
    summary = await services.billingSummary({
      actor: parentActor,
      principal_key: principal.principal_key,
    });
    expect(summary.ok && summary.value.entitlement).toMatchObject({
      status: 'suspended',
      grants_access: false,
    });
  });
});

function servicesFor() {
  const adapter = createFixtureBillingProviderAdapter({
    providerAccountRef: providerAccount,
    idGenerator: deterministicIds(),
    now: () => new Date('2026-07-15T12:00:00Z'),
  });
  return createBillingServices({
    config: enabledConfig(),
    repositories: createPostgresBillingRepositories(pool),
    providerAdapter: adapter,
    authorization,
    clock: () => new Date('2026-07-15T12:03:00Z'),
  });
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
    expectedProviderProductRef: 'prod_fixture_ot87',
    providerPortalConfigurationRef: 'bpc_fixture_ot87',
    policyId: 'ot87-family-monthly-usd-67-v1',
    policyVersion: '2026-07-15.1',
    planTruth: 'Family plan — $67/month — up to 3 active learners in one household.',
    entitlementEmergencyMode: 'normal',
    configFingerprint: 'fixture',
    offerMappings: [
      {
        ...principal,
        offer_key: 'family_monthly_usd_67_v1',
        provider: 'stripe',
        mode: 'test',
        provider_account_ref: providerAccount.provider_account_ref,
        provider_price_ref: 'price_fixture_ot87_6700',
        currency: 'usd',
        amount_cents: 6700,
        synthetic: false,
      },
    ],
  };
}

const authorization: BillingAuthorizationAdapter = {
  async resolvePrincipal({ actor, requested_principal_key }) {
    if (actor.role !== 'parent' || requested_principal_key !== principal.principal_key) {
      return { ok: false, reason: 'wrong_scope' };
    }
    return {
      ok: true,
      principal,
      capabilities: ['billing:read', 'billing:checkout', 'billing:portal', 'billing:reconcile'],
    };
  },
};

async function checkoutAndCustomer(services: ReturnType<typeof servicesFor>) {
  await services.requestCheckoutSession({
    actor: parentActor,
    payload: {
      principal_key: principal.principal_key,
      offer_key: 'family_monthly_usd_67_v1',
      idempotency_key: 'ot87_checkout_setup',
      version: 1,
    },
  });
}

async function expectNoAccess(labelText: string) {
  const result = await pool.query(
    `SELECT grants_access
       FROM onetime.billing_entitlement_projections
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
      ORDER BY evaluated_at DESC
      LIMIT 1`,
    [principal.account_key, principal.product_key, principal.principal_key],
  );
  expect(result.rows[0]?.grants_access ?? false, labelText).toBe(false);
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

function receiveFixtureEvent(
  services: ReturnType<typeof servicesFor>,
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

function metadata() {
  return {
    account_key: principal.account_key,
    product_key: principal.product_key,
    principal_key: principal.principal_key,
    offer_key: 'family_monthly_usd_67_v1',
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
