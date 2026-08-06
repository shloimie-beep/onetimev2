import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createFixtureBillingProviderAdapter,
  fixtureWebhookSignature,
  type FixtureBillingProviderAdapter,
} from '../../packages/domain/src/billing/fixture-adapter.ts';
import { createPostgresBillingRepositories } from '../../packages/db/src/billing/repository.ts';
import { createBillingServices } from '../../packages/domain/src/billing/service.ts';
import type { BillingProviderAccountRef } from '../../packages/contracts/src/billing/index.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../packages/domain/src/billing/types.ts';

let pool: DbPool;
let adapter: FixtureBillingProviderAdapter;

const providerAccount: BillingProviderAccountRef = {
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: 'acct_fixture_ot105',
};

const parentActor: BillingActorContext = {
  actor_key: 'parent_user_ot105',
  role: 'parent',
  active: true,
};

const principal = {
  principal_key: 'household_ot105',
  principal_type: 'opaque',
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
} as const;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  adapter = createFixtureBillingProviderAdapter({
    providerAccountRef: providerAccount,
    idGenerator: deterministicIds(),
  });
});

afterEach(async () => {
  await pool.end();
});

describe('OT-105 Stripe TEST billing canary hardening', () => {
  it('rejects stale webhook signatures before recording the event', async () => {
    const services = servicesFor();
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const rawBody = rawFixtureEvent({
      id: 'evt_ot105_stale_signature',
      type: 'customer.subscription.updated',
      created: '2026-07-16T12:00:00Z',
      object: { id: await providerSubscriptionRef(), customer, status: 'active' },
    });

    const result = await services.receiveWebhook({
      rawBody,
      signatureHeader: fixtureWebhookSignature({
        rawBody,
        timestamp: Math.floor(Date.now() / 1000) - 600,
      }),
    });

    expect(result).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
    await expectCount('billing_verified_events', 0);
  });

  it('handles subscription trial warnings as signed no-access projections', async () => {
    const services = servicesFor();
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    const result = await receiveFixtureEvent(services, {
      id: 'evt_ot105_trial_warning',
      type: 'customer.subscription.trial_will_end',
      created: '2026-07-16T12:00:00Z',
      object: {
        id: subscription,
        customer,
        status: 'trialing',
        metadata: metadata(),
      },
    });

    expect(result).toMatchObject({ ok: true, value: { disposition: 'accepted' } });
    const summary = await services.billingSummary({
      actor: parentActor,
      principal_key: principal.principal_key,
    });
    expect(summary.ok && summary.value.entitlement).toMatchObject({
      status: 'manual_review',
      grants_access: false,
    });
  });

  it('rejects signed invoice events for unallowlisted product, price, currency, or amount', async () => {
    const services = servicesFor();
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    const cases = [
      {
        id: 'evt_ot105_wrong_product',
        object: { provider_product_ref: 'prod_wrong_ot105' },
        reason: 'event_product_not_allowlisted',
      },
      {
        id: 'evt_ot105_wrong_price',
        object: { provider_price_ref: 'price_wrong_ot105' },
        reason: 'event_offer_or_price_not_allowlisted',
      },
      {
        id: 'evt_ot105_wrong_currency',
        object: { currency: 'eur' },
        reason: 'event_currency_mismatch',
      },
      {
        id: 'evt_ot105_wrong_amount',
        object: { amount_due_cents: 6701, amount_paid_cents: 6701 },
        reason: 'event_amount_due_mismatch',
      },
    ];

    for (const item of cases) {
      const result = await receiveFixtureEvent(services, {
        id: item.id,
        type: 'invoice.paid',
        created: '2026-07-16T12:01:00Z',
        object: {
          id: `${item.id}_invoice`,
          customer,
          subscription,
          provider_product_ref: 'prod_fixture_ot105',
          provider_price_ref: 'price_fixture_ot105_6700',
          amount_due_cents: 6700,
          amount_paid_cents: 6700,
          currency: 'usd',
          metadata: metadata(),
          ...item.object,
        },
      });
      expect(result).toMatchObject({
        ok: true,
        value: { disposition: 'wrong_offer', reason: item.reason },
      });
    }

    await expectNoAccess();
  });

  it('requires signed checkout, active subscription, and paid USD 6700 invoice for access', async () => {
    const services = servicesFor();
    const checkout = await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    await receiveFixtureEvent(services, {
      id: 'evt_ot105_checkout_completed',
      type: 'checkout.session.completed',
      created: '2026-07-16T12:00:00Z',
      object: {
        id: checkout.checkout_session_ref,
        customer,
        subscription,
        provider_product_ref: 'prod_fixture_ot105',
        provider_price_ref: 'price_fixture_ot105_6700',
        client_reference_id: checkout.checkout_request_key,
        metadata: metadata(),
      },
    });
    await expectNoAccess();

    await receiveFixtureEvent(services, {
      id: 'evt_ot105_subscription_active',
      type: 'customer.subscription.updated',
      created: '2026-07-16T12:01:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        provider_product_ref: 'prod_fixture_ot105',
        provider_price_ref: 'price_fixture_ot105_6700',
        current_period_start: '2026-07-16T12:00:00Z',
        current_period_end: '2026-08-16T12:00:00Z',
        latest_invoice: 'in_fixture_ot105_paid',
        metadata: metadata(),
      },
    });
    await expectNoAccess();

    await receiveFixtureEvent(services, {
      id: 'evt_ot105_invoice_paid',
      type: 'invoice.paid',
      created: '2026-07-16T12:02:00Z',
      object: {
        id: 'in_fixture_ot105_paid',
        customer,
        subscription,
        provider_product_ref: 'prod_fixture_ot105',
        provider_price_ref: 'price_fixture_ot105_6700',
        amount_due_cents: 6700,
        amount_paid_cents: 6700,
        currency: 'usd',
        issued_at: '2026-07-16T12:02:00Z',
        metadata: metadata(),
      },
    });

    const summary = await services.billingSummary({
      actor: parentActor,
      principal_key: principal.principal_key,
    });
    expect(summary.ok && summary.value.entitlement).toMatchObject({
      status: 'active',
      grants_access: true,
      policy_version: '2026-07-15.1',
    });
  });

  it('reclaims an exact signed event after projection succeeds but completion recording fails', async () => {
    const repositories = createPostgresBillingRepositories(pool);
    const services = servicesFor(repositories);
    await pool.query(
      `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
       VALUES ($1,$2,$3,'OT-105 replay household','active')`,
      [principal.principal_key, principal.account_key, principal.product_key],
    );
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    await receiveFixtureEvent(services, {
      id: 'evt_ot105_replay_subscription_active',
      type: 'customer.subscription.updated',
      created: '2026-07-16T12:01:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        provider_product_ref: 'prod_fixture_ot105',
        provider_price_ref: 'price_fixture_ot105_6700',
        current_period_start: '2026-07-16T12:00:00Z',
        current_period_end: '2026-08-16T12:00:00Z',
        latest_invoice: 'in_fixture_ot105_replay_paid',
        metadata: metadata(),
      },
    });

    const rawBody = rawFixtureEvent({
      id: 'evt_ot105_replay_invoice_paid',
      type: 'invoice.paid',
      created: '2026-07-16T12:02:00Z',
      object: {
        id: 'in_fixture_ot105_replay_paid',
        customer,
        subscription,
        provider_product_ref: 'prod_fixture_ot105',
        provider_price_ref: 'price_fixture_ot105_6700',
        amount_due_cents: 6700,
        amount_paid_cents: 6700,
        currency: 'usd',
        issued_at: '2026-07-16T12:02:00Z',
        metadata: metadata(),
      },
    });
    let failCompletionOnce = true;
    const interrupted = servicesFor({
      ...repositories,
      async completeVerifiedEventProcessing(input) {
        if (failCompletionOnce) {
          failCompletionOnce = false;
          throw new Error('simulated_completion_commit_failure');
        }
        return repositories.completeVerifiedEventProcessing(input);
      },
    });

    await expect(
      interrupted.receiveWebhook({
        rawBody,
        signatureHeader: fixtureWebhookSignature({ rawBody }),
      }),
    ).rejects.toThrow('simulated_completion_commit_failure');

    const recovered = await services.receiveWebhook({
      rawBody,
      signatureHeader: fixtureWebhookSignature({ rawBody }),
    });
    expect(recovered).toMatchObject({ ok: true, value: { disposition: 'accepted' } });

    const duplicate = await services.receiveWebhook({
      rawBody,
      signatureHeader: fixtureWebhookSignature({ rawBody }),
    });
    expect(duplicate).toMatchObject({ ok: true, value: { disposition: 'duplicate' } });

    const evidence = await pool.query(
      `SELECT
         verified.processing_state,
         count(DISTINCT invoice.provider_invoice_ref)::int AS invoice_count,
         count(DISTINCT intent.transition_key) FILTER (WHERE intent.workflow_key = 'OT-04')::int
           AS activation_intent_count
       FROM onetime.billing_verified_events AS verified
       LEFT JOIN onetime.billing_invoice_summaries AS invoice
         ON invoice.source_event_key = verified.event_key
       LEFT JOIN onetime.billing_ghl_lifecycle_intents AS intent
         ON intent.source_event_id = verified.event_key
      WHERE verified.provider_event_id = 'evt_ot105_replay_invoice_paid'
      GROUP BY verified.processing_state`,
    );
    expect(evidence.rows[0]).toMatchObject({
      processing_state: 'completed',
      invoice_count: 1,
      activation_intent_count: 1,
    });
  });

  it('performs provider readback when an older subscription event is ignored', async () => {
    const services = servicesFor();
    await checkoutAndCustomer(services);
    const customer = await providerCustomerRef();
    const subscription = await providerSubscriptionRef();

    await receiveFixtureEvent(services, {
      id: 'evt_ot105_active_fresh',
      type: 'customer.subscription.updated',
      created: '2026-07-16T12:10:00Z',
      object: {
        id: subscription,
        customer,
        status: 'active',
        metadata: metadata(),
      },
    });
    const stale = await receiveFixtureEvent(services, {
      id: 'evt_ot105_active_stale',
      type: 'customer.subscription.updated',
      created: '2026-07-16T12:00:00Z',
      object: {
        id: subscription,
        customer,
        status: 'past_due',
        metadata: metadata(),
      },
    });

    expect(stale).toMatchObject({
      ok: true,
      value: {
        disposition: 'stale_event',
        reason: 'older_subscription_event_ignored_after_provider_readback',
      },
    });
    expect(adapter.invocationCounts.retrieveSubscription).toBeGreaterThan(0);
  });
});

function servicesFor(repositories = createPostgresBillingRepositories(pool)) {
  return createBillingServices({
    config: enabledConfig(),
    repositories,
    providerAdapter: adapter,
    authorization,
    clock: () => new Date('2026-07-16T12:03:00Z'),
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
    expectedProviderProductRef: 'prod_fixture_ot105',
    providerPortalConfigurationRef: 'bpc_fixture_ot105',
    policyId: 'ot87-family-monthly-usd-67-v1',
    policyVersion: '2026-07-15.1',
    planTruth: 'Family plan - $67/month - up to 3 active learners in one household.',
    entitlementEmergencyMode: 'normal',
    configFingerprint: 'fixture',
    offerMappings: [
      {
        ...principal,
        offer_key: 'family_monthly_usd_67_v1',
        provider: 'stripe',
        mode: 'test',
        provider_account_ref: providerAccount.provider_account_ref,
        provider_price_ref: 'price_fixture_ot105_6700',
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
  const checkout = await services.requestCheckoutSession({
    actor: parentActor,
    payload: {
      principal_key: principal.principal_key,
      offer_key: 'family_monthly_usd_67_v1',
      idempotency_key: 'ot105_checkout_setup',
      version: 1,
    },
  });
  expect(checkout.ok).toBe(true);
  if (!checkout.ok) throw new Error('checkout failed');
  return checkout.value;
}

async function expectNoAccess() {
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
  expect(result.rows[0]?.grants_access ?? false).toBe(false);
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
  input: Parameters<typeof rawFixtureEvent>[0],
) {
  const rawBody = rawFixtureEvent(input);
  return services.receiveWebhook({
    rawBody,
    signatureHeader: fixtureWebhookSignature({ rawBody }),
  });
}

function rawFixtureEvent(input: {
  id: string;
  type: string;
  created: string;
  object: Record<string, unknown>;
}) {
  return Buffer.from(
    JSON.stringify({
      id: input.id,
      type: input.type,
      account: providerAccount.provider_account_ref,
      created: input.created,
      livemode: false,
      data: { object: input.object },
    }),
  );
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

async function expectCount(table: string, expected: number) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  expect(numberCount(result.rows[0].count)).toBe(expected);
}

function numberCount(value: unknown) {
  return Array.isArray(value) ? Number(value[0]) : Number(value);
}

function deterministicIds() {
  let count = 0;
  return (prefix: string) => {
    count += 1;
    return `${prefix}_${String(count).padStart(4, '0')}`;
  };
}
