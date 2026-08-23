import type {
  FamilySignupGhlProjectionReader,
  FamilySignupGhlProjectionRecoveryRepository,
} from './types.ts';

export type FamilySignupGhlProjectionRecoveryResult = {
  inspected: number;
  recoveryRequired: number;
  readbacksPerformed: number;
  completed: number;
  providerMutationsPerformed: false;
  rows: Array<{
    intentId: string;
    state: 'not_required' | 'recovery_required' | 'readback_verified' | 'completed';
  }>;
};

export async function runFamilySignupGhlProjectionRecovery(input: {
  repository: FamilySignupGhlProjectionRecoveryRepository;
  reader?: FamilySignupGhlProjectionReader;
  intentIds: readonly string[];
  runtimeTier: string;
  verificationEnvironmentId: string;
  apply: boolean;
}): Promise<FamilySignupGhlProjectionRecoveryResult> {
  if (input.apply && !input.reader) {
    throw new Error('family_signup_ghl_projection_recovery_reader_required');
  }
  const result: FamilySignupGhlProjectionRecoveryResult = {
    inspected: 0,
    recoveryRequired: 0,
    readbacksPerformed: 0,
    completed: 0,
    providerMutationsPerformed: false,
    rows: [],
  };

  for (const intentId of input.intentIds) {
    const claim = await input.repository.loadProjectionRecoveryClaim({
      intentId,
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
    });
    result.inspected += 1;
    if (!claim) {
      result.rows.push({ intentId, state: 'not_required' });
      continue;
    }
    result.recoveryRequired += 1;
    if (!input.reader) {
      result.rows.push({ intentId, state: 'recovery_required' });
      continue;
    }
    const readback = await input.reader.readProjection(
      claim,
      `family-signup-ghl-projection-recovery:${intentId}`,
    );
    result.readbacksPerformed += 1;
    if (!input.apply) {
      result.rows.push({ intentId, state: 'readback_verified' });
      continue;
    }
    if (!(await input.repository.completeProjectionRecovery({ claim, readback }))) {
      throw new Error('family_signup_ghl_projection_recovery_fenced');
    }
    result.completed += 1;
    result.rows.push({ intentId, state: 'completed' });
  }
  return result;
}
