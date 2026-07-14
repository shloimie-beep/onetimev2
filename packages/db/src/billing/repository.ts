import { createHash, randomUUID } from 'node:crypto';
import type { DbPool, Queryable } from '../index.ts';
import { inTransaction } from '../index.ts';
import type {
  BillingDisposition,
  BillingEntitlementProjection,
  BillingInvoiceSummary,
  BillingOfferPriceMapping,
  BillingPrincipalRef,
  BillingProviderAccountRef,
  BillingSubscriptionProjection,
  CheckoutSessionResult,
  VerifiedProviderEventEnvelope,
} from '../../../contracts/src/billing/index.ts';

export type RecordVerifiedEventResult =
  | { status: 'inserted'; eventKey: string }
  | { status: 'duplicate'; eventKey: string }
  | { status: 'digest_mismatch'; eventKey: string };

export function createPostgresBillingRepositories(pool: DbPool) {
  return {
    async upsertProviderAccount(providerAccount: BillingProviderAccountRef) {
      await pool.query(
        `INSERT INTO onetime.billing_provider_accounts
         (provider, mode, provider_account_ref, status)
         VALUES ($1,$2,$3,'active')
         ON CONFLICT (provider, mode, provider_account_ref)
         DO UPDATE SET status = 'active'`,
        [providerAccount.provider, providerAccount.mode, providerAccount.provider_account_ref],
      );
    },
    async upsertOfferPrice(offer: BillingOfferPriceMapping) {
      await pool.query(
        `INSERT INTO onetime.billing_offer_prices
         (account_key, product_key, offer_key, provider, mode, provider_account_ref,
          provider_price_ref, currency, amount_cents, synthetic)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (account_key, product_key, offer_key, provider, mode, provider_account_ref, provider_price_ref)
         DO UPDATE SET provider_account_ref = EXCLUDED.provider_account_ref`,
        [
          offer.account_key,
          offer.product_key,
          offer.offer_key,
          offer.provider,
          offer.mode,
          offer.provider_account_ref,
          offer.provider_price_ref,
          offer.currency,
          offer.amount_cents,
          offer.synthetic,
        ],
      );
    },
    async findCheckout(input: {
      principal: BillingPrincipalRef;
      offer_key: string;
      idempotency_key: string;
    }): Promise<CheckoutSessionResult | null> {
      const result = await pool.query(
        `SELECT checkout_request_key, provider_checkout_session_ref, redirect_url, status
           FROM onetime.billing_checkout_sessions
          WHERE account_key = $1
            AND product_key = $2
            AND principal_key = $3
            AND offer_key = $4
            AND idempotency_key = $5
          LIMIT 1`,
        [
          input.principal.account_key,
          input.principal.product_key,
          input.principal.principal_key,
          input.offer_key,
          input.idempotency_key,
        ],
      );
      const row = result.rows[0];
      return row
        ? {
            checkout_request_key: String(row.checkout_request_key),
            checkout_session_ref: String(row.provider_checkout_session_ref),
            redirect_url: String(row.redirect_url),
            status: 'replayed',
            entitlement_changed: false,
          }
        : null;
    },
    async recordCheckoutSession(input: {
      principal: BillingPrincipalRef;
      offer: BillingOfferPriceMapping;
      idempotency_key: string;
      provider_checkout_session_ref: string;
      provider_customer_ref: string;
      provider_subscription_ref?: string | undefined;
      redirect_url: string;
    }): Promise<CheckoutSessionResult> {
      const checkoutRequestKey = stableKey('billing_checkout', [
        input.principal.account_key,
        input.principal.product_key,
        input.principal.principal_key,
        input.idempotency_key,
      ]);
      await inTransaction(pool, async (client) => {
        await recordCustomerMapping(
          client,
          input.principal,
          input.offer,
          input.provider_customer_ref,
        );
        await client.query(
          `INSERT INTO onetime.billing_checkout_sessions
           (checkout_request_key, account_key, product_key, principal_key, principal_type,
            offer_key, provider, mode, provider_account_ref, provider_price_ref,
            provider_customer_ref, provider_checkout_session_ref, provider_subscription_ref,
            idempotency_key, redirect_url, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'created')
           ON CONFLICT (account_key, product_key, principal_key, offer_key, idempotency_key)
           DO NOTHING`,
          [
            checkoutRequestKey,
            input.principal.account_key,
            input.principal.product_key,
            input.principal.principal_key,
            input.principal.principal_type,
            input.offer.offer_key,
            input.offer.provider,
            input.offer.mode,
            input.offer.provider_account_ref,
            input.offer.provider_price_ref,
            input.provider_customer_ref,
            input.provider_checkout_session_ref,
            input.provider_subscription_ref ?? null,
            input.idempotency_key,
            input.redirect_url,
          ],
        );
      });
      return {
        checkout_request_key: checkoutRequestKey,
        checkout_session_ref: input.provider_checkout_session_ref,
        redirect_url: input.redirect_url,
        status: 'created',
        entitlement_changed: false,
      };
    },
    async findCustomerMapping(input: {
      principal: BillingPrincipalRef;
      providerAccount: BillingProviderAccountRef;
    }) {
      const result = await pool.query(
        `SELECT provider_customer_ref
           FROM onetime.billing_principal_customers
          WHERE account_key = $1
            AND product_key = $2
            AND principal_key = $3
            AND provider = $4
            AND mode = $5
            AND provider_account_ref = $6
            AND archived_at IS NULL
          LIMIT 1`,
        [
          input.principal.account_key,
          input.principal.product_key,
          input.principal.principal_key,
          input.providerAccount.provider,
          input.providerAccount.mode,
          input.providerAccount.provider_account_ref,
        ],
      );
      return result.rows[0]?.provider_customer_ref as string | undefined;
    },
    async findPrincipalByCustomer(input: {
      providerAccount: BillingProviderAccountRef;
      provider_customer_ref: string;
    }): Promise<BillingPrincipalRef | null> {
      const result = await pool.query(
        `SELECT principal_key, principal_type, account_key, product_key
           FROM onetime.billing_principal_customers
          WHERE provider = $1
            AND mode = $2
            AND provider_account_ref = $3
            AND provider_customer_ref = $4
            AND archived_at IS NULL
          LIMIT 1`,
        [
          input.providerAccount.provider,
          input.providerAccount.mode,
          input.providerAccount.provider_account_ref,
          input.provider_customer_ref,
        ],
      );
      const row = result.rows[0];
      return row
        ? {
            principal_key: String(row.principal_key),
            principal_type: row.principal_type as BillingPrincipalRef['principal_type'],
            account_key: String(row.account_key),
            product_key: String(row.product_key),
          }
        : null;
    },
    async recordVerifiedEvent(
      envelope: VerifiedProviderEventEnvelope,
    ): Promise<RecordVerifiedEventResult> {
      const existing = await pool.query(
        `SELECT event_key, payload_digest
           FROM onetime.billing_verified_events
          WHERE provider = $1
            AND mode = $2
            AND provider_account_ref = $3
            AND provider_event_id = $4
          LIMIT 1`,
        [
          envelope.provider,
          envelope.mode,
          envelope.provider_account_ref,
          envelope.provider_event_id,
        ],
      );
      if (existing.rowCount) {
        return existing.rows[0].payload_digest === envelope.payload_digest
          ? { status: 'duplicate', eventKey: String(existing.rows[0].event_key) }
          : { status: 'digest_mismatch', eventKey: String(existing.rows[0].event_key) };
      }
      await pool.query(
        `INSERT INTO onetime.billing_verified_events
         (event_key, provider, mode, provider_account_ref, provider_event_id,
          event_type, provider_created_at, livemode, raw_body_digest, payload_digest,
          object_refs, minimized_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10::jsonb,$11::jsonb)`,
        [
          envelope.event_key,
          envelope.provider,
          envelope.mode,
          envelope.provider_account_ref,
          envelope.provider_event_id,
          envelope.event_type,
          envelope.provider_created_at,
          envelope.raw_body_digest,
          envelope.payload_digest,
          JSON.stringify(envelope.object_refs),
          JSON.stringify(envelope.minimized_payload),
        ],
      );
      return { status: 'inserted', eventKey: envelope.event_key };
    },
    async recordAttempt(input: {
      event_key: string;
      disposition: BillingDisposition;
      reason: string;
    }) {
      await pool.query(
        `INSERT INTO onetime.billing_event_processing_attempts
         (attempt_key, event_key, disposition, reason)
         VALUES ($1,$2,$3,$4)`,
        [
          stableKey('billing_attempt', [input.event_key, randomUUID()]),
          input.event_key,
          input.disposition,
          input.reason,
        ],
      );
    },
    async upsertSubscriptionProjection(input: BillingSubscriptionProjection) {
      const existing = await pool.query(
        `SELECT provider_updated_at
           FROM onetime.billing_subscription_projections
          WHERE account_key = $1
            AND product_key = $2
            AND provider = $3
            AND mode = $4
            AND provider_subscription_ref = $5
          LIMIT 1`,
        [
          input.account_key,
          input.product_key,
          input.provider,
          input.mode,
          input.provider_subscription_ref,
        ],
      );
      if (
        existing.rowCount &&
        new Date(existing.rows[0].provider_updated_at).getTime() >
          new Date(input.provider_updated_at).getTime()
      ) {
        return { status: 'stale' as const };
      }
      await pool.query(
        `INSERT INTO onetime.billing_subscription_projections
         (account_key, product_key, principal_key, principal_type, provider, mode,
          provider_account_ref, provider_customer_ref, provider_subscription_ref,
          status, current_period_end, cancel_at, canceled_at, provider_updated_at,
          source_event_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (account_key, product_key, provider, mode, provider_subscription_ref)
         DO UPDATE SET
           status = EXCLUDED.status,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at = EXCLUDED.cancel_at,
           canceled_at = EXCLUDED.canceled_at,
           provider_updated_at = EXCLUDED.provider_updated_at,
           source_event_key = EXCLUDED.source_event_key,
           updated_at = now()`,
        [
          input.account_key,
          input.product_key,
          input.principal_key,
          input.principal_type,
          input.provider,
          input.mode,
          input.provider_account_ref,
          input.provider_customer_ref,
          input.provider_subscription_ref,
          input.status,
          input.current_period_end,
          input.cancel_at,
          input.canceled_at,
          input.provider_updated_at,
          input.source_event_key,
        ],
      );
      return { status: 'updated' as const };
    },
    async insertInvoiceSummary(input: BillingInvoiceSummary) {
      await pool.query(
        `INSERT INTO onetime.billing_invoice_summaries
         (account_key, product_key, principal_key, principal_type, provider, mode,
          provider_account_ref, provider_invoice_ref, provider_subscription_ref,
          status, currency, amount_due_cents, amount_paid_cents, issued_at, source_event_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (account_key, product_key, provider, mode, provider_invoice_ref)
         DO UPDATE SET
           status = EXCLUDED.status,
           amount_due_cents = EXCLUDED.amount_due_cents,
           amount_paid_cents = EXCLUDED.amount_paid_cents,
           source_event_key = EXCLUDED.source_event_key`,
        [
          input.account_key,
          input.product_key,
          input.principal_key,
          input.principal_type,
          input.provider,
          input.mode,
          input.provider_account_ref,
          input.provider_invoice_ref,
          input.provider_subscription_ref,
          input.status,
          input.currency,
          input.amount_due_cents,
          input.amount_paid_cents,
          input.issued_at,
          input.source_event_key,
        ],
      );
    },
    async upsertEntitlementProjection(input: BillingEntitlementProjection) {
      await pool.query(
        `INSERT INTO onetime.billing_entitlement_projections
         (entitlement_key, account_key, product_key, principal_key, principal_type,
          status, policy_version, source, reason, effective_at, evaluated_at, grants_access)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)
         ON CONFLICT (entitlement_key)
         DO UPDATE SET
           status = EXCLUDED.status,
           policy_version = EXCLUDED.policy_version,
           source = EXCLUDED.source,
           reason = EXCLUDED.reason,
           effective_at = EXCLUDED.effective_at,
           evaluated_at = EXCLUDED.evaluated_at,
           grants_access = false`,
        [
          input.entitlement_key,
          input.account_key,
          input.product_key,
          input.principal_key,
          input.principal_type,
          input.status,
          input.policy_version,
          input.source,
          input.reason,
          input.effective_at,
          input.evaluated_at,
        ],
      );
    },
    async createReconciliation(input: {
      principal: BillingPrincipalRef;
      providerAccount: BillingProviderAccountRef;
      idempotency_key: string;
      reason: string;
      status: string;
      result: Record<string, unknown>;
    }) {
      const reconciliationKey = stableKey('billing_reconcile', [
        input.principal.account_key,
        input.principal.product_key,
        input.principal.principal_key,
        input.idempotency_key,
      ]);
      await pool.query(
        `INSERT INTO onetime.billing_reconciliation_jobs
         (reconciliation_key, account_key, product_key, principal_key, principal_type,
          provider, mode, provider_account_ref, idempotency_key, reason, status, result)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (account_key, product_key, principal_key, idempotency_key)
         DO NOTHING`,
        [
          reconciliationKey,
          input.principal.account_key,
          input.principal.product_key,
          input.principal.principal_key,
          input.principal.principal_type,
          input.providerAccount.provider,
          input.providerAccount.mode,
          input.providerAccount.provider_account_ref,
          input.idempotency_key,
          input.reason,
          input.status,
          JSON.stringify(input.result),
        ],
      );
      return reconciliationKey;
    },
    async summary(principal: BillingPrincipalRef) {
      const [customer, subscription, entitlement, invoices] = await Promise.all([
        pool.query(
          `SELECT status, provider, mode
             FROM onetime.billing_principal_customers
            WHERE account_key = $1 AND product_key = $2 AND principal_key = $3 AND archived_at IS NULL
            LIMIT 1`,
          [principal.account_key, principal.product_key, principal.principal_key],
        ),
        pool.query(
          `SELECT status, current_period_end, cancel_at, canceled_at
             FROM onetime.billing_subscription_projections
            WHERE account_key = $1 AND product_key = $2 AND principal_key = $3
            ORDER BY updated_at DESC
            LIMIT 1`,
          [principal.account_key, principal.product_key, principal.principal_key],
        ),
        pool.query(
          `SELECT status, policy_version, reason, grants_access
             FROM onetime.billing_entitlement_projections
            WHERE account_key = $1 AND product_key = $2 AND principal_key = $3
            LIMIT 1`,
          [principal.account_key, principal.product_key, principal.principal_key],
        ),
        pool.query(
          `SELECT account_key, product_key, principal_key, principal_type, provider, mode,
                  provider_account_ref, provider_invoice_ref, provider_subscription_ref, status,
                  currency, amount_due_cents, amount_paid_cents, issued_at, source_event_key
             FROM onetime.billing_invoice_summaries
            WHERE account_key = $1 AND product_key = $2 AND principal_key = $3
            ORDER BY issued_at DESC NULLS LAST, created_at DESC
            LIMIT 12`,
          [principal.account_key, principal.product_key, principal.principal_key],
        ),
      ]);
      return {
        principal,
        customer: customer.rows[0] ?? null,
        subscription: subscription.rows[0] ?? null,
        entitlement: entitlement.rows[0] ?? null,
        invoices: invoices.rows.map((row) => ({
          ...principal,
          provider: row.provider,
          mode: row.mode,
          provider_account_ref: row.provider_account_ref,
          provider_invoice_ref: row.provider_invoice_ref,
          provider_subscription_ref: row.provider_subscription_ref,
          status: row.status,
          currency: row.currency,
          amount_due_cents: Number(row.amount_due_cents),
          amount_paid_cents: Number(row.amount_paid_cents),
          issued_at: row.issued_at ? new Date(row.issued_at).toISOString() : null,
          source_event_key: row.source_event_key,
        })),
        manual_review: entitlement.rows[0]?.status === 'manual_review',
      };
    },
    async audit(input: {
      account_key: string;
      product_key: string;
      principal_key?: string;
      event_type: string;
      metadata: Record<string, unknown>;
    }) {
      await pool.query(
        `INSERT INTO onetime.billing_audit_events
         (audit_key, account_key, product_key, principal_key, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          stableKey('billing_audit', [
            input.account_key,
            input.product_key,
            input.principal_key ?? 'none',
            input.event_type,
            randomUUID(),
          ]),
          input.account_key,
          input.product_key,
          input.principal_key ?? null,
          input.event_type,
          JSON.stringify(redactMetadata(input.metadata)),
        ],
      );
    },
  };
}

async function recordCustomerMapping(
  client: Queryable,
  principal: BillingPrincipalRef,
  offer: BillingOfferPriceMapping,
  providerCustomerRef: string,
) {
  const existing = await client.query(
    `SELECT id
       FROM onetime.billing_principal_customers
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
        AND provider = $4
        AND mode = $5
        AND archived_at IS NULL
      LIMIT 1`,
    [
      principal.account_key,
      principal.product_key,
      principal.principal_key,
      offer.provider,
      offer.mode,
    ],
  );
  if (existing.rowCount) {
    await client.query(
      `UPDATE onetime.billing_principal_customers
          SET provider_customer_ref = $2
        WHERE id = $1`,
      [existing.rows[0].id, providerCustomerRef],
    );
    return;
  }
  await client.query(
    `INSERT INTO onetime.billing_principal_customers
     (account_key, product_key, principal_key, principal_type, provider, mode,
      provider_account_ref, provider_customer_ref, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active')
     ON CONFLICT DO NOTHING`,
    [
      principal.account_key,
      principal.product_key,
      principal.principal_key,
      principal.principal_type,
      offer.provider,
      offer.mode,
      offer.provider_account_ref,
      providerCustomerRef,
    ],
  );
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 24)}`;
}

function redactMetadata(metadata: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(metadata, (key, value) => {
      if (
        /email|phone|secret|signature|raw|url|customer|invoice|checkout|subscription/i.test(key)
      ) {
        return '[redacted]';
      }
      return value;
    }),
  ) as Record<string, unknown>;
}
