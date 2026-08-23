import { describe, expect, it } from 'vitest';
import type { BillingEntitlementProjection } from './types.ts';
import { deriveBillingGhlLifecycleEvent } from './highlevel-lifecycle.ts';

describe('signed billing to HighLevel lifecycle source', () => {
  it.each([
    ['active', 'active_paid_current_invoice', true, 'OT-04', 'billing.payment_active.v1'],
    ['suspended', 'past_due_projection_only', false, 'OT-05', 'billing.payment_failed_grace.v1'],
    [
      'scheduled_end',
      'active_cancel_at_period_end_paid_current_invoice',
      true,
      'OT-06',
      'billing.subscription_canceled.v1',
    ],
    [
      'manual_review',
      'refunded_requires_manual_review',
      false,
      'OT-13',
      'billing.refund_or_chargeback.v1',
    ],
    [
      'manual_review',
      'disputed_requires_manual_review',
      false,
      'OT-13',
      'billing.refund_or_chargeback.v1',
    ],
  ] as const)(
    'maps %s/%s only to its exact adult workflow',
    (status, reason, grantsAccess, workflowKey, eventType) => {
      const event = deriveBillingGhlLifecycleEvent(
        projection({ status, reason, grants_access: grantsAccess }),
      );

      expect(event).toMatchObject({
        workflow_key: workflowKey,
        event_type: eventType,
        subject_kind: 'adult_household',
        signed_billing_projection: true,
        local_commit_readback: true,
        student_contact_allowed: false,
        provider_financial_mutation: false,
        provider_access_mutation: false,
      });
      expect(event?.trigger).toBeTruthy();
      expect(event?.source_event_digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(event?.episode_key).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it('records a non-dispatchable checkpoint for unverified active state', () => {
    const event = deriveBillingGhlLifecycleEvent(
      projection({
        status: 'active',
        reason: 'active_projection_without_paid_invoice',
        grants_access: false,
      }),
    );

    expect(event).toMatchObject({
      workflow_key: null,
      event_type: 'billing.lifecycle_checkpoint.v1',
      trigger: null,
    });
  });

  it('does not produce a GHL source for a non-household billing principal', () => {
    expect(
      deriveBillingGhlLifecycleEvent(projection({ principal_type: 'account_user' })),
    ).toBeNull();
  });

  it('is deterministic and never projects provider or contact material', () => {
    const input = projection({});
    const first = deriveBillingGhlLifecycleEvent(input);
    const second = deriveBillingGhlLifecycleEvent(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(
      /email|phone|card|payment_method|checkout_url|provider_customer|provider_subscription/iu,
    );
  });
});

function projection(
  overrides: Partial<BillingEntitlementProjection>,
): BillingEntitlementProjection {
  return {
    entitlement_key: 'billing_entitlement:one_time:family:household-1',
    account_key: 'one_time',
    product_key: 'family',
    principal_key: 'household-1',
    principal_type: 'opaque',
    status: 'active',
    policy_version: '2026-07-15.1',
    source: 'billing_event_1',
    reason: 'active_paid_current_invoice',
    effective_at: '2026-08-05T12:00:00.000Z',
    evaluated_at: '2026-08-05T12:00:01.000Z',
    grants_access: true,
    ...overrides,
  };
}
