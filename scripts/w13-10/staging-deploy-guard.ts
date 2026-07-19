export type StagingDeployGuardInput = {
  readonly projectId: string;
  readonly environmentId: string;
  readonly webServiceId: string;
  readonly workerServiceId: string;
  readonly databaseServiceId: string;
  readonly targetKind: 'staging' | 'production' | 'unknown';
  readonly sourceSha: string;
  readonly imageDigest: string;
  readonly preDeployVersion: string;
  readonly expectedPostDeployVersion: string;
  readonly migrationsSeparateOperation: boolean;
  readonly providersOff: boolean;
  readonly realImportOff: boolean;
  readonly liveBillingOff: boolean;
};

export type StagingDeployGuardResult = {
  readonly allowed: boolean;
  readonly dryRun: true;
  readonly refusalCodes: readonly string[];
  readonly requiredReadbacks: readonly string[];
};

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function evaluateStagingDeployCommand(
  input: StagingDeployGuardInput,
): StagingDeployGuardResult {
  const refusalCodes: string[] = [];
  for (const [key, value] of Object.entries({
    projectId: input.projectId,
    environmentId: input.environmentId,
    webServiceId: input.webServiceId,
    workerServiceId: input.workerServiceId,
    databaseServiceId: input.databaseServiceId,
  })) {
    if (!value || /^latest|current|staging$/i.test(value)) {
      refusalCodes.push(`${key}_not_exact`);
    }
  }
  if (input.targetKind !== 'staging') refusalCodes.push('target_not_isolated_staging');
  if (!SHA_PATTERN.test(input.sourceSha)) refusalCodes.push('source_sha_not_immutable');
  if (!DIGEST_PATTERN.test(input.imageDigest)) refusalCodes.push('image_digest_not_immutable');
  if (!input.preDeployVersion) refusalCodes.push('pre_deploy_version_missing');
  if (!input.expectedPostDeployVersion.includes(input.sourceSha.slice(0, 12))) {
    refusalCodes.push('expected_version_does_not_match_source');
  }
  if (!input.migrationsSeparateOperation) refusalCodes.push('migrations_not_separate');
  if (!input.providersOff) refusalCodes.push('providers_not_off');
  if (!input.realImportOff) refusalCodes.push('real_import_not_off');
  if (!input.liveBillingOff) refusalCodes.push('live_billing_not_off');
  return {
    allowed: refusalCodes.length === 0,
    dryRun: true,
    refusalCodes,
    requiredReadbacks: [
      '/version before deployment',
      '/version after deployment',
      '/health',
      '/ready',
      'worker heartbeat',
      'migration ledger',
      'queue state',
      'backup freshness',
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  process.stdout.write(
    JSON.stringify(
      evaluateStagingDeployCommand({
        projectId: '',
        environmentId: '',
        webServiceId: '',
        workerServiceId: '',
        databaseServiceId: '',
        targetKind: 'unknown',
        sourceSha: '',
        imageDigest: '',
        preDeployVersion: '',
        expectedPostDeployVersion: '',
        migrationsSeparateOperation: false,
        providersOff: false,
        realImportOff: false,
        liveBillingOff: false,
      }),
      null,
      2,
    ),
  );
}
