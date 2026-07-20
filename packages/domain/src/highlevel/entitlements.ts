import type {
  HighLevelBusinessEventType,
  HighLevelEntitlementStatus,
} from '../../../contracts/src/highlevel/index.ts';
import { FAILED_RENEWAL_GRACE_DAYS, PRELAUNCH_COMPLIMENTARY_CUTOFF_ISO } from './constants.ts';

export type EntitlementProjection = {
  householdKey: string;
  ghlContactId: string;
  ghlSubscriptionId: string | null;
  status: HighLevelEntitlementStatus;
  reason: string;
  effectiveAt: string;
  graceUntil: string | null;
  currentPeriodEnd: string | null;
  complimentaryUntil: string | null;
  lastBillingEvent: string;
  lastReconciled: string;
  version: number;
};

export type EntitlementEvent = {
  eventType: HighLevelBusinessEventType | 'complimentary.granted' | 'grace.expired';
  occurredAt: Date;
  currentPeriodEnd?: Date | null | undefined;
  actorRole?: 'owner' | 'rabbi' | 'admin' | 'system' | undefined;
  fullRefund?: boolean | undefined;
  partialRefund?: boolean | undefined;
};

export function applyHighLevelEntitlementEvent(
  current: EntitlementProjection,
  event: EntitlementEvent,
): EntitlementProjection {
  const occurredAt = event.occurredAt.toISOString();
  const base = {
    ...current,
    effectiveAt: occurredAt,
    lastBillingEvent: event.eventType,
    lastReconciled: occurredAt,
    version: current.version + 1,
  };
  if (event.eventType === 'payment.failed') {
    return {
      ...base,
      status: 'grace',
      reason: 'failed_renewal_7_day_grace',
      graceUntil: addDays(event.occurredAt, FAILED_RENEWAL_GRACE_DAYS).toISOString(),
    };
  }
  if (event.eventType === 'payment.recovered' || event.eventType === 'payment.succeeded') {
    return {
      ...base,
      status: 'active',
      reason: event.eventType === 'payment.recovered' ? 'recovered' : 'successful_payment',
      graceUntil: null,
      currentPeriodEnd: event.currentPeriodEnd?.toISOString() ?? current.currentPeriodEnd,
    };
  }
  if (event.eventType === 'subscription.active') {
    return {
      ...base,
      status: 'active',
      reason: 'subscription_active',
      graceUntil: null,
      currentPeriodEnd: event.currentPeriodEnd?.toISOString() ?? current.currentPeriodEnd,
    };
  }
  if (event.eventType === 'subscription.canceled') {
    const currentPeriodEnd = event.currentPeriodEnd?.toISOString() ?? current.currentPeriodEnd;
    const stillActive =
      currentPeriodEnd !== null &&
      new Date(currentPeriodEnd).getTime() > event.occurredAt.getTime();
    return {
      ...base,
      status: stillActive ? 'active' : 'inactive',
      reason: stillActive ? 'canceled_through_current_period_end' : 'canceled_period_ended',
      currentPeriodEnd,
      graceUntil: null,
    };
  }
  if (event.eventType === 'refund.full' || event.eventType === 'chargeback') {
    return {
      ...base,
      status: 'inactive',
      reason: event.eventType === 'chargeback' ? 'chargeback_immediate_revoke' : 'full_refund',
      graceUntil: null,
      currentPeriodEnd: null,
    };
  }
  if (event.eventType === 'refund.partial') {
    return {
      ...base,
      reason: 'partial_refund_manual_review',
    };
  }
  if (event.eventType === 'grace.expired') {
    return {
      ...base,
      status: 'inactive',
      reason: 'grace_expired',
      graceUntil: current.graceUntil,
    };
  }
  if (event.eventType === 'complimentary.granted') {
    if (event.actorRole !== 'owner' && event.actorRole !== 'rabbi') {
      throw new Error('complimentary_grant_forbidden_for_admin');
    }
    return {
      ...base,
      status: 'complimentary',
      reason: 'individual_complimentary_owner_grant',
      complimentaryUntil: PRELAUNCH_COMPLIMENTARY_CUTOFF_ISO,
      graceUntil: null,
    };
  }
  return base;
}

export function createInitialEntitlementProjection(input: {
  householdKey: string;
  ghlContactId: string;
  ghlSubscriptionId?: string | null | undefined;
  now: Date;
}): EntitlementProjection {
  return {
    householdKey: input.householdKey,
    ghlContactId: input.ghlContactId,
    ghlSubscriptionId: input.ghlSubscriptionId ?? null,
    status: 'complimentary',
    reason: 'prelaunch_complimentary',
    effectiveAt: input.now.toISOString(),
    graceUntil: null,
    currentPeriodEnd: null,
    complimentaryUntil: PRELAUNCH_COMPLIMENTARY_CUTOFF_ISO,
    lastBillingEvent: 'prelaunch_complimentary',
    lastReconciled: input.now.toISOString(),
    version: 1,
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
