import type {
  BillingInvoiceSummary,
  BillingEntitlementProjection,
  BillingPrincipalRef,
  BillingSubscriptionProjection,
} from './types.ts';
import { OT87_PLAN_TRUTH } from './commercial-policy.ts';

export const BILLING_POLICY_VERSION = 'ot46-billing-policy-v1';
export const OT87_BILLING_POLICY_VERSION = '2026-07-15.1';
export const OT87_POLICY_ID = 'ot87-family-monthly-usd-67-v1';
export const OT87_OFFER_KEY = 'family_monthly_usd_67_v1';
export const OT87_PLAN_TRUTH_TEXT = OT87_PLAN_TRUTH;

export function evaluateBillingEntitlement(input: {
  principal: BillingPrincipalRef;
  subscription:
    | (Pick<
        BillingSubscriptionProjection,
        'status' | 'current_period_end' | 'cancel_at' | 'canceled_at' | 'source_event_key'
      > & { cancel_at_period_end?: boolean })
    | null;
  currentInvoice?: Pick<
    BillingInvoiceSummary,
    | 'status'
    | 'currency'
    | 'amount_due_cents'
    | 'amount_paid_cents'
    | 'refunded_amount_cents'
    | 'dispute_state'
  > | null;
  source: string;
  effectiveAt: Date;
  evaluatedAt: Date;
  reconciliationConfidence: 'verified' | 'stale' | 'contradictory' | 'unknown';
  policyVersion?: string;
  emergencyMode?: 'normal' | 'deny_all';
}): BillingEntitlementProjection {
  const status = input.subscription?.status ?? 'unknown';
  const policyVersion = input.policyVersion ?? BILLING_POLICY_VERSION;
  const base = {
    entitlement_key: `billing_entitlement:${input.principal.account_key}:${input.principal.product_key}:${input.principal.principal_key}`,
    ...input.principal,
    policy_version: policyVersion,
    source: input.source,
    effective_at: input.effectiveAt.toISOString(),
    evaluated_at: input.evaluatedAt.toISOString(),
    grants_access: false,
  };

  if (input.emergencyMode === 'deny_all') {
    return { ...base, status: 'suspended', reason: 'emergency_deny_all' };
  }
  if (input.reconciliationConfidence === 'contradictory') {
    return { ...base, status: 'manual_review', reason: 'contradictory_verified_projection' };
  }
  if (input.reconciliationConfidence === 'stale') {
    return { ...base, status: 'manual_review', reason: 'stale_projection_requires_review' };
  }

  switch (status) {
    case 'trialing':
      return policyVersion === OT87_BILLING_POLICY_VERSION
        ? { ...base, status: 'manual_review', reason: 'trial_disabled_in_ot87_v1' }
        : { ...base, status: 'billing_eligible', reason: 'trialing_projection_only' };
    case 'active': {
      const paid = invoiceIsCurrentPaid(input.currentInvoice);
      if (
        input.subscription?.cancel_at_period_end &&
        future(input.subscription.current_period_end, input.evaluatedAt)
      ) {
        return paid
          ? {
              ...base,
              status: 'scheduled_end',
              reason: 'active_cancel_at_period_end_paid_current_invoice',
              grants_access: true,
            }
          : {
              ...base,
              status: 'scheduled_end',
              reason: 'active_cancel_at_period_end_missing_paid_invoice',
            };
      }
      return paid
        ? { ...base, status: 'active', reason: 'active_paid_current_invoice', grants_access: true }
        : { ...base, status: 'active', reason: 'active_projection_without_paid_invoice' };
    }
    case 'canceled':
      return input.subscription?.current_period_end &&
        future(input.subscription.current_period_end, input.evaluatedAt) &&
        invoiceIsCurrentPaid(input.currentInvoice)
        ? {
            ...base,
            status: 'scheduled_end',
            reason: 'canceled_with_paid_current_period_end',
            grants_access: true,
          }
        : { ...base, status: 'revoked', reason: 'canceled_without_current_paid_access' };
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return { ...base, status: 'suspended', reason: `${status}_projection_only` };
    case 'incomplete':
      return { ...base, status: 'pending', reason: 'incomplete_checkout_projection_only' };
    case 'incomplete_expired':
      return policyVersion === OT87_BILLING_POLICY_VERSION
        ? { ...base, status: 'revoked', reason: 'incomplete_expired_no_access' }
        : { ...base, status: 'manual_review', reason: 'incomplete_expired_projection_only' };
    case 'disputed':
    case 'refunded':
      return { ...base, status: 'manual_review', reason: `${status}_requires_manual_review` };
    default:
      return { ...base, status: 'manual_review', reason: 'unrecognized_billing_state' };
  }
}

function invoiceIsCurrentPaid(
  invoice:
    | Pick<
        BillingInvoiceSummary,
        | 'status'
        | 'currency'
        | 'amount_due_cents'
        | 'amount_paid_cents'
        | 'refunded_amount_cents'
        | 'dispute_state'
      >
    | null
    | undefined,
) {
  if (!invoice) return false;
  if (invoice.status !== 'paid') return false;
  if (invoice.currency !== 'usd') return false;
  if (invoice.amount_due_cents !== 6700 || invoice.amount_paid_cents !== 6700) return false;
  if ((invoice.refunded_amount_cents ?? 0) > 0) return false;
  if (invoice.dispute_state && invoice.dispute_state !== 'none') return false;
  return true;
}

function future(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > now.getTime();
}
