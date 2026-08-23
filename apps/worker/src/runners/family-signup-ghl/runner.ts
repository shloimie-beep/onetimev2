import type {
  FamilySignupGhlClaim,
  FamilySignupGhlProvider,
  FamilySignupGhlRepository,
} from './types.ts';
import { FamilySignupGhlProviderError } from './types.ts';

export type FamilySignupGhlBatchResult = {
  claimed: number;
  completedEffects: number;
  completedSignups: number;
  identityReviews: number;
  retries: number;
  acceptanceUnknown: number;
  providerCallsPerformed: boolean;
};

export async function runFamilySignupGhlBatch(input: {
  repository: FamilySignupGhlRepository;
  provider: FamilySignupGhlProvider;
  runtimeTier: string;
  verificationEnvironmentId: string;
  leaseMs: number;
  limit: number;
  allowedIntentIds: readonly string[];
  now?: () => Date;
}): Promise<FamilySignupGhlBatchResult> {
  const result: FamilySignupGhlBatchResult = {
    claimed: 0,
    completedEffects: 0,
    completedSignups: 0,
    identityReviews: 0,
    retries: 0,
    acceptanceUnknown: 0,
    providerCallsPerformed: false,
  };
  const now = input.now ?? (() => new Date());
  for (let index = 0; index < input.limit; index += 1) {
    const claim = await input.repository.claimNext({
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
      leaseMs: input.leaseMs,
      allowedIntentIds: input.allowedIntentIds,
    });
    if (!claim) break;
    result.claimed += 1;
    const operationKey = `${claim.intentId}:${claim.step}`;
    try {
      result.providerCallsPerformed = true;
      if (claim.step === 'contact_upsert') {
        const contact = await input.provider.upsertAdultContact(claim, operationKey);
        if (contact.state === 'identity_review') {
          await input.repository.markIdentityReview({
            claim,
            safeErrorCode: contact.safeErrorCode,
          });
          result.identityReviews += 1;
          continue;
        }
        await complete(input.repository, claim, contact, operationKey);
      } else if (claim.step === 'household_opportunity_upsert') {
        const opportunity = await input.provider.upsertHouseholdOpportunity(claim, operationKey);
        await complete(input.repository, claim, opportunity, operationKey);
      } else {
        const enrollment = await input.provider.enrollConfirmationWorkflow(claim, operationKey);
        await complete(input.repository, claim, enrollment, operationKey);
        result.completedSignups += 1;
      }
      result.completedEffects += 1;
    } catch (error) {
      const providerError =
        error instanceof FamilySignupGhlProviderError
          ? error
          : new FamilySignupGhlProviderError('provider_step_failed', false);
      if (providerError.acceptanceUnknown) {
        await input.repository.markAcceptanceUnknown({
          claim,
          safeErrorCode: providerError.safeErrorCode,
        });
        result.acceptanceUnknown += 1;
      } else {
        await input.repository.markRetry({
          claim,
          safeErrorCode: providerError.safeErrorCode,
          retryAt: retryAt(now(), claim.attemptCount),
        });
        result.retries += 1;
      }
    }
  }
  return result;
}

async function complete(
  repository: FamilySignupGhlRepository,
  claim: FamilySignupGhlClaim,
  effect: { providerResourceId: string; providerResponseDigest: string },
  operationKey: string,
) {
  const persisted = await repository.completeEffect({ claim, effect, operationKey });
  if (!persisted) throw new Error('family_signup_ghl_effect_fenced');
}

function retryAt(now: Date, attemptCount: number): string {
  const delayMs = Math.min(15 * 60_000, 15_000 * 2 ** Math.min(attemptCount, 6));
  return new Date(now.getTime() + delayMs).toISOString();
}
