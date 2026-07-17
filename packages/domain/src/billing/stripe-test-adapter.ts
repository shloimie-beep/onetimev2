import type {
  BillingPrincipalRef,
  BillingProviderAdapter,
  BillingProviderAccountRef,
  BillingSubscriptionStatus,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionOutput,
  ProviderEventObjectRefs,
  ProviderEventVerificationInput,
  ProviderPortalSessionInput,
  ProviderPortalSessionOutput,
  ProviderVerifiedEvent,
} from '../../../contracts/src/billing/index.ts';
import { assertNoLiveReference, redactedRefHash, stableProviderKey } from '../providers/shared.ts';

export type StripeTestCheckoutSession = {
  id: string;
  url: string | null;
  customer: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  livemode: boolean;
};

export type StripeTestPortalSession = {
  id: string;
  url: string;
  livemode: boolean;
};

export type StripeTestEvent = {
  id: string;
  type: string;
  account?: string | null;
  created: number;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
};

export type StripeTestClient = {
  checkout: {
    sessions: {
      create(
        params: Record<string, unknown>,
        options: { idempotencyKey: string },
      ): Promise<StripeTestCheckoutSession>;
    };
  };
  billingPortal: {
    sessions: {
      create(
        params: Record<string, unknown>,
        options: { idempotencyKey: string },
      ): Promise<StripeTestPortalSession>;
    };
  };
  webhooks: {
    constructEvent(rawBody: Buffer, signatureHeader: string, secret: string): StripeTestEvent;
  };
  customers: {
    create(
      params: Record<string, unknown>,
      options: { idempotencyKey: string },
    ): Promise<{ id: string; livemode?: boolean }>;
    retrieve(providerCustomerRef: string): Promise<{ id: string; deleted?: boolean } | null>;
  };
  subscriptions: {
    retrieve(
      providerSubscriptionRef: string,
    ): Promise<{ id: string; status: BillingSubscriptionStatus } | null>;
  };
  invoices: {
    retrieve(providerInvoiceRef: string): Promise<{ id: string; status: string } | null>;
  };
};

export type StripeRedirectVault = {
  store(input: {
    redirectKey: string;
    provider: 'stripe';
    mode: 'test';
    providerUrl: string;
    expiresAt: Date;
  }): Promise<void> | void;
};

export type StripeTestAdapterOptions = {
  client: StripeTestClient;
  webhookSecret: string;
  providerAccountRef: BillingProviderAccountRef;
  redirectVault: StripeRedirectVault;
  portalConfigurationRef?: string | undefined;
  checkoutTtlMs?: number;
  portalTtlMs?: number;
  clock?: () => Date;
};

export function createStripeTestBillingProviderAdapter(
  options: StripeTestAdapterOptions,
): BillingProviderAdapter {
  assertTestProviderAccount(options.providerAccountRef);
  assertNoLiveReference('stripe webhook secret', options.webhookSecret);
  if (options.portalConfigurationRef) {
    assertNoLiveReference('stripe portal configuration', options.portalConfigurationRef);
  }
  const clock = options.clock ?? (() => new Date());

  return {
    adapter_name: 'stripe_test_provider',
    async createCheckoutSession(
      input: ProviderCheckoutSessionInput,
    ): Promise<ProviderCheckoutSessionOutput> {
      assertTestProviderAccount(input.providerAccount);
      assertSameProviderAccount(input.providerAccount, options.providerAccountRef);
      assertNoLiveReference('stripe price', input.offer.provider_price_ref);
      const customerRef =
        input.provider_customer_ref ??
        (await createTestCustomer({
          client: options.client,
          principal: input.principal,
          idempotencyKey: input.idempotencyKey,
          policyVersion: input.policyVersion ?? '2026-07-15.1',
        }));
      assertNoLiveReference('stripe customer', customerRef);
      const metadata = principalMetadata(
        input.principal,
        input.offer.offer_key,
        input.policyVersion ?? '2026-07-15.1',
      );
      const session = await options.client.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: customerRef,
          line_items: [{ price: input.offer.provider_price_ref, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          client_reference_id: input.localCheckoutRequestKey ?? input.principal.principal_key,
          allow_promotion_codes: false,
          metadata,
          subscription_data: {
            metadata,
          },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      const url = requireProviderUrl(session.url, 'checkout');
      rejectLiveMode(session.livemode);
      assertNoLiveReference('stripe checkout session', session.id);
      const returnedCustomerRef = providerRefFrom(session.customer, 'customer');
      const subscriptionRef = optionalProviderRefFrom(session.subscription, 'subscription');
      const redirectUrl = await storeRedirect({
        vault: options.redirectVault,
        providerUrl: url,
        prefix: 'checkout',
        providerRef: session.id,
        ttlMs: options.checkoutTtlMs ?? 30 * 60 * 1000,
        now: clock(),
      });
      return {
        provider_checkout_session_ref: session.id,
        provider_customer_ref: returnedCustomerRef,
        ...(subscriptionRef ? { provider_subscription_ref: subscriptionRef } : {}),
        redirect_url: redirectUrl,
        mode: 'test',
        livemode: false,
      };
    },
    async createCustomerPortalSession(
      input: ProviderPortalSessionInput,
    ): Promise<ProviderPortalSessionOutput> {
      assertTestProviderAccount(input.providerAccount);
      assertSameProviderAccount(input.providerAccount, options.providerAccountRef);
      assertNoLiveReference('stripe customer', input.provider_customer_ref);
      const configuration =
        input.provider_portal_configuration_ref ?? options.portalConfigurationRef ?? undefined;
      if (configuration) assertNoLiveReference('stripe portal configuration', configuration);
      const session = await options.client.billingPortal.sessions.create(
        {
          customer: input.provider_customer_ref,
          ...(configuration ? { configuration } : {}),
          return_url: input.returnUrl,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      rejectLiveMode(session.livemode);
      assertNoLiveReference('stripe portal session', session.id);
      const redirectUrl = await storeRedirect({
        vault: options.redirectVault,
        providerUrl: requireProviderUrl(session.url, 'portal'),
        prefix: 'portal',
        providerRef: session.id,
        ttlMs: options.portalTtlMs ?? 10 * 60 * 1000,
        now: clock(),
      });
      return {
        provider_portal_session_ref: session.id,
        redirect_url: redirectUrl,
        mode: 'test',
        livemode: false,
      };
    },
    async verifyWebhook(input: ProviderEventVerificationInput): Promise<ProviderVerifiedEvent> {
      if (!input.signatureHeader) throw new Error('Missing Stripe signature header.');
      const event = options.client.webhooks.constructEvent(
        input.rawBody,
        input.signatureHeader,
        options.webhookSecret,
      );
      rejectLiveMode(event.livemode);
      const providerAccountRef = event.account ?? options.providerAccountRef.provider_account_ref;
      assertNoLiveReference('stripe event account', providerAccountRef);
      const objectRefs = extractObjectRefs(event);
      return {
        provider: 'stripe',
        mode: 'test',
        provider_account_ref: providerAccountRef,
        provider_event_id: event.id,
        event_type: event.type,
        provider_created_at: new Date(event.created * 1000).toISOString(),
        livemode: event.livemode,
        object_refs: objectRefs,
        minimized_payload: {
          type: event.type,
          account_configured: Boolean(event.account),
          object_ref_keys: Object.keys(objectRefs).sort(),
        },
      };
    },
    async retrieveCustomer(providerCustomerRef: string) {
      assertNoLiveReference('stripe customer', providerCustomerRef);
      const customer = await options.client.customers.retrieve(providerCustomerRef);
      if (!customer || customer.deleted) return null;
      return { provider_customer_ref: customer.id };
    },
    async retrieveSubscription(providerSubscriptionRef: string) {
      assertNoLiveReference('stripe subscription', providerSubscriptionRef);
      const subscription = await options.client.subscriptions.retrieve(providerSubscriptionRef);
      return subscription
        ? { provider_subscription_ref: subscription.id, status: subscription.status }
        : null;
    },
    async retrieveInvoice(providerInvoiceRef: string) {
      assertNoLiveReference('stripe invoice', providerInvoiceRef);
      const invoice = await options.client.invoices.retrieve(providerInvoiceRef);
      return invoice ? { provider_invoice_ref: invoice.id, status: invoice.status } : null;
    },
    async reconcileBillingPrincipal(_principal: BillingPrincipalRef) {
      return {
        status: 'failed',
        reason: 'stripe_reconciliation_requires_future_customer_subscription_query_gate',
      };
    },
  };
}

function assertTestProviderAccount(account: BillingProviderAccountRef) {
  if (account.provider !== 'stripe' || account.mode !== 'test') {
    throw new Error('Stripe billing adapter accepts test-mode Stripe only.');
  }
  assertNoLiveReference('stripe provider account', account.provider_account_ref);
}

function assertSameProviderAccount(
  actual: BillingProviderAccountRef,
  expected: BillingProviderAccountRef,
) {
  if (
    actual.provider !== expected.provider ||
    actual.mode !== expected.mode ||
    actual.provider_account_ref !== expected.provider_account_ref
  ) {
    throw new Error('Stripe provider account mismatch.');
  }
}

function principalMetadata(
  principal: BillingPrincipalRef,
  offerKey: string,
  policyVersion: string,
) {
  return {
    account_key: principal.account_key,
    product_key: principal.product_key,
    principal_key: principal.principal_key,
    principal_type: principal.principal_type,
    offer_key: offerKey,
    policy_version: policyVersion,
  };
}

function rejectLiveMode(livemode: boolean) {
  if (livemode) throw new Error('Live Stripe object rejected.');
}

function providerRefFrom(value: string | { id: string } | null | undefined, label: string) {
  const ref = typeof value === 'string' ? value : value?.id;
  if (!ref) throw new Error(`Stripe ${label} reference missing.`);
  assertNoLiveReference(`stripe ${label}`, ref);
  return ref;
}

function optionalProviderRefFrom(value: string | { id: string } | null | undefined, label: string) {
  const ref = typeof value === 'string' ? value : value?.id;
  if (!ref) return undefined;
  assertNoLiveReference(`stripe ${label}`, ref);
  return ref;
}

function requireProviderUrl(value: string | null, purpose: 'checkout' | 'portal') {
  if (!value) throw new Error(`Stripe ${purpose} URL missing.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('stripe.com')) {
    throw new Error(`Stripe ${purpose} URL rejected.`);
  }
  return value;
}

async function storeRedirect(input: {
  vault: StripeRedirectVault;
  providerUrl: string;
  prefix: 'checkout' | 'portal';
  providerRef: string;
  ttlMs: number;
  now: Date;
}) {
  const redirectKey = stableProviderKey(`stripe_${input.prefix}`, [
    input.providerRef,
    redactedRefHash(input.providerUrl),
  ]);
  await input.vault.store({
    redirectKey,
    provider: 'stripe',
    mode: 'test',
    providerUrl: input.providerUrl,
    expiresAt: new Date(input.now.getTime() + input.ttlMs),
  });
  return `/app/billing/${input.prefix}/redirect/${encodeURIComponent(redirectKey)}`;
}

function extractObjectRefs(event: StripeTestEvent): ProviderEventObjectRefs {
  const object = event.data.object;
  const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata : {};
  const subscriptionDetails =
    object.subscription_details && typeof object.subscription_details === 'object'
      ? object.subscription_details
      : {};
  const refs: ProviderEventObjectRefs = {};
  setString(refs, 'provider_customer_ref', object.customer);
  setString(refs, 'provider_subscription_ref', object.subscription ?? object.id);
  if (event.type.startsWith('invoice.')) setString(refs, 'provider_invoice_ref', object.id);
  if (event.type.startsWith('charge.')) setString(refs, 'provider_invoice_ref', object.invoice);
  if (event.type.startsWith('checkout.'))
    setString(refs, 'provider_checkout_session_ref', object.id);
  setString(refs, 'status', object.status);
  setString(
    refs,
    'account_key',
    object.account_key ?? (metadata as Record<string, unknown>).account_key,
  );
  setString(
    refs,
    'product_key',
    object.product_key ?? (metadata as Record<string, unknown>).product_key,
  );
  setString(
    refs,
    'principal_key',
    object.principal_key ?? (metadata as Record<string, unknown>).principal_key,
  );
  setString(refs, 'offer_key', object.offer_key ?? (metadata as Record<string, unknown>).offer_key);
  setString(
    refs,
    'provider_price_ref',
    object.provider_price_ref ?? object.price ?? firstNestedRef(object, 'price'),
  );
  setString(
    refs,
    'provider_product_ref',
    object.provider_product_ref ?? object.product ?? firstNestedRef(object, 'product'),
  );
  setString(
    refs,
    'policy_version',
    object.policy_version ??
      (metadata as Record<string, unknown>).policy_version ??
      (subscriptionDetails as Record<string, unknown>).metadata_policy_version,
  );
  setString(refs, 'checkout_request_key', object.client_reference_id);
  refs.current_period_start = isoFromValue(object.current_period_start);
  refs.current_period_end = isoFromValue(object.current_period_end);
  refs.cancel_at = isoFromValue(object.cancel_at);
  refs.canceled_at = isoFromValue(object.canceled_at);
  refs.cancel_at_period_end = Boolean(object.cancel_at_period_end);
  refs.latest_invoice_ref = stringFromValue(object.latest_invoice);
  setNumber(refs, 'amount_due_cents', object.amount_due);
  setNumber(refs, 'amount_paid_cents', object.amount_paid);
  setNumber(refs, 'refunded_amount_cents', object.amount_refunded);
  setString(refs, 'currency', object.currency);
  const disputeState = stringFromValue(object.dispute_state ?? object.status);
  if (
    event.type.startsWith('charge.dispute.') &&
    (disputeState === 'created' ||
      disputeState === 'won' ||
      disputeState === 'lost' ||
      disputeState === 'closed')
  ) {
    refs.dispute_state = disputeState;
  }
  refs.issued_at = isoFromValue(object.created);
  return refs;
}

async function createTestCustomer(input: {
  client: StripeTestClient;
  principal: BillingPrincipalRef;
  idempotencyKey: string;
  policyVersion: string;
}) {
  const customer = await input.client.customers.create(
    {
      metadata: {
        account_key: input.principal.account_key,
        product_key: input.principal.product_key,
        principal_key: input.principal.principal_key,
        principal_type: input.principal.principal_type,
        policy_version: input.policyVersion,
      },
    },
    { idempotencyKey: `${input.idempotencyKey}:customer` },
  );
  rejectLiveMode(Boolean(customer.livemode));
  assertNoLiveReference('stripe customer', customer.id);
  return customer.id;
}

function stringFromValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return null;
}

function isoFromValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function setString<T extends keyof ProviderEventObjectRefs>(
  refs: ProviderEventObjectRefs,
  key: T,
  value: unknown,
) {
  if (typeof value === 'string' && value.trim()) {
    (refs as Record<string, string>)[key] = value.trim();
  } else if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    (refs as Record<string, string>)[key] = value.id;
  }
}

function setNumber<T extends keyof ProviderEventObjectRefs>(
  refs: ProviderEventObjectRefs,
  key: T,
  value: unknown,
) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    (refs as Record<string, number>)[key] = Math.trunc(value);
  }
}

function firstNestedRef(object: Record<string, unknown>, label: 'price' | 'product') {
  const direct = object[label];
  const directRef = stringFromValue(direct);
  if (directRef) return directRef;
  const lines = object.lines;
  const line = firstDataObject(lines);
  const linePrice = stringFromValue(line?.price);
  if (label === 'price' && linePrice) return linePrice;
  const lineProduct = stringFromValue(
    line?.product ?? (line?.price as Record<string, unknown>)?.product,
  );
  if (label === 'product' && lineProduct) return lineProduct;
  const items = object.items;
  const item = firstDataObject(items);
  const itemPrice = stringFromValue(item?.price);
  if (label === 'price' && itemPrice) return itemPrice;
  const itemProduct = stringFromValue(
    item?.product ?? (item?.price as Record<string, unknown>)?.product,
  );
  if (label === 'product' && itemProduct) return itemProduct;
  return null;
}

function firstDataObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = (value as Record<string, unknown>).data;
  if (!Array.isArray(data)) return undefined;
  const first = data.find((item) => item && typeof item === 'object');
  return first as Record<string, unknown> | undefined;
}
