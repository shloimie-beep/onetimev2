import type { JobScope } from '../../../../../packages/contracts/src/jobs/index.ts';

export const FAMILY_SIGNUP_GHL_STEPS = [
  'contact_upsert',
  'household_opportunity_upsert',
  'workflow_enrollment',
] as const;

export type FamilySignupGhlStep = (typeof FAMILY_SIGNUP_GHL_STEPS)[number];

export type FamilySignupGhlClaim = {
  intentId: string;
  leaseToken: string;
  step: FamilySignupGhlStep;
  attemptCount: number;
  adultId: string;
  householdId: string;
  normalizedEmail: string;
  displayName: string;
  timezone: string;
  accessState: 'free' | 'inactive';
  freeAccessExpiresAt: string | null;
  generalMarketingConsent: boolean;
  parentNewsletterConsent: boolean;
  product: JobScope['product'];
  runtimeTier: JobScope['runtime_tier'];
  verificationEnvironmentId: JobScope['verification_environment_id'];
  providerContactId: string | null;
  providerOpportunityId: string | null;
};

export type FamilySignupGhlIdentityProjection = {
  normalizedEmailHash: string;
  providerContactRefHash: string;
  marketingSuppressed: boolean;
  serviceSuppressed: boolean;
  suppressionEvidenceDigest: string;
};

export type FamilySignupGhlHouseholdProjection = {
  providerContactRefHash: string;
  providerHouseholdRefHash: string;
  providerRevision: number;
  readbackDigest: string;
};

export type FamilySignupGhlAcceptedEffect = {
  providerResourceId: string;
  providerResponseDigest: string;
  identityProjection?: FamilySignupGhlIdentityProjection;
  householdProjection?: FamilySignupGhlHouseholdProjection;
};

export interface FamilySignupGhlRepository {
  claimNext(input: {
    runtimeTier: string;
    verificationEnvironmentId: string;
    leaseMs: number;
  }): Promise<FamilySignupGhlClaim | null>;
  completeEffect(input: {
    claim: FamilySignupGhlClaim;
    effect: FamilySignupGhlAcceptedEffect;
    operationKey: string;
  }): Promise<boolean>;
  markRetry(input: {
    claim: FamilySignupGhlClaim;
    safeErrorCode: string;
    retryAt: string;
  }): Promise<boolean>;
  markIdentityReview(input: {
    claim: FamilySignupGhlClaim;
    safeErrorCode: string;
  }): Promise<boolean>;
  markAcceptanceUnknown(input: {
    claim: FamilySignupGhlClaim;
    safeErrorCode: string;
  }): Promise<boolean>;
}

export type FamilySignupGhlContactResult =
  | ({
      state: 'accepted';
      identityProjection: FamilySignupGhlIdentityProjection;
    } & FamilySignupGhlAcceptedEffect)
  | {
      state: 'identity_review';
      safeErrorCode:
        | 'multiple_exact_email_matches'
        | 'provider_suppression_drift'
        | 'provider_suppression_unavailable';
    };

export type FamilySignupGhlOpportunityResult = FamilySignupGhlAcceptedEffect & {
  householdProjection: FamilySignupGhlHouseholdProjection;
};

export interface FamilySignupGhlProvider {
  upsertAdultContact(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlContactResult>;
  upsertHouseholdOpportunity(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlOpportunityResult>;
  enrollConfirmationWorkflow(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlAcceptedEffect>;
}

export class FamilySignupGhlProviderError extends Error {
  constructor(
    readonly safeErrorCode: string,
    readonly acceptanceUnknown: boolean,
  ) {
    super(safeErrorCode);
    this.name = 'FamilySignupGhlProviderError';
  }
}
