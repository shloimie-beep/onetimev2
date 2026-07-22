import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { fullAppProvisionPublicSummary, runFullAppProvision } from './provision-preview.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const result = await runFullAppProvision({
    pool,
    config,
    publicBaseUrl: process.env.FULL_APP_STAGING_URL ?? config.publicBaseUrl,
    writePrivateHandoff: true,
    requirePrivateDestinations: true,
  });
  process.stdout.write(`${JSON.stringify(fullAppProvisionPublicSummary(result), null, 2)}\n`);
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
