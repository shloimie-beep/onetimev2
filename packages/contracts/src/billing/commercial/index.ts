import type { AdultAuthorizationContext } from '../../access/v21-household-authorization.ts';
import type { JobScope, TransactionalOutboxIntent } from '../../jobs/index.ts';

export const COMMERCIAL_BILLING_CONTRACT_VERSION = '1.0.0' as const;

export const FAMILY_PLAN = {
  planKey: 'family_live_library_monthly_usd_67',
  displayName: 'One Time Live + Library',
  currency: 'USD',
  amountCents: 6700,
  interval: 'month',
  householdSeatLimit: 3,
} as const;

export const FREE_PERIOD_POLICY = {
  sourceKey: 'family_free_period_v2_1',
  timeZone: 'Asia/Jerusalem',
} as const;

/**
 * Compatibility shape for callers that still import the former constant.
 * Empty timestamps deliberately carry no launch default.
 */
export const FIXED_FREE_PERIOD = {
  ...FREE_PERIOD_POLICY,
  endsAt: '',
  endsAtUtc: '',
} as const;

export type CommercialBillingAccessState = 'free' | 'active' | 'inactive';
export type CommercialSubscriptionState =
  | 'none'
  | 'checkout_requested'
  | 'scheduled'
  | 'active'
  | 'cancellation_requested'
  | 'cancel_at_period_end'
  | 'canceled'
  | 'refund_review';

export interface CommercialBillingProjection {
  householdId: string;
  ownerAdultId: string;
  accessState: CommercialBillingAccessState;
  subscriptionState: CommercialSubscriptionState;
  activeStudentCount: number;
  freePeriodEndsAt: string | null;
  paidPeriodEndsAt: string | null;
  firstChargeAt: string | null;
  cancelAtPeriodEnd: boolean;
  sourceEvidenceDigest: string | null;
  version: number;
}

export interface CommercialBillingActor {
  adultId: string;
  authorization: AdultAuthorizationContext;
}

export interface CommercialBillingCommandBase {
  householdId: string;
  idempotencyKey: string;
  expectedVersion: number;
  scope: JobScope;
}

export interface ImmediateChargeConsent {
  consentVersion: 'immediate-charge-v1';
  actorAdultId: string;
  householdId: string;
  displayedAmountCents: 6700;
  displayedCurrency: 'USD';
  displayedChargeAt: string;
  affirmativelyAccepted: true;
  acceptedAt: string;
}

export interface RequestHostedCheckout extends CommercialBillingCommandBase {
  kind: 'request_hosted_checkout';
  mode: 'standard' | 'immediate_exception';
  requestedAt: string;
  consent: ImmediateChargeConsent | null;
}

export interface RequestHostedPortal extends CommercialBillingCommandBase {
  kind: 'request_hosted_portal';
  requestedAt: string;
}

export interface RequestPeriodEndCancellation extends CommercialBillingCommandBase {
  kind: 'request_period_end_cancellation';
  requestedAt: string;
}

export interface RequestRefundException extends CommercialBillingCommandBase {
  kind: 'request_refund_exception';
  requestedAt: string;
  invoiceRefHash: string;
  amountCents: number;
  reasonCode: string;
}

export type CommercialBillingCommand =
  | RequestHostedCheckout
  | RequestHostedPortal
  | RequestPeriodEndCancellation
  | RequestRefundException;

export interface HostedCommercialBillingIntent extends TransactionalOutboxIntent {
  provider: 'highlevel';
  operation_type:
    | 'billing.commercial.checkout.request'
    | 'billing.commercial.portal.request'
    | 'billing.commercial.cancel_at_period_end.request'
    | 'billing.commercial.refund_exception.request';
  financialProvider: 'stripe';
  providerMutationByOneTime: false;
  householdId: string;
  planKey: typeof FAMILY_PLAN.planKey;
  planAmountCents: typeof FAMILY_PLAN.amountCents;
  planCurrency: typeof FAMILY_PLAN.currency;
  planInterval: typeof FAMILY_PLAN.interval;
  chargeMode:
    'scheduled_at_free_period_end' | 'at_hosted_checkout' | 'explicit_immediate_exception' | null;
  firstChargeAt: string | null;
  immediateChargeAmountCents: number;
  explicitConsentDigest: string | null;
}

export interface CommercialBillingCommandResult {
  disposition: 'applied' | 'replayed';
  projection: CommercialBillingProjection;
  intent: HostedCommercialBillingIntent;
}

export interface VerifiedCommercialBillingEvidence {
  evidenceId: string;
  evidenceDigest: string;
  signatureVerified: true;
  provider: 'stripe';
  orchestratedBy: 'highlevel';
  householdId: string;
  amountCents: 6700;
  currency: 'USD';
  subscriptionState: 'scheduled' | 'active' | 'cancel_at_period_end' | 'canceled';
  firstChargeAt: string | null;
  currentPaidPeriodEndsAt: string | null;
  observedAt: string;
  scope: JobScope;
}

export interface CommercialBillingRepository {
  load(householdId: string): Promise<CommercialBillingProjection | null>;
  replayCommand(input: {
    actorRef: string;
    operationScope: string;
    idempotencyKey: string;
    canonicalRequestHash: string;
  }): Promise<CommercialBillingCommandResult | null>;
  createSignup(input: {
    idempotencyKey: string;
    canonicalRequestHash: string;
    scope: JobScope;
    projection: CommercialBillingProjection;
  }): Promise<{
    disposition: 'applied' | 'replayed';
    projection: CommercialBillingProjection;
  }>;
  execute(input: {
    actorRef: string;
    operationScope: string;
    idempotencyKey: string;
    canonicalRequestHash: string;
    expectedVersion: number;
    scope: JobScope;
    nextProjection: CommercialBillingProjection;
    intent: HostedCommercialBillingIntent;
  }): Promise<CommercialBillingCommandResult>;
  applyEvidence(
    prior: CommercialBillingProjection,
    evidence: VerifiedCommercialBillingEvidence,
    nextProjection: CommercialBillingProjection,
  ): Promise<{ disposition: 'applied' | 'replayed'; projection: CommercialBillingProjection }>;
}
