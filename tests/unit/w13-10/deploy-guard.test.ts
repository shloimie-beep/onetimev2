import { describe, expect, it } from 'vitest';
import { evaluateStagingDeployCommand } from '../../../scripts/w13-10/staging-deploy-guard.ts';

const goodInput = {
  projectId: 'railway-project-opaque-001',
  environmentId: 'railway-env-isolated-staging-001',
  webServiceId: 'railway-web-service-001',
  workerServiceId: 'railway-worker-service-001',
  databaseServiceId: 'railway-db-service-001',
  targetKind: 'staging',
  sourceSha: '0d8d7168f066668f035176d777bdaaa4dcc5accd',
  imageDigest: `sha256:${'a'.repeat(64)}`,
  preDeployVersion: 'ops11-1197673',
  expectedPostDeployVersion: 'w13-10-0d8d7168f066',
  migrationsSeparateOperation: true,
  providersOff: true,
  realImportOff: true,
  liveBillingOff: true,
} as const;

describe('W13-10 staging deploy guard', () => {
  it('allows only dry-run isolated staging commands with immutable identifiers', () => {
    const result = evaluateStagingDeployCommand(goodInput);
    expect(result.allowed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.requiredReadbacks).toContain('/version after deployment');
  });

  it('refuses ambiguous, production, mutable, or provider-enabled commands', () => {
    const result = evaluateStagingDeployCommand({
      ...goodInput,
      projectId: 'current',
      targetKind: 'production',
      sourceSha: 'main',
      imageDigest: 'latest',
      providersOff: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.refusalCodes).toEqual(
      expect.arrayContaining([
        'projectId_not_exact',
        'target_not_isolated_staging',
        'source_sha_not_immutable',
        'image_digest_not_immutable',
        'providers_not_off',
      ]),
    );
  });
});
