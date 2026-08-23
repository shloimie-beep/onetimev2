import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import Stripe from 'stripe';

type ReconcileReport = {
  command: 'billing:reconcile:test' | 'billing:reconcile:test:apply';
  ok: boolean;
  status: 'dry_run_completed' | 'waiting_for_stripe_test_resources' | 'blocked';
  checked_at: string;
  scope: 'family';
  dry_run: boolean;
  apply: boolean;
  account_fingerprint: string | null;
  local_candidates: number;
  proposed_changes: Array<{
    principal_fingerprint: string;
    reason: string;
    action: 'none' | 'manual_review';
  }>;
  missing: string[];
  failures: string[];
  mutations: {
    local_projection_writes: number;
    stripe_writes: number;
    live_calls: number;
    live_charges: number;
  };
  resume: {
    cursor: string | null;
    output_path: string | null;
  };
};

const args = parseArgs(process.argv.slice(2));
const apply = args.has('--apply');
const outputPath = valueArg(args, '--output') ?? 'ops/codex-runs/OT-87/reconciliation/dry-run.json';
const command = apply ? 'billing:reconcile:test:apply' : 'billing:reconcile:test';
const report: ReconcileReport = {
  command,
  ok: false,
  status: 'blocked',
  checked_at: new Date().toISOString(),
  scope: 'family',
  dry_run: !apply,
  apply,
  account_fingerprint: null,
  local_candidates: 0,
  proposed_changes: [],
  missing: [],
  failures: [],
  mutations: {
    local_projection_writes: 0,
    stripe_writes: 0,
    live_calls: 0,
    live_charges: 0,
  },
  resume: {
    cursor: null,
    output_path: outputPath,
  },
};

try {
  await run();
} catch (error) {
  report.failures.push(safeError(error));
}

if (!report.ok && report.missing.length > 0) {
  report.status = 'waiting_for_stripe_test_resources';
}

emit(report, outputPath);
process.exitCode = report.ok ? 0 : 1;

async function run() {
  if ((valueArg(args, '--scope') ?? 'family') !== 'family') {
    report.failures.push('Only --scope=family is supported for OT-87 reconciliation.');
  }
  if (text(process.env.LIVE_STRIPE_CHARGES_AUTHORIZED) !== 'NO') {
    report.failures.push('LIVE_STRIPE_CHARGES_AUTHORIZED must exactly equal NO.');
  }
  if (apply && text(process.env.ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED) !== 'YES') {
    report.failures.push(
      'ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED must equal YES for apply.',
    );
  }

  const secretKey = text(process.env.ONE_TIME_STRIPE_TEST_SECRET_KEY);
  const expectedAccount = text(process.env.ONE_TIME_STRIPE_TEST_ACCOUNT_ID);
  if (!secretKey) report.missing.push('secret_key');
  if (!expectedAccount) report.missing.push('account');
  if (!text(process.env.DATABASE_URL)) report.missing.push('database_url');
  if (secretKey && !/^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(secretKey)) {
    report.failures.push('ONE_TIME_STRIPE_TEST_SECRET_KEY must be a Stripe test server key.');
  }

  if (report.failures.length > 0 || report.missing.length > 0 || !secretKey || !expectedAccount) {
    return;
  }

  const stripe = new Stripe(secretKey);
  const account = await stripe.accounts.retrieve(null);
  report.account_fingerprint = fingerprint(account.id);
  if (!constantTimeEqual(account.id, expectedAccount)) {
    report.failures.push('Authenticated Stripe account does not match expected test account.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const candidates = await pool.query<{
      principal_key: string;
      provider_customer_ref: string;
      provider_subscription_ref: string | null;
    }>(
      `SELECT c.principal_key,
              c.provider_customer_ref,
              s.provider_subscription_ref
         FROM onetime.billing_principal_customers c
         LEFT JOIN onetime.billing_subscription_projections s
           ON s.account_key = c.account_key
          AND s.product_key = c.product_key
          AND s.principal_key = c.principal_key
          AND s.provider = c.provider
          AND s.mode = c.mode
        WHERE c.account_key = 'one_time'
          AND c.product_key = 'one_time_mishnah_class'
          AND c.provider = 'stripe'
          AND c.mode = 'test'
          AND c.archived_at IS NULL
        ORDER BY c.principal_key
        LIMIT 50`,
    );
    report.local_candidates = candidates.rowCount ?? 0;
    for (const row of candidates.rows) {
      await inspectCandidate(stripe, row);
    }
  } finally {
    await pool.end();
  }

  if (apply) {
    report.status = 'blocked';
    report.failures.push(
      'Apply mode is guarded; no local projection writes are performed by this first OT-87 command.',
    );
    return;
  }

  report.ok = report.failures.length === 0;
  report.status = report.ok ? 'dry_run_completed' : 'blocked';
}

async function inspectCandidate(
  stripe: Stripe,
  row: {
    principal_key: string;
    provider_customer_ref: string;
    provider_subscription_ref: string | null;
  },
) {
  const customer = await stripe.customers.retrieve(row.provider_customer_ref);
  if (deleted(customer)) {
    report.proposed_changes.push({
      principal_fingerprint: fingerprint(row.principal_key),
      reason: 'provider_customer_missing',
      action: 'manual_review',
    });
    return;
  }
  rejectLive(customer);
  if (!row.provider_subscription_ref) {
    report.proposed_changes.push({
      principal_fingerprint: fingerprint(row.principal_key),
      reason: 'no_local_subscription_projection',
      action: 'none',
    });
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(row.provider_subscription_ref);
  rejectLive(subscription);
  report.proposed_changes.push({
    principal_fingerprint: fingerprint(row.principal_key),
    reason: `provider_subscription_status:${subscription.status}`,
    action: 'none',
  });
}

function rejectLive(object: { livemode?: boolean }) {
  if (object.livemode === true) {
    report.failures.push('Live-mode Stripe object rejected.');
    report.mutations.live_calls += 1;
  }
}

function deleted(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.DeletedCustomer {
  return 'deleted' in customer && customer.deleted === true;
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

function emit(value: ReconcileReport, output: string | null) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, json);
  }
  process.stdout.write(json);
}
