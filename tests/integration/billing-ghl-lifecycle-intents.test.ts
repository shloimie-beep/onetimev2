import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BillingEntitlementProjection } from '../../packages/contracts/src/billing/index.ts';
import { createPostgresBillingRepositories } from '../../packages/db/src/billing/repository.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { deriveBillingGhlLifecycleEvent } from '../../packages/domain/src/billing/highlevel-lifecycle.ts';

describe('billing GHL lifecycle intent integration', () => {
  let pool: DbPool;

  beforeEach(async () => {
    pool = createMemoryPool();
    await runMigrations(pool);
    await pool.query(
      `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
       VALUES ('household-ghl-billing', 'one_time', 'family', 'Adult household', 'active')`,
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it('persists exact signed adult transitions once and never creates a Student/provider effect', async () => {
    const repositories = createPostgresBillingRepositories(pool);
    const active = entitlement({
      source: 'billing_event_active',
      status: 'active',
      reason: 'active_paid_current_invoice',
      grants_access: true,
    });
    await insertVerifiedEvent(pool, active.source, 'invoice.paid');

    await repositories.upsertEntitlementProjection(active, deriveBillingGhlLifecycleEvent(active));
    await repositories.upsertEntitlementProjection(active, deriveBillingGhlLifecycleEvent(active));

    const failed = entitlement({
      source: 'billing_event_failed',
      status: 'suspended',
      reason: 'past_due_projection_only',
      grants_access: false,
      effective_at: '2026-08-06T12:00:00.000Z',
    });
    await insertVerifiedEvent(pool, failed.source, 'invoice.payment_failed');
    await repositories.upsertEntitlementProjection(failed, deriveBillingGhlLifecycleEvent(failed));

    const result = await pool.query<{
      workflow_key: string;
      event_type: string;
      subject_kind: string;
      signed_billing_projection: boolean;
      student_contact_allowed: boolean;
      provider_financial_mutation: boolean;
      provider_access_mutation: boolean;
      binding_state: string;
    }>(
      `SELECT workflow_key, event_type, subject_kind, signed_billing_projection,
              student_contact_allowed, provider_financial_mutation,
              provider_access_mutation, binding_state
         FROM onetime.billing_ghl_lifecycle_intents
        WHERE household_key = 'household-ghl-billing'
        ORDER BY transition_sequence`,
    );

    expect(result.rows).toEqual([
      {
        workflow_key: 'OT-04',
        event_type: 'billing.payment_active.v1',
        subject_kind: 'adult_household',
        signed_billing_projection: true,
        student_contact_allowed: false,
        provider_financial_mutation: false,
        provider_access_mutation: false,
        binding_state: 'pending_external_binding',
      },
      {
        workflow_key: 'OT-05',
        event_type: 'billing.payment_failed_grace.v1',
        subject_kind: 'adult_household',
        signed_billing_projection: true,
        student_contact_allowed: false,
        provider_financial_mutation: false,
        provider_access_mutation: false,
        binding_state: 'pending_external_binding',
      },
    ]);
  });
});

function entitlement(
  overrides: Partial<BillingEntitlementProjection>,
): BillingEntitlementProjection {
  return {
    entitlement_key: 'billing_entitlement:one_time:family:household-ghl-billing',
    account_key: 'one_time',
    product_key: 'family',
    principal_key: 'household-ghl-billing',
    principal_type: 'opaque',
    status: 'active',
    policy_version: '2026-07-15.1',
    source: 'billing_event_active',
    reason: 'active_paid_current_invoice',
    effective_at: '2026-08-05T12:00:00.000Z',
    evaluated_at: '2026-08-05T12:00:01.000Z',
    grants_access: true,
    ...overrides,
  };
}

async function insertVerifiedEvent(pool: DbPool, eventKey: string, eventType: string) {
  await pool.query(
    `INSERT INTO onetime.billing_verified_events
     (event_key, provider, mode, provider_account_ref, provider_event_id,
      event_type, provider_created_at, livemode, raw_body_digest, payload_digest,
      object_refs, minimized_payload)
     VALUES ($1, 'stripe', 'test', 'acct_test', $2, $3,
             '2026-08-05T12:00:00.000Z', false, $4, $5, '{}'::jsonb, '{}'::jsonb)`,
    [eventKey, `provider_${eventKey}`, eventType, 'a'.repeat(64), 'b'.repeat(64)],
  );
}
