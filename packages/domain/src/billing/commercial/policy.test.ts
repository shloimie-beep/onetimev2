import { describe, expect, it } from 'vitest';
import type {
  CommercialBillingActor,
  RequestHostedCheckout,
  VerifiedCommercialBillingEvidence,
} from '../../../../contracts/src/billing/commercial/index.ts';
import {
  FAMILY_PLAN,
  FIXED_FREE_PERIOD,
} from '../../../../contracts/src/billing/commercial/index.ts';
import { CommercialBillingError } from './errors.ts';
import {
  DEFAULT_FREE_PERIOD_CONFIGURATION,
  applyVerifiedCommercialEvidence,
  createFamilySignupProjection,
  freePeriodStatus,
  planHostedBillingCommand,
} from './policy.ts';

const scope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
} as const;

const parent: CommercialBillingActor = {
  adultId: 'adult_owner',
  authorization: {
    humanAccountId: 'account_owner',
    memberships: ['parent'],
    activeRole: 'parent',
    activeHouseholdId: 'household_one',
    serverResolvedOwnedHouseholdIds: ['household_one'],
  },
};

const admin: CommercialBillingActor = {
  adultId: 'adult_admin',
  authorization: {
    humanAccountId: 'account_admin',
    memberships: ['admin'],
    activeRole: 'admin',
    activeHouseholdId: null,
    serverResolvedOwnedHouseholdIds: [],
  },
};

function freeProjection(now = new Date('2026-08-01T12:00:00Z')) {
  return createFamilySignupProjection({
    householdId: 'household_one',
    ownerAdultId: parent.adultId,
    activeStudentCount: 3,
    now,
    configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
  });
}

function checkout(overrides: Partial<RequestHostedCheckout> = {}): RequestHostedCheckout {
  return {
    kind: 'request_hosted_checkout',
    householdId: 'household_one',
    idempotencyKey: 'checkout-key-0001',
    expectedVersion: 1,
    scope,
    mode: 'standard',
    requestedAt: '2026-08-01T12:00:00.000Z',
    consent: null,
    ...overrides,
  };
}

describe('P25 commercial billing policy', () => {
  it('uses the configured Jerusalem instant and creates free or inactive no-card signup state', () => {
    const active = freePeriodStatus({
      now: new Date('2026-09-13T16:23:59.999Z'),
      configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
    });
    expect(active).toMatchObject({
      active: true,
      sourceKey: FIXED_FREE_PERIOD.sourceKey,
      timeZone: 'Asia/Jerusalem',
      endsAt: '2026-09-13T19:24:00+03:00',
    });
    expect(freeProjection().accessState).toBe('free');
    expect(freeProjection(new Date(FIXED_FREE_PERIOD.endsAt)).accessState).toBe('inactive');
  });

  it('hard-caps the Family plan at three active Students', () => {
    expect(FAMILY_PLAN).toMatchObject({
      amountCents: 6700,
      currency: 'USD',
      interval: 'month',
      householdSeatLimit: 3,
    });
    expect(() =>
      createFamilySignupProjection({
        householdId: 'household_one',
        ownerAdultId: parent.adultId,
        activeStudentCount: 4,
        now: new Date(),
        configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
      }),
    ).toThrowError(CommercialBillingError);
  });

  it('plans standard pre-expiry hosted Checkout with no immediate charge', () => {
    const planned = planHostedBillingCommand({
      actor: parent,
      command: checkout(),
      prior: freeProjection(),
      configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
    });
    expect(planned.intent).toMatchObject({
      provider: 'highlevel',
      financialProvider: 'stripe',
      providerMutationByOneTime: false,
      immediateChargeAmountCents: 0,
      chargeMode: 'scheduled_at_free_period_end',
      planKey: 'family_live_library_monthly_usd_67',
      planAmountCents: 6700,
      firstChargeAt: FIXED_FREE_PERIOD.endsAt,
    });
    expect(planned.projection.accessState).toBe('free');
  });

  it('rejects silent immediate charge and binds separately accepted amount, time, actor, and scope', () => {
    expect(() =>
      planHostedBillingCommand({
        actor: parent,
        command: checkout({ mode: 'immediate_exception' }),
        prior: freeProjection(),
        configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
      }),
    ).toThrowError(expect.objectContaining({ code: 'consent_required' }));

    const requestedAt = '2026-08-01T12:00:00.000Z';
    const planned = planHostedBillingCommand({
      actor: parent,
      command: checkout({
        mode: 'immediate_exception',
        requestedAt,
        consent: {
          consentVersion: 'immediate-charge-v1',
          actorAdultId: parent.adultId,
          householdId: 'household_one',
          displayedAmountCents: 6700,
          displayedCurrency: 'USD',
          displayedChargeAt: requestedAt,
          affirmativelyAccepted: true,
          acceptedAt: '2026-08-01T11:59:59.000Z',
        },
      }),
      prior: freeProjection(),
      configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
    });
    expect(planned.intent.immediateChargeAmountCents).toBe(6700);
    expect(planned.intent.explicitConsentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed for cross-household Parent access and Parent refund attempts', () => {
    expect(() =>
      planHostedBillingCommand({
        actor: parent,
        command: checkout({ householdId: 'household_two' }),
        prior: freeProjection(),
        configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
      }),
    ).toThrowError(expect.objectContaining({ code: 'cross_household_denied' }));

    expect(() =>
      planHostedBillingCommand({
        actor: parent,
        command: {
          kind: 'request_refund_exception',
          householdId: 'household_one',
          idempotencyKey: 'refund-key-0001',
          expectedVersion: 1,
          scope,
          requestedAt: '2026-08-01T12:00:00.000Z',
          invoiceRefHash: 'a'.repeat(64),
          amountCents: 6700,
          reasonCode: 'operator_exception',
        },
        prior: freeProjection(),
        configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
      }),
    ).toThrowError(expect.objectContaining({ code: 'admin_approval_required' }));
  });

  it('allows only an Admin to create a bounded manual refund exception', () => {
    const planned = planHostedBillingCommand({
      actor: admin,
      command: {
        kind: 'request_refund_exception',
        householdId: 'household_one',
        idempotencyKey: 'refund-key-0001',
        expectedVersion: 1,
        scope,
        requestedAt: '2026-08-01T12:00:00.000Z',
        invoiceRefHash: 'a'.repeat(64),
        amountCents: 6700,
        reasonCode: 'operator_exception',
      },
      prior: freeProjection(),
      configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
    });
    expect(planned.intent.operation_type).toBe('billing.commercial.refund_exception.request');
    expect(planned.projection.subscriptionState).toBe('refund_review');
  });

  it('preserves paid access when cancellation is scheduled for period end', () => {
    const prior = {
      ...freeProjection(),
      accessState: 'active' as const,
      subscriptionState: 'active' as const,
      paidPeriodEndsAt: '2026-10-01T00:00:00.000Z',
    };
    const planned = planHostedBillingCommand({
      actor: parent,
      command: {
        kind: 'request_period_end_cancellation',
        householdId: 'household_one',
        idempotencyKey: 'cancel-key-0001',
        expectedVersion: 1,
        scope,
        requestedAt: '2026-09-20T12:00:00.000Z',
      },
      prior,
      configuration: DEFAULT_FREE_PERIOD_CONFIGURATION,
    });
    expect(planned.projection).toMatchObject({
      accessState: 'active',
      subscriptionState: 'cancellation_requested',
      cancelAtPeriodEnd: false,
      paidPeriodEndsAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('changes access only from matching verified evidence and replays the same digest', () => {
    const prior = freeProjection(new Date(FIXED_FREE_PERIOD.endsAt));
    const evidence: VerifiedCommercialBillingEvidence = {
      evidenceId: 'stripe-event-hash-0001',
      evidenceDigest: 'b'.repeat(64),
      signatureVerified: true,
      provider: 'stripe',
      orchestratedBy: 'highlevel',
      householdId: 'household_one',
      amountCents: 6700,
      currency: 'USD',
      subscriptionState: 'active',
      firstChargeAt: FIXED_FREE_PERIOD.endsAt,
      currentPaidPeriodEndsAt: '2026-10-13T16:24:00.000Z',
      observedAt: '2026-09-13T16:24:01.000Z',
      scope,
    };
    const applied = applyVerifiedCommercialEvidence({
      prior,
      evidence,
      now: new Date(evidence.observedAt),
    });
    expect(applied).toMatchObject({ accessState: 'active', version: 2 });
    expect(
      applyVerifiedCommercialEvidence({
        prior: applied,
        evidence,
        now: new Date(evidence.observedAt),
      }),
    ).toBe(applied);
    expect(() =>
      applyVerifiedCommercialEvidence({
        prior,
        evidence: { ...evidence, amountCents: 1 as 6700 },
        now: new Date(evidence.observedAt),
      }),
    ).toThrowError(expect.objectContaining({ code: 'evidence_mismatch' }));
  });
});
