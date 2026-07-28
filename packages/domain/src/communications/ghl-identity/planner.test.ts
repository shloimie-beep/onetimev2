import { describe, expect, it } from 'vitest';
import type { PlanGhlIdentitySyncInput } from '../../../../contracts/src/communications/ghl-identity/index.ts';
import { GhlIdentityError, planGhlIdentitySync } from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);

function adultInput(): PlanGhlIdentitySyncInput {
  return {
    operation_id: 'signup-1',
    local_commit_id: 'local-1',
    local_commit_state: 'committed',
    subject: {
      kind: 'adult',
      adult_id: 'adult-1',
      normalized_email_hash: h('a'),
    },
    household: {
      household_id: 'household-1',
      classification: 'family',
      lifecycle_state: 'one_time_family_signup',
      access_projection: 'free',
      stripe_customer_ref_hash: null,
      service_reminders_enabled: true,
      source_evidence_digest: h('b'),
      policy_consent_evidence_digest: h('c'),
    },
    contact_evidence: {
      verified_contact_ref_hash: h('d'),
      verified_contact_email_hash: h('a'),
      exact_email_match_ref_hashes: [h('d')],
      marketing_suppressed: false,
      service_suppressed: false,
      suppression_evidence_digest: h('e'),
    },
    segment_facts: {
      approved_active_legacy_segment: true,
      has_active_membership: true,
      former_or_canceled: false,
      explicit_marketing_opt_in: true,
    },
  };
}

describe('P27 GHL identity plan', () => {
  it('uses the verified provider link and keeps household projection independently keyed', () => {
    const plan = planGhlIdentitySync(adultInput());
    expect(plan.identity_link.state).toBe('linked');
    expect(plan.identity_link.verified_contact_ref_hash).toBe(h('d'));
    expect(plan.adult_classification).toBe('active_legacy');
    expect(plan.household.household_id).toBe('household-1');
    expect(plan.intents).toHaveLength(2);
    expect(plan.local_result_durable).toBe(true);
    expect(plan.provider_failure_rolls_back_local_result).toBe(false);
  });

  it('quarantines disagreement visibly without rolling back local signup', () => {
    const input = adultInput();
    input.contact_evidence = {
      ...input.contact_evidence,
      verified_contact_email_hash: h('f'),
    };
    const plan = planGhlIdentitySync(input);
    expect(plan.identity_link.state).toBe('identity_review');
    expect(plan.review_case?.visible_to_admin).toBe(true);
    expect(plan.review_case?.safe_reason).toBe('provider_email_disagreement');
    expect(plan.intents).toEqual([]);
    expect(plan.local_result_durable).toBe(true);
  });

  it('does not classify every active export row as approved active legacy', () => {
    const input = adultInput();
    input.segment_facts = {
      ...input.segment_facts,
      approved_active_legacy_segment: false,
    };
    const plan = planGhlIdentitySync(input);
    expect(plan.adult_classification).toBe('review');
    expect(plan.intents).toEqual([]);
  });

  it('preserves suppression as its own classification', () => {
    const input = adultInput();
    input.contact_evidence = {
      ...input.contact_evidence,
      marketing_suppressed: true,
    };
    expect(planGhlIdentitySync(input).adult_classification).toBe('suppressed');
  });

  it('hard-stops every Student contact plan before provider intent creation', () => {
    const input = adultInput();
    input.subject = {
      kind: 'student',
      student_id: 'student-1',
      household_id: 'household-1',
    };
    expect(() => planGhlIdentitySync(input)).toThrowError(GhlIdentityError);
    try {
      planGhlIdentitySync(input);
    } catch (error) {
      expect(error).toMatchObject({ code: 'student_contact_prohibited' });
    }
  });

  it('requires durable local commit before any GHL synchronization', () => {
    const input = adultInput();
    input.local_commit_state = 'not_committed';
    expect(() => planGhlIdentitySync(input)).toThrowError(
      expect.objectContaining({ code: 'local_commit_required' }),
    );
  });
});
