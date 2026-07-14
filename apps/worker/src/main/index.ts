import 'dotenv/config';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import { createPgPool } from '../../../../packages/db/src/index.ts';
import { processOutboxSink } from '../../../../packages/domain/src/index.ts';
import { logger } from '../../../../packages/observability/src/index.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

export async function runOutboxSinkOnce() {
  const result = await processOutboxSink(pool);
  for (const deliveryKey of result.deliveryKeys) {
    logger.info({ delivery_key: deliveryKey }, 'sink delivered outbox event');
  }
  return result.delivered;
}

if (process.argv.includes('--once')) {
  const count = await runOutboxSinkOnce();
  process.stdout.write(`sink_delivered=${count}\n`);
  await pool.end();
} else {
  const run = async () => {
    try {
      await runOutboxSinkOnce();
    } catch (error) {
      logger.error({ error }, 'outbox sink failed');
    }
  };
  await run();
  setInterval(run, 15_000).unref();
}
