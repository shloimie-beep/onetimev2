export const BILLING_ACCESS_CONTRACT_VERSION = '1.0.0' as const;

export const BILLING_ACCESS_STATES = ['free', 'active', 'grace', 'inactive'] as const;
export type BillingAccessState = (typeof BILLING_ACCESS_STATES)[number];

export const BILLING_EVENT_KINDS = [
  'term_paid',
  'payment_failed',
  'subscription_inactive',
] as const;
export type BillingEventKind = (typeof BILLING_EVENT_KINDS)[number];

export const BILLING_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1_000;
export const BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1_000;
export const BILLING_WEBHOOK_MAX_BYTES = 2 * 1024 * 1024;

export const INACTIVE_PARENT_CAPABILITIES = [
  'overview',
  'household_switcher',
  'billing',
  'reactivation',
  'support_list',
  'support_detail',
  'account',
  'privacy',
  'data_rights',
] as const;
export type InactiveParentCapability = (typeof INACTIVE_PARENT_CAPABILITIES)[number];

export const STUDENT_INACTIVE_DENIAL_COPY =
  'This household’s access is inactive. Ask your account owner to restore access.' as const;

export interface VerifiedBillingEvent {
  event_id: string;
  provider: 'stripe';
  household_id: string;
  provider_customer_ref_hash: string;
  billing_term_id: string;
  kind: BillingEventKind;
  occurred_at: string;
  term_ends_at: string;
  payload_digest: string;
  signature_verified: true;
}

export interface BillingEventCursor {
  event_id: string;
  billing_term_id: string;
  occurred_at: string;
  term_ends_at: string;
}

export interface BillingFailureCursor extends BillingEventCursor {
  grace_started_at: string;
  grace_ends_at: string;
}

export interface HouseholdBillingProjection {
  household_id: string;
  provider_customer_ref_hash: string;
  state: BillingAccessState;
  paid_winner: BillingEventCursor | null;
  unresolved_failure: BillingFailureCursor | null;
  inactive_winner: BillingEventCursor | null;
  version: number;
  updated_at: string;
}

export interface BillingEventReceipt {
  event_id: string;
  household_id: string;
  provider_customer_ref_hash: string;
  billing_term_id: string;
  kind: BillingEventKind;
  occurred_at: string;
  received_at: string;
  payload_digest: string;
  signature_verified: true;
  projection_version: number;
}

export interface BillingProjectionResult {
  projection: HouseholdBillingProjection;
  receipt: BillingEventReceipt;
  duplicate: boolean;
}

export interface BillingAccessRepository {
  projectVerifiedEvent(
    event: VerifiedBillingEvent,
    receivedAt: Date,
  ): Promise<BillingProjectionResult>;
  expireGrace(householdId: string, now: Date): Promise<HouseholdBillingProjection | null>;
  getProjection(householdId: string): Promise<HouseholdBillingProjection | null>;
}

export type BillingRouteCapability =
  | InactiveParentCapability
  | 'students'
  | 'calendar_class'
  | 'progress'
  | 'updates'
  | 'newsletter'
  | 'reminder_preferences'
  | 'classroom'
  | 'library'
  | 'question'
  | 'notifications';

export interface BillingAuthorizationInput {
  role: 'parent' | 'student';
  session_household_id: string;
  requested_household_id: string;
  route_capability: BillingRouteCapability;
  projection: HouseholdBillingProjection;
  now: Date;
  upstream_role_authorized: boolean;
}

export type BillingAuthorizationDecision =
  | {
      allowed: true;
      access_state: Exclude<BillingAccessState, 'inactive'>;
      data_scope: 'role_appropriate';
      provider_bootstrap_allowed: boolean;
    }
  | {
      allowed: true;
      access_state: 'inactive';
      data_scope: 'inactive_parent_minimal';
      provider_bootstrap_allowed: false;
    }
  | {
      allowed: false;
      code:
        | 'HOUSEHOLD_SCOPE_DENIED'
        | 'UPSTREAM_ROLE_DENIED'
        | 'HOUSEHOLD_INACTIVE'
        | 'INACTIVE_ROUTE_DENIED';
      public_message: string;
      deny_before_protected_render: true;
      provider_bootstrap_allowed: false;
    };

export interface BillingReadbackBinding {
  provider: 'stripe';
  mutation_policy: 'prohibited';
  household_id: string;
  provider_customer_ref_hash: string;
}

export interface BillingReadbackAdapter {
  provider: 'stripe';
  readVerifiedEvents(
    binding: BillingReadbackBinding,
    signal: AbortSignal,
  ): Promise<readonly VerifiedBillingEvent[]>;
}
