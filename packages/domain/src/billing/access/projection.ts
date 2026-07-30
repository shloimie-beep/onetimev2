import type {
  BillingEventCursor,
  BillingFailureCursor,
  HouseholdBillingProjection,
  VerifiedBillingEvent,
} from '../../../../contracts/src/billing/access/index.ts';
import { BILLING_GRACE_PERIOD_MS } from '../../../../contracts/src/billing/access/index.ts';
import { BillingAccessError } from './errors.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function createFreeBillingProjection(input: {
  household_id: string;
  provider_customer_ref_hash: string;
  now: Date;
}): HouseholdBillingProjection {
  assertOpaqueId(input.household_id, 'household_id');
  assertSha256(input.provider_customer_ref_hash, 'provider_customer_ref_hash');
  return {
    household_id: input.household_id,
    provider_customer_ref_hash: input.provider_customer_ref_hash,
    state: 'free',
    paid_winner: null,
    unresolved_failure: null,
    inactive_winner: null,
    version: 0,
    updated_at: input.now.toISOString(),
  };
}

export function projectVerifiedBillingEvent(
  prior: HouseholdBillingProjection,
  event: VerifiedBillingEvent,
  now: Date,
): HouseholdBillingProjection {
  assertVerifiedBillingEvent(event);
  assertProjectionScope(prior, event);

  let paidWinner = prior.paid_winner;
  let unresolvedFailure = prior.unresolved_failure;
  let inactiveWinner = prior.inactive_winner;

  if (event.kind === 'term_paid') {
    const cursor = toCursor(event);
    if (paidWinner === null || compareCursor(cursor, paidWinner) > 0) {
      paidWinner = cursor;
    }
    if (unresolvedFailure !== null && compareCursor(cursor, unresolvedFailure) > 0) {
      unresolvedFailure = null;
    }
  } else if (event.kind === 'payment_failed') {
    const failure = toFailure(event);
    const isNewerFailure =
      unresolvedFailure === null || compareCursor(failure, unresolvedFailure) > 0;
    const paidDoesNotResolveIt = paidWinner === null || compareCursor(failure, paidWinner) > 0;
    if (isNewerFailure && paidDoesNotResolveIt) {
      unresolvedFailure = failure;
    }
  } else {
    const cursor = toCursor(event);
    if (inactiveWinner === null || compareCursor(cursor, inactiveWinner) > 0) {
      inactiveWinner = cursor;
    }
  }

  const candidate = {
    ...prior,
    paid_winner: paidWinner,
    unresolved_failure: unresolvedFailure,
    inactive_winner: inactiveWinner,
  };
  const state = resolveBillingAccessState(candidate, now);
  const changed =
    paidWinner !== prior.paid_winner ||
    unresolvedFailure !== prior.unresolved_failure ||
    inactiveWinner !== prior.inactive_winner ||
    state !== prior.state;
  if (!changed) return prior;
  return {
    ...candidate,
    state,
    version: prior.version + 1,
    updated_at: now.toISOString(),
  };
}

export function expireBillingGrace(
  prior: HouseholdBillingProjection,
  now: Date,
): HouseholdBillingProjection {
  const state = resolveBillingAccessState(prior, now);
  if (state === prior.state) return prior;
  return {
    ...prior,
    state,
    version: prior.version + 1,
    updated_at: now.toISOString(),
  };
}

export function resolveBillingAccessState(
  projection: Pick<
    HouseholdBillingProjection,
    'paid_winner' | 'unresolved_failure' | 'inactive_winner'
  >,
  now: Date,
): HouseholdBillingProjection['state'] {
  const paid = projection.paid_winner;
  const failure = projection.unresolved_failure;
  const inactive = projection.inactive_winner;
  const newestSettled = newestCursor(paid, inactive);

  if (failure !== null && (newestSettled === null || compareCursor(failure, newestSettled) > 0)) {
    return now.getTime() < Date.parse(failure.grace_ends_at) ? 'grace' : 'inactive';
  }
  if (inactive !== null && (paid === null || compareCursor(inactive, paid) > 0)) {
    return 'inactive';
  }
  if (paid !== null) return 'active';
  return 'free';
}

export function assertVerifiedBillingEvent(event: VerifiedBillingEvent): void {
  if (event.provider !== 'stripe' || event.signature_verified !== true) {
    throw new BillingAccessError(
      'invalid_contract',
      'Only verified signed Stripe event truth may change billing access.',
    );
  }
  assertOpaqueId(event.event_id, 'event_id');
  assertOpaqueId(event.household_id, 'household_id');
  assertOpaqueId(event.billing_term_id, 'billing_term_id');
  assertSha256(event.provider_customer_ref_hash, 'provider_customer_ref_hash');
  assertSha256(event.payload_digest, 'payload_digest');
  const occurredAt = Date.parse(event.occurred_at);
  const termEndsAt = Date.parse(event.term_ends_at);
  if (!Number.isFinite(occurredAt) || !Number.isFinite(termEndsAt) || termEndsAt <= occurredAt) {
    throw new BillingAccessError(
      'invalid_contract',
      'Billing event timestamps must define a valid current term.',
    );
  }
}

function assertProjectionScope(
  projection: HouseholdBillingProjection,
  event: VerifiedBillingEvent,
): void {
  if (
    projection.household_id !== event.household_id ||
    projection.provider_customer_ref_hash !== event.provider_customer_ref_hash
  ) {
    throw new BillingAccessError(
      'household_scope_mismatch',
      'Billing truth must match the exact household and protected customer reference.',
    );
  }
}

function toCursor(event: VerifiedBillingEvent): BillingEventCursor {
  return {
    event_id: event.event_id,
    billing_term_id: event.billing_term_id,
    occurred_at: event.occurred_at,
    term_ends_at: event.term_ends_at,
  };
}

function toFailure(event: VerifiedBillingEvent): BillingFailureCursor {
  return {
    ...toCursor(event),
    grace_started_at: event.occurred_at,
    grace_ends_at: new Date(Date.parse(event.occurred_at) + BILLING_GRACE_PERIOD_MS).toISOString(),
  };
}

function newestCursor(
  left: BillingEventCursor | null,
  right: BillingEventCursor | null,
): BillingEventCursor | null {
  if (left === null) return right;
  if (right === null) return left;
  return compareCursor(left, right) >= 0 ? left : right;
}

function compareCursor(left: BillingEventCursor, right: BillingEventCursor): number {
  const byTime = Date.parse(left.occurred_at) - Date.parse(right.occurred_at);
  return byTime === 0 ? left.event_id.localeCompare(right.event_id) : byTime;
}

function assertSha256(value: string, field: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new BillingAccessError(
      'invalid_contract',
      `${field} must be a lowercase SHA-256 digest.`,
    );
  }
}

function assertOpaqueId(value: string, field: string): void {
  if (value.trim() === '' || /(?:secret|token|bearer|password|@|https?:)/i.test(value)) {
    throw new BillingAccessError('invalid_contract', `${field} must be a safe opaque identifier.`);
  }
}
