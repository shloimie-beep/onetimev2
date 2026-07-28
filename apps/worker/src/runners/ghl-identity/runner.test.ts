import { describe, expect, it, vi } from 'vitest';
import type {
  GhlIdentityPlanRepository,
  PlanGhlIdentitySyncInput,
} from '../../../../../packages/contracts/src/communications/ghl-identity/index.ts';
import { runGhlIdentitySync } from './runner.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);
const adultInput = (): PlanGhlIdentitySyncInput => ({
  operation_id: 'signup-1',
  local_commit_id: 'commit-1',
  local_commit_state: 'committed',
  subject: { kind: 'adult', adult_id: 'adult-1', normalized_email_hash: h('a') },
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
    approved_active_legacy_segment: false,
    has_active_membership: false,
    former_or_canceled: false,
    explicit_marketing_opt_in: true,
  },
});

function ports() {
  const repository: GhlIdentityPlanRepository = {
    persistPlan: vi.fn(async () => true),
    markRetry: vi.fn(async () => true),
  };
  const provider = { submitDesiredState: vi.fn(async () => undefined) };
  return { repository, provider };
}

describe('P27 worker boundary', () => {
  it('never calls the provider for a Student subject', async () => {
    const input = adultInput();
    input.subject = {
      kind: 'student',
      student_id: 'student-1',
      household_id: 'household-1',
    };
    const { repository, provider } = ports();
    expect(await runGhlIdentitySync({ input, expected_version: 0, repository, provider })).toEqual({
      state: 'student_prohibited',
      provider_calls: 0,
    });
    expect(repository.persistPlan).not.toHaveBeenCalled();
    expect(provider.submitDesiredState).not.toHaveBeenCalled();
  });

  it('persists local plan before provider submission', async () => {
    const { repository, provider } = ports();
    const result = await runGhlIdentitySync({
      input: adultInput(),
      expected_version: 0,
      repository,
      provider,
    });
    expect(result).toEqual({ state: 'submitted', provider_calls: 1 });
    expect(repository.persistPlan).toHaveBeenCalledBefore(provider.submitDesiredState);
  });

  it('schedules the same operation for retry without undoing the local plan', async () => {
    const { repository, provider } = ports();
    vi.mocked(provider.submitDesiredState).mockRejectedValueOnce(new Error('unavailable'));
    expect(
      await runGhlIdentitySync({
        input: adultInput(),
        expected_version: 4,
        repository,
        provider,
      }),
    ).toEqual({ state: 'retry_scheduled', provider_calls: 1 });
    expect(repository.markRetry).toHaveBeenCalledWith({
      operation_id: 'signup-1',
      expected_version: 5,
      safe_error_code: 'ghl_submit_failed',
    });
  });
});
