import { createPostgresFamilySignupGhlRepository } from './repository.ts';
import { HighLevelFamilySignupProvider } from './provider.ts';
import { runFamilySignupGhlBatch } from './runner.ts';
import type { FamilySignupGhlProvider, FamilySignupGhlRepository } from './types.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../registry/index.ts';

export type FamilySignupGhlRuntime = {
  repository?: FamilySignupGhlRepository;
  provider?: FamilySignupGhlProvider;
};

export async function runFamilySignupGhlWorker(
  context: WorkerRunnerContext,
  runtime?: FamilySignupGhlRuntime,
): Promise<WorkerRunnerResult> {
  const mode = context.config.familySignupGhlMode;
  if (mode === 'disabled') {
    return { enabled: false, providerCallsPerformed: false, summary: { mode } };
  }
  if (
    mode !== 'provider_canary' ||
    !context.config.familySignupGhlOt01ProofId ||
    !context.config.familySignupGhlCanaryRunId ||
    context.config.familySignupGhlCanaryIntentIds.length !== 1 ||
    context.config.familySignupGhlCanaryBudget !== 1 ||
    context.config.familySignupGhlBatchSize !== 1
  ) {
    return {
      enabled: false,
      providerCallsPerformed: false,
      summary: { mode, safe_error_code: 'invalid_family_signup_ghl_mode' },
    };
  }
  if (!context.config.highLevelPrivateIntegrationsToken) {
    return {
      enabled: false,
      providerCallsPerformed: false,
      summary: { mode, safe_error_code: 'highlevel_token_unconfigured' },
    };
  }
  const result = await runFamilySignupGhlBatch({
    repository:
      runtime?.repository ??
      createPostgresFamilySignupGhlRepository(context.pool, {
        accountKey: context.config.accountKey,
        productKey: context.config.productKey,
        highLevelLocationId: context.config.highLevelLocationId,
      }),
    provider: runtime?.provider ?? new HighLevelFamilySignupProvider(context.config),
    runtimeTier: context.config.oneTimeRuntimeTier,
    verificationEnvironmentId: context.config.oneTimeVerificationEnvironmentId,
    leaseMs: context.config.highLevelRowLeaseMs,
    limit: 1,
    allowedIntentIds: context.config.familySignupGhlCanaryIntentIds,
  });
  return {
    enabled: true,
    providerCallsPerformed: result.providerCallsPerformed,
    summary: result,
  };
}
