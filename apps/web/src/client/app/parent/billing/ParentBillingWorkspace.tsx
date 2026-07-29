import React from 'react';
import {
  FAMILY_PLAN,
  type CommercialBillingProjection,
} from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';

export function ParentBillingWorkspace({
  projection,
  now,
  freePeriod,
  immediateChargeAccepted,
  onImmediateChargeAcceptedChange,
  onStandardCheckout,
  onImmediateCheckout,
  onOpenPortal,
  onCancelAtPeriodEnd,
}: {
  projection: CommercialBillingProjection;
  now: Date;
  freePeriod: {
    sourceKey: string;
    timeZone: 'Asia/Jerusalem';
    endsAt: string;
  };
  immediateChargeAccepted: boolean;
  onImmediateChargeAcceptedChange: (accepted: boolean) => void;
  onStandardCheckout: () => void;
  onImmediateCheckout: () => void;
  onOpenPortal: () => void;
  onCancelAtPeriodEnd: () => void;
}) {
  const remainingMilliseconds = Math.max(0, Date.parse(freePeriod.endsAt) - now.getTime());
  const remainingDays = Math.ceil(remainingMilliseconds / (24 * 60 * 60 * 1000));
  const hasSubscription = projection.subscriptionState !== 'none';
  const portalAvailable = !['none', 'checkout_requested'].includes(projection.subscriptionState);

  return (
    <section
      aria-labelledby="parent-billing-heading"
      data-free-period-source={freePeriod.sourceKey}
    >
      <header>
        <h2 id="parent-billing-heading">Family billing</h2>
        <p>
          {FAMILY_PLAN.displayName}: ${FAMILY_PLAN.amountCents / 100} {FAMILY_PLAN.currency} per
          household each month, including up to {FAMILY_PLAN.householdSeatLimit} active Students.
        </p>
      </header>

      {projection.accessState === 'free' ? (
        <V21StatePanel kind="loading" title="Free access is active">
          <p>
            {remainingDays} days remain. The fixed free period ends at{' '}
            <time dateTime={freePeriod.endsAt}>{freePeriod.endsAt}</time> in {freePeriod.timeZone}.
            No card is required for free signup.
          </p>
        </V21StatePanel>
      ) : null}

      <dl>
        <div>
          <dt>Access</dt>
          <dd>{projection.accessState}</dd>
        </div>
        <div>
          <dt>Subscription</dt>
          <dd>{projection.subscriptionState}</dd>
        </div>
        <div>
          <dt>Active Students</dt>
          <dd>
            {projection.activeStudentCount} of {FAMILY_PLAN.householdSeatLimit}
          </dd>
        </div>
      </dl>

      {!hasSubscription ? (
        <div>
          <button type="button" onClick={onStandardCheckout}>
            Continue to hosted Checkout
          </button>
          <p>
            Standard Checkout schedules the first charge for the free-period end and does not charge
            immediately.
          </p>
          <fieldset>
            <legend>Optional immediate-charge exception</legend>
            <p>
              Charge exactly ${FAMILY_PLAN.amountCents / 100} {FAMILY_PLAN.currency} now instead of
              at the free-period end.
            </p>
            <label>
              <input
                type="checkbox"
                checked={immediateChargeAccepted}
                onChange={(event) => onImmediateChargeAcceptedChange(event.currentTarget.checked)}
              />
              I separately consent to the displayed immediate charge.
            </label>
            <button
              type="button"
              disabled={!immediateChargeAccepted}
              aria-describedby="immediate-charge-explanation"
              onClick={onImmediateCheckout}
            >
              Continue with immediate charge
            </button>
            <p id="immediate-charge-explanation">
              This consent is never preselected or bundled with standard Checkout.
            </p>
          </fieldset>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          disabled={!portalAvailable}
          title={
            portalAvailable
              ? undefined
              : 'The hosted portal becomes available after subscription verification.'
          }
          onClick={onOpenPortal}
        >
          Open approved GHL/Stripe-hosted billing portal
        </button>
        {projection.accessState === 'active' &&
        !projection.cancelAtPeriodEnd &&
        projection.subscriptionState !== 'cancellation_requested' ? (
          <button type="button" onClick={onCancelAtPeriodEnd}>
            Cancel at paid period end
          </button>
        ) : null}
      </div>

      <p>
        Refunds are manual exceptions requiring Admin approval. Cancellation preserves learning data
        and paid access through the current paid period.
      </p>
    </section>
  );
}
