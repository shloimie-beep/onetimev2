import { describe, expect, it, vi } from 'vitest';
import { runFamilySignupGhlProjectionRecovery } from './projection-recovery-runner.ts';
import type {
  FamilySignupGhlProjectionReader,
  FamilySignupGhlProjectionRecoveryClaim,
  FamilySignupGhlProjectionRecoveryRepository,
  FamilySignupGhlProjectionReadback,
} from './types.ts';

const claim: FamilySignupGhlProjectionRecoveryClaim = {
  intentId: 'family-signup-projection-recovery-runner-test',
  adultId: 'adult-projection-recovery-runner-test',
  householdId: 'household-projection-recovery-runner-test',
  normalizedEmail: 'adult@example.test',
  accessState: 'free',
  product: 'one_time_mishnayos',
  runtimeTier: 'production',
  verificationEnvironmentId: 'production_broad',
  providerContactId: 'provider-contact-projection-recovery-runner-test',
  providerOpportunityId: 'provider-opportunity-projection-recovery-runner-test',
};

const readback: FamilySignupGhlProjectionReadback = {
  identityProjection: {
    normalizedEmailHash: 'a'.repeat(64),
    providerContactRefHash: 'b'.repeat(64),
    marketingSuppressed: false,
    serviceSuppressed: false,
    suppressionEvidenceDigest: 'c'.repeat(64),
  },
  householdProjection: {
    providerContactRefHash: 'b'.repeat(64),
    providerHouseholdRefHash: 'd'.repeat(64),
    providerRevision: 1,
    readbackDigest: 'e'.repeat(64),
  },
};

describe('Family-signup projection recovery runner', () => {
  it('inspects exact intents without constructing a provider boundary', async () => {
    const repository = repo(claim);
    await expect(
      runFamilySignupGhlProjectionRecovery({
        repository,
        intentIds: [claim.intentId],
        runtimeTier: 'production',
        verificationEnvironmentId: 'production_broad',
        apply: false,
      }),
    ).resolves.toMatchObject({
      inspected: 1,
      recoveryRequired: 1,
      readbacksPerformed: 0,
      completed: 0,
      providerMutationsPerformed: false,
      rows: [{ intentId: claim.intentId, state: 'recovery_required' }],
    });
    expect(repository.completeProjectionRecovery).not.toHaveBeenCalled();
  });

  it('keeps verified readback separate from the explicit local apply', async () => {
    const repository = repo(claim);
    const reader: FamilySignupGhlProjectionReader = {
      readProjection: vi.fn(async () => readback),
    };
    const result = await runFamilySignupGhlProjectionRecovery({
      repository,
      reader,
      intentIds: [claim.intentId],
      runtimeTier: 'production',
      verificationEnvironmentId: 'production_broad',
      apply: false,
    });
    expect(result.rows).toEqual([{ intentId: claim.intentId, state: 'readback_verified' }]);
    expect(reader.readProjection).toHaveBeenCalledTimes(1);
    expect(repository.completeProjectionRecovery).not.toHaveBeenCalled();
  });

  it('applies only the exact verified claim and never reports a provider mutation', async () => {
    const repository = repo(claim);
    const reader: FamilySignupGhlProjectionReader = {
      readProjection: vi.fn(async () => readback),
    };
    await expect(
      runFamilySignupGhlProjectionRecovery({
        repository,
        reader,
        intentIds: [claim.intentId],
        runtimeTier: 'production',
        verificationEnvironmentId: 'production_broad',
        apply: true,
      }),
    ).resolves.toMatchObject({
      completed: 1,
      providerMutationsPerformed: false,
      rows: [{ intentId: claim.intentId, state: 'completed' }],
    });
    expect(repository.completeProjectionRecovery).toHaveBeenCalledWith({ claim, readback });
  });
});

function repo(
  recoveryClaim: FamilySignupGhlProjectionRecoveryClaim | null,
): FamilySignupGhlProjectionRecoveryRepository & {
  loadProjectionRecoveryClaim: ReturnType<typeof vi.fn>;
  completeProjectionRecovery: ReturnType<typeof vi.fn>;
} {
  return {
    loadProjectionRecoveryClaim: vi.fn(async () => recoveryClaim),
    completeProjectionRecovery: vi.fn(async () => true),
  };
}
