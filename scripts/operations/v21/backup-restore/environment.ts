import { issue, result, type ValidationIssue } from './validation.ts';

export const ENVIRONMENT_RUNTIME_TIER = {
  ci: 'isolated_staging',
  provider_sandbox: 'isolated_staging',
  persistent_staging: 'isolated_staging',
  production_read_only: 'production',
  production_operator_canary: 'production',
  production_broad: 'production',
} as const;

export type VerificationEnvironmentId = keyof typeof ENVIRONMENT_RUNTIME_TIER;
export type RuntimeTier = (typeof ENVIRONMENT_RUNTIME_TIER)[VerificationEnvironmentId];
export type CredentialBoundary = 'isolated' | 'live';

export interface EnvironmentIdentity {
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
}

export function validateEnvironmentIdentity(input: EnvironmentIdentity): ReturnType<typeof result> {
  const issues: ValidationIssue[] = [];
  const expectedTier =
    ENVIRONMENT_RUNTIME_TIER[input.verification_environment_id as VerificationEnvironmentId];

  if (expectedTier === undefined) {
    issues.push(
      issue(
        'ENVIRONMENT_ID_UNKNOWN',
        'verification_environment_id',
        'The verification environment is not part of the locked v2.1 mapping.',
      ),
    );
    return result(issues);
  }

  if (input.runtime_tier !== expectedTier) {
    issues.push(
      issue(
        'ENVIRONMENT_TIER_MISMATCH',
        'runtime_tier',
        `Expected ${expectedTier} for ${input.verification_environment_id}.`,
      ),
    );
  }

  const expectedBoundary: CredentialBoundary = expectedTier === 'production' ? 'live' : 'isolated';
  if (input.credential_boundary !== expectedBoundary) {
    issues.push(
      issue(
        'CREDENTIAL_BOUNDARY_MISMATCH',
        'credential_boundary',
        `Expected ${expectedBoundary}; credential fallback is forbidden.`,
      ),
    );
  }

  return result(issues);
}
