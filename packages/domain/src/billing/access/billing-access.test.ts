import { describe, expect, it } from 'vitest';
import type {
  BillingRouteCapability,
  HouseholdBillingProjection,
  VerifiedBillingEvent,
} from '../../../../contracts/src/billing/access/index.ts';
import {
  BILLING_GRACE_PERIOD_MS,
  INACTIVE_PARENT_CAPABILITIES,
  STUDENT_INACTIVE_DENIAL_COPY,
} from '../../../../contracts/src/billing/access/index.ts';
import {
  authorizeBillingAccess,
  createFreeBillingProjection,
  expireBillingGrace,
  projectVerifiedBillingEvent,
} from './index.ts';

const CUSTOMER_HASH = 'a'.repeat(64);
const PAYLOAD_HASH = 'b'.repeat(64);
const TERM_END = '2026-08-15T00:00:00.000Z';

describe('billing access projection', () => {
  it('starts grace once, preserves Student access, and ignores replay', () => {
    const initial = free();
    const active = apply(initial, event('paid', 'term_paid', '2026-07-01T00:00:00.000Z'));
    const failed = event('failed', 'payment_failed', '2026-07-02T00:00:00.000Z');
    const grace = apply(active, failed, '2026-07-02T00:01:00.000Z');
    const replayed = apply(grace, failed, '2026-07-03T00:00:00.000Z');

    expect(active.state).toBe('active');
    expect(grace.state).toBe('grace');
    expect(grace.unresolved_failure?.grace_ends_at).toBe(
      new Date(Date.parse(failed.occurred_at) + BILLING_GRACE_PERIOD_MS).toISOString(),
    );
    expect(replayed).toBe(grace);
    expect(
      authorizeBillingAccess({
        role: 'student',
        session_household_id: 'household-a',
        requested_household_id: 'household-a',
        route_capability: 'classroom',
        projection: replayed,
        now: new Date('2026-07-03T00:00:00.000Z'),
        upstream_role_authorized: true,
      }),
    ).toMatchObject({ allowed: true, access_state: 'grace' });
  });

  it('keeps a newer unresolved failure ahead of reordered paid truth and expires once', () => {
    const initial = free();
    const failure = event('failure-newer', 'payment_failed', '2026-07-10T00:00:00.000Z');
    const grace = apply(initial, failure, '2026-07-10T00:00:01.000Z');
    const reordered = apply(
      grace,
      event('paid-older', 'term_paid', '2026-07-09T00:00:00.000Z'),
      '2026-07-10T00:00:02.000Z',
    );
    const expired = expireBillingGrace(reordered, new Date('2026-07-17T00:00:00.001Z'));
    const repeatedExpiry = expireBillingGrace(expired, new Date('2026-07-18T00:00:00.000Z'));

    expect(reordered.state).toBe('grace');
    expect(expired.state).toBe('inactive');
    expect(expired.version).toBe(reordered.version + 1);
    expect(repeatedExpiry).toBe(expired);
  });

  it('restores access only from newer verified household-matched paid truth', () => {
    const grace = apply(
      apply(free(), event('paid', 'term_paid', '2026-07-01T00:00:00.000Z')),
      event('failed', 'payment_failed', '2026-07-02T00:00:00.000Z'),
    );
    const stalePaid = apply(grace, event('stale', 'term_paid', '2026-07-01T12:00:00.000Z'));
    const recovered = apply(stalePaid, event('recovery', 'term_paid', '2026-07-03T00:00:00.000Z'));

    expect(stalePaid.state).toBe('grace');
    expect(recovered.state).toBe('active');
    expect(recovered.unresolved_failure).toBeNull();
  });

  it('enforces the exact inactive Parent allowlist and Student denial copy', () => {
    const inactive = apply(
      free(),
      event('inactive', 'subscription_inactive', '2026-07-04T00:00:00.000Z'),
    );
    for (const capability of INACTIVE_PARENT_CAPABILITIES) {
      expect(parentDecision(inactive, capability)).toEqual({
        allowed: true,
        access_state: 'inactive',
        data_scope: 'inactive_parent_minimal',
        provider_bootstrap_allowed: false,
      });
    }
    expect(parentDecision(inactive, 'students')).toMatchObject({
      allowed: false,
      code: 'INACTIVE_ROUTE_DENIED',
      deny_before_protected_render: true,
    });
    expect(
      authorizeBillingAccess({
        role: 'student',
        session_household_id: 'household-a',
        requested_household_id: 'household-a',
        route_capability: 'library',
        projection: inactive,
        now: new Date('2026-07-05T00:00:00.000Z'),
        upstream_role_authorized: true,
      }),
    ).toMatchObject({
      allowed: false,
      code: 'HOUSEHOLD_INACTIVE',
      public_message: STUDENT_INACTIVE_DENIAL_COPY,
      deny_before_protected_render: true,
    });
  });

  it('fails closed before rendering on cross-household access', () => {
    expect(
      authorizeBillingAccess({
        role: 'parent',
        session_household_id: 'household-b',
        requested_household_id: 'household-a',
        route_capability: 'billing',
        projection: free(),
        now: new Date('2026-07-01T00:00:00.000Z'),
        upstream_role_authorized: true,
      }),
    ).toMatchObject({
      allowed: false,
      code: 'HOUSEHOLD_SCOPE_DENIED',
      deny_before_protected_render: true,
    });
  });
});

function free(): HouseholdBillingProjection {
  return createFreeBillingProjection({
    household_id: 'household-a',
    provider_customer_ref_hash: CUSTOMER_HASH,
    now: new Date('2026-07-01T00:00:00.000Z'),
  });
}

function event(
  id: string,
  kind: VerifiedBillingEvent['kind'],
  occurredAt: string,
): VerifiedBillingEvent {
  return {
    event_id: id,
    provider: 'stripe',
    household_id: 'household-a',
    provider_customer_ref_hash: CUSTOMER_HASH,
    billing_term_id: 'term-2026-07',
    kind,
    occurred_at: occurredAt,
    term_ends_at: TERM_END,
    payload_digest: PAYLOAD_HASH,
    signature_verified: true,
  };
}

function apply(
  prior: HouseholdBillingProjection,
  value: VerifiedBillingEvent,
  now = value.occurred_at,
): HouseholdBillingProjection {
  return projectVerifiedBillingEvent(prior, value, new Date(now));
}

function parentDecision(
  projection: HouseholdBillingProjection,
  capability: BillingRouteCapability,
) {
  return authorizeBillingAccess({
    role: 'parent',
    session_household_id: 'household-a',
    requested_household_id: 'household-a',
    route_capability: capability,
    projection,
    now: new Date('2026-07-05T00:00:00.000Z'),
    upstream_role_authorized: true,
  });
}
