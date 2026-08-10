import { describe, expect, it } from 'vitest';
import type {
  FamilySignupCommand,
  FamilySignupScope,
} from '../../../../contracts/src/signup/family/index.ts';
import {
  canonicalizeFamilySignupRequest,
  planFamilySignup,
  type PlanFamilySignupInput,
} from './policy.ts';

const h = (value: string) => value.repeat(64);
const scope: FamilySignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const idempotencyKey = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg';
const freeAccessExpiresAt = '2026-09-11T15:00:00.000Z';
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: idempotencyKey,
  first_name: 'Ari',
  last_name: 'Levi',
  email: ' Ari@Example.com ',
  password: 'correct horse battery staple',
  password_confirmation: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
  general_marketing_consent: true,
  parent_newsletter_consent: true,
});
const input = (now: string, signupCommand = command()): PlanFamilySignupInput => {
  const canonical = canonicalizeFamilySignupRequest(scope, signupCommand, h('a'));
  return {
    scope,
    request_binding: canonical.request_binding,
    command: signupCommand,
    normalized_email: canonical.request.normalized_email,
    now: new Date(now),
    free_access_expires_at: freeAccessExpiresAt,
    proposed_adult_id: 'adult_1',
    proposed_human_account_id: 'account_1',
    proposed_household_id: 'household_1',
    existing_local_state: { identity: null, household: null },
    existing_request: null,
    ghl_evidence: {
      status: 'available',
      verified_contact_ref_hash: null,
      verified_contact_email_hash: null,
      exact_email_match_ref_hashes: [],
      marketing_suppressed: true,
      service_suppressed: false,
      suppression_evidence_digest: h('b'),
    },
  };
};

describe('P08 family signup policy', () => {
  it('grants cardless free access only before the configured expiry', () => {
    const before = planFamilySignup(input('2026-09-11T14:59:59.000Z'));
    expect(before.result.projection).toMatchObject({
      access_state: 'free',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
      card_collected: false,
      rolling_trial_granted: false,
      normalized_email: 'ari@example.com',
    });
    expect(before.result.next_action).toBe('signed_in');
    expect(before.session_write_required).toBe(true);
    expect(before.commercial_billing).toMatchObject({
      signup: {
        resulting_version: 1,
        response: { projection: { accessState: 'free', subscriptionState: 'none' } },
        outbox_intents: [],
      },
      checkout: null,
    });

    for (const instant of ['2026-09-11T15:00:00.000Z', '2026-09-11T15:00:01.000Z']) {
      const after = planFamilySignup(input(instant));
      expect(after.result.projection).toMatchObject({
        access_branch: 'inactive_support',
        access_state: 'inactive',
        checkout_required: false,
        checkout_blocked_by_identity_review: false,
        free_access_expires_at: null,
      });
      expect(after.result.next_action).toBe('support');
      expect(after.result.checkout_handoff_state).toBe('not_configured');
      expect(after.commercial_billing?.checkout).toBeNull();
    }
  });

  it('uses inactive checkout with no free-access timestamp when an approved link is configured', () => {
    const withoutExpiry = input('2026-08-01T12:00:00.000Z');
    delete withoutExpiry.free_access_expires_at;
    withoutExpiry.ghl_payment_link_configured = true;
    expect(planFamilySignup(withoutExpiry)).toMatchObject({
      result: {
        next_action: 'checkout',
        projection: {
          access_branch: 'inactive_checkout',
          access_state: 'inactive',
          free_access_expires_at: null,
          checkout_required: true,
          card_collected: false,
        },
      },
      commercial_billing: {
        signup: { response: { projection: { freePeriodEndsAt: null } } },
        checkout: {
          response: {
            intent: {
              chargeMode: 'at_hosted_checkout',
              firstChargeAt: '2026-08-01T12:00:00.000Z',
            },
          },
        },
      },
    });
  });

  it('returns the same generic zero-write result for every local HumanAccount state', () => {
    for (const humanAccountState of ['invited', 'active', 'disabled', 'archived'] as const) {
      const duplicate = input('2026-09-11T00:00:00.000Z');
      duplicate.existing_local_state.identity = {
        adult_id: `adult_${humanAccountState}`,
        human_account_id: `account_${humanAccountState}`,
        normalized_email: 'ari@example.com',
        human_account_state: humanAccountState,
      };
      const plan = planFamilySignup(duplicate);
      expect(plan.result).toEqual({
        disposition: 'existing_account',
        projection: null,
        next_action: 'sign_in_or_reset',
        setup_email_required: false,
        provider_effects_completed_inline: 0,
        outbox_intent_ids: [],
        ghl_handoff_state: 'not_applicable',
        checkout_handoff_state: 'not_applicable',
        safe_message: 'Sign in or reset your password to continue.',
      });
      expect(plan).toMatchObject({
        local_write_required: false,
        credential_write_required: false,
        session_write_required: false,
      });
      expect(plan.outbox_intents).toEqual([]);
    }
  });

  it('rejects duplicate active, expired, archived, and inactive Family households', () => {
    for (const lifecycleState of ['active', 'expired', 'archived', 'inactive'] as const) {
      const duplicate = input('2026-09-11T00:00:00.000Z');
      duplicate.existing_local_state.household = {
        household_id: `household_${lifecycleState}`,
        lifecycle_state: lifecycleState,
      };
      const plan = planFamilySignup(duplicate);
      expect(plan.result).toMatchObject({
        disposition: 'existing_account',
        projection: null,
        next_action: 'sign_in_or_reset',
      });
      expect(plan.local_write_required).toBe(false);
      expect(plan.session_write_required).toBe(false);
    }
  });

  it('allows a GHL-only match to create fresh local identity and access', () => {
    const linked = input('2026-09-11T00:00:00.000Z');
    if (linked.ghl_evidence?.status !== 'available') throw new Error('available evidence expected');
    linked.ghl_evidence.exact_email_match_ref_hashes = [h('c')];
    const plan = planFamilySignup(linked);
    expect(plan.result.projection).toMatchObject({
      adult_id: 'adult_1',
      human_account_id: 'account_1',
    });
    expect(plan.credential_write_required).toBe(true);
    expect(plan.ghl_identity_state).toBe('linked');
    expect(plan.outbox_intents[0]?.request_binding).toEqual(linked.request_binding);
    expect(plan.outbox_intents[0]?.adult_consent_choices).toEqual({
      general_marketing: true,
      parent_newsletter: true,
    });
    expect(plan.outbox_intents[0]?.unified_agreement).toMatchObject({
      policy_version: 'one_time_family_signup_unified_v1',
      terms_accepted: true,
      privacy_accepted: true,
      student_data_child_safety_accepted: true,
      cancellation_refund_accepted: true,
      email_marketing_consent: 'opted_in',
      newsletter_consent: 'opted_in',
      sms_call_whatsapp_consent: false,
      captured_at: expect.stringMatching(/Z$/u),
    });
    expect(plan.outbox_intents[0]?.ghl_handoff).toMatchObject({
      target: 'p27_ghl_identity_sync',
      target_contract_version: '1.0.0',
      local_commit_state: 'committed',
      subject: {
        kind: 'adult',
        adult_id: 'adult_1',
        normalized_email_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
      household: {
        household_id: 'household_1',
        owner_adult_id: 'adult_1',
        classification: 'family',
        access_projection: 'free',
      },
      provider_effect_authorized: false,
      adult_signup_event: {
        household_reconciliation_key: 'household_1',
        audience_type: 'adult',
        email_consent: 'opted_in',
        policy_version: 'one_time_family_signup_unified_v1',
        lifecycle_stage: 'Active Member',
        tags: ['ot | lead', 'ot | email opt-in'],
        ot01_authority: 'direct_enrollment_after_local_commit',
        student_contacts: 0,
        password_or_security_data: false,
      },
      message_delivery_authorized: false,
      billing_effect_authorized: false,
      student_contact_prohibited: true,
    });
    expect(JSON.stringify(plan.outbox_intents[0])).not.toContain('student_id');
  });

  it('quarantines GHL ambiguity and blocks only post-expiry Checkout', () => {
    const before = input('2026-09-11T14:59:59.000Z');
    if (before.ghl_evidence?.status !== 'available') throw new Error('available evidence expected');
    before.ghl_evidence.exact_email_match_ref_hashes = [h('c'), h('d')];
    const free = planFamilySignup(before);
    expect(free.result.next_action).toBe('signed_in');
    expect(free.result.projection).toMatchObject({
      access_state: 'free',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
    });
    expect(free.outbox_intents[0]?.dispatch_state).toBe('identity_review');

    const boundary = input('2026-09-11T15:00:00.000Z');
    if (boundary.ghl_evidence?.status !== 'available') {
      throw new Error('available evidence expected');
    }
    boundary.ghl_evidence.exact_email_match_ref_hashes = [h('c'), h('d')];
    const blocked = planFamilySignup(boundary);
    expect(blocked.result.next_action).toBe('identity_review');
    expect(blocked.result.projection).toMatchObject({
      access_branch: 'inactive_identity_review',
      access_state: 'inactive',
      checkout_required: false,
      checkout_blocked_by_identity_review: true,
    });
    expect(blocked.ghl_sync_quarantined).toBe(true);
    expect(blocked.outbox_intents[0]).toMatchObject({
      dispatch_state: 'identity_review',
      adult_consent_choices: {
        general_marketing: true,
        parent_newsletter: true,
      },
    });
  });

  it('requires provider readback without converting absent evidence into identity ambiguity', () => {
    const before = input('2026-09-11T14:59:59.000Z');
    before.ghl_evidence = {
      status: 'evidence_unavailable',
      safe_reason: 'evidence_unavailable',
    };
    const free = planFamilySignup(before);
    expect(free).toMatchObject({
      ghl_identity_state: 'readback_required',
      ghl_contact_ref_hash: null,
      ghl_evidence_status: 'evidence_unavailable',
      ghl_sync_quarantined: false,
      result: {
        next_action: 'signed_in',
        ghl_handoff_state: 'readback_required',
        checkout_handoff_state: 'not_applicable',
        projection: {
          access_state: 'free',
          checkout_required: false,
        },
      },
      outbox_intents: [
        {
          dispatch_state: 'ready',
          ghl_handoff: {
            provider_readback_required: true,
            provider_effect_authorized: false,
            student_contact_prohibited: true,
          },
        },
      ],
    });

    const after = input('2026-09-11T15:00:00.000Z');
    after.ghl_payment_link_configured = true;
    after.ghl_evidence = {
      status: 'evidence_unavailable',
      safe_reason: 'evidence_unavailable',
    };
    expect(planFamilySignup(after)).toMatchObject({
      ghl_identity_state: 'readback_required',
      ghl_evidence_status: 'evidence_unavailable',
      result: {
        next_action: 'checkout',
        ghl_handoff_state: 'readback_required',
        checkout_handoff_state: 'queued',
        projection: {
          access_branch: 'inactive_checkout',
          checkout_required: true,
        },
      },
      commercial_billing: {
        checkout: {
          outbox_intents: [
            {
              provider: 'highlevel',
              financialProvider: 'stripe',
              providerMutationByOneTime: false,
            },
          ],
        },
      },
    });
  });

  it('recovers only an exact scope, operation, key, and semantic digest binding', () => {
    const first = input('2026-09-11T00:00:00.000Z');
    const applied = planFamilySignup(first);
    const retry = input('2026-09-11T00:00:00.000Z');
    retry.existing_request = {
      receipt: {
        request_binding: first.request_binding,
        result: applied.result,
        outbox_intents: applied.outbox_intents,
      },
    };
    expect(planFamilySignup(retry).result.disposition).toBe('recovered');

    const changedName = input('2026-09-11T00:00:00.000Z', {
      ...command(),
      first_name: 'Aharon',
    });
    changedName.existing_request = retry.existing_request;
    expect(() => planFamilySignup(changedName)).toThrow('idempotency_conflict');
    expect(() =>
      input('2026-09-11T00:00:00.000Z', {
        ...command(),
        general_marketing_consent: false,
      }),
    ).toThrow('invalid_family_signup');

    const crossScope = input('2026-09-11T00:00:00.000Z');
    crossScope.scope = {
      product: 'one_time_mishnayos',
      runtime_tier: 'production',
      verification_environment_id: 'production_read_only',
    };
    crossScope.request_binding = canonicalizeFamilySignupRequest(
      crossScope.scope,
      crossScope.command,
      h('a'),
    ).request_binding;
    crossScope.existing_request = retry.existing_request;
    expect(() => planFamilySignup(crossScope)).toThrow('idempotency_conflict');
  });

  it('fails closed on invalid IANA zones, confirmation, consent, keys, and extra fields', () => {
    for (const timezone of ['not a timezone', '+02:00', 'GMT+03:00']) {
      expect(() => input('2026-09-11T00:00:00.000Z', { ...command(), timezone })).toThrow(
        'invalid_family_signup',
      );
    }
    expect(() =>
      input('2026-09-11T00:00:00.000Z', {
        ...command(),
        password_confirmation: 'different secure password',
      }),
    ).toThrow('invalid_password');
    const missingConsent = command() as Partial<FamilySignupCommand>;
    delete missingConsent.parent_newsletter_consent;
    expect(() => input('2026-09-11T00:00:00.000Z', missingConsent as FamilySignupCommand)).toThrow(
      'invalid_family_signup',
    );

    const shortKey = command();
    shortKey.idempotency_key = 'short';
    expect(() => input('2026-09-11T00:00:00.000Z', shortKey)).toThrow('invalid_family_signup');
    const weakKey = command();
    weakKey.idempotency_key = 'A'.repeat(43);
    expect(() => input('2026-09-11T00:00:00.000Z', weakKey)).toThrow('invalid_family_signup');

    const spoofed = command() as FamilySignupCommand & { canonical_request_hash: string };
    spoofed.canonical_request_hash = h('f');
    expect(() => input('2026-09-11T00:00:00.000Z', spoofed)).toThrow('invalid_family_signup');

    const extra = command();
    Object.assign(extra, { unexpected_branch_payload: 'not-family' });
    expect(() => input('2026-09-11T00:00:00.000Z', extra)).toThrow('invalid_family_signup');
  });
});
