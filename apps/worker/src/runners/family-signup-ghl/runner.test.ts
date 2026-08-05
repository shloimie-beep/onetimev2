import { describe, expect, it, vi } from 'vitest';
import { runFamilySignupGhlBatch } from './runner.ts';
import { FamilySignupGhlProviderError } from './types.ts';
import type {
  FamilySignupGhlClaim,
  FamilySignupGhlProvider,
  FamilySignupGhlRepository,
} from './types.ts';

const claim = (
  step: FamilySignupGhlClaim['step'],
  providerContactId: string | null = null,
  providerOpportunityId: string | null = null,
): FamilySignupGhlClaim => ({
  intentId: 'family-signup-intent-1',
  leaseToken: `lease-${step}`,
  step,
  attemptCount: 1,
  adultId: 'adult-1',
  householdId: 'household-1',
  normalizedEmail: 'adult@example.test',
  displayName: 'Adult Example',
  timezone: 'Asia/Jerusalem',
  accessState: 'free',
  freeAccessExpiresAt: '2026-09-11T15:00:00.000Z',
  generalMarketingConsent: false,
  parentNewsletterConsent: false,
  providerContactId,
  providerOpportunityId,
});

function ports(claims: FamilySignupGhlClaim[]) {
  const repository: FamilySignupGhlRepository = {
    claimNext: vi.fn(async () => claims.shift() ?? null),
    completeEffect: vi.fn(async () => true),
    markRetry: vi.fn(async () => true),
    markIdentityReview: vi.fn(async () => true),
    markAcceptanceUnknown: vi.fn(async () => true),
  };
  const accepted = (id: string) => ({
    providerResourceId: id,
    providerResponseDigest: 'a'.repeat(64),
  });
  const provider: FamilySignupGhlProvider = {
    upsertAdultContact: vi.fn(async () => ({
      state: 'accepted' as const,
      ...accepted('contact-1'),
    })),
    upsertHouseholdOpportunity: vi.fn(async () => accepted('opportunity-1')),
    enrollConfirmationWorkflow: vi.fn(async () => accepted('enrollment-1')),
  };
  return { repository, provider };
}

describe('Family-signup HighLevel worker', () => {
  it('advances adult contact, household opportunity, and one workflow enrollment in order', async () => {
    const { repository, provider } = ports([
      claim('contact_upsert'),
      claim('household_opportunity_upsert', 'contact-1'),
      claim('workflow_enrollment', 'contact-1', 'opportunity-1'),
    ]);
    const result = await runFamilySignupGhlBatch({
      repository,
      provider,
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_broad',
      leaseMs: 120_000,
      limit: 12,
    });

    expect(result).toMatchObject({
      completedEffects: 3,
      completedSignups: 1,
      identityReviews: 0,
      acceptanceUnknown: 0,
    });
    expect(repository.completeEffect).toHaveBeenCalledTimes(3);
    expect(provider.upsertAdultContact).toHaveBeenCalledTimes(1);
    expect(provider.upsertHouseholdOpportunity).toHaveBeenCalledTimes(1);
    expect(provider.enrollConfirmationWorkflow).toHaveBeenCalledTimes(1);
  });

  it('quarantines ambiguous adult linkage and creates no downstream provider effect', async () => {
    const { repository, provider } = ports([claim('contact_upsert')]);
    vi.mocked(provider.upsertAdultContact).mockResolvedValueOnce({
      state: 'identity_review',
      safeErrorCode: 'multiple_exact_email_matches',
    });
    const result = await runFamilySignupGhlBatch({
      repository,
      provider,
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_broad',
      leaseMs: 120_000,
      limit: 2,
    });
    expect(result.identityReviews).toBe(1);
    expect(repository.markIdentityReview).toHaveBeenCalledTimes(1);
    expect(provider.upsertHouseholdOpportunity).not.toHaveBeenCalled();
    expect(provider.enrollConfirmationWorkflow).not.toHaveBeenCalled();
  });

  it('never replays an acceptance-unknown confirmation enrollment', async () => {
    const { repository, provider } = ports([
      claim('workflow_enrollment', 'contact-1', 'opportunity-1'),
    ]);
    vi.mocked(provider.enrollConfirmationWorkflow).mockRejectedValueOnce(
      new FamilySignupGhlProviderError('provider_transport_unknown', true),
    );
    const result = await runFamilySignupGhlBatch({
      repository,
      provider,
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_broad',
      leaseMs: 120_000,
      limit: 2,
    });
    expect(result.acceptanceUnknown).toBe(1);
    expect(repository.markAcceptanceUnknown).toHaveBeenCalledTimes(1);
    expect(repository.markRetry).not.toHaveBeenCalled();
  });
});
