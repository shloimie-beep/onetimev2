import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../../packages/domain/src/index.ts';

let config: AppConfig;
let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'highlevel-only-test',
    COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ENABLE_PAYMENT_TRANSPORT: 'true',
    LIVE_STRIPE_CHARGES_AUTHORIZED: 'NO',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  const app = createApp({ config, pool });
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('GHL-only payment-history runtime', () => {
  it('404s every legacy billing surface and writes no legacy billing row', async () => {
    expect(config.paymentHistorySystemOfRecord).toBe('highlevel');
    expect(config.legacyBillingRuntimeEnabled).toBe(false);
    const before = await legacyBillingCounts();
    const parentCookie = await activeParentSessionCookie();

    const routes: Array<{ method: 'GET' | 'POST'; path: string; body?: string }> = [
      { method: 'GET', path: '/api/v1/billing/summary/access_household' },
      { method: 'GET', path: '/api/v1/billing/invoices/access_household' },
      { method: 'POST', path: '/api/v1/billing/checkout-sessions', body: '{}' },
      { method: 'POST', path: '/api/v1/billing/customer-portal-sessions', body: '{}' },
      { method: 'POST', path: '/api/v1/billing/reconciliation', body: '{}' },
      { method: 'POST', path: '/api/v1/billing/webhooks/provider', body: '{}' },
    ];

    for (const route of routes) {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          cookie: parentCookie,
          ...(route.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(route.body ? { body: route.body } : {}),
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(404);
      expect(response.headers.get('cache-control')).toContain('no-store');
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: 'LEGACY_BILLING_RUNTIME_UNAVAILABLE',
      });
    }

    for (const path of [
      '/app/billing/checkout/redirect/opaque-checkout',
      '/app/billing/portal/redirect/opaque-portal',
      '/app/billing/checkout/success',
      '/app/billing/checkout/cancel',
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: parentCookie },
        redirect: 'manual',
      });
      expect(response.status, path).toBe(404);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('location')).toBeNull();
    }

    expect(await legacyBillingCounts()).toEqual(before);
  });
});

async function activeParentSessionCookie() {
  const userKey = await createAccountUser({
    pool,
    config,
    email: 'access-parent@example.test',
    password: 'AccessParent!234',
    displayName: 'Access Parent',
    role: 'parent',
  });
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('access_household',$1,$2,'Access Household')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('access_parent_relationship',$1,$2,'access_household',$3,'Parent','primary_guardian')`,
    [config.accountKey, config.productKey, userKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision, source_updated_at,
        source_request_hash, policy_version, last_event_key)
     VALUES ('access_parent_projection',$1,$2,'access_household','active','free_pilot',
       now() - interval '1 hour',now() + interval '1 day','runtime-free-pilot',1,now(),$3,
       'highlevel-only-runtime-v1','access_parent_projection_event')`,
    [config.accountKey, config.productKey, 'a'.repeat(64)],
  );
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error('missing parent fixture');
  const session = await createSession({ pool, config, user });
  return `otcrm_session=${session.session_token}`;
}

async function legacyBillingCounts() {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM onetime.billing_principal_customers) AS customers,
       (SELECT count(*)::int FROM onetime.billing_checkout_sessions) AS checkout_sessions,
       (SELECT count(*)::int FROM onetime.billing_subscription_projections) AS subscriptions,
       (SELECT count(*)::int FROM onetime.billing_invoice_summaries) AS invoices,
       (SELECT count(*)::int FROM onetime.billing_verified_events) AS verified_events,
       (SELECT count(*)::int FROM onetime.billing_event_processing_attempts) AS attempts,
       (SELECT count(*)::int FROM onetime.billing_reconciliation_jobs) AS reconciliation_jobs,
       (SELECT count(*)::int FROM onetime.billing_entitlement_projections) AS entitlements,
       (SELECT count(*)::int FROM onetime.billing_audit_events) AS audit_events,
       (SELECT count(*)::int FROM onetime.billing_redirect_vault) AS redirects`,
  );
  return Object.fromEntries(
    Object.entries(result.rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
  );
}
