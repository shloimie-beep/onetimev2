import 'dotenv/config';
import { createHash } from 'node:crypto';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { reprocessTishaBavRegistrationDelivery } from '../../packages/domain/src/index.ts';

const registrationKey = process.env.TISHA_BAV_REGISTRATION_KEY?.trim();
if (!registrationKey) throw new Error('TISHA_BAV_REGISTRATION_KEY is required.');
const allowAlreadyEnrolledRecovery =
  process.env.TISHA_BAV_ALLOW_ALREADY_ENROLLED_RECOVERY === 'true';

const config = loadConfig(process.env);
if (config.highLevelEventSyncMode !== 'provider') {
  throw new Error('HIGHLEVEL_EVENT_SYNC_MODE must be provider for reprocessing.');
}

const pool = createPgPool(config);
try {
  const result = await reprocessTishaBavRegistrationDelivery({
    pool,
    config,
    registrationKey,
    allowAlreadyEnrolledRecovery,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        registration_reference: createHash('sha256').update(registrationKey).digest('hex'),
        status: result.status,
        fallback_queued: result.fallback_queued,
        private_destination_included: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await pool.end();
}
