import { describe, expect, it } from 'vitest';
import type {
  HouseholdProviderMapping,
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
} from '../../../../contracts/src/providers/v21-provider-core.ts';
import {
  assertHouseholdProviderMappings,
  assertProviderOperationBound,
  completeHouseholdOwnerReassociation,
  decideIdentityBoundEffect,
  reconcileProviderOperation,
  resolveGhlIdentityLink,
  resolveGhlIdentityReview,
  transferHouseholdProviderOwner,
  updateAdultSuppression,
  updateHouseholdLifecycle,
} from './index.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const NOW = new Date('2026-07-28T19:00:00.000Z');
const SCOPE = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
} as const;

describe('F06 provider truth and reconciliation', () => {
  it('binds readback to the exact registry account and reconciles without dispatch retry', () => {
    const operation = acceptanceUnknownOperation();
    const next = reconcileProviderOperation(operation, highLevelBinding(), readback(), {
      now: NOW,
      random_unit_interval: 0,
    });
    expect(next.state).toBe('complete');
    expect(next.unknown_effect).toBe(false);
    expect(next.provider_acceptance_digest).toBe(HASH_D);
    expect(next.reconciliation_digest).toBe(HASH_E);
    expect(next.dispatch_attempts).toBe(operation.dispatch_attempts);
  });

  it('fails closed on wrong-account, wrong-environment, and Stripe mutation bindings', () => {
    const operation = acceptanceUnknownOperation();
    expect(() =>
      reconcileProviderOperation(
        operation,
        highLevelBinding(),
        { ...readback(), provider_account_ref_hash: HASH_B },
        { now: NOW, random_unit_interval: 0 },
      ),
    ).toThrow(/exact operation, account, tier, environment/i);
    expect(() =>
      reconcileProviderOperation(
        operation,
        highLevelBinding(),
        {
          ...readback(),
          scope: { ...SCOPE, verification_environment_id: 'provider_sandbox' },
        },
        { now: NOW, random_unit_interval: 0 },
      ),
    ).toThrow(/exact operation, account, tier, environment/i);

    const stripeBinding: ProviderRegistryBinding = {
      ...highLevelBinding(),
      registry_binding_key: 'stripe-ci',
      provider: 'stripe',
      allowed_operation_types: ['stripe.customer.create'],
      mutation_policy: 'prohibited',
    };
    const stripeOperation: ProviderOperation = {
      ...operation,
      provider: 'stripe',
      registry_binding_key: stripeBinding.registry_binding_key,
      operation_type: 'stripe.customer.create',
      effect_kind: 'mutation',
    };
    expect(() => assertProviderOperationBound(stripeOperation, stripeBinding)).toThrow(
      /prohibits mutation/i,
    );
  });

  it('keeps acceptance-unknown quarantined until canonical absence proves retry safe', () => {
    const operation = acceptanceUnknownOperation();
    const next = reconcileProviderOperation(
      operation,
      highLevelBinding(),
      {
        ...readback(),
        disposition: 'effect_absent_retry_safe',
        provider_resource_ref_hash: null,
        provider_acceptance_digest: null,
        completed_locally: false,
      },
      { now: NOW, random_unit_interval: 0.5 },
    );
    expect(next.state).toBe('retry_wait');
    expect(next.unknown_effect).toBe(false);
    expect(next.idempotency_key).toBe(operation.idempotency_key);
    expect(next.canonical_request_hash).toBe(operation.canonical_request_hash);
  });
});

describe('F06 GHL ambiguity and household mappings', () => {
  it('quarantines only GHL workflow/billing while local login, free access, Student work, and Resend continue', () => {
    const link = resolveGhlIdentityLink({
      adult_id: 'adult-1',
      normalized_email_hash: HASH_A,
      verified_contact_ref_hash: null,
      exact_email_match_ref_hashes: [HASH_B, HASH_C],
      outbox_intent_ids: ['intent-contact', 'intent-workflow', 'intent-billing'],
      suppression_evidence_digest: HASH_D,
    });
    expect(link.state).toBe('identity_review');
    for (const effect of [
      'local_login',
      'local_free_access',
      'local_student_management',
      'resend_security',
    ] as const) {
      expect(decideIdentityBoundEffect(link, effect).allowed).toBe(true);
    }
    for (const effect of [
      'ghl_contact_upsert',
      'ghl_household_projection',
      'ghl_workflow',
      'ghl_billing',
    ] as const) {
      expect(decideIdentityBoundEffect(link, effect)).toEqual({
        allowed: false,
        safe_code: 'ghl_identity_review',
      });
    }
    expect(decideIdentityBoundEffect(link, 'stripe_financial_mutation').allowed).toBe(false);

    const resolved = resolveGhlIdentityReview(link, {
      expected_version: 1,
      admin_authorized: true,
      selected_contact_ref_hash: HASH_B,
    });
    expect(resolved.link.state).toBe('linked');
    expect(resolved.link.verified_contact_ref_hash).toBe(HASH_B);
    expect(resolved.replay_outbox_intent_ids).toEqual([
      'intent-billing',
      'intent-contact',
      'intent-workflow',
    ]);
    expect(decideIdentityBoundEffect(resolved.link, 'ghl_workflow').allowed).toBe(true);
    expect(() =>
      resolveGhlIdentityReview(link, {
        expected_version: 1,
        admin_authorized: false,
        selected_contact_ref_hash: HASH_B,
      }),
    ).toThrow(/governed resolution/i);
  });

  it('allows one adult contact to own isolated household records and Stripe Customers', () => {
    const first = household({
      household_id: 'household-1',
      ghl_household_record_ref_hash: HASH_B,
      stripe_customer_ref_hash: HASH_C,
    });
    const second = household({
      household_id: 'household-2',
      ghl_household_record_ref_hash: HASH_D,
      stripe_customer_ref_hash: HASH_E,
    });
    expect(() => assertHouseholdProviderMappings([first, second])).not.toThrow();
    expect(() =>
      assertHouseholdProviderMappings([
        first,
        { ...second, stripe_customer_ref_hash: first.stripe_customer_ref_hash },
      ]),
    ).toThrow(/household-scoped Stripe Customers/i);

    const updated = updateHouseholdLifecycle(first, {
      expected_version: 1,
      service_reminders_enabled: false,
      lifecycle_state: 'grace',
      provider_revision: 'rev-2',
      readback_digest: HASH_D,
    });
    expect(updated.service_reminders_enabled).toBe(false);
    expect(second.service_reminders_enabled).toBe(true);
    expect(second.lifecycle_state).toBe('free');
  });

  it('keeps suppression contact-scoped and preserves financial identity through transfer', () => {
    const priorLink = resolveGhlIdentityLink({
      adult_id: 'adult-1',
      normalized_email_hash: HASH_A,
      verified_contact_ref_hash: HASH_B,
      exact_email_match_ref_hashes: [HASH_B],
      outbox_intent_ids: [],
      suppression_evidence_digest: HASH_C,
    });
    const suppressed = updateAdultSuppression(priorLink, {
      expected_version: 1,
      marketing_suppressed: true,
      service_suppressed: false,
      evidence_digest: HASH_D,
    });
    expect(suppressed.suppression.marketing_suppressed).toBe(true);

    const replacement = resolveGhlIdentityLink({
      adult_id: 'adult-2',
      normalized_email_hash: HASH_C,
      verified_contact_ref_hash: HASH_D,
      exact_email_match_ref_hashes: [HASH_D],
      outbox_intent_ids: [],
      suppression_evidence_digest: HASH_E,
    });
    const before = household({});
    const held = transferHouseholdProviderOwner(before, {
      expected_version: 1,
      local_transfer_committed: true,
      replacement_adult_id: 'adult-2',
      replacement_link: replacement,
    });
    expect(held.reconciliation_state).toBe('reconciliation_hold');
    expect(held.ghl_household_record_ref_hash).toBe(before.ghl_household_record_ref_hash);
    expect(held.stripe_customer_ref_hash).toBe(before.stripe_customer_ref_hash);
    expect(held.projected_owner_contact_ref_hash).toBe(before.projected_owner_contact_ref_hash);

    const completed = completeHouseholdOwnerReassociation(held, {
      expected_version: 2,
      observed_ghl_household_record_ref_hash: before.ghl_household_record_ref_hash,
      observed_owner_contact_ref_hash: HASH_D,
      provider_revision: 'rev-transfer',
      readback_digest: HASH_E,
    });
    expect(completed.owner_adult_id).toBe('adult-2');
    expect(completed.projected_owner_contact_ref_hash).toBe(HASH_D);
    expect(completed.stripe_customer_ref_hash).toBe(before.stripe_customer_ref_hash);
    expect(completed.reconciliation_state).toBe('in_sync');
  });
});

function highLevelBinding(): ProviderRegistryBinding {
  return {
    registry_binding_key: 'highlevel-ci',
    provider: 'highlevel',
    scope: SCOPE,
    provider_account_ref_hash: HASH_A,
    allowed_operation_types: ['ghl.household.upsert'],
    mutation_policy: 'allowed',
    active: true,
  };
}

function acceptanceUnknownOperation(): ProviderOperation {
  return {
    job_id: 'operation-1',
    operation_type: 'ghl.household.upsert',
    aggregate_ref: 'household-1',
    source_version: 1,
    provider: 'highlevel',
    scope: SCOPE,
    idempotency_key: 'household-1:ghl-upsert:v1',
    canonical_request_hash: HASH_B,
    payload_ref: 'payload-1',
    payload_digest: HASH_C,
    compensation_for_job_id: null,
    state: 'acceptance_unknown',
    version: 4,
    recovery_generation: 0,
    dispatch_attempts: 1,
    lifetime_dispatch_attempts: 1,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 1,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: true,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: 'provider_timeout',
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH_A,
    effect_kind: 'mutation',
    household_id: 'household-1',
  };
}

function readback(): ProviderCanonicalReadback {
  return {
    operation_id: 'operation-1',
    provider: 'highlevel',
    scope: SCOPE,
    registry_binding_key: 'highlevel-ci',
    provider_account_ref_hash: HASH_A,
    canonical_request_hash: HASH_B,
    disposition: 'effect_exists',
    provider_resource_ref_hash: HASH_C,
    provider_acceptance_digest: HASH_D,
    reconciliation_digest: HASH_E,
    safe_error_code: null,
    completed_locally: true,
    observed_at: NOW.toISOString(),
  };
}

function household(overrides: Partial<HouseholdProviderMapping>): HouseholdProviderMapping {
  return {
    household_id: 'household-1',
    owner_adult_id: 'adult-1',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
    billing_program: 'standard-family',
    ghl_household_record_ref_hash: HASH_B,
    projected_owner_contact_ref_hash: HASH_A,
    stripe_customer_ref_hash: HASH_C,
    service_reminders_enabled: true,
    lifecycle_state: 'free',
    access_projection: 'free',
    reconciliation_state: 'in_sync',
    transfer_target_contact_ref_hash: null,
    provider_revision: 'rev-1',
    last_readback_digest: HASH_D,
    version: 1,
    ...overrides,
  };
}
