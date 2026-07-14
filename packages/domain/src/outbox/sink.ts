import type { DbPool, Queryable } from '../../../db/src/index.ts';

export type SinkResult = {
  delivered: number;
  deliveryKeys: string[];
};

export async function processOutboxSink(pool: DbPool, limit = 25): Promise<SinkResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await selectPendingOutbox(client, limit);
    const deliveryKeys: string[] = [];
    for (const row of rows.rows) {
      deliveryKeys.push(row.delivery_key);
      await client.query(
        `UPDATE onetime.outbox_events
            SET status = 'sink_delivered', attempts = attempts + 1, delivered_at = now()
          WHERE id = $1`,
        [row.id],
      );
    }
    await client.query('COMMIT');
    return { delivered: rows.rowCount ?? 0, deliveryKeys };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function selectPendingOutbox(client: Queryable, limit: number) {
  const lockedSql = `SELECT id, delivery_key
         FROM onetime.outbox_events
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`;
  try {
    return await client.query(lockedSql, [limit]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('SKIP LOCKED')) {
      return client.query(
        `SELECT id, delivery_key
           FROM onetime.outbox_events
          WHERE status = 'pending' AND next_attempt_at <= now()
          ORDER BY created_at ASC
          LIMIT $1`,
        [limit],
      );
    }
    throw error;
  }
}
