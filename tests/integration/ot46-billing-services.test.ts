import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createPostgresBillingRepositories } from '../../packages/db/src/billing/repository.ts';
import { captureLead } from '../../packages/domain/src/lead/service.ts';
import {
  createFixtureBillingProviderAdapter,
  fixtureWebhookSignature,
  type FixtureBillingProviderAdapter,
} from '../../packages/domain/src/billing/fixture-adapter.ts';
import { parseBillingFeatureConfig } from '../../packages/domain/src/billing/config.ts';
import { createBillingServices } from '../../packages/domain/src/billing/service.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../packages/domain/src/billing/types.ts';
import type { BillingProviderAccountRef } from '../../packages/contracts/src/billing/index.ts';

let pool: DbPool;
let appConfig: AppConfig;
let adapter: FixtureBillingProviderAdapter;

const providerAccount: BillingProviderAccountRef = {
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: 'acct_fixture_ot46',
};

const ownerActor: BillingActorContext = {
  actor_key: 'user_owner',
  role: 'owner',
  active: true,
};

const checkoutPayload = {
  principal_key: 'principal_owner',
  offer_key: 'ot46_fixture_offer',
  idempotency_key: 'checkout_idem_0001',
  version: 1 as const,
};

beforeEach(async () => {
  appConfig = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  adapter = createFixtureBillingProviderAdapter({
    providerAccountRef: providerAccount,
    idGenerator: deterministicIds(),
    now: () => new Date('2026-07-14T12:00:00Z'),
  });
});

afterEach(async () => {
  await pool.end();
});

describe('OT-46 billing migration constraints', () => {
  it('applies the OT-46 migration and rejects live-mode provider rows', async () => {
    const applied = await pool.query(
      "SELECT checksum FROM onetime.schema_migrations WHERE id = '1300_ot46_billing_foundation'",
    );
    expect(applied.rowCount).toBe(1);
    await expect(
      pool.query(
        `INSERT INTO onetime.billing_provider_accounts
         (provider, mode, provider_account_ref, status)
         VALUES ('stripe','live','acct_live_forbidden','active')`,
      ),
    ).rejects.toThrow();
  });
});

describe('OT-46 fixture checkout, portal, webhook, and public signup isolation', () => {
  it('denies checkout while feature flags default off', async () => {
    const services = servicesFor(parseBillingFeatureConfig({}));
    const result = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: checkoutPayload,
    });
    expect(result).toMatchObject({ ok: false, code: 'BILLING_CHECKOUT_DISABLED' });
    expect(adapter.invocationCounts.createCheckoutSession).toBe(0);
  });

  it('creates an idempotent fixture checkout without changing entitlement', async () => {
    const services = servicesFor(enabledConfig());
    const first = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: checkoutPayload,
    });
    const second = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: checkoutPayload,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.checkout_request_key).toBe(first.value.checkout_request_key);
      expect(second.value.status).toBe('replayed');
      expect(first.value.entitlement_changed).toBe(false);
    }
    expect(adapter.invocationCounts.createCheckoutSession).toBe(1);
    const entitlements = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.billing_entitlement_projections',
    );
    expect(numberCount(entitlements.rows[0].count)).toBe(0);
  });

  it('rejects browser-supplied provider fields and cross-principal access', async () => {
    const services = servicesFor(enabledConfig());
    const suppliedProvider = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: { ...checkoutPayload, provider_customer_ref: 'fixture_cus_browser' },
    });
    expect(suppliedProvider).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });

    const wrongPrincipal = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: { ...checkoutPayload, principal_key: 'principal_other' },
    });
    expect(wrongPrincipal).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('keeps public signup independent of billing and never invokes the billing adapter', async () => {
    await captureLead({
      pool,
      config: appConfig,
      payload: {
        contact_name: 'Miriam Parent',
        family_or_school: 'Dratler Family',
        audience_type: 'family',
        location: 'Ramat Beit Shemesh',
        timezone: 'Asia/Jerusalem',
        email: 'miriam.ot46@example.test',
        phone: '',
        reminder_preference: 'email',
        reminder_consent: true,
        idempotency_key: 'public_signup_ot46',
        attribution: { landing_path: '/signup' },
      },
    });
    await expectCount('contacts', 1);
    await expectCount('signup_leads', 1);
    await expectCount('outbox_events', 2);
    await expectCount('billing_checkout_sessions', 0);
    expect(adapter.invocationCounts.createCheckoutSession).toBe(0);
  });

  it('creates a portal session only after a local customer mapping exists', async () => {
    const services = servicesFor(enabledConfig());
    const beforeCheckout = await services.requestCustomerPortalSession({
      actor: ownerActor,
      payload: { principal_key: 'principal_owner', idempotency_key: 'portal_001', version: 1 },
    });
    expect(beforeCheckout).toMatchObject({ ok: false, code: 'NO_BILLING_CUSTOMER' });

    await services.requestCheckoutSession({ actor: ownerActor, payload: checkoutPayload });
    const afterCheckout = await services.requestCustomerPortalSession({
      actor: ownerActor,
      payload: { principal_key: 'principal_owner', idempotency_key: 'portal_002', version: 1 },
    });
    expect(afterCheckout.ok).toBe(true);
    expect(adapter.invocationCounts.createCustomerPortalSession).toBe(1);
  });

  it('handles valid, duplicate, changed-byte, stale, wrong-scope, and unknown webhook events', async () => {
    const services = servicesFor(enabledConfig());
    await services.requestCheckoutSession({ actor: ownerActor, payload: checkoutPayload });
    const customer = await providerCustomerRef();

    const active = await receiveFixtureEvent(services, {
      id: 'evt_active_1',
      type: 'customer.subscription.updated',
      created: '2026-07-14T12:00:00Z',
      object: {
        id: 'fixture_sub_001',
        customer,
        status: 'active',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        current_period_end: '2026-08-14T12:00:00Z',
      },
    });
    expect(active).toMatchObject({ ok: true, value: { disposition: 'accepted' } });

    const duplicate = await receiveFixtureEvent(services, {
      id: 'evt_active_1',
      type: 'customer.subscription.updated',
      created: '2026-07-14T12:00:00Z',
      object: {
        id: 'fixture_sub_001',
        customer,
        status: 'active',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        current_period_end: '2026-08-14T12:00:00Z',
      },
    });
    expect(duplicate).toMatchObject({ ok: true, value: { disposition: 'duplicate' } });

    const changed = await receiveFixtureEvent(services, {
      id: 'evt_active_1',
      type: 'customer.subscription.updated',
      created: '2026-07-14T12:00:01Z',
      object: {
        id: 'fixture_sub_001',
        customer,
        status: 'past_due',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
      },
    });
    expect(changed).toMatchObject({ ok: false, code: 'DIGEST_MISMATCH' });

    const stale = await receiveFixtureEvent(services, {
      id: 'evt_stale_1',
      type: 'customer.subscription.updated',
      created: '2026-07-13T12:00:00Z',
      object: {
        id: 'fixture_sub_001',
        customer,
        status: 'past_due',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
      },
    });
    expect(stale).toMatchObject({ ok: true, value: { disposition: 'stale_event' } });

    const wrongScope = await receiveFixtureEvent(services, {
      id: 'evt_wrong_scope',
      type: 'customer.subscription.updated',
      created: '2026-07-14T12:10:00Z',
      object: {
        id: 'fixture_sub_002',
        customer,
        status: 'active',
        account_key: 'one_time',
        product_key: 'wrong_product',
      },
    });
    expect(wrongScope).toMatchObject({ ok: true, value: { disposition: 'wrong_scope' } });

    const unknown = await receiveFixtureEvent(services, {
      id: 'evt_unknown_type',
      type: 'customer.created',
      created: '2026-07-14T12:11:00Z',
      object: { id: customer, customer },
    });
    expect(unknown).toMatchObject({ ok: true, value: { disposition: 'unknown_event' } });

    const summary = await services.billingSummary({
      actor: ownerActor,
      principal_key: 'principal_owner',
    });
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.value.entitlement?.status).toBe('active');
      expect(summary.value.entitlement?.grants_access).toBe(false);
    }
  });

  it('rejects forged, changed raw-byte, oversized, parsed-body, live, and wrong-account webhook input', async () => {
    const services = servicesFor(enabledConfig());
    await services.requestCheckoutSession({ actor: ownerActor, payload: checkoutPayload });
    const customer = await providerCustomerRef();
    const raw = rawFixtureEvent({
      id: 'evt_sig_1',
      type: 'customer.subscription.updated',
      created: '2026-07-14T12:00:00Z',
      object: { id: 'fixture_sub_sig', customer, status: 'trialing' },
    });
    expect(await services.receiveWebhook({ rawBody: raw })).toMatchObject({
      ok: false,
      code: 'INVALID_SIGNATURE',
    });
    expect(
      await services.receiveWebhook({
        rawBody: Buffer.from(raw.toString('utf8').replace('trialing', 'active')),
        signatureHeader: fixtureWebhookSignature({ rawBody: raw }),
      }),
    ).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
    expect(await services.receiveWebhook({ rawBody: Buffer.alloc(65 * 1024) })).toMatchObject({
      ok: false,
      code: 'OVERSIZED',
    });
    expect(await services.receiveWebhook({ rawBody: { parsed: true } })).toMatchObject({
      ok: false,
      code: 'PARSED_BODY_MISUSE',
    });
    expect(
      await receiveFixtureEvent(services, {
        id: 'evt_live',
        type: 'customer.subscription.updated',
        created: '2026-07-14T12:00:00Z',
        livemode: true,
        object: { id: 'fixture_sub_live', customer, status: 'active' },
      }),
    ).toMatchObject({ ok: false, code: 'LIVE_MODE_REJECTED' });
    expect(
      await receiveFixtureEvent(services, {
        id: 'evt_wrong_account',
        type: 'customer.subscription.updated',
        account: 'acct_fixture_wrong',
        created: '2026-07-14T12:00:00Z',
        object: { id: 'fixture_sub_wrong', customer, status: 'active' },
      }),
    ).toMatchObject({ ok: false, code: 'WRONG_PROVIDER_ACCOUNT' });
  });

  it('returns safe provider outage errors and supports bounded reconciliation', async () => {
    const services = servicesFor(enabledConfig(), {
      createCheckoutSession: async () => {
        throw new Error('provider unavailable');
      },
    });
    const checkout = await services.requestCheckoutSession({
      actor: ownerActor,
      payload: { ...checkoutPayload, idempotency_key: 'provider_down_1' },
    });
    expect(checkout).toMatchObject({ ok: false, code: 'PROVIDER_UNAVAILABLE' });

    const normal = servicesFor(enabledConfig());
    const reconciliation = await normal.requestReconciliation({
      actor: ownerActor,
      payload: {
        principal_key: 'principal_owner',
        reason: 'operator_requested_fixture_check',
        idempotency_key: 'reconcile_idem_1',
        version: 1,
      },
    });
    expect(reconciliation.ok).toBe(true);
  });
});

function enabledConfig(): BillingFeatureConfig {
  return parseBillingFeatureConfig({
    ONE_TIME_BILLING_FOUNDATION_ENABLED: 'true',
    ONE_TIME_BILLING_TRANSPORT_ENABLED: 'true',
    ONE_TIME_BILLING_CHECKOUT_ENABLED: 'true',
    ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED: 'true',
    ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED: 'true',
    ONE_TIME_BILLING_RECONCILIATION_ENABLED: 'true',
    ONE_TIME_BILLING_MODE: 'test',
    ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN: 'https://join.onetimeonetime.com',
    ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF: providerAccount.provider_account_ref,
    ONE_TIME_BILLING_OFFERS_JSON: JSON.stringify([
      {
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        offer_key: 'ot46_fixture_offer',
        provider: 'stripe',
        mode: 'test',
        provider_account_ref: providerAccount.provider_account_ref,
        provider_price_ref: 'price_fixture_ot46_monthly',
        currency: 'usd',
        amount_cents: 0,
        synthetic: true,
      },
    ]),
  });
}

function servicesFor(
  config: BillingFeatureConfig,
  adapterOverrides: Partial<FixtureBillingProviderAdapter> = {},
) {
  return createBillingServices({
    config,
    repositories: createPostgresBillingRepositories(pool),
    providerAdapter: { ...adapter, ...adapterOverrides },
    authorization,
  });
}

const authorization: BillingAuthorizationAdapter = {
  async resolvePrincipal({ actor, requested_principal_key }) {
    if (!actor.active || actor.role === 'public') return { ok: false, reason: 'inactive_session' };
    if (requested_principal_key !== 'principal_owner') return { ok: false, reason: 'wrong_scope' };
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return { ok: false, reason: 'insufficient_capability' };
    }
    return {
      ok: true,
      principal: {
        principal_key: requested_principal_key,
        principal_type: 'account_user',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
      },
      capabilities: ['billing:read', 'billing:checkout', 'billing:portal', 'billing:reconcile'],
    };
  },
};

function rawFixtureEvent(input: {
  id: string;
  type: string;
  created: string;
  account?: string;
  livemode?: boolean;
  object: Record<string, unknown>;
}) {
  return Buffer.from(
    JSON.stringify({
      id: input.id,
      type: input.type,
      account: input.account ?? providerAccount.provider_account_ref,
      created: input.created,
      livemode: input.livemode ?? false,
      data: { object: input.object },
    }),
  );
}

async function receiveFixtureEvent(
  services: ReturnType<typeof servicesFor>,
  input: Parameters<typeof rawFixtureEvent>[0],
) {
  const rawBody = rawFixtureEvent(input);
  return services.receiveWebhook({
    rawBody,
    signatureHeader: fixtureWebhookSignature({ rawBody }),
  });
}

async function providerCustomerRef() {
  const result = await pool.query(
    `SELECT provider_customer_ref
       FROM onetime.billing_principal_customers
      WHERE principal_key = 'principal_owner'
      LIMIT 1`,
  );
  return String(result.rows[0].provider_customer_ref);
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
