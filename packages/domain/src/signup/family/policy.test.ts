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
  general_marketing_consent: false,
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
    proposed_adult_id: 'adult_1',
    proposed_human_account_id: 'account_1',
    proposed_household_id: 'household_1',
    existing_local_state: { identity: null, household: null },
    existing_request: null,
    ghl_evidence: {
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
  it('grants cardless free access only before the fixed expiry', () => {
    const before = planFamilySignup(input('2026-09-13T16:23:59.000Z'));
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

    for (const instant of ['2026-09-13T16:24:00.000Z', '2026-09-13T16:24:01.000Z']) {
      const after = planFamilySignup(input(instant));
      expect(after.result.projection).toMatchObject({
        access_state: 'inactive',
        checkout_required: true,
        checkout_blocked_by_identity_review: false,
        free_access_expires_at: null,
      });
      expect(after.result.next_action).toBe('checkout');
    }
  });

  it('returns the same generic zero-write result for every local HumanAccount state', () => {
    for (const humanAccountState of ['invited', 'active', 'disabled', 'archived'] as const) {
      const duplicate = input('2026-09-13T00:00:00.000Z');
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
      const duplicate = input('2026-09-13T00:00:00.000Z');
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
    const linked = input('2026-09-13T00:00:00.000Z');
    linked.ghl_evidence!.exact_email_match_ref_hashes = [h('c')];
    const plan = planFamilySignup(linked);
    expect(plan.result.projection).toMatchObject({
      adult_id: 'adult_1',
      human_account_id: 'account_1',
    });
    expect(plan.credential_write_required).toBe(true);
    expect(plan.ghl_identity_state).toBe('linked');
    expect(plan.outbox_intents[0]?.request_binding).toEqual(linked.request_binding);
    expect(plan.outbox_intents[0]?.adult_consent_choices).toEqual({
      general_marketing: false,
      parent_newsletter: true,
    });
  });

  it('quarantines GHL ambiguity and blocks only post-expiry Checkout', () => {
    const before = input('2026-09-13T16:23:59.000Z');
    before.ghl_evidence!.exact_email_match_ref_hashes = [h('c'), h('d')];
    const free = planFamilySignup(before);
    expect(free.result.next_action).toBe('signed_in');
    expect(free.result.projection).toMatchObject({
      access_state: 'free',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
    });
    expect(free.outbox_intents[0]?.dispatch_state).toBe('identity_review');

    const boundary = input('2026-09-13T16:24:00.000Z');
    boundary.ghl_evidence!.exact_email_match_ref_hashes = [h('c'), h('d')];
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
        general_marketing: false,
        parent_newsletter: true,
      },
    });
  });

  it('recovers only an exact scope, operation, key, and semantic digest binding', () => {
    const first = input('2026-09-13T00:00:00.000Z');
    const applied = planFamilySignup(first);
    const retry = input('2026-09-13T00:00:00.000Z');
    retry.existing_request = {
      receipt: {
        request_binding: first.request_binding,
        result: applied.result,
        outbox_intents: applied.outbox_intents,
      },
    };
    expect(planFamilySignup(retry).result.disposition).toBe('recovered');

    const changedName = input('2026-09-13T00:00:00.000Z', {
      ...command(),
      first_name: 'Aharon',
    });
    changedName.existing_request = retry.existing_request;
    expect(() => planFamilySignup(changedName)).toThrow('idempotency_conflict');
    const changedConsent = input('2026-09-13T00:00:00.000Z', {
      ...command(),
      general_marketing_consent: true,
    });
    changedConsent.existing_request = retry.existing_request;
    expect(() => planFamilySignup(changedConsent)).toThrow('idempotency_conflict');

    const crossScope = input('2026-09-13T00:00:00.000Z');
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
      expect(() => input('2026-09-13T00:00:00.000Z', { ...command(), timezone })).toThrow(
        'invalid_family_signup',
      );
    }
    expect(() =>
      input('2026-09-13T00:00:00.000Z', {
        ...command(),
        password_confirmation: 'different secure password',
      }),
    ).toThrow('invalid_password');
    const missingConsent = command() as Partial<FamilySignupCommand>;
    delete missingConsent.parent_newsletter_consent;
    expect(() => input('2026-09-13T00:00:00.000Z', missingConsent as FamilySignupCommand)).toThrow(
      'invalid_family_signup',
    );

    const shortKey = command();
    shortKey.idempotency_key = 'short';
    expect(() => input('2026-09-13T00:00:00.000Z', shortKey)).toThrow('invalid_family_signup');
    const weakKey = command();
    weakKey.idempotency_key = 'A'.repeat(43);
    expect(() => input('2026-09-13T00:00:00.000Z', weakKey)).toThrow('invalid_family_signup');

    const spoofed = command() as FamilySignupCommand & { canonical_request_hash: string };
    spoofed.canonical_request_hash = h('f');
    expect(() => input('2026-09-13T00:00:00.000Z', spoofed)).toThrow('invalid_family_signup');

    const extra = command();
    Object.assign(extra, { unexpected_branch_payload: 'not-family' });
    expect(() => input('2026-09-13T00:00:00.000Z', extra)).toThrow('invalid_family_signup');
  });
});
