import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
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

type FixtureAdapterOptions = {
  providerAccountRef: BillingProviderAccountRef;
  webhookSecret?: string;
  signatureToleranceSeconds?: number;
  now?: () => Date;
  idGenerator?: (prefix: string) => string;
};

export type FixtureBillingProviderAdapter = BillingProviderAdapter & {
  readonly invocationCounts: {
    createCheckoutSession: number;
    createCustomerPortalSession: number;
    verifyWebhook: number;
    retrieveCustomer: number;
    retrieveSubscription: number;
    retrieveInvoice: number;
    reconcileBillingPrincipal: number;
  };
  readonly storedRefs: {
    customers: Set<string>;
    subscriptions: Map<string, BillingSubscriptionStatus>;
    invoices: Map<string, string>;
  };
};

const defaultSecret = 'fixture_webhook_secret_for_ot46_only';

export function createFixtureBillingProviderAdapter(
  options: FixtureAdapterOptions,
): FixtureBillingProviderAdapter {
  const counts = {
    createCheckoutSession: 0,
    createCustomerPortalSession: 0,
    verifyWebhook: 0,
    retrieveCustomer: 0,
    retrieveSubscription: 0,
    retrieveInvoice: 0,
    reconcileBillingPrincipal: 0,
  };
  const storedRefs = {
    customers: new Set<string>(),
    subscriptions: new Map<string, BillingSubscriptionStatus>(),
    invoices: new Map<string, string>(),
  };
  const now = options.now ?? (() => new Date());
  const idGenerator =
    options.idGenerator ??
    ((prefix: string) =>
      `${prefix}_${createHash('sha256').update(String(now().getTime())).digest('hex').slice(0, 18)}`);

  return {
    adapter_name: 'fixture_billing_provider',
    invocationCounts: counts,
    storedRefs,
    async createCheckoutSession(
      input: ProviderCheckoutSessionInput,
    ): Promise<ProviderCheckoutSessionOutput> {
      counts.createCheckoutSession += 1;
      assertFixtureScope(input.providerAccount, options.providerAccountRef);
      const customerRef = fixtureCustomerRef(input.principal);
      const subscriptionRef = idGenerator('fixture_sub');
      storedRefs.customers.add(customerRef);
      storedRefs.subscriptions.set(subscriptionRef, 'incomplete');
      return {
        provider_checkout_session_ref: idGenerator('fixture_cs'),
        provider_customer_ref: customerRef,
        provider_subscription_ref: subscriptionRef,
        redirect_url: `/app/billing/fixture-checkout/${encodeURIComponent(input.idempotencyKey)}`,
        mode: 'test',
        livemode: false,
      };
    },
    async createCustomerPortalSession(
      input: ProviderPortalSessionInput,
    ): Promise<ProviderPortalSessionOutput> {
      counts.createCustomerPortalSession += 1;
      assertFixtureScope(input.providerAccount, options.providerAccountRef);
      storedRefs.customers.add(input.provider_customer_ref);
      return {
        provider_portal_session_ref: idGenerator('fixture_bps'),
        redirect_url: `/app/billing/fixture-portal/${encodeURIComponent(input.idempotencyKey)}`,
        mode: 'test',
        livemode: false,
      };
    },
    async verifyWebhook(input: ProviderEventVerificationInput): Promise<ProviderVerifiedEvent> {
      counts.verifyWebhook += 1;
      verifyFixtureSignature(
        input.rawBody,
        input.signatureHeader,
        options.webhookSecret ?? defaultSecret,
        options.signatureToleranceSeconds ?? 300,
      );
      const payload = JSON.parse(input.rawBody.toString('utf8')) as FixtureWebhookPayload;
      const objectRefs = extractObjectRefs(payload);
      return {
        provider: 'stripe',
        mode: 'test',
        provider_account_ref: payload.account,
        provider_event_id: payload.id,
        event_type: payload.type,
        provider_created_at: new Date(payload.created).toISOString(),
        livemode: payload.livemode,
        object_refs: objectRefs,
        minimized_payload: {
          type: payload.type,
          account: payload.account,
          object_ref_keys: Object.keys(objectRefs).sort(),
        },
      };
    },
    async retrieveCustomer(providerCustomerRef: string) {
      counts.retrieveCustomer += 1;
      return storedRefs.customers.has(providerCustomerRef)
        ? { provider_customer_ref: providerCustomerRef }
        : null;
    },
    async retrieveSubscription(providerSubscriptionRef: string) {
      counts.retrieveSubscription += 1;
      const status = storedRefs.subscriptions.get(providerSubscriptionRef);
      return status ? { provider_subscription_ref: providerSubscriptionRef, status } : null;
    },
    async retrieveInvoice(providerInvoiceRef: string) {
      counts.retrieveInvoice += 1;
      const status = storedRefs.invoices.get(providerInvoiceRef);
      return status ? { provider_invoice_ref: providerInvoiceRef, status } : null;
    },
    async reconcileBillingPrincipal(_principal: BillingPrincipalRef) {
      counts.reconcileBillingPrincipal += 1;
      return { status: 'succeeded', reason: 'fixture_reconciliation_completed' };
    },
  };
}

export function fixtureWebhookSignature({
  rawBody,
  timestamp = Math.floor(Date.now() / 1000),
  secret = defaultSecret,
}: {
  rawBody: Buffer;
  timestamp?: number;
  secret?: string;
}) {
  const signed = `${timestamp}.${rawBody.toString('utf8')}`;
  const digest = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

function verifyFixtureSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  toleranceSeconds: number,
) {
  if (!header) throw new Error('Missing fixture billing signature.');
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );
  const timestamp = Number(parts.t);
  const expected = fixtureWebhookSignature({ rawBody, timestamp, secret }).split('v1=')[1] ?? '';
  const actual = parts.v1 ?? '';
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) {
    throw new Error('Fixture billing signature timestamp is stale.');
  }
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Fixture billing signature verification failed.');
  }
}

type FixtureWebhookPayload = {
  id: string;
  type: string;
  account: string;
  created: string;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
};

function extractObjectRefs(payload: FixtureWebhookPayload): ProviderEventObjectRefs {
  const object = payload.data.object;
  const refs: ProviderEventObjectRefs = {};
  setString(refs, 'provider_customer_ref', object.customer);
  setString(refs, 'provider_subscription_ref', object.subscription ?? object.id);
  if (payload.type.startsWith('invoice.')) setString(refs, 'provider_invoice_ref', object.id);
  if (payload.type.startsWith('charge.')) setString(refs, 'provider_invoice_ref', object.invoice);
  if (payload.type.startsWith('checkout.'))
    setString(refs, 'provider_checkout_session_ref', object.id);
  setString(refs, 'status', object.status);
  const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata : {};
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
    object.policy_version ?? (metadata as Record<string, unknown>).policy_version,
  );
  setString(refs, 'checkout_request_key', object.client_reference_id);
  refs.current_period_start = stringValue(object.current_period_start) ?? null;
  refs.current_period_end = stringValue(object.current_period_end) ?? null;
  refs.cancel_at = stringValue(object.cancel_at) ?? null;
  refs.canceled_at = stringValue(object.canceled_at) ?? null;
  refs.cancel_at_period_end = Boolean(object.cancel_at_period_end);
  refs.latest_invoice_ref = stringValue(object.latest_invoice) ?? null;
  const amountDue = numberValue(object.amount_due_cents);
  const amountPaid = numberValue(object.amount_paid_cents);
  const refunded = numberValue(object.refunded_amount_cents);
  if (amountDue !== undefined) refs.amount_due_cents = amountDue;
  if (amountPaid !== undefined) refs.amount_paid_cents = amountPaid;
  if (refunded !== undefined) refs.refunded_amount_cents = refunded;
  setString(refs, 'currency', object.currency);
  const disputeState = stringValue(object.dispute_state);
  if (
    disputeState === 'none' ||
    disputeState === 'created' ||
    disputeState === 'won' ||
    disputeState === 'lost' ||
    disputeState === 'closed'
  ) {
    refs.dispute_state = disputeState;
  }
  refs.issued_at = stringValue(object.issued_at) ?? null;
  return refs;
}

function assertFixtureScope(
  actual: BillingProviderAccountRef,
  expected: BillingProviderAccountRef,
) {
  if (
    actual.provider !== expected.provider ||
    actual.mode !== expected.mode ||
    actual.provider_account_ref !== expected.provider_account_ref
  ) {
    throw new Error('Fixture provider account mismatch.');
  }
}

function fixtureCustomerRef(principal: BillingPrincipalRef) {
  return `fixture_cus_${createHash('sha256')
    .update(`${principal.account_key}:${principal.product_key}:${principal.principal_key}`)
    .digest('hex')
    .slice(0, 24)}`;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function firstNestedRef(object: Record<string, unknown>, label: 'price' | 'product') {
  const direct = object[label];
  const directRef = refValue(direct);
  if (directRef) return directRef;
  const lines = object.lines;
  const line = firstDataObject(lines);
  const linePrice = refValue(line?.price);
  if (label === 'price' && linePrice) return linePrice;
  const lineProduct = refValue(line?.product ?? (line?.price as Record<string, unknown>)?.product);
  if (label === 'product' && lineProduct) return lineProduct;
  const items = object.items;
  const item = firstDataObject(items);
  const itemPrice = refValue(item?.price);
  if (label === 'price' && itemPrice) return itemPrice;
  const itemProduct = refValue(item?.product ?? (item?.price as Record<string, unknown>)?.product);
  if (label === 'product' && itemProduct) return itemProduct;
  return undefined;
}

function firstDataObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = (value as Record<string, unknown>).data;
  if (!Array.isArray(data)) return undefined;
  const first = data.find((item) => item && typeof item === 'object');
  return first as Record<string, unknown> | undefined;
}

function refValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return undefined;
}

function setString<T extends keyof ProviderEventObjectRefs>(
  refs: ProviderEventObjectRefs,
  key: T,
  value: unknown,
) {
  const next = stringValue(value);
  if (next) {
    (refs as Record<string, string>)[key] = next;
  }
}
