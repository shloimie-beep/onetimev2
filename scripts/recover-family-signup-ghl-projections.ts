import { pathToFileURL } from 'node:url';
import { loadConfig } from '../packages/config/src/index.ts';
import { createPgPool } from '../packages/db/src/index.ts';
import { HighLevelFamilySignupProjectionReader } from '../apps/worker/src/runners/family-signup-ghl/projection-reader.ts';
import { runFamilySignupGhlProjectionRecovery } from '../apps/worker/src/runners/family-signup-ghl/projection-recovery-runner.ts';
import { createPostgresFamilySignupGhlRepository } from '../apps/worker/src/runners/family-signup-ghl/repository.ts';

export const FAMILY_SIGNUP_GHL_PROJECTION_RECOVERY_AUTHORIZATION =
  'I_AUTHORIZE_READ_ONLY_GHL_PROJECTION_RECOVERY';

export type FamilySignupGhlProjectionRecoveryCli = {
  intentIds: string[];
  expectedCommit: string;
  readback: boolean;
  apply: boolean;
  authorization: string | null;
};

export function parseFamilySignupGhlProjectionRecoveryArgs(
  args: readonly string[],
): FamilySignupGhlProjectionRecoveryCli {
  const parsed: FamilySignupGhlProjectionRecoveryCli = {
    intentIds: [],
    expectedCommit: '',
    readback: false,
    apply: false,
    authorization: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--readback') {
      parsed.readback = true;
      continue;
    }
    if (arg === '--apply') {
      parsed.apply = true;
      continue;
    }
    const value = args[index + 1];
    if (!value) throw new Error(`family_signup_ghl_recovery_argument_missing:${arg}`);
    if (arg === '--intent-ids') {
      parsed.intentIds = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (arg === '--expected-commit') {
      parsed.expectedCommit = value.trim().toLowerCase();
    } else if (arg === '--authorization') {
      parsed.authorization = value;
    } else {
      throw new Error(`family_signup_ghl_recovery_argument_unknown:${arg}`);
    }
    index += 1;
  }
  parsed.intentIds = [...new Set(parsed.intentIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (parsed.intentIds.length < 1 || parsed.intentIds.length > 10) {
    throw new Error('family_signup_ghl_recovery_intent_budget_invalid');
  }
  if (parsed.intentIds.some((intentId) => !/^[A-Za-z0-9:_-]{8,200}$/u.test(intentId))) {
    throw new Error('family_signup_ghl_recovery_intent_id_invalid');
  }
  if (!/^[a-f0-9]{40}$/u.test(parsed.expectedCommit)) {
    throw new Error('family_signup_ghl_recovery_expected_commit_invalid');
  }
  if (parsed.apply && !parsed.readback) {
    throw new Error('family_signup_ghl_recovery_apply_requires_readback');
  }
  if (
    parsed.readback &&
    parsed.authorization !== FAMILY_SIGNUP_GHL_PROJECTION_RECOVERY_AUTHORIZATION
  ) {
    throw new Error('family_signup_ghl_recovery_authorization_invalid');
  }
  return parsed;
}

export async function runFamilySignupGhlProjectionRecoveryCli(
  args: readonly string[],
  source: NodeJS.ProcessEnv = process.env,
) {
  const options = parseFamilySignupGhlProjectionRecoveryArgs(args);
  const config = loadConfig(source);
  if (config.commitSha !== options.expectedCommit || config.appVersion !== options.expectedCommit) {
    throw new Error('family_signup_ghl_recovery_runtime_identity_mismatch');
  }
  if (config.oneTimeRuntimeTier !== 'production') {
    throw new Error('family_signup_ghl_recovery_production_runtime_required');
  }
  const pool = createPgPool(config);
  try {
    const repository = createPostgresFamilySignupGhlRepository(pool, {
      highLevelLocationId: config.highLevelLocationId,
    });
    const result = await runFamilySignupGhlProjectionRecovery({
      repository,
      ...(options.readback ? { reader: new HighLevelFamilySignupProjectionReader(config) } : {}),
      intentIds: options.intentIds,
      runtimeTier: config.oneTimeRuntimeTier,
      verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
      apply: options.apply,
    });
    return {
      ...result,
      mode: options.apply
        ? 'readback_and_apply'
        : options.readback
          ? 'readback_only'
          : 'inspect_only',
      runtime: {
        commit_sha: config.commitSha,
        runtime_tier: config.oneTimeRuntimeTier,
        verification_environment_id: config.oneTimeVerificationEnvironmentId,
      },
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const result = await runFamilySignupGhlProjectionRecoveryCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const safeErrorCode = error instanceof Error ? error.message : 'unknown_error';
    process.stderr.write(
      `${JSON.stringify({ status: 'failed', safe_error_code: safeErrorCode })}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
