import { loadConfig } from '../../../packages/config/src/index.ts';
import { createPgPool } from '../../../packages/db/src/index.ts';
import { captureTishaBavRegistration } from '../../../packages/domain/src/index.ts';

const publicDatabaseUrl = process.env.DATABASE_PUBLIC_URL;
if (!publicDatabaseUrl) {
  throw new Error('DATABASE_PUBLIC_URL is required for the Railway preview smoke.');
}

process.env.DATABASE_URL = publicDatabaseUrl;
process.env.ONE_TIME_ACCOUNT_KEY = 'rabbi_sheller_provider';
process.env.ONE_TIME_PRODUCT_KEY = 'one_time_mishnah_class';
process.env.PUBLIC_BASE_URL = 'https://ot99-web-onetimev2-pr-102.up.railway.app';

const email = `codex-tisha-bav-preview-${Date.now()}@example.com`;
const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const result = await captureTishaBavRegistration({
    pool,
    config,
    payload: {
      email,
      first_name: 'Codex',
      newsletter_opt_in: false,
      source: 'tisha_bav_preview_smoke',
      idempotency_key: `preview-smoke-${Date.now()}`,
      homepage: '',
    },
  });
  process.stdout.write(
    `${JSON.stringify({
      success: result.success,
      event_code: result.event_code,
      confirmation_queued: result.confirmation_queued,
      ghl_sync_status: result.ghl_sync_status,
      duplicate_submission: result.duplicate_submission,
    })}\n`,
  );
} finally {
  await pool.end();
}
