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

export type StartCheckoutResult =
  | { status: 'started'; checkoutRequestKey: string }
  | { status: 'replayed'; checkout: CheckoutSessionResult }
  | { status: 'conflict'; checkoutRequestKey: string };

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
    async startCheckoutSession(input: {
      principal: BillingPrincipalRef;
      offer: BillingOfferPriceMapping;
      idempotency_key: string;
      request_fingerprint: string;
    }): Promise<StartCheckoutResult> {
      const checkoutRequestKey = stableKey('billing_checkout', [
        input.principal.account_key,
        input.principal.product_key,
        input.principal.principal_key,
        input.offer.offer_key,
        input.idempotency_key,
      ]);
      return inTransaction(pool, async (client) => {
        await recordCustomerMappingIfPresent(client, input.principal, input.offer, null);
        const existing = await client.query(
          `SELECT checkout_request_key, provider_checkout_session_ref, redirect_url, status,
                  request_fingerprint
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
            input.offer.offer_key,
            input.idempotency_key,
          ],
        );
        if (existing.rowCount) {
          const row = existing.rows[0];
          if (String(row.request_fingerprint ?? '') !== input.request_fingerprint) {
            return { status: 'conflict', checkoutRequestKey: String(row.checkout_request_key) };
          }
          if (row.status !== 'started' && row.provider_checkout_session_ref && row.redirect_url) {
            return {
              status: 'replayed',
              checkout: {
                checkout_request_key: String(row.checkout_request_key),
                checkout_session_ref: String(row.provider_checkout_session_ref),
                redirect_url: String(row.redirect_url),
                status: 'replayed',
                entitlement_changed: false,
              },
            };
          }
          return { status: 'started', checkoutRequestKey: String(row.checkout_request_key) };
        }
        await client.query(
          `INSERT INTO onetime.billing_checkout_sessions
           (checkout_request_key, account_key, product_key, principal_key, principal_type,
            offer_key, provider, mode, provider_account_ref, provider_price_ref,
            provider_customer_ref, provider_checkout_session_ref, idempotency_key, redirect_url,
            status, request_fingerprint)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$13,$14,$11,
                   '/app/billing/checkout/pending','started',$12)`,
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
            input.idempotency_key,
            input.request_fingerprint,
            `pending_customer_${checkoutRequestKey}`,
            `pending_session_${checkoutRequestKey}`,
          ],
        );
        return { status: 'started', checkoutRequestKey };
      });
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
        input.offer.offer_key,
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
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'session_created')
           ON CONFLICT (account_key, product_key, principal_key, offer_key, idempotency_key)
           DO UPDATE SET
             provider_customer_ref = EXCLUDED.provider_customer_ref,
             provider_checkout_session_ref = EXCLUDED.provider_checkout_session_ref,
             provider_subscription_ref = EXCLUDED.provider_subscription_ref,
             redirect_url = EXCLUDED.redirect_url,
             status = 'session_created'`,
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
        status: 'session_created',
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
    async markCheckoutCompleted(input: {
      provider_checkout_session_ref: string;
      provider_customer_ref: string;
      provider_subscription_ref?: string | undefined;
    }) {
      const result = await pool.query(
        `UPDATE onetime.billing_checkout_sessions
            SET status = 'completed',
                completed_at = now(),
                provider_customer_ref = $2,
                provider_subscription_ref = COALESCE($3, provider_subscription_ref)
          WHERE provider_checkout_session_ref = $1
          RETURNING principal_key, principal_type, account_key, product_key`,
        [
          input.provider_checkout_session_ref,
          input.provider_customer_ref,
          input.provider_subscription_ref ?? null,
        ],
      );
      const row = result.rows[0];
      return row
        ? ({
            principal_key: String(row.principal_key),
            principal_type: row.principal_type as BillingPrincipalRef['principal_type'],
            account_key: String(row.account_key),
            product_key: String(row.product_key),
          } satisfies BillingPrincipalRef)
        : null;
    },
    async markCheckoutExpired(input: { provider_checkout_session_ref: string }) {
      await pool.query(
        `UPDATE onetime.billing_checkout_sessions
            SET status = 'expired',
                expired_at = now()
          WHERE provider_checkout_session_ref = $1
            AND status <> 'completed'`,
        [input.provider_checkout_session_ref],
      );
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
        `SELECT provider_updated_at, source_event_key, status
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
      if (
        existing.rowCount &&
        new Date(existing.rows[0].provider_updated_at).getTime() ===
          new Date(input.provider_updated_at).getTime() &&
        (String(existing.rows[0].source_event_key) !== input.source_event_key ||
          String(existing.rows[0].status) !== input.status)
      ) {
        return { status: 'contradictory' as const };
      }
      const values = [
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
        input.current_period_start,
        input.current_period_end,
        input.cancel_at,
        input.canceled_at,
        input.cancel_at_period_end,
        input.latest_invoice_ref,
        input.collection_state,
        input.provider_updated_at,
        input.source_event_key,
        input.projection_version,
      ];
      if (existing.rowCount) {
        await pool.query(
          `UPDATE onetime.billing_subscription_projections
              SET principal_key = $3,
                  principal_type = $4,
                  provider_account_ref = $7,
                  provider_customer_ref = $8,
                  status = $10,
                  current_period_start = $11,
                  current_period_end = $12,
                  cancel_at = $13,
                  canceled_at = $14,
                  cancel_at_period_end = $15,
                  latest_invoice_ref = $16,
                  collection_state = $17,
                  provider_updated_at = $18,
                  source_event_key = $19,
                  projection_version = projection_version + 1,
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND provider = $5
              AND mode = $6
              AND provider_subscription_ref = $9`,
          values,
        );
      } else {
        await pool.query(
          `INSERT INTO onetime.billing_subscription_projections
           (account_key, product_key, principal_key, principal_type, provider, mode,
            provider_account_ref, provider_customer_ref, provider_subscription_ref,
            status, current_period_start, current_period_end, cancel_at, canceled_at,
            cancel_at_period_end, latest_invoice_ref, collection_state, provider_updated_at,
            source_event_key, projection_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT DO NOTHING`,
          values,
        );
      }
      return { status: 'updated' as const };
    },
    async insertInvoiceSummary(input: BillingInvoiceSummary) {
      await pool.query(
        `INSERT INTO onetime.billing_invoice_summaries
         (account_key, product_key, principal_key, principal_type, provider, mode,
          provider_account_ref, provider_invoice_ref, provider_subscription_ref,
          status, currency, amount_due_cents, amount_paid_cents, refunded_amount_cents,
          dispute_state, issued_at, source_event_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (account_key, product_key, provider, mode, provider_invoice_ref)
         DO UPDATE SET
           status = EXCLUDED.status,
           amount_due_cents = EXCLUDED.amount_due_cents,
           amount_paid_cents = EXCLUDED.amount_paid_cents,
           refunded_amount_cents = EXCLUDED.refunded_amount_cents,
           dispute_state = EXCLUDED.dispute_state,
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
          input.refunded_amount_cents ?? 0,
          input.dispute_state ?? 'none',
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
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (entitlement_key)
         DO UPDATE SET
           status = EXCLUDED.status,
           policy_version = EXCLUDED.policy_version,
           source = EXCLUDED.source,
           reason = EXCLUDED.reason,
           effective_at = EXCLUDED.effective_at,
           evaluated_at = EXCLUDED.evaluated_at,
           grants_access = EXCLUDED.grants_access`,
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
          input.grants_access,
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
    async currentSubscription(principal: BillingPrincipalRef) {
      const result = await pool.query(
        `SELECT account_key, product_key, principal_key, principal_type, provider, mode,
                provider_account_ref, provider_customer_ref, provider_subscription_ref, status,
                current_period_start, current_period_end, cancel_at, canceled_at,
                cancel_at_period_end, latest_invoice_ref, collection_state, provider_updated_at,
                source_event_key, projection_version
           FROM onetime.billing_subscription_projections
          WHERE account_key = $1
            AND product_key = $2
            AND principal_key = $3
          ORDER BY provider_updated_at DESC, updated_at DESC
          LIMIT 1`,
        [principal.account_key, principal.product_key, principal.principal_key],
      );
      const row = result.rows[0];
      return row ? subscriptionFromRow(principal, row) : null;
    },
    async currentInvoiceForSubscription(input: {
      principal: BillingPrincipalRef;
      provider_subscription_ref: string | null;
      provider_invoice_ref?: string | null;
    }) {
      const values: unknown[] = [
        input.principal.account_key,
        input.principal.product_key,
        input.principal.principal_key,
      ];
      const filters = ['account_key = $1', 'product_key = $2', 'principal_key = $3'];
      if (input.provider_invoice_ref) {
        values.push(input.provider_invoice_ref);
        filters.push(`provider_invoice_ref = $${values.length}`);
      } else if (input.provider_subscription_ref) {
        values.push(input.provider_subscription_ref);
        filters.push(`provider_subscription_ref = $${values.length}`);
      }
      const result = await pool.query(
        `SELECT account_key, product_key, principal_key, principal_type, provider, mode,
                provider_account_ref, provider_invoice_ref, provider_subscription_ref, status,
                currency, amount_due_cents, amount_paid_cents, refunded_amount_cents,
                dispute_state, issued_at, source_event_key
           FROM onetime.billing_invoice_summaries
          WHERE ${filters.join(' AND ')}
          ORDER BY issued_at DESC NULLS LAST, created_at DESC
          LIMIT 1`,
        values,
      );
      const row = result.rows[0];
      return row ? invoiceFromRow(input.principal, row) : null;
    },
    async storeRedirect(input: {
      redirectKey: string;
      provider: 'stripe';
      mode: 'test';
      providerUrl: string;
      expiresAt: Date;
    }) {
      await pool.query(
        `INSERT INTO onetime.billing_redirect_vault
         (redirect_key, provider, mode, provider_url, expires_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (redirect_key)
         DO UPDATE SET provider_url = EXCLUDED.provider_url,
                       expires_at = EXCLUDED.expires_at,
                       consumed_at = NULL`,
        [input.redirectKey, input.provider, input.mode, input.providerUrl, input.expiresAt],
      );
    },
    async consumeRedirect(redirectKey: string) {
      const result = await pool.query(
        `UPDATE onetime.billing_redirect_vault
            SET consumed_at = now()
          WHERE redirect_key = $1
            AND consumed_at IS NULL
            AND expires_at > now()
          RETURNING provider_url`,
        [redirectKey],
      );
      return result.rows[0]?.provider_url ? String(result.rows[0].provider_url) : null;
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
          `SELECT status, current_period_end, cancel_at, canceled_at, cancel_at_period_end
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
                  currency, amount_due_cents, amount_paid_cents, refunded_amount_cents,
                  dispute_state, issued_at, source_event_key
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
        invoices: invoices.rows.map((row) => invoiceFromRow(principal, row)),
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
  await recordCustomerMappingIfPresent(client, principal, offer, providerCustomerRef);
}

async function recordCustomerMappingIfPresent(
  client: Queryable,
  principal: BillingPrincipalRef,
  offer: BillingOfferPriceMapping,
  providerCustomerRef: string | null,
) {
  if (!providerCustomerRef) return;
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

function subscriptionFromRow(
  principal: BillingPrincipalRef,
  row: Record<string, unknown>,
): BillingSubscriptionProjection {
  return {
    ...principal,
    provider: row.provider as BillingSubscriptionProjection['provider'],
    mode: row.mode as BillingSubscriptionProjection['mode'],
    provider_account_ref: String(row.provider_account_ref),
    provider_customer_ref: String(row.provider_customer_ref),
    provider_subscription_ref: String(row.provider_subscription_ref),
    status: row.status as BillingSubscriptionProjection['status'],
    current_period_start: nullableIso(row.current_period_start),
    current_period_end: nullableIso(row.current_period_end),
    cancel_at: nullableIso(row.cancel_at),
    canceled_at: nullableIso(row.canceled_at),
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    latest_invoice_ref: row.latest_invoice_ref ? String(row.latest_invoice_ref) : null,
    collection_state: row.collection_state as BillingSubscriptionProjection['collection_state'],
    provider_updated_at: asIso(row.provider_updated_at),
    source_event_key: String(row.source_event_key),
    projection_version: Number(row.projection_version ?? 1),
  };
}

function invoiceFromRow(
  principal: BillingPrincipalRef,
  row: Record<string, unknown>,
): BillingInvoiceSummary {
  const disputeState =
    row.dispute_state === 'created' ||
    row.dispute_state === 'won' ||
    row.dispute_state === 'lost' ||
    row.dispute_state === 'closed'
      ? row.dispute_state
      : 'none';
  return {
    ...principal,
    provider: row.provider as BillingInvoiceSummary['provider'],
    mode: row.mode as BillingInvoiceSummary['mode'],
    provider_account_ref: String(row.provider_account_ref),
    provider_invoice_ref: String(row.provider_invoice_ref),
    provider_subscription_ref: row.provider_subscription_ref
      ? String(row.provider_subscription_ref)
      : null,
    status: row.status as BillingInvoiceSummary['status'],
    currency: String(row.currency),
    amount_due_cents: Number(row.amount_due_cents),
    amount_paid_cents: Number(row.amount_paid_cents),
    refunded_amount_cents: Number(row.refunded_amount_cents ?? 0),
    dispute_state: disputeState,
    issued_at: nullableIso(row.issued_at),
    source_event_key: String(row.source_event_key),
  };
}

function nullableIso(value: unknown) {
  if (!value) return null;
  return asIso(value);
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
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
