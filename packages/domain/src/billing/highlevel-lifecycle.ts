import { createHash } from 'node:crypto';
import type { BillingEntitlementProjection } from './types.ts';
import { CORE_WORKFLOW_BY_KEY } from '../communications/workflows/core/definitions.ts';

export const BILLING_GHL_WORKFLOW_KEYS = ['OT-04', 'OT-05', 'OT-06', 'OT-13'] as const;
export type BillingGhlWorkflowKey = (typeof BILLING_GHL_WORKFLOW_KEYS)[number];

export type BillingGhlLifecycleEventType =
  | 'billing.payment_active.v1'
  | 'billing.payment_failed_grace.v1'
  | 'billing.subscription_canceled.v1'
  | 'billing.refund_or_chargeback.v1'
  | 'billing.lifecycle_checkpoint.v1';

export type BillingGhlLifecycleEvent = {
  transition_key: string;
  entitlement_key: string;
  account_key: string;
  product_key: string;
  household_key: string;
  subject_kind: 'adult_household';
  workflow_key: BillingGhlWorkflowKey | null;
  event_type: BillingGhlLifecycleEventType;
  trigger: string | null;
  source_event_id: string;
  source_event_digest: string;
  episode_key: string;
  episode_discriminator: string;
  projection_status: BillingEntitlementProjection['status'];
  projection_reason: string;
  projection_grants_access: boolean;
  policy_version: string;
  effective_at: string;
  signed_billing_projection: true;
  local_commit_readback: true;
  student_contact_allowed: false;
  provider_financial_mutation: false;
  provider_access_mutation: false;
};

type LifecycleTarget = {
  workflow_key: BillingGhlWorkflowKey | null;
  event_type: BillingGhlLifecycleEventType;
  episode_discriminator: string;
};

/**
 * Converts the signed, minimized billing projection into an adult-household
 * workflow source event. Provider IDs, tags, email addresses, payment details,
 * and provider URLs are deliberately excluded.
 */
export function deriveBillingGhlLifecycleEvent(
  projection: BillingEntitlementProjection,
): BillingGhlLifecycleEvent | null {
  if (projection.principal_type !== 'opaque') return null;

  const target = classifyLifecycleTarget(projection);
  const trigger = target.workflow_key ? CORE_WORKFLOW_BY_KEY[target.workflow_key].trigger : null;
  const sourceEventDigest = digest([
    'billing-ghl-source-v1',
    projection.entitlement_key,
    projection.account_key,
    projection.product_key,
    projection.principal_key,
    projection.status,
    projection.reason,
    String(projection.grants_access),
    projection.policy_version,
    projection.source,
    projection.effective_at,
  ]);
  const episodeKey = digest([
    'billing-ghl-episode-v1',
    projection.account_key,
    projection.product_key,
    projection.principal_key,
    target.episode_discriminator,
    projection.source,
  ]);

  return {
    transition_key: digest([
      'billing-ghl-transition-v1',
      projection.entitlement_key,
      projection.source,
      target.episode_discriminator,
    ]),
    entitlement_key: projection.entitlement_key,
    account_key: projection.account_key,
    product_key: projection.product_key,
    household_key: projection.principal_key,
    subject_kind: 'adult_household',
    workflow_key: target.workflow_key,
    event_type: target.event_type,
    trigger,
    source_event_id: projection.source,
    source_event_digest: sourceEventDigest,
    episode_key: episodeKey,
    episode_discriminator: target.episode_discriminator,
    projection_status: projection.status,
    projection_reason: projection.reason,
    projection_grants_access: projection.grants_access,
    policy_version: projection.policy_version,
    effective_at: projection.effective_at,
    signed_billing_projection: true,
    local_commit_readback: true,
    student_contact_allowed: false,
    provider_financial_mutation: false,
    provider_access_mutation: false,
  };
}

function classifyLifecycleTarget(projection: BillingEntitlementProjection): LifecycleTarget {
  if (
    projection.status === 'active' &&
    projection.grants_access &&
    projection.reason === 'active_paid_current_invoice'
  ) {
    return {
      workflow_key: 'OT-04',
      event_type: 'billing.payment_active.v1',
      episode_discriminator: 'OT-04:verified_active',
    };
  }

  if (
    projection.status === 'suspended' &&
    ['past_due_projection_only', 'unpaid_projection_only'].includes(projection.reason)
  ) {
    return {
      workflow_key: 'OT-05',
      event_type: 'billing.payment_failed_grace.v1',
      episode_discriminator: 'OT-05:payment_failure_grace',
    };
  }

  if (
    (projection.status === 'scheduled_end' && projection.reason.includes('cancel')) ||
    (projection.status === 'revoked' &&
      projection.reason === 'canceled_without_current_paid_access')
  ) {
    return {
      workflow_key: 'OT-06',
      event_type: 'billing.subscription_canceled.v1',
      episode_discriminator: 'OT-06:subscription_canceled',
    };
  }

  if (
    projection.status === 'manual_review' &&
    projection.reason === 'refunded_requires_manual_review'
  ) {
    return {
      workflow_key: 'OT-13',
      event_type: 'billing.refund_or_chargeback.v1',
      episode_discriminator: 'OT-13:refund',
    };
  }

  if (
    projection.status === 'manual_review' &&
    projection.reason === 'disputed_requires_manual_review'
  ) {
    return {
      workflow_key: 'OT-13',
      event_type: 'billing.refund_or_chargeback.v1',
      episode_discriminator: 'OT-13:chargeback',
    };
  }

  return {
    workflow_key: null,
    event_type: 'billing.lifecycle_checkpoint.v1',
    episode_discriminator: [
      'not_applicable',
      projection.status,
      projection.reason,
      projection.grants_access ? 'access' : 'no_access',
    ].join(':'),
  };
}

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}
