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
  const mode = context.source.FAMILY_SIGNUP_GHL_MODE ?? 'disabled';
  if (mode === 'disabled') {
    return { enabled: false, providerCallsPerformed: false, summary: { mode } };
  }
  if (mode !== 'provider') {
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
    repository: runtime?.repository ?? createPostgresFamilySignupGhlRepository(context.pool),
    provider: runtime?.provider ?? new HighLevelFamilySignupProvider(context.config),
    runtimeTier: context.config.oneTimeRuntimeTier,
    verificationEnvironmentId: context.config.oneTimeVerificationEnvironmentId,
    leaseMs: context.config.highLevelRowLeaseMs,
    limit: Math.max(1, Math.min(Number(context.source.FAMILY_SIGNUP_GHL_BATCH_SIZE ?? 12), 50)),
  });
  return {
    enabled: true,
    providerCallsPerformed: result.providerCallsPerformed,
    summary: result,
  };
}
