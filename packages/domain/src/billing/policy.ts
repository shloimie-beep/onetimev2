import type {
  BillingEntitlementProjection,
  BillingPrincipalRef,
  BillingSubscriptionProjection,
} from './types.ts';

export const BILLING_POLICY_VERSION = 'ot46-billing-policy-v1';

export function evaluateBillingEntitlement(input: {
  principal: BillingPrincipalRef;
  subscription: Pick<
    BillingSubscriptionProjection,
    'status' | 'current_period_end' | 'cancel_at' | 'canceled_at' | 'source_event_key'
  > | null;
  source: string;
  effectiveAt: Date;
  evaluatedAt: Date;
  reconciliationConfidence: 'verified' | 'stale' | 'contradictory' | 'unknown';
}): BillingEntitlementProjection {
  const status = input.subscription?.status ?? 'unknown';
  const base = {
    entitlement_key: `billing_entitlement:${input.principal.account_key}:${input.principal.product_key}:${input.principal.principal_key}`,
    ...input.principal,
    policy_version: BILLING_POLICY_VERSION,
    source: input.source,
    effective_at: input.effectiveAt.toISOString(),
    evaluated_at: input.evaluatedAt.toISOString(),
    grants_access: false as const,
  };

  if (input.reconciliationConfidence === 'contradictory') {
    return { ...base, status: 'manual_review', reason: 'contradictory_verified_projection' };
  }
  if (input.reconciliationConfidence === 'stale') {
    return { ...base, status: 'manual_review', reason: 'stale_projection_requires_review' };
  }

  switch (status) {
    case 'trialing':
      return { ...base, status: 'billing_eligible', reason: 'trialing_projection_only' };
    case 'active':
      return { ...base, status: 'active', reason: 'active_projection_only' };
    case 'canceled':
      return input.subscription?.current_period_end
        ? { ...base, status: 'scheduled_end', reason: 'canceled_with_period_end_projection_only' }
        : { ...base, status: 'revoked', reason: 'canceled_without_period_end_projection_only' };
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return { ...base, status: 'suspended', reason: `${status}_projection_only` };
    case 'incomplete':
      return { ...base, status: 'pending', reason: 'incomplete_checkout_projection_only' };
    case 'incomplete_expired':
    case 'disputed':
    case 'refunded':
      return { ...base, status: 'manual_review', reason: `${status}_requires_manual_review` };
    default:
      return { ...base, status: 'manual_review', reason: 'unrecognized_billing_state' };
  }
}
