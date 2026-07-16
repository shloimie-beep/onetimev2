import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { loadOt87CommercialPolicy } from '../packages/domain/src/billing/commercial-policy.ts';

type Command = 'validate' | 'setup';
type ResourceName =
  | 'secret_key'
  | 'account'
  | 'product'
  | 'price'
  | 'portal_configuration'
  | 'webhook_endpoint'
  | 'protected_store';

type ValidationResult = {
  command: Command;
  ok: boolean;
  status: 'validated' | 'waiting_for_stripe_test_resources' | 'blocked';
  mode: 'test';
  checked_at: string;
  dry_run: boolean;
  apply: boolean;
  account_fingerprint: string | null;
  missing: ResourceName[];
  failures: string[];
  resources: Record<string, string>;
  mutations: {
    attempted: number;
    applied: number;
    live_calls: number;
    live_resources: number;
    live_charges: number;
  };
};

const requiredEvents = [
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
];

const command = parseCommand(process.argv[2]);
const args = parseArgs(process.argv.slice(3));
const apply = args.has('--apply');
const outputPath = valueArg(args, '--output');
const now = new Date().toISOString();

const result: ValidationResult = {
  command,
  ok: false,
  status: 'blocked',
  mode: 'test',
  checked_at: now,
  dry_run: !apply,
  apply,
  account_fingerprint: null,
  missing: [],
  failures: [],
  resources: {},
  mutations: {
    attempted: 0,
    applied: 0,
    live_calls: 0,
    live_resources: 0,
    live_charges: 0,
  },
};

try {
  await run();
} catch (error) {
  result.failures.push(safeError(error));
}

if (!result.ok && result.status === 'blocked' && result.missing.length > 0) {
  result.status = 'waiting_for_stripe_test_resources';
}

emit(result, outputPath);
process.exitCode = result.ok ? 0 : 1;

async function run() {
  const liveGuard = text(process.env.LIVE_STRIPE_CHARGES_AUTHORIZED);
  if (liveGuard !== 'NO') {
    result.failures.push('LIVE_STRIPE_CHARGES_AUTHORIZED must exactly equal NO.');
  }

  const secretKey = text(process.env.ONE_TIME_STRIPE_TEST_SECRET_KEY);
  if (!secretKey) {
    result.missing.push('secret_key');
  } else if (!/^sk_test_[A-Za-z0-9_]+$/.test(secretKey)) {
    result.failures.push('ONE_TIME_STRIPE_TEST_SECRET_KEY must be a Stripe test secret key.');
  }
  if (secretKey && /sk_live_|rk_live_|pk_live_|livemode/i.test(secretKey)) {
    result.failures.push('Live-like Stripe key shape rejected.');
  }

  const expectedAccount = text(process.env.ONE_TIME_STRIPE_TEST_ACCOUNT_ID);
  const productId = text(process.env.ONE_TIME_STRIPE_TEST_PRODUCT_ID);
  const priceId = text(process.env.ONE_TIME_STRIPE_TEST_PRICE_ID);
  const portalConfigId = text(process.env.ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID);
  const webhookEndpointId = text(process.env.ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID);

  addMissing('account', expectedAccount);
  addMissing('product', productId);
  addMissing('price', priceId);
  addMissing('portal_configuration', portalConfigId);
  addMissing('webhook_endpoint', webhookEndpointId);

  if (command === 'setup') {
    if (text(process.env.ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED) !== 'YES') {
      result.failures.push(
        'ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED must equal YES before setup apply.',
      );
    }
    if (!apply) {
      result.failures.push('Setup is a dry run without --apply; no Stripe mutation attempted.');
    }
    if (!text(process.env.ONE_TIME_STRIPE_TEST_PROTECTED_STORE_URL)) {
      result.missing.push('protected_store');
      result.failures.push('No approved writable protected-config store is configured.');
    }
  }

  if (result.failures.length > 0 || !secretKey) return;

  const stripe = new Stripe(secretKey);
  const account = await stripe.accounts.retrieve(null);
  result.account_fingerprint = fingerprint(account.id);
  result.resources.account = 'retrieved';

  if (account.id && expectedAccount && !constantTimeEqual(account.id, expectedAccount)) {
    result.failures.push('Authenticated Stripe account does not match expected test account.');
  }

  if (!productId || !priceId || !portalConfigId || !webhookEndpointId) return;

  const [product, price, portalConfig, webhookEndpoint] = await Promise.all([
    stripe.products.retrieve(productId),
    stripe.prices.retrieve(priceId),
    stripe.billingPortal.configurations.retrieve(portalConfigId),
    stripe.webhookEndpoints.retrieve(webhookEndpointId),
  ]);

  result.resources.product = fingerprint(product.id);
  result.resources.price = fingerprint(price.id);
  result.resources.portal_configuration = fingerprint(portalConfig.id);
  result.resources.webhook_endpoint = fingerprint(webhookEndpoint.id);

  validateProduct(product);
  validatePrice(price, productId);
  validatePortalConfiguration(portalConfig);
  validateWebhookEndpoint(webhookEndpoint);

  if (command === 'validate') {
    result.ok = result.failures.length === 0 && result.missing.length === 0;
    result.status = result.ok ? 'validated' : 'waiting_for_stripe_test_resources';
    return;
  }

  result.ok = false;
  result.status = 'blocked';
  result.failures.push(
    'Setup mutation is intentionally blocked until an approved protected-config writer is implemented.',
  );
}

function validateProduct(product: Stripe.Product) {
  rejectLive(product);
  if (!product.active) result.failures.push('Configured Product is not active.');
  const name = product.name.toLowerCase();
  if (!name.includes('ot-87') && !name.includes('family') && !name.includes('one time')) {
    result.failures.push('Configured Product is not dedicated to the OT-87 family plan.');
  }
}

function validatePrice(price: Stripe.Price, productId: string) {
  rejectLive(price);
  if (!price.active) result.failures.push('Configured Price is not active.');
  if (price.currency !== 'usd') result.failures.push('Configured Price currency must be usd.');
  if (price.unit_amount !== 6700) result.failures.push('Configured Price amount must be 6700.');
  if (price.billing_scheme !== 'per_unit') {
    result.failures.push('Configured Price billing scheme must be per_unit.');
  }
  if (price.tiers_mode !== null) result.failures.push('Configured Price must not use tiers.');
  if (price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
    result.failures.push('Configured Price must recur monthly with interval count one.');
  }
  if (price.recurring?.trial_period_days !== null) {
    result.failures.push('Configured Price must not configure a trial period.');
  }
  const linkedProduct = typeof price.product === 'string' ? price.product : price.product.id;
  if (linkedProduct !== productId)
    result.failures.push('Configured Price is linked to the wrong Product.');
}

function validatePortalConfiguration(config: Stripe.BillingPortal.Configuration) {
  rejectLive(config);
  const features = config.features;
  if (!features.payment_method_update.enabled) {
    result.failures.push('Customer Portal must allow payment method update.');
  }
  if (!features.invoice_history.enabled) {
    result.failures.push('Customer Portal must allow invoice history.');
  }
  if (
    !features.subscription_cancel.enabled ||
    features.subscription_cancel.mode !== 'at_period_end'
  ) {
    result.failures.push('Customer Portal cancellation must be enabled at period end.');
  }
  if (features.subscription_update.enabled) {
    result.failures.push('Customer Portal must not permit subscription plan or quantity changes.');
  }
  const allowedUpdates = features.subscription_update.default_allowed_updates;
  if (allowedUpdates.includes('price') || allowedUpdates.includes('quantity')) {
    result.failures.push(
      'Customer Portal subscription update must not allow price or quantity changes.',
    );
  }
}

function validateWebhookEndpoint(endpoint: Stripe.WebhookEndpoint) {
  rejectLive(endpoint);
  if (endpoint.status !== 'enabled') {
    result.failures.push('Webhook endpoint must be enabled.');
  }
  const url = endpoint.url;
  if (
    !url.startsWith('https://') ||
    !new URL(url).pathname.endsWith('/api/v1/billing/webhooks/provider')
  ) {
    result.failures.push(
      'Webhook endpoint must point to the allowlisted One Time billing webhook path.',
    );
  }
  const configured = [...endpoint.enabled_events].sort();
  const expected = [
    ...new Set([...loadOt87CommercialPolicy().required_stripe_events, ...requiredEvents]),
  ].sort();
  if (configured.join('\n') !== expected.join('\n')) {
    result.failures.push(
      'Webhook endpoint enabled events do not match the OT-87 policy event set.',
    );
  }
}

function rejectLive(object: { livemode?: boolean }) {
  if (object.livemode === true) {
    result.failures.push('Retrieved Stripe object is live mode; rejected.');
    result.mutations.live_resources += 1;
  }
}

function addMissing(name: ResourceName, value: string | null) {
  if (!value) result.missing.push(name);
}

function parseCommand(raw: string | undefined): Command {
  if (raw === 'setup') return 'setup';
  return 'validate';
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

function valueArg(args: Map<string, string | true>, key: string) {
  const value = args.get(key);
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

function emit(value: ValidationResult, output: string | null) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, json);
  }
  process.stdout.write(json);
}
