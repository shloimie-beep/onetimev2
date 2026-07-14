import 'dotenv/config';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import { createPgPool } from '../../../../packages/db/src/index.ts';
import { logger } from '../../../../packages/observability/src/index.ts';

const config = loadConfig(process.env);
const pool = createPgPool(config);

export async function runOutboxSinkOnce() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query(
      `SELECT id, delivery_key
         FROM onetime.outbox_events
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at ASC
        LIMIT 25
        FOR UPDATE SKIP LOCKED`,
    );
    for (const row of rows.rows) {
      await client.query(
        `UPDATE onetime.outbox_events
            SET status = 'sink_delivered', attempts = attempts + 1, delivered_at = now()
          WHERE id = $1`,
        [row.id],
      );
      logger.info({ delivery_key: row.delivery_key }, 'sink delivered outbox event');
    }
    await client.query('COMMIT');
    return rows.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
