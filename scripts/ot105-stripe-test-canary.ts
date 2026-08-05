import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { loadOt87CommercialPolicy } from '../packages/domain/src/billing/commercial-policy.ts';

type CanaryStatus =
  | 'waiting_for_authorization'
  | 'waiting_for_stripe_test_resources'
  | 'validated_read_only'
  | 'sandbox_checkout_created'
  | 'blocked';

type CanaryReport = {
  task_id: 'OT-105';
  ok: boolean;
  status: CanaryStatus;
  checked_at: string;
  dry_run: boolean;
  apply: boolean;
  staging_webhook_route: string;
  account_fingerprint: string | null;
  resources: Record<string, string>;
  checkout_session: {
    created: boolean;
    fingerprint: string | null;
    url_fingerprint: string | null;
  };
  portal_session: {
    created: boolean;
    fingerprint: string | null;
    url_fingerprint: string | null;
  };
  webhook_correlation: {
    attempted: boolean;
    status: 'not_run' | 'waiting_for_staging_delivery' | 'blocked';
    note: string;
  };
  missing: string[];
  failures: string[];
  mutations: {
    stripe_test_customers_created: number;
    stripe_test_checkout_sessions_created: number;
    stripe_test_portal_sessions_created: number;
    live_calls: number;
    live_charges: number;
    credential_writes: number;
    production_writes: number;
  };
};

const STAGING_WEBHOOK_ROUTE =
  'https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider';

const args = parseArgs(process.argv.slice(2));
const apply = args.has('--apply');
const outputPath = valueArg(args, '--output') ?? 'ops/codex-runs/OT-105/canary/readiness.json';
const policy = loadOt87CommercialPolicy();

const report: CanaryReport = {
  task_id: 'OT-105',
  ok: false,
  status: 'blocked',
  checked_at: new Date().toISOString(),
  dry_run: !apply,
  apply,
  staging_webhook_route: STAGING_WEBHOOK_ROUTE,
  account_fingerprint: null,
  resources: {},
  checkout_session: {
    created: false,
    fingerprint: null,
    url_fingerprint: null,
  },
  portal_session: {
    created: false,
    fingerprint: null,
    url_fingerprint: null,
  },
  webhook_correlation: {
    attempted: false,
    status: 'not_run',
    note: 'Webhook-to-entitlement correlation requires the staging endpoint, protected TEST signing secret, and a completed sandbox checkout event delivery.',
  },
  missing: [],
  failures: [],
  mutations: {
    stripe_test_customers_created: 0,
    stripe_test_checkout_sessions_created: 0,
    stripe_test_portal_sessions_created: 0,
    live_calls: 0,
    live_charges: 0,
    credential_writes: 0,
    production_writes: 0,
  },
};

try {
  await run();
} catch (error) {
  report.failures.push(safeError(error));
}

if (!report.ok && report.status === 'blocked') {
  if (report.missing.length > 0) {
    report.status = 'waiting_for_stripe_test_resources';
  }
  if (text(process.env.OT105_STRIPE_TEST_CANARY_AUTHORIZED) !== 'true') {
    report.status = 'waiting_for_authorization';
  }
}

emit(report, outputPath);
process.exitCode = report.ok ? 0 : 1;

async function run() {
  if (text(process.env.LIVE_STRIPE_CHARGES_AUTHORIZED) !== 'NO') {
    report.failures.push('LIVE_STRIPE_CHARGES_AUTHORIZED must exactly equal NO.');
  }
  if (text(process.env.OT105_STRIPE_TEST_CANARY_AUTHORIZED) !== 'true') {
    report.failures.push('OT105_STRIPE_TEST_CANARY_AUTHORIZED must exactly equal true.');
    return;
  }

  const secretKey = requiredEnv('ONE_TIME_STRIPE_TEST_SECRET_KEY');
  const expectedAccount = requiredEnv('ONE_TIME_STRIPE_TEST_ACCOUNT_ID');
  const productId = requiredEnv('ONE_TIME_STRIPE_TEST_PRODUCT_ID');
  const priceId = requiredEnv('ONE_TIME_STRIPE_TEST_PRICE_ID');
  const portalConfigId = requiredEnv('ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID');
  const webhookEndpointId = requiredEnv('ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID');
  requiredEnv('ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET');

  if (secretKey && !/^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(secretKey)) {
    report.failures.push('ONE_TIME_STRIPE_TEST_SECRET_KEY must be a Stripe test key.');
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (
      key.includes('STRIPE') &&
      typeof value === 'string' &&
      /_(?:live)_|sk_live_|rk_live_|pk_live_|livemode/i.test(value)
    ) {
      report.failures.push(`Live-like Stripe value rejected for ${key}.`);
    }
  }
  if (report.failures.length > 0 || report.missing.length > 0) return;
  if (
    !secretKey ||
    !expectedAccount ||
    !productId ||
    !priceId ||
    !portalConfigId ||
    !webhookEndpointId
  )
    return;

  const stripe = new Stripe(secretKey);
  const account = await stripe.accounts.retrieve(null);
  rejectLive(account);
  report.account_fingerprint = fingerprint(account.id);
  if (!constantTimeEqual(account.id, expectedAccount)) {
    report.failures.push('Authenticated Stripe account does not match expected TEST account.');
  }

  const [product, price, portalConfig, webhookEndpoint] = await Promise.all([
    stripe.products.retrieve(productId),
    stripe.prices.retrieve(priceId),
    stripe.billingPortal.configurations.retrieve(portalConfigId),
    stripe.webhookEndpoints.retrieve(webhookEndpointId),
  ]);

  validateProduct(product);
  validatePrice(price, productId);
  validatePortalConfiguration(portalConfig);
  validateWebhookEndpoint(webhookEndpoint);

  if (report.failures.length > 0) return;
  if (!apply) {
    report.ok = true;
    report.status = 'validated_read_only';
    return;
  }

  const idempotencySeed = `ot105:${new Date().toISOString().slice(0, 10)}`;
  const customer = await stripe.customers.create(
    {
      metadata: metadata(),
    },
    { idempotencyKey: `${idempotencySeed}:customer` },
  );
  rejectLive(customer);
  report.mutations.stripe_test_customers_created += 1;
  report.resources.synthetic_customer = fingerprint(customer.id);

  const checkout = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: false,
      success_url: `${new URL(STAGING_WEBHOOK_ROUTE).origin}/app/billing/checkout/success`,
      cancel_url: `${new URL(STAGING_WEBHOOK_ROUTE).origin}/app/billing/checkout/cancel`,
      client_reference_id: `ot105_${fingerprint(customer.id)}`,
      metadata: metadata(),
      subscription_data: {
        metadata: metadata(),
      },
    },
    { idempotencyKey: `${idempotencySeed}:checkout` },
  );
  rejectLive(checkout);
  report.checkout_session.created = true;
  report.checkout_session.fingerprint = fingerprint(checkout.id);
  report.checkout_session.url_fingerprint = checkout.url ? fingerprint(checkout.url) : null;
  report.mutations.stripe_test_checkout_sessions_created += 1;

  const portal = await stripe.billingPortal.sessions.create(
    {
      customer: customer.id,
      configuration: portalConfigId,
      return_url: `${new URL(STAGING_WEBHOOK_ROUTE).origin}/app/billing`,
    },
    { idempotencyKey: `${idempotencySeed}:portal` },
  );
  rejectLive(portal);
  report.portal_session.created = true;
  report.portal_session.fingerprint = fingerprint(portal.id);
  report.portal_session.url_fingerprint = portal.url ? fingerprint(portal.url) : null;
  report.mutations.stripe_test_portal_sessions_created += 1;
  report.webhook_correlation = {
    attempted: false,
    status: 'waiting_for_staging_delivery',
    note: 'Sandbox checkout and portal sessions were created. Complete the checkout with Stripe TEST payment details and inspect staging webhook/database readback before marking subscription-entitlement correlation complete.',
  };
  report.ok = true;
  report.status = 'sandbox_checkout_created';
}

function validateProduct(product: Stripe.Product) {
  rejectLive(product);
  report.resources.product = fingerprint(product.id);
  if (!product.active) report.failures.push('Configured Product is not active.');
}

function validatePrice(price: Stripe.Price, productId: string) {
  rejectLive(price);
  report.resources.price = fingerprint(price.id);
  if (!price.active) report.failures.push('Configured Price is not active.');
  if (price.currency !== policy.offer.currency)
    report.failures.push('Configured Price currency mismatch.');
  if (price.unit_amount !== policy.offer.unit_amount_cents) {
    report.failures.push('Configured Price amount mismatch.');
  }
  if (price.billing_scheme !== policy.offer.billing_scheme) {
    report.failures.push('Configured Price billing scheme mismatch.');
  }
  if (price.recurring?.interval !== policy.offer.recurring_interval) {
    report.failures.push('Configured Price recurring interval mismatch.');
  }
  if (price.recurring?.interval_count !== policy.offer.recurring_interval_count) {
    report.failures.push('Configured Price recurring interval count mismatch.');
  }
  if (price.recurring?.trial_period_days !== null) {
    report.failures.push('Configured Price must not include a trial period.');
  }
  const linkedProduct = typeof price.product === 'string' ? price.product : price.product.id;
  if (linkedProduct !== productId)
    report.failures.push('Configured Price points to the wrong Product.');
}

function validatePortalConfiguration(config: Stripe.BillingPortal.Configuration) {
  rejectLive(config);
  report.resources.portal_configuration = fingerprint(config.id);
  if (!config.active) report.failures.push('Customer Portal configuration is not active.');
  if (!config.features.payment_method_update.enabled) {
    report.failures.push('Customer Portal must allow payment method updates.');
  }
  if (!config.features.invoice_history.enabled) {
    report.failures.push('Customer Portal must allow invoice history.');
  }
  if (
    !config.features.subscription_cancel.enabled ||
    config.features.subscription_cancel.mode !== 'at_period_end'
  ) {
    report.failures.push('Customer Portal cancellation must be at period end.');
  }
  if (config.features.subscription_update.enabled) {
    report.failures.push('Customer Portal must not allow plan or quantity updates.');
  }
}

function validateWebhookEndpoint(endpoint: Stripe.WebhookEndpoint) {
  rejectLive(endpoint);
  report.resources.webhook_endpoint = fingerprint(endpoint.id);
  if (endpoint.status !== 'enabled') report.failures.push('Webhook endpoint must be enabled.');
  if (endpoint.url !== STAGING_WEBHOOK_ROUTE) {
    report.failures.push(
      'Webhook endpoint must be the OT105 staging billing webhook route, not the homepage or another redirect URL.',
    );
  }
  const configured = [...endpoint.enabled_events].sort();
  const expected = [...policy.required_stripe_events].sort();
  if (configured.join('\n') !== expected.join('\n')) {
    report.failures.push('Webhook enabled events do not match the OT105 bounded event set.');
  }
}

function metadata() {
  return {
    account_key: policy.scope.account_key,
    product_key: policy.scope.product_key,
    offer_key: policy.offer.offer_key,
    policy_version: policy.policy_version,
    canary: 'OT-105',
  };
}

function requiredEnv(key: string) {
  const value = text(process.env[key]);
  if (!value) report.missing.push(key);
  return value;
}

function rejectLive(object: unknown) {
  if (object && typeof object === 'object' && 'livemode' in object && object.livemode === true) {
    report.failures.push('Live-mode Stripe object rejected.');
    report.mutations.live_calls += 1;
  }
}

function parseArgs(argv: string[]) {
  const map = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith('--')) continue;
    const [key, inlineValue] = item.split('=', 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      map.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      map.set(key, next);
      index += 1;
    } else {
      map.set(key, true);
    }
  }
  return map;
}

function valueArg(argsMap: Map<string, string | true>, key: string) {
  const value = argsMap.get(key);
  return typeof value === 'string' ? value : null;
}

function text(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function emit(value: CanaryReport, output: string) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, json);
  process.stdout.write(json);
}
