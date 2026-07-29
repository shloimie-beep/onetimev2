import { describe, expect, it } from 'vitest';
import type { FamilySignupCommand } from '../../../../contracts/src/signup/family/index.ts';
import { planFamilySignup, type PlanFamilySignupInput } from './policy.ts';

const h = (value: string) => value.repeat(64);
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: 'signup_request_1',
  canonical_request_hash: h('a'),
  first_name: 'Ari',
  last_name: 'Levi',
  email: ' Ari@Example.com ',
  password: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
});
const input = (now: string): PlanFamilySignupInput => ({
  command: command(),
  now: new Date(now),
  proposed_adult_id: 'adult_1',
  proposed_human_account_id: 'account_1',
  proposed_household_id: 'household_1',
  existing_identity: null,
  existing_request: null,
  ghl_evidence: {
    verified_contact_ref_hash: null,
    verified_contact_email_hash: null,
    exact_email_match_ref_hashes: [],
    marketing_suppressed: true,
    service_suppressed: false,
    suppression_evidence_digest: h('b'),
  },
});

describe('P08 family signup policy', () => {
  it('grants cardless free access only before the fixed expiry', () => {
    const before = planFamilySignup(input('2026-09-13T16:23:59.000Z'));
    expect(before.result.projection).toMatchObject({
      access_state: 'free',
      checkout_required: false,
      card_collected: false,
      rolling_trial_granted: false,
      normalized_email: 'ari@example.com',
    });
    expect(before.result.next_action).toBe('signed_in');
    expect(before.result.setup_email_required).toBe(false);

    for (const instant of ['2026-09-13T16:24:00.000Z', '2026-09-13T16:24:01.000Z']) {
      const after = planFamilySignup(input(instant));
      expect(after.result.projection).toMatchObject({
        access_state: 'inactive',
        checkout_required: true,
        free_access_expires_at: null,
      });
      expect(after.result.next_action).toBe('checkout');
    }
  });

  it('returns a generic safe path for an existing active Family account', () => {
    const duplicate = input('2026-09-13T00:00:00.000Z');
    duplicate.existing_identity = {
      adult_id: 'adult_existing',
      human_account_id: 'account_existing',
      normalized_email: 'ari@example.com',
      active_family_household_id: 'household_existing',
    };
    const plan = planFamilySignup(duplicate);
    expect(plan.result).toMatchObject({
      disposition: 'existing_account',
      next_action: 'sign_in_or_reset',
      projection: null,
    });
    expect(plan.local_write_required).toBe(false);
    expect(plan.outbox_intents).toEqual([]);
  });

  it('links an existing adult without creating another identity and matches GHL by email', () => {
    const linked = input('2026-09-13T00:00:00.000Z');
    linked.existing_identity = {
      adult_id: 'adult_existing',
      human_account_id: 'account_existing',
      normalized_email: 'ari@example.com',
      active_family_household_id: null,
    };
    linked.ghl_evidence.exact_email_match_ref_hashes = [h('c')];
    const plan = planFamilySignup(linked);
    expect(plan.result.projection).toMatchObject({
      adult_id: 'adult_existing',
      human_account_id: 'account_existing',
    });
    expect(plan.credential_write_required).toBe(false);
    expect(plan.ghl_identity_state).toBe('linked');
    expect(plan.ghl_contact_ref_hash).toBe(h('c'));
  });

  it('keeps local access while quarantining ambiguous GHL matches', () => {
    const ambiguous = input('2026-09-13T00:00:00.000Z');
    ambiguous.ghl_evidence.exact_email_match_ref_hashes = [h('c'), h('d')];
    const plan = planFamilySignup(ambiguous);
    expect(plan.result.projection?.access_state).toBe('free');
    expect(plan.ghl_identity_state).toBe('identity_review');
    expect(plan.ghl_sync_quarantined).toBe(true);
  });

  it('recovers the same request and rejects a changed replay key payload', () => {
    const first = input('2026-09-13T00:00:00.000Z');
    const applied = planFamilySignup(first);
    const retry = input('2026-09-13T00:00:00.000Z');
    retry.existing_request = {
      idempotency_key: retry.command.idempotency_key,
      canonical_request_hash: retry.command.canonical_request_hash,
      result: applied.result,
      outbox_intents: applied.outbox_intents,
    };
    expect(planFamilySignup(retry).result.disposition).toBe('recovered');
    retry.command.canonical_request_hash = h('e');
    expect(() => planFamilySignup(retry)).toThrow('idempotency_conflict');
  });

  it('rejects missing, unsupported, and hybrid direct API classifications before a write', () => {
    for (const classification of [undefined, 'hybrid', ['family', 'school']]) {
      const invalid = input('2026-09-13T00:00:00.000Z');
      Object.assign(invalid.command, { classification });
      expect(() => planFamilySignup(invalid)).toThrow('invalid_family_signup');
    }
    const hybrid = input('2026-09-13T00:00:00.000Z');
    Object.assign(hybrid.command, { school_name: 'Hybrid School' });
    expect(() => planFamilySignup(hybrid)).toThrow('invalid_family_signup');
  });
});
