import { z } from 'zod';

export const billingProviderSchema = z.literal('stripe');
export type BillingProvider = z.infer<typeof billingProviderSchema>;

export const billingModeSchema = z.literal('test');
export type BillingMode = z.infer<typeof billingModeSchema>;

export const billingPrincipalTypeSchema = z.enum(['account_user', 'contact', 'opaque']);
export type BillingPrincipalType = z.infer<typeof billingPrincipalTypeSchema>;

export const billingEntitlementStatusSchema = z.enum([
  'pending',
  'billing_eligible',
  'active',
  'suspended',
  'scheduled_end',
  'revoked',
  'manual_review',
]);
export type BillingEntitlementStatus = z.infer<typeof billingEntitlementStatusSchema>;

export const billingDispositionSchema = z.enum([
  'accepted',
  'duplicate',
  'digest_mismatch',
  'invalid_signature',
  'oversized',
  'parsed_body_misuse',
  'live_mode_rejected',
  'wrong_provider_account',
  'wrong_mode',
  'wrong_scope',
  'wrong_offer',
  'wrong_customer_correlation',
  'unknown_event',
  'stale_event',
  'contradictory_event',
  'provider_error',
  'reconciliation_requested',
  'manual_review',
]);
export type BillingDisposition = z.infer<typeof billingDispositionSchema>;

export const billingSubscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'canceled',
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
  'disputed',
  'refunded',
  'unknown',
]);
export type BillingSubscriptionStatus = z.infer<typeof billingSubscriptionStatusSchema>;

const localKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9_:-]+$/);
const offerKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9_-]+$/);
const idempotencyKeySchema = z.string().trim().min(8).max(160);
const providerRefSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .refine((value) => !value.toLowerCase().includes('live'), 'Live-like refs are not allowed.');

export const billingPrincipalRefSchema = z
  .object({
    principal_key: localKeySchema,
    principal_type: billingPrincipalTypeSchema,
    account_key: localKeySchema,
    product_key: localKeySchema,
  })
  .strict();
export type BillingPrincipalRef = z.infer<typeof billingPrincipalRefSchema>;

export const billingProviderAccountRefSchema = z
  .object({
    provider: billingProviderSchema,
    mode: billingModeSchema,
    provider_account_ref: providerRefSchema,
  })
  .strict();
export type BillingProviderAccountRef = z.infer<typeof billingProviderAccountRefSchema>;

export const billingOfferPriceMappingSchema = z
  .object({
    account_key: localKeySchema,
    product_key: localKeySchema,
    offer_key: offerKeySchema,
    provider: billingProviderSchema,
    mode: billingModeSchema,
    provider_account_ref: providerRefSchema,
    provider_price_ref: providerRefSchema,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toLowerCase()),
    amount_cents: z.number().int().nonnegative(),
    synthetic: z.boolean(),
  })
  .strict();
export type BillingOfferPriceMapping = z.infer<typeof billingOfferPriceMappingSchema>;

export const checkoutRequestSchema = z
  .object({
    principal_key: localKeySchema,
    offer_key: offerKeySchema,
    idempotency_key: idempotencyKeySchema,
    version: z.literal(1),
  })
  .strict();
export type CheckoutRequestDto = z.infer<typeof checkoutRequestSchema>;

export const customerPortalRequestSchema = z
  .object({
    principal_key: localKeySchema,
    idempotency_key: idempotencyKeySchema,
    version: z.literal(1),
  })
  .strict();
export type CustomerPortalRequestDto = z.infer<typeof customerPortalRequestSchema>;

export const reconciliationRequestSchema = z
  .object({
    principal_key: localKeySchema,
    reason: z.string().trim().min(3).max(160),
    idempotency_key: idempotencyKeySchema,
    version: z.literal(1),
  })
  .strict();
export type ReconciliationRequestDto = z.infer<typeof reconciliationRequestSchema>;

export type CheckoutSessionResult = {
  checkout_request_key: string;
  checkout_session_ref: string;
  redirect_url: string;
  status: 'started' | 'created' | 'session_created' | 'replayed';
  entitlement_changed: false;
};

export type CustomerPortalSessionResult = {
  portal_session_ref: string;
  redirect_url: string;
  status: 'created';
};

export type BillingCustomerProjection = BillingPrincipalRef & {
  provider: BillingProvider;
  mode: BillingMode;
  provider_account_ref: string;
  provider_customer_ref: string;
  status: 'active' | 'archived' | 'manual_review';
  created_at: string;
};

export type BillingSubscriptionProjection = BillingPrincipalRef & {
  provider: BillingProvider;
  mode: BillingMode;
  provider_account_ref: string;
  provider_customer_ref: string;
  provider_subscription_ref: string;
  status: BillingSubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  latest_invoice_ref: string | null;
  collection_state: 'paid' | 'payment_failed' | 'payment_action_required' | 'unknown';
  provider_updated_at: string;
  source_event_key: string;
  projection_version: number;
};

export type BillingInvoiceSummary = BillingPrincipalRef & {
  provider: BillingProvider;
  mode: BillingMode;
  provider_account_ref: string;
  provider_invoice_ref: string;
  provider_subscription_ref: string | null;
  status:
    | 'draft'
    | 'open'
    | 'paid'
    | 'void'
    | 'uncollectible'
    | 'payment_failed'
    | 'payment_action_required'
    | 'refunded'
    | 'disputed'
    | 'unknown';
  currency: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  refunded_amount_cents?: number;
  dispute_state?: 'none' | 'created' | 'won' | 'lost' | 'closed';
  issued_at: string | null;
  source_event_key: string;
};

export type VerifiedProviderEventEnvelope = {
  event_key: string;
  provider: BillingProvider;
  mode: BillingMode;
  provider_account_ref: string;
  provider_event_id: string;
  event_type: string;
  provider_created_at: string;
  livemode: false;
  raw_body_digest: string;
  payload_digest: string;
  object_refs: {
    provider_customer_ref?: string;
    provider_subscription_ref?: string;
    provider_invoice_ref?: string;
    provider_checkout_session_ref?: string;
    provider_price_ref?: string;
    provider_product_ref?: string;
  };
  minimized_payload: Record<string, unknown>;
};

export type BillingEventProcessingAttempt = {
  attempt_key: string;
  event_key: string;
  disposition: BillingDisposition;
  reason: string;
  occurred_at: string;
};

export type BillingReconciliationResult = {
  reconciliation_key: string;
  principal: BillingPrincipalRef;
  status: 'queued' | 'succeeded' | 'failed' | 'retry_exhausted' | 'manual_review';
  disposition: BillingDisposition;
  reason: string;
};

export type BillingEntitlementProjection = BillingPrincipalRef & {
  entitlement_key: string;
  status: BillingEntitlementStatus;
  policy_version: string;
  source: string;
  reason: string;
  effective_at: string;
  evaluated_at: string;
  grants_access: boolean;
};

export type AppendOnlyBillingAuditEvent = {
  audit_key: string;
  account_key: string;
  product_key: string;
  principal_key?: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BillingSummaryDto = {
  principal: BillingPrincipalRef;
  customer: Pick<BillingCustomerProjection, 'status' | 'mode' | 'provider'> | null;
  subscription: Pick<
    BillingSubscriptionProjection,
    'status' | 'current_period_end' | 'cancel_at' | 'canceled_at' | 'cancel_at_period_end'
  > | null;
  entitlement: Pick<
    BillingEntitlementProjection,
    'status' | 'policy_version' | 'reason' | 'grants_access'
  > | null;
  invoices: BillingInvoiceSummary[];
  manual_review: boolean;
};

export type ProviderCheckoutSessionInput = {
  principal: BillingPrincipalRef;
  providerAccount: BillingProviderAccountRef;
  offer: BillingOfferPriceMapping;
  idempotencyKey: string;
  localCheckoutRequestKey?: string;
  policyVersion?: string;
  provider_customer_ref?: string;
  successUrl: string;
  cancelUrl: string;
};

export type ProviderCheckoutSessionOutput = {
  provider_checkout_session_ref: string;
  provider_customer_ref: string;
  provider_subscription_ref?: string;
  redirect_url: string;
  mode: BillingMode;
  livemode: false;
};

export type ProviderPortalSessionInput = {
  principal: BillingPrincipalRef;
  providerAccount: BillingProviderAccountRef;
  provider_customer_ref: string;
  provider_portal_configuration_ref?: string;
  idempotencyKey: string;
  returnUrl: string;
};

export type ProviderPortalSessionOutput = {
  provider_portal_session_ref: string;
  redirect_url: string;
  mode: BillingMode;
  livemode: false;
};

export type ProviderEventVerificationInput = {
  rawBody: Buffer;
  signatureHeader?: string | undefined;
};

export type ProviderEventObjectRefs = VerifiedProviderEventEnvelope['object_refs'] & {
  status?: string;
  account_key?: string;
  product_key?: string;
  principal_key?: string;
  offer_key?: string;
  policy_version?: string;
  checkout_request_key?: string;
  current_period_end?: string | null;
  current_period_start?: string | null;
  cancel_at?: string | null;
  canceled_at?: string | null;
  cancel_at_period_end?: boolean;
  latest_invoice_ref?: string | null;
  amount_due_cents?: number;
  amount_paid_cents?: number;
  refunded_amount_cents?: number;
  currency?: string;
  issued_at?: string | null;
  dispute_state?: 'none' | 'created' | 'won' | 'lost' | 'closed';
};

export type ProviderVerifiedEvent = Omit<
  VerifiedProviderEventEnvelope,
  'event_key' | 'raw_body_digest' | 'payload_digest' | 'livemode'
> & {
  livemode: boolean;
  object_refs: ProviderEventObjectRefs;
};

export interface BillingProviderAdapter {
  readonly adapter_name: 'fixture_billing_provider' | 'stripe_test_provider';
  createCheckoutSession(
    input: ProviderCheckoutSessionInput,
  ): Promise<ProviderCheckoutSessionOutput>;
  createCustomerPortalSession(
    input: ProviderPortalSessionInput,
  ): Promise<ProviderPortalSessionOutput>;
  verifyWebhook(input: ProviderEventVerificationInput): Promise<ProviderVerifiedEvent>;
  retrieveCustomer(providerCustomerRef: string): Promise<{ provider_customer_ref: string } | null>;
  retrieveSubscription(
    providerSubscriptionRef: string,
  ): Promise<{ provider_subscription_ref: string; status: BillingSubscriptionStatus } | null>;
  retrieveInvoice(
    providerInvoiceRef: string,
  ): Promise<{ provider_invoice_ref: string; status: string } | null>;
  reconcileBillingPrincipal(principal: BillingPrincipalRef): Promise<{
    status: 'succeeded' | 'failed';
    reason: string;
  }>;
}
