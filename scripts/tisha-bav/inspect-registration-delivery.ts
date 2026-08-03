import 'dotenv/config';
import { createHash } from 'node:crypto';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { inspectTishaBavRegistrationDelivery } from '../../packages/domain/src/index.ts';

const registrationKey = process.env.TISHA_BAV_REGISTRATION_KEY?.trim();
if (!registrationKey) throw new Error('TISHA_BAV_REGISTRATION_KEY is required for inspection.');

const config = loadConfig(process.env);

const pool = createPgPool(config);
try {
  const result = await inspectTishaBavRegistrationDelivery({
    pool,
    config,
    registrationKey,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        registration_reference: createHash('sha256').update(registrationKey).digest('hex'),
        status: result.status,
        would_enqueue: result.would_enqueue,
        eligibility_reason: result.eligibility_reason,
        delivery_state: result.delivery_state ?? null,
        writes_performed: 0,
        provider_calls: 0,
        private_destination_included: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await pool.end();
}
