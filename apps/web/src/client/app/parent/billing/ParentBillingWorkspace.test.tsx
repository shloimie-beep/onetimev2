import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FIXED_FREE_PERIOD } from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import { ParentBillingWorkspace } from './ParentBillingWorkspace.tsx';

describe('ParentBillingWorkspace', () => {
  it('shows exact plan, configured countdown source, hosted surfaces, and no card collection', () => {
    const markup = renderToStaticMarkup(
      <ParentBillingWorkspace
        projection={{
          householdId: 'household_one',
          ownerAdultId: 'adult_owner',
          accessState: 'free',
          subscriptionState: 'none',
          activeStudentCount: 3,
          freePeriodEndsAt: FIXED_FREE_PERIOD.endsAt,
          paidPeriodEndsAt: null,
          firstChargeAt: null,
          cancelAtPeriodEnd: false,
          sourceEvidenceDigest: null,
          version: 1,
        }}
        now={new Date('2026-09-12T16:24:00.000Z')}
        freePeriod={FIXED_FREE_PERIOD}
        immediateChargeAccepted={false}
        onImmediateChargeAcceptedChange={vi.fn()}
        onStandardCheckout={vi.fn()}
        onImmediateCheckout={vi.fn()}
        onOpenPortal={vi.fn()}
        onCancelAtPeriodEnd={vi.fn()}
      />,
    );
    expect(markup).toContain('$67 USD');
    expect(markup).toContain('up to 3 active Students');
    expect(markup).toContain('data-free-period-source="family_free_period_v2_1"');
    expect(markup).toContain('Asia/Jerusalem');
    expect(markup).toContain('No card is required');
    expect(markup).toContain('GHL/Stripe-hosted billing portal');
    expect(markup).not.toContain('name="card');
    expect(markup).not.toContain('autocomplete="cc-');
  });

  it('keeps immediate-charge consent separate, unchecked, and disabled by default', () => {
    const markup = renderToStaticMarkup(
      <ParentBillingWorkspace
        projection={{
          householdId: 'household_one',
          ownerAdultId: 'adult_owner',
          accessState: 'free',
          subscriptionState: 'none',
          activeStudentCount: 0,
          freePeriodEndsAt: FIXED_FREE_PERIOD.endsAt,
          paidPeriodEndsAt: null,
          firstChargeAt: null,
          cancelAtPeriodEnd: false,
          sourceEvidenceDigest: null,
          version: 1,
        }}
        now={new Date('2026-08-01T00:00:00.000Z')}
        freePeriod={FIXED_FREE_PERIOD}
        immediateChargeAccepted={false}
        onImmediateChargeAcceptedChange={vi.fn()}
        onStandardCheckout={vi.fn()}
        onImmediateCheckout={vi.fn()}
        onOpenPortal={vi.fn()}
        onCancelAtPeriodEnd={vi.fn()}
      />,
    );
    expect(markup).toContain('Optional immediate-charge exception');
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('never preselected or bundled');
  });
});
