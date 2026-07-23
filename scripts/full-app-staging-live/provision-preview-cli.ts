import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { runReviewedFreePilotCommand } from '../access/free-pilot.ts';
import {
  fullAppProvisionPublicSummary,
  rotateFullAppPreviewAdminCredential,
  runFullAppProvision,
} from './provision-preview.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const selectedOperations = [
    process.argv.includes('--rotate-admin-only') ? 'rotate-admin' : null,
    process.argv.includes('--grant-free-pilot') ? 'grant-free-pilot' : null,
    process.argv.includes('--revoke-free-pilot') ? 'revoke-free-pilot' : null,
  ].filter((value): value is string => Boolean(value));
  if (selectedOperations.length > 1) {
    throw new Error('Choose exactly one protected provisioning operation.');
  }

  if (selectedOperations[0] === 'rotate-admin') {
    const result = await rotateFullAppPreviewAdminCredential({
      pool,
      config,
      publicBaseUrl: process.env.FULL_APP_STAGING_URL ?? config.publicBaseUrl,
      requirePrivateDestinations: true,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (
    selectedOperations[0] === 'grant-free-pilot' ||
    selectedOperations[0] === 'revoke-free-pilot'
  ) {
    const operation =
      selectedOperations[0] === 'grant-free-pilot' ? ('grant' as const) : ('revoke' as const);
    const result = await runReviewedFreePilotCommand({
      pool,
      config,
      operation,
      expectedAccountKey: requiredEnvironment('ONE_TIME_FREE_PILOT_EXPECTED_ACCOUNT_KEY'),
      expectedProductKey: requiredEnvironment('ONE_TIME_FREE_PILOT_EXPECTED_PRODUCT_KEY'),
      householdKey: requiredEnvironment('ONE_TIME_FREE_PILOT_HOUSEHOLD_KEY'),
      authorizationPhrase: process.env.ONE_TIME_FREE_PILOT_AUTHORIZATION,
      idempotencyKey: requiredEnvironment('ONE_TIME_FREE_PILOT_IDEMPOTENCY_KEY'),
      policyVersion: requiredEnvironment('ONE_TIME_FREE_PILOT_POLICY_VERSION'),
      ...(operation === 'grant'
        ? {
            expiresAt: requiredEnvironmentDate('ONE_TIME_FREE_PILOT_EXPIRES_AT'),
            opaqueSourceReference: requiredEnvironment('ONE_TIME_FREE_PILOT_SOURCE_REFERENCE'),
          }
        : {
            reason: requiredEnvironment('ONE_TIME_FREE_PILOT_REVOKE_REASON'),
          }),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const result = await runFullAppProvision({
      pool,
      config,
      publicBaseUrl: process.env.FULL_APP_STAGING_URL ?? config.publicBaseUrl,
      writePrivateHandoff: true,
      requirePrivateDestinations: true,
    });
    process.stdout.write(`${JSON.stringify(fullAppProvisionPublicSummary(result), null, 2)}\n`);
  }
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredEnvironmentDate(name: string) {
  const value = requiredEnvironment(name);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${name} must be an ISO timestamp.`);
  return parsed;
}
